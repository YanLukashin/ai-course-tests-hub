const DATA_URL = './data/course-data.json';
const STORAGE_KEY = 'ai-course-tests-v2';
const MOBILE_BREAKPOINT = 1100;
const AVAILABLE_MODULE_IDS = new Set(['module-1', 'module-2', 'module-3']);
const DISPLAY_MODULES = [
  { number: 1, id: 'module-1', title: 'Ландшафт ИИ для бизнеса' },
  { number: 2, id: 'module-2', title: 'Выбор ИИ-модели под задачу' },
  { number: 3, id: 'module-3', title: 'Промптинг как операционная компетенция' },
  { number: 4, id: 'module-4', title: 'ИИ в ключевых бизнес-функциях' },
  { number: 5, id: 'module-5', title: 'No-code автоматизация с ИИ' },
  { number: 6, id: 'module-6', title: 'ИИ-агенты: где уместны, где избыточны' },
  { number: 7, id: 'module-7', title: 'Vibe coding и AI-прототипирование' },
  { number: 8, id: 'module-8', title: 'Стратегия внедрения ИИ' },
  { number: 9, id: 'module-9', title: 'Право, этика и governance ИИ' }
];

const sidebarEl = document.getElementById('sidebar');
const mainEl = document.getElementById('main');
const mobileNavToggleEl = document.getElementById('mobile-nav-toggle');
const sidebarBackdropEl = document.getElementById('sidebar-backdrop');

const state = {
  data: null,
  selectedModuleId: null,
  view: 'hub',
  tests: {}
};

const saveState = () => {
  const payload = {
    selectedModuleId: state.selectedModuleId,
    view: state.view,
    tests: state.tests
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.selectedModuleId = typeof parsed?.selectedModuleId === 'string' ? parsed.selectedModuleId : null;
    state.view = parsed?.view === 'module' ? 'module' : 'hub';
    state.tests = parsed?.tests && typeof parsed.tests === 'object' ? parsed.tests : {};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderInlineMarkdown = (line) => {
  let text = escapeHtml(line);

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return text;
};

const renderTable = (tableLines) => {
  const rows = tableLines
    .map((line) => line.trim().replace(/^\||\|$/g, ''))
    .map((line) => line.split('|').map((cell) => renderInlineMarkdown(cell.trim())));

  if (rows.length < 2) {
    return '';
  }

  const hasDivider = rows[1].every((cell) => /^:?-{2,}:?$/.test(cell.replace(/<[^>]*>/g, '')));
  const headerRow = rows[0];
  const bodyRows = hasDivider ? rows.slice(2) : rows.slice(1);

  const headHtml = `<thead><tr>${headerRow.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;

  return `<table>${headHtml}${bodyHtml}</table>`;
};

const markdownToHtml = (markdown) => {
  if (!markdown) {
    return '';
  }

  const lines = markdown.replace(/\r/g, '').split('\n');
  let html = '';
  let index = 0;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html += '</ul>';
      inUl = false;
    }

    if (inOl) {
      html += '</ol>';
      inOl = false;
    }
  };

  while (index < lines.length) {
    const rawLine = lines[index] || '';
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      index += 1;
      continue;
    }

    if (line.startsWith('|')) {
      closeLists();
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index]);
        index += 1;
      }
      html += renderTable(tableLines);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`;
      index += 1;
      continue;
    }

    if (/^---+$/.test(line)) {
      closeLists();
      html += '<hr />';
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      closeLists();
      let codeContent = '';
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeContent += `${lines[index]}\n`;
        index += 1;
      }
      index += 1;
      html += `<pre>${escapeHtml(codeContent.trimEnd())}</pre>`;
      continue;
    }

    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeLists();
      html += `<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`;
      index += 1;
      continue;
    }

    const ulMatch = rawLine.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        html += '</ol>';
        inOl = false;
      }
      if (!inUl) {
        html += '<ul>';
        inUl = true;
      }
      html += `<li>${renderInlineMarkdown(ulMatch[1])}</li>`;
      index += 1;
      continue;
    }

    const olMatch = rawLine.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        html += '</ul>';
        inUl = false;
      }
      if (!inOl) {
        html += '<ol>';
        inOl = true;
      }
      html += `<li>${renderInlineMarkdown(olMatch[1])}</li>`;
      index += 1;
      continue;
    }

    closeLists();
    html += `<p>${renderInlineMarkdown(rawLine)}</p>`;
    index += 1;
  }

  closeLists();
  return html;
};

const stripMarkdown = (value) =>
  String(value || '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/^>\s?/gm, '')
    .trim();

const normalizeComparableText = (value) =>
  stripMarkdown(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[«»"“”'`]/g, '')
    .replace(/[.,;:!?()[\]{}\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е');

const normalizeChoiceKey = (value) =>
  String(value || '')
    .replace(/^[([{\s]+/, '')
    .replace(/[)\]}.\s:;,-]+$/g, '')
    .toUpperCase();

const unique = (array) => [...new Set(array)];

const extractChoiceTokens = (text) => {
  const cleaned = stripMarkdown(text);
  const matches = [...cleaned.matchAll(/(?:^|[\s,;|])[\(\[]?([A-Za-zА-Яа-яЁё])(?:[\)\].,:;]|\s|$)/g)];
  return unique(matches.map((match) => normalizeChoiceKey(match[1])).filter(Boolean));
};

const parseMapToken = (value) => {
  const cleaned = String(value || '').trim();
  const numeric = cleaned.match(/\d+/)?.[0];
  if (numeric && /^\d+$/.test(cleaned.replace(/[().\s-]/g, ''))) {
    return numeric;
  }

  const compact = cleaned.replace(/[().,\s-]/g, '');
  const choiceToken = compact.length === 1 ? extractChoiceTokens(cleaned)[0] : null;
  return choiceToken || normalizeComparableText(cleaned);
};

const normalizeAnswerMapObject = (raw) => {
  const entries = Object.entries(raw || {})
    .map(([key, value]) => [parseMapToken(key), parseMapToken(value)])
    .filter(([, value]) => value);

  return Object.fromEntries(entries);
};

const parseAnswerMap = (raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeAnswerMapObject(raw);
  }

  const result = {};
  const text = String(raw || '');
  const lines = text
    .split('\n')
    .flatMap((line) => line.split(';'))
    .flatMap((line) => line.split('|'))
    .flatMap((line) => line.split(/,(?=\s*[A-Za-zА-Яа-яЁё0-9]+\s*(?:→|=>|->|=|-|:))/));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const pairMatch = trimmed.match(/^(.+?)\s*(?:→|=>|->|=|-|:)\s*(.+)$/);
    if (!pairMatch) {
      continue;
    }

    const leftToken = parseMapToken(pairMatch[1]);
    const rightToken = parseMapToken(pairMatch[2]);
    result[leftToken] = rightToken;
  }

  return result;
};

const normalizeMatchingExpectedMap = (rawExpected) => {
  const expected = normalizeAnswerMapObject(rawExpected || {});
  const extractGroupedMembers = (value) => {
    const members = String(value || '')
      .split(/[\s,;|]+/)
      .map((item) => item.replace(/[.,]+$/g, '').trim())
      .filter(Boolean);

    if (members.length < 2) {
      return [];
    }

    const normalizedMembers = members.map((item) => {
      if (/^\d+$/.test(item)) {
        return item;
      }

      const choiceKey = normalizeChoiceKey(item);
      return /^[A-ZА-ЯЁ]$/i.test(choiceKey) ? choiceKey : '';
    });

    return normalizedMembers.every(Boolean) ? normalizedMembers : [];
  };

  const expanded = {};
  let expandedAny = false;

  for (const [key, value] of Object.entries(expected)) {
    const groupedMembers = extractGroupedMembers(value);
    if (groupedMembers.length >= 2) {
      const normalizedCategory = normalizeComparableText(key);
      groupedMembers.forEach((member) => {
        expanded[member] = normalizedCategory;
      });
      expandedAny = true;
      continue;
    }

    expanded[key] = value;
  }

  return expandedAny ? expanded : expected;
};

const countMapMatches = (expected, actual) =>
  Object.keys(expected).reduce((total, key) => (String(expected[key]) === String(actual[key]) ? total + 1 : total), 0);

const invertMap = (source) => {
  const inverted = {};

  for (const [key, value] of Object.entries(source || {})) {
    if (value && !(value in inverted)) {
      inverted[value] = key;
    }
  }

  return inverted;
};

const mapsEqual = (left, right) => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length === 0 || leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => right[key] && String(left[key]) === String(right[key]));
};

const getModuleState = (moduleId) => {
  if (!state.tests[moduleId]) {
    state.tests[moduleId] = {
      answers: {},
      submitted: false,
      submittedAt: null
    };
  }

  return state.tests[moduleId];
};

const getModules = () => state.data?.modules || [];
const isModuleAvailable = (moduleOrId) =>
  AVAILABLE_MODULE_IDS.has(typeof moduleOrId === 'string' ? moduleOrId : moduleOrId?.id);
const getAvailableModules = () => getModules().filter((module) => isModuleAvailable(module));
const getDisplayModules = () =>
  DISPLAY_MODULES.map((moduleMeta) => {
    const liveModule = getModules().find((module) => module.id === moduleMeta.id);
    return liveModule
      ? liveModule
      : {
          ...moduleMeta,
          testTitle: moduleMeta.title,
          sourceFile: '',
          totalQuestions: 0,
          estimatedTime: '',
          passThreshold: '',
          passThresholdValue: 0,
          attemptsAllowed: '',
          questions: [],
          isPlaceholder: true
        };
  });

const getModuleById = (moduleId) => getModules().find((module) => module.id === moduleId) || null;

const getSelectedModule = () => getModuleById(state.selectedModuleId);

const gradeQuestion = (question, rawAnswer) => {
  const grading = question.grading || { mode: 'manual' };

  if (grading.mode === 'single_choice') {
    const actual = normalizeChoiceKey(rawAnswer || '');
    const correct = actual && actual === grading.correctKey;
    return { auto: true, score: correct ? 1 : 0, correct };
  }

  if (grading.mode === 'multi_choice') {
    const actual = unique((Array.isArray(rawAnswer) ? rawAnswer : []).map((item) => normalizeChoiceKey(item))).sort();
    const expected = [...(grading.correctKeys || [])].sort();
    const correct = expected.length === actual.length && expected.every((item, index) => item === actual[index]);
    return { auto: true, score: correct ? 1 : 0, correct };
  }

  if (grading.mode === 'matching_text') {
    const actual = parseAnswerMap(rawAnswer || '');
    const expected = normalizeMatchingExpectedMap(grading.expectedMap || {});
    const directMatches = countMapMatches(expected, actual);
    const invertedMatches = countMapMatches(expected, invertMap(actual));
    const matchedPairs = Math.max(directMatches, invertedMatches);
    const totalPairs = Object.keys(expected).length;
    const requiredPairs = Number(grading.minCorrect || totalPairs || 0);
    const correct = matchedPairs >= requiredPairs && totalPairs > 0;
    return { auto: true, score: correct ? 1 : 0, correct, matchedPairs, totalPairs, requiredPairs };
  }

  if (grading.mode === 'ordering') {
    const actual = rawAnswer && typeof rawAnswer === 'object' ? rawAnswer : {};
    const solution = grading.solution || [];
    const correct =
      solution.length > 0 &&
      solution.every((position, index) => Number(actual[index]) === Number(position));

    return { auto: true, score: correct ? 1 : 0, correct };
  }

  return { auto: false, score: 0, correct: false };
};

const getModuleResult = (module) => {
  const moduleState = getModuleState(module.id);
  const grades = module.questions.map((question) => gradeQuestion(question, moduleState.answers[question.number]));
  const score = grades.reduce((total, item) => total + item.score, 0);
  const answered = module.questions.filter((question) => {
    const answer = moduleState.answers[question.number];
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    if (answer && typeof answer === 'object') {
      return Object.values(answer).some(Boolean);
    }
    return String(answer || '').trim().length > 0;
  }).length;
  const percent = module.questions.length ? Math.round((score / module.questions.length) * 100) : 0;
  const passValue = Number(module.passThresholdValue || 0);
  const passed = passValue > 0 ? score >= passValue : module.questions.length > 0 && score === module.questions.length;

  return {
    score,
    total: module.questions.length,
    answered,
    percent,
    passed,
    submitted: moduleState.submitted,
    submittedAt: moduleState.submittedAt
  };
};

const getOverallStats = () => {
  const modules = getAvailableModules();
  const finished = modules.filter((module) => getModuleResult(module).submitted).length;
  const passed = modules.filter((module) => getModuleResult(module).submitted && getModuleResult(module).passed).length;
  return { finished, passed, total: modules.length };
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const moduleStatusLabel = (module) => {
  if (!isModuleAvailable(module)) {
    return 'Скоро';
  }

  const result = getModuleResult(module);
  if (!result.submitted && result.answered === 0) {
    return 'Не начат';
  }

  if (!result.submitted) {
    return `В процессе · ${result.answered}/${result.total}`;
  }

  return result.passed ? `Сдан · ${result.score}/${result.total}` : `Не сдан · ${result.score}/${result.total}`;
};

const renderSidebar = () => {
  if (!state.data) {
    sidebarEl.innerHTML = '<div class="brand"><div class="brand-title">Нет данных</div></div>';
    return;
  }

  const stats = getOverallStats();
  const moduleButtons = getDisplayModules()
    .map((module) => {
      const active = state.view === 'module' && state.selectedModuleId === module.id ? 'active' : '';
      const result = module.isPlaceholder ? null : getModuleResult(module);
      const available = isModuleAvailable(module);
      const statusClass =
        !available ? 'locked' : result?.submitted ? (result.passed ? 'completed' : 'attention') : '';

      return `
        <button class="nav-item ${active} ${statusClass}" data-nav="module" data-module-id="${module.id}" ${available ? '' : 'disabled'}>
          Модуль ${module.number}: ${escapeHtml(module.title)}
          <div class="nav-item-meta">${moduleStatusLabel(module)}</div>
        </button>
      `;
    })
    .join('');

  sidebarEl.innerHTML = `
    <div class="brand">
      <div class="brand-code">[Intermodule Test Hub]</div>
      <div class="brand-title">Тесты курса ИИ</div>
    </div>

    <div class="stat">
      <div class="stat-panel">
        <div class="stat-label">Доступных тестов завершено</div>
        <div class="stat-value">${stats.finished}/${stats.total}</div>
      </div>
      <div class="stat-panel">
        <div class="stat-label">Доступных тестов сдано</div>
        <div class="stat-value">${stats.passed}/${stats.total}</div>
      </div>
    </div>

    <div class="nav-section-title">Навигация</div>
    <button class="nav-item ${state.view === 'hub' ? 'active' : ''}" data-nav="hub">Все межмодульные тесты</button>

    <div class="nav-section-title">Модули 1–6</div>
    ${moduleButtons}
  `;
};

const renderHub = () => {
  const stats = getOverallStats();

  return `
    <section class="screen">
      <h1 class="headline">${escapeHtml(state.data.siteTitle)}</h1>
      <div class="subline">[Static LMS] отдельный портал проверки знаний для живого потока</div>

      <div class="panel">
        <span class="badge">Модулей в хабе: ${DISPLAY_MODULES.length}</span>
        <span class="badge">Открыто сейчас: ${stats.total}</span>
        <span class="badge orange">Завершено: ${stats.finished}</span>
        <span class="badge cyan">Сдано: ${stats.passed}</span>
      </div>

      <div class="panel">
        <strong>Сейчас доступны модули 1, 2 и 3.</strong>
        <p class="muted">Модули 4–9 временно закрыты, пока вы перепроверяете вопросы и парсер.</p>
      </div>

      <div class="module-grid">
        ${getDisplayModules()
          .map((module) => {
            const result = module.isPlaceholder ? null : getModuleResult(module);
            const available = isModuleAvailable(module);
            const questionCount = module.questions?.length || 0;
            const timeLabel = module.estimatedTime || (module.isPlaceholder ? 'Пока без теста' : '—');
            const passLabel = module.passThreshold || (module.isPlaceholder ? 'Скоро' : '—');

            return `
              <article class="module-card ${available ? '' : 'locked'}">
                <div class="module-card-top">
                  <div class="module-number">Модуль ${module.number}</div>
                  <div class="module-status">${escapeHtml(moduleStatusLabel(module))}</div>
                </div>
                <h3 class="module-title">${escapeHtml(module.title)}</h3>
                <div class="module-meta">
                  <span class="badge">${questionCount > 0 ? `${questionCount} вопросов` : 'Тест готовится'}</span>
                  <span class="badge orange">${escapeHtml(timeLabel)}</span>
                  <span class="badge cyan">${escapeHtml(passLabel)}</span>
                </div>
                <div class="lesson-actions" style="margin-top:16px; margin-bottom:0;">
                  <button class="btn primary" data-nav="module" data-module-id="${module.id}" ${available ? '' : 'disabled'}>
                    ${available ? (result?.submitted ? 'Открыть результат' : 'Открыть тест') : 'Пока закрыт'}
                  </button>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
};

const orderingHint = (question) =>
  `Назначьте каждому пункту позицию от 1 до ${question.ordering?.items?.length || 0}. Одинаковые позиции использовать нельзя.`;

const matchingHint = (question) => {
  const expectedMap = normalizeMatchingExpectedMap(question.grading?.expectedMap || {});
  const values = Object.values(expectedMap);
  const allShort = values.every((value) => String(value).length <= 2);
  const requiredPairs = Number(question.grading?.minCorrect || Object.keys(expectedMap).length || 0);
  const totalPairs = Object.keys(expectedMap).length;

  if (isCategorizedMatchingQuestion(question)) {
    return totalPairs && requiredPairs < totalPairs
      ? `Выберите категорию для каждого пункта. Нужно совпасть минимум по ${requiredPairs} из ${totalPairs}.`
      : 'Выберите категорию для каждого пункта.';
  }

  if (allShort && Object.keys(expectedMap).length > 0) {
    const sample = Object.entries(expectedMap)
      .slice(0, 3)
      .map(([key, value]) => `${key}-${value}`)
      .join(', ');

    return totalPairs && requiredPairs < totalPairs
      ? `Нужно совпасть минимум по ${requiredPairs} из ${totalPairs} пар. Формат ответа: ${sample}`
      : `Формат ответа: ${sample}`;
  }

  return 'Формат ответа: 1-..., 2-..., 3-...';
};

const parseMarkdownSections = (markdown) => {
  const sections = {};
  let current = '__intro__';
  sections[current] = [];

  for (const line of String(markdown || '').replace(/\r/g, '').split('\n')) {
    const headingMatch = line.trim().match(/^###\s+(.+)$/);
    if (headingMatch) {
      current = headingMatch[1].trim();
      sections[current] = [];
      continue;
    }

    sections[current].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections)
      .map(([key, lines]) => [key, lines.join('\n').trim()])
      .filter(([, value]) => value)
  );
};

const extractKeyedItems = (markdown) => {
  const lines = String(markdown || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[-*]\s+/, '').trim();
    const numericMatch = cleaned.match(/^(\d+)[.)]\s+(.+)$/);
    if (numericMatch) {
      items.push({ key: numericMatch[1], label: numericMatch[2].trim(), kind: 'numeric' });
      continue;
    }

    const letterMatch = cleaned.match(/^[([{\s]*([A-Za-zА-Яа-яЁё])[)\].}]?\s+(.+)$/);
    if (letterMatch) {
      items.push({ key: normalizeChoiceKey(letterMatch[1]), label: letterMatch[2].trim(), kind: 'choice' });
    }
  }

  return items;
};

const getStructuredMatchingData = (question) => {
  const sections = parseMarkdownSections(question.promptMarkdown);
  const sectionItems = Object.values(sections)
    .map((value) => extractKeyedItems(value))
    .filter((items) => items.length > 0);

  const leftItems =
    sectionItems.find((items) => items.every((item) => item.kind === 'numeric')) || [];
  const rightItems =
    sectionItems.find((items) => items.every((item) => item.kind === 'choice')) || [];

  if (leftItems.length === 0 || rightItems.length === 0) {
    return null;
  }

  return {
    leftItems,
    rightItems
  };
};

const extractCategoryDefinitions = (markdown) =>
  String(markdown || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .map((line) => line.match(/^(.+?)\s*(?:→|=>|->|=|:)\s*(.+)$/))
    .filter(Boolean)
    .map((match) => {
      const label = stripMarkdown(match[1]).trim();
      const rawMembers = String(match[2] || '')
        .split(/[\s,;|]+/)
        .map((item) => item.replace(/[.,]+$/g, '').trim())
        .filter(Boolean);
      const simpleMembers = rawMembers.filter((item) => /^\d+$/.test(item) || /^[A-Za-zА-Яа-яЁё]$/.test(item));

      return simpleMembers.length >= 2
        ? { key: normalizeComparableText(label), label }
        : null;
    })
    .filter(Boolean);

const getCategorizedMatchingData = (question) => {
  const sections = parseMarkdownSections(question.promptMarkdown);
  const items =
    Object.values(sections)
      .map((value) => extractKeyedItems(value))
      .find((sectionItems) => sectionItems.length > 0 && sectionItems.every((item) => item.kind === 'numeric')) || [];
  const categories = extractCategoryDefinitions(question.correctAnswer);

  if (items.length === 0 || categories.length < 2) {
    return null;
  }

  return { items, categories };
};

const isCategorizedMatchingQuestion = (question) => Boolean(getCategorizedMatchingData(question));

const renderMatchingInput = (question, answer, disabled) => {
  const categoryLayout = getCategorizedMatchingData(question);
  if (categoryLayout) {
    const current = parseAnswerMap(answer);

    return `
      <div class="muted">${matchingHint(question)}</div>
      <div class="category-match-list">
        ${categoryLayout.items
          .map((item) => {
            const selectedValue = String(current[item.key] || '');
            return `
              <div class="category-match-card">
                <div class="category-match-text">
                  <span class="matching-left-key">${escapeHtml(item.key)}</span>
                  <span>${escapeHtml(item.label)}</span>
                </div>
                <div class="category-match-actions">
                  ${categoryLayout.categories
                    .map(
                      (category) => `
                        <label class="category-choice ${selectedValue === category.key ? 'active' : ''}">
                          <input
                            type="radio"
                            name="match-category-${question.number}-${item.key}"
                            data-question="${question.number}"
                            data-input-type="matching-category"
                            data-match-key="${escapeHtml(item.key)}"
                            value="${escapeHtml(category.key)}"
                            ${selectedValue === category.key ? 'checked' : ''}
                            ${disabled ? 'disabled' : ''}
                          />
                          <span>${escapeHtml(category.label)}</span>
                        </label>
                      `
                    )
                    .join('')}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  const layout = getStructuredMatchingData(question);
  if (!layout) {
    return `
      <div class="muted">${matchingHint(question)}</div>
      <textarea class="text-area" data-question="${question.number}" data-input-type="matching" ${disabled ? 'disabled' : ''}>${escapeHtml(answer || '')}</textarea>
    `;
  }

  const current = parseAnswerMap(answer);

  return `
    <div class="muted">${matchingHint(question)}</div>
    <div class="matching-layout">
      <div class="matching-reference">
        <div class="matching-reference-title">Варианты справа</div>
        ${layout.rightItems
          .map(
            (item) => `
              <div class="matching-reference-item">
                <span class="matching-reference-key">${escapeHtml(item.key)}</span>
                <span>${escapeHtml(item.label)}</span>
              </div>
            `
          )
          .join('')}
      </div>

      <div class="matching-grid">
        ${layout.leftItems
          .map(
            (item) => `
              <label class="matching-row">
                <span class="matching-left">
                  <span class="matching-left-key">${escapeHtml(item.key)}</span>
                  <span>${escapeHtml(item.label)}</span>
                </span>
                <select
                  class="matching-select"
                  data-question="${question.number}"
                  data-input-type="matching-select"
                  data-match-key="${escapeHtml(item.key)}"
                  ${disabled ? 'disabled' : ''}
                >
                  <option value="">Выберите вариант</option>
                  ${layout.rightItems
                    .map(
                      (option) => `
                        <option value="${option.key}" ${String(current[item.key] || '') === option.key ? 'selected' : ''}>
                          ${option.key}
                        </option>
                      `
                    )
                    .join('')}
                </select>
              </label>
            `
          )
          .join('')}
      </div>
    </div>
  `;
};

const renderOrderingInput = (question, answer, disabled) => {
  const current = answer && typeof answer === 'object' ? answer : {};
  const items = question.ordering?.items || [];

  return `
    <div class="muted">${orderingHint(question)}</div>
    <div class="ordering-grid">
      ${items
        .map(
          (item, index) => `
            <label class="ordering-item">
              <span class="ordering-text">${escapeHtml(item)}</span>
              <select class="order-select" data-question="${question.number}" data-order-index="${index}" data-input-type="ordering" ${disabled ? 'disabled' : ''}>
                <option value="">Позиция</option>
                ${items
                  .map(
                    (_, position) => `
                      <option value="${position + 1}" ${Number(current[index]) === position + 1 ? 'selected' : ''}>${position + 1}</option>
                    `
                  )
                  .join('')}
              </select>
            </label>
          `
        )
        .join('')}
    </div>
  `;
};

const renderQuestionInput = (question, answer, submitted) => {
  if (question.interaction === 'single_choice') {
    return question.options
      .map(
        (option) => `
          <label class="option-item">
            <input
              type="radio"
              name="q-${question.number}"
              data-question="${question.number}"
              data-input-type="single"
              value="${option.key}"
              ${normalizeChoiceKey(answer || '') === option.key ? 'checked' : ''}
              ${submitted ? 'disabled' : ''}
            />
            <strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.label)}
          </label>
        `
      )
      .join('');
  }

  if (question.interaction === 'multi_choice') {
    const selected = Array.isArray(answer) ? answer : [];

    return question.options
      .map(
        (option) => `
          <label class="option-item">
            <input
              type="checkbox"
              data-question="${question.number}"
              data-input-type="multi"
              value="${option.key}"
              ${selected.includes(option.key) ? 'checked' : ''}
              ${submitted ? 'disabled' : ''}
            />
            <strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.label)}
          </label>
        `
      )
      .join('');
  }

  if (question.interaction === 'ordering') {
    return renderOrderingInput(question, answer, submitted);
  }

  if (question.interaction === 'matching_text') {
    return renderMatchingInput(question, answer, submitted);
  }

  return `<textarea class="text-area" data-question="${question.number}" data-input-type="open" ${submitted ? 'disabled' : ''}>${escapeHtml(answer || '')}</textarea>`;
};

const renderFeedback = (question, moduleId) => {
  const moduleState = getModuleState(moduleId);
  if (!moduleState.submitted) {
    return '';
  }

  const grade = gradeQuestion(question, moduleState.answers[question.number]);
  const className = grade.correct ? 'correct' : 'wrong';
  const autoLabel = grade.correct ? 'Ответ засчитан' : 'Ответ не засчитан';
  const matchingMeta =
    question.interaction === 'matching_text' && Number.isFinite(grade.matchedPairs)
      ? `<div style="margin-top:8px;"><strong>Совпало пар:</strong> ${grade.matchedPairs}/${grade.totalPairs}${
          grade.requiredPairs && grade.requiredPairs !== grade.totalPairs ? ` · минимум нужно ${grade.requiredPairs}` : ''
        }</div>`
      : '';

  return `
    <div class="feedback ${className}">
      <div><strong>${autoLabel}</strong></div>
      ${matchingMeta}
      <div style="margin-top:8px;"><strong>Правильный ответ:</strong><br/>${markdownToHtml(question.correctAnswer || '—')}</div>
      <div style="margin-top:8px;"><strong>Пояснение:</strong><br/>${markdownToHtml(question.explanation || '—')}</div>
      <div style="margin-top:8px;"><strong>Критерий:</strong> ${escapeHtml(question.scoring || '—')}</div>
    </div>
  `;
};

const renderModuleSummary = (module) => {
  const result = getModuleResult(module);
  const status = result.submitted
    ? result.passed
      ? 'Тест сдан'
      : 'Тест не сдан'
    : `Ответов заполнено: ${result.answered}/${result.total}`;

  const details = result.submitted
    ? `${result.score}/${result.total} • ${result.percent}% • ${formatDateTime(result.submittedAt)}`
    : `${module.passThreshold || 'Проходной уровень не указан'} • ${module.attemptsAllowed || 'Попытки не указаны'}`;

  return `
    <div class="result-strip">
      <strong>${status}</strong>
      <div class="muted">${details}</div>
    </div>
  `;
};

const renderModuleTest = () => {
  const module = getSelectedModule();
  if (!module) {
    return '<section class="screen"><div class="empty-state">Модуль не найден.</div></section>';
  }

  const moduleState = getModuleState(module.id);
  const submitted = moduleState.submitted;

  return `
    <section class="screen">
      <h1 class="headline">Модуль ${module.number}</h1>
      <div class="subline">[Exam Mode] ${escapeHtml(module.title)}</div>

      <div class="panel">
        <span class="badge">${module.questions.length} вопросов</span>
        <span class="badge orange">${escapeHtml(module.estimatedTime || '—')}</span>
        <span class="badge cyan">${escapeHtml(module.passThreshold || '—')}</span>
        <span class="badge">${escapeHtml(module.attemptsAllowed || '—')} попытки</span>
      </div>

      ${renderModuleSummary(module)}

      <div class="lesson-actions sticky-actions">
        <button class="btn ghost" data-nav="hub">Назад к списку</button>
        ${
          submitted
            ? `
              <button class="btn secondary" data-action="copy-result" data-module-id="${module.id}">Скопировать результат</button>
              <button class="btn primary" data-action="reset-test" data-module-id="${module.id}">Начать заново</button>
            `
            : `<button class="btn primary" data-action="submit-test" data-module-id="${module.id}">Завершить и проверить</button>`
        }
      </div>

      ${module.questions
        .map((question) => {
          const answer = moduleState.answers[question.number];
          return `
            <article class="question-card">
              <div class="question-top">
                <span class="badge">Вопрос ${question.number}</span>
                <span class="badge">${escapeHtml(question.type || '—')}</span>
                <span class="badge">${escapeHtml(question.difficulty || '—')}</span>
              </div>

              <div class="markdown">${markdownToHtml(question.promptMarkdown)}</div>

              <div class="field-block">
                ${renderQuestionInput(question, answer, submitted)}
              </div>

              ${renderFeedback(question, module.id)}
            </article>
          `;
        })
        .join('')}
    </section>
  `;
};

const renderMain = () => {
  if (!state.data) {
    mainEl.innerHTML = '<section class="screen"><div class="empty-state">Загрузка данных тестовой платформы...</div></section>';
    return;
  }

  mainEl.innerHTML = state.view === 'module' ? renderModuleTest() : renderHub();
};

const render = () => {
  renderSidebar();
  renderMain();
};

const ensureValidSelection = () => {
  const modules = getModules();

  const availableModules = getAvailableModules();

  if (!modules.length || !availableModules.length) {
    state.selectedModuleId = null;
    state.view = 'hub';
    return;
  }

  if (!state.selectedModuleId || !getModuleById(state.selectedModuleId) || !isModuleAvailable(state.selectedModuleId)) {
    state.selectedModuleId = availableModules[0].id;
  }

  if (state.view === 'module' && (!getSelectedModule() || !isModuleAvailable(state.selectedModuleId))) {
    state.view = 'hub';
  }
};

const selectHub = () => {
  state.view = 'hub';
  saveState();
  render();
  closeSidebarDrawer();
};

const selectModule = (moduleId) => {
  if (!isModuleAvailable(moduleId)) {
    return;
  }

  state.selectedModuleId = moduleId;
  state.view = 'module';
  saveState();
  render();
  closeSidebarDrawer();
};

const buildResultText = (module) => {
  const result = getModuleResult(module);
  return [
    `${state.data.siteTitle}`,
    `Модуль ${module.number}: ${module.title}`,
    `Результат: ${result.score}/${result.total} (${result.percent}%)`,
    `Статус: ${result.passed ? 'сдан' : 'не сдан'}`,
    `Проходной уровень: ${module.passThreshold || '—'}`,
    `Завершён: ${formatDateTime(result.submittedAt)}`
  ].join('\n');
};

const submitModuleTest = (moduleId) => {
  const module = getModuleById(moduleId);
  if (!module || !isModuleAvailable(module)) {
    return;
  }

  const moduleState = getModuleState(moduleId);
  moduleState.submitted = true;
  moduleState.submittedAt = new Date().toISOString();
  saveState();
  render();
};

const resetModuleTest = (moduleId) => {
  if (!isModuleAvailable(moduleId)) {
    return;
  }

  state.tests[moduleId] = {
    answers: {},
    submitted: false,
    submittedAt: null
  };

  saveState();
  render();
};

const copyModuleResult = async (moduleId) => {
  const module = getModuleById(moduleId);
  if (!module || !isModuleAvailable(module)) {
    return;
  }

  const text = buildResultText(module);

  try {
    await navigator.clipboard.writeText(text);
    window.alert('Результат скопирован в буфер обмена.');
  } catch {
    window.prompt('Скопируйте результат вручную:', text);
  }
};

const isMobileViewport = () => window.innerWidth <= MOBILE_BREAKPOINT;

const closeSidebarDrawer = () => {
  document.body.classList.remove('sidebar-open');
  if (mobileNavToggleEl) {
    mobileNavToggleEl.setAttribute('aria-expanded', 'false');
  }
};

const openSidebarDrawer = () => {
  if (!isMobileViewport()) {
    return;
  }

  document.body.classList.add('sidebar-open');
  if (mobileNavToggleEl) {
    mobileNavToggleEl.setAttribute('aria-expanded', 'true');
  }
};

const toggleSidebarDrawer = () => {
  if (!isMobileViewport()) {
    return;
  }

  if (document.body.classList.contains('sidebar-open')) {
    closeSidebarDrawer();
  } else {
    openSidebarDrawer();
  }
};

const syncLayoutForViewport = () => {
  if (!isMobileViewport()) {
    closeSidebarDrawer();
    return;
  }

  if (mobileNavToggleEl && !mobileNavToggleEl.hasAttribute('aria-expanded')) {
    mobileNavToggleEl.setAttribute('aria-expanded', 'false');
  }
};

sidebarEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-nav]');
  if (!button) {
    return;
  }

  if (button.dataset.nav === 'hub') {
    selectHub();
    return;
  }

  if (button.dataset.nav === 'module') {
    selectModule(button.dataset.moduleId);
  }
});

mainEl.addEventListener('click', (event) => {
  const navButton = event.target.closest('[data-nav]');
  if (navButton) {
    if (navButton.dataset.nav === 'hub') {
      selectHub();
      return;
    }

    if (navButton.dataset.nav === 'module') {
      selectModule(navButton.dataset.moduleId);
    }

    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.action;
  const moduleId = actionButton.dataset.moduleId || state.selectedModuleId;

  if (action === 'submit-test') {
    submitModuleTest(moduleId);
    return;
  }

  if (action === 'reset-test') {
    resetModuleTest(moduleId);
    return;
  }

  if (action === 'copy-result') {
    copyModuleResult(moduleId);
  }
});

mainEl.addEventListener('change', (event) => {
  const target = event.target;
  const module = getSelectedModule();
  if (!module) {
    return;
  }

  const moduleState = getModuleState(module.id);
  if (moduleState.submitted) {
    return;
  }

  if (target.matches('[data-input-type="single"]')) {
    moduleState.answers[Number(target.dataset.question)] = target.value;
    saveState();
    return;
  }

  if (target.matches('[data-input-type="multi"]')) {
    const question = Number(target.dataset.question);
    const checkboxes = [...mainEl.querySelectorAll(`[data-input-type="multi"][data-question="${question}"]`)];
    moduleState.answers[question] = checkboxes.filter((item) => item.checked).map((item) => item.value);
    saveState();
    return;
  }

  if (target.matches('[data-input-type="ordering"]')) {
    const question = Number(target.dataset.question);
    const orderIndex = Number(target.dataset.orderIndex);
    const current = moduleState.answers[question] && typeof moduleState.answers[question] === 'object'
      ? moduleState.answers[question]
      : {};

    current[orderIndex] = target.value ? Number(target.value) : '';
    moduleState.answers[question] = current;
    saveState();
    return;
  }

  if (target.matches('[data-input-type="matching-select"]')) {
    const question = Number(target.dataset.question);
    const current = parseAnswerMap(moduleState.answers[question]);
    const matchKey = String(target.dataset.matchKey || '');

    if (target.value) {
      current[matchKey] = target.value;
    } else {
      delete current[matchKey];
    }

    moduleState.answers[question] = current;
    saveState();
    return;
  }

  if (target.matches('[data-input-type="matching-category"]')) {
    const question = Number(target.dataset.question);
    const current = parseAnswerMap(moduleState.answers[question]);
    const matchKey = String(target.dataset.matchKey || '');

    if (target.value) {
      current[matchKey] = normalizeComparableText(target.value);
    } else {
      delete current[matchKey];
    }

    moduleState.answers[question] = current;
    saveState();
  }
});

mainEl.addEventListener('input', (event) => {
  const target = event.target;
  const module = getSelectedModule();
  if (!module) {
    return;
  }

  const moduleState = getModuleState(module.id);
  if (moduleState.submitted) {
    return;
  }

  if (target.matches('[data-input-type="matching"], [data-input-type="open"]')) {
    moduleState.answers[Number(target.dataset.question)] = target.value;
    saveState();
  }
});

if (mobileNavToggleEl) {
  mobileNavToggleEl.addEventListener('click', () => {
    toggleSidebarDrawer();
  });
}

if (sidebarBackdropEl) {
  sidebarBackdropEl.addEventListener('click', () => {
    closeSidebarDrawer();
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebarDrawer();
  }
});

window.addEventListener('resize', () => {
  syncLayoutForViewport();
});

const boot = async () => {
  loadState();
  syncLayoutForViewport();
  renderMain();

  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_URL}`);
  }

  state.data = await response.json();
  ensureValidSelection();
  saveState();
  render();
};

boot().catch((error) => {
  mainEl.innerHTML = `
    <section class="screen">
      <h1 class="headline">Ошибка загрузки</h1>
      <div class="panel">
        <code>${escapeHtml(error.message)}</code>
        <p class="muted">Проверьте, что файл <code>data/course-data.json</code> создан и сайт запущен через локальный сервер.</p>
      </div>
    </section>
  `;
});
