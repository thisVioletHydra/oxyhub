import type { IfStatement, LintNode, RuleContext, RuleFixer, SourceCode, SwitchStatement, Token, WhileStatement } from '#plugin-types';

import { getLineIndent, isTokenOnSameLine } from '#layout/tokens';

import type { BlockMark, CloseGap, TextEdit } from './check.ts';

export type ConditionNode =
  | IfStatement
  | WhileStatement
  | SwitchStatement;

export function collapseConditionSpacing(
  sourceCode: SourceCode,
  testNode: LintNode,
  edits: TextEdit[]
) {
  const testFirst = sourceCode.getFirstToken(
    testNode
  );
  const testLast = sourceCode.getLastToken(
    testNode
  );
  if (!testFirst || !testLast) {
    return;
  }

  const leftParen = sourceCode
    .getTokenBefore(
      testFirst,
      (token: Token) => token.value === '(',
  );
  const rightParen = sourceCode.getTokenAfter(
    testLast,
    (token: Token) => token.value === ')',
  );
  const keywordToken = leftParen
    ? sourceCode.getTokenBefore(
      leftParen
    )
    : null;

  if (!keywordToken || !leftParen || !rightParen) {
    return;
  }

  if (!isTokenOnSameLine(
    sourceCode,
    leftParen,
    rightParen
  )) {
    return;
  }

  const inner = sourceCode.text.slice(
    leftParen.range[1],
    rightParen.range[0]
  );
  if (/\n/.test(
    inner
  )) {
    return;
  }

  const collapsed = inner.replace(
    /\s+/g,
    ' '
  ).trim();
  const expected = `${keywordToken.value} (${collapsed})`;
  const actual = sourceCode.text.slice(
    keywordToken.range[0],
    rightParen.range[1]
  );
  if (actual === expected) {
    return;
  }

  edits.push(
    {
      start: keywordToken.range[0],
      end: rightParen.range[1],
      text: expected,
    }
  );
}

export function applyBlockIndentFixes(
  context: RuleContext,
  node: LintNode,
  marks: Map<number, BlockMark>,
  edits: TextEdit[],
  closeGaps: CloseGap[],
  conditionNodes: ConditionNode[]
) {
  const sourceCode = context.sourceCode;

  for (const conditionNode of conditionNodes) {
    const testNode = conditionNode.type === 'SwitchStatement'
      ? conditionNode.discriminant
      : conditionNode.test;
    if (testNode) {
      collapseConditionSpacing(
        sourceCode,
        testNode,
        edits
      );
    }
  }

  const original = sourceCode.text;
  const lines = sourceCode.lines;

  function expectedIndentForLine(
    lineNumber: number,
    stack: Set<number> = new Set()
  ): string {
    if (stack.has(
      lineNumber
    )) {
      return getLineIndent(
        sourceCode,
        lineNumber
      );
    }

    const mark = marks.get(
      lineNumber
    );
    if (mark === null || mark === undefined) {
      return getLineIndent(
        sourceCode,
        lineNumber
      );
    }

    stack.add(
      lineNumber
    );

    if (mark.type === 'program') {
      return '';
    }

    if (mark.type === 'block') {
      return `${expectedIndentForLine(
        mark.braceLine,
        stack
      )}  `;
    }

    if (mark.type === 'case') {
      return `${expectedIndentForLine(
        mark.caseLine,
        stack
      )}  `;
    }

    return getLineIndent(
      sourceCode,
      lineNumber
    );
  }

  for (const [
    lineNumber
  ] of marks) {
    const line = lines[lineNumber - 1] ?? '';
    const indentMatch = /^[\t ]*/.exec(
      line
    );
    const actualIndent = indentMatch?.[0] ?? '';
    const expectedIndent = expectedIndentForLine(
      lineNumber
    );

    if (actualIndent === expectedIndent) {
      continue;
    }

    const lineStart = sourceCode.getIndexFromLoc(
      {
        line: lineNumber,
        column: 0,
      }
    );

    edits.push(
      {
        start: lineStart,
        end: lineStart + actualIndent.length,
        text: expectedIndent,
      }
    );
  }

  for (const closeGap of closeGaps) {
    const closeIndent = expectedIndentForLine(
      closeGap.braceLine
    );
    const expected = `\n${closeIndent}`;
    const actual = original.slice(
      closeGap.tokenBeforeEnd,
      closeGap.closeStart
    );
    if (actual === expected) {
      continue;
    }

    edits.push(
      {
        start: closeGap.tokenBeforeEnd,
        end: closeGap.closeStart,
        text: expected,
      }
    );
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /[\t ]+$/.exec(
      line
    );
    if (match === null || match === undefined) {
      continue;
    }

    const lineNumber = index + 1;
    const lineStart = sourceCode.getIndexFromLoc(
      {
        line: lineNumber,
        column: 0,
      }
    );

    edits.push(
      {
        start: lineStart + line.length - match[0].length,
        end: lineStart + line.length,
        text: '',
      }
    );
  }

  const reported: TextEdit[] = [];

  for (const edit of edits) {
    if (edit.start === edit.end && edit.text === '') {
      continue;
    }

    const actual = original.slice(
      edit.start,
      edit.end
    );
    if (actual === edit.text) {
      continue;
    }

    const overlaps = reported.some(
      (previous) => edit.start < previous.end && previous.start < edit.end
    );
    if (overlaps) {
      continue;
    }

    reported.push(
      edit
    );
    context.report(
      {
        node,
        loc: {
          start: sourceCode.getLocFromIndex(
            edit.start
          ),
          end: sourceCode.getLocFromIndex(
            edit.end
          ),
        },
        messageId: 'badWhitespace',
        fix(fixer: RuleFixer) {
          return fixer.replaceTextRange(
            [
              edit.start,
              edit.end
            ],
            edit.text
          );
        },
      }
    );
  }
}
