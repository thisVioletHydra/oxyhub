export function weak(isReady: boolean) {
  if (!isReady) {
    return;
  }
}

export function alsoWeak() {
  if (!true) {
    return;
  }
}
