import type { LintNode, MemberExpression, RuleFixer, RuleModule } from '#plugin-types';

import {
  collectChainExpressions,
  getChainLinkRange,
  walkMemberChain,
} from '#layout/chain';
import { getLineIndent, isTokenOnSameLine } from '#layout/tokens';

function isMethodLink(memberNode: MemberExpression & { parent?: LintNode | null }) {
  const parent = memberNode.parent;
  return parent?.type === 'CallExpression' && parent.callee === memberNode;
}

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
      description:
        'Column-break only method calls (`.foo()`); property paths (`a.b.c`) stay inline.',
    },
    fixable: 'whitespace',
    messages: {
      collapseChain: 'Property access should stay on one line.',
      expandChain: 'Multiline method chain must place each call on its own line.',
      normalizeChainSpacing: 'Normalize spacing inside this method chain.',
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

    function checkChain(expression: LintNode) {
      const links: Array<{
        objectNode: LintNode;
        memberNode: MemberExpression & { parent?: LintNode | null };
      }> = [];
      walkMemberChain(
        expression,
        (
          objectNode,
          memberNode
        ) => {
          links.push(
            {
              objectNode,
              memberNode
            }
          );
        }
      );

      if (links.length === 0) {
        return;
      }

      const resolved: Array<{
        objectNode: LintNode;
        memberNode: MemberExpression & { parent?: LintNode | null };
        range: NonNullable<ReturnType<typeof getChainLinkRange>>;
        method: boolean;
      }> = [];
      for (const link of links) {
        const range = getChainLinkRange(
          sourceCode,
          link.objectNode,
          link.memberNode
        );
        if (range === null || range === undefined) {
          return;
        }

        resolved.push(
          {
            ...link,
            range,
            method: isMethodLink(
              link.memberNode
            ),
          }
        );
      }

      const firstBrokenMethodIndex = resolved.findIndex(
        (link) =>
          link.method
          && !isTokenOnSameLine(
            sourceCode,
            link.range.linkStart,
            link.range.linkEnd
          ),
      );

      const baseIndent = getLineIndent(
        sourceCode,
        resolved[0].objectNode.loc!.start.line,
      );
      const chainIndent = `${baseIndent}  `;

      for (let index = 0; index < resolved.length; index += 1) {
        const link = resolved[index];

        if (!link.method || firstBrokenMethodIndex === -1 || index < firstBrokenMethodIndex) {
          normalizeGap(
            link.memberNode,
            link.range.gapStart,
            link.range.gapEnd,
            '',
            'collapseChain',
          );
          continue;
        }

        normalizeGap(
          link.memberNode,
          link.range.gapStart,
          link.range.gapEnd,
          `\n${chainIndent}`,
          isTokenOnSameLine(
            sourceCode,
            link.range.linkStart,
            link.range.linkEnd
          )
            ? 'expandChain'
            : 'normalizeChainSpacing',
        );
      }
    }

    return {
      ExpressionStatement(node) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      VariableDeclarator(node) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      ReturnStatement(node) {
        visitChainNodes(
          node,
          checkChain
        );
      },
      ArrowFunctionExpression(node) {
        visitChainNodes(
          node,
          checkChain
        );
      },
    };
  },
};

export default rule;
