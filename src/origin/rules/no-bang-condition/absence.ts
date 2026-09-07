import type { Expression, LintNode, SourceCode } from '#plugin-types';

import { unwrap } from './boolean.ts';

function blockList(node: LintNode): LintNode[] | null {
  if (node.type === 'BlockStatement' || node.type === 'Program') {
    return node.body as LintNode[];
  }
  if (node.type === 'SwitchCase') {
    return (node as LintNode & { consequent?: LintNode[] }).consequent ?? null;
  }

  return null;
}

function nodeIndex(list: LintNode[], node: LintNode) {
  const byRef = list.indexOf(node);
  if (byRef >= 0) {
    return byRef;
  }

  return list.findIndex(item => item.range?.[0] === node.range?.[0]);
}

function ancestorInList(node: LintNode, list: LintNode[]): LintNode | null {
  let current: LintNode | null | undefined = node;
  while (current !== null && current !== undefined) {
    const index = nodeIndex(list, current);
    if (index >= 0) {
      return list[index] ?? null;
    }
    current = current.parent ?? null;
  }

  return null;
}

function findInitFromSiblings(identifier: LintNode & { name?: string }): LintNode | null {
  const name = identifier.name;
  if (name === undefined) {
    return null;
  }

  let current: LintNode | null | undefined = identifier.parent ?? null;
  while (current !== null && current !== undefined) {
    const list = blockList(current);
    if (list !== null) {
      const owner = ancestorInList(identifier, list);
      const ownerIndex = owner === null ? list.length : nodeIndex(list, owner);
      for (let index = ownerIndex - 1; index >= 0; index -= 1) {
        const stmt = list[index];
        if (stmt?.type !== 'VariableDeclaration') {
          continue;
        }
        const declarators = (stmt as LintNode & {
          declarations: Array<{ id: LintNode & { name?: string }; init?: LintNode | null }>;
        }).declarations;
        for (let decIndex = declarators.length - 1; decIndex >= 0; decIndex -= 1) {
          const declarator = declarators[decIndex];
          if (
            declarator.id.type === 'Identifier'
            && declarator.id.name === name
            && declarator.init !== null
            && declarator.init !== undefined
          ) {
            return unwrap(declarator.init);
          }
        }
      }
    }
    current = current.parent ?? null;
  }

  return null;
}

function resolveExpressionOrigin(node: LintNode): LintNode {
  const value = unwrap(node);
  if (value.type !== 'Identifier') {
    return value;
  }
  const init = findInitFromSiblings(value);
  if (init === null) {
    return value;
  }

  return init;
}

function getCalleeName(node: LintNode): string | null {
  if (node.type !== 'CallExpression') {
    return null;
  }
  const callee = node.callee as LintNode;
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression'
    && callee.computed === false
    && callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }

  return null;
}

/**
 * Token cursors are `T | null`. Everything else stays a full nullish check.
 */
export function missingSentinel(node: LintNode): 'null' | 'both' {
  const name = getCalleeName(resolveExpressionOrigin(node));
  if (name !== null && /Token/u.test(name)) {
    return 'null';
  }

  return 'both';
}

function isUndefinedIdentifier(node: LintNode) {
  return node.type === 'Identifier' && node.name === 'undefined';
}

function splitEqAbsence(node: LintNode): { expression: LintNode; sentinel: 'null' | 'undefined' } | null {
  const value = unwrap(node);
  if (value.type !== 'BinaryExpression' || value.operator !== '===') {
    return null;
  }
  const left = unwrap(value.left as LintNode);
  const right = unwrap(value.right as LintNode);
  if (left.type === 'Literal' && left.value === null) {
    return { expression: right, sentinel: 'null' };
  }
  if (right.type === 'Literal' && right.value === null) {
    return { expression: left, sentinel: 'null' };
  }
  if (isUndefinedIdentifier(left)) {
    return { expression: right, sentinel: 'undefined' };
  }
  if (isUndefinedIdentifier(right)) {
    return { expression: left, sentinel: 'undefined' };
  }

  return null;
}

export function splitNullishOr(
  test: LintNode,
  sourceCode: SourceCode,
): LintNode | null {
  const value = unwrap(test);
  if (value.type !== 'LogicalExpression' || value.operator !== '||') {
    return null;
  }
  const left = splitEqAbsence(value.left as LintNode);
  const right = splitEqAbsence(value.right as LintNode);
  if (left === null || right === null || left.sentinel === right.sentinel) {
    return null;
  }
  if (sourceCode.getText(left.expression) !== sourceCode.getText(right.expression)) {
    return null;
  }

  return left.expression;
}

/**
 * Safe local replace only — never rewrite surrounding control flow.
 */
export function renderAbsenceCheck(
  argument: Expression,
  sourceCode: SourceCode,
) {
  const argumentText = sourceCode.getText(argument);
  const needsParens = argument.type !== 'Identifier'
    && argument.type !== 'MemberExpression'
    && argument.type !== 'CallExpression'
    && argument.type !== 'ChainExpression';
  const left = needsParens ? `(${argumentText})` : argumentText;
  if (missingSentinel(argument as LintNode) === 'null') {
    return `${left} === null`;
  }

  return `${left} === null || ${left} === undefined`;
}
