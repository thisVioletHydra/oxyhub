/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Property} property
 */
function renderPropertyKey(sourceCode, property) {
  if (property.computed) {
    return `[${sourceCode.getText(property.key)}]`;
  }

  return sourceCode.getText(property.key);
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').FunctionExpression} fn
 */
function renderParams(sourceCode, fn) {
  const bodyStart = sourceCode.getFirstToken(fn.body);
  if (!bodyStart) {
    return '()';
  }

  const closeParen = sourceCode.getTokenBefore(bodyStart, (token) => token.value === ')');
  const openParen = sourceCode.getFirstToken(fn, (token) => token.value === '(');

  if (!openParen || !closeParen) {
    return '()';
  }

  return sourceCode.text.slice(openParen.range[0], closeParen.range[1]);
}

/**
 * @param {import('estree').Node} node
 * @param {Set<import('estree').Node>} seen
 */
function usesThis(node, seen = new Set()) {
  if (seen.has(node)) {
    return false;
  }

  seen.add(node);

  if (node.type === 'ThisExpression') {
    return true;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') {
      continue;
    }

    if (value === null || value === undefined || typeof value !== 'object') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child !== null && typeof child === 'object' && 'type' in child && usesThis(child, seen)) {
          return true;
        }
      }
      continue;
    }

    if ('type' in value && value.type !== undefined && usesThis(value, seen)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').FunctionExpression} fn
 */
function renderArrowFunction(sourceCode, fn) {
  const asyncPrefix = fn.async === true ? 'async ' : '';
  const params = renderParams(sourceCode, fn);
  const body = sourceCode.getText(fn.body);
  return `${asyncPrefix}${params} => ${body}`;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require object methods as explicit arrow properties (`key: (args) => {}`).',
    },
    fixable: 'code',
    messages: {
      preferArrowMethod:
        'Use an explicit arrow property (`{{key}}: (...) => {}`) instead of method shorthand.',
      preferArrowFunctionProperty:
        'Use an arrow function (`{{key}}: (...) => {}`) instead of `function`.',
      noGeneratorArrow:
        'Object generator methods cannot be converted to arrows; rewrite manually.',
      noThisArrow:
        'Object method uses `this` and cannot safely become an arrow; rewrite manually.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function reportMethod(property) {
      const fn = property.value;
      if (fn.type !== 'FunctionExpression') {
        return;
      }

      const keyText = renderPropertyKey(sourceCode, property);

      if (fn.generator === true) {
        context.report({
          node: property,
          messageId: 'noGeneratorArrow',
        });
        return;
      }

      if (usesThis(fn)) {
        context.report({
          node: property,
          messageId: 'noThisArrow',
        });
        return;
      }

      const isShorthandMethod = property.method === true;
      context.report({
        node: property,
        messageId: isShorthandMethod ? 'preferArrowMethod' : 'preferArrowFunctionProperty',
        data: { key: keyText },
        fix(fixer) {
          const arrow = renderArrowFunction(sourceCode, fn);
          return fixer.replaceText(property, `${keyText}: ${arrow}`);
        },
      });
    }

    return {
      Property(node) {
        if (node.kind === 'get' || node.kind === 'set') {
          return;
        }

        if (node.value.type !== 'FunctionExpression') {
          return;
        }

        // Shorthand methods, or explicit `key: function () {}`.
        if (node.method === true || node.value.id === null) {
          reportMethod(node);
        }
      },
    };
  },
};
