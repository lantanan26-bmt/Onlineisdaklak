import { ExamPart, PartScoreRecord, SectionScoreRecord, ExamSection, Question, StoryWordBankConfig } from '../types';

export interface SectionMeta {
  id: string;
  name: string;
  titleVi: string;
  icon: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  textColor: string;
}

export const SECTIONS_CONFIG: Record<string, SectionMeta> = {
  listening: {
    id: 'listening',
    name: 'Listening',
    titleVi: 'Phần Thi Nghe (Listening)',
    icon: 'fa-headphones',
    color: 'blue',
    badgeBg: 'bg-blue-600',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700'
  },
  'reading-writing': {
    id: 'reading-writing',
    name: 'Reading and Writing',
    titleVi: 'Phần Thi Đọc & Viết (Reading and Writing)',
    icon: 'fa-book-open-reader',
    color: 'emerald',
    badgeBg: 'bg-emerald-600',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700'
  },
  speaking: {
    id: 'speaking',
    name: 'Speaking',
    titleVi: 'Phần Thi Nói (Speaking)',
    icon: 'fa-microphone',
    color: 'amber',
    badgeBg: 'bg-amber-600',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700'
  }
};

/**
 * Determines which exam section a part belongs to.
 * Supports explicit part.section as well as smart fallback from part title/id.
 */
export function getPartSection(part: ExamPart): SectionMeta {
  if (part.section && SECTIONS_CONFIG[part.section]) {
    return SECTIONS_CONFIG[part.section];
  }
  const lowTitle = (part.title || '').toLowerCase();
  const lowId = (part.id || '').toLowerCase();

  if (lowTitle.includes('listen') || lowTitle.includes('nghe') || lowId.includes('listen')) {
    return SECTIONS_CONFIG.listening;
  }
  if (
    lowTitle.includes('read') ||
    lowTitle.includes('writ') ||
    lowTitle.includes('đọc') ||
    lowTitle.includes('viết') ||
    lowTitle.includes('tick') ||
    lowTitle.includes('word') ||
    lowTitle.includes('story') ||
    lowId.includes('read')
  ) {
    return SECTIONS_CONFIG['reading-writing'];
  }
  if (lowTitle.includes('speak') || lowTitle.includes('nói') || lowId.includes('speak')) {
    return SECTIONS_CONFIG.speaking;
  }

  // Fallback to listening if part-1 or reading-writing for others
  if (lowTitle.includes('part 1') || lowId.endsWith('-1')) {
    return SECTIONS_CONFIG.listening;
  }
  return SECTIONS_CONFIG['reading-writing'];
}

export interface GroupedSection {
  meta: SectionMeta;
  parts: ExamPart[];
  totalPoints: number;
}

/**
 * Groups a list of ExamPart by Exam Section in canonical order: Listening -> Reading and Writing.
 */
export function groupPartsBySection(parts: ExamPart[]): GroupedSection[] {
  const groups: Record<string, ExamPart[]> = {
    listening: [],
    'reading-writing': []
  };

  parts.forEach((p) => {
    const section = getPartSection(p);
    const secId: ExamSection = section.id === 'listening' ? 'listening' : 'reading-writing';
    if (!groups[secId]) {
      groups[secId] = [];
    }
    groups[secId].push({
      ...p,
      section: secId
    });
  });

  const orderedKeys = ['listening', 'reading-writing', 'speaking'];
  const result: GroupedSection[] = [];

  orderedKeys.forEach((key) => {
    const list = groups[key];
    if (list && list.length > 0) {
      const meta = SECTIONS_CONFIG[key] || {
        id: key,
        name: key,
        titleVi: key,
        icon: 'fa-layer-group',
        color: 'slate',
        badgeBg: 'bg-slate-700',
        borderColor: 'border-slate-300',
        textColor: 'text-slate-800'
      };
      const totalPoints = +(list.reduce((acc, p) => acc + (p.points || 0), 0)).toFixed(2);
      result.push({ meta, parts: list, totalPoints });
    }
  });

  return result;
}

/**
 * Calculate Section-level scores from Part scores
 */
export function calculateSectionScores(
  parts: ExamPart[],
  partScores: Record<string, PartScoreRecord>
): Record<string, SectionScoreRecord> {
  const sections: Record<string, SectionScoreRecord> = {
    listening: {
      section: 'listening',
      sectionTitle: 'Listening',
      earnedPoints: 0,
      totalPoints: 0,
      correctCount: 0,
      questionCount: 0
    },
    'reading-writing': {
      section: 'reading-writing',
      sectionTitle: 'Reading and Writing',
      earnedPoints: 0,
      totalPoints: 0,
      correctCount: 0,
      questionCount: 0
    }
  };

  parts.forEach((p) => {
    const secMeta = getPartSection(p);
    const secId: ExamSection = secMeta.id === 'listening' ? 'listening' : 'reading-writing';
    if (!sections[secId]) {
      sections[secId] = {
        section: secId,
        sectionTitle: secMeta.name,
        earnedPoints: 0,
        totalPoints: 0,
        correctCount: 0,
        questionCount: 0
      };
    }

    const rec = partScores[p.id];
    if (rec) {
      sections[secId].earnedPoints = +(sections[secId].earnedPoints + rec.earnedPoints).toFixed(2);
      sections[secId].totalPoints = +(sections[secId].totalPoints + rec.totalPoints).toFixed(2);
      sections[secId].correctCount += rec.correctCount;
      sections[secId].questionCount += rec.questionCount;
    } else {
      sections[secId].totalPoints = +(sections[secId].totalPoints + (p.points || 0)).toFixed(2);
    }
  });

  return sections;
}

export interface QuestionPartInfo {
  part: ExamPart;
  partGlobalIndex: number;
  partDisplayNumber: number;
  sectionPartIndex: number;
  localIndex: number;
  localQuestionNumber: number;
  totalInPart: number;
  isListening: boolean;
  isExample?: boolean;
}

/**
 * Checks whether a question is an example question (not scored, not answered by student).
 * A question is an example if:
 * 1. q.isExample is explicitly true.
 * 2. Or the question text matches an item in part.examplesList (normalized).
 * 3. Or matches part.example.questionText.
 */
export function isQuestionExample(q: Question | undefined, part?: ExamPart): boolean {
  if (!q) return false;
  if (q.isExample) return true;
  if (part) {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/[^a-z0-9]/g, '');
    const qNorm = norm(q.q || '');
    if (!qNorm) return false;

    if (part.examplesList && part.examplesList.length > 0) {
      if (part.examplesList.some((ex) => norm(ex.question || '') === qNorm)) {
        return true;
      }
    }
    if (part.example?.questionText) {
      const exNorm = norm(part.example.questionText);
      if (exNorm.includes(qNorm) && qNorm.length >= 6) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates per-part question numbering.
 * Real questions start from Câu 1 (e.g. if Câu 1 and Câu 2 are examples, Câu 3 becomes Câu 1 in the exam).
 */
export function getQuestionPartAndIndex(
  q: Question | undefined,
  qIdx: number,
  questions: Question[],
  parts: ExamPart[]
): QuestionPartInfo {
  const fallbackPart: ExamPart = parts[0] || {
    id: 'part-1',
    section: 'listening',
    title: 'Part 1',
    points: 10
  };

  const partId = q?.partId || parts[0]?.id || 'part-1';
  const foundPart = parts.find((p) => p.id === partId) || parts[0] || fallbackPart;
  const partGlobalIndex = Math.max(0, parts.findIndex((p) => p.id === foundPart.id));
  const sectionMeta = getPartSection(foundPart);
  const isListening = sectionMeta.id === 'listening';
  const sameSectionParts = parts.filter((p) => getPartSection(p).id === sectionMeta.id);
  const sectionPartIndex = Math.max(0, sameSectionParts.findIndex((p) => p.id === foundPart.id));
  const partDisplayNumber = sectionPartIndex + 1; // Section-local Part number: Part 1, 2, 3...

  const isCurrentQExample = isQuestionExample(q, foundPart);

  // Find all real (non-example) questions belonging to this part
  const realQIndicesInThisPart: number[] = [];
  const allQIndicesInThisPart: number[] = [];
  questions.forEach((item, idx) => {
    const itemPartId = item.partId || parts[0]?.id;
    if (itemPartId === foundPart.id) {
      allQIndicesInThisPart.push(idx);
      if (!isQuestionExample(item, foundPart)) {
        realQIndicesInThisPart.push(idx);
      }
    }
  });

  const realIdxInPart = realQIndicesInThisPart.indexOf(qIdx);
  const allIdxInPart = allQIndicesInThisPart.indexOf(qIdx);

  // If question is real, its exam number starts at 1 among real questions (e.g. Q3 becomes Câu 1)
  const localIndex = realIdxInPart >= 0 ? realIdxInPart : Math.max(0, allIdxInPart);
  const localQuestionNumber = realIdxInPart >= 0 ? realIdxInPart + 1 : 0;
  const totalInPart = Math.max(
    1,
    realQIndicesInThisPart.length > 0 ? realQIndicesInThisPart.length : allQIndicesInThisPart.length
  );

  return {
    part: foundPart,
    partGlobalIndex,
    partDisplayNumber,
    sectionPartIndex,
    localIndex,
    localQuestionNumber,
    totalInPart,
    isListening,
    isExample: isCurrentQExample
  };
}

/**
 * Ensures questions have valid partIds and groups questions neatly by part order.
 */
export function syncAndSortQuestionsByParts(questions: Question[], parts: ExamPart[]): Question[] {
  if (!parts.length || !questions.length) return questions;

  const partIds = new Set(parts.map((p) => p.id));
  const defaultPartId = parts[0].id;

  // 1. Repair missing or invalid partIds
  const repaired = questions.map((q) => {
    if (q.partId && partIds.has(q.partId)) {
      return q;
    }

    // Try to guess from sectionTitle or text
    const textToSearch = `${q.sectionTitle || ''} ${q.q || ''}`.toLowerCase();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const pTitle = (p.title || '').toLowerCase();
      const pNum = `part ${i + 1}`;
      if (textToSearch.includes(pNum) || (pTitle && textToSearch.includes(pTitle.slice(0, 15)))) {
        return { ...q, partId: p.id };
      }
    }

    return { ...q, partId: defaultPartId };
  });

  // 2. Stable sort questions so questions belonging to earlier parts appear first
  const partOrderMap = new Map<string, number>();
  parts.forEach((p, idx) => partOrderMap.set(p.id, idx));

  return [...repaired].sort((a, b) => {
    const orderA = partOrderMap.get(a.partId || defaultPartId) ?? 999;
    const orderB = partOrderMap.get(b.partId || defaultPartId) ?? 999;
    return orderA - orderB;
  });
}

/**
 * Strips redundant "Part X:" prefix from a part title so it doesn't duplicate or display wrong numbers.
 */
export function getCleanPartTitle(title: string): string {
  if (!title) return '';
  const cleaned = title.replace(/^Part\s*\d+\s*[:\.\-]?\s*/i, '').trim();
  return cleaned || title;
}

/**
 * Formats a clean part title with its section-local number (e.g. "Part 1: Listen and Draw Lines")
 */
export function getFormattedPartTitle(part: ExamPart, sectionIndex: number): string {
  const clean = getCleanPartTitle(part.title);
  return `Part ${sectionIndex + 1}: ${clean}`;
}

/**
 * Guarantees that ALL listening parts come first (Part 1, Part 2...),
 * followed by ALL reading & writing parts (Part 1, Part 2...),
 * preserving relative order within each section.
 */
export function canonicalSortParts(parts: ExamPart[]): ExamPart[] {
  const listening = parts.filter((p) => getPartSection(p).id === 'listening');
  const readingWriting = parts.filter((p) => getPartSection(p).id === 'reading-writing');
  const other = parts.filter(
    (p) => getPartSection(p).id !== 'listening' && getPartSection(p).id !== 'reading-writing'
  );
  return [...listening, ...readingWriting, ...other];
}

/**
 * Renumbers and cleans part titles so each section has Part 1, Part 2, Part 3...
 */
export function renumberPartsBySection(parts: ExamPart[]): ExamPart[] {
  const sorted = canonicalSortParts(parts);
  const listening = sorted.filter((p) => getPartSection(p).id === 'listening');
  const readingWriting = sorted.filter((p) => getPartSection(p).id === 'reading-writing');
  const other = sorted.filter(
    (p) => getPartSection(p).id !== 'listening' && getPartSection(p).id !== 'reading-writing'
  );

  const renumberList = (list: ExamPart[]) => {
    return list.map((p, idx) => {
      const clean = getCleanPartTitle(p.title);
      return {
        ...p,
        title: `Part ${idx + 1}: ${clean}`
      };
    });
  };

  return [...renumberList(listening), ...renumberList(readingWriting), ...other];
}

export interface StoryWordBankPointBreakdown {
  slotKeys: string[];
  slotPointsMap: Record<string, number>;
  autoPerSlotMap: Record<string, number>;
  questionPoints: number;
  sumSlotPoints: number;
  slotCount: number;
  hasCustomPoints: boolean;
  isMatchedWithQuestion: boolean;
}

const roundStoryWordPts = (val: number): number => Math.round(val * 1000) / 1000;

export function getStoryWordBankPointBreakdown(
  storyBank?: StoryWordBankConfig,
  questionPoints?: number
): StoryWordBankPointBreakdown {
  const qPts = Math.max(0, Number(questionPoints ?? 1.0) || 0);
  const answersMap = storyBank?.answers || {};
  const existingNonZero = Object.keys(answersMap).filter((k) => k !== '0');
  const slotKeys = (existingNonZero.length > 0 ? existingNonZero : ['1', '2', '3', '4']).sort(
    (a, b) => Number(a) - Number(b)
  );
  const slotCount = slotKeys.length;

  const autoPerSlotMap: Record<string, number> = {};
  if (slotCount > 0) {
    const baseEach = roundStoryWordPts(qPts / slotCount);
    let runningSum = 0;
    slotKeys.forEach((key, idx) => {
      if (idx === slotCount - 1) {
        autoPerSlotMap[key] = Math.max(0, roundStoryWordPts(qPts - runningSum));
      } else {
        autoPerSlotMap[key] = baseEach;
        runningSum += baseEach;
      }
    });
  }

  const customMap = storyBank?.answerPoints || {};
  const hasCustomPoints = slotKeys.some(
    (k) => typeof customMap[k] === 'number' && Number.isFinite(customMap[k]) && customMap[k] >= 0
  );

  const slotPointsMap: Record<string, number> = {};
  let sumSlotPoints = 0;
  slotKeys.forEach((k) => {
    const raw = customMap[k];
    const pts =
      typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
        ? roundStoryWordPts(raw)
        : (autoPerSlotMap[k] ?? 0);
    slotPointsMap[k] = pts;
    sumSlotPoints += pts;
  });

  sumSlotPoints = roundStoryWordPts(sumSlotPoints);
  const isMatchedWithQuestion = slotCount === 0 ? true : Math.abs(sumSlotPoints - qPts) <= 0.002;

  return {
    slotKeys,
    slotPointsMap,
    autoPerSlotMap,
    questionPoints: qPts,
    sumSlotPoints,
    slotCount,
    hasCustomPoints,
    isMatchedWithQuestion,
  };
}


