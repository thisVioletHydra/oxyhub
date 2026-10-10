# Rule inspector

From the repository root:

```sh
pnpm inspect
```

Open http://127.0.0.1:4174. Stop with Ctrl+C. Use
`OXYHUB_INSPECTOR_PORT=4175 pnpm inspect` to choose another port.

The single page includes search, language and origin filters, sorting by
name / language overlap / severity / autofix, and sortable language counts.
Click a rule for its summary, implementation description, messages, option
schema and source link. Click a language card to filter the table.

The catalog reads the current source plugin and recommended config. It includes
custom rules and the core rules selected by the preset, including disabled
entries. Language counts include only enabled rules matching the filters.
JS / TS / JSX / TSX are file dialects: counts overlap and must not be added
together. They describe where a rule applies, not how often it fires.

Rule identity, severity, autofix and options come from source metadata.
Russian summaries and language specializations are in `catalog.ts`; new
rules fall back to their metadata descriptions. Restart the server after
editing rule implementations or metadata; frontend files reload on refresh.

No frontend dependencies, CDN assets or external requests. Node 24 serves
the page on localhost and strips the browser TypeScript module's types.
The inspector is a repository development tool, not part of the npm artifact.
