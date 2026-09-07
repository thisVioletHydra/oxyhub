export type RuleItem = {
  id: string;
  options: object | undefined;
};

export type Diagnostic = {
  message?: string;
  code?: string;
  severity?: string;
  filename?: string;
  labels?: Array<{ span?: { line?: number; column?: number } }>;
};

export type WhipReport = {
  kind: 'clean' | 'dirty' | 'crash';
  diagnostics: Diagnostic[];
  stderr: string;
};

export type PunishCache = {
  rules: Record<string, RuleCacheEntry>;
};

export type RuleCacheEntry = {
  hash: string;
  mtime: number;
  passedAt: string;
};

export type FileKind = 'index' | 'rule' | 'layout' | 'imports' | 'other';
