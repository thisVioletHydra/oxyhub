import type { LintNode, RuleContext, RuleFixer, Token } from '#plugin-types';

import { expectedCallBaseIndent } from '#layout/indent';

import {
  type CallNode,
  getCallParens,
  hasMultilineIntent,
  isSingleLineExpression,
} from './parens.ts';

export function createCallArguments(context: RuleContext) {
  const sourceCode = context.sourceCode;

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
        messageId: 'normalizeArgumentSpacing',
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

  function collapseInlineCall(
    node: CallNode,
    leftParen: Token,
    rightParen: Token
  ) {
    if (!node.arguments.every(
      (argument) => isSingleLineExpression(
        argument
      )
    )) {
      return;
    }

    const innerStart = leftParen.range[1];
    const innerEnd = rightParen.range[0];
    const inner = sourceCode.text.slice(
      innerStart,
      innerEnd
    );
    if (!/\n/.test(
      inner
    )) {
      return;
    }

    const collapsed = inner.replace(
      /\s+/g,
      ' '
    ).trim();
    const actual = sourceCode.text.slice(
      innerStart,
      innerEnd
    );
    if (actual === collapsed) {
      return;
    }

    context.report(
      {
        node,
        messageId: 'collapseArguments',
        fix(fixer: RuleFixer) {
          return fixer.replaceTextRange(
            [
              leftParen.range[0],
              rightParen.range[1]
            ],
            `(${collapsed})`,
          );
          },
        }
      );
  }

  function checkCall(node: CallNode) {
    if (node.arguments.length === 0) {
      return;
    }

    const parens = getCallParens(
      sourceCode,
      node
    );
    if (parens === null || parens === undefined) {
      return;
    }

    const {
      leftParen,
      rightParen
    } = parens;
    const multilineIntent = hasMultilineIntent(
      sourceCode,
      node,
      leftParen
    );

    if (multilineIntent === false) {
      collapseInlineCall(
        node,
        leftParen,
        rightParen
      );
      return;
    }

    const baseIndent = expectedCallBaseIndent(
      sourceCode,
      node,
      leftParen
    );
    const argIndent = `${baseIndent}  `;

    for (let index = 0; index < node.arguments.length; index += 1) {
      const argument = node.arguments[index];
      const argumentToken = sourceCode.getFirstToken(
        argument
      );
      if (argumentToken === null || argumentToken === undefined) {
        continue;
      }

      if (index === 0) {
        normalizeGap(
          argument,
          leftParen.range[1],
          argumentToken.range[0],
          `\n${argIndent}`
        );
        continue;
      }

      const previousEnd = sourceCode.getLastToken(
        node.arguments[index - 1]
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
        argument,
        commaToken.range[1],
        argumentToken.range[0],
        `\n${argIndent}`
      );
    }

    const lastArgument = node.arguments.at(
      -1
    );
    if (lastArgument === null || lastArgument === undefined) {
      return;
    }

    const lastToken = sourceCode.getLastToken(
      lastArgument
    );
    if (lastToken === null || lastToken === undefined) {
      return;
    }

    normalizeGap(
      lastArgument,
      lastToken.range[1],
      rightParen.range[0],
      `\n${baseIndent}`
    );
  }

  return {
    CallExpression: checkCall,
  };
}
