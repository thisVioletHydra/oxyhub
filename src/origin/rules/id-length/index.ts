import type { LintNode, RuleModule } from '#plugin-types';

import {
  type IdLengthOptions,
  checkBindingPattern,
  isInsideLetOrConstBinding,
  isLetOrConstDeclarator,
  isTooShort,
} from './pattern.ts';

const DEFAULT_MIN = 2;
const DEFAULT_EXCEPTIONS: string[] = [];
const DEFAULT_EXCEPTION_PATTERNS: string[] = [];

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    deprecated: true,
    docs: {
      description:
        'Enforce minimum identifier length, ignoring let/const bindings. Use prefer-descriptive-binding.',
    },
    messages: {
      tooShort: 'Identifier name is too short (< {{min}}).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          min: {
            type: 'integer',
            minimum: 0
          },
          exceptions: {
            type: 'array',
            items: {
              type: 'string'
            },
            uniqueItems: true,
          },
          exceptionPatterns: {
            type: 'array',
            items: {
              type: 'string'
            },
            uniqueItems: true,
          },
          properties: {
            enum: [
              'always',
              'never'
            ],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const option: {
      min?: number;
      exceptions?: string[];
      exceptionPatterns?: string[];
      properties?: 'always' | 'never';
    } = context.options[0] ?? {};
    const options: IdLengthOptions = {
      min: option.min ?? DEFAULT_MIN,
      exceptions: new Set(option.exceptions ?? DEFAULT_EXCEPTIONS),
      exceptionPatterns: (option.exceptionPatterns ?? DEFAULT_EXCEPTION_PATTERNS).map(
        (pattern: string) => new RegExp(pattern, 'u'),
      ),
      properties: option.properties ?? 'always',
    };

    function reportIfTooShort(node: LintNode) {
      if (node.type !== 'Identifier' || !isTooShort(
        node.name,
        options
      )) {
        return;
      }

      context.report(
        {
          node,
          messageId: 'tooShort',
          data: {
            min: String(
              options.min
            )
          },
        }
      );
    }

    return {
      VariableDeclarator(node) {
        if (isLetOrConstDeclarator(
          node
        )) {
          return;
        }

        checkBindingPattern(
          node.id,
          reportIfTooShort
        );
      },
      FunctionDeclaration(node) {
        if (node.id) {
          reportIfTooShort(
            node.id
          );
        }

        for (const param of node.params) {
          checkBindingPattern(
            param,
            reportIfTooShort
          );
        }
      },
      FunctionExpression(node) {
        if (node.id) {
          reportIfTooShort(
            node.id
          );
        }

        for (const param of node.params) {
          checkBindingPattern(
            param,
            reportIfTooShort
          );
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params) {
          checkBindingPattern(
            param,
            reportIfTooShort
          );
        }
      },
      ClassDeclaration(node) {
        if (node.id) {
          reportIfTooShort(
            node.id
          );
        }
      },
      ClassExpression(node) {
        if (node.id) {
          reportIfTooShort(
            node.id
          );
        }
      },
      CatchClause(node) {
        if (node.param) {
          checkBindingPattern(
            node.param,
            reportIfTooShort
          );
        }
      },
      ImportSpecifier(node) {
        reportIfTooShort(
          node.local
        );
      },
      ImportDefaultSpecifier(node) {
        reportIfTooShort(
          node.local
        );
      },
      ImportNamespaceSpecifier(node) {
        reportIfTooShort(
          node.local
        );
      },
      Property(node) {
        if (options.properties === 'never' || node.computed || node.key.type !== 'Identifier') {
          return;
        }

        if (isInsideLetOrConstBinding(
          node.key
        )) {
          return;
        }

        reportIfTooShort(
          node.key
        );
      },
    };
  },
};

export default rule;
