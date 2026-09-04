import consistentBlockIndent from './rules/consistent-block-indent';
import consistentCallArguments from './rules/consistent-call-arguments';
import consistentChainLayout from './rules/consistent-chain-layout';
import consistentConditionSpacing from './rules/consistent-condition-spacing';
import consistentObjectLayout from './rules/consistent-object-layout';
import consistentParameterLayout from './rules/consistent-parameter-layout';
import consistentPropertyIndent from './rules/consistent-property-indent';
import consistentTernaryLayout from './rules/consistent-ternary-layout';
import idLength from './rules/id-length';
import importLayout from './rules/import-layout';
import noBangCondition from './rules/no-bang-condition';
import noBlankLinesInArrowExpression from './rules/no-blank-lines-in-arrow-expression';
import noBlankLinesInChain from './rules/no-blank-lines-in-chain';
import noFloatingPromise from './rules/no-floating-promise';
import noNodeNamedImport from './rules/no-node-named-import';
import paddingLineBeforeDecorator from './rules/padding-line-before-decorator';
import preferFsPromises from './rules/prefer-fs-promises';
import preferNodeDefaultName from './rules/prefer-node-default-name';
import preferObjectArrowMethod from './rules/prefer-object-arrow-method';
import preferProcessImport from './rules/prefer-process-import';

export default {
  meta: {
    name: 'oxxy',
  },
  rules: {
    'consistent-block-indent': consistentBlockIndent,
    'consistent-call-arguments': consistentCallArguments,
    'consistent-chain-layout': consistentChainLayout,
    'consistent-condition-spacing': consistentConditionSpacing,
    'consistent-object-layout': consistentObjectLayout,
    'consistent-parameter-layout': consistentParameterLayout,
    'consistent-property-indent': consistentPropertyIndent,
    'consistent-ternary-layout': consistentTernaryLayout,
    'id-length': idLength,
    'import-layout': importLayout,
    'no-bang-condition': noBangCondition,
    'no-blank-lines-in-arrow-expression': noBlankLinesInArrowExpression,
    'no-blank-lines-in-chain': noBlankLinesInChain,
    'no-floating-promise': noFloatingPromise,
    'no-node-named-import': noNodeNamedImport,
    'padding-line-before-decorator': paddingLineBeforeDecorator,
    'prefer-fs-promises': preferFsPromises,
    'prefer-node-default-name': preferNodeDefaultName,
    'prefer-object-arrow-method': preferObjectArrowMethod,
    'prefer-process-import': preferProcessImport,
  },
};
