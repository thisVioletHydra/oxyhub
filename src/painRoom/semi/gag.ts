import path from 'node:path';

export type Name = string;

declare function ready(): void;

export function declared() {}

export class Box {
  value = 1;

  read() {
    return this.value;
  }
}

export function loop(items: string[]) {
  for (const item of items) {
    void item;
  }
}

export function repeat(flag: boolean) {
  do {
    flag = false;
  } while (flag);
}

export default function main() {
  void path;
}
