import plugin from './index.ts';

const prefix = plugin.meta.name;

function isPaddingRule(id: string) {
  return id.startsWith('padding-line-');
}

function oxyhubRules() {
  const rules: Record<string, unknown> = {};

  for (const id of Object.keys(plugin.rules)) {
    if (id === 'id-length') {
      rules[`${prefix}/${id}`] = 'off';
      continue;
    }

    const severity = isPaddingRule(id) ? 'warn' : 'error';
    rules[`${prefix}/${id}`] = severity;
  }

  return rules;
}

const recommended = {
  jsPlugins: ['@oxyhub/oxlint-plugin'],
  plugins: ['typescript', 'import', 'unicorn'],
  rules: {
    eqeqeq: ['error', 'always'],
    'no-negated-condition': 'warn',
    'id-length': 'off',
    'import/newline-after-import': 'warn',
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'typescript/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      },
    ],
    'typescript/no-floating-promises': 'off',
    'unicorn/prefer-node-protocol': 'error',
    'max-lines': ['error', { max: 300 }],
    ...oxyhubRules(),
  },
};

export default recommended;
