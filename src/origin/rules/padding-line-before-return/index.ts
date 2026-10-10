import type { LintNode, RuleFixer, RuleModule } from '#plugin-types';

import { blankLineInsert, previousStatement } from '#layout/statements';

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require a blank line before return or throw after another statement.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this return or throw.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    function check(node: LintNode): void {
      const previous = previousStatement(node);
      if (previous === null) {
        return;
      }

      const insert = blankLineInsert(sourceCode.text, previous, node);
      if (insert === null) {
        return;
      }

      context.report({
        node,
        messageId: 'missingBlankLine',
        fix(fixer: RuleFixer) {
          return fixer.insertTextAfterRange(insert.prevRange, insert.text);
        },
      });
    }

    return {
      ReturnStatement: check,
      ThrowStatement: check,
    };
  },
};

export default rule;
