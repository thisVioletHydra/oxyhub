# Rules

Каждое правило — папка `src/origin/rules/<id>/`. Код и опции в `index.ts`. Сиды — `src/painRoom/<id>/`.

Общий код не в свалке `utils/`:

- `src/origin/layout/` — токены, цепочки, список statements. Нужен layout-правилам.
- `src/origin/imports/` — группы import и `node:` specifiers. Это не отдельный «мир Node», а те же TS-файлы.

## Problem

Баги. В recommended — `error`.

| Rule | What |
| --- | --- |
| `no-bang-condition` | `!` only on real booleans. Token getters fix to `=== null`; anything else to a full nullish check. |
| `no-floating-promise` | Floating promise chains need `.catch`, `void`, `await`, or `return`. |

## Convention

Как писать TS. В recommended — `error`.

| Rule | What | Options |
| --- | --- | --- |
| `id-length` | Minimum identifier length. `let` / `const` bindings ignored. | `min`, `exceptions`, `exceptionPatterns`, `properties` |
| `prefer-object-arrow-method` | Object methods as `key: (args) => {}`, not `key() {}`. Off in dogfood. | — |
| `prefer-process-import` | `import process from "node:process"` instead of the global. | — |
| `prefer-fs-promises` | Prefer `fsPromises` over blocking `fs` sync methods. | — |
| `prefer-node-default-name` | Conventional default import names (`process`, `path`, `fs`, `fsPromises`). | — |
| `no-node-named-import` | No named value imports from `node:` builtins. | — |

### `id-length`

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

## Layout

Отступы, переносы, пустые строки. `consistent-*` / blank-in-* в recommended — `error`. `padding-line-*` — `warn`.

| Rule | What |
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
