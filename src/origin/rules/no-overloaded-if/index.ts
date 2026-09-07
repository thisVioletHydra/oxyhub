import type { LintNode, RuleModule } from '#plugin-types';

const MAX_CHECKS = 3;

function isLintNode(value: unknown): value is LintNode {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  return typeof value.type === 'string';
}

function unwrap(node: LintNode): LintNode {
  if (
    node.type !== 'ParenthesizedExpression'
    && node.type !== 'ChainExpression'
    && node.type !== 'TSAsExpression'
    && node.type !== 'TSSatisfiesExpression'
    && node.type !== 'TSNonNullExpression'
    && node.type !== 'TSTypeAssertion'
  ) {
    return node;
  }

  const inner = node.expression;
  if (!isLintNode(inner)) {
    return node;
  }

  return unwrap(inner);
}

function isBooleanLogic(
  node: LintNode,
): node is LintNode & {
  type: 'LogicalExpression';
  operator: '&&' | '||';
  left: LintNode;
  right: LintNode;
} {
  return (
    node.type === 'LogicalExpression'
    && (node.operator === '&&' || node.operator === '||')
  );
}

function isNegation(
  node: LintNode,
): node is LintNode & { type: 'UnaryExpression'; operator: '!'; argument: LintNode } {
  return node.type === 'UnaryExpression' && node.operator === '!';
}

function countChecks(node: LintNode): number {
  const value = unwrap(node);
  if (isBooleanLogic(value)) {
    return countChecks(value.left) + countChecks(value.right);
  }

  if (isNegation(value) && isLintNode(value.argument)) {
    return countChecks(value.argument);
  }

  return 1;
}

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit an if condition to 3 boolean checks; extract a named predicate after that.',
    },
    messages: {
      tooManyChecks:
        'This if has {{count}} checks. Keep at most 3, or extract a named predicate.',
    },
    schema: [],
  },
  create(context) {
    return {
      IfStatement(node: LintNode) {
        if (node.type !== 'IfStatement' || !isLintNode(node.test)) {
          return;
        }

        const count = countChecks(node.test);
        if (count <= MAX_CHECKS) {
          return;
        }

        context.report({
          node: node.test,
          messageId: 'tooManyChecks',
          data: {
            count: String(count),
          },
        });
      },
    };
  },
};

export default rule;
