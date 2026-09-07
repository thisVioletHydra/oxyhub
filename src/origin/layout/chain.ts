import type { ArrowFunctionExpression, LintNode, MemberExpression, SourceCode, Token } from '#plugin-types';

const NON_CHAIN_OBJECT_TYPES = new Set<string>([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
]);

export function isChainObjectNode(objectNode: LintNode) {
  return !NON_CHAIN_OBJECT_TYPES.has(
    objectNode.type
  );
}

export function isChainExpression(expression: LintNode | null | undefined) {
  if (expression === null || expression === undefined) {
    return false;
  }

  return (
    expression.type === 'MemberExpression'
    || expression.type === 'CallExpression'
  );
}

export function getChainRootExpression(expression: LintNode | null | undefined): LintNode | null {
  if (expression === null || expression === undefined) {
    return null;
  }

  if (expression.type === 'UnaryExpression' && expression.operator === 'void') {
    return getChainRootExpression(
      expression.argument as LintNode
    );
  }

  if (expression.type === 'AwaitExpression') {
    return getChainRootExpression(
      expression.argument as LintNode
    );
  }

  if (expression.type === 'ArrowFunctionExpression' && expression.body.type !== 'BlockStatement') {
    return expression.body as LintNode;
  }

  return isChainExpression(
    expression
  )
    ? expression
    : null;
}

export function collectChainExpressions(node: LintNode): LintNode[] {
  const expressions: LintNode[] = [];

  if (node.type === 'ExpressionStatement') {
    const root = getChainRootExpression(
      node.expression
    );
    if (root) {
      expressions.push(
        root
      );
    }

    return expressions;
  }

  if (node.type === 'VariableDeclarator') {
    const root = getChainRootExpression(
      node.init as LintNode | null | undefined
    );
    if (root) {
      expressions.push(
        root
      );
    }

    return expressions;
  }

  if (node.type === 'ReturnStatement') {
    const root = getChainRootExpression(
      node.argument
    );
    if (root) {
      expressions.push(
        root
      );
    }

    return expressions;
  }

  if (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') {
    const root = getChainRootExpression(
      node.body as LintNode
    );
    if (root) {
      expressions.push(
        root
      );
    }
  }

  return expressions;
}

export function walkMemberChain(
  expression: LintNode,
  visitLink: (

    objectNode: LintNode,
                               memberNode: MemberExpression & { parent?: LintNode | null },
  ) => void
) {
  if (expression.type === 'MemberExpression') {
    walkMemberChain(
      expression.object as LintNode,
      visitLink
    );
    if (isChainObjectNode(
      expression.object as LintNode
    )) {
      visitLink(
        expression.object as LintNode,
        expression
      );
    }
    return;
  }

  if (expression.type === 'CallExpression') {
    walkMemberChain(
      expression.callee as LintNode,
      visitLink
    );
  }
}

export function getChainLinkRange(
  sourceCode: SourceCode,
  objectNode: LintNode,
  memberNode: MemberExpression
) {
  const linkStart = sourceCode.getLastToken(
    objectNode
  );
  const dotToken = sourceCode.getTokenBefore(
    memberNode.property
  );
  const linkEnd = dotToken ?? sourceCode.getFirstToken(
    memberNode.property
  );

  if (!linkStart || !linkEnd) {
    return null;
  }

  return {
    linkStart,
    linkEnd,
    gapStart: objectNode.range![1],
    gapEnd: linkEnd.range[0],
  };
}

export function getArrowToken(sourceCode: SourceCode, node: ArrowFunctionExpression) {
  const bodyStart = sourceCode.getFirstToken(
    node.body
  );
  if (bodyStart === null) {
    return null;
  }

  return sourceCode.getTokenBefore(
    bodyStart,
    (token: Token) => token.value === '=>'
  );
}

export function hasBlankLine(text: string) {
  return /\n[\t ]*\n/.test(
    text
  );
}

export function collapseBlankLines(text: string) {
  return text.replace(
    /\n[\t ]*\n+/g,
    '\n'
  );
}
