import type { RuleFixer, RuleModule, SourceCode, Token } from '#plugin-types';

type BlockMark =
  | { type: 'program' }
  | { type: 'block'; braceLine: number }
  | { type: 'case'; caseLine: number };

type TextEdit = { start: number; end: number; text: string };

type ConditionNode =
  | import('estree').IfStatement
  | import('estree').WhileStatement
  | import('estree').SwitchStatement;

function getLineIndentFromLines(
  lines: string[],
  lineNumber: number
) {
  const line = lines[lineNumber - 1] ?? '';
  const match = /^[\t ]*/.exec(
    line
  );
  return match?.[0] ?? '';
}

function isTokenOnSameLine(
  sourceCode: SourceCode,
  left: Token,
  right: Token
) {
  return left.loc.start.line === right.loc.start.line;
}

function markStatement(
  sourceCode: SourceCode,
  node: import('estree').Node,
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

function applyEdits(
  text: string,
  edits: TextEdit[]
) {
  const ordered = [
    ...edits
  ].sort(
    (
      left,
      right
    ) => {
      if (right.start !== left.start) {
        return right.start - left.start;
      }

      return right.end - left.end;
    }
  );
  let next = text;

  for (const edit of ordered) {
    next = `${next.slice(
      0,
      edit.start
    )}${edit.text}${next.slice(
      edit.end
    )}`;
  }

  return next;
}

function collapseConditionSpacing(
  sourceCode: SourceCode,
  testNode: import('estree').Node,
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

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Indent blocks, split same-line statements, and clean messy whitespace.',
    },
    fixable: 'whitespace',
    messages: {
      badWhitespace: 'Fix indentation and messy whitespace.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const marks = new Map<number, BlockMark>();
    const edits: TextEdit[] = [];
    const conditionNodes: ConditionNode[] = [];
    const closeGaps: Array<{ tokenBeforeEnd: number; closeStart: number; braceLine: number }> = [];

    function bodyIndentForBlock(openBrace: Token) {
      return `${getLineIndentFromLines(
        sourceCode.lines,
        openBrace.loc.start.line
      )}  `;
    }

    function collectSameLineSplits(
      body: Array<import('estree').Node>,
      statementIndent: string
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

    function visitBlock(node: import('estree').BlockStatement | import('estree').StaticBlock) {
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

      collectSameLineSplits(
        node.body,
        bodyIndentForBlock(
          openBrace
        )
      );

      for (const statement of node.body) {
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

    return {
      Program(node) {
        const mark = {
          type: 'program' as const
        };
        collectSameLineSplits(
          node.body,
          ''
        );
        for (const statement of node.body) {
          markStatement(
            sourceCode,
            statement,
            marks,
            mark
          );
        }
      },
      BlockStatement: visitBlock,
      StaticBlock: visitBlock,
      SwitchCase(node) {
        const caseToken = sourceCode.getFirstToken(
          node
        );
        if (caseToken === null || caseToken === undefined) {
          return;
        }

        const mark = {
          type: 'case' as const,
          caseLine: caseToken.loc.start.line,
        };

        const caseIndent = `${getLineIndentFromLines(
          sourceCode.lines,
          caseToken.loc.start.line
        )}  `;
        collectSameLineSplits(
          node.consequent.filter(
            (statement) => statement.type !== 'BlockStatement'
          ),
          caseIndent,
        );

        for (const statement of node.consequent) {
          if (statement.type === 'BlockStatement') {
            continue;
          }

          markStatement(
            sourceCode,
            statement,
            marks,
            mark
          );
        }
      },
      IfStatement(node) {
        conditionNodes.push(
          node
        );
      },
      WhileStatement(node) {
        conditionNodes.push(
          node
        );
      },
      SwitchStatement(node) {
        conditionNodes.push(
          node
        );
      },
      'Program:exit'(node) {
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
            return getLineIndentFromLines(
              lines,
              lineNumber
            );
          }

          const mark = marks.get(
            lineNumber
          );
          if (mark === null || mark === undefined) {
            return getLineIndentFromLines(
              lines,
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

          return getLineIndentFromLines(
            lines,
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

        let nextText = applyEdits(
          original,
          edits
        );
        const hadFinalNewline = original.endsWith(
          '\n'
        );
        if (hadFinalNewline && !nextText.endsWith(
          '\n'
        )) {
          nextText += '\n';
        }

        const collapsed = nextText.replace(
          /\n{3,}/g,
          '\n\n'
        );
        if (collapsed !== nextText) {
          nextText = collapsed;
        }

        if (nextText === original) {
          return;
        }

        context.report(
          {
            node,
            messageId: 'badWhitespace',
            fix(fixer: RuleFixer) {
              return fixer.replaceTextRange(
                [
                  0,
                  original.length
                ],
                nextText
              );
            },
          }
        );
      },
    };
  },
};

export default rule;
