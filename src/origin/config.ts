import plugin from './index.ts';

const prefix = plugin.meta.name;

const RULE_OPTIONS: Record<string, object> = {
  'id-length': {
    min: 2,
    exceptions: ['i', 'j', 'f', '_', 't'],
    exceptionPatterns: ['^[A-Z]$'],
    properties: 'never',
  },
};

function isPaddingRule(id: string) {
  return id.startsWith('padding-line-');
}

function oxyhubRules() {
  const rules: Record<string, unknown> = {};

  for (const id of Object.keys(plugin.rules)) {
    const severity = isPaddingRule(id) ? 'warn' : 'error';
    const options = RULE_OPTIONS[id];
    rules[`${prefix}/${id}`] = options === undefined ? severity : [severity, options];
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
    ...oxyhubRules(),
  },
};

export default recommended;
