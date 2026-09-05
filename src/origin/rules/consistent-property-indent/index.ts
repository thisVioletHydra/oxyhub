import type { LintNode, RuleFixer, RuleModule, SourceCode, Token } from '#plugin-types';

import { getLineIndent, isTokenOnSameLine } from '#utils/function-params';

function getOpeningDelimiter(
  sourceCode: SourceCode,
  node: LintNode
) {
  if (node.type === 'ArrayExpression') {
    return sourceCode.getFirstToken(
      node,
      (token: Token) => token.value === '['
    );
  }

  const type: string = node.type;
  if (type === 'TSTypeLiteral' || node.type === 'ObjectExpression') {
    return sourceCode.getFirstToken(
      node,
      (token: Token) => token.value === '{'
    );
  }

  if (type === 'TSInterfaceBody' || node.type === 'ClassBody') {
    return sourceCode.getFirstToken(
      node
    );
  }

  return null;
}

function getMembers(node: LintNode): LintNode[] {
  if (node.type === 'ArrayExpression') {
    return node.elements.filter(
      (element): element is NonNullable<(typeof node.elements)[number]> =>
        element !== null
    );
  }

  const type: string = node.type;
  if (type === 'TSTypeLiteral') {
    return (node as LintNode & { members?: LintNode[] }).members ?? [];
  }

  if (node.type === 'ObjectExpression') {
    return node.properties ?? [];
  }

  if (type === 'TSInterfaceBody' || node.type === 'ClassBody') {
    const {
      body
    } = node;
    return Array.isArray(
      body
    )
      ? body
      : [];
  }

  return [];
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Align object/array members to the opening `{` or `[` indent plus two spaces.',
    },
    fixable: 'whitespace',
    messages: {
      inconsistentPropertyIndent:
        'Member indent must match sibling entries in this block.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkMemberBlock(node: LintNode) {
      const members = getMembers(
        node
      );
      if (members.length === 0) {
        return;
      }

      const openDelimiter = getOpeningDelimiter(
        sourceCode,
        node
      );
      if (openDelimiter === null || openDelimiter === undefined) {
        return;
      }

      const memberIndent = `${getLineIndent(
        sourceCode,
        openDelimiter.loc.start.line
      )}  `;

      for (const member of members) {
        if (member.type === 'SpreadElement' || member.type === 'RestElement') {
          continue;
        }

        const firstToken = sourceCode.getFirstToken(
          member
        );
        if (!firstToken || isTokenOnSameLine(
          sourceCode,
          openDelimiter,
          firstToken
        )) {
          continue;
        }

        const lineNumber = member.loc!.start.line;
        const actualIndent = getLineIndent(
          sourceCode,
          lineNumber
        );
        if (actualIndent === memberIndent) {
          continue;
        }

        const lineStart = sourceCode.getIndexFromLoc(
          {
            line: lineNumber,
            column: 0,
          }
        );
        const memberStart = sourceCode.getIndexFromLoc(
          member.loc!.start
        );

        context.report(
          {
            node: member,
            messageId: 'inconsistentPropertyIndent',
            fix(fixer: RuleFixer) {
              return fixer.replaceTextRange(
                [
                  lineStart,
                  memberStart
                ],
                memberIndent,
            );
            },
          }
        );
      }
    }

    return {
      ArrayExpression: checkMemberBlock,
      ObjectExpression: checkMemberBlock,
      TSTypeLiteral: checkMemberBlock,
      TSInterfaceBody: checkMemberBlock,
      ClassBody: checkMemberBlock,
    };
  },
};

export default rule;
