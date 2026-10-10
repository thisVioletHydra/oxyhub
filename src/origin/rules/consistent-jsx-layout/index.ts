import type { SourceLocation } from 'estree';
import type { RuleModule } from '#plugin-types';

// JSX is a parser extension of ESTree. Only the fields used by this rule
// belong here; expressions and attribute values remain opaque.
type JsxNode = {
  type: string;
  range: [number, number];
  loc: SourceLocation;
  parent?: JsxNode | null;
  name?: JsxNode;
  attributes?: JsxNode[];
  selfClosing?: boolean;
};

type Edit = { range: [number, number]; text: string };

function baseIndent(node: JsxNode): string {
  let depth = 0;
  let ancestor = node.parent;

  while (ancestor !== undefined && ancestor !== null) {
    if (ancestor.type === 'JSXElement' || ancestor.type === 'JSXFragment') {
      return `${baseIndent(ancestor)}  `;
    }

    if (ancestor.type === 'BlockStatement' || ancestor.type === 'StaticBlock') {
      depth += 1;
    }

    ancestor = ancestor.parent;
  }

  const parent = node.parent;
  const continuation = parent !== undefined && parent !== null && node.loc.start.line > parent.loc.start.line;
  return '  '.repeat(depth + (continuation ? 1 : 0));
}

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: { description: 'Use the first prop to choose JSX layout; wrap four or more props.' },
    fixable: 'whitespace',
    schema: [],
    messages: { layout: 'Align JSX nesting and place multiline props in a column.' },
  },
  create(context) {
    const source = context.sourceCode;

    function check(raw: unknown): void {
      const node = raw as JsxNode;
      const container = node.parent;
      if (container === undefined || container === null) {
        return;
      }

      const indent = baseIndent(container);
      const edits: Edit[] = [];

      function whitespace(start: number, end: number, text: string): void {
        const actual = source.text.slice(start, end);
        if (/^[\t \r\n]*$/.test(actual) && actual !== text) {
          edits.push({ range: [start, end], text });
        }
      }

      const lineStart = source.getIndexFromLoc({ line: node.loc.start.line, column: 0 });
      whitespace(lineStart, node.range[0], indent);

      const attributes = node.attributes ?? [];
      const first = attributes[0];
      const multiline = attributes.length >= 4
        || (first !== undefined && node.name !== undefined && first.loc.start.line > node.name.loc.end.line);
      if (node.type === 'JSXOpeningElement' && node.name !== undefined) {
        let previousEnd = node.name.range[1];
        for (const attribute of attributes) {
          whitespace(previousEnd, attribute.range[0], multiline ? `\n${indent}  ` : ' ');
          previousEnd = attribute.range[1];
        }

        const closeStart = node.range[1] - (node.selfClosing === true ? 2 : 1);
        const closeGap = multiline ? `\n${indent}` : node.selfClosing === true ? ' ' : '';
        whitespace(previousEnd, closeStart, closeGap);
      }

      if (edits.length === 0) {
        return;
      }

      context.report({
        loc: node.loc,
        messageId: 'layout',
        fix(fixer) {
          return edits.map(edit => fixer.replaceTextRange(edit.range, edit.text));
        },
      });
    }

    return {
      JSXOpeningElement: check,
      JSXClosingElement: check,
      JSXOpeningFragment: check,
      JSXClosingFragment: check,
    };
  },
};

export default rule;
