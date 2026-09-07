export function overloaded(alpha: boolean, beta: boolean, gamma: boolean, delta: boolean) {
  if (alpha || beta || gamma || delta) {
    return true;
  }

  return false;
}
