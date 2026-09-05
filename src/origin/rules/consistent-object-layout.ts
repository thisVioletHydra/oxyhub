import type { LintNode, RuleFixer, RuleModule, SourceCode, Token } from '#plugin-types';

import { getLineIndent, isTokenOnSameLine } from '#utils/function-params';

type ContainerNode =
  | import('estree').ObjectExpression
  | import('estree').ArrayExpression
  | import('estree').ObjectPattern
  | import('estree').ArrayPattern;

function getDelimiters(
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

function getMembers(node: ContainerNode): LintNode[] {
  if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
    return (node.elements ?? []).filter(
      (element): element is NonNullable<typeof element> => element !== null
    ) as LintNode[];
  }

  return node.properties ?? [];
}

function isSingleLineMember(node: LintNode) {
  return node.loc!.start.line === node.loc!.end.line;
}

/**
 * Multiline only when the first member starts on its own line after `{` / `[`.
 * First member beside the opener → collapse back to one line.
 */
function hasMultilineIntent(
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

const rule: RuleModule = {
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

    function normalizeGap(
      node: LintNode,
      rangeStart: number,
      rangeEnd: number,
      expectedText: string,
      messageId: string
    ) {
      const actualText = sourceCode.text.slice(
        rangeStart,
        rangeEnd
      );
      if (actualText === expectedText) {
        return;
      }

      if (/[^\s]/.test(
        actualText
      )) {
        return;
      }

      context.report(
        {
          node,
          messageId,
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                rangeStart,
                rangeEnd
              ],
              expectedText
            );
          },
        }
      );
    }

    function collapseInline(
      node: ContainerNode,
      open: Token,
      close: Token,
      members: LintNode[]
    ) {
      if (!members.every(
        (member) => isSingleLineMember(
          member
        )
      )) {
        return;
      }

      const innerStart = open.range[1];
      const innerEnd = close.range[0];
      const inner = sourceCode.text.slice(
        innerStart,
        innerEnd
      );
      if (!/\n/.test(
        inner
      )) {
        return;
      }

      const collapsed = inner
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .replace(
          /,$/u,
          ''
        );
      const expected = `${open.value} ${collapsed} ${close.value}`;
      const actual = sourceCode.text.slice(
        open.range[0],
        close.range[1]
      );
      if (actual === expected) {
        return;
      }

      context.report(
        {
          node,
          messageId: 'collapseMembers',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                open.range[0],
                close.range[1]
              ],
              expected
            );
          },
        }
      );
    }

    function checkContainer(node: ContainerNode) {
      const members = getMembers(
        node
      );
      if (members.length === 0) {
        return;
      }

      const delimiters = getDelimiters(
        sourceCode,
        node
      );
      if (delimiters === null || delimiters === undefined) {
        return;
      }

      const {
        open,
        close
      } = delimiters;
      const multilineIntent = hasMultilineIntent(
        sourceCode,
        members,
        open
      );

      if (multilineIntent === null || multilineIntent === undefined) {
        collapseInline(
          node,
          open,
          close,
          members
        );
        return;
      }

      const baseIndent = getLineIndent(
        sourceCode,
        open.loc.start.line
      );
      const memberIndent = `${baseIndent}  `;

      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        const memberToken = sourceCode.getFirstToken(
          member
        );
        if (memberToken === null || memberToken === undefined) {
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
          (token: Token) => token.value === ',',
        );
        if (commaToken === null || commaToken === undefined) {
          continue;
        }

        if (isTokenOnSameLine(
          sourceCode,
          commaToken,
          memberToken
        )) {
          context.report(
            {
              node: member,
              messageId: 'expandMembers',
              fix(fixer: RuleFixer) {
                return fixer.replaceTextRange(
                  [
                    commaToken.range[1],
                    memberToken.range[0]
                  ],
                  `\n${memberIndent}`,
              );
              },
            }
          );
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

      const lastMember = members.at(
        -1
      );
      if (lastMember === null || lastMember === undefined) {
        return;
      }

      const lastToken = sourceCode.getLastToken(
        lastMember
      );
      if (lastToken === null || lastToken === undefined) {
        return;
      }

      const afterLast = sourceCode.getTokenAfter(
        lastToken
      );
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

export default rule;
