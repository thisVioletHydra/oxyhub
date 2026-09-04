import { getLineIndent, isTokenOnSameLine } from '../utils/function-params';

/**
 * Parentheses around a ternary branch are outside the AST node range.
 * Gaps must end at `(` / start after `)`, otherwise fixes eat the `(`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').AST.Token} operatorToken
 * @param {import('estree').Node} branchNode
 */
function getGapAfterOperator(sourceCode, operatorToken, branchNode) {
  const branchStart = sourceCode.getFirstToken(branchNode);
  if (!branchStart) {
    return null;
  }

  const openParen = sourceCode.getTokenBefore(
    branchStart,
    (token) => token.value === '(',
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

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} branchNode
 * @param {import('eslint').AST.Token} operatorToken
 */
function getGapBeforeOperator(sourceCode, branchNode, operatorToken) {
  const branchEnd = sourceCode.getLastToken(branchNode);
  if (!branchEnd) {
    return null;
  }

  const closeParen = sourceCode.getTokenAfter(
    branchEnd,
    (token) => token.value === ')',
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

/** @type {import('eslint').Rule.RuleModule} */
export default {
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

    function normalizeGap(node, rangeStart, rangeEnd, expectedText, messageId) {
      const actualText = sourceCode.text.slice(rangeStart, rangeEnd);
      if (actualText === expectedText) {
        return;
      }

      if (/[^\s]/.test(actualText)) {
        return;
      }

      context.report({
        node,
        messageId,
        fix(fixer) {
          return fixer.replaceTextRange([rangeStart, rangeEnd], expectedText);
        },
      });
    }

    function checkTernary(node) {
      const questionToken = sourceCode.getTokenAfter(
        node.test,
        (token) => token.value === '?',
      );
      const colonToken = sourceCode.getTokenAfter(
        node.consequent,
        (token) => token.value === ':',
      );
      if (!questionToken || !colonToken) {
        return;
      }

      const testEnd = sourceCode.getLastToken(node.test);
      if (!testEnd) {
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
      const baseIndent = getLineIndent(sourceCode, node.test.loc.start.line);
      const branchIndent = `${baseIndent}  `;

      if (!multilineIntent) {
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
