/**
 * @param {import('estree').Node} node
 * @returns {import('estree').UnaryExpression | null}
 */
function getBangExpression(node) {
  if (node.type === 'UnaryExpression' && node.operator === '!' && node.prefix) {
    return node;
  }

  return null;
}

/** @param {import('estree').Node} node */
function unwrap(node) {
  if (node.type === 'ParenthesizedExpression') {
    return unwrap(node.expression);
  }

  if (node.type === 'AwaitExpression') {
    return unwrap(node.argument);
  }

  if (node.type === 'ChainExpression') {
    return unwrap(node.expression);
  }

  if (
    node.type === 'TSAsExpression'
    || node.type === 'TSSatisfiesExpression'
    || node.type === 'TSNonNullExpression'
    || node.type === 'TSTypeAssertion'
  ) {
    return unwrap(node.expression);
  }

  return node;
}

/** @param {string} name */
function nameLooksBoolean(name) {
  return (
    /^(is|are|was|were|has|have|can|should|did|does|check)/iu.test(name)
    || /^(ok|exists|empty|ready|enabled|disabled|visible|hidden|valid|invalid|loading|pending|open|closed|active)$/iu.test(name)
    || /exist/iu.test(name)
  );
}

/** @param {import('estree').Node} callee */
function calleeLooksBoolean(callee) {
  if (callee.type === 'Identifier') {
    return nameLooksBoolean(callee.name);
  }

  if (
    callee.type === 'MemberExpression'
    && callee.computed === false
    && callee.property.type === 'Identifier'
  ) {
    const propertyName = callee.property.name;
    if (
      /^(test|includes|startsWith|endsWith|has|hasOwn|hasOwnProperty|isFile|isDirectory|exists|every|some)$/u.test(
        propertyName,
      )
    ) {
      return true;
    }

    return nameLooksBoolean(propertyName);
  }

  return false;
}

/**
 * Already a boolean expression — `!` is fine.
 *
 * @param {import('estree').Node} node
 */
function isDefinitelyBooleanExpression(node) {
  const value = unwrap(node);

  if (value.type === 'Literal') {
    return value.value === true || value.value === false;
  }

  if (value.type === 'BinaryExpression') {
    return (
      value.operator === '==='
      || value.operator === '!=='
      || value.operator === '=='
      || value.operator === '!='
      || value.operator === '<'
      || value.operator === '>'
      || value.operator === '<='
      || value.operator === '>='
      || value.operator === 'in'
      || value.operator === 'instanceof'
    );
  }

  if (value.type === 'UnaryExpression' && value.operator === '!') {
    return isDefinitelyBooleanExpression(value.argument);
  }

  if (value.type === 'LogicalExpression') {
    return (
      isDefinitelyBooleanExpression(value.left)
      && isDefinitelyBooleanExpression(value.right)
    );
  }

  if (value.type === 'ConditionalExpression') {
    return (
      isDefinitelyBooleanExpression(value.consequent)
      && isDefinitelyBooleanExpression(value.alternate)
    );
  }

  if (value.type === 'CallExpression') {
    return calleeLooksBoolean(value.callee);
  }

  if (value.type === 'Identifier') {
    return nameLooksBoolean(value.name);
  }

  if (
    value.type === 'MemberExpression'
    && value.computed === false
    && value.property.type === 'Identifier'
  ) {
    return nameLooksBoolean(value.property.name);
  }

  return false;
}

/**
 * Safe local replace only — never rewrite surrounding control flow.
 *
 * @param {import('estree').Expression} argument
 * @param {import('eslint').SourceCode} sourceCode
 */
function renderNullishCheck(argument, sourceCode) {
  const argumentText = sourceCode.getText(argument);
  const needsParens = argument.type !== 'Identifier'
    && argument.type !== 'MemberExpression'
    && argument.type !== 'CallExpression'
    && argument.type !== 'ChainExpression';

  const left = needsParens ? `(${argumentText})` : argumentText;
  return `${left} === null || ${left} === undefined`;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Allow `!` only on real booleans; ban truthiness coercion in `if` tests.',
    },
    fixable: 'code',
    messages: {
      noBangCondition:
        'Do not use `!` for truthiness. Use an explicit nullish check instead of deleting control flow.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkIfStatement(node) {
      const bang = getBangExpression(node.test);
      if (!bang) {
        return;
      }

      if (isDefinitelyBooleanExpression(bang.argument)) {
        return;
      }

      context.report({
        node: bang,
        messageId: 'noBangCondition',
        fix(fixer) {
          return fixer.replaceText(
            bang,
            renderNullishCheck(bang.argument, sourceCode),
          );
        },
      });
    }

    return {
      IfStatement: checkIfStatement,
    };
  },
};
