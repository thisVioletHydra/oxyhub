import type { RuleFixer, RuleModule } from '#plugin-types';

import { KNOWN_NODE_DEFAULT_NAMES } from '#imports/specifiers';

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require conventional default import names for common node: modules.',
    },
    fixable: 'code',
    messages: {
      wrongDefaultName:
        'Import "{{source}}" as `{{expected}}`, not `{{actual}}`.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string') {
          return;
        }

        const expected = KNOWN_NODE_DEFAULT_NAMES[node.source.value];
        if (expected === undefined) {
          return;
        }

        const defaultSpecifier = node.specifiers.find(
          (specifier) => specifier.type === 'ImportDefaultSpecifier',
        );

        if (defaultSpecifier === null || defaultSpecifier === undefined) {
          return;
        }

        if (defaultSpecifier.local.name === expected) {
          return;
        }

        context.report(
          {
            node: defaultSpecifier,
            messageId: 'wrongDefaultName',
            data: {
              source: node.source.value,
              expected,
              actual: defaultSpecifier.local.name,
            },
            fix(fixer: RuleFixer) {
              return fixer.replaceText(
                defaultSpecifier.local,
                expected
              );
            },
          }
        );
      },
    };
  },
};

export default rule;
