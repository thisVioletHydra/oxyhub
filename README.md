# @oxyhub/oxlint-plugin

Oxlint JS plugin: layout, Node.js imports, and boolean-condition rules.

## Install

```bash
pnpm add -D oxlint @oxyhub/oxlint-plugin
```

## Usage

`.oxlintrc.json`:

```json
{
  "jsPlugins": ["@oxyhub/oxlint-plugin"],
  "rules": {
    "oxxy/no-bang-condition": "warn",
    "oxxy/prefer-process-import": "error",
    "oxxy/id-length": [
      "error",
      {
        "min": 2,
        "exceptions": ["i", "j", "f", "_", "t"],
        "exceptionPatterns": ["^[A-Z]$"],
        "properties": "never"
      }
    ]
  }
}
```

Rule ids use the `oxxy/` prefix (`meta.name`).

## Publish

First `0.1.0` is interactive (`pnpm publish` + OTP). Later versions: GitHub tag `v*` → Actions + npm Trusted Publisher (OIDC), no publish token.
