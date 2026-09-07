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

function blockList(node: LintNode): LintNode[] | null {
  if (node.type === 'BlockStatement' || node.type === 'Program') {
    return node.body as LintNode[];
  }
  if (node.type === 'SwitchCase') {
    return (node as LintNode & { consequent?: LintNode[] }).consequent ?? null;
  }

  return null;
}

function nodeIndex(list: LintNode[], node: LintNode) {
  const byRef = list.indexOf(node);
  if (byRef >= 0) {
    return byRef;
  }

  return list.findIndex(item => item.range?.[0] === node.range?.[0]);
}

function ancestorInList(node: LintNode, list: LintNode[]): LintNode | null {
  let current: LintNode | null | undefined = node;
  while (current !== null && current !== undefined) {
    const index = nodeIndex(list, current);
    if (index >= 0) {
      return list[index] ?? null;
    }
    current = current.parent ?? null;
  }

  return null;
}

function findInitFromSiblings(identifier: LintNode & { name?: string }): LintNode | null {
  const name = identifier.name;
  if (name === undefined) {
    return null;
  }

  let current: LintNode | null | undefined = identifier.parent ?? null;
  while (current !== null && current !== undefined) {
    const list = blockList(current);
    if (list !== null) {
      const owner = ancestorInList(identifier, list);
      const ownerIndex = owner === null ? list.length : nodeIndex(list, owner);
      for (let index = ownerIndex - 1; index >= 0; index -= 1) {
        const stmt = list[index];
        if (stmt?.type !== 'VariableDeclaration') {
          continue;
        }
        const declarators = (stmt as LintNode & {
          declarations: Array<{ id: LintNode & { name?: string }; init?: LintNode | null }>;
        }).declarations;
        for (let decIndex = declarators.length - 1; decIndex >= 0; decIndex -= 1) {
          const declarator = declarators[decIndex];
          if (
            declarator.id.type === 'Identifier'
            && declarator.id.name === name
            && declarator.init !== null
            && declarator.init !== undefined
          ) {
            return unwrap(declarator.init);
          }
        }
      }
    }
    current = current.parent ?? null;
  }

  return null;
}

function resolveExpressionOrigin(node: LintNode): LintNode {
  const value = unwrap(node);
  if (value.type !== 'Identifier') {
    return value;
  }
  const init = findInitFromSiblings(value);
  if (init === null) {
    return value;
  }

  return init;
}

function getCalleeName(node: LintNode): string | null {
  if (node.type !== 'CallExpression') {
    return null;
  }
  const callee = node.callee as LintNode;
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression'
    && callee.computed === false
    && callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }

  return null;
}

/**
 * Token cursors are `T | null`. Everything else stays a full nullish check.
 */
function missingSentinel(node: LintNode): 'null' | 'both' {
  const name = getCalleeName(resolveExpressionOrigin(node));
  if (name !== null && /Token/u.test(name)) {
    return 'null';
  }

  return 'both';
}

function isUndefinedIdentifier(node: LintNode) {
  return node.type === 'Identifier' && node.name === 'undefined';
}

function splitEqAbsence(node: LintNode): { expression: LintNode; sentinel: 'null' | 'undefined' } | null {
  const value = unwrap(node);
  if (value.type !== 'BinaryExpression' || value.operator !== '===') {
    return null;
  }
  const left = unwrap(value.left as LintNode);
  const right = unwrap(value.right as LintNode);
  if (left.type === 'Literal' && left.value === null) {
    return { expression: right, sentinel: 'null' };
  }
  if (right.type === 'Literal' && right.value === null) {
    return { expression: left, sentinel: 'null' };
  }
  if (isUndefinedIdentifier(left)) {
    return { expression: right, sentinel: 'undefined' };
  }
  if (isUndefinedIdentifier(right)) {
    return { expression: left, sentinel: 'undefined' };
  }

  return null;
}

function splitNullishOr(
  test: LintNode,
  sourceCode: SourceCode,
): LintNode | null {
  const value = unwrap(test);
  if (value.type !== 'LogicalExpression' || value.operator !== '||') {
    return null;
  }
  const left = splitEqAbsence(value.left as LintNode);
  const right = splitEqAbsence(value.right as LintNode);
  if (left === null || right === null || left.sentinel === right.sentinel) {
    return null;
  }
  if (sourceCode.getText(left.expression) !== sourceCode.getText(right.expression)) {
    return null;
  }

  return left.expression;
}

/**
 * Safe local replace only — never rewrite surrounding control flow.
 */
function renderAbsenceCheck(
  argument: Expression,
  sourceCode: SourceCode,
) {
  const argumentText = sourceCode.getText(argument);
  const needsParens = argument.type !== 'Identifier'
    && argument.type !== 'MemberExpression'
    && argument.type !== 'CallExpression'
    && argument.type !== 'ChainExpression';
  const left = needsParens ? `(${argumentText})` : argumentText;
  if (missingSentinel(argument as LintNode) === 'null') {
    return `${left} === null`;
  }

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
      nullNotUndefined:
        'This getter returns null, not undefined.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkIfStatement(node: IfStatement) {
      const bang = getBangExpression(
        unwrap(node.test as LintNode)
      );
      if (bang === null) {
        const expression = splitNullishOr(node.test as LintNode, sourceCode);
        if (expression !== null && missingSentinel(expression) === 'null') {
          const left = sourceCode.getText(expression);
          context.report({
            node: node.test,
            messageId: 'nullNotUndefined',
            fix(fixer: RuleFixer) {
              return fixer.replaceText(node.test, `${left} === null`);
            },
          });
        }

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
              renderAbsenceCheck(
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
