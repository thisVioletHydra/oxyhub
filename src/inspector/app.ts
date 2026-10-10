export {};

type CatalogRule = {
  id: string; origin: string; languages: string[]; category: string;
  severity: string; autofix: boolean | null; summary: string;
  description: string; messages: string[]; options: unknown; source: string;
};
type Catalog = { languages: string[]; rules: CatalogRule[] };

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) {
    throw new Error(`Missing inspector element: ${id}`);
  }

  return node as T;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

const search = element<HTMLInputElement>('search');
const language = element<HTMLSelectElement>('language');
const origin = element<HTMLSelectElement>('origin');
const sort = element<HTMLSelectElement>('sort');
const rows = element<HTMLTableSectionElement>('rows');
const stats = element<HTMLElement>('stats');
const result = element<HTMLElement>('result');
const details = element<HTMLDialogElement>('details');
const content = element<HTMLElement>('detail-content');
let data: Catalog = { languages: [], rules: [] };
let sortCounts = false;

function badge(text: string, kind = ''): string {
  return `<span class="badge ${escape(kind)}">${escape(text)}</span>`;
}

function severityLabel(value: string): string {
  return ({ warn: 'Рекомендация', error: 'Ошибка', off: 'Выключено' })[value] ?? value;
}

function autofixLabel(rule: CatalogRule): string {
  return rule.autofix === null ? 'См. oxlint' : rule.autofix ? 'Да' : 'Вручную';
}

function render(): void {
  const query = search.value.trim().toLocaleLowerCase();
  const selected = data.rules.filter((rule) =>
    (language.value === 'all' || rule.languages.includes(language.value))
    && (origin.value === 'all' || rule.origin === origin.value)
    && `${rule.id} ${rule.summary}`.toLocaleLowerCase().includes(query));
  const priority: Record<string, number> = { error: 0, warn: 1, off: 2 };
  selected.sort((left, right) => {
    const mode = sort.value;
    const difference = mode === 'languages' ? right.languages.length - left.languages.length
      : mode === 'severity' ? (priority[left.severity] ?? 3) - (priority[right.severity] ?? 3)
      : mode === 'autofix' ? Number(right.autofix) - Number(left.autofix) : 0;
    return difference || left.id.localeCompare(right.id);
  });

  const active = selected.filter((rule) => rule.severity !== 'off');
  const counts = data.languages.map((name) => ({ name, count: active.filter((rule) => rule.languages.includes(name)).length }));
  if (sortCounts) {
    counts.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  }

  stats.innerHTML = [{ name: 'Все', count: active.length }, ...counts]
    .map(({ name, count }) => `<button class="stat" data-language="${name === 'Все' ? 'all' : name}"><span>${name}</span><strong>${count}</strong><small>активных правил</small></button>`).join('');
  result.textContent = `${selected.length} из ${data.rules.length} правил`;
  rows.innerHTML = selected.length === 0 ? '<tr><td colspan="4" class="empty">Совпадений нет. Измени поиск или фильтры.</td></tr>'
    : selected.map((rule) => `<tr><td><button class="rule-name" data-rule="${escape(rule.id)}">${escape(rule.id)}</button><p class="summary">${escape(rule.summary)}</p><small class="origin">${escape(rule.origin)} · ${escape(rule.category)}</small></td><td><div class="badges">${rule.languages.map((name) => badge(name)).join('')}</div></td><td>${badge(severityLabel(rule.severity), rule.severity)}</td><td>${badge(autofixLabel(rule), rule.autofix === true ? 'fix' : '')}</td></tr>`).join('');
}

function showRule(id: string): void {
  const rule = data.rules.find((candidate) => candidate.id === id);
  if (rule === undefined) {
    return;
  }

  content.innerHTML = `<h2>${escape(rule.id)}</h2><p class="lead">${escape(rule.summary)}</p><div class="badges">${rule.languages.map((name) => badge(name)).join('')}${badge(severityLabel(rule.severity), rule.severity)}${badge(`Автофикс: ${autofixLabel(rule)}`)}</div><h3>Как работает</h3><p>${escape(rule.description)}</p><h3>Сообщения правила</h3>${rule.messages.length > 0 ? `<ul>${rule.messages.map((message) => `<li>${escape(message)}</li>`).join('')}</ul>` : '<p>Описание сообщений — в документации oxlint.</p>'}<h3>${rule.origin === 'oxyhub' ? 'Схема параметров' : 'Настройка в базовом конфиге'}</h3><pre>${escape(JSON.stringify(rule.options, null, 2))}</pre><a class="source-link" href="${escape(rule.source)}" target="_blank" rel="noopener noreferrer">Открыть исходник / документацию ↗</a>`;
  details.showModal();
}

rows.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest<HTMLButtonElement>('[data-rule]');
  if (button?.dataset.rule !== undefined) {
    showRule(button.dataset.rule);
  }
});
element<HTMLButtonElement>('close').addEventListener('click', () => details.close());
element<HTMLButtonElement>('count-sort').addEventListener('click', (event) => {
  sortCounts = !sortCounts;
  if (event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.textContent = sortCounts ? 'Порядок языков' : 'По количеству правил ↓';
    event.currentTarget.setAttribute('aria-pressed', String(sortCounts));
  }

  render();
});
stats.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const name = event.target.closest<HTMLButtonElement>('[data-language]')?.dataset.language;
  if (name !== undefined) {
    language.value = name;
    render();
  }
});
search.addEventListener('input', render);
for (const select of [language, origin, sort]) {
  select.addEventListener('change', render);
}

async function load(): Promise<void> {
  try {
    const response = await fetch('/api/rules');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    data = await response.json();
    language.insertAdjacentHTML('beforeend', data.languages.map((name) => `<option value="${escape(name)}">${escape(name)}</option>`).join(''));
    render();
  } catch (error) {
    result.textContent = `Не удалось загрузить каталог: ${error instanceof Error ? error.message : String(error)}`;
  }
}

void load();
