/**
 * @param {import('estree').Node | null | undefined} node
 */
function isVoidWrapped(node) {
  return (
    node?.type === 'UnaryExpression'
    && node.operator === 'void'
  );
}

/**
 * @param {import('estree').Node | null | undefined} node
 */
function isReturned(node) {
  let current = node?.parent;
  while (current) {
    if (current.type === 'ReturnStatement') {
      return true;
    }
    if (
      current.type === 'FunctionDeclaration'
      || current.type === 'FunctionExpression'
      || current.type === 'ArrowFunctionExpression'
    ) {
      return false;
    }
    current = current.parent;
  }

  return false;
}

/**
 * @param {import('estree').Node | null | undefined} node
 */
function isAwaited(node) {
  let current = node?.parent;
  while (current) {
    if (current.type === 'AwaitExpression') {
      return true;
    }
    if (
      current.type === 'FunctionDeclaration'
      || current.type === 'FunctionExpression'
      || current.type === 'ArrowFunctionExpression'
    ) {
      return false;
    }
    current = current.parent;
  }

  return false;
}

/**
 * @param {import('estree').CallExpression} thenCall
 */
function thenHasRejectionHandler(thenCall) {
  return thenCall.arguments.length >= 2;
}

/**
 * @param {import('estree').CallExpression} thenCall
 */
function chainHasCatchAfter(thenCall) {
  let current = thenCall.parent;
  while (current) {
    if (
      current.type === 'MemberExpression'
      && !current.computed
      && current.property.type === 'Identifier'
      && current.property.name === 'catch'
      && current.parent?.type === 'CallExpression'
    ) {
      return true;
    }

    if (
      current.type === 'ExpressionStatement'
      || current.type === 'VariableDeclarator'
      || current.type === 'AssignmentExpression'
      || current.type === 'ReturnStatement'
    ) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

/** @param {import('estree').Node | null | undefined} node */
function walkExpression(node, visitThenCall) {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  if (node.type === 'CallExpression') {
    const { callee } = node;
    if (
      callee.type === 'MemberExpression'
      && !callee.computed
      && callee.property.type === 'Identifier'
      && callee.property.name === 'then'
    ) {
      visitThenCall(node);
    }
  }

  for (const child of getChildNodes(node)) {
    walkExpression(child, visitThenCall);
  }
}

/** @param {import('estree').Node} node */
function getChildNodes(node) {
  /** @type {import('estree').Node[]} */
  const children = [];

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') {
          children.push(item);
        }
      }
      continue;
    }

    if (value && typeof value.type === 'string') {
      children.push(value);
    }
  }

  return children;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit handling for floating promise chains (.catch, void, await, return).',
    },
    messages: {
      unhandledThen:
        'Unhandled promise chain: add `.catch(...)`, pass `onRejected` as the second `.then(...)` argument, or prefix the statement with `void`.',
    },
    schema: [],
  },
  create(context) {
    function checkExpressionRoot(node) {
      if (isVoidWrapped(node.parent) || isAwaited(node) || isReturned(node)) {
        return;
      }

      let hasUnhandledThen = false;
      walkExpression(node, (thenCall) => {
        if (thenHasRejectionHandler(thenCall) || chainHasCatchAfter(thenCall)) {
          return;
        }
        hasUnhandledThen = true;
      });

      if (hasUnhandledThen) {
        context.report({
          node,
          messageId: 'unhandledThen',
        });
      }
    }

    return {
      ExpressionStatement(node) {
        checkExpressionRoot(node.expression);
      },
    };
  },
};
