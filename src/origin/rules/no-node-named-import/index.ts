import type { LintNode, RuleFixer, RuleModule } from '#plugin-types';

import {
  hasNamedValueImport,
  isNodeValueImport,
} from '#imports/specifiers';

import { buildFixes } from './rewrite.ts';

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow named value imports from node: built-ins.',
    },
    fixable: 'code',
    messages: {
      noNamedNodeImport:
        'Use a default import for node: modules (e.g. `import fs from "node:fs"`), not destructuring.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let fixed = false;

    return {
      ImportDeclaration(node) {
        if (!isNodeValueImport(
          node
        ) || !hasNamedValueImport(
          node
        )) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type !== 'ImportSpecifier'
            || (specifier as LintNode).importKind === 'type'
          ) {
            continue;
          }

          context.report(
            {
              node: specifier,
              messageId: 'noNamedNodeImport',
              fix(fixer: RuleFixer) {
                if (fixed) {
                  return null;
                }

                fixed = true;
                return buildFixes(
                  sourceCode,
                  fixer,
                  sourceCode.ast
                );
              },
            }
          );
        }
      },
    };
  },
};

export default rule;
