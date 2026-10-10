<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <img src="assets/banner-light.svg" alt="Oxyhub" width="380">
  </picture>
</h1>

<p align="center">

[![npm version](https://img.shields.io/npm/v/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![npm downloads](https://img.shields.io/npm/dm/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![node](https://img.shields.io/node/v/@oxyhub/oxlint-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@oxyhub/oxlint-plugin)
[![license](https://img.shields.io/npm/l/@oxyhub/oxlint-plugin.svg?style=flat-square)](./LICENSE)

</p>

Oxyhub extends Oxlint with the ESLint rules it still lacks. You keep Oxlint's strength, power, and speed; as Oxlint grows, those borrowed rules leave this plugin.

> Rule ids start with `oxyhub/`

[Changelog](./CHANGELOG.md)

## Requirements

- [Oxlint](https://oxc.rs) `^1.79.0`
- Node.js `>=24`

## Install

```bash
pnpm add -D oxlint @oxyhub/oxlint-plugin
```

## Configuration

Create `oxlint.config.ts`. Do not list `oxyhub/*` rules. Do not use `.oxlintrc.json`.

```ts
import { defineConfig } from 'oxlint';

import oxyhub from '@oxyhub/oxlint-plugin/config';

export default defineConfig({
  extends: [oxyhub],
});
```

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix"
  }
}
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

## Rules (25)

### Problem (2)

Bugs. Default: `error`.

| Rule | Description |
| --- | --- |
| `no-bang-condition` | `!` only on real booleans. Token getters fix to `=== null`; anything else to a full nullish check. |
| `no-floating-promise` | Floating promise chains need `.catch`, `void`, `await`, or `return`. |

### Convention (8)

How to write TypeScript. Default: `error`.

| Rule | Description |
| --- | --- |
| `prefer-descriptive-binding` | No `e`/`err`/`el`/`i` in params, catch, loops. No bindings named after builtins (`filter`, `object`, `prototype`, `constructor`, `require`). `f` in `.map((f) =>` is fine. |
| `prefer-object-arrow-method` | Object methods as `key: (args) => {}`, not `key() {}`. |
| `prefer-process-import` | Use `import process from "node:process"` instead of the global. |
| `prefer-fs-promises` | Prefer `fsPromises` over blocking `fs` sync methods. |
| `prefer-node-default-name` | Conventional default import names (`process`, `path`, `fs`, `fsPromises`). |
| `no-node-named-import` | No named value imports from `node:` builtins. |
| `no-overloaded-if` | At most 3 checks in an `if`. Four or more: extract a named predicate. |
| `semi` | Require semicolons. |

### Layout (15)

Indent, wrapping, blank lines. All layout rules default to `warn` and remain autofixable, including JSX layout, imports, and semicolons. Rules marked `meta.type: 'layout'` automatically use this severity in the base config.

| Rule | Description |
| --- | --- |
| `consistent-block-indent` | Indent blocks, split same-line statements, clean leftover whitespace. |
| `consistent-call-arguments` | Call args stay inline, or wrap when the first arg starts on its own line after `(`. |
| `consistent-chain-layout` | Break only method calls (`.foo()`). Property paths (`a.b.c`) stay inline. |
| `consistent-clause-layout` | `catch`, `else`, `else if`, and `finally` stay on the same line as `}`. |
| `consistent-condition-spacing` | Collapse extra whitespace in single-line `if` / `while` / `switch` tests. |
| `consistent-jsx-layout` | Align JSX nesting; preserve inline or column layout for up to three props, require a column from four props. |
| `consistent-object-layout` | Object/array/destructure stay inline, or wrap when the first member starts on its own line after `{` / `[`. |
| `consistent-parameter-layout` | Multiline params only when a parameter starts on its own line after `(`. |
| `consistent-property-indent` | Align object/array members to the opening `{` / `[` indent plus two spaces. |
| `consistent-ternary-layout` | Ternaries stay inline, or wrap when `?` starts on its own line. |
| `import-layout` | Imports at the top: type → named → default → side-effect. |
| `no-blank-lines-in-arrow-expression` | No blank line between `=>` and an expression body. |
| `no-blank-lines-in-chain` | No blank lines inside a member call chain. |
| `padding-line-before-decorator` | Blank line before a decorator, unless stacked on another decorator. |
| `padding-line-before-return` | Blank line before `return` / `throw` after another statement; no padding at the start of a block. |
| `padding-line-between-statements` | Blank line after control flow when another statement follows, and before `for` / `for…of` / `for…in`, including after bindings. |

## Settings

Recommended also turns on oxlint `max-lines` at **300**. That is core oxlint, not `oxyhub/*`.

## License

[MIT](./LICENSE)
