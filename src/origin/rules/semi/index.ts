import type { LintNode, RuleContext, RuleFixer, RuleModule } from '#plugin-types';

function isLoopBinding(node: LintNode) {
  const parent = node.parent;
  if (parent === null || parent === undefined) {
    return false;
  }

  return parent.type === 'ForInStatement' || parent.type === 'ForOfStatement';
}

function isBlockDeclaration(node: LintNode) {
  return (
    node.type === 'FunctionDeclaration'
    || node.type === 'ClassDeclaration'
    || node.type === 'TSInterfaceDeclaration'
  );
}

function reportMissing(context: RuleContext, node: LintNode) {
  const last = context.sourceCode.getLastToken(node);
  if (last === null || last === undefined || last.value === ';') {
    return;
  }

  const next = context.sourceCode.getTokenAfter(last);
  if (next !== null && next !== undefined && next.value === ';') {
    return;
  }

  context.report({
    node,
    messageId: 'missing',
    fix(fixer: RuleFixer) {
      return fixer.insertTextAfterRange(last.range, ';');
    },
  });
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require semicolons.',
    },
    fixable: 'code',
    messages: {
      missing: 'Missing semicolon.',
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclaration(node: LintNode) {
        if (isLoopBinding(node)) {
          return;
        }

        reportMissing(context, node);
      },
      ExpressionStatement(node: LintNode) {
        reportMissing(context, node);
      },
      ReturnStatement(node: LintNode) {
        reportMissing(context, node);
      },
      ThrowStatement(node: LintNode) {
        reportMissing(context, node);
      },
      BreakStatement(node: LintNode) {
        reportMissing(context, node);
      },
      ContinueStatement(node: LintNode) {
        reportMissing(context, node);
      },
      DebuggerStatement(node: LintNode) {
        reportMissing(context, node);
      },
      DoWhileStatement(node: LintNode) {
        reportMissing(context, node);
      },
      ImportDeclaration(node: LintNode) {
        reportMissing(context, node);
      },
      ExportAllDeclaration(node: LintNode) {
        reportMissing(context, node);
      },
      ExportNamedDeclaration(node: LintNode) {
        if (node.type !== 'ExportNamedDeclaration') {
          return;
        }

        if (node.declaration !== null && node.declaration !== undefined) {
          return;
        }

        reportMissing(context, node);
      },
      ExportDefaultDeclaration(node: LintNode) {
        if (node.type !== 'ExportDefaultDeclaration') {
          return;
        }

        if (isBlockDeclaration(node.declaration)) {
          return;
        }

        reportMissing(context, node);
      },
      PropertyDefinition(node: LintNode) {
        reportMissing(context, node);
      },
      TSTypeAliasDeclaration(node: LintNode) {
        reportMissing(context, node);
      },
      TSDeclareFunction(node: LintNode) {
        reportMissing(context, node);
      },
    };
  },
};

export default rule;
