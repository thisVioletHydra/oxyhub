export async function readState(): Promise<string> {
  let text: string;
  try {
    text = await readFile();
  }
  catch {
    return '';
  }

  return text;
}

async function readFile(): Promise<string> {
  return '';
}
