# consistent-jsx-layout

Aligns JSX elements and fragments with two spaces per nesting level. Tags
with four or more props (including spreads) use one prop per line. Up to three
props follow the first prop: beside the component name means all props inline;
on a new line means one prop per line. Extra spacing is normalized. Values
and expressions keep their contents, even when those contents span lines.

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
