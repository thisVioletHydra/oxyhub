import type { LintNode, SourceCode, Token } from '#plugin-types';

import { statementList } from '#layout/statements';
import { getLineIndent } from '#layout/tokens';

function isMarkedStatement(node: LintNode) {
  const parent = node.parent;
  if (parent === null || parent === undefined) {
    return false;
  }

  const list = statementList(
    parent
  );
  if (list === null || list === undefined) {
    return false;
  }

  if (parent.type === 'SwitchCase' && node.type === 'BlockStatement') {
    return false;
  }

  return list.includes(
    node
  );
}

function nearestMarkedStatement(node: LintNode) {
  let current: LintNode | null | undefined = node;

  while (current !== null && current !== undefined) {
    if (isMarkedStatement(
      current
    )) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function expectedStatementIndent(
  sourceCode: SourceCode,
  node: LintNode
): string {
  const parent = node.parent;
  if (parent === null || parent === undefined || parent.type === 'Program') {
    return '';
  }

  if (parent.type === 'SwitchCase') {
    const caseToken = sourceCode.getFirstToken(
      parent
    );
    const caseIndent = caseToken
      ? getLineIndent(
        sourceCode,
        caseToken.loc.start.line
      )
      : '';
    return `${caseIndent}  `;
  }

  if (parent.type !== 'BlockStatement' && parent.type !== 'StaticBlock') {
    return getLineIndent(
      sourceCode,
      sourceCode.getFirstToken(
        node
      )?.loc.start.line ?? 1
    );
  }

  const openBrace = sourceCode.getFirstToken(
    parent
  );
  if (openBrace === null || openBrace === undefined) {
    return '  ';
  }

  const owner = parent.parent;
  if (
    owner
    && isMarkedStatement(
      owner
    )
  ) {
    const ownerStart = sourceCode.getFirstToken(
      owner
    );
    if (
      ownerStart
      && ownerStart.loc.start.line === openBrace.loc.start.line
    ) {
      return `${expectedStatementIndent(
        sourceCode,
        owner
      )}  `;
    }
  }

  return `${getLineIndent(
    sourceCode,
    openBrace.loc.start.line
  )}  `;
}

/**
 * Indent of the line with `(`, `{`, or `[` when that token sits on a
 * statement that block-indent will retarget. Continuation lines keep
 * the current leading whitespace.
 */
export function expectedOpenerIndent(
  sourceCode: SourceCode,
  node: LintNode,
  opener: Token
) {
  const statement = nearestMarkedStatement(
    node
  );
  if (statement === null || statement === undefined) {
    return getLineIndent(
      sourceCode,
      opener.loc.start.line
    );
  }

  const statementStart = sourceCode.getFirstToken(
    statement
  );
  if (
    statementStart
    && statementStart.loc.start.line === opener.loc.start.line
  ) {
    return expectedStatementIndent(
      sourceCode,
      statement
    );
  }

  return getLineIndent(
    sourceCode,
    opener.loc.start.line
  );
}

export function expectedCallBaseIndent(
  sourceCode: SourceCode,
  node: LintNode,
  leftParen: Token
) {
  return expectedOpenerIndent(
    sourceCode,
    node,
    leftParen
  );
}
