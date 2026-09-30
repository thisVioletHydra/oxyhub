export function pick(flag: boolean, other: boolean) {
  if (flag) {
    return 1;
  } else if (other) {
    return 2;
  } else {
    return 3;
  }
}

export async function readState(): Promise<string> {
  let text: string;
  try {
    text = await readFile();
  } catch {
    return '';
  } finally {
    text = '';
  }

  return text;
}

async function readFile(): Promise<string> {
  return '';
}
