import type { ArrowFunctionExpression, ExpressionStatement, LintNode, MemberExpression, ReturnStatement, RuleFixer, RuleModule, VariableDeclarator } from '#plugin-types';

import {
  collectChainExpressions,
  getChainLinkRange,
  walkMemberChain,
} from '#utils/chain';
import { getLineIndent, isTokenOnSameLine } from '#utils/function-params';

function visitChainNodes(
  node: LintNode,
  checkChain: (expression: LintNode) => void
) {
  for (const expression of collectChainExpressions(
    node
  )) {
    checkChain(
      expression
    );
  }
}

const rule: RuleModule = {
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

    function checkChainLink(
      objectNode: LintNode,
      memberNode: MemberExpression
    ) {
      const range = getChainLinkRange(
        sourceCode,
        objectNode,
        memberNode
      );
      if (range === null || range === undefined) {
        return;
      }

      const {
        linkStart,
        linkEnd,
        gapStart,
        gapEnd
      } = range;
      const gapText = sourceCode.text.slice(
        gapStart,
        gapEnd
      );
      if (!/\n[\t ]*\n/.test(
        gapText
      )) {
        return;
      }

      const baseIndent = getLineIndent(
        sourceCode,
        objectNode.loc!.start.line
      );
      const expectedGap = isTokenOnSameLine(
        sourceCode,
        linkStart,
        linkEnd
      )
        ? ' '
        : `\n${baseIndent}  `;

      context.report(
        {
          node: memberNode.property,
          messageId: 'unexpectedBlankLine',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                gapStart,
                gapEnd
              ],
              expectedGap,
          );
          },
        }
      );
    }

    function checkChain(expression: LintNode) {
      walkMemberChain(
        expression,
        checkChainLink
      );
    }

    const visitors = {
      ExpressionStatement(node: ExpressionStatement) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      VariableDeclarator(node: VariableDeclarator) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      ReturnStatement(node: ReturnStatement) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      ArrowFunctionExpression(node: ArrowFunctionExpression) {
        visitChainNodes(
          node,
          checkChain
        );
      },
    };

    return visitors;
  },
};

export default rule;
