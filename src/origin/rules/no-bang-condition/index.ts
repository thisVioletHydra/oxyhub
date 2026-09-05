import type { Expression, IfStatement, LintNode, RuleFixer, RuleModule, SourceCode, UnaryExpression } from '#plugin-types';

function getBangExpression(node: LintNode): UnaryExpression | null {
  if (node.type === 'UnaryExpression' && node.operator === '!' && node.prefix) {
    return node;
  }

  return null;
}

function unwrap(node: LintNode): LintNode {
  const type: string = node.type;

  if (type === 'ParenthesizedExpression') {
    return unwrap(
      node.expression as LintNode
    );
  }

  if (type === 'AwaitExpression') {
    return unwrap(
      node.argument as LintNode
    );
  }

  if (type === 'ChainExpression') {
    return unwrap(
      node.expression as LintNode
    );
  }

  if (
    type === 'TSAsExpression'
    || type === 'TSSatisfiesExpression'
    || type === 'TSNonNullExpression'
    || type === 'TSTypeAssertion'
  ) {
    return unwrap(
      node.expression as LintNode
    );
  }

  return node;
}

function nameLooksBoolean(name: string) {
  return (
    /^(is|are|was|were|has|have|can|should|did|does|check)/iu.test(
      name
    )
    || /^(ok|exists|empty|ready|enabled|disabled|visible|hidden|valid|invalid|loading|pending|open|closed|active)$/iu.test(
      name
    )
    || /exist/iu.test(
      name
    )
  );
}

function calleeLooksBoolean(callee: LintNode) {
  if (callee.type === 'Identifier') {
    return nameLooksBoolean(
      callee.name
    );
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

    return nameLooksBoolean(
      propertyName
    );
  }

  return false;
}

/**
 * Already a boolean expression — `!` is fine.
 */
function isDefinitelyBooleanExpression(node: LintNode): boolean {
  const value = unwrap(
    node
  );

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
    return isDefinitelyBooleanExpression(
      value.argument as LintNode
    );
  }

  if (value.type === 'LogicalExpression') {
    return (
      isDefinitelyBooleanExpression(
        value.left as LintNode
      )
      && isDefinitelyBooleanExpression(
        value.right as LintNode
      )
    );
  }

  if (value.type === 'ConditionalExpression') {
    return (
      isDefinitelyBooleanExpression(
        value.consequent as LintNode
      )
      && isDefinitelyBooleanExpression(
        value.alternate as LintNode
      )
    );
  }

  if (value.type === 'CallExpression') {
    return calleeLooksBoolean(
      value.callee as LintNode
    );
  }

  if (value.type === 'Identifier') {
    return nameLooksBoolean(
      value.name
    );
  }

  if (
    value.type === 'MemberExpression'
    && value.computed === false
    && value.property.type === 'Identifier'
  ) {
    return nameLooksBoolean(
      value.property.name
    );
  }

  return false;
}

/**
 * Safe local replace only — never rewrite surrounding control flow.
 */
function renderNullishCheck(
  argument: Expression,
  sourceCode: SourceCode
) {
  const argumentText = sourceCode.getText(
    argument
  );
  const needsParens = argument.type !== 'Identifier'
    && argument.type !== 'MemberExpression'
    && argument.type !== 'CallExpression'
    && argument.type !== 'ChainExpression';

  const left = needsParens
    ? `(${argumentText})`
    : argumentText;
  return `${left} === null || ${left} === undefined`;
}

const rule: RuleModule = {
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

    function checkIfStatement(node: IfStatement) {
      const bang = getBangExpression(
        node.test as LintNode
      );
      if (bang === null || bang === undefined) {
        return;
      }

      if (isDefinitelyBooleanExpression(
        bang.argument as LintNode
      )) {
        return;
      }

      context.report(
        {
          node: bang,
          messageId: 'noBangCondition',
          fix(fixer: RuleFixer) {
            return fixer.replaceText(
              bang,
              renderNullishCheck(
                bang.argument,
                sourceCode
              ),
          );
          },
        }
      );
    }

    return {
      IfStatement: checkIfStatement,
    };
  },
};

export default rule;
