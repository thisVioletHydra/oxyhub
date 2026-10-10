import type { RuleModule } from '#plugin-types';

import plugin from '#inspector-plugin';
import recommended from '#inspector-config';

export const languages = ['JS', 'TS', 'JSX', 'TSX'] as const;

const summaries: Record<string, string> = {
  'consistent-block-indent': 'Два пробела на уровень блока; очистка лишних отступов.',
  'consistent-call-arguments': 'Раскладка аргументов выбирается по первому аргументу.',
  'consistent-chain-layout': 'Выравнивает цепочки вызовов методов.',
  'consistent-clause-layout': 'catch, else и finally рядом с закрывающей скобкой.',
  'consistent-condition-spacing': 'Нормализует пробелы в условиях.',
  'consistent-jsx-layout': 'Первый пропс задаёт раскладку. От четырёх — столбик.',
  'consistent-object-layout': 'Первый член объекта или массива задаёт раскладку.',
  'consistent-parameter-layout': 'Первый параметр задаёт раскладку сигнатуры.',
  'consistent-property-indent': 'Выравнивает поля, элементы и члены типов.',
  'consistent-ternary-layout': 'Выравнивает условный оператор и его ветки.',
  'consistent-type-layout': 'Выравнивает type и interface по первому члену.',
  'id-length': 'Ограничивает длину имён с исключениями.',
  'import-layout': 'Группирует и выравнивает импорты.',
  'no-bang-condition': 'Запрещает неявные проверки через ! в условиях if.',
  'no-blank-lines-in-arrow-expression': 'Убирает пустые строки внутри стрелочного выражения.',
  'no-blank-lines-in-chain': 'Убирает пустые строки внутри цепочки вызовов.',
  'no-floating-promise': 'Требует явно обработать цепочку промиса.',
  'no-node-named-import': 'Предпочитает default-импорт модулей Node.js.',
  'no-overloaded-if': 'Не более трёх проверок в одном if.',
  'padding-line-before-decorator': 'Отделяет декоратор пустой строкой.',
  'padding-line-before-return': 'Пустая строка перед return и throw после другого кода.',
  'padding-line-between-statements': 'Отделяет управляющие конструкции и циклы.',
  'prefer-descriptive-binding': 'Требует понятные имена переменных и параметров.',
  'prefer-fs-promises': 'Предпочитает асинхронный API node:fs/promises.',
  'prefer-node-default-name': 'Стандартные имена default-импортов Node.js.',
  'prefer-object-arrow-method': 'Предпочитает стрелочные функции в свойствах объекта.',
  'prefer-process-import': 'Явный импорт process вместо глобальной переменной.',
  'semi': 'Добавляет обязательные точки с запятой.',
  'eqeqeq': 'Только строгие сравнения === и !==.',
  'no-negated-condition': 'Рекомендует избегать отрицательных условий с альтернативной веткой.',
  'import/newline-after-import': 'Пустая строка после импортов.',
  'import/consistent-type-specifier-style': 'Отдельные type-импорты вместо встроенного модификатора.',
  'typescript/consistent-type-imports': 'Единый стиль импорта типов.',
  'typescript/no-floating-promises': 'Встроенная проверка промисов выключена в пользу oxyhub.',
  'unicorn/prefer-node-protocol': 'Префикс node: для встроенных модулей.',
  'max-lines': 'Ограничение файла: 300 строк в базовом конфиге.',
};

type RuleCard = {
  id: string;
  origin: string;
  languages: string[];
  category: string;
  severity: string;
  autofix: boolean | null;
  summary: string;
  description: string;
  messages: string[];
  options: unknown;
  source: string;
};

function severity(value: unknown): string {
  return String((Array.isArray(value) ? value[0] : value) ?? 'off');
}

export function catalog(): { languages: readonly string[]; rules: RuleCard[] } {
  const defaults: Record<string, unknown> = recommended.rules;
  const custom = Object.entries(plugin.rules).map(([id, entry]) => {
    const rule = entry as RuleModule;
    const scope = id === 'consistent-jsx-layout' ? ['JSX', 'TSX']
      : id === 'consistent-type-layout' || id === 'padding-line-before-decorator' ? ['TS', 'TSX'] : [...languages];
    return {
      id: `oxyhub/${id}`, origin: 'oxyhub', languages: scope,
      category: rule.meta?.type ?? 'suggestion',
      severity: severity(defaults[`oxyhub/${id}`]),
      autofix: rule.meta?.fixable !== undefined,
      summary: summaries[id] ?? rule.meta?.docs?.description ?? id,
      description: rule.meta?.docs?.description ?? '',
      messages: Object.values(rule.meta?.messages ?? {}),
      options: rule.meta?.schema ?? [],
      source: `https://github.com/thisVioletHydra/oxyhub/tree/main/src/origin/rules/${id}`,
    };
  });
  const core = Object.entries(defaults).filter(([id]) => !id.startsWith('oxyhub/')).map(([id, value]) => ({
    id, origin: 'oxlint',
    languages: id.startsWith('typescript/') || id === 'import/consistent-type-specifier-style' ? ['TS', 'TSX'] : [...languages],
    category: 'builtin', severity: severity(value), autofix: null,
    summary: summaries[id] ?? id,
    description: 'Встроенное правило oxlint, подключённое базовым конфигом oxyhub.',
    messages: [], options: value,
    source: 'https://oxc.rs/docs/guide/usage/linter/rules.html',
  }));
  return { languages, rules: [...custom, ...core] };
}
