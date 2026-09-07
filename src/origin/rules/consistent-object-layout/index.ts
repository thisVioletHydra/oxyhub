import type { RuleModule } from '#plugin-types';

import { createObjectLayout } from './apply.ts';

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep object/array/destructure members inline, or multiline when the first member starts after `{`/`[` on its own line.',
    },
    fixable: 'whitespace',
    messages: {
      collapseMembers: 'Object/array/destructure should stay on one line.',
      expandMembers: 'Multiline object/array/destructure must place each member on its own line.',
      normalizeMemberSpacing: 'Normalize spacing inside this object/array/destructure.',
    },
    schema: [],
  },
  create: createObjectLayout,
};

export default rule;
