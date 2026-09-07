import type { FunctionNode, LintNode, RuleFixer, RuleModule } from '#plugin-types';

import { hasBlankLine } from '#utils/chain';

function isFunctionNode(node: LintNode): node is FunctionNode {
  return (
    node.type === 'FunctionDeclaration'
    || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression'
  );
}

function enclosingFunction(node: LintNode): FunctionNode | null {
  let current = node.parent ?? null;
  while (current !== null && current !== undefined) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent ?? null;
  }

  return null;
}

function statementList(parent: LintNode): LintNode[] | null {
  if (
    parent.type === 'BlockStatement'
    || parent.type === 'Program'
    || parent.type === 'StaticBlock'
  ) {
    return parent.body as LintNode[];
  }
  if (parent.type === 'SwitchCase') {
    return (parent as LintNode & { consequent?: LintNode[] }).consequent ?? null;
  }

  return null;
}

function previousStatement(node: LintNode): LintNode | null {
  const parent = node.parent;
  if (parent === null || parent === undefined) {
    return null;
  }
  const list = statementList(parent);
  if (list === null || list === undefined) {
    return null;
  }
  const index = list.indexOf(node);
  if (index <= 0) {
    return null;
  }

  return list[index - 1] ?? null;
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require a blank line before return when the function has more than one return.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this return.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const returnsByFunction = new Map<FunctionNode, LintNode[]>();

    return {
      ReturnStatement(node: LintNode) {
        const fn = enclosingFunction(node);
        if (fn === null) {
          return;
        }
        const list = returnsByFunction.get(fn) ?? [];
        list.push(node);
        returnsByFunction.set(fn, list);
      },
      'Program:exit'() {
        for (const returns of returnsByFunction.values()) {
          if (returns.length < 2) {
            continue;
          }
          for (const stmt of returns) {
            const previous = previousStatement(stmt);
            const prevRange = previous?.range;
            const stmtRange = stmt.range;
            if (
              previous === null
              || prevRange === null
              || prevRange === undefined
              || stmtRange === null
              || stmtRange === undefined
            ) {
              continue;
            }
            const gap = sourceCode.text.slice(prevRange[1], stmtRange[0]);
            if (hasBlankLine(gap)) {
              continue;
            }
            const sameLine = previous.loc!.end.line === stmt.loc!.start.line;
            context.report({
              node: stmt,
              messageId: 'missingBlankLine',
              fix(fixer: RuleFixer) {
                return fixer.insertTextAfterRange(
                  prevRange,
                  sameLine ? '\n\n' : '\n',
                );
              },
            });
          }
        }
      },
    };
  },
};

export default rule;
