import type { LintNode } from '#plugin-types';

export type BindingKind =
  | 'catch'
  | 'for'
  | 'for-in'
  | 'for-of'
  | 'handler'
  | 'iterate'
  | 'param'
  | 'value';

const EVENT_METHODS = new Set([
  'addEventListener',
  'removeEventListener',
  'addListener',
  'removeListener',
  'prependListener',
  'prependOnceListener',
  'on',
  'once',
  'off',
]);

const ITERATE_METHODS = new Set([
  'map',
  'filter',
  'forEach',
  'reduce',
  'reduceRight',
  'find',
  'findLast',
  'findIndex',
  'findLastIndex',
  'some',
  'every',
  'flatMap',
]);

export const STOLEN = new Set([
  'obj',
  'object',
  'arr',
  'array',
  'string',
  'number',
  'boolean',
  'undefined',
  'NaN',
  'Infinity',
  'eval',
  'arguments',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Function',
  'Promise',
  'Date',
  'Math',
  'JSON',
  'Error',
  'Symbol',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Proxy',
  'Reflect',
  'RegExp',
  'window',
  'document',
  'globalThis',
  'console',
  '__proto__',
  'prototype',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'global',
  'default',
  'filter',
  'forEach',
  'reduce',
  'reduceRight',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'includes',
  'concat',
  'slice',
  'splice',
  'join',
  'sort',
  'reverse',
  'push',
  'pop',
  'shift',
  'unshift',
  'flat',
  'flatMap',
  'fill',
]);

const DOM_HANDLER = new Set([
  'onclick',
  'onchange',
  'onload',
  'onerror',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onmousedown',
  'onmouseup',
  'oninput',
  'onfocus',
  'onblur',
  'onscroll',
]);

export function suggestedName(name: string, kind: BindingKind) {
  switch (name) {
    case 'e': {
      if (kind === 'catch') {
        return 'error';
      }

      if (kind === 'for-of' || kind === 'iterate') {
        return 'item';
      }

      if (kind === 'for-in') {
        return 'key';
      }

      if (kind === 'for') {
        return null;
      }

      return 'event';
    }
    case 'err':
    case 'er': {
      return 'error';
    }
    case 'el': {
      return 'element';
    }
    case 'i': {
      if (kind === 'for-of' || kind === 'iterate') {
        return 'item';
      }

      if (kind === 'for-in') {
        return 'key';
      }

      return 'index';
    }
    default: {
      return null;
    }
  }
}

function calleeName(node: LintNode | undefined) {
  if (node === undefined) {
    return null;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (
    node.type === 'MemberExpression'
    && node.computed === false
    && node.property.type === 'Identifier'
  ) {
    return node.property.name;
  }

  return null;
}

function isHandlerName(name: string) {
  return (
    /^on[A-Z]/.test(name)
    || name.endsWith('Handler')
    || name.endsWith('Listener')
    || DOM_HANDLER.has(name)
  );
}

function keyName(node: LintNode | undefined) {
  if (node === undefined || node.type !== 'Identifier') {
    return null;
  }

  return node.name;
}

export function functionKind(node: LintNode): BindingKind {
  const parent = node.parent;
  if (parent === undefined || parent === null) {
    return 'param';
  }

  if (parent.type === 'CallExpression') {
    const args = parent.arguments ?? [];
    if (args.includes(node as never)) {
      const name = calleeName(parent.callee as LintNode);
      if (name !== null && EVENT_METHODS.has(name)) {
        return 'handler';
      }

      if (name !== null && ITERATE_METHODS.has(name)) {
        return 'iterate';
      }
    }
  }

  if (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') {
    const name = keyName((parent as LintNode & { key?: LintNode }).key);
    if (name !== null && isHandlerName(name)) {
      return 'handler';
    }
  }

  if (parent.type === 'AssignmentExpression' && parent.right === node) {
    const left = parent.left as LintNode;
    if (
      left.type === 'MemberExpression'
      && left.computed === false
      && left.property.type === 'Identifier'
      && isHandlerName(left.property.name)
    ) {
      return 'handler';
    }
  }

  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier' && isHandlerName(parent.id.name)) {
    return 'handler';
  }

  return 'param';
}
