import {
  collectChainExpressions,
  getChainLinkRange,
  walkMemberChain,
} from '../utils/chain';
import { getLineIndent, isTokenOnSameLine } from '../utils/function-params';

/** @param {import('estree').Node} node */
function visitChainNodes(node, checkChain) {
  for (const expression of collectChainExpressions(node)) {
    checkChain(expression);
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Disallow blank lines inside a member call chain.',
    },
    fixable: 'whitespace',
    messages: {
      unexpectedBlankLine: 'Unexpected blank line inside this call chain.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkChainLink(objectNode, memberNode) {
      const range = getChainLinkRange(sourceCode, objectNode, memberNode);
      if (!range) {
        return;
      }

      const { linkStart, linkEnd, gapStart, gapEnd } = range;
      const gapText = sourceCode.text.slice(gapStart, gapEnd);
      if (!/\n[\t ]*\n/.test(gapText)) {
        return;
      }

      const baseIndent = getLineIndent(sourceCode, objectNode.loc.start.line);
      const expectedGap = isTokenOnSameLine(sourceCode, linkStart, linkEnd)
        ? ' '
        : `\n${baseIndent}  `;

      context.report({
        node: memberNode.property,
        messageId: 'unexpectedBlankLine',
        fix(fixer) {
          return fixer.replaceTextRange(
            [gapStart, gapEnd],
            expectedGap,
          );
        },
      });
    }

    function checkChain(expression) {
      walkMemberChain(expression, checkChainLink);
    }

    const visitors = {
      ExpressionStatement(node) {
        visitChainNodes(node, checkChain);
      },
      VariableDeclarator(node) {
        visitChainNodes(node, checkChain);
      },
      ReturnStatement(node) {
        visitChainNodes(node, checkChain);
      },
      ArrowFunctionExpression(node) {
        visitChainNodes(node, checkChain);
      },
    };

    return visitors;
  },
};
