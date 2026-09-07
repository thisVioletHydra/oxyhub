import type { IfStatement, LintNode, RuleFixer, RuleModule } from '#plugin-types';

import { missingSentinel, renderAbsenceCheck, splitNullishOr } from './absence.ts';
import { getBangExpression, isDefinitelyBooleanExpression, unwrap } from './boolean.ts';

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Allow `!` only on real booleans; ban truthiness coercion in `if` tests.',
    },
    fixable: 'code',
    messages: {
      noBangCondition:
        'Do not use `!` for truthiness. Use an explicit nullish check instead of deleting control flow.',
      nullNotUndefined:
        'This getter returns null, not undefined.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkIfStatement(node: IfStatement) {
      const bang = getBangExpression(
        unwrap(node.test as LintNode)
      );
      if (bang === null) {
        const expression = splitNullishOr(node.test as LintNode, sourceCode);
        if (expression !== null && missingSentinel(expression) === 'null') {
          const left = sourceCode.getText(expression);
          context.report({
            node: node.test,
            messageId: 'nullNotUndefined',
            fix(fixer: RuleFixer) {
              return fixer.replaceText(node.test, `${left} === null`);
            },
          });
        }

        return;
      }

      if (isDefinitelyBooleanExpression(
        bang.argument as LintNode
      )) {
        return;
      }

      context.report(
        {
          node: bang,
          messageId: 'noBangCondition',
          fix(fixer: RuleFixer) {
            return fixer.replaceText(
              bang,
              renderAbsenceCheck(
                bang.argument,
                sourceCode
              ),
          );
          },
        }
      );
    }

    return {
      IfStatement: checkIfStatement,
    };
  },
};

export default rule;
