import type { FunctionNode, LintNode, RuleContext, RuleFixer, Token } from '#plugin-types';

import { expectedOpenerIndent } from '#layout/indent';
import {
  getCoveredEndToken,
  getParameterStartToken,
} from '#layout/tokens';

export function createParameterFixes(context: RuleContext) {
  const sourceCode = context.sourceCode;

  function reportCollapse(
    node: FunctionNode,
    leftParen: Token,
    rightParen: Token,
    messageId: string
  ) {
    const inner = sourceCode.text.slice(
      leftParen.range[1],
      rightParen.range[0]
    );
    const collapsed = `(${inner.replace(
      /\s+/g,
      ' '
    ).trim()})`;

    context.report(
      {
        node,
        messageId,
        fix(fixer: RuleFixer) {
          return fixer.replaceTextRange(
            [
              leftParen.range[0],
              rightParen.range[1]
            ],
            collapsed
          );
        },
      }
    );
  }

  function normalizeGap(
    node: LintNode,
    rangeStart: number,
    rangeEnd: number,
    expectedText: string
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
        messageId: 'normalizeParameterSpacing',
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

  function normalizeMultilineParameters(
    node: FunctionNode,
    leftParen: Token,
    rightParen: Token
  ) {
    const baseIndent = expectedOpenerIndent(
      sourceCode,
      node,
      leftParen
    );
    const parameterIndent = `${baseIndent}  `;

    for (let index = 0; index < node.params.length; index += 1) {
      const parameter = node.params[index];
      const parameterToken = getParameterStartToken(
        sourceCode,
        parameter
      );
      if (parameterToken === null || parameterToken === undefined) {
        continue;
      }

      if (index === 0) {
        normalizeGap(
          parameter,
          leftParen.range[1],
          parameterToken.range[0],
          `\n${parameterIndent}`
        );
        continue;
      }

      const previousEnd = getCoveredEndToken(
        sourceCode,
        node.params[index - 1]
      );
      const commaToken = previousEnd
        ? sourceCode.getTokenAfter(
          previousEnd,
          (token: Token) => token.value === ',',
        )
        : null;
      if (commaToken === null || commaToken === undefined) {
        continue;
      }

      normalizeGap(
        parameter,
        commaToken.range[1],
        parameterToken.range[0],
        `\n${parameterIndent}`
      );
    }

    const lastParameter = node.params.at(
      -1
    );
    if (lastParameter === null || lastParameter === undefined) {
      return;
    }

    const lastToken = getCoveredEndToken(
      sourceCode,
      lastParameter
    );
    if (lastToken === null || lastToken === undefined) {
      return;
    }

    normalizeGap(
      lastParameter,
      lastToken.range[1],
      rightParen.range[0],
      `\n${baseIndent}`
    );
  }

  function normalizeInlineParameterSpacing(
    node: FunctionNode,
    leftParen: Token,
    rightParen: Token,
    parameter: LintNode
  ) {
    const parameterStart = getParameterStartToken(
      sourceCode,
      parameter
    );
    const parameterEnd = sourceCode.getLastToken(
      parameter
    );
    if (!parameterStart || !parameterEnd) {
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

    const parameterText = sourceCode.text
      .slice(
        parameterStart.range[0],
        parameterEnd.range[1]
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
    const expected = `(${parameterText})`;
    const actual = sourceCode.text.slice(
      leftParen.range[0],
      rightParen.range[1]
    );
    if (actual === expected) {
      return;
    }

    context.report(
      {
        node,
        messageId: 'normalizeParameterSpacing',
        fix(fixer: RuleFixer) {
          return fixer.replaceTextRange(
            [
              leftParen.range[0],
              rightParen.range[1]
            ],
            expected,
          );
          },
        }
      );
  }

  return {
    reportCollapse,
    normalizeMultilineParameters,
    normalizeInlineParameterSpacing,
  };
}
