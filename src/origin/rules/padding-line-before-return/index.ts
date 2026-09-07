import type { FunctionNode, LintNode, RuleFixer, RuleModule } from '#plugin-types';

import { hasBlankLine } from '#layout/chain';
import { enclosingFunction, previousStatement } from '#layout/statements';

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
