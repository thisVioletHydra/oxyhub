import type { Diagnostic, WhipReport } from './types.ts';

import { prefix, root } from './paths.ts';

import path from 'node:path';

export function parseDiagnostics(stdout: string) {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf('{');
  if (start < 0) {
    return null;
  }
  try {
    const payload = JSON.parse(trimmed.slice(start)) as { diagnostics?: Diagnostic[] };

    return Array.isArray(payload.diagnostics) ? payload.diagnostics : [];
  }
  catch {
    return null;
  }
}

export function oxyhubOnly(diagnostics: Diagnostic[]) {
  return diagnostics.filter(item => String(item.code ?? '').startsWith(`${prefix}(`));
}

export function reasonOf(report: WhipReport) {
  if (report.kind === 'crash') {
    return 'plugin crash';
  }
  const first = report.diagnostics[0];
  if (!first) {
    return 'error leftover';
  }
  const severity = first.severity === 'warning' ? 'warning' : 'error';
  const code = String(first.code ?? 'leftover').replace(/^oxyhub\((.+)\)$/, '$1');

  return `${severity} ${code}`;
}

export function parseTscDiagnostics(stdout: string, stderr: string) {
  const diagnostics: Diagnostic[] = [];
  const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/;
  let current: Diagnostic | null = null;

  for (const line of `${stdout}\n${stderr}`.split('\n')) {
    const match = header.exec(line);
    if (match) {
      if (current) {
        diagnostics.push(current);
      }
      const file = match[1].trim().replaceAll('\\', '/');
      current = {
        message: match[5],
        code: `TS${match[4]}`,
        severity: 'error',
        filename: file.startsWith(root) ? path.relative(root, file) : file,
        labels: [{ span: { line: Number(match[2]), column: Number(match[3]) } }],
      };
      continue;
    }
    if (current && /^\s{2}\S/.test(line)) {
      current.message = `${current.message ?? ''} ${line.trim()}`.trim();
    }
  }

  if (current) {
    diagnostics.push(current);
  }
  return diagnostics;
}
