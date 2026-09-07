import type { FunctionNode, LintNode } from '#plugin-types';

import { hasBlankLine } from '#layout/chain';

export function isFunctionNode(node: LintNode): node is LintNode & FunctionNode {
  return (
    node.type === 'FunctionDeclaration'
    || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression'
  );
}

export function enclosingFunction(node: LintNode): (LintNode & FunctionNode) | null {
  let current = node.parent ?? null;
  while (current !== null && current !== undefined) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent ?? null;
  }

  return null;
}

export function isSimpleStatement(
  node: LintNode,
): node is LintNode & { type: 'EmptyStatement' | 'ExpressionStatement' | 'VariableDeclaration' } {
  return (
    node.type === 'EmptyStatement'
    || node.type === 'ExpressionStatement'
    || node.type === 'VariableDeclaration'
  );
}

export function isExitStatement(
  node: LintNode,
): node is LintNode & { type: 'ReturnStatement' | 'ThrowStatement' } {
  return node.type === 'ReturnStatement' || node.type === 'ThrowStatement';
}

function isBlockContainer(
  node: LintNode,
): node is LintNode & { type: 'BlockStatement' | 'Program' | 'StaticBlock'; body: LintNode[] } {
  if (
    node.type !== 'BlockStatement'
    && node.type !== 'Program'
    && node.type !== 'StaticBlock'
  ) {
    return false;
  }

  return Array.isArray(node.body);
}

function isSwitchCase(
  node: LintNode,
): node is LintNode & { type: 'SwitchCase'; consequent: LintNode[] } {
  return node.type === 'SwitchCase' && Array.isArray(node.consequent);
}

export function statementList(parent: LintNode): LintNode[] | null {
  if (isBlockContainer(parent)) {
    return parent.body;
  }

  if (isSwitchCase(parent)) {
    return parent.consequent;
  }

  return null;
}

export function previousStatement(node: LintNode): LintNode | null {
  const parent = node.parent;
  if (parent === null || parent === undefined) {
    return null;
  }

  const list = statementList(parent);
  if (list === null) {
    return null;
  }

  const index = list.indexOf(node);
  if (index <= 0) {
    return null;
  }

  return list[index - 1] ?? null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function hasSpan(
  node: LintNode
): node is LintNode & { range: [number, number]; loc: NonNullable<LintNode['loc']> } {
  return isPresent(node.range) && isPresent(node.loc);
}

export function blankLineInsert(sourceText: string, previous: LintNode, current: LintNode) {
  if (!hasSpan(previous) || !hasSpan(current)) {
    return null;
  }

  const gap = sourceText.slice(previous.range[1], current.range[0]);
  if (hasBlankLine(gap)) {
    return null;
  }

  return {
    prevRange: previous.range,
    text: previous.loc.end.line === current.loc.start.line ? '\n\n' : '\n',
  };
}
