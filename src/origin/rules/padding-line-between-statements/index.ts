import type { LintNode, RuleContext, RuleFixer, RuleModule } from '#plugin-types';

import {
  blankLineInsert,
  enclosingFunction,
  isExitStatement,
  isSimpleStatement,
  statementList,
} from '#layout/statements';

function isForLoop(node: LintNode): boolean {
  return node.type === 'ForStatement'
    || node.type === 'ForInStatement'
    || node.type === 'ForOfStatement';
}

function checkList(context: RuleContext, list: LintNode[], loopsOnly = false) {
  for (const [index, current] of list.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = list[index - 1];
    if (previous === undefined || current === undefined) {
      continue;
    }

    if (loopsOnly && !isForLoop(current)) {
      continue;
    }

    if (isExitStatement(current)) {
      continue;
    }

    if (isSimpleStatement(previous) && !isForLoop(current)) {
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
  if (node.type !== 'Program' && node.type !== 'StaticBlock' && enclosingFunction(node) === null) {
    return;
  }

  const list = statementList(node);
  if (list === null) {
    return;
  }

  checkList(context, list, node.type === 'Program');
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Separate control-flow statements from following code and add a blank line before for loops.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this statement.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: LintNode) {
        checkContainer(context, node);
      },
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
