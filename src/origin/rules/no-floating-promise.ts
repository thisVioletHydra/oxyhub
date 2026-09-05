import type { LintNode, RuleModule } from '#plugin-types';

function isVoidWrapped(node: LintNode | null | undefined) {
  return (
    node?.type === 'UnaryExpression'
    && node.operator === 'void'
  );
}

function isReturned(node: LintNode | null | undefined) {
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

function isAwaited(node: LintNode | null | undefined) {
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

function thenHasRejectionHandler(thenCall: import('estree').CallExpression) {
  return thenCall.arguments.length >= 2;
}

function chainHasCatchAfter(thenCall: import('estree').CallExpression & { parent?: LintNode | null }) {
  let current: LintNode | null | undefined = thenCall.parent;
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

function walkExpression(
  node: LintNode | null | undefined,
  visitThenCall: (thenCall: import('estree').CallExpression & { parent?: LintNode | null }) => void
) {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  if (node.type === 'CallExpression') {
    const {
      callee
    } = node;
    if (
      callee.type === 'MemberExpression'
      && !callee.computed
      && callee.property.type === 'Identifier'
      && callee.property.name === 'then'
    ) {
      visitThenCall(
        node
      );
    }
  }

  for (const child of getChildNodes(
    node
  )) {
    walkExpression(
      child,
      visitThenCall
    );
  }
}

function getChildNodes(node: LintNode): LintNode[] {
  const children: LintNode[] = [];

  for (const [
    key,
    raw
  ] of Object.entries(
    node
  )) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue;
    }

    const value: unknown = raw;

    if (Array.isArray(
      value
    )) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'type' in item && typeof item.type === 'string') {
          children.push(
            item as LintNode
          );
        }
      }
      continue;
    }

    if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') {
      children.push(
        value as LintNode
      );
    }
  }

  return children;
}

const rule: RuleModule = {
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
    function checkExpressionRoot(node: LintNode) {
      if (isVoidWrapped(
        node.parent
      ) || isAwaited(
        node
      ) || isReturned(
        node
      )) {
        return;
      }

      let hasUnhandledThen = false;
      walkExpression(
        node,
        (thenCall) => {
          if (thenHasRejectionHandler(
            thenCall
          ) || chainHasCatchAfter(
            thenCall
          )) {
            return;
          }
          hasUnhandledThen = true;
        }
      );

      if (hasUnhandledThen) {
        context.report(
          {
            node,
            messageId: 'unhandledThen',
          }
        );
      }
    }

    return {
      ExpressionStatement(node) {
        checkExpressionRoot(
          node.expression
        );
      },
    };
  },
};

export default rule;
