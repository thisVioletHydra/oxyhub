import { getLineIndent, isTokenOnSameLine } from '../utils/function-params';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} node
 */
function getOpeningDelimiter(sourceCode, node) {
  if (node.type === 'ArrayExpression') {
    return sourceCode.getFirstToken(node, (token) => token.value === '[');
  }

  if (node.type === 'TSTypeLiteral' || node.type === 'ObjectExpression') {
    return sourceCode.getFirstToken(node, (token) => token.value === '{');
  }

  if (node.type === 'TSInterfaceBody' || node.type === 'ClassBody') {
    return sourceCode.getFirstToken(node);
  }

  return null;
}

/** @param {import('estree').Node} node */
function getMembers(node) {
  if (node.type === 'ArrayExpression') {
    return node.elements.filter((element) => element !== null);
  }

  if (node.type === 'TSTypeLiteral') {
    return node.members ?? [];
  }

  if (node.type === 'ObjectExpression') {
    return node.properties ?? [];
  }

  if (node.type === 'TSInterfaceBody' || node.type === 'ClassBody') {
    return node.body ?? [];
  }

  return [];
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
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

    function checkMemberBlock(node) {
      const members = getMembers(node);
      if (members.length === 0) {
        return;
      }

      const openDelimiter = getOpeningDelimiter(sourceCode, node);
      if (!openDelimiter) {
        return;
      }

      const memberIndent = `${getLineIndent(sourceCode, openDelimiter.loc.start.line)}  `;

      for (const member of members) {
        if (member.type === 'SpreadElement' || member.type === 'RestElement') {
          continue;
        }

        const firstToken = sourceCode.getFirstToken(member);
        if (!firstToken || isTokenOnSameLine(sourceCode, openDelimiter, firstToken)) {
          continue;
        }

        const lineNumber = member.loc.start.line;
        const actualIndent = getLineIndent(sourceCode, lineNumber);
        if (actualIndent === memberIndent) {
          continue;
        }

        const lineStart = sourceCode.getIndexFromLoc({
          line: lineNumber,
          column: 0,
        });
        const memberStart = sourceCode.getIndexFromLoc(member.loc.start);

        context.report({
          node: member,
          messageId: 'inconsistentPropertyIndent',
          fix(fixer) {
            return fixer.replaceTextRange(
              [lineStart, memberStart],
              memberIndent,
            );
          },
        });
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
