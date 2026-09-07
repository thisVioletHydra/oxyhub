# Oxyhub

[![npm version](https://img.shields.io/npm/v/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![npm downloads](https://img.shields.io/npm/dm/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![node](https://img.shields.io/node/v/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![license](https://img.shields.io/npm/l/@oxyhub/oxlint-plugin.svg?style=flat-square)](./LICENSE)

Oxlint JS plugin. One layout, TS conventions (`node:` imports included), no sloppy `if (!x)` or floating promises.

> Rule ids start with `oxyhub/`

## Features

- Highlight messy indent, calls, chains, objects, params, ternaries, and imports
- Force `node:` defaults (`process`, `fsPromises`) instead of globals and sync `fs`
- Ban `!` truthiness in `if` tests and unhandled promise chains
- Autofix where the rule can rewrite the file

```ts
// before
if (!user) {}
fs.readFileSync(file)
fetchUser().then(render)

// after
if (user == null) {}
import fsPromises from 'node:fs/promises'
await fetchUser()
```

## Requirements

- [Oxlint](https://oxc.rs) `^1.79.0`
- Node.js `>=24`

## Install

```bash
pnpm add -D oxlint @oxyhub/oxlint-plugin
```

## Configuration

All plugin rules are on by default. Extend the shipped config, then override only what you want off.

```ts
import { defineConfig } from 'oxlint';

import oxyhub from '@oxyhub/oxlint-plugin/config';

export default defineConfig({
  extends: [oxyhub],
});
```

Turn a rule off only when you have to:

```ts
export default defineConfig({
  extends: [oxyhub],
  rules: {
    'oxyhub/prefer-object-arrow-method': 'off',
  },
});
```

JSON still works: `"extends": ["./node_modules/@oxyhub/oxlint-plugin/recommended.json"]`. One config file per directory — JSON or TS, not both.

## Rules (22)

### Problem (2)

Bugs. Default: `error`.

| Rule | Description |
| --- | --- |
| `no-bang-condition` | `!` only on real booleans. Token getters fix to `=== null`; anything else to a full nullish check. |
| `no-floating-promise` | Floating promise chains need `.catch`, `void`, `await`, or `return`. |

### Convention (6)

How to write TypeScript. Default: `error`.

| Rule | Description |
| --- | --- |
| `id-length` | Minimum identifier length. `let` / `const` bindings are ignored. |
| `prefer-object-arrow-method` | Object methods as `key: (args) => {}`, not `key() {}`. |
| `prefer-process-import` | Use `import process from "node:process"` instead of the global. |
| `prefer-fs-promises` | Prefer `fsPromises` over blocking `fs` sync methods. |
| `prefer-node-default-name` | Conventional default import names (`process`, `path`, `fs`, `fsPromises`). |
| `no-node-named-import` | No named value imports from `node:` builtins. |

### Layout (14)

Indent, wrapping, blank lines. `consistent-*` and blank-in-* default to `error`. `padding-line-*` default to `warn`.

| Rule | Description |
| --- | --- |
| `consistent-block-indent` | Indent blocks, split same-line statements, clean leftover whitespace. |
| `consistent-call-arguments` | Call args stay inline, or wrap when the first arg starts on its own line after `(`. |
| `consistent-chain-layout` | Break only method calls (`.foo()`). Property paths (`a.b.c`) stay inline. |
| `consistent-condition-spacing` | Collapse extra whitespace in single-line `if` / `while` / `switch` tests. |
| `consistent-object-layout` | Object/array/destructure stay inline, or wrap when the first member starts on its own line after `{` / `[`. |
| `consistent-parameter-layout` | Multiline params only when a parameter starts on its own line after `(`. |
| `consistent-property-indent` | Align object/array members to the opening `{` / `[` indent plus two spaces. |
| `consistent-ternary-layout` | Ternaries stay inline, or wrap when `?` starts on its own line. |
| `import-layout` | Imports at the top: type → named → default → side-effect. |
| `no-blank-lines-in-arrow-expression` | No blank line between `=>` and an expression body. |
| `no-blank-lines-in-chain` | No blank lines inside a member call chain. |
| `padding-line-before-decorator` | Blank line before a decorator, unless stacked on another decorator. |
| `padding-line-before-for` | Blank line before `for` / `for-in` / `for-of` unless it is the first statement in the block. |
| `padding-line-before-return` | Blank line before `return` when the function has more than one return. |

## Settings

> Only `oxyhub/id-length` has options. Prefix every id with `oxyhub/`.

| Setting | Default | Description |
| --- | --- | --- |
| `min` | `2` | Minimum identifier length. |
| `exceptions` | `[]` | Exact names to allow. |
| `exceptionPatterns` | `[]` | Regex strings to allow. |
| `properties` | `"always"` | `"never"` skips object keys. |

## License

[MIT](./LICENSE)
