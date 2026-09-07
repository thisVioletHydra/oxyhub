import type { ImportDeclaration, RuleFixer, RuleModule } from '#plugin-types';

import {
  getImportGroup,
  getTopImportBlock,
  ImportGroup,
} from '#imports/groups';
import { hasNodeNamedValueImport } from '#imports/specifiers';

const GROUP_ORDER = [
  ImportGroup.TYPE,
  ImportGroup.NAMED,
  ImportGroup.DEFAULT,
  ImportGroup.SIDE_EFFECT,
];

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep imports at the top: type imports, then named, then default, then side-effect.',
    },
    fixable: 'whitespace',
    messages: {
      detachedImport: 'Keep all imports together at the top of the file.',
      wrongImportGroups: 'Messy import order.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function buildImportBlock(imports: ImportDeclaration[]) {
      const chunks: string[] = [];

      for (const group of GROUP_ORDER) {
        const groupImports = imports.filter(
          (node) => getImportGroup(
            node
          ) === group
        );
        if (groupImports.length === 0) {
          continue;
        }

        chunks.push(
          groupImports.map(
            (node) => sourceCode.getText(
              node
            )
          ).join(
            '\n'
          )
        );
      }

      return chunks.join(
        '\n\n'
      );
    }

    return {
      'Program:exit'(node) {
        const block = getTopImportBlock(
          node
        );
        if (block === null || block === undefined) {
          return;
        }

        if (block.detached) {
          context.report(
            {
              node: block.detached,
              messageId: 'detachedImport',
            }
          );
          return;
        }

        const {
          imports
        } = block;
        const expected = buildImportBlock(
          imports
        );
        const actual = sourceCode.text.slice(
          imports[0].range![0],
          imports.at(
            -1
          )!.range![1]
        );

        if (actual === expected) {
          return;
        }

        context.report(
          {
            node: imports[0],
            messageId: 'wrongImportGroups',
            fix: hasNodeNamedValueImport(
              node
            )
              ? null
              : (fixer: RuleFixer) => fixer.replaceTextRange(
                [
                  imports[0].range![0],
                  imports.at(
                    -1
                  )!.range![1]
                ],
                expected,
            ),
          }
        );
      },
    };
  },
};

export default rule;
