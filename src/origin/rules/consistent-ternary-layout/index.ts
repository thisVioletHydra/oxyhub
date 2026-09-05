import type { ConditionalExpression, LintNode, RuleFixer, RuleModule, SourceCode, Token } from '#plugin-types';

import { getLineIndent, isTokenOnSameLine } from '#utils/function-params';

/**
 * Parentheses around a ternary branch are outside the AST node range.
 * Gaps must end at `(` / start after `)`, otherwise fixes eat the `(`.
 */
function getGapAfterOperator(
  sourceCode: SourceCode,
  operatorToken: Token,
  branchNode: LintNode
) {
  const branchStart = sourceCode.getFirstToken(
    branchNode
  );
  if (branchStart === null || branchStart === undefined) {
    return null;
  }

  const openParen = sourceCode.getTokenBefore(
    branchStart,
    (token: Token) => token.value === '(',
  );
  if (
    openParen
    && openParen.range[0] >= operatorToken.range[1]
    && openParen.range[1] <= branchStart.range[0]
  ) {
    return {
      start: operatorToken.range[1],
      end: openParen.range[0],
    };
  }

  return {
    start: operatorToken.range[1],
    end: branchStart.range[0],
  };
}

function getGapBeforeOperator(
  sourceCode: SourceCode,
  branchNode: LintNode,
  operatorToken: Token
) {
  const branchEnd = sourceCode.getLastToken(
    branchNode
  );
  if (branchEnd === null || branchEnd === undefined) {
    return null;
  }

  const closeParen = sourceCode.getTokenAfter(
    branchEnd,
    (token: Token) => token.value === ')',
  );
  if (
    closeParen
    && closeParen.range[0] >= branchEnd.range[1]
    && closeParen.range[1] <= operatorToken.range[0]
  ) {
    return {
      start: closeParen.range[1],
      end: operatorToken.range[0],
    };
  }

  return {
    start: branchEnd.range[1],
    end: operatorToken.range[0],
  };
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep ternaries inline, or multiline when `?` starts on its own line.',
    },
    fixable: 'whitespace',
    messages: {
      collapseTernary: 'Ternary should stay on one line.',
      expandTernary: 'Multiline ternary must place `?` and `:` on their own lines.',
      normalizeTernarySpacing: 'Normalize spacing inside this ternary.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function normalizeGap(
      node: LintNode,
      rangeStart: number,
      rangeEnd: number,
      expectedText: string,
      messageId: string
    ) {
      const actualText = sourceCode.text.slice(
        rangeStart,
        rangeEnd
      );
      if (actualText === expectedText) {
        return;
      }

      if (/[^\s]/.test(
        actualText
      )) {
        return;
      }

      context.report(
        {
          node,
          messageId,
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                rangeStart,
                rangeEnd
              ],
              expectedText
            );
          },
        }
      );
    }

    function checkTernary(node: ConditionalExpression) {
      const questionToken = sourceCode.getTokenAfter(
        node.test,
        (token: Token) => token.value === '?',
      );
      const colonToken = sourceCode.getTokenAfter(
        node.consequent,
        (token: Token) => token.value === ':',
      );
      if (!questionToken || !colonToken) {
        return;
      }

      const testEnd = sourceCode.getLastToken(
        node.test
      );
      if (testEnd === null || testEnd === undefined) {
        return;
      }

      const afterQuestion = getGapAfterOperator(
        sourceCode,
        questionToken,
        node.consequent,
      );
      const beforeColon = getGapBeforeOperator(
        sourceCode,
        node.consequent,
        colonToken,
      );
      const afterColon = getGapAfterOperator(
        sourceCode,
        colonToken,
        node.alternate,
      );
      if (!afterQuestion || !beforeColon || !afterColon) {
        return;
      }

      const multilineIntent = !isTokenOnSameLine(
        sourceCode,
        testEnd,
        questionToken,
      );
      const baseIndent = getLineIndent(
        sourceCode,
        node.test.loc!.start.line
      );
      const branchIndent = `${baseIndent}  `;

      if (multilineIntent === false) {
        normalizeGap(
          node,
          testEnd.range[1],
          questionToken.range[0],
          ' ',
          'collapseTernary',
        );
        normalizeGap(
          node,
          afterQuestion.start,
          afterQuestion.end,
          ' ',
          'collapseTernary',
        );
        normalizeGap(
          node,
          beforeColon.start,
          beforeColon.end,
          ' ',
          'collapseTernary',
        );
        normalizeGap(
          node,
          afterColon.start,
          afterColon.end,
          ' ',
          'collapseTernary',
        );
        return;
      }

      normalizeGap(
        node,
        testEnd.range[1],
        questionToken.range[0],
        `\n${branchIndent}`,
        'expandTernary',
      );
      normalizeGap(
        node,
        afterQuestion.start,
        afterQuestion.end,
        ' ',
        'normalizeTernarySpacing',
      );
      normalizeGap(
        node,
        beforeColon.start,
        beforeColon.end,
        `\n${branchIndent}`,
        'expandTernary',
      );
      normalizeGap(
        node,
        afterColon.start,
        afterColon.end,
        ' ',
        'normalizeTernarySpacing',
      );
    }

    return {
      ConditionalExpression: checkTernary,
    };
  },
};

export default rule;
