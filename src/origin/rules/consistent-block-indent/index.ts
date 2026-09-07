import type { RuleModule } from '#plugin-types';

import { getLineIndent } from '#layout/tokens';

import {
  type BlockMark,
  type CloseGap,
  type TextEdit,
  collectSameLineSplits,
  markStatement,
  visitBlock,
} from './check.ts';
import {
  type ConditionNode,
  applyBlockIndentFixes,
} from './fix.ts';

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
    const closeGaps: CloseGap[] = [];

    return {
      Program(node) {
        const mark = {
          type: 'program' as const
        };
        collectSameLineSplits(
          sourceCode,
          node.body,
          '',
          edits
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
      BlockStatement(node) {
        visitBlock(
          sourceCode,
          node,
          marks,
          edits,
          closeGaps
        );
      },
      StaticBlock(node) {
        visitBlock(
          sourceCode,
          node,
          marks,
          edits,
          closeGaps
        );
      },
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

        const caseIndent = `${getLineIndent(
          sourceCode,
          caseToken.loc.start.line
        )}  `;
        collectSameLineSplits(
          sourceCode,
          node.consequent.filter(
            (statement) => statement.type !== 'BlockStatement'
          ),
          caseIndent,
          edits
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
        applyBlockIndentFixes(
          context,
          node,
          marks,
          edits,
          closeGaps,
          conditionNodes
        );
      },
    };
  },
};

export default rule;
