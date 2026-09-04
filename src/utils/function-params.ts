/** @param {import('eslint').AST.Token} token */
export function isOpeningParenToken(token) {
  return token.type === 'Punctuator' && token.value === '(';
}

/** @param {import('eslint').AST.Token} token */
export function isClosingParenToken(token) {
  return token.type === 'Punctuator' && token.value === ')';
}

/** @param {import('eslint').SourceCode} sourceCode */
export function isTokenOnSameLine(sourceCode, left, right) {
  return left.loc.start.line === right.loc.start.line;
}

/** @param {import('eslint').SourceCode} sourceCode */
export function getLineIndent(sourceCode, lineNumber) {
  const line = sourceCode.lines[lineNumber - 1] ?? '';
  const match = line.match(/^[\t ]*/);
  return match?.[0] ?? '';
}

/**
 * Parameter-list `(` / `)` only — not the `)` inside a return type like `: () => void`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').FunctionDeclaration | import('estree').FunctionExpression | import('estree').ArrowFunctionExpression} node
 */
export function getFunctionParameterParens(sourceCode, node) {
  const leftParen = sourceCode.getFirstToken(node, isOpeningParenToken);
  if (!leftParen) {
    return null;
  }

  let depth = 0;
  let rightParen = null;

  for (
    let token = leftParen;
    token !== null && token !== undefined;
    token = sourceCode.getTokenAfter(token)
  ) {
    if (isOpeningParenToken(token)) {
      depth += 1;
      continue;
    }

    if (!isClosingParenToken(token)) {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      rightParen = token;
      break;
    }
  }

  if (!rightParen) {
    return null;
  }

  return { leftParen, rightParen };
}

/** @param {import('estree').Node} node */
export function isParameterNode(node) {
  return (
    node.type === 'Identifier'
    || node.type === 'AssignmentPattern'
    || node.type === 'RestElement'
    || node.type === 'TSParameterProperty'
    || node.type === 'ArrayPattern'
    || node.type === 'ObjectPattern'
  );
}

/**
 * Decorators sit before the parameter identifier in source but are omitted by
 * `getFirstToken(parameter)`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} parameter
 */
export function getParameterStartToken(sourceCode, parameter) {
  const decorators = parameter.decorators;
  if (Array.isArray(decorators) && decorators.length > 0) {
    const decoratorToken = sourceCode.getFirstToken(decorators[0]);
    if (decoratorToken) {
      return decoratorToken;
    }
  }

  if (parameter.type === 'TSParameterProperty') {
    return (
      getParameterStartToken(sourceCode, parameter.parameter)
      ?? sourceCode.getFirstToken(parameter)
    );
  }

  return sourceCode.getFirstToken(parameter);
}
