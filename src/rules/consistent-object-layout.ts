import { getLineIndent, isTokenOnSameLine } from '../utils/function-params';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').ObjectExpression | import('estree').ArrayExpression | import('estree').ObjectPattern | import('estree').ArrayPattern} node
 */
function getDelimiters(sourceCode, node) {
  const openValue = node.type === 'ArrayExpression' || node.type === 'ArrayPattern'
    ? '['
    : '{';
  const closeValue = node.type === 'ArrayExpression' || node.type === 'ArrayPattern'
    ? ']'
    : '}';
  const open = sourceCode.getFirstToken(node, (token) => token.value === openValue);
  const close = sourceCode.getLastToken(node, (token) => token.value === closeValue);

  if (!open || !close) {
    return null;
  }

  return { open, close };
}

/**
 * @param {import('estree').ObjectExpression | import('estree').ArrayExpression | import('estree').ObjectPattern | import('estree').ArrayPattern} node
 */
function getMembers(node) {
  if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
    return (node.elements ?? []).filter((element) => element !== null);
  }

  return node.properties ?? [];
}

/** @param {import('estree').Node} node */
function isSingleLineMember(node) {
  return node.loc.start.line === node.loc.end.line;
}

/**
 * Multiline only when the first member starts on its own line after `{` / `[`.
 * First member beside the opener → collapse back to one line.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node[]} members
 * @param {import('eslint').AST.Token} open
 */
function hasMultilineIntent(sourceCode, members, open) {
  const firstToken = sourceCode.getFirstToken(members[0]);
  if (!firstToken) {
    return false;
  }

  return !isTokenOnSameLine(sourceCode, open, firstToken);
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep object/array/destructure members inline, or multiline when the first member starts after `{`/`[` on its own line.',
    },
    fixable: 'whitespace',
    messages: {
      collapseMembers: 'Object/array/destructure should stay on one line.',
      expandMembers: 'Multiline object/array/destructure must place each member on its own line.',
      normalizeMemberSpacing: 'Normalize spacing inside this object/array/destructure.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function normalizeGap(node, rangeStart, rangeEnd, expectedText, messageId) {
      const actualText = sourceCode.text.slice(rangeStart, rangeEnd);
      if (actualText === expectedText) {
        return;
      }

      if (/[^\s]/.test(actualText)) {
        return;
      }

      context.report({
        node,
        messageId,
        fix(fixer) {
          return fixer.replaceTextRange([rangeStart, rangeEnd], expectedText);
        },
      });
    }

    function collapseInline(node, open, close, members) {
      if (!members.every((member) => isSingleLineMember(member))) {
        return;
      }

      const innerStart = open.range[1];
      const innerEnd = close.range[0];
      const inner = sourceCode.text.slice(innerStart, innerEnd);
      if (!/\n/.test(inner)) {
        return;
      }

      const collapsed = inner
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,$/u, '');
      const expected = `${open.value} ${collapsed} ${close.value}`;
      const actual = sourceCode.text.slice(open.range[0], close.range[1]);
      if (actual === expected) {
        return;
      }

      context.report({
        node,
        messageId: 'collapseMembers',
        fix(fixer) {
          return fixer.replaceTextRange([open.range[0], close.range[1]], expected);
        },
      });
    }

    function checkContainer(node) {
      const members = getMembers(node);
      if (members.length === 0) {
        return;
      }

      const delimiters = getDelimiters(sourceCode, node);
      if (!delimiters) {
        return;
      }

      const { open, close } = delimiters;
      const multilineIntent = hasMultilineIntent(sourceCode, members, open);

      if (!multilineIntent) {
        collapseInline(node, open, close, members);
        return;
      }

      const baseIndent = getLineIndent(sourceCode, open.loc.start.line);
      const memberIndent = `${baseIndent}  `;

      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        const memberToken = sourceCode.getFirstToken(member);
        if (!memberToken) {
          continue;
        }

        if (index === 0) {
          normalizeGap(
            member,
            open.range[1],
            memberToken.range[0],
            `\n${memberIndent}`,
            'normalizeMemberSpacing',
          );
          continue;
        }

        const previous = members[index - 1];
        const commaToken = sourceCode.getTokenAfter(
          previous,
          (token) => token.value === ',',
        );
        if (!commaToken) {
          continue;
        }

        if (isTokenOnSameLine(sourceCode, commaToken, memberToken)) {
          context.report({
            node: member,
            messageId: 'expandMembers',
            fix(fixer) {
              return fixer.replaceTextRange(
                [commaToken.range[1], memberToken.range[0]],
                `\n${memberIndent}`,
              );
            },
          });
          continue;
        }

        normalizeGap(
          member,
          commaToken.range[1],
          memberToken.range[0],
          `\n${memberIndent}`,
          'normalizeMemberSpacing',
        );
      }

      const lastMember = members.at(-1);
      const lastToken = sourceCode.getLastToken(lastMember);
      if (!lastToken) {
        return;
      }

      const afterLast = sourceCode.getTokenAfter(lastToken);
      const closeGapStart = afterLast?.value === ','
        ? afterLast.range[1]
        : lastToken.range[1];

      normalizeGap(
        lastMember,
        closeGapStart,
        close.range[0],
        `\n${baseIndent}`,
        'normalizeMemberSpacing',
      );
    }

    return {
      ObjectExpression: checkContainer,
      ArrayExpression: checkContainer,
      ObjectPattern: checkContainer,
      ArrayPattern: checkContainer,
    };
  },
};
