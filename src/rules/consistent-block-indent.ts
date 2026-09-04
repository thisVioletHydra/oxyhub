/**
 * @param {string[]} lines
 * @param {number} lineNumber
 */
function getLineIndentFromLines(lines, lineNumber) {
  const line = lines[lineNumber - 1] ?? '';
  const match = /^[\t ]*/.exec(line);
  return match?.[0] ?? '';
}

/** @param {import('eslint').SourceCode} sourceCode */
function isTokenOnSameLine(sourceCode, left, right) {
  return left.loc.start.line === right.loc.start.line;
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} node
 * @param {Map<number, { type: 'program' } | { type: 'block', braceLine: number } | { type: 'case', caseLine: number }>} marks
 * @param {{ type: 'program' } | { type: 'block', braceLine: number } | { type: 'case', caseLine: number }} mark
 */
function markStatement(sourceCode, node, marks, mark) {
  const firstToken = sourceCode.getFirstToken(node);
  if (!firstToken) {
    return;
  }

  marks.set(firstToken.loc.start.line, mark);
}

/**
 * @param {string} text
 * @param {{ start: number, end: number, text: string }[]} edits
 */
function applyEdits(text, edits) {
  const ordered = [...edits].sort((left, right) => {
    if (right.start !== left.start) {
      return right.start - left.start;
    }

    return right.end - left.end;
  });
  let next = text;

  for (const edit of ordered) {
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
  }

  return next;
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} testNode
 * @param {{ start: number, end: number, text: string }[]} edits
 */
function collapseConditionSpacing(sourceCode, testNode, edits) {
  const testFirst = sourceCode.getFirstToken(testNode);
  const testLast = sourceCode.getLastToken(testNode);
  if (!testFirst || !testLast) {
    return;
  }

  const leftParen = sourceCode.getTokenBefore(
    testFirst,
    (token) => token.value === '(',
  );
  const rightParen = sourceCode.getTokenAfter(
    testLast,
    (token) => token.value === ')',
  );
  const keywordToken = leftParen
    ? sourceCode.getTokenBefore(leftParen)
    : null;

  if (!keywordToken || !leftParen || !rightParen) {
    return;
  }

  if (!isTokenOnSameLine(sourceCode, leftParen, rightParen)) {
    return;
  }

  const inner = sourceCode.text.slice(leftParen.range[1], rightParen.range[0]);
  if (/\n/.test(inner)) {
    return;
  }

  const collapsed = inner.replace(/\s+/g, ' ').trim();
  const expected = `${keywordToken.value} (${collapsed})`;
  const actual = sourceCode.text.slice(keywordToken.range[0], rightParen.range[1]);
  if (actual === expected) {
    return;
  }

  edits.push({
    start: keywordToken.range[0],
    end: rightParen.range[1],
    text: expected,
  });
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
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
    /** @type {Map<number, { type: 'program' } | { type: 'block', braceLine: number } | { type: 'case', caseLine: number }>} */
    const marks = new Map();
    /** @type {{ start: number, end: number, text: string }[]} */
    const edits = [];
    /** @type {import('estree').Node[]} */
    const conditionNodes = [];
    /** @type {{ tokenBeforeEnd: number, closeStart: number, braceLine: number }[]} */
    const closeGaps = [];

    function bodyIndentForBlock(openBrace) {
      return `${getLineIndentFromLines(sourceCode.lines, openBrace.loc.start.line)}  `;
    }

    /**
     * @param {import('estree').Node[]} body
     * @param {string} statementIndent
     */
    function collectSameLineSplits(body, statementIndent) {
      for (let index = 1; index < body.length; index += 1) {
        const previous = body[index - 1];
        const current = body[index];
        const previousEnd = sourceCode.getLastToken(previous);
        const currentStart = sourceCode.getFirstToken(current);

        if (!previousEnd || !currentStart) {
          continue;
        }

        if (previousEnd.loc.end.line !== currentStart.loc.start.line) {
          continue;
        }

        edits.push({
          start: previousEnd.range[1],
          end: currentStart.range[0],
          text: `\n${statementIndent}`,
        });
      }
    }

    function visitBlock(node) {
      const openBrace = sourceCode.getFirstToken(node);
      const closeBrace = sourceCode.getLastToken(node);
      if (!openBrace || openBrace.value !== '{' || !closeBrace) {
        return;
      }

      const mark = {
        type: 'block',
        braceLine: openBrace.loc.start.line,
      };

      collectSameLineSplits(node.body, bodyIndentForBlock(openBrace));

      for (const statement of node.body) {
        const firstToken = sourceCode.getFirstToken(statement);
        if (firstToken && isTokenOnSameLine(sourceCode, openBrace, firstToken)) {
          continue;
        }

        markStatement(sourceCode, statement, marks, mark);
      }

      if (
        closeBrace.value === '}'
        && !isTokenOnSameLine(sourceCode, openBrace, closeBrace)
      ) {
        const tokenBefore = sourceCode.getTokenBefore(closeBrace);
        if (tokenBefore) {
          closeGaps.push({
            tokenBeforeEnd: tokenBefore.range[1],
            closeStart: closeBrace.range[0],
            braceLine: openBrace.loc.start.line,
          });
        }
      }
    }

    return {
      Program(node) {
        const mark = { type: 'program' };
        collectSameLineSplits(node.body, '');
        for (const statement of node.body) {
          markStatement(sourceCode, statement, marks, mark);
        }
      },
      BlockStatement: visitBlock,
      StaticBlock: visitBlock,
      SwitchCase(node) {
        const caseToken = sourceCode.getFirstToken(node);
        if (!caseToken) {
          return;
        }

        const mark = {
          type: 'case',
          caseLine: caseToken.loc.start.line,
        };

        const caseIndent = `${getLineIndentFromLines(sourceCode.lines, caseToken.loc.start.line)}  `;
        collectSameLineSplits(
          node.consequent.filter((statement) => statement.type !== 'BlockStatement'),
          caseIndent,
        );

        for (const statement of node.consequent) {
          if (statement.type === 'BlockStatement') {
            continue;
          }

          markStatement(sourceCode, statement, marks, mark);
        }
      },
      IfStatement(node) {
        conditionNodes.push(node);
      },
      WhileStatement(node) {
        conditionNodes.push(node);
      },
      SwitchStatement(node) {
        conditionNodes.push(node);
      },
      'Program:exit'(node) {
        for (const conditionNode of conditionNodes) {
          const testNode = conditionNode.type === 'SwitchStatement'
            ? conditionNode.discriminant
            : conditionNode.test;
          if (testNode) {
            collapseConditionSpacing(sourceCode, testNode, edits);
          }
        }

        const original = sourceCode.text;
        const lines = sourceCode.lines;

        /**
         * @param {number} lineNumber
         * @param {Set<number>} stack
         */
        function expectedIndentForLine(lineNumber, stack = new Set()) {
          if (stack.has(lineNumber)) {
            return getLineIndentFromLines(lines, lineNumber);
          }

          const mark = marks.get(lineNumber);
          if (!mark) {
            return getLineIndentFromLines(lines, lineNumber);
          }

          stack.add(lineNumber);

          if (mark.type === 'program') {
            return '';
          }

          if (mark.type === 'block') {
            return `${expectedIndentForLine(mark.braceLine, stack)}  `;
          }

          if (mark.type === 'case') {
            return `${expectedIndentForLine(mark.caseLine, stack)}  `;
          }

          return getLineIndentFromLines(lines, lineNumber);
        }

        for (const [lineNumber] of marks) {
          const line = lines[lineNumber - 1] ?? '';
          const indentMatch = /^[\t ]*/.exec(line);
          const actualIndent = indentMatch?.[0] ?? '';
          const expectedIndent = expectedIndentForLine(lineNumber);

          if (actualIndent === expectedIndent) {
            continue;
          }

          const lineStart = sourceCode.getIndexFromLoc({
            line: lineNumber,
            column: 0,
          });

          edits.push({
            start: lineStart,
            end: lineStart + actualIndent.length,
            text: expectedIndent,
          });
        }

        for (const closeGap of closeGaps) {
          const closeIndent = expectedIndentForLine(closeGap.braceLine);
          const expected = `\n${closeIndent}`;
          const actual = original.slice(closeGap.tokenBeforeEnd, closeGap.closeStart);
          if (actual === expected) {
            continue;
          }

          edits.push({
            start: closeGap.tokenBeforeEnd,
            end: closeGap.closeStart,
            text: expected,
          });
        }

        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const match = /[\t ]+$/.exec(line);
          if (!match) {
            continue;
          }

          const lineNumber = index + 1;
          const lineStart = sourceCode.getIndexFromLoc({
            line: lineNumber,
            column: 0,
          });

          edits.push({
            start: lineStart + line.length - match[0].length,
            end: lineStart + line.length,
            text: '',
          });
        }

        let nextText = applyEdits(original, edits);
        const hadFinalNewline = original.endsWith('\n');
        if (hadFinalNewline && !nextText.endsWith('\n')) {
          nextText += '\n';
        }

        const collapsed = nextText.replace(/\n{3,}/g, '\n\n');
        if (collapsed !== nextText) {
          nextText = collapsed;
        }

        if (nextText === original) {
          return;
        }

        context.report({
          node,
          messageId: 'badWhitespace',
          fix(fixer) {
            return fixer.replaceTextRange([0, original.length], nextText);
          },
        });
      },
    };
  },
};
