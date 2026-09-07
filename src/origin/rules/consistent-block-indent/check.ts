import type { LintNode, SourceCode, Token } from '#plugin-types';

import { getLineIndent, isTokenOnSameLine } from '#layout/tokens';

export type BlockMark =
  | { type: 'program' }
  | { type: 'block'; braceLine: number }
  | { type: 'case'; caseLine: number };

export type TextEdit = { start: number; end: number; text: string };

export type CloseGap = { tokenBeforeEnd: number; closeStart: number; braceLine: number };

export function markStatement(
  sourceCode: SourceCode,
  node: LintNode,
  marks: Map<number, BlockMark>,
  mark: BlockMark
) {
  const firstToken = sourceCode.getFirstToken(
    node
  );
  if (firstToken === null || firstToken === undefined) {
    return;
  }

  marks.set(
    firstToken.loc.start.line,
    mark
  );
}

export function collectSameLineSplits(
  sourceCode: SourceCode,
  body: Array<LintNode>,
  statementIndent: string,
  edits: TextEdit[]
) {
  for (let index = 1; index < body.length; index += 1) {
    const previous = body[index - 1];
    const current = body[index];
    const previousEnd = sourceCode.getLastToken(
      previous
    );
    const currentStart = sourceCode.getFirstToken(
      current
    );

    if (!previousEnd || !currentStart) {
      continue;
    }

    if (previousEnd.loc.end.line !== currentStart.loc.start.line) {
      continue;
    }

    edits.push(
      {
        start: previousEnd.range[1],
        end: currentStart.range[0],
        text: `\n${statementIndent}`,
      }
    );
  }
}

export function bodyIndentForBlock(
  sourceCode: SourceCode,
  openBrace: Token
) {
  return `${getLineIndent(
    sourceCode,
    openBrace.loc.start.line
  )}  `;
}

export function visitBlock(
  sourceCode: SourceCode,
  node: LintNode,
  marks: Map<number, BlockMark>,
  edits: TextEdit[],
  closeGaps: CloseGap[]
) {
  const openBrace = sourceCode.getFirstToken(
    node
  );
  const closeBrace = sourceCode.getLastToken(
    node
  );
  if (!openBrace || openBrace.value !== '{' || !closeBrace) {
    return;
  }

  const mark = {
    type: 'block' as const,
    braceLine: openBrace.loc.start.line,
  };
  const body = Array.isArray(
    node.body
  )
    ? node.body as LintNode[]
    : [];

  collectSameLineSplits(
    sourceCode,
    body,
    bodyIndentForBlock(
      sourceCode,
      openBrace
    ),
    edits
  );

  for (const statement of body) {
    const firstToken = sourceCode.getFirstToken(
      statement
    );
    if (firstToken && isTokenOnSameLine(
      sourceCode,
      openBrace,
      firstToken
    )) {
      continue;
    }

    markStatement(
      sourceCode,
      statement,
      marks,
      mark
    );
  }

  if (
    closeBrace.value === '}'
    && !isTokenOnSameLine(
      sourceCode,
      openBrace,
      closeBrace
    )
  ) {
    const tokenBefore = sourceCode.getTokenBefore(
      closeBrace
    );
    if (tokenBefore) {
      closeGaps.push(
        {
          tokenBeforeEnd: tokenBefore.range[1],
          closeStart: closeBrace.range[0],
          braceLine: openBrace.loc.start.line,
        }
      );
    }
  }
}
