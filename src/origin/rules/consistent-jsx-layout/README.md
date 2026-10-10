# consistent-jsx-layout

Aligns JSX elements and fragments with two spaces per nesting level. Tags
with three or more props (including spreads) use one prop per line. Existing
multiline tags retain their column layout; shorter single-line tags stay compact.

Enabled automatically by `@oxyhub/oxlint-plugin/config` for JSX and TSX.
No React runtime dependency is needed.

```tsx
return (
  <Providers catalog={session.catalog}>
    <ReaderStatus />
    <Workspace
      catalog={session.catalog}
      dataset={session.dataset}
      onDataset={selectDataset}
    />
  </Providers>
);
```

The fixer changes whitespace around tags and between props. It does not
rewrite attribute values, expressions, or text children, and never splits
inline text such as `<p>Hello <strong>world</strong>!</p>`.

Override in your config to disable:

```ts
rules: { 'oxyhub/consistent-jsx-layout': 'off' }
```
