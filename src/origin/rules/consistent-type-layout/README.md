# consistent-type-layout

Formats TypeScript object types and interface bodies. If the first member
starts after `{` on the same line, members stay inline. If it starts on a new
line, every member gets its own line with two spaces of indentation.

```ts
type NavigationInput = {
  current: number;
  count: number;
  direction: number;
  enabled?: (index: number) => boolean;
};
```

Enabled as a warning in the base config, with autofix. Member contents,
comments, string literals and type expressions are preserved. Separators
are inserted where joining previously newline-separated members requires them.
