import { spawn, type ChildProcess } from 'node:child_process';

import { root } from './paths.ts';

let currentChild: ChildProcess | null = null;

export function killCurrentChild() {
  currentChild?.kill('SIGINT');
}

export function run(command: string, args: string[], cwd = root) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    currentChild = child;
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error: Error) => {
      if (currentChild === child) {
        currentChild = null;
      }
      reject(error);
    });
    child.on('close', (code: number | null) => {
      if (currentChild === child) {
        currentChild = null;
      }
      resolve({
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}
