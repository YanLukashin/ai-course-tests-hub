import { promises as fs } from 'node:fs';
import path from 'node:path';

const siteRoot = process.cwd();
const projectRoot = path.resolve(siteRoot, '..');

const MODULES = [
  {
    number: 1,
    id: 'module-1',
    title: 'Ландшафт ИИ для бизнеса',
    testFile: 'Модуль 1/Module-1-Test-Final.md'
  },
  {
    number: 2,
    id: 'module-2',
    title: 'Выбор ИИ-модели под задачу',
    testFile: 'Модуль 2/Test-Module-2.md'
  },
  {
    number: 3,
    id: 'module-3',
    title: 'Промптинг как операционная компетенция',
    testFile: 'Модуль 3/Module-3-Test-Ready.md'
  },
  {
    number: 4,
    id: 'module-4',
    title: 'ИИ в ключевых бизнес-функциях',
    testFile: 'Модуль 4/Module-4-Test-Final.md'
  },
  {
    number: 5,
    id: 'module-5',
    title: 'No-code автоматизация с ИИ',
    testFile: 'Модуль 5/Test-Module-5-NoCode-Automation.md'
  },
  {
    number: 6,
    id: 'module-6',
    title: 'ИИ-агенты: где уместны, где избыточны',
    testFile: 'Модуль 6/Module-6-Test-Ready.md'
  }
];

const QUESTION_META_KEYS = new Map([
  ['тип', 'type'],
  ['цельблума', 'goal'],
  ['урок', 'lesson'],
  ['сложность', 'difficulty'],
  ['оценка', 'scoring'],
  ['критерийзачета', 'scoring'],
  ['принципоценки', 'scoring']
]);

const STUDENT_HIDDEN_SECTION_PATTERNS = [
  /^\[test red flags\]$/i,
  /^пояснение$/i,
  /^почему/i,
  /^оценивание$/i,
  /^принцип оценки$/i,
  /^зачет$/i,
  /^правильн/i
];

const readProjectFile = async (relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  return fs.readFile(absolutePath, 'utf8');
};

const cleanText = (value) => String(value || '').trim();

const stripMarkdown = (value) =>
  cleanText(value)
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[*-]\s+/gm, '')
    .trim();

const normalizeSectionKey = (value) =>
  cleanText(value)
    .replace(/\s+/g, ' ')
    .replace(/[.:]+$/g, '')
    .trim();

const normalizeMetaKey = (value) =>
  normalizeSectionKey(value)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]/gi, '');

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
  cleanText(value)
    .replace(/^[([{\s]+/, '')
    .replace(/[)\]}.\s:;,-]+$/g, '')
    .toUpperCase();

const extractChoiceTokens = (text) => {
  const cleaned = stripMarkdown(text);
  const matches = [...cleaned.matchAll(/(?:^|[\s,;|])[\(\[]?([A-Za-zА-Яа-яЁё])(?:[\)\].,:;]|\s|$)/g)];
  return [...new Set(matches.map((match) => normalizeChoiceKey(match[1])).filter(Boolean))];
};

const parseMapToken = (value) => {
  const cleaned = cleanText(value);
  const numeric = cleaned.match(/\d+/)?.[0];
  if (numeric && /^\d+$/.test(cleaned.replace(/[().\s-]/g, ''))) {
    return numeric;
  }

  const compact = cleaned.replace(/[().,\s-]/g, '');
  const choiceToken = compact.length === 1 ? extractChoiceTokens(cleaned)[0] : null;
  return choiceToken || normalizeComparableText(cleaned);
};

const isHiddenStudentSection = (key) => {
  const normalizedKey = normalizeComparableText(key);
  return STUDENT_HIDDEN_SECTION_PATTERNS.some((pattern) => pattern.test(normalizedKey));
};

const parseListItems = (markdown) =>
  cleanText(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim());

const parseOrderedItems = (markdown) =>
  cleanText(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, '').trim());

const parseOptions = (markdown) => {
  const options = [];

  for (const line of cleanText(markdown).split('\n')) {
    let raw = line.trim();
    if (!raw) {
      continue;
    }

    if (/^[-*]\s+/.test(raw)) {
      raw = raw.replace(/^[-*]\s+/, '').trim();
    }

    raw = raw.replace(/^\[[ xX]\]\s*/, '').trim();
    raw = raw.replace(/\*\*/g, '');

    const match = raw.match(/^[\s\[{(]*([A-Za-zА-Яа-яЁё])[\s)\].}]?\s*[-—–:]?\s*(.+)$/);
    if (!match) {
      continue;
    }

    options.push({
      key: normalizeChoiceKey(match[1]),
      label: cleanText(match[2])
    });
  }

  return options;
};

const parseTableBlock = (markdown) => {
  const rows = cleanText(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cleanText(cell)));

  return rows.filter((row) => row.length >= 2);
};

const parseTopMeta = (markdown, questionCount) => {
  const result = {
    totalQuestions: questionCount,
    estimatedTime: '',
    passThreshold: '',
    attemptsAllowed: ''
  };

  const topBlock = markdown.split(/^##\s+Вопрос\s+\d+\s*$/m)[0] || '';
  const tableRows = parseTableBlock(topBlock);

  for (const row of tableRows) {
    const key = normalizeComparableText(row[0]);
    const value = cleanText(row[1]);

    if (!key || /^[-: ]+$/.test(key)) {
      continue;
    }

    if (key.includes('количество вопросов')) {
      result.totalQuestions = Number.parseInt(value, 10) || questionCount;
    }

    if (key.includes('время')) {
      result.estimatedTime = value;
    }

    if (key.includes('проходной')) {
      result.passThreshold = value;
    }

    if (key.includes('попыт')) {
      result.attemptsAllowed = value;
    }
  }

  const inlineParams = topBlock.match(/\*\*Параметры:\*\*\s*(.+)$/m);
  if (inlineParams) {
    const raw = inlineParams[1];
    const questionsMatch = raw.match(/(\d+)\s+вопрос/i);
    const timeMatch = raw.match(/(\d+\s*минут[аы]?)/i);
    const passMatch = raw.match(/Проходной балл:\s*([^·]+)/i);
    const attemptsMatch = raw.match(/(\d+)\s+попыт/i);

    if (questionsMatch) {
      result.totalQuestions = Number.parseInt(questionsMatch[1], 10) || result.totalQuestions;
    }

    if (timeMatch && !result.estimatedTime) {
      result.estimatedTime = cleanText(timeMatch[1]);
    }

    if (passMatch && !result.passThreshold) {
      result.passThreshold = cleanText(passMatch[1]);
    }

    if (attemptsMatch && !result.attemptsAllowed) {
      result.attemptsAllowed = attemptsMatch[1];
    }
  }

  const instructionMatch = topBlock.match(/##\s+Инструкция для участника\s+([\s\S]*?)(?=\n##\s+Вопрос\s+\d+)/m);
  if (instructionMatch) {
    const text = stripMarkdown(instructionMatch[1]);
    const timeMatch = text.match(/Время:\s*([^.\n]+)/i);
    const passMatch = text.match(/Проходной балл:\s*([^.\n]+)/i);
    const attemptsMatch = text.match(/Попытки:\s*([^.\n]+)/i);

    if (timeMatch && !result.estimatedTime) {
      result.estimatedTime = cleanText(timeMatch[1]);
    }

    if (passMatch && !result.passThreshold) {
      result.passThreshold = cleanText(passMatch[1]);
    }

    if (attemptsMatch && !result.attemptsAllowed) {
      result.attemptsAllowed = cleanText(attemptsMatch[1]);
    }
  }

  const plainTop = stripMarkdown(topBlock);
  const fallbackTimeMatch = plainTop.match(/Время(?: на выполнение)?:\s*([^\n.]+)/i);
  const fallbackPassMatch = plainTop.match(/Проходн(?:ой уровень|ой балл):\s*([^\n.]+)/i);
  const fallbackAttemptsMatch = plainTop.match(/Попытк[аи]?:\s*([^\n.]+)/i);

  if (fallbackTimeMatch && !result.estimatedTime) {
    result.estimatedTime = cleanText(fallbackTimeMatch[1]);
  }

  if (fallbackPassMatch && !result.passThreshold) {
    result.passThreshold = cleanText(fallbackPassMatch[1]);
  }

  if (fallbackAttemptsMatch && !result.attemptsAllowed) {
    result.attemptsAllowed = cleanText(fallbackAttemptsMatch[1]);
  }

  const plainAll = stripMarkdown(markdown);
  const notesPassMatch = plainAll.match(/Проходн(?:ой уровень|ой балл)\.?\s*([^\n]+)/i);
  const notesTimeMatch = plainAll.match(/Время\.?\s*([^\n]+)/i);
  const notesAttemptsDigitsMatch = plainAll.match(/(\d+)\s+попыт/i);
  const notesAttemptsWordsMatch = plainAll.match(/(одна|две|три|четыре|пять)\s+попыт/i);
  const attemptsWordMap = {
    одна: '1',
    две: '2',
    три: '3',
    четыре: '4',
    пять: '5'
  };

  if (notesPassMatch && !result.passThreshold) {
    result.passThreshold = cleanText(notesPassMatch[1]);
  }

  if (notesTimeMatch && !result.estimatedTime) {
    result.estimatedTime = cleanText(notesTimeMatch[1]);
  }

  if (notesAttemptsDigitsMatch && !result.attemptsAllowed) {
    result.attemptsAllowed = cleanText(notesAttemptsDigitsMatch[1]);
  }

  if (notesAttemptsWordsMatch && !result.attemptsAllowed) {
    result.attemptsAllowed = attemptsWordMap[notesAttemptsWordsMatch[1].toLowerCase()] || '';
  }

  return result;
};

const parseMatchingThreshold = (text, totalPairs) => {
  const raw = cleanText(text);
  if (!raw) {
    return totalPairs;
  }

  const exactMatch = raw.match(/минимум\s+(\d+)\s+из\s+(\d+)/i);
  if (exactMatch) {
    return Number.parseInt(exactMatch[1], 10) || totalPairs;
  }

  const fallbackMatch = raw.match(/минимум\s+(\d+)/i);
  if (fallbackMatch) {
    return Number.parseInt(fallbackMatch[1], 10) || totalPairs;
  }

  return totalPairs;
};

const parsePassThresholdValue = (text, totalQuestions) => {
  const exactMatch = String(text || '').match(/(\d+)\s+из\s+\d+/i);
  if (exactMatch) {
    return Number.parseInt(exactMatch[1], 10);
  }

  const percentMatch = String(text || '').match(/(\d+)\s*%/);
  if (percentMatch && totalQuestions) {
    const percent = Number.parseInt(percentMatch[1], 10);
    return Math.ceil((percent / 100) * totalQuestions);
  }

  return null;
};

const extractQuestionBlocks = (markdown) => {
  const starts = [];
  const regex = /^##\s+Вопрос\s+(\d+)\s*$/gm;
  let match = null;

  while ((match = regex.exec(markdown)) !== null) {
    starts.push({
      number: Number.parseInt(match[1], 10),
      index: match.index,
      headingLength: match[0].length
    });
  }

  const topLevelHeadings = [];
  const topLevelRegex = /^##\s+(.+?)\s*$/gm;
  let topLevelMatch = null;

  while ((topLevelMatch = topLevelRegex.exec(markdown)) !== null) {
    const title = cleanText(topLevelMatch[1]);
    if (
      /^Вопрос\s+\d+$/i.test(title) ||
      /^Вопросы\s+\d+\s+и\s+\d+\s+—\s+общий кейс$/i.test(title)
    ) {
      continue;
    }

    topLevelHeadings.push({
      title,
      index: topLevelMatch.index
    });
  }

  const sharedCases = [];
  const sharedRegex = /^##\s+Вопросы\s+(\d+)\s+и\s+(\d+)\s+—\s+общий кейс\s*$/gm;
  let sharedMatch = null;

  while ((sharedMatch = sharedRegex.exec(markdown)) !== null) {
    const startQuestion = Number.parseInt(sharedMatch[1], 10);
    const endQuestion = Number.parseInt(sharedMatch[2], 10);
    const blockEndCandidates = [
      starts.find((item) => item.index > sharedMatch.index)?.index,
      topLevelHeadings.find((item) => item.index > sharedMatch.index)?.index
    ].filter((value) => typeof value === 'number');
    const blockEnd =
      blockEndCandidates.length > 0 ? Math.min(...blockEndCandidates) : markdown.length;
    const rawBlock = markdown.slice(sharedMatch.index + sharedMatch[0].length, blockEnd).trim();
    const sharedBlock = rawBlock.includes('\n### ')
      ? rawBlock.slice(rawBlock.indexOf('\n### ') + 1).trim()
      : rawBlock;

    sharedCases.push({
      startQuestion,
      endQuestion,
      index: sharedMatch.index,
      markdown: sharedBlock
    });
  }

  return starts.map((item, index) => {
    const start = item.index + item.headingLength;
    const blockEndCandidates = [
      index + 1 < starts.length ? starts[index + 1].index : null,
      sharedCases.find((shared) => shared.index > item.index)?.index,
      topLevelHeadings.find((heading) => heading.index > item.index)?.index
    ].filter((value) => typeof value === 'number');
    const end = blockEndCandidates.length > 0 ? Math.min(...blockEndCandidates) : markdown.length;
    const block = markdown.slice(start, end).trim();

    const sharedPrefix = sharedCases
      .filter((shared) => item.number >= shared.startQuestion && item.number <= shared.endQuestion)
      .map((shared) => shared.markdown)
      .filter(Boolean)
      .join('\n\n');

    return {
      number: item.number,
      markdown: sharedPrefix ? `${sharedPrefix}\n\n${block}` : block
    };
  });
};

const parseQuestionMetadata = (block) => {
  const metadata = {
    type: '',
    goal: '',
    lesson: '',
    difficulty: '',
    scoring: ''
  };

  for (const line of block.split('\n')) {
    const trimmed = line.trim();

    const tableMatch = trimmed.match(/^\|\s*\**([^|*]+?)\**\s*\|\s*([^|]+?)\s*\|$/);
    if (tableMatch) {
      const metaKey = QUESTION_META_KEYS.get(normalizeMetaKey(tableMatch[1]));
      if (metaKey) {
        metadata[metaKey] = cleanText(tableMatch[2]);
      }
      continue;
    }

    const strongMatch =
      trimmed.match(/^\*\*([^*]+?):\*\*\s*(.+)$/) ||
      trimmed.match(/^\*\*([^*]+)\*\*:\s*(.+)$/);

    if (!strongMatch) {
      continue;
    }

    const metaKey = QUESTION_META_KEYS.get(normalizeMetaKey(strongMatch[1]));
    if (metaKey) {
      metadata[metaKey] = cleanText(strongMatch[2]);
    }
  }

  return metadata;
};

const parseSections = (block) => {
  const lines = block.split('\n');
  const sections = {};
  let current = '__intro__';
  sections[current] = [];

  const ensureSection = (name) => {
    if (!sections[name]) {
      sections[name] = [];
    }
    current = name;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (current === '__intro__' && line.startsWith('|')) {
      continue;
    }

    const tableMetaMatch = line.match(/^\|\s*\**([^|*]+?)\**\s*\|\s*([^|]+?)\s*\|$/);
    if (tableMetaMatch && QUESTION_META_KEYS.get(normalizeMetaKey(tableMetaMatch[1]))) {
      continue;
    }

    if (/^\|\s*:?-{2,}:?\s*\|/.test(line)) {
      continue;
    }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      ensureSection(normalizeSectionKey(headingMatch[1]));
      continue;
    }

    const strongSectionMatch =
      line.match(/^\*\*([^*]+?):\*\*\s*(.*)$/) ||
      line.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);

    if (strongSectionMatch) {
      const name = normalizeSectionKey(strongSectionMatch[1]);
      const metaKey = QUESTION_META_KEYS.get(normalizeMetaKey(name));

      if (metaKey) {
        continue;
      }

      ensureSection(name);
      if (strongSectionMatch[2]) {
        sections[current].push(strongSectionMatch[2]);
      }
      continue;
    }

    const plainSectionMatch = line.match(/^([^:#|][^:]{1,80}):\s*$/);
    if (plainSectionMatch) {
      ensureSection(normalizeSectionKey(plainSectionMatch[1]));
      continue;
    }

    sections[current].push(rawLine);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, cleanText(value.join('\n'))]).filter(([, value]) => value)
  );
};

const detectInteraction = (typeLabel, options) => {
  const type = normalizeComparableText(typeLabel);

  if (type.includes('порядок')) {
    return 'ordering';
  }

  if (
    type.includes('множественный') ||
    type.includes('несколько правильных') ||
    type.includes('выбрать все') ||
    type.includes('выбрать 3 из 6') ||
    type.includes('выбрать 5 из 8')
  ) {
    return 'multi_choice';
  }

  if (
    type.includes('сопоставление') ||
    type.includes('для каждой из') ||
    type.includes('4 элемента')
  ) {
    return 'matching_text';
  }

  if (
    type.includes('единственный выбор') ||
    type.includes('один вариант') ||
    type.includes('один правильный') ||
    type.includes('вариантами ответа') ||
    type.includes('выбор лучшего') ||
    type.includes('1 из')
  ) {
    return 'single_choice';
  }

  if (options.length > 0) {
    return 'single_choice';
  }

  return 'open_text';
};

const findSectionName = (sections, predicate) =>
  Object.keys(sections).find((key) => predicate(normalizeComparableText(key)));

const buildPromptMarkdown = (sections, interaction, hiddenKeys = new Set()) => {
  const chunks = [];

  for (const [key, value] of Object.entries(sections)) {
    if (!value) {
      continue;
    }

    if (hiddenKeys.has(key) || isHiddenStudentSection(key)) {
      continue;
    }

    const normalizedKey = normalizeComparableText(key);

    if (interaction === 'single_choice' || interaction === 'multi_choice') {
      if (normalizedKey === 'варианты ответов') {
        continue;
      }
    }

    if (key === '__intro__') {
      chunks.push(value);
    } else {
      chunks.push(`### ${key}\n\n${value}`);
    }
  }

  return chunks
    .join('\n\n')
    .replace(/^\|\s*Параметр\s*\|\s*Значение\s*\|\s*\n?/i, '')
    .replace(/^\|\s*[-:| ]+\|\s*\n?/i, '')
    .trim();
};

const parseExpectedMap = (text) => {
  const expected = {};
  const cleaned = cleanText(text);
  const fragments = cleaned
    .split('\n')
    .flatMap((line) => line.split(';'))
    .flatMap((line) => line.split('|'))
    .map((line) => line.trim())
    .filter(Boolean);

  for (const [index, trimmed] of fragments.entries()) {
    if (!trimmed) {
      continue;
    }

    const pairMatch = trimmed.match(/^(.+?)\s*(?:→|=>|->|=|-|:)\s*(.+)$/);
    if (pairMatch) {
      const leftToken = parseMapToken(pairMatch[1]);
      const rightToken = parseMapToken(pairMatch[2]);
      expected[leftToken] = rightToken;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const row = trimmed.replace(/^\||\|$/g, '').split('|').map((cell) => cleanText(cell));
      if (row.length < 2 || /^:?-+:?$/.test(row[0])) {
        continue;
      }

      const leftToken = parseMapToken(row[0]) || String(index + 1);
      const rightToken = parseMapToken(row[1]);
      expected[leftToken] = rightToken;
      continue;
    }
  }

  return expected;
};

const parseOrderingData = (sections) => {
  const shuffledSectionName = Object.keys(sections).find((key) =>
    /шаги|этапы/i.test(key) && /перемешан/i.test(key)
  );
  const correctSectionName = findSectionName(sections, (key) => key.startsWith('правильный порядок'));

  if (!shuffledSectionName || !correctSectionName) {
    return null;
  }

  const shuffledItems = parseListItems(sections[shuffledSectionName]);
  const orderedItems = parseOrderedItems(sections[correctSectionName]);

  if (shuffledItems.length === 0 || orderedItems.length === 0) {
    return null;
  }

  const orderedNormalized = orderedItems.map((item) => normalizeComparableText(item));
  const scoreSimilarity = (left, right) => {
    const leftWords = left.split(' ').filter(Boolean);
    const rightWords = right.split(' ').filter(Boolean);
    const overlap = leftWords.filter((word) => rightWords.includes(word)).length;
    const prefixBoost = leftWords.slice(0, 4).filter((word, index) => rightWords[index] === word).length;
    return overlap + prefixBoost;
  };

  const solution = shuffledItems.map((item) => {
    const normalizedItem = normalizeComparableText(item);
    let bestIndex = -1;
    let bestScore = -1;

    orderedNormalized.forEach((candidate, index) => {
      const directMatch = candidate === normalizedItem || candidate.includes(normalizedItem) || normalizedItem.includes(candidate);
      const score = directMatch ? 1000 : scoreSimilarity(normalizedItem, candidate);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex >= 0 ? bestIndex + 1 : null;
  });

  return {
    items: shuffledItems,
    solution
  };
};

const buildGrading = (question) => {
  const { interaction, correctAnswer } = question;

  if (interaction === 'single_choice') {
    const token = extractChoiceTokens(correctAnswer)[0];
    return token ? { mode: 'single_choice', correctKey: token } : { mode: 'manual' };
  }

  if (interaction === 'multi_choice') {
    const keys = extractChoiceTokens(correctAnswer);
    return keys.length > 0 ? { mode: 'multi_choice', correctKeys: keys } : { mode: 'manual' };
  }

  if (interaction === 'matching_text') {
    const expectedMap = parseExpectedMap(correctAnswer);
    return Object.keys(expectedMap).length > 0
      ? {
          mode: 'matching_text',
          expectedMap,
          minCorrect: parseMatchingThreshold(question.scoring, Object.keys(expectedMap).length)
        }
      : { mode: 'manual' };
  }

  if (interaction === 'ordering' && question.ordering) {
    return {
      mode: 'ordering',
      solution: question.ordering.solution
    };
  }

  return { mode: 'manual' };
};

const parseQuestion = (entry) => {
  const metadata = parseQuestionMetadata(entry.markdown);
  const sections = parseSections(entry.markdown);

  const optionsSectionName = findSectionName(sections, (key) => key === 'варианты ответов');
  const correctSectionName = findSectionName(
    sections,
    (key) =>
      key.startsWith('правильный ответ') ||
      key.startsWith('правильные ответы') ||
      key.startsWith('правильные пары') ||
      key.startsWith('правильный порядок')
  );
  const explanationSectionName = findSectionName(sections, (key) => key === 'пояснение');
  const scoringSectionName = findSectionName(
    sections,
    (key) => key === 'зачет' || key === 'критерий зачета' || key === 'принцип оценки' || key === 'оценивание'
  );
  const hiddenPromptKeys = new Set();

  const options = optionsSectionName ? parseOptions(sections[optionsSectionName]) : [];
  const interaction = detectInteraction(metadata.type, options);
  const ordering = interaction === 'ordering' ? parseOrderingData(sections) : null;
  let correctAnswer = correctSectionName ? sections[correctSectionName] : '';

  if (correctSectionName) {
    hiddenPromptKeys.add(correctSectionName);
  }

  if (!correctAnswer && interaction === 'matching_text') {
    const hardConstraintsKey = findSectionName(sections, (key) => key === 'hard constraints');
    const optimizersKey = findSectionName(sections, (key) => key === 'optimizers');

    if (hardConstraintsKey && optimizersKey) {
      correctAnswer = [
        `${hardConstraintsKey}: ${stripMarkdown(sections[hardConstraintsKey])}`,
        `${optimizersKey}: ${stripMarkdown(sections[optimizersKey])}`
      ].join('\n');

      hiddenPromptKeys.add(hardConstraintsKey);
      hiddenPromptKeys.add(optimizersKey);
    }
  }

  if (!correctAnswer && interaction === 'matching_text') {
    const groupedAnswerSections = Object.entries(sections).filter(([key, value]) => {
      if (!value || key === '__intro__') {
        return false;
      }

      const normalizedKey = normalizeComparableText(key);
      if (
        normalizedKey === 'текст вопроса' ||
        normalizedKey === 'задание' ||
        normalizedKey.includes('левый столбец') ||
        normalizedKey.includes('правый столбец') ||
        normalizedKey.includes('критерии') ||
        normalizedKey.includes('паттерны') ||
        normalizedKey.includes('варианты')
      ) {
        return false;
      }

      if (isHiddenStudentSection(key)) {
        return false;
      }

      const normalizedValue = normalizeComparableText(value);
      return /^[a-zа-я0-9,\s]+$/i.test(normalizedValue) && normalizedValue.length > 0 && normalizedValue.length < 40;
    });

    if (groupedAnswerSections.length >= 2) {
      correctAnswer = groupedAnswerSections
        .map(([key, value]) => `${key}: ${stripMarkdown(value)}`)
        .join('\n');

      groupedAnswerSections.forEach(([key]) => hiddenPromptKeys.add(key));
    }
  }

  const promptMarkdown = buildPromptMarkdown(sections, interaction, hiddenPromptKeys);
  const explanation = explanationSectionName ? sections[explanationSectionName] : '';

  const question = {
    number: entry.number,
    type: metadata.type,
    goal: metadata.goal,
    lesson: metadata.lesson,
    difficulty: metadata.difficulty,
    scoring: metadata.scoring || (scoringSectionName ? sections[scoringSectionName] : ''),
    interaction,
    promptMarkdown,
    options,
    correctAnswer,
    explanation,
    ordering
  };

  question.grading = buildGrading(question);
  return question;
};

const parseTest = (moduleConfig, markdown) => {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  const rawHeading = headingMatch ? cleanText(headingMatch[1]) : moduleConfig.title;
  const questionBlocks = extractQuestionBlocks(markdown);
  const questions = questionBlocks.map(parseQuestion);
  const topMeta = parseTopMeta(markdown, questions.length);
  const plainMarkdown = stripMarkdown(markdown);
  const attemptsWordMap = {
    одна: '1',
    две: '2',
    три: '3',
    четыре: '4',
    пять: '5'
  };
  const sanitizePassThreshold = (value) =>
    cleanText(value).split('. ')[0].replace(/[.]+$/g, '').trim();
  const rawPassThreshold = cleanText(plainMarkdown.match(/Проходн(?:ой уровень|ой балл)\.?\s*([^\n]+)/i)?.[1] || '');
  const fallbackPassThreshold =
    sanitizePassThreshold(topMeta.passThreshold) || sanitizePassThreshold(rawPassThreshold);
  const fallbackEstimatedTime =
    topMeta.estimatedTime || cleanText(plainMarkdown.match(/Время\.?\s*([^\n]+)/i)?.[1] || '').replace(/[.]+$/g, '').trim();
  const fallbackAttemptsAllowed =
    topMeta.attemptsAllowed ||
    cleanText(plainMarkdown.match(/(\d+)\s+попыт/i)?.[1] || '') ||
    attemptsWordMap[plainMarkdown.match(/(одна|две|три|четыре|пять)\s+попыт/i)?.[1]?.toLowerCase() || ''] ||
    '';

  return {
    id: moduleConfig.id,
    number: moduleConfig.number,
    title: moduleConfig.title,
    testTitle: rawHeading,
    sourceFile: moduleConfig.testFile,
    totalQuestions: topMeta.totalQuestions,
    estimatedTime: fallbackEstimatedTime,
    passThreshold: fallbackPassThreshold,
    passThresholdValue: parsePassThresholdValue(fallbackPassThreshold, questions.length),
    attemptsAllowed: fallbackAttemptsAllowed,
    questions
  };
};

const buildData = async () => {
  const modules = [];

  for (const moduleConfig of MODULES) {
    const markdown = await readProjectFile(moduleConfig.testFile);
    modules.push(parseTest(moduleConfig, markdown));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    siteTitle: 'Межмодульное тестирование',
    courseTitle: 'ИИ для предпринимателей и специалистов',
    modules
  };

  const outputPath = path.join(siteRoot, 'data', 'course-data.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`OK: ${path.relative(siteRoot, outputPath)}`);
  console.log(`Modules: ${modules.length}`);
  console.log(`Questions: ${modules.reduce((total, module) => total + module.questions.length, 0)}`);
};

buildData().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
