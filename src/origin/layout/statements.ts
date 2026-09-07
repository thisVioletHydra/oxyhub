import type { FunctionNode, LintNode } from '#plugin-types';

export function isFunctionNode(node: LintNode): node is FunctionNode {
  return (
    node.type === 'FunctionDeclaration'
    || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression'
  );
}

export function enclosingFunction(node: LintNode): FunctionNode | null {
  let current = node.parent ?? null;
  while (current !== null && current !== undefined) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent ?? null;
  }

  return null;
}

export function statementList(parent: LintNode): LintNode[] | null {
  if (
    parent.type === 'BlockStatement'
    || parent.type === 'Program'
    || parent.type === 'StaticBlock'
  ) {
    return parent.body as LintNode[];
  }
  if (parent.type === 'SwitchCase') {
    return (parent as LintNode & { consequent?: LintNode[] }).consequent ?? null;
  }

  return null;
}

export function previousStatement(node: LintNode): LintNode | null {
  const parent = node.parent;
  if (parent === null || parent === undefined) {
    return null;
  }
  const list = statementList(parent);
  if (list === null || list === undefined) {
    return null;
  }
  const index = list.indexOf(node);
  if (index <= 0) {
    return null;
  }

  return list[index - 1] ?? null;
}
