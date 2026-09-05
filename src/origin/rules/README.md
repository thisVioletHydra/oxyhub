# Rules

Каждое правило — папка `src/origin/rules/<id>/`. Код и правда про опции живут в `index.ts` (`meta.docs`, `schema`). Сиды для punish — `src/painRoom/<id>/`, не сюда.

README на каждое правило не заводим: сгниёт. Ищешь по имени папки или по этой таблице.

## Layout

| Rule | What | Options |
| --- | --- | --- |
| `consistent-block-indent` | Indent blocks, split same-line statements, clean leftover whitespace. | — |
| `consistent-call-arguments` | Call args stay inline, or wrap when the first arg starts on its own line after `(`. | — |
| `consistent-chain-layout` | Break only method calls (`.foo()`). Property paths (`a.b.c`) stay inline. | — |
| `consistent-condition-spacing` | Collapse extra whitespace in single-line `if` / `while` / `switch` tests. | — |
| `consistent-object-layout` | Object/array/destructure stay inline, or wrap when the first member starts on its own line after `{` / `[`. | — |
| `consistent-parameter-layout` | Multiline params only when a parameter starts on its own line after `(`. | — |
| `consistent-property-indent` | Align object/array members to the opening `{` / `[` indent plus two spaces. | — |
| `consistent-ternary-layout` | Ternaries stay inline, or wrap when `?` starts on its own line. | — |
| `import-layout` | Imports at the top: type → named → default → side-effect. | — |
| `no-blank-lines-in-arrow-expression` | No blank line between `=>` and an expression body. | — |
| `no-blank-lines-in-chain` | No blank lines inside a member call chain. | — |
| `padding-line-before-decorator` | Blank line before a decorator, unless stacked on another decorator. | — |
| `prefer-object-arrow-method` | Object methods as `key: (args) => {}`, not `key() {}`. Off in dogfood. | — |

## Node.js

| Rule | What | Options |
| --- | --- | --- |
| `prefer-process-import` | `import process from "node:process"` instead of the global. | — |
| `prefer-fs-promises` | Prefer `fsPromises` over blocking `fs` sync methods. | — |
| `prefer-node-default-name` | Conventional default import names (`process`, `path`, `fs`, `fsPromises`). | — |
| `no-node-named-import` | No named value imports from `node:` builtins. | — |

## Language

| Rule | What | Options |
| --- | --- | --- |
| `no-bang-condition` | `!` only on real booleans. No truthiness coercion in `if` tests. | — |
| `no-floating-promise` | Floating promise chains need `.catch`, `void`, `await`, or `return`. | — |
| `id-length` | Minimum identifier length. `let` / `const` bindings ignored. | `min`, `exceptions`, `exceptionPatterns`, `properties` |

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
