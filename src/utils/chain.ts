/** @type {Set<string>} */
const NON_CHAIN_OBJECT_TYPES = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
]);

/** @param {import('estree').Node} objectNode */
export function isChainObjectNode(objectNode) {
  return !NON_CHAIN_OBJECT_TYPES.has(objectNode.type);
}

/** @param {import('estree').Expression | null | undefined} expression */
export function isChainExpression(expression) {
  if (!expression) {
    return false;
  }

  return (
    expression.type === 'MemberExpression'
    || expression.type === 'CallExpression'
  );
}

/** @param {import('estree').Expression | null | undefined} expression */
export function getChainRootExpression(expression) {
  if (!expression) {
    return null;
  }

  if (expression.type === 'UnaryExpression' && expression.operator === 'void') {
    return getChainRootExpression(expression.argument);
  }

  if (expression.type === 'AwaitExpression') {
    return getChainRootExpression(expression.argument);
  }

  if (expression.type === 'ArrowFunctionExpression' && expression.body.type !== 'BlockStatement') {
    return expression.body;
  }

  return isChainExpression(expression) ? expression : null;
}

/**
 * @param {import('estree').Node} node
 * @returns {import('estree').Expression[]}
 */
export function collectChainExpressions(node) {
  const expressions = [];

  if (node.type === 'ExpressionStatement') {
    const root = getChainRootExpression(node.expression);
    if (root) {
      expressions.push(root);
    }
    return expressions;
  }

  if (node.type === 'VariableDeclarator') {
    const root = getChainRootExpression(node.init);
    if (root) {
      expressions.push(root);
    }
    return expressions;
  }

  if (node.type === 'ReturnStatement') {
    const root = getChainRootExpression(node.argument);
    if (root) {
      expressions.push(root);
    }
    return expressions;
  }

  if (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') {
    const root = getChainRootExpression(node.body);
    if (root) {
      expressions.push(root);
    }
  }

  return expressions;
}

/**
 * @param {import('estree').Expression} expression
 * @param {(objectNode: import('estree').Node, memberNode: import('estree').MemberExpression) => void} visitLink
 */
export function walkMemberChain(expression, visitLink) {
  if (expression.type === 'MemberExpression') {
    walkMemberChain(expression.object, visitLink);
    if (isChainObjectNode(expression.object)) {
      visitLink(expression.object, expression);
    }
    return;
  }

  if (expression.type === 'CallExpression') {
    walkMemberChain(expression.callee, visitLink);
  }
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} objectNode
 * @param {import('estree').MemberExpression} memberNode
 */
export function getChainLinkRange(sourceCode, objectNode, memberNode) {
  const linkStart = sourceCode.getLastToken(objectNode);
  const dotToken = sourceCode.getTokenBefore(memberNode.property);
  const linkEnd = dotToken ?? sourceCode.getFirstToken(memberNode.property);

  if (!linkStart || !linkEnd) {
    return null;
  }

  return {
    linkStart,
    linkEnd,
    gapStart: objectNode.range[1],
    gapEnd: linkEnd.range[0],
  };
}

/** @param {import('eslint').SourceCode} sourceCode */
export function getArrowToken(sourceCode, node) {
  const bodyStart = sourceCode.getFirstToken(node.body);
  if (!bodyStart) {
    return null;
  }

  return sourceCode.getTokenBefore(bodyStart, (token) => token.value === '=>');
}

/** @param {string} text */
export function hasBlankLine(text) {
  return /\n[\t ]*\n/.test(text);
}

/** @param {string} text */
export function collapseBlankLines(text) {
  return text.replace(/\n[\t ]*\n+/g, '\n');
}
