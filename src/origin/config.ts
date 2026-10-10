import plugin from './index.ts';

const prefix = plugin.meta.name;

function isLayoutRule(rule: unknown): boolean {
  if (typeof rule !== 'object' || rule === null || !('meta' in rule)) {
    return false;
  }

  const meta = rule.meta;
  return typeof meta === 'object' && meta !== null && 'type' in meta && meta.type === 'layout';
}

function oxyhubRules() {
  const rules: Record<string, unknown> = {};

  for (const [id, rule] of Object.entries(plugin.rules)) {
    if (id === 'id-length') {
      rules[`${prefix}/${id}`] = 'off';
      continue;
    }

    const severity = isLayoutRule(rule) ? 'warn' : 'error';
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
