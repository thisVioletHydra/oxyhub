# painRoom

Punish lives here. `origin` stays frozen until the queue is green.

- **origin** — prod plugin. Bundle and publish.
- **painRoom** — seeds + `punish.ts`. Not whipped.
- **arthouse** — clone. `--fix` and hands happen here. Gitignore only `dist/`, `snap/`, `seeds/`, `state.json`. Oxc LSP needs the clone sources on disk, not gitignored.

`pnpm punish` hangs until Ctrl+C. Hits → `--fix`. Leftover → BLOCKER, snap stays. Restart resumes from the current rule even if origin changed; `--fresh` starts over. Full pass → origin → `pnpm build` (root `dist/`). Restart oxc LSP to pick it up.

`pnpm punish:once` — CI: no watch, no promote, first leftover exits 1.

`pnpm test` runs these seeds against origin.
