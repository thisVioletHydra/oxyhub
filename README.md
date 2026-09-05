# @oxyhub/oxlint-plugin

Oxlint JS plugin: layout, Node.js imports, identifiers, and boolean conditions.

Prefix: `oxyhub/`.

## Install

```bash
pnpm add -D oxlint @oxyhub/oxlint-plugin
```

This repo dogfoods itself with `pnpm lint` (workspace link → `dist`, then oxlint on `src/origin`).

Rule work: [painRoom](src/painRoom/). Map of rules: [src/origin/rules](src/origin/rules/README.md). `pnpm punish` — clone in `src/arthouse`, one rule at a time. `pnpm punish:once` — same queue, first leftover kills CI. `pnpm test` — seeds against origin.

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

## License

MIT
