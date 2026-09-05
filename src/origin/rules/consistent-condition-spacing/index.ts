import type { Expression, LintNode, RuleFixer, RuleModule, SourceCode } from '#plugin-types';

import {
  isClosingParenToken,
  isOpeningParenToken,
  isTokenOnSameLine,
} from '#utils/function-params';

function getTestParens(
  sourceCode: SourceCode,
  testNode: Expression
) {
  const testFirst = sourceCode.getFirstToken(
    testNode
  );
  const testLast = sourceCode.getLastToken(
    testNode
  );
  if (!testFirst || !testLast) {
    return null;
  }

  const leftParen = sourceCode.getTokenBefore(
    testFirst,
    isOpeningParenToken
  );
  const rightParen = sourceCode.getTokenAfter(
    testLast,
    isClosingParenToken
  );
  const keywordToken = leftParen
    ? sourceCode.getTokenBefore(
      leftParen
    )
    : null;

  if (!keywordToken || !leftParen || !rightParen) {
    return null;
  }

  return {
    keywordToken,
    leftParen,
    rightParen
  };
}

const rule: RuleModule = {
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

    function checkCondition(
      node: LintNode,
      testNode: Expression | null | undefined
    ) {
      if (testNode === null || testNode === undefined) {
        return;
      }

      const parens = getTestParens(
        sourceCode,
        testNode
      );
      if (parens === null || parens === undefined) {
        return;
      }

      const {
        keywordToken,
        leftParen,
        rightParen
      } = parens;
      if (!isTokenOnSameLine(
        sourceCode,
        leftParen,
        rightParen
      )) {
        return;
      }

      const inner = sourceCode.text.slice(
        leftParen.range[1],
        rightParen.range[0]
      );
      if (/\n/.test(
        inner
      )) {
        return;
      }

      const collapsed = inner.replace(
        /\s+/g,
        ' '
      ).trim();
      const expected = `${keywordToken.value} (${collapsed})`;
      const actual = sourceCode.text.slice(
        keywordToken.range[0],
        rightParen.range[1]
      );
      if (actual === expected) {
        return;
      }

      context.report(
        {
          node,
          messageId: 'normalizeConditionSpacing',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                keywordToken.range[0],
                rightParen.range[1]
              ],
              expected,
          );
          },
        }
      );
    }

    return {
      IfStatement(node) {
        checkCondition(
          node,
          node.test
        );
      },
      WhileStatement(node) {
        checkCondition(
          node,
          node.test
        );
      },
      SwitchStatement(node) {
        checkCondition(
          node,
          node.discriminant
        );
      },
    };
  },
};

export default rule;
