import type { AST, Rule, Scope, SourceCode as ESLintSourceCode } from 'eslint';
import type {
  ArrayExpression,
  ArrayPattern,
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  IfStatement,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportSpecifier,
  Literal,
  MemberExpression,
  Node as ESTreeNode,
  ObjectExpression,
  ObjectPattern,
  Program,
  Property,
  ReturnStatement,
  SwitchStatement,
  UnaryExpression,
  VariableDeclarator,
  WhileStatement,
} from 'estree';

export type RuleModule = Rule.RuleModule;
export type RuleContext = Rule.RuleContext;
export type RuleFixer = Rule.RuleFixer;
export type SourceCode = ESLintSourceCode & {
  getIndexAfterComments?: () => number;
};
export type Token = AST.Token;
export type LintScope = Scope.Scope;
export type LintVariable = Scope.Variable;

export type {
  ArrayExpression,
  ArrayPattern,
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  IfStatement,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportSpecifier,
  Literal,
  MemberExpression,
  ObjectExpression,
  ObjectPattern,
  Program,
  Property,
  ReturnStatement,
  SwitchStatement,
  UnaryExpression,
  VariableDeclarator,
  WhileStatement,
};

export type LintNode = ESTreeNode & {
  parent?: LintNode | null;
  importKind?: 'type' | 'value';
  decorators?: LintNode[];
  typeAnnotation?: LintNode;
  parameter?: LintNode;
  expression?: unknown;
  argument?: unknown;
  body?: unknown;
};

export type FunctionNode =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression;
