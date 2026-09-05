# @oxyhub/oxlint-plugin

Oxlint JS plugin: layout, Node.js imports, identifiers, and boolean conditions.

Prefix: `oxyhub/`.

## Install

```bash
pnpm add -D oxlint @oxyhub/oxlint-plugin
```

This repo dogfoods itself with `pnpm lint` (workspace link → `dist`, then oxlint on `src/origin`).

Rule work: [painRoom](src/painRoom/). `pnpm punish` — clone in `src/arthouse`, one rule at a time. `pnpm punish:once` — same queue, first leftover kills CI. `pnpm test` — seeds against origin.

## Usage

`.oxlintrc.json`:

```json
{
  "jsPlugins": ["@oxyhub/oxlint-plugin"],
  "rules": {
    "oxyhub/consistent-block-indent": "error",
    "oxyhub/consistent-call-arguments": "error",
    "oxyhub/consistent-chain-layout": "error",
    "oxyhub/consistent-condition-spacing": "error",
    "oxyhub/consistent-object-layout": "error",
    "oxyhub/consistent-parameter-layout": "error",
    "oxyhub/consistent-property-indent": "error",
    "oxyhub/consistent-ternary-layout": "error",
    "oxyhub/id-length": [
      "error",
      {
        "min": 2,
        "exceptions": ["i", "j", "f", "_", "t"],
        "exceptionPatterns": ["^[A-Z]$"],
        "properties": "never"
      }
    ],
    "oxyhub/import-layout": "error",
    "oxyhub/no-bang-condition": "error",
    "oxyhub/no-blank-lines-in-arrow-expression": "error",
    "oxyhub/no-blank-lines-in-chain": "error",
    "oxyhub/no-floating-promise": "error",
    "oxyhub/no-node-named-import": "error",
    "oxyhub/padding-line-before-decorator": "error",
    "oxyhub/prefer-fs-promises": "error",
    "oxyhub/prefer-node-default-name": "error",
    "oxyhub/prefer-object-arrow-method": "error",
    "oxyhub/prefer-process-import": "error"
  }
}
```

## Rules

### Layout

| Rule | What it does |
| --- | --- |
| `consistent-block-indent` | Indent blocks, split same-line statements, clean leftover whitespace. |
| `consistent-call-arguments` | Call args stay inline, or wrap when the first arg starts on its own line after `(`. |
| `consistent-chain-layout` | Break only method calls (`.foo()`). Property paths (`a.b.c`) stay inline. |
| `consistent-condition-spacing` | Collapse extra whitespace in single-line `if` / `while` / `switch` tests. |
| `consistent-object-layout` | Object/array/destructure members stay inline, or wrap when the first member starts on its own line after `{` / `[`. |
| `consistent-parameter-layout` | Multiline params only when a parameter starts on its own line after `(`. |
| `consistent-property-indent` | Align object/array members to the opening `{` / `[` indent plus two spaces. |
| `consistent-ternary-layout` | Ternaries stay inline, or wrap when `?` starts on its own line. |
| `import-layout` | Imports stay at the top: type → named → default → side-effect. |
| `no-blank-lines-in-arrow-expression` | No blank line between `=>` and an expression body. |
| `no-blank-lines-in-chain` | No blank lines inside a member call chain. |
| `padding-line-before-decorator` | Blank line before a decorator, unless it is stacked on another decorator. |
| `prefer-object-arrow-method` | Object methods as `key: (args) => {}`, not `key() {}`. |

### Node.js

| Rule | What it does |
| --- | --- |
| `prefer-process-import` | Use `import process from "node:process"` instead of the global. |
| `prefer-fs-promises` | Prefer `fsPromises` over blocking `fs` sync methods. |
| `prefer-node-default-name` | Conventional default import names (`process`, `path`, `fs`, `fsPromises`). |
| `no-node-named-import` | No named value imports from `node:` builtins. |

### Language

| Rule | What it does |
| --- | --- |
| `no-bang-condition` | `!` only on real booleans. No truthiness coercion in `if` tests. |
| `no-floating-promise` | Floating promise chains need `.catch`, `void`, `await`, or `return`. |
| `id-length` | Minimum identifier length. `let` / `const` bindings are ignored. |

### `id-length` options

```json
{
  "min": 2,
  "exceptions": ["i", "j", "f", "_", "t"],
  "exceptionPatterns": ["^[A-Z]$"],
  "properties": "never"
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `min` | `2` | Minimum name length. |
| `exceptions` | `[]` | Exact names to allow. |
| `exceptionPatterns` | `[]` | Regex strings to allow. |
| `properties` | `"always"` | `"never"` skips object keys. |

## License

MIT
