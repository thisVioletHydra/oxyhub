import fsPromises from 'node:fs/promises';
import path from 'node:path';

export async function exists(filePath: string) {
  try {
    await fsPromises.access(filePath);

    return true;
  }
  catch {
    return false;
  }
}

export async function writeFileDeep(filePath: string, contents: string | Buffer) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, contents);
}

export async function writeJson(filePath: string, value: unknown) {
  await writeFileDeep(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function emptyDir(dir: string) {
  await fsPromises.rm(dir, { recursive: true, force: true });
  await fsPromises.mkdir(dir, { recursive: true });
}
