import type { ArrowFunctionExpression, RuleFixer, RuleModule } from '#plugin-types';

import { getArrowToken, hasBlankLine } from '#layout/chain';

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Disallow blank lines between an arrow and its expression body.',
    },
    fixable: 'whitespace',
    messages: {
      unexpectedBlankLine: 'Unexpected blank line in this arrow expression body.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function normalizeArrowBody(node: ArrowFunctionExpression) {
      if (node.body.type === 'BlockStatement') {
        return;
      }

      const arrowToken = getArrowToken(
        sourceCode,
        node
      );
      const bodyStart = sourceCode.getFirstToken(
        node.body
      );
      if (!arrowToken || !bodyStart) {
        return;
      }

      const gapText = sourceCode.text.slice(
        arrowToken.range[1],
        bodyStart.range[0],
      );
      if (!hasBlankLine(
        gapText
      )) {
        return;
      }

      const expectedGap = ' ';

      context.report(
        {
          node: node.body,
          messageId: 'unexpectedBlankLine',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                arrowToken.range[1],
                bodyStart.range[0]
              ],
              expectedGap,
          );
          },
        }
      );
    }

    return {
      ArrowFunctionExpression: normalizeArrowBody,
    };
  },
};

export default rule;
