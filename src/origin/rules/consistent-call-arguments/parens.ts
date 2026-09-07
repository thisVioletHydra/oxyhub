import type { CallExpression, LintNode, SourceCode, Token } from '#plugin-types';

import {
  isOpeningParenToken,
  isClosingParenToken,
  isTokenOnSameLine,
} from '#layout/tokens';

export type CallNode = CallExpression & {
  typeArguments?: LintNode;
};

export function getCallParens(
  sourceCode: SourceCode,
  node: CallNode
) {
  const calleeEnd = sourceCode.getLastToken(
    node.callee
  );
  if (calleeEnd === null || calleeEnd === undefined) {
    return null;
  }

  let leftParen = sourceCode.getTokenAfter(
    calleeEnd,
    isOpeningParenToken
  );
  if (!leftParen && node.typeArguments) {
    const typeEnd = sourceCode.getLastToken(
      node.typeArguments
    );
    leftParen = typeEnd
      ? sourceCode.getTokenAfter(
        typeEnd,
        isOpeningParenToken
      )
      : null;
  }

  if (leftParen === null || leftParen === undefined) {
    let token = sourceCode.getTokenAfter(
      calleeEnd
    );
    while (token && token.value !== '(' && token.range[0] < node.range![1]) {
      token = sourceCode.getTokenAfter(
        token
      );
    }
    leftParen = token?.value === '('
      ? token
      : null;
  }

  const rightParen = sourceCode.getLastToken(
    node,
    isClosingParenToken
  );
  if (!leftParen || !rightParen) {
    return null;
  }

  return {
    leftParen,
    rightParen
  };
}

export function isSingleLineExpression(node: LintNode) {
  if (node.loc!.start.line !== node.loc!.end.line) {
    return false;
  }

  if (node.type === 'ArrowFunctionExpression' && node.body.type === 'BlockStatement') {
    return false;
  }

  if (node.type === 'ObjectExpression' || node.type === 'ArrayExpression') {
    return node.loc!.start.line === node.loc!.end.line;
  }

  return true;
}

/**
 * Multiline call layout starts only when the first argument begins on its own line
 * after `(`, or when later args / `)` follow column layout — not when a single
 * argument merely contains a multiline arrow body.
 */
export function hasMultilineIntent(
  sourceCode: SourceCode,
  node: CallNode,
  leftParen: Token
) {
  const firstArg = node.arguments[0];
  const firstArgToken = sourceCode.getFirstToken(
    firstArg
  );
  if (firstArgToken === null || firstArgToken === undefined) {
    return false;
  }

  // Only the first argument starting on its own line after `(` counts as
  // column intent. A single multiline callback (`.map((item) => …)`) with
  // `)` on the next line is normal — do not expand that into a column call.
  if (!isTokenOnSameLine(
    sourceCode,
    leftParen,
    firstArgToken
  )) {
    return true;
  }

  for (let index = 1; index < node.arguments.length; index += 1) {
    const previous = node.arguments[index - 1];
    const commaToken = sourceCode.getTokenAfter(
      previous,
      (token: Token) => token.value === ',',
    );
    const argumentToken = sourceCode.getFirstToken(
      node.arguments[index]
    );
    if (
      commaToken
      && argumentToken
      && !isTokenOnSameLine(
        sourceCode,
        commaToken,
        argumentToken
      )
    ) {
      return true;
    }
  }

  return false;
}
