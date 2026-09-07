import type { LintNode, UnaryExpression } from '#plugin-types';

export function getBangExpression(node: LintNode): UnaryExpression | null {
  if (node.type === 'UnaryExpression' && node.operator === '!' && node.prefix) {
    return node;
  }

  return null;
}

export function unwrap(node: LintNode): LintNode {
  const type: string = node.type;

  if (type === 'ParenthesizedExpression') {
    return unwrap(
      node.expression as LintNode
    );
  }

  if (type === 'AwaitExpression') {
    return unwrap(
      node.argument as LintNode
    );
  }

  if (type === 'ChainExpression') {
    return unwrap(
      node.expression as LintNode
    );
  }

  if (
    type === 'TSAsExpression'
    || type === 'TSSatisfiesExpression'
    || type === 'TSNonNullExpression'
    || type === 'TSTypeAssertion'
  ) {
    return unwrap(
      node.expression as LintNode
    );
  }

  return node;
}

function nameLooksBoolean(name: string) {
  return (
    /^(is|are|was|were|has|have|can|should|did|does|check)/iu.test(
      name
    )
    || /^(ok|exists|empty|ready|enabled|disabled|visible|hidden|valid|invalid|loading|pending|open|closed|active)$/iu.test(
      name
    )
    || /exist/iu.test(
      name
    )
  );
}

function calleeLooksBoolean(callee: LintNode) {
  if (callee.type === 'Identifier') {
    return nameLooksBoolean(
      callee.name
    );
  }

  if (
    callee.type === 'MemberExpression'
    && callee.computed === false
    && callee.property.type === 'Identifier'
  ) {
    const propertyName = callee.property.name;
    if (
      /^(test|includes|startsWith|endsWith|has|hasOwn|hasOwnProperty|isFile|isDirectory|exists|every|some)$/u.test(
        propertyName,
      )
    ) {
      return true;
    }

    return nameLooksBoolean(
      propertyName
    );
  }

  return false;
}

/**
 * Already a boolean expression — `!` is fine.
 */
export function isDefinitelyBooleanExpression(node: LintNode): boolean {
  const value = unwrap(
    node
  );

  if (value.type === 'Literal') {
    return value.value === true || value.value === false;
  }

  if (value.type === 'BinaryExpression') {
    return (
      value.operator === '==='
      || value.operator === '!=='
      || value.operator === '=='
      || value.operator === '!='
      || value.operator === '<'
      || value.operator === '>'
      || value.operator === '<='
      || value.operator === '>='
      || value.operator === 'in'
      || value.operator === 'instanceof'
    );
  }

  if (value.type === 'UnaryExpression' && value.operator === '!') {
    return isDefinitelyBooleanExpression(
      value.argument as LintNode
    );
  }

  if (value.type === 'LogicalExpression') {
    return (
      isDefinitelyBooleanExpression(
        value.left as LintNode
      )
      && isDefinitelyBooleanExpression(
        value.right as LintNode
      )
    );
  }

  if (value.type === 'ConditionalExpression') {
    return (
      isDefinitelyBooleanExpression(
        value.consequent as LintNode
      )
      && isDefinitelyBooleanExpression(
        value.alternate as LintNode
      )
    );
  }

  if (value.type === 'CallExpression') {
    return calleeLooksBoolean(
      value.callee as LintNode
    );
  }

  if (value.type === 'Identifier') {
    return nameLooksBoolean(
      value.name
    );
  }

  if (
    value.type === 'MemberExpression'
    && value.computed === false
    && value.property.type === 'Identifier'
  ) {
    return nameLooksBoolean(
      value.property.name
    );
  }

  return false;
}
