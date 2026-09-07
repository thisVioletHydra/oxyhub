import type { LintNode, RuleContext, RuleFixer, RuleModule } from '#plugin-types';

import {
  blankLineInsert,
  enclosingFunction,
  isExitStatement,
  isSimpleStatement,
  statementList,
} from '#layout/statements';

function checkList(context: RuleContext, list: LintNode[]) {
  for (const [index, current] of list.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = list[index - 1];
    if (previous === undefined || current === undefined) {
      continue;
    }

    if (isExitStatement(current)) {
      continue;
    }

    if (isSimpleStatement(previous)) {
      continue;
    }

    const insert = blankLineInsert(context.sourceCode.text, previous, current);
    if (insert === null) {
      continue;
    }

    context.report({
      node: current,
      messageId: 'missingBlankLine',
      fix(fixer: RuleFixer) {
        return fixer.insertTextAfterRange(insert.prevRange, insert.text);
      },
    });
  }
}

function checkContainer(context: RuleContext, node: LintNode) {
  if (node.type !== 'StaticBlock' && enclosingFunction(node) === null) {
    return;
  }

  const list = statementList(node);
  if (list === null) {
    return;
  }

  checkList(context, list);
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require a blank line after if / for / try / switch / etc. when another statement follows.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this statement.',
    },
    schema: [],
  },
  create(context) {
    return {
      BlockStatement(node: LintNode) {
        checkContainer(context, node);
      },
      StaticBlock(node: LintNode) {
        checkContainer(context, node);
      },
      SwitchCase(node: LintNode) {
        checkContainer(context, node);
      },
    };
  },
};

export default rule;
