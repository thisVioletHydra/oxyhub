import type { FunctionNode, LintNode, SourceCode, Token } from '#plugin-types';

export function isOpeningParenToken(token: Token) {
  return token.type === 'Punctuator' && token.value === '(';
}

export function isClosingParenToken(token: Token) {
  return token.type === 'Punctuator' && token.value === ')';
}

export function isTokenOnSameLine(
  sourceCode: SourceCode,
  left: Token,
  right: Token
) {
  return left.loc.start.line === right.loc.start.line;
}

export function getLineIndent(
  sourceCode: SourceCode,
  lineNumber: number
) {
  const line = sourceCode.lines[lineNumber - 1] ?? '';
  const match = line.match(
    /^[\t ]*/
  );
  return match?.[0] ?? '';
}

/**
 * Parameter-list `(` / `)` only.
 * Unparenthesized arrows (`rule => …`) have no list — do not steal `(` from
 * `.map(` or from a call in the arrow body.
 */
export function getFunctionParameterParens(
  sourceCode: SourceCode,
  node: FunctionNode
) {
  let leftParen: Token | null;

  if (node.type === 'ArrowFunctionExpression') {
    let head = sourceCode.getFirstToken(
      node
    );
    if (head?.value === 'async') {
      head = sourceCode.getTokenAfter(
        head
      );
    }
    if (!head || !isOpeningParenToken(
      head
    )) {
      return null;
    }
    leftParen = head;
  }
  else {
    leftParen = sourceCode.getFirstToken(
      node,
      isOpeningParenToken
    );
  }

  if (leftParen === null || leftParen === undefined) {
    return null;
  }

  let depth = 0;
  let rightParen: Token | null = null;

  for (
    let token: Token | null = leftParen;
    token !== null && token !== undefined;
    token = sourceCode.getTokenAfter(
      token
    )
  ) {
    if (isOpeningParenToken(
      token
    )) {
      depth += 1;
      continue;
    }

    if (!isClosingParenToken(
      token
    )) {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      rightParen = token;
      break;
    }
  }

  if (rightParen === null || rightParen === undefined) {
    return null;
  }

  return {
    leftParen,
    rightParen
  };
}

export function isParameterNode(node: LintNode) {
  const type: string = node.type;
  return (
    type === 'Identifier'
    || type === 'AssignmentPattern'
    || type === 'RestElement'
    || type === 'TSParameterProperty'
    || type === 'ArrayPattern'
    || type === 'ObjectPattern'
  );
}

/**
 * Decorators sit before the parameter identifier in source but are omitted by
 * `getFirstToken(parameter)`.
 */
export function getParameterStartToken(
  sourceCode: SourceCode,
  parameter: LintNode
): Token | null {
  const decorators = parameter.decorators;
  if (Array.isArray(
    decorators
  ) && decorators.length > 0) {
    const decoratorToken = sourceCode.getFirstToken(
      decorators[0]
    );
    if (decoratorToken) {
      return decoratorToken;
    }
  }

  const type: string = parameter.type;
  if (type === 'TSParameterProperty') {
    return (
      getParameterStartToken(
        sourceCode,
        parameter.parameter as LintNode
      )
      ?? sourceCode.getFirstToken(
        parameter
      )
    );
  }

  return sourceCode.getFirstToken(
    parameter
  );
}

/**
 * Last token of a parameter/argument, including a trailing TS type annotation.
 * `getLastToken(identifier)` stops at the name — the `:` type is a sibling.
 */
export function getCoveredEndToken(
  sourceCode: SourceCode,
  node: LintNode
): Token | null {
  let end = sourceCode.getLastToken(
    node
  );
  const typeAnnotation = node.typeAnnotation;
  if (typeAnnotation) {
    const typeEnd = sourceCode.getLastToken(
      typeAnnotation
    );
    if (typeEnd && (end === null || typeEnd.range[1] > end.range[1])) {
      end = typeEnd;
    }
  }
  return end;
}

