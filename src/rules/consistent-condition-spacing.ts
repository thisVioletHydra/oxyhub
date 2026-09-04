import {
  isClosingParenToken,
  isOpeningParenToken,
  isTokenOnSameLine,
} from '../utils/function-params';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Expression} testNode
 */
function getTestParens(sourceCode, testNode) {
  const testFirst = sourceCode.getFirstToken(testNode);
  const testLast = sourceCode.getLastToken(testNode);
  if (!testFirst || !testLast) {
    return null;
  }

  const leftParen = sourceCode.getTokenBefore(testFirst, isOpeningParenToken);
  const rightParen = sourceCode.getTokenAfter(testLast, isClosingParenToken);
  const keywordToken = leftParen
    ? sourceCode.getTokenBefore(leftParen)
    : null;

  if (!keywordToken || !leftParen || !rightParen) {
    return null;
  }

  return { keywordToken, leftParen, rightParen };
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Collapse messy whitespace in single-line if/while/switch conditions.',
    },
    fixable: 'whitespace',
    messages: {
      normalizeConditionSpacing: 'Normalize spacing inside this condition.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkCondition(node, testNode) {
      if (!testNode) {
        return;
      }

      const parens = getTestParens(sourceCode, testNode);
      if (!parens) {
        return;
      }

      const { keywordToken, leftParen, rightParen } = parens;
      if (!isTokenOnSameLine(sourceCode, leftParen, rightParen)) {
        return;
      }

      const inner = sourceCode.text.slice(leftParen.range[1], rightParen.range[0]);
      if (/\n/.test(inner)) {
        return;
      }

      const collapsed = inner.replace(/\s+/g, ' ').trim();
      const expected = `${keywordToken.value} (${collapsed})`;
      const actual = sourceCode.text.slice(keywordToken.range[0], rightParen.range[1]);
      if (actual === expected) {
        return;
      }

      context.report({
        node,
        messageId: 'normalizeConditionSpacing',
        fix(fixer) {
          return fixer.replaceTextRange(
            [keywordToken.range[0], rightParen.range[1]],
            expected,
          );
        },
      });
    }

    return {
      IfStatement(node) {
        checkCondition(node, node.test);
      },
      WhileStatement(node) {
        checkCondition(node, node.test);
      },
      SwitchStatement(node) {
        checkCondition(node, node.discriminant);
      },
    };
  },
};
