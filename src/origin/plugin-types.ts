import type { AST, Rule, Scope, SourceCode as ESLintSourceCode } from 'eslint';
import type { Node as ESTreeNode } from 'estree';

export type RuleModule = Rule.RuleModule;
export type RuleContext = Rule.RuleContext;
export type RuleFixer = Rule.RuleFixer;
export type SourceCode = ESLintSourceCode & {
  getIndexAfterComments?: () => number;
};
export type Token = AST.Token;
export type LintScope = Scope.Scope;
export type LintVariable = Scope.Variable;

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
  | import('estree').FunctionDeclaration
  | import('estree').FunctionExpression
  | import('estree').ArrowFunctionExpression;
