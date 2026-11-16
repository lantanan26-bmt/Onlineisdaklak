import { GradeExamProfile, Teacher } from '../types';
import { getInitialTeachers } from '../demoData';
import { getDefaultGradeExams } from './gradeExamManager';
import { getInitialSyncStorage, loadFromStorage, saveToStorage } from './storage';

export const SYNC_META_STORAGE_KEY = 'ismart_sync_meta_v1';

export interface SyncMeta {
  initialized: boolean;
  dirtyConfig: boolean;
  configUpdatedAtMs: number;
  dirtyExams: boolean;
  dirtyExamIds: string[];
  deletedExamIds: string[];
  hasCustomExams: boolean;
  dirtyTeachers: boolean;
  teachersUpdatedAtMs: number;
  deletedTeacherUsernames: string[];
  hasCustomTeachers: boolean;
  dirtyStudents: boolean;
  studentsUpdatedAtMs: number;
  deletedStudentIds: string[];
}

export function createDefaultSyncMeta(): SyncMeta {
  return {
    initialized: false,
    dirtyConfig: false,
    configUpdatedAtMs: 0,
    dirtyExams: false,
    dirtyExamIds: [],
    deletedExamIds: [],
    hasCustomExams: false,
    dirtyTeachers: false,
    teachersUpdatedAtMs: 0,
    deletedTeacherUsernames: [],
    hasCustomTeachers: false,
    dirtyStudents: false,
    studentsUpdatedAtMs: 0,
    deletedStudentIds: [],
  };
}

function normalizeSyncMeta(raw: any): SyncMeta {
  const base = createDefaultSyncMeta();
  if (!raw || typeof raw !== 'object') return base;
  return {
    initialized: Boolean(raw.initialized),
    dirtyConfig: Boolean(raw.dirtyConfig),
    configUpdatedAtMs: Number(raw.configUpdatedAtMs || 0),
    dirtyExams: Boolean(raw.dirtyExams),
    dirtyExamIds: Array.isArray(raw.dirtyExamIds) ? Array.from(new Set(raw.dirtyExamIds.map(String))) : [],
    deletedExamIds: Array.isArray(raw.deletedExamIds) ? Array.from(new Set(raw.deletedExamIds.map(String))) : [],
    hasCustomExams: Boolean(raw.hasCustomExams),
    dirtyTeachers: Boolean(raw.dirtyTeachers),
    teachersUpdatedAtMs: Number(raw.teachersUpdatedAtMs || 0),
    deletedTeacherUsernames: Array.isArray(raw.deletedTeacherUsernames)
      ? Array.from(new Set(raw.deletedTeacherUsernames.map((u: any) => normalizeTeacherKey(String(u))).filter(Boolean)))
      : [],
    hasCustomTeachers: Boolean(raw.hasCustomTeachers),
    dirtyStudents: Boolean(raw.dirtyStudents),
    studentsUpdatedAtMs: Number(raw.studentsUpdatedAtMs || 0),
    deletedStudentIds: Array.isArray(raw.deletedStudentIds) ? Array.from(new Set(raw.deletedStudentIds.map(String))) : [],
  };
}

export function loadSyncMetaSync(): SyncMeta {
  const raw = getInitialSyncStorage<SyncMeta | null>(SYNC_META_STORAGE_KEY, null);
  return normalizeSyncMeta(raw);
}

export async function loadSyncMetaAsync(): Promise<SyncMeta> {
  const raw = await loadFromStorage<SyncMeta | null>(SYNC_META_STORAGE_KEY, null);
  return normalizeSyncMeta(raw);
}

export function persistSyncMeta(meta: SyncMeta): void {
  const normalized = normalizeSyncMeta({ ...meta, initialized: true });
  try {
    localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
  saveToStorage(SYNC_META_STORAGE_KEY, normalized).catch(() => {});
}

export function normalizeTeacherKey(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '_')
    .slice(0, 120);
}

/**
 * Compares pre-existing saved teachers against demo defaults so manual edits
 * saved before SyncMeta existed are automatically preserved and protected.
 */
function stripVolatileTeacherFields(t: Teacher) {
  return {
    id: t.id,
    name: (t.name || '').trim(),
    username: (t.username || '').trim().toLowerCase(),
    email: (t.email || '').trim().toLowerCase(),
    phone: (t.phone || '').trim(),
    assignedGrades: [...(t.assignedGrades || [])].sort(),
    permissions: [...(t.permissions || [])].sort(),
    isActive: t.isActive !== false,
  };
}

export function detectCustomTeachersComparedToDefaults(savedTeachers: Teacher[]): boolean {
  const defaults = getInitialTeachers();
  if (savedTeachers.length !== defaults.length) return true;
  const normSaved = savedTeachers.map(stripVolatileTeacherFields).sort((a, b) => a.username.localeCompare(b.username));
  const normDefaults = defaults.map(stripVolatileTeacherFields).sort((a, b) => a.username.localeCompare(b.username));
  return JSON.stringify(normSaved) !== JSON.stringify(normDefaults);
}

export function detectModifiedExamIdsComparedToDefaults(savedExams: GradeExamProfile[]): string[] {
  const defaults = getDefaultGradeExams();
  const defaultMap = new Map(defaults.map((d) => [d.id, d]));
  const modifiedIds: string[] = [];

  for (const ex of savedExams) {
    const def = defaultMap.get(ex.id);
    if (!def) {
      modifiedIds.push(ex.id);
      continue;
    }
    if (
      ex.title !== def.title ||
      ex.grade !== def.grade ||
      (ex.className || 'Tất cả các lớp') !== (def.className || 'Tất cả các lớp') ||
      (ex.description || '') !== (def.description || '') ||
      Number(ex.examMinutes) !== Number(def.examMinutes) ||
      (ex.parts?.length || 0) !== (def.parts?.length || 0) ||
      (ex.questions?.length || 0) !== (def.questions?.length || 0) ||
      JSON.stringify(ex.parts) !== JSON.stringify(def.parts) ||
      JSON.stringify(ex.questions) !== JSON.stringify(def.questions)
    ) {
      modifiedIds.push(ex.id);
    }
  }
  return modifiedIds;
}

export function detectDeletedDefaultExamIds(savedExams: GradeExamProfile[]): string[] {
  const savedIds = new Set(savedExams.map((e) => e.id));
  return getDefaultGradeExams()
    .map((d) => d.id)
    .filter((id) => !savedIds.has(id));
}

export function detectDeletedDefaultTeacherUsernames(savedTeachers: Teacher[]): string[] {
  const savedKeys = new Set(savedTeachers.map((t) => normalizeTeacherKey(t.username)));
  return getInitialTeachers()
    .map((t) => normalizeTeacherKey(t.username))
    .filter((k) => !savedKeys.has(k));
}
