import type { LintNode, RuleContext, RuleFixer, RuleModule, Token } from '#plugin-types';

function clauseGap(sourceText: string, previous: Token, keyword: Token) {
  if (previous.value !== '}') {
    return null;
  }

  const start = previous.range[1];
  const end = keyword.range[0];
  const gap = sourceText.slice(start, end);
  if (gap === ' ') {
    return null;
  }

  if (gap !== '' && /[^\s]/.test(gap)) {
    return null;
  }

  return [start, end] as const;
}

function reportClause(context: RuleContext, node: LintNode, keyword: Token) {
  const previous = context.sourceCode.getTokenBefore(keyword);
  if (previous === null || previous === undefined) {
    return;
  }

  const gap = clauseGap(context.sourceCode.text, previous, keyword);
  if (gap === null) {
    return;
  }

  context.report({
    node,
    messageId: 'sameLine',
    data: {
      keyword: keyword.value,
    },
    fix(fixer: RuleFixer) {
      return fixer.replaceTextRange([gap[0], gap[1]], ' ');
    },
  });
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep catch, else, else if, and finally on the same line as the closing brace.',
    },
    fixable: 'whitespace',
    messages: {
      sameLine: 'Expected `} {{keyword}}` on the same line.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CatchClause(node: LintNode) {
        const keyword = sourceCode.getFirstToken(node);
        if (keyword === null || keyword === undefined || keyword.value !== 'catch') {
          return;
        }

        reportClause(context, node, keyword);
      },
      IfStatement(node: LintNode) {
        if (node.type !== 'IfStatement') {
          return;
        }

        const alternate = node.alternate;
        if (alternate === null || alternate === undefined) {
          return;
        }

        const first = sourceCode.getFirstToken(alternate);
        if (first === null || first === undefined) {
          return;
        }

        const keyword = sourceCode.getTokenBefore(first);
        if (keyword === null || keyword === undefined || keyword.value !== 'else') {
          return;
        }

        reportClause(context, node, keyword);
      },
      TryStatement(node: LintNode) {
        if (node.type !== 'TryStatement') {
          return;
        }

        const finalizer = node.finalizer;
        if (finalizer === null || finalizer === undefined) {
          return;
        }

        const open = sourceCode.getFirstToken(finalizer);
        if (open === null || open === undefined) {
          return;
        }

        const keyword = sourceCode.getTokenBefore(open);
        if (keyword === null || keyword === undefined || keyword.value !== 'finally') {
          return;
        }

        reportClause(context, node, keyword);
      },
    };
  },
};

export default rule;
