import type { Identifier, LintNode, RuleContext, RuleFixer, RuleModule } from '#plugin-types';

import { type BindingKind, STOLEN, functionKind, suggestedName } from './names.ts';
import { bindingNodes, findVariable, nameTaken } from './scope.ts';

function renameName(fixer: RuleFixer, node: Identifier, suggested: string) {
  const range = node.range;
  if (range === undefined) {
    return fixer.replaceText(node, suggested);
  }

  return fixer.replaceTextRange([range[0], range[0] + node.name.length], suggested);
}

function checkPattern(
  context: RuleContext,
  pattern: LintNode,
  kind: BindingKind,
  allowFix = true,
) {
  if (pattern.type === 'Identifier') {
    if (pattern.name === 'this' || pattern.name === '_') {
      return;
    }

    if (STOLEN.has(pattern.name)) {
      context.report({
        node: pattern,
        messageId: 'stolenName',
        data: {
          name: pattern.name,
        },
      });
      return;
    }

    if (kind === 'value') {
      return;
    }

    const suggested = suggestedName(pattern.name, kind);
    if (suggested === null) {
      return;
    }

    const variable = findVariable(context, pattern, pattern.name);
    const canFix = allowFix && variable !== undefined && !nameTaken(variable.scope, suggested);

    context.report({
      node: pattern,
      messageId: 'opaqueName',
      data: {
        name: pattern.name,
        suggested,
      },
      fix: canFix
        ? fixer => bindingNodes(variable, pattern).map(node => renameName(fixer, node, suggested))
        : undefined,
    });
    return;
  }

  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) {
        checkPattern(context, element, kind, allowFix);
      }
    }
    return;
  }

  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        checkPattern(context, property.argument as LintNode, kind, false);
        continue;
      }

      if (property.value) {
        checkPattern(context, property.value as LintNode, kind, property.shorthand !== true);
      }
    }
    return;
  }

  if (pattern.type === 'AssignmentPattern') {
    checkPattern(context, pattern.left as LintNode, kind, allowFix);
    return;
  }

  if (pattern.type === 'RestElement') {
    checkPattern(context, pattern.argument as LintNode, kind, allowFix);
  }
}

function checkForBinding(context: RuleContext, left: LintNode, kind: BindingKind) {
  if (left.type === 'VariableDeclaration') {
    for (const declarator of left.declarations) {
      checkPattern(context, declarator.id as LintNode, kind);
    }
    return;
  }

  if (left.type === 'Identifier') {
    checkPattern(context, left, kind);
  }
}

function checkFunction(context: RuleContext, node: LintNode) {
  const kind = functionKind(node);
  const params = (node as LintNode & { params?: LintNode[] }).params ?? [];

  for (const param of params) {
    checkPattern(context, param, kind);
  }
}

function isForDeclarator(node: LintNode) {
  const declaration = node.parent;
  const owner = declaration?.parent;
  return (
    owner?.type === 'ForStatement'
    || owner?.type === 'ForInStatement'
    || owner?.type === 'ForOfStatement'
  );
}

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Ban opaque param/loop names and bindings that steal builtins.',
    },
    fixable: 'code',
    messages: {
      opaqueName: "'{{name}}' does not describe this binding. Use '{{suggested}}'.",
      stolenName: "'{{name}}' is a builtin or dummy type name. Name the value.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node: LintNode) {
        if (isForDeclarator(node)) {
          return;
        }

        checkPattern(context, (node as LintNode & { id: LintNode }).id, 'value');
      },
      FunctionDeclaration(node: LintNode) {
        const id = (node as LintNode & { id?: Identifier | null }).id;
        if (id) {
          checkPattern(context, id, 'value');
        }

        checkFunction(context, node);
      },
      ClassDeclaration(node: LintNode) {
        const id = (node as LintNode & { id?: Identifier | null }).id;
        if (id) {
          checkPattern(context, id, 'value');
        }
      },
      ClassExpression(node: LintNode) {
        const id = (node as LintNode & { id?: Identifier | null }).id;
        if (id) {
          checkPattern(context, id, 'value');
        }
      },
      FunctionExpression(node: LintNode) {
        const id = (node as LintNode & { id?: Identifier | null }).id;
        if (id) {
          checkPattern(context, id, 'value');
        }

        checkFunction(context, node);
      },
      ArrowFunctionExpression(node: LintNode) {
        checkFunction(context, node);
      },
      CatchClause(node: LintNode) {
        const param = (node as LintNode & { param?: LintNode | null }).param;
        if (param) {
          checkPattern(context, param, 'catch');
        }
      },
      ForStatement(node: LintNode) {
        const init = (node as LintNode & { init?: LintNode | null }).init;
        if (init?.type === 'VariableDeclaration') {
          for (const declarator of init.declarations) {
            checkPattern(context, declarator.id as LintNode, 'for');
          }
        }
      },
      ForInStatement(node: LintNode) {
        checkForBinding(context, (node as LintNode & { left: LintNode }).left, 'for-in');
      },
      ForOfStatement(node: LintNode) {
        checkForBinding(context, (node as LintNode & { left: LintNode }).left, 'for-of');
      },
    };
  },
};

export default rule;
