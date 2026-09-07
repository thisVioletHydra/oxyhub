import type { FunctionNode, LintNode, RuleFixer, RuleModule } from '#plugin-types';

import { blankLineInsert, enclosingFunction, isExitStatement, previousStatement } from '#layout/statements';

function collectExit(exitsByFunction: Map<FunctionNode, LintNode[]>, node: LintNode) {
  if (!isExitStatement(node)) {
    return;
  }

  const fn = enclosingFunction(node);
  if (fn === null) {
    return;
  }

  const list = exitsByFunction.get(fn) ?? [];
  list.push(node);
  exitsByFunction.set(fn, list);
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require a blank line before return or throw when the function has more than one of them.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this return or throw.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const exitsByFunction = new Map<FunctionNode, LintNode[]>();

    return {
      ReturnStatement(node: LintNode) {
        collectExit(exitsByFunction, node);
      },
      ThrowStatement(node: LintNode) {
        collectExit(exitsByFunction, node);
      },
      'Program:exit'() {
        for (const exits of exitsByFunction.values()) {
          if (exits.length < 2) {
            continue;
          }

          for (const stmt of exits) {
            const previous = previousStatement(stmt);
            if (previous === null) {
              continue;
            }

            const insert = blankLineInsert(sourceCode.text, previous, stmt);
            if (insert === null) {
              continue;
            }

            context.report({
              node: stmt,
              messageId: 'missingBlankLine',
              fix(fixer: RuleFixer) {
                return fixer.insertTextAfterRange(insert.prevRange, insert.text);
              },
            });
          }
        }
      },
    };
  },
};

export default rule;
