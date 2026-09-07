import type { RuleModule } from '#plugin-types';

import { createParameterLayout } from './apply.ts';

const rule: RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Preserve multiline parameter layout only when a parameter starts on its own line after `(`.',
    },
    fixable: 'whitespace',
    messages: {
      collapseSingleParameter:
        'Split parameter must be collapsed because it is still a single parameter.',
      expandMultipleParameters:
        'Multiline parameter list must place each parameter on its own line.',
      collapseMultipleParameters:
        'Multiple parameters should stay on one line when the list is not multiline.',
      normalizeParameterSpacing:
        'Remove extra blank lines inside the parameter list.',
    },
    schema: [],
  },
  create: createParameterLayout,
};

export default rule;
