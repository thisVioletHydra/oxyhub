import { KNOWN_NODE_DEFAULT_NAMES } from '../utils/node-default-import-name';

/** @type {import('eslint').Rule.RuleModule} */
export default {
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

        if (!defaultSpecifier) {
          return;
        }

        if (defaultSpecifier.local.name === expected) {
          return;
        }

        context.report({
          node: defaultSpecifier,
          messageId: 'wrongDefaultName',
          data: {
            source: node.source.value,
            expected,
            actual: defaultSpecifier.local.name,
          },
          fix(fixer) {
            return fixer.replaceText(defaultSpecifier.local, expected);
          },
        });
      },
    };
  },
};
