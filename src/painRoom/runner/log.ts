import type { Diagnostic } from './types.ts';

import { root } from './paths.ts';
import { killCurrentChild } from './run.ts';

import process from 'node:process';
import path from 'node:path';
import url from 'node:url';

const tty = process.stderr.isTTY === true;

export const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  underline: '\x1b[4m',
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clearLine: '\r\x1b[2K',
};

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function paint(color: string, text: string) {
  return `${color}${text}${ansi.reset}`;
}

export function fileLink(relPath: string, line?: number) {
  const abs = path.join(root, relPath);
  const shown = line ? `${relPath}:${line}` : relPath;
  const label = paint(`${ansi.bold}${ansi.magenta}${ansi.underline}`, shown);
  if (tty === null || tty === undefined) {
    return line ? `${abs}:${line}` : abs;
  }
  const href = line ? `${url.pathToFileURL(abs).href}#${line}` : url.pathToFileURL(abs).href;

  return `\x1b]8;;${href}\x1b\\${label}\x1b]8;;\x1b\\`;
}

export function hitLink(diagnostic: Diagnostic) {
  if (diagnostic.filename === null || diagnostic.filename === undefined) {
    return '';
  }

  return fileLink(diagnostic.filename, diagnostic.labels?.[0]?.span?.line);
}

export const spinner = {
  timer: null as ReturnType<typeof setInterval> | null,
  frame: 0,
  text: '',
  start(text: string) {
    this.text = text;
    if (tty === null || tty === undefined) {
      return;
    }
    this.stopTimer();
    process.stderr.write(ansi.hide);
    this.timer = setInterval(() => this.render(), 80);
    this.render();
  },
  render() {
    const frame = frames[this.frame++ % frames.length];
    process.stderr.write(`${ansi.clearLine}${paint(ansi.magenta, frame)} ${this.text}`);
  },
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  stop() {
    this.stopTimer();
    if (tty) {
      process.stderr.write(`${ansi.clearLine}${ansi.show}`);
    }
  },
};

export function log(message: string) {
  spinner.stop();
  process.stderr.write(`${message}\n`);
}

export function die(code = 130): never {
  spinner.stop();
  killCurrentChild();
  process.exit(code);
}
