import type { RuleModule } from '#plugin-types';

import { createCallArguments } from './apply.ts';

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep call arguments inline, or multiline when the first arg starts after `(` on its own line.',
    },
    fixable: 'whitespace',
    messages: {
      collapseArguments: 'Call arguments should stay on one line.',
      expandArguments: 'Multiline call must place each argument on its own line.',
      normalizeArgumentSpacing: 'Normalize spacing inside this argument list.',
    },
    schema: [],
  },
  create: createCallArguments,
};

export default rule;
