import type { LintNode, RuleModule } from '#plugin-types';

import { expectedOpenerIndent } from '#layout/indent';

type TypeBody = LintNode & { members?: LintNode[] };
type Edit = { range: [number, number]; text: string };

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: { description: 'Format TypeScript type and interface members using the first member to choose inline or column layout.' },
    fixable: 'code',
    schema: [],
    messages: { layout: 'Align type members and normalize spacing around braces.' },
  },
  create(context) {
    const source = context.sourceCode;

    function check(node: TypeBody): void {
      const members = node.members ?? (Array.isArray(node.body) ? node.body : []);
      const open = source.getFirstToken(node);
      const close = source.getLastToken(node);
      if (open?.value !== '{' || close?.value !== '}') {
        return;
      }

      const edits: Edit[] = [];
      function gap(start: number, end: number, text: string): void {
        const actual = source.text.slice(start, end);
        if (/^\s*$/.test(actual) && actual !== text) {
          edits.push({ range: [start, end], text });
        }
      }

      const before = source.getTokenBefore(open);
      if (before !== null && before.loc.end.line === open.loc.start.line) {
        gap(before.range[1], open.range[0], ' ');
      }

      const first = members[0];
      const firstToken = first === undefined ? null : source.getFirstToken(first);
      const multiline = firstToken !== null && firstToken.loc.start.line > open.loc.end.line;
      const indent = expectedOpenerIndent(source, node, open);
      let previousEnd = open.range[1];

      for (const [index, member] of members.entries()) {
        const token = source.getFirstToken(member);
        const last = source.getLastToken(member);
        if (token === null || last === null) {
          return;
        }

        const separator = index === 0 ? '' : source.text[previousEnd - 1];
        const needsSeparator = index > 0 && separator !== ';' && separator !== ',';
        gap(previousEnd, token.range[0], `${needsSeparator ? ';' : ''}${multiline ? `\n${indent}  ` : ' '}`);
        previousEnd = last.range[1];
        const next = source.getTokenAfter(last);
        if (next?.value === ';' || next?.value === ',') {
          previousEnd = next.range[1];
        }
      }

      gap(previousEnd, close.range[0], members.length === 0 ? '' : multiline ? `\n${indent}` : ' ');
      if (edits.length === 0) {
        return;
      }

      context.report({
        node,
        messageId: 'layout',
        fix(fixer) {
          return edits.map(edit => fixer.replaceTextRange(edit.range, edit.text));
        },
      });
    }

    return { TSTypeLiteral: check, TSInterfaceBody: check };
  },
};

export default rule;
