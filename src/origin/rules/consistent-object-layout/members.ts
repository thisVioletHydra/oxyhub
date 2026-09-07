import type { ArrayExpression, ArrayPattern, LintNode, ObjectExpression, ObjectPattern, SourceCode, Token } from '#plugin-types';

import { isTokenOnSameLine } from '#layout/tokens';

export type ContainerNode =
  | ObjectExpression
  | ArrayExpression
  | ObjectPattern
  | ArrayPattern;

export function getDelimiters(
  sourceCode: SourceCode,
  node: ContainerNode
) {
  const openValue = node.type === 'ArrayExpression' || node.type === 'ArrayPattern'
    ? '['
    : '{';
  const closeValue = node.type === 'ArrayExpression' || node.type === 'ArrayPattern'
    ? ']'
    : '}';
  const open = sourceCode.getFirstToken(
    node,
    (token: Token) => token.value === openValue
  );
  const close = sourceCode.getLastToken(
    node,
    (token: Token) => token.value === closeValue
  );

  if (!open || !close) {
    return null;
  }

  return {
    open,
    close
  };
}

export function getMembers(node: ContainerNode): LintNode[] {
  if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
    return (node.elements ?? []).filter(
      (element): element is NonNullable<typeof element> => element !== null
    ) as LintNode[];
  }

  return node.properties ?? [];
}

export function isSingleLineMember(node: LintNode) {
  return node.loc!.start.line === node.loc!.end.line;
}

/**
 * Multiline only when the first member starts on its own line after `{` / `[`.
 * First member beside the opener → collapse back to one line.
 */
export function hasMultilineIntent(
  sourceCode: SourceCode,
  members: LintNode[],
  open: Token
) {
  const firstToken = sourceCode.getFirstToken(
    members[0]
  );
  if (firstToken === null || firstToken === undefined) {
    return false;
  }

  return !isTokenOnSameLine(
    sourceCode,
    open,
    firstToken
  );
}
