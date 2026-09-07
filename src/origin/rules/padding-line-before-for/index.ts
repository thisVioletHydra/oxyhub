import type { LintNode, RuleContext, RuleFixer, RuleModule } from '#plugin-types';

import { hasBlankLine } from '#layout/chain';
import { previousStatement } from '#layout/statements';

function checkFor(context: RuleContext, node: LintNode) {
  const previous = previousStatement(node);
  const prevRange = previous?.range;
  const stmtRange = node.range;
  if (
    previous === null
    || prevRange === null
    || prevRange === undefined
    || stmtRange === null
    || stmtRange === undefined
  ) {
    return;
  }

  const gap = context.sourceCode.text.slice(prevRange[1], stmtRange[0]);
  if (hasBlankLine(gap)) {
    return;
  }

  const sameLine = previous.loc!.end.line === node.loc!.start.line;
  context.report({
    node,
    messageId: 'missingBlankLine',
    fix(fixer: RuleFixer) {
      return fixer.insertTextAfterRange(
        prevRange,
        sameLine ? '\n\n' : '\n',
      );
    },
  });
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require a blank line before for / for-in / for-of when it is not the first statement in the block.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this for loop.',
    },
    schema: [],
  },
  create(context) {
    return {
      ForStatement(node: LintNode) {
        checkFor(context, node);
      },
      ForInStatement(node: LintNode) {
        checkFor(context, node);
      },
      ForOfStatement(node: LintNode) {
        checkFor(context, node);
      },
    };
  },
};

export default rule;
