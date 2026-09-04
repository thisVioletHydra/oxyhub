const DEFAULT_MIN = 2;
const DEFAULT_EXCEPTIONS = [];
const DEFAULT_EXCEPTION_PATTERNS = [];

/** @param {string} name @param {{ min: number, exceptions: Set<string>, exceptionPatterns: RegExp[] }} options */
function isTooShort(name, options) {
  if (name.length >= options.min) {
    return false;
  }

  if (options.exceptions.has(name)) {
    return false;
  }

  return !options.exceptionPatterns.some((pattern) => pattern.test(name));
}

/** @param {import('estree').Node | null | undefined} node */
function isLetOrConstDeclarator(node) {
  return (
    node?.type === 'VariableDeclarator'
    && (node.parent?.kind === 'let' || node.parent?.kind === 'const')
  );
}

/** @param {import('estree').Node} node */
function isInsideLetOrConstBinding(node) {
  let current = node.parent;

  while (current) {
    if (isLetOrConstDeclarator(current)) {
      return true;
    }

    if (
      current.type === 'FunctionDeclaration'
      || current.type === 'FunctionExpression'
      || current.type === 'ArrowFunctionExpression'
      || current.type === 'ClassDeclaration'
      || current.type === 'ClassExpression'
      || current.type === 'CatchClause'
      || current.type === 'ImportDeclaration'
      || current.type === 'ExportNamedDeclaration'
      || current.type === 'Program'
    ) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce minimum identifier length, ignoring let/const bindings.',
    },
    messages: {
      tooShort: 'Identifier name is too short (< {{min}}).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          min: { type: 'integer', minimum: 0 },
          exceptions: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
          exceptionPatterns: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
          properties: {
            enum: ['always', 'never'],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const option = context.options[0] ?? {};
    const options = {
      min: option.min ?? DEFAULT_MIN,
      exceptions: new Set(option.exceptions ?? DEFAULT_EXCEPTIONS),
      exceptionPatterns: (option.exceptionPatterns ?? DEFAULT_EXCEPTION_PATTERNS).map(
        (pattern) => new RegExp(pattern, 'u'),
      ),
      properties: option.properties ?? 'always',
    };

    function reportIfTooShort(node) {
      if (node.type !== 'Identifier' || !isTooShort(node.name, options)) {
        return;
      }

      context.report({
        node,
        messageId: 'tooShort',
        data: { min: String(options.min) },
      });
    }

    function checkBindingPattern(pattern) {
      if (pattern.type === 'Identifier') {
        reportIfTooShort(pattern);
        return;
      }

      if (pattern.type === 'ArrayPattern') {
        for (const element of pattern.elements) {
          if (element) {
            checkBindingPattern(element);
          }
        }
        return;
      }

      if (pattern.type === 'ObjectPattern') {
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            checkBindingPattern(property.argument);
            continue;
          }

          if (property.value) {
            checkBindingPattern(property.value);
          }
        }
        return;
      }

      if (pattern.type === 'AssignmentPattern') {
        checkBindingPattern(pattern.left);
        return;
      }

      if (pattern.type === 'RestElement') {
        checkBindingPattern(pattern.argument);
      }
    }

    return {
      VariableDeclarator(node) {
        if (node.parent?.kind === 'let' || node.parent?.kind === 'const') {
          return;
        }

        checkBindingPattern(node.id);
      },

      FunctionDeclaration(node) {
        if (node.id) {
          reportIfTooShort(node.id);
        }

        for (const param of node.params) {
          checkBindingPattern(param);
        }
      },

      FunctionExpression(node) {
        if (node.id) {
          reportIfTooShort(node.id);
        }

        for (const param of node.params) {
          checkBindingPattern(param);
        }
      },

      ArrowFunctionExpression(node) {
        for (const param of node.params) {
          checkBindingPattern(param);
        }
      },

      ClassDeclaration(node) {
        if (node.id) {
          reportIfTooShort(node.id);
        }
      },

      ClassExpression(node) {
        if (node.id) {
          reportIfTooShort(node.id);
        }
      },

      CatchClause(node) {
        if (node.param) {
          checkBindingPattern(node.param);
        }
      },

      ImportSpecifier(node) {
        reportIfTooShort(node.local);
      },

      ImportDefaultSpecifier(node) {
        reportIfTooShort(node.local);
      },

      ImportNamespaceSpecifier(node) {
        reportIfTooShort(node.local);
      },

      Property(node) {
        if (options.properties === 'never' || node.computed || node.key.type !== 'Identifier') {
          return;
        }

        if (isInsideLetOrConstBinding(node.key)) {
          return;
        }

        reportIfTooShort(node.key);
      },
    };
  },
};
