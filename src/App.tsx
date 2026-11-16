/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppBranding, ViewMode, Question, Student, ExamPart, PartScoreRecord, SectionScoreRecord, GradeExamProfile, Teacher, UserRole } from './types';
import {
  getInitialQuestions,
  getInitialSchools,
  getInitialStudents,
  getInitialParts,
  getAdvancedGrade2Questions,
  getAdvancedGrade2Parts,
  getInitialTeachers
} from './demoData';
import { getDefaultGradeExams, findExamForStudent } from './utils/gradeExamManager';
import { AdminQuestionEditor } from './components/AdminQuestionEditor';
import { StudentManager } from './components/StudentManager';
import { StudentExamPlayer } from './components/StudentExamPlayer';
import { JsonConfigView } from './components/JsonConfigView';
import { AdminPinModal } from './components/AdminPinModal';
import { ConfirmModal } from './components/ConfirmModal';
import { PdfExamImporterModal } from './components/PdfExamImporterModal';
import { CameraExamGraderModal } from './components/CameraExamGraderModal';
import { OfflineExamPrinterModal } from './components/OfflineExamPrinterModal';
import { PortalLanding } from './components/PortalLanding';
import { TeacherManager } from './components/TeacherManager';
import { ExamScoreManager } from './components/ExamScoreManager';
import { ExportOnlineExamModal } from './components/ExportOnlineExamModal';
import { AdminBrandingModal } from './components/AdminBrandingModal';
import { LanguageToggleButton } from './components/LanguageToggleButton';
import { useLanguage } from './contexts/LanguageContext';
import { canonicalSortParts } from './utils/sectionUtils';
import { saveToStorage, loadFromStorage, getInitialSyncStorage } from './utils/storage';
import {
  SyncMeta,
  createDefaultSyncMeta,
  detectCustomTeachersComparedToDefaults,
  detectDeletedDefaultExamIds,
  detectDeletedDefaultTeacherUsernames,
  detectModifiedExamIdsComparedToDefaults,
  loadSyncMetaAsync,
  loadSyncMetaSync,
  normalizeTeacherKey,
  persistSyncMeta,
} from './utils/syncState';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import {
  checkCloudConnectionStatus,
  CloudInventorySummary,
  CloudSyncReport,
  deleteExamFromCloud,
  deleteStudentsFromCloud,
  deleteTeacherUsernameFromCloud,
  fetchAllStudentsFromCloud,
  fetchAppConfigFromCloud,
  fetchCloudInventorySummary,
  fetchPublishedExamsFromCloud,
  fetchTeachersForAdminFromCloud,
  formatCloudError,
  lookupStudentByIdFromCloud,
  lookupStudentsByClassFromCloud,
  lookupTeacherPublicByUsername,
  resetStudentsScoreInCloud,
  saveAppConfigToCloud,
  saveGradeExamToCloud,
  saveTeachersToCloud,
  submitStudentScoreToCloud,
  syncAllDataToCloud,
  syncStudentsBatchToCloud,
  verifyTeacherLoginFromCloud,
} from './services/firebaseService';

function mergeExamsList(
  local: GradeExamProfile[],
  cloud: GradeExamProfile[],
  meta: SyncMeta
): GradeExamProfile[] {
  if (!cloud || cloud.length === 0) return local;
  const deletedSet = new Set(meta.deletedExamIds);
  const dirtySet = new Set(meta.dirtyExamIds);
  const localMap = new Map(local.map((e) => [e.id, e]));

  const filteredCloud = cloud.filter((ce) => !deletedSet.has(ce.id));
  const cloudIds = new Set(filteredCloud.map((ce) => ce.id));

  const merged = filteredCloud.map((ce) => {
    const le = localMap.get(ce.id);
    if (!le) return ce;
    if (dirtySet.has(ce.id)) {
      return le;
    }
    const localTs = le.updatedAtMs || 0;
    const cloudTs = ce.updatedAtMs || 0;
    if (localTs > 0 && (cloudTs === 0 || localTs > cloudTs + 1500)) {
      return le;
    }
    if (le.isCustom && !ce.isCustom && cloudTs === 0) {
      return le;
    }
    if (cloudTs > localTs + 1500) {
      return ce;
    }
    return le.updatedAtMs ? le : ce;
  });

  // Preserve locally added / customized exams not yet present on Cloud (unless explicitly deleted)
  const extraLocal = local.filter(
    (le) =>
      !cloudIds.has(le.id) &&
      !deletedSet.has(le.id) &&
      (dirtySet.has(le.id) || le.isCustom || (le.updatedAtMs || 0) > 0 || meta.hasCustomExams)
  );
  return [...extraLocal, ...merged];
}

function mergeStudentsList(
  local: Student[],
  cloud: Student[],
  hasLocalEdits: boolean,
  deletedStudentIds: string[] = []
): Student[] {
  if (!cloud || cloud.length === 0) return local;
  const deletedSet = new Set(deletedStudentIds.map((id) => id.toUpperCase()));
  const filteredCloud = cloud.filter((cs) => !deletedSet.has(cs.id.toUpperCase()));
  const localMap = new Map(local.map((s) => [s.id, s]));
  if (!hasLocalEdits) {
    const cloudMap = new Map(filteredCloud.map((cs) => [cs.id, cs]));
    const mergedCloud = filteredCloud.map((cs) => {
      const ls = localMap.get(cs.id);
      if (ls && ls.submittedAt != null && cs.submittedAt == null) {
        return { ...cs, ...ls };
      }
      return cs;
    });
    const unsyncedLocalScored = local.filter((ls) => !cloudMap.has(ls.id) && ls.submittedAt != null && !deletedSet.has(ls.id.toUpperCase()));
    return [...mergedCloud, ...unsyncedLocalScored];
  }
  const map = new Map<string, Student>(local.map((s) => [s.id, s]));
  for (const cs of filteredCloud) {
    const ls = map.get(cs.id);
    if (!ls || (cs.submittedAt != null && ls.submittedAt == null)) {
      map.set(cs.id, cs);
    }
  }
  return Array.from(map.values());
}

function mergeTeachersList(
  local: Teacher[],
  cloud: Teacher[],
  meta: SyncMeta
): Teacher[] {
  if (!cloud || cloud.length === 0) return local;
  const deletedKeys = new Set(meta.deletedTeacherUsernames.map(normalizeTeacherKey));

  // If local teachers have unsaved manual changes, NEVER let Cloud overwrite them
  if (meta.dirtyTeachers) {
    return local;
  }

  const localMaxTs = Math.max(
    meta.teachersUpdatedAtMs || 0,
    ...local.map((t) => t.updatedAtMs || 0)
  );
  const cloudMaxTs = Math.max(...cloud.map((t) => t.updatedAtMs || 0));

  if (localMaxTs > 0 && (cloudMaxTs === 0 || localMaxTs > cloudMaxTs + 1500)) {
    return local;
  }

  const filteredCloud = cloud.filter((ct) => !deletedKeys.has(normalizeTeacherKey(ct.username)));
  const localByKey = new Map<string, Teacher>();
  for (const lt of local) {
    localByKey.set(normalizeTeacherKey(lt.username), lt);
  }

  const mergedCloud = filteredCloud.map((ct) => {
    const ctKey = normalizeTeacherKey(ct.username);
    const lt = localByKey.get(ctKey) || local.find((t) => t.id === ct.id);
    if (!lt) return ct;

    const ltTs = lt.updatedAtMs || 0;
    const ctTs = ct.updatedAtMs || 0;
    if (ltTs > 0 && (ctTs === 0 || ltTs > ctTs + 1500)) {
      return lt;
    }

    return {
      ...ct,
      password: ct.password || lt.password || '',
      passHash: ct.passHash || lt.passHash,
      email: ct.email || lt.email,
      phone: ct.phone || lt.phone,
      isCustom: lt.isCustom || ct.isCustom,
    };
  });

  const cloudKeySet = new Set(filteredCloud.map((c) => normalizeTeacherKey(c.username)));
  const cloudIdSet = new Set(filteredCloud.map((c) => c.id));
  const extraLocal = local.filter(
    (lt) =>
      !cloudKeySet.has(normalizeTeacherKey(lt.username)) &&
      !cloudIdSet.has(lt.id) &&
      !deletedKeys.has(normalizeTeacherKey(lt.username)) &&
      (lt.isCustom || (lt.updatedAtMs || 0) > 0 || meta.hasCustomTeachers)
  );
  return [...mergedCloud, ...extraLocal];
}

interface ToastItem {
  id: string;
  msg: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

const DEFAULT_APP_BRANDING: AppBranding = {
  appName: 'iSMART LMS',
  appSubtitle: 'Quản trị toàn diện: Ngân hàng đề, phân quyền giáo viên & liên kết trang thi học sinh',
  logoText: 'iS',
  logoUrl: null,
  logoWidth: 40,
  logoHeight: 40,
  logoFit: 'contain',
};

export default function App() {
  const { lang } = useLanguage();
  // Check URL parameters for standalone student portal
  const isStudentParam = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('role') === 'student';

  // Multi-Grade Exam Profiles (Khối 1, Khối 2, Khối 3, Khối 4, Khối 5 & từng lớp cụ thể)
  const [gradeExams, setGradeExams] = useState<GradeExamProfile[]>(() => {
    const cached = getInitialSyncStorage<GradeExamProfile[]>('ismart_grade_exam_profiles', []);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    const legacyParts = getInitialSyncStorage<ExamPart[]>('ismart_exam_parts', []);
    const legacyQuestions = getInitialSyncStorage<Question[]>('ismart_questions', []);
    const defaults = getDefaultGradeExams();
    if (Array.isArray(legacyParts) && legacyParts.length > 0 && Array.isArray(legacyQuestions) && legacyQuestions.length > 0) {
      return defaults.map((e) =>
        e.id === 'exam-grade-2'
          ? { ...e, parts: canonicalSortParts(legacyParts), questions: legacyQuestions }
          : e
      );
    }
    return defaults;
  });

  const [activeExamId, setActiveExamId] = useState<string>(() => {
    return getInitialSyncStorage<string>('ismart_active_grade_exam_id', 'exam-grade-2');
  });

  // Derived current active exam
  const activeExam =
    gradeExams.find((e) => e.id === activeExamId) ||
    gradeExams[0] ||
    getDefaultGradeExams()[0];

  const parts = activeExam.parts || [];
  const questions = activeExam.questions || [];
  const examMinutes = activeExam.examMinutes || 15;

  // Persistent sync metadata & Firebase Cloud Auth state (survives reloads & app updates)
  const syncMetaRef = React.useRef<SyncMeta>(loadSyncMetaSync());
  const updateSyncMetaState = useCallback((updater: (prev: SyncMeta) => SyncMeta): SyncMeta => {
    const next = updater(syncMetaRef.current);
    syncMetaRef.current = next;
    persistSyncMeta(next);
    return next;
  }, []);

  const markConfigDirty = useCallback((updatedAtMs = Date.now()) => {
    updateSyncMetaState((prev) => ({
      ...prev,
      dirtyConfig: true,
      configUpdatedAtMs: Math.max(prev.configUpdatedAtMs || 0, updatedAtMs),
    }));
  }, [updateSyncMetaState]);

  const markExamDirty = useCallback((examId: string) => {
    updateSyncMetaState((prev) => ({
      ...prev,
      dirtyExams: true,
      hasCustomExams: true,
      dirtyExamIds: Array.from(new Set([...prev.dirtyExamIds, examId])),
      deletedExamIds: prev.deletedExamIds.filter((id) => id !== examId),
    }));
  }, [updateSyncMetaState]);

  const markTeachersDirty = useCallback((removedUsernames: string[] = [], activeUsernames: string[] = []) => {
    const activeSet = new Set(activeUsernames.map(normalizeTeacherKey));
    const removedKeys = removedUsernames.map(normalizeTeacherKey).filter((k) => k && !activeSet.has(k));
    updateSyncMetaState((prev) => ({
      ...prev,
      dirtyTeachers: true,
      teachersUpdatedAtMs: Date.now(),
      hasCustomTeachers: true,
      deletedTeacherUsernames: Array.from(
        new Set([
          ...prev.deletedTeacherUsernames.map(normalizeTeacherKey).filter((k) => !activeSet.has(k)),
          ...removedKeys,
        ])
      ),
    }));
  }, [updateSyncMetaState]);

  // Setters that update the active grade exam inside gradeExams
  const setParts = useCallback((newParts: ExamPart[] | ((prev: ExamPart[]) => ExamPart[])) => {
    const nowMs = Date.now();
    markExamDirty(activeExamId);
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newParts === 'function' ? newParts(e.parts) : newParts;
          return {
            ...e,
            parts: canonicalSortParts(resolved),
            updatedAt: new Date().toLocaleDateString('vi-VN'),
            updatedAtMs: nowMs,
            isCustom: true,
          };
        }
        return e;
      })
    );
  }, [activeExamId, markExamDirty]);

  const setQuestions = useCallback((newQuestions: Question[] | ((prev: Question[]) => Question[])) => {
    const nowMs = Date.now();
    markExamDirty(activeExamId);
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newQuestions === 'function' ? newQuestions(e.questions) : newQuestions;
          return {
            ...e,
            questions: resolved,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
            updatedAtMs: nowMs,
            isCustom: true,
          };
        }
        return e;
      })
    );
  }, [activeExamId, markExamDirty]);

  const setExamMinutes = useCallback((newMinutes: number | ((prev: number) => number)) => {
    const nowMs = Date.now();
    markExamDirty(activeExamId);
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newMinutes === 'function' ? newMinutes(e.examMinutes) : newMinutes;
          return {
            ...e,
            examMinutes: resolved,
            updatedAt: new Date().toLocaleDateString('vi-VN'),
            updatedAtMs: nowMs,
            isCustom: true,
          };
        }
        return e;
      })
    );
  }, [activeExamId, markExamDirty]);

  const [schools, setSchools] = useState<string[]>(() => {
    return getInitialSyncStorage<string[]>('ismart_schools', getInitialSchools());
  });

  const [students, setStudents] = useState<Student[]>(() => {
    return getInitialSyncStorage<Student[]>('ismart_students', getInitialStudents());
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    return getInitialSyncStorage<Teacher[]>('ismart_teachers', getInitialTeachers());
  });

  const [adminPin, setAdminPin] = useState<string>(() => {
    const stored = getInitialSyncStorage<string>('ismart_admin_pin', 'admin0911');
    return (!stored || stored === '1234') ? 'admin0911' : stored;
  });

  const [appBranding, setAppBranding] = useState<AppBranding>(() => {
    const stored = getInitialSyncStorage<AppBranding | null>('ismart_app_branding', null);
    if (stored && typeof stored === 'object' && stored.appName) {
      return { ...DEFAULT_APP_BRANDING, ...stored };
    }
    return DEFAULT_APP_BRANDING;
  });

  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Asynchronous hydration from IndexedDB on startup (recovers large images & questions even if localStorage 5MB was exceeded)
  useEffect(() => {
    let active = true;
    const hydrateFromIndexedDB = async () => {
      try {
        const [
          savedGradeExams,
          savedActiveExamId,
          savedParts,
          savedQuestions,
          savedSchools,
          savedStudents,
          _savedMinutes,
          savedPin,
          savedTeachers,
          savedBranding,
          savedSyncMeta,
        ] = await Promise.all([
          loadFromStorage<GradeExamProfile[] | null>('ismart_grade_exam_profiles', null),
          loadFromStorage<string | null>('ismart_active_grade_exam_id', null),
          loadFromStorage<ExamPart[] | null>('ismart_exam_parts', null),
          loadFromStorage<Question[] | null>('ismart_questions', null),
          loadFromStorage<string[] | null>('ismart_schools', null),
          loadFromStorage<Student[] | null>('ismart_students', null),
          loadFromStorage<number | null>('ismart_exam_minutes', null),
          loadFromStorage<string | null>('ismart_admin_pin', null),
          loadFromStorage<Teacher[] | null>('ismart_teachers', null),
          loadFromStorage<AppBranding | null>('ismart_app_branding', null),
          loadSyncMetaAsync(),
        ]);

        let activeMeta = syncMetaRef.current.initialized ? syncMetaRef.current : savedSyncMeta;

        let hydratedExams = savedGradeExams && Array.isArray(savedGradeExams) && savedGradeExams.length > 0 ? savedGradeExams : null;
        let hydratedActiveExamId = savedActiveExamId;
        let hydratedSchools = savedSchools && Array.isArray(savedSchools) && savedSchools.length > 0 ? savedSchools : null;
        let hydratedStudents = savedStudents && Array.isArray(savedStudents) ? savedStudents : null;
        let hydratedTeachers = savedTeachers && Array.isArray(savedTeachers) ? savedTeachers : null;
        let hydratedPin = savedPin;
        let hydratedBranding = savedBranding && typeof savedBranding === 'object' && savedBranding.appName ? savedBranding : null;

        const hasLocalSavedState = Boolean(
          hydratedExams ||
          (savedQuestions && Array.isArray(savedQuestions) && savedQuestions.length > 0) ||
          (hydratedStudents && hydratedStudents.length > 0) ||
          (hydratedTeachers && (hydratedTeachers.length > 0 || activeMeta.hasCustomTeachers)) ||
          (typeof window !== 'undefined' && (
            localStorage.getItem('ismart_grade_exam_profiles') ||
            localStorage.getItem('ismart_students') ||
            localStorage.getItem('ismart_teachers')
          ))
        );

        // If browser is completely fresh (e.g., new Cloudflare deploy from GitHub), auto-load bundled public/ismart-snapshot.json if present
        if (!hasLocalSavedState && typeof window !== 'undefined') {
          try {
            const snapRes = await fetch('./ismart-snapshot.json', { cache: 'no-store' });
            if (snapRes.ok) {
              const rawText = await snapRes.text();
              if (rawText && !rawText.trim().startsWith('<')) {
                const snap = JSON.parse(rawText);
                if (snap && typeof snap === 'object') {
                  if (Array.isArray(snap.gradeExams) && snap.gradeExams.length > 0) {
                    hydratedExams = snap.gradeExams;
                    await saveToStorage('ismart_grade_exam_profiles', snap.gradeExams);
                  }
                  if (typeof snap.activeExamId === 'string' && snap.activeExamId) {
                    hydratedActiveExamId = snap.activeExamId;
                    await saveToStorage('ismart_active_grade_exam_id', snap.activeExamId);
                  }
                  if (Array.isArray(snap.schools) && snap.schools.length > 0) {
                    hydratedSchools = snap.schools;
                    await saveToStorage('ismart_schools', snap.schools);
                  }
                  if (Array.isArray(snap.students) && snap.students.length > 0) {
                    hydratedStudents = snap.students;
                    await saveToStorage('ismart_students', snap.students);
                  }
                  if (Array.isArray(snap.teachers) && snap.teachers.length > 0) {
                    hydratedTeachers = snap.teachers;
                    await saveToStorage('ismart_teachers', snap.teachers);
                  }
                  if (typeof snap.adminPin === 'string' && snap.adminPin.trim()) {
                    hydratedPin = snap.adminPin.trim();
                    await saveToStorage('ismart_admin_pin', hydratedPin);
                  }
                  if (snap.branding && typeof snap.branding === 'object' && snap.branding.appName) {
                    hydratedBranding = { ...DEFAULT_APP_BRANDING, ...snap.branding };
                    await saveToStorage('ismart_app_branding', hydratedBranding);
                  }
                }
              }
            }
          } catch {
            // Snapshot file not bundled in public/: continue normally
          }
        }

        // First-upgrade legacy protection: if user had already saved manual edits in IndexedDB/localStorage
        // before SyncMeta existed, detect and stamp them immediately so Cloud boot sync never overwrites them.
        if (!activeMeta.initialized) {
          const nowMs = Date.now();
          let migratedMeta = createDefaultSyncMeta();
          migratedMeta.initialized = true;

          if (hydratedTeachers !== null) {
            const hasCustomT = detectCustomTeachersComparedToDefaults(hydratedTeachers);
            const deletedDefT = detectDeletedDefaultTeacherUsernames(hydratedTeachers);
            if (hasCustomT || deletedDefT.length > 0) {
              migratedMeta.hasCustomTeachers = true;
              migratedMeta.dirtyTeachers = true;
              migratedMeta.teachersUpdatedAtMs = nowMs;
              migratedMeta.deletedTeacherUsernames = deletedDefT;
              hydratedTeachers = hydratedTeachers.map((t) => ({
                ...t,
                updatedAtMs: t.updatedAtMs || nowMs,
                isCustom: true,
              }));
            }
          }

          if (hydratedExams && hydratedExams.length > 0) {
            const modIds = detectModifiedExamIdsComparedToDefaults(hydratedExams);
            const delDefExams = detectDeletedDefaultExamIds(hydratedExams);
            if (modIds.length > 0 || delDefExams.length > 0) {
              migratedMeta.hasCustomExams = true;
              migratedMeta.dirtyExams = true;
              migratedMeta.dirtyExamIds = modIds;
              migratedMeta.deletedExamIds = delDefExams;
              const modSet = new Set(modIds);
              hydratedExams = hydratedExams.map((ex) =>
                modSet.has(ex.id)
                  ? { ...ex, updatedAtMs: ex.updatedAtMs || nowMs, isCustom: true }
                  : ex
              );
            }
          }

          if (hydratedBranding) {
            const brandingCustomized =
              hydratedBranding.appName !== DEFAULT_APP_BRANDING.appName ||
              hydratedBranding.appSubtitle !== DEFAULT_APP_BRANDING.appSubtitle ||
              Boolean(hydratedBranding.logoUrl) ||
              (hydratedBranding.logoText && hydratedBranding.logoText !== DEFAULT_APP_BRANDING.logoText);
            if (brandingCustomized) {
              migratedMeta.dirtyConfig = true;
              migratedMeta.configUpdatedAtMs = hydratedBranding.updatedAtMs || nowMs;
            }
          }

          activeMeta = migratedMeta;
          persistSyncMeta(activeMeta);
        }

        if (!active) return;
        syncMetaRef.current = activeMeta;

        if (hydratedExams && hydratedExams.length > 0) {
          setGradeExams(hydratedExams);
        } else if (savedParts && Array.isArray(savedParts) && savedParts.length > 0 && savedQuestions) {
          const defaults = getDefaultGradeExams();
          setGradeExams(
            defaults.map((e) =>
              e.id === 'exam-grade-2'
                ? { ...e, parts: canonicalSortParts(savedParts), questions: savedQuestions, updatedAtMs: Date.now(), isCustom: true }
                : e
            )
          );
        }

        if (hydratedActiveExamId) {
          setActiveExamId(hydratedActiveExamId);
        }

        if (hydratedSchools && hydratedSchools.length > 0) {
          setSchools(hydratedSchools);
        }
        if (hydratedStudents && hydratedStudents.length > 0) {
          setStudents(hydratedStudents);
        }
        if (hydratedTeachers && (hydratedTeachers.length > 0 || activeMeta.hasCustomTeachers)) {
          setTeachers(hydratedTeachers);
        }
        if (hydratedPin) {
          setAdminPin(hydratedPin === '1234' ? 'admin0911' : hydratedPin);
        } else {
          setAdminPin('admin0911');
        }
        if (hydratedBranding) {
          setAppBranding({ ...DEFAULT_APP_BRANDING, ...hydratedBranding });
        }
      } catch (err) {
        console.warn('Hydration from IndexedDB error:', err);
      } finally {
        if (active) {
          setIsHydrated(true);
        }
      }
    };
    hydrateFromIndexedDB();
    return () => {
      active = false;
    };
  }, []);

  // Firebase Cloud Auth & Auto-Sync state
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudHealth, setCloudHealth] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudInventory, setCloudInventory] = useState<CloudInventorySummary | null>(null);
  const [lastSyncReport, setLastSyncReport] = useState<CloudSyncReport | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCloudUser(u);
    });
    return () => unsub();
  }, []);

  // On startup after IndexedDB hydration, safely read Cloud updates WITHOUT overwriting local manual edits
  // and NEVER seeding demo defaults onto Cloud from an unauthenticated guest boot.
  useEffect(() => {
    if (!isHydrated) return;
    let active = true;

    const syncPublicCloudOnBoot = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (active) setCloudHealth('offline');
        return;
      }
      try {
        const health = await checkCloudConnectionStatus();
        if (!active) return;
        setCloudHealth(health.reachable ? 'connected' : 'offline');
        if (!health.reachable) return;

        const [cloudConfig, cloudExams, cloudStudents, cloudTeachers, inv] = await Promise.all([
          fetchAppConfigFromCloud().catch(() => undefined),
          fetchPublishedExamsFromCloud(gradeExams).catch(() => undefined),
          fetchAllStudentsFromCloud().catch(() => undefined),
          fetchTeachersForAdminFromCloud().catch(() => undefined),
          fetchCloudInventorySummary().catch(() => null),
        ]);
        if (!active) return;

        if (inv) setCloudInventory(inv);
        const meta = syncMetaRef.current;

        if (cloudConfig && !meta.dirtyConfig) {
          const cloudCfgTs = cloudConfig.updatedAtMs || 0;
          const localCfgTs = meta.configUpdatedAtMs || 0;
          if (localCfgTs === 0 || (cloudCfgTs > 0 && cloudCfgTs > localCfgTs + 1500)) {
            if (cloudConfig.schools && cloudConfig.schools.length > 0) {
              setSchools(cloudConfig.schools);
            }
            if (cloudConfig.activeExamId) {
              setActiveExamId(cloudConfig.activeExamId);
            }
            if (cloudConfig.branding) {
              setAppBranding({ ...DEFAULT_APP_BRANDING, ...cloudConfig.branding });
            }
          }
        }
        if (cloudExams && cloudExams.length > 0) {
          setGradeExams((prev) => mergeExamsList(prev, cloudExams, syncMetaRef.current));
        }
        if (cloudStudents && cloudStudents.length > 0) {
          setStudents((prev) =>
            mergeStudentsList(prev, cloudStudents, meta.dirtyStudents, meta.deletedStudentIds)
          );
        }
        if (cloudTeachers && cloudTeachers.length > 0) {
          setTeachers((prev) => mergeTeachersList(prev, cloudTeachers, syncMetaRef.current));
        }
      } catch {
        if (active) setCloudHealth('offline');
      }
    };

    syncPublicCloudOnBoot();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // User Authentication & Session state
  // Always open to 'guest' (Universal Portal Landing login screen) on initial open or page reload
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => {
    if (isStudentParam) return 'student';
    try {
      sessionStorage.removeItem('ismart_user_role');
      sessionStorage.removeItem('ismart_current_teacher');
    } catch {
      // ignore
    }
    return 'guest';
  });

  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);

  // Automatically synchronize Firebase Cloud whenever Admin or Teacher logs in (no Google sign-in required!)
  useEffect(() => {
    if (!isHydrated) return;
    if (currentUserRole !== 'admin' && currentUserRole !== 'teacher') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCloudHealth('offline');
      return;
    }
    let active = true;

    const syncPortalAccountCloudData = async () => {
      try {
        const inv = await fetchCloudInventorySummary();
        if (!active) return;
        setCloudHealth('connected');
        setCloudInventory(inv);

        const canEditExam = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('edit_exam');
        const canManageStudents = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('manage_students');
        const canManageTeachers = currentUserRole === 'admin';

        let configReadOk = false;
        let examsReadOk = false;
        let studentsReadOk = false;
        let teachersReadOk = false;

        // 1. Pull latest Cloud state carefully (never treating read failures as empty collections)
        const [cloudConfig, cloudExams, cloudStudents, cloudTeachers] = await Promise.all([
          fetchAppConfigFromCloud()
            .then((r) => {
              configReadOk = true;
              return r;
            })
            .catch(() => null),
          fetchPublishedExamsFromCloud(gradeExams)
            .then((r) => {
              examsReadOk = true;
              return r;
            })
            .catch(() => null),
          fetchAllStudentsFromCloud()
            .then((r) => {
              studentsReadOk = true;
              return r;
            })
            .catch(() => null),
          fetchTeachersForAdminFromCloud()
            .then((r) => {
              teachersReadOk = true;
              return r;
            })
            .catch(() => null),
        ]);
        if (!active) return;

        const meta = syncMetaRef.current;

        if (cloudConfig && !meta.dirtyConfig) {
          const cloudCfgTs = cloudConfig.updatedAtMs || 0;
          const localCfgTs = meta.configUpdatedAtMs || 0;
          if (localCfgTs === 0 || (cloudCfgTs > 0 && cloudCfgTs > localCfgTs + 1500)) {
            if (cloudConfig.schools.length > 0) setSchools(cloudConfig.schools);
            if (cloudConfig.activeExamId) setActiveExamId(cloudConfig.activeExamId);
            if (cloudConfig.branding) {
              setAppBranding({ ...DEFAULT_APP_BRANDING, ...cloudConfig.branding });
            }
          }
        }
        if (cloudExams && cloudExams.length > 0) {
          setGradeExams((prev) => mergeExamsList(prev, cloudExams, meta));
        }
        if (cloudStudents && cloudStudents.length > 0) {
          setStudents((prev) =>
            mergeStudentsList(prev, cloudStudents, meta.dirtyStudents, meta.deletedStudentIds)
          );
        }
        if (cloudTeachers && cloudTeachers.length > 0) {
          setTeachers((prev) => mergeTeachersList(prev, cloudTeachers, meta));
        }

        // 2. Flush any pending deletions (tombstones) first
        const remainingDeletedExams: string[] = [...meta.deletedExamIds];
        if (canEditExam && meta.deletedExamIds.length > 0) {
          for (const exId of meta.deletedExamIds) {
            try {
              await deleteExamFromCloud(exId);
              const idx = remainingDeletedExams.indexOf(exId);
              if (idx >= 0) remainingDeletedExams.splice(idx, 1);
            } catch {
              // Keep in tombstone list for next retry
            }
          }
        }

        const remainingDeletedTeachers: string[] = [...meta.deletedTeacherUsernames];
        if (canManageTeachers && meta.deletedTeacherUsernames.length > 0) {
          for (const uname of meta.deletedTeacherUsernames) {
            try {
              await deleteTeacherUsernameFromCloud(uname);
              const idx = remainingDeletedTeachers.indexOf(uname);
              if (idx >= 0) remainingDeletedTeachers.splice(idx, 1);
            } catch {
              // Keep in tombstone list for next retry
            }
          }
        }

        // 3. Push ONLY dirty/newer local data or verified-empty Cloud collections
        const cloudExamMap = new Map((cloudExams || []).map((ce) => [ce.id, ce]));
        const examsNeedingPush = canEditExam
          ? gradeExams.filter((le) => {
              if (meta.dirtyExamIds.includes(le.id)) return true;
              const ce = cloudExamMap.get(le.id);
              if (!ce && examsReadOk && (!cloudExams || cloudExams.length === 0 || le.isCustom || (le.updatedAtMs || 0) > 0)) {
                return true;
              }
              if (ce && (le.updatedAtMs || 0) > (ce.updatedAtMs || 0) + 1500) {
                return true;
              }
              return false;
            })
          : [];

        const cloudTeachersMaxTs = Math.max(0, ...(cloudTeachers || []).map((t) => t.updatedAtMs || 0));
        const localTeachersMaxTs = Math.max(meta.teachersUpdatedAtMs || 0, ...teachers.map((t) => t.updatedAtMs || 0));
        const needPushTeachers =
          canManageTeachers &&
          (meta.dirtyTeachers ||
            (localTeachersMaxTs > 0 && (cloudTeachersMaxTs === 0 || localTeachersMaxTs > cloudTeachersMaxTs + 1500)) ||
            (teachersReadOk && (!cloudTeachers || cloudTeachers.length === 0) && !meta.hasCustomTeachers && teachers.length > 0));

        const localCfgNewer = meta.configUpdatedAtMs > 0 && (!cloudConfig?.updatedAtMs || meta.configUpdatedAtMs > cloudConfig.updatedAtMs + 1500);
        const needPushConfig =
          (canEditExam || canManageStudents) &&
          (meta.dirtyConfig || localCfgNewer || (configReadOk && !cloudConfig));

        const needPushStudents =
          canManageStudents &&
          (meta.dirtyStudents || (studentsReadOk && (!cloudStudents || cloudStudents.length === 0) && students.length > 0));

        if (needPushConfig || examsNeedingPush.length > 0 || needPushStudents || needPushTeachers) {
          const report = await syncAllDataToCloud({
            schools,
            activeExamId,
            gradeExams: examsNeedingPush,
            students,
            teachers,
            branding: currentUserRole === 'admin' ? appBranding : undefined,
            ownerUid: cloudUser?.uid || `portal-${currentUserRole}`,
            cloudEmail: cloudUser?.email || null,
            canSyncConfig: needPushConfig,
            canSyncExams: examsNeedingPush.length > 0,
            canSyncStudents: needPushStudents,
            canSyncTeachers: needPushTeachers,
          });
          if (!active) return;
          setLastSyncReport(report);
          if (report.errors.length === 0) {
            const pushedExamIdSet = new Set(examsNeedingPush.map((e) => e.id));
            updateSyncMetaState((prev) => {
              const remainingDirtyExams = prev.dirtyExamIds.filter((id) => !pushedExamIdSet.has(id));
              return {
                ...prev,
                dirtyConfig: needPushConfig ? false : prev.dirtyConfig,
                dirtyExams: remainingDirtyExams.length > 0,
                dirtyExamIds: remainingDirtyExams,
                deletedExamIds: remainingDeletedExams,
                dirtyStudents: needPushStudents ? false : prev.dirtyStudents,
                dirtyTeachers: needPushTeachers ? false : prev.dirtyTeachers,
                deletedTeacherUsernames: remainingDeletedTeachers,
              };
            });
          }
          const refreshed = await fetchCloudInventorySummary().catch(() => null);
          if (active && refreshed) setCloudInventory(refreshed);
        } else if (
          remainingDeletedExams.length !== meta.deletedExamIds.length ||
          remainingDeletedTeachers.length !== meta.deletedTeacherUsernames.length
        ) {
          updateSyncMetaState((prev) => ({
            ...prev,
            deletedExamIds: remainingDeletedExams,
            deletedTeacherUsernames: remainingDeletedTeachers,
          }));
        }
      } catch {
        // Keep working locally if Cloud is temporarily unreachable
      }
    };

    syncPortalAccountCloudData();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, currentUserRole, currentTeacher?.username, isHydrated]);

  // Automatic debounced background save for exam, teacher & config edits when Admin or authorized Teacher edits
  useEffect(() => {
    if (!isHydrated) return;
    if (currentUserRole !== 'admin' && currentUserRole !== 'teacher') return;

    const meta = syncMetaRef.current;
    const hasDirtyConfig = meta.dirtyConfig;
    const hasDirtyExams = meta.dirtyExams || meta.dirtyExamIds.length > 0 || meta.deletedExamIds.length > 0;
    const hasDirtyTeachers = meta.dirtyTeachers || meta.deletedTeacherUsernames.length > 0;
    if (!hasDirtyConfig && !hasDirtyExams && !hasDirtyTeachers) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCloudHealth('offline');
      return;
    }

    const canEditExam = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('edit_exam');
    const canManageTeachers = currentUserRole === 'admin';
    const canEditConfig =
      currentUserRole === 'admin' || canEditExam || !!currentTeacher?.permissions.includes('manage_students');

    const timer = window.setTimeout(async () => {
      setIsCloudSyncing(true);
      try {
        const snapshotMeta = syncMetaRef.current;
        if (snapshotMeta.dirtyConfig && canEditConfig) {
          await saveAppConfigToCloud(schools, activeExamId, currentUserRole === 'admin' ? appBranding : undefined);
          updateSyncMetaState((prev) => ({ ...prev, dirtyConfig: false }));
        }

        if ((snapshotMeta.dirtyExams || snapshotMeta.dirtyExamIds.length > 0) && canEditExam) {
          const targetIds =
            snapshotMeta.dirtyExamIds.length > 0 ? snapshotMeta.dirtyExamIds : [activeExamId];
          const syncedIds = new Set<string>();
          for (const exId of targetIds) {
            const examObj = gradeExams.find((e) => e.id === exId);
            if (examObj) {
              await saveGradeExamToCloud(examObj, cloudUser?.uid || `portal-${currentUserRole}`);
              syncedIds.add(exId);
            }
          }
          if (syncedIds.size > 0) {
            updateSyncMetaState((prev) => {
              const remaining = prev.dirtyExamIds.filter((id) => !syncedIds.has(id));
              return { ...prev, dirtyExamIds: remaining, dirtyExams: remaining.length > 0 };
            });
          }
        }

        if (snapshotMeta.deletedExamIds.length > 0 && canEditExam) {
          const deletedOk = new Set<string>();
          for (const delId of snapshotMeta.deletedExamIds) {
            try {
              await deleteExamFromCloud(delId);
              deletedOk.add(delId);
            } catch {
              // keep for retry
            }
          }
          if (deletedOk.size > 0) {
            updateSyncMetaState((prev) => ({
              ...prev,
              deletedExamIds: prev.deletedExamIds.filter((id) => !deletedOk.has(id)),
            }));
          }
        }

        if (snapshotMeta.dirtyTeachers && canManageTeachers) {
          await saveTeachersToCloud(teachers);
          updateSyncMetaState((prev) => ({ ...prev, dirtyTeachers: false }));
        }

        if (snapshotMeta.deletedTeacherUsernames.length > 0 && canManageTeachers) {
          const deletedUsers = new Set<string>();
          for (const uname of snapshotMeta.deletedTeacherUsernames) {
            try {
              await deleteTeacherUsernameFromCloud(uname);
              deletedUsers.add(uname);
            } catch {
              // keep for retry
            }
          }
          if (deletedUsers.size > 0) {
            updateSyncMetaState((prev) => ({
              ...prev,
              deletedTeacherUsernames: prev.deletedTeacherUsernames.filter((u) => !deletedUsers.has(u)),
            }));
          }
        }

        setCloudHealth('connected');
        setLastSavedTime(
          new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        const inv = await fetchCloudInventorySummary().catch(() => null);
        if (inv) setCloudInventory(inv);
      } catch (err) {
        console.warn('Auto background Cloud sync error:', err);
      } finally {
        setIsCloudSyncing(false);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeExams, schools, activeExamId, appBranding, teachers, currentUserRole, currentTeacher?.username, isHydrated, cloudUser]);

  useEffect(() => {
    try {
      if (currentUserRole !== 'guest') {
        sessionStorage.setItem('ismart_user_role', currentUserRole);
      } else {
        sessionStorage.removeItem('ismart_user_role');
      }

      if (currentTeacher) {
        sessionStorage.setItem('ismart_current_teacher', JSON.stringify(currentTeacher));
      } else {
        sessionStorage.removeItem('ismart_current_teacher');
      }
    } catch {
      // ignore
    }
  }, [currentUserRole, currentTeacher]);

  // App navigation state
  const [currentMode, setCurrentMode] = useState<ViewMode>(isStudentParam ? 'test' : 'admin');
  const [isStudentKioskLocked, setIsStudentKioskLocked] = useState<boolean>(isStudentParam);
  const [isTestRunMode, setIsTestRunMode] = useState<boolean>(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    try {
      const saved = sessionStorage.getItem('ismart_current_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [portalPendingStudent, setPortalPendingStudent] = useState<Student | null>(null);

  useEffect(() => {
    try {
      if (currentStudent) {
        sessionStorage.setItem('ismart_current_student', JSON.stringify(currentStudent));
      } else {
        sessionStorage.removeItem('ismart_current_student');
      }
    } catch {
      // ignore
    }
  }, [currentStudent]);
  const [testRunInitialPartId, setTestRunInitialPartId] = useState<string | undefined>(undefined);

  // Modals
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPdfImporterOpen, setIsPdfImporterOpen] = useState(false);
  const [isCameraGraderOpen, setIsCameraGraderOpen] = useState(false);
  const [isOfflinePrinterOpen, setIsOfflinePrinterOpen] = useState(false);
  const [isExportOnlineModalOpen, setIsExportOnlineModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onOk: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onOk: () => {}
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((msg: string, type: 'success' | 'warn' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const openConfirm = useCallback((title: string, message: string, onOk: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onOk
    });
  }, []);

  // Automatic background persistence with IndexedDB (unlimited quota) + localStorage cache
  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage('ismart_grade_exam_profiles', gradeExams).then(() => {
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    });
    saveToStorage('ismart_active_grade_exam_id', activeExamId);
    if (activeExam) {
      saveToStorage('ismart_exam_parts', activeExam.parts);
      saveToStorage('ismart_questions', activeExam.questions);
      saveToStorage('ismart_exam_minutes', activeExam.examMinutes);
    }
  }, [gradeExams, activeExamId, isHydrated, activeExam]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage('ismart_schools', schools);
  }, [schools, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage('ismart_students', students);
  }, [students, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage('ismart_teachers', teachers);
  }, [teachers, isHydrated]);

  // Keep logged-in teacher permissions synchronized if admin updates permissions in teachers list
  useEffect(() => {
    if (currentTeacher && currentUserRole === 'teacher') {
      const refreshed = teachers.find(
        (t) => t.id === currentTeacher.id || t.username.toLowerCase() === currentTeacher.username.toLowerCase()
      );
      if (refreshed && JSON.stringify(refreshed.permissions) !== JSON.stringify(currentTeacher.permissions)) {
        setCurrentTeacher(refreshed);
      }
    }
  }, [teachers, currentTeacher, currentUserRole]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage('ismart_admin_pin', adminPin);
  }, [adminPin, isHydrated]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${appBranding.appName || 'iSMART LMS'} - ${
        lang === 'en' ? 'Exam & Management System' : 'Hệ Thống Thi & Quản Trị'
      }`;
    }
    if (!isHydrated) return;
    saveToStorage('ismart_app_branding', appBranding);
  }, [appBranding, isHydrated, lang]);

  // Auto-sync any queued offline submissions when network is restored
  useEffect(() => {
    const handleSyncOfflineQueue = async () => {
      try {
        const raw = localStorage.getItem('ismart_offline_submission_queue');
        if (raw) {
          const queue = JSON.parse(raw);
          if (Array.isArray(queue) && queue.length > 0) {
            const failedItems: any[] = [];
            for (const qItem of queue) {
              try {
                const matchingStudent = students.find((s) => s.id === qItem.studentId);
                const qExamId = qItem.examId || activeExamId;
                const matchingExam = gradeExams.find((e) => e.id === qExamId);
                await submitStudentScoreToCloud({
                  studentId: qItem.studentId,
                  examId: qExamId,
                  score: qItem.totalEarnedPoints,
                  total: qItem.maxExamPoints,
                  points10: qItem.pts10,
                  submittedAt: qItem.submittedAt
                    ? new Date(qItem.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : 'Đã nộp',
                  partScores: qItem.partScores,
                  questionScores: qItem.questionScores,
                  details: qItem.userAnswers,
                  sectionScores: qItem.sectionScores,
                  studentMeta:
                    qItem.studentMeta ||
                    (matchingStudent
                      ? {
                          name: matchingStudent.name,
                          grade: matchingStudent.grade,
                          className: matchingStudent.className,
                          school: matchingStudent.school,
                          examId: qExamId,
                        }
                      : undefined),
                  examMeta: matchingExam,
                });
              } catch {
                failedItems.push(qItem);
              }
            }

            setStudents((prev) => {
              const updated = prev.map((s) => {
                const queuedItem = queue.find((q: any) => q.studentId === s.id);
                if (queuedItem) {
                  return {
                    ...s,
                    score: queuedItem.totalEarnedPoints,
                    total: queuedItem.maxExamPoints,
                    points10: queuedItem.pts10,
                    submittedAt: queuedItem.submittedAt
                      ? new Date(queuedItem.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : 'Đã nộp',
                    sectionScores: queuedItem.sectionScores || s.sectionScores,
                    partScores: queuedItem.partScores || s.partScores,
                    questionScores: queuedItem.questionScores || s.questionScores,
                    details: queuedItem.userAnswers || s.details
                  };
                }
                return s;
              });
              saveToStorage('ismart_students', updated);
              return updated;
            });

            if (failedItems.length === 0) {
              localStorage.removeItem('ismart_offline_submission_queue');
              showToast(`✅ Đã đồng bộ kết quả thi của ${queue.length} học sinh nộp lúc mất mạng lên Firebase Cloud!`, 'success');
            } else {
              localStorage.setItem('ismart_offline_submission_queue', JSON.stringify(failedItems));
            }
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('online', handleSyncOfflineQueue);
    handleSyncOfflineQueue();

    return () => {
      window.removeEventListener('online', handleSyncOfflineQueue);
    };
  }, [activeExamId]);

  // Grade Exam Management Handlers
  const handleSelectGradeExam = (examId: string) => {
    markConfigDirty();
    setActiveExamId(examId);
    saveToStorage('ismart_active_grade_exam_id', examId);
    const target = gradeExams.find((e) => e.id === examId);
    if (target) {
      showToast(
        `🎒 Đã chuyển sang soạn: ${target.title} (${target.grade}${
          target.className && target.className !== 'Tất cả các lớp' ? ` - Lớp ${target.className}` : ''
        })!`,
        'info'
      );
    }
  };

  const handleCreateGradeExam = (newExamData: {
    grade: string;
    className: string;
    title: string;
    description: string;
    examMinutes: number;
    copyFromId?: string;
  }) => {
    let initialParts: ExamPart[] = [];
    let initialQuestions: Question[] = [];

    if (newExamData.copyFromId) {
      const source = gradeExams.find((e) => e.id === newExamData.copyFromId);
      if (source) {
        initialParts = JSON.parse(JSON.stringify(source.parts));
        initialQuestions = JSON.parse(JSON.stringify(source.questions));
      }
    }

    if (initialParts.length === 0) {
      initialParts = [
        {
          id: `part-${Date.now()}`,
          section: 'listening',
          title: 'Part 1: Listening Comprehension',
          instructions: `Lắng nghe và chọn đáp án đúng cho ${newExamData.grade}...`,
          points: 5.0,
          audio: `tts:Welcome to ${newExamData.grade} examination. Part 1.`,
          maxPlayCount: 2
        }
      ];
      initialQuestions = [
        {
          id: `q-${Date.now()}-1`,
          partId: initialParts[0].id,
          points: 2.5,
          q: 'Listen and choose the correct answer:',
          audio: 'tts:Hello students! Welcome to the English test.',
          type: 'multiple-choice',
          options: [{ text: 'Phương án A' }, { text: 'Phương án B' }, { text: 'Phương án C' }],
          correctIndex: 0
        }
      ];
    }

    const nowMs = Date.now();
    const newId = `exam-${newExamData.grade.toLowerCase().replace(/\s+/g, '-')}-${nowMs.toString().slice(-4)}`;
    const newProfile: GradeExamProfile = {
      id: newId,
      grade: newExamData.grade,
      className: newExamData.className || 'Tất cả các lớp',
      title: newExamData.title,
      description: newExamData.description,
      examMinutes: newExamData.examMinutes || 15,
      parts: initialParts,
      questions: initialQuestions,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
      updatedAtMs: nowMs,
      isCustom: true,
    };

    markExamDirty(newId);
    markConfigDirty(nowMs);
    setGradeExams((prev) => [newProfile, ...prev]);
    setActiveExamId(newId);
    saveToStorage('ismart_active_grade_exam_id', newId);
    showToast(`🎉 Đã tạo đề thi mới cho ${newExamData.grade} (${newExamData.className}) thành công!`, 'success');
  };

  const handleDuplicateGradeExam = (
    sourceExamId: string,
    targetGrade: string,
    targetClass: string,
    targetTitle: string
  ) => {
    const source = gradeExams.find((e) => e.id === sourceExamId);
    if (!source) return;

    const nowMs = Date.now();
    const newId = `exam-${targetGrade.toLowerCase().replace(/\s+/g, '-')}-${nowMs.toString().slice(-4)}`;
    const duplicated: GradeExamProfile = {
      id: newId,
      grade: targetGrade,
      className: targetClass || 'Tất cả các lớp',
      title: targetTitle,
      description: `Bản sao từ ${source.title} (${source.grade})`,
      examMinutes: source.examMinutes,
      parts: JSON.parse(JSON.stringify(source.parts)),
      questions: JSON.parse(JSON.stringify(source.questions)),
      updatedAt: new Date().toLocaleDateString('vi-VN'),
      updatedAtMs: nowMs,
      isCustom: true,
    };

    markExamDirty(newId);
    markConfigDirty(nowMs);
    setGradeExams((prev) => [duplicated, ...prev]);
    setActiveExamId(newId);
    saveToStorage('ismart_active_grade_exam_id', newId);
    showToast(`📋 Đã sao chép đề sang ${targetGrade} (${targetClass}) thành công!`, 'success');
  };

  const handleUpdateGradeExamMeta = (examId: string, patch: Partial<GradeExamProfile>) => {
    const nowMs = Date.now();
    markExamDirty(examId);
    setGradeExams((prev) =>
      prev.map((e) =>
        e.id === examId
          ? {
              ...e,
              ...patch,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
              updatedAtMs: nowMs,
              isCustom: true,
            }
          : e
      )
    );
  };

  const handleDeleteGradeExam = (examId: string) => {
    if (gradeExams.length <= 1) {
      showToast('Không thể xóa đề thi duy nhất còn lại!', 'warn');
      return;
    }
    const filtered = gradeExams.filter((e) => e.id !== examId);
    updateSyncMetaState((prev) => {
      const remainingDirty = prev.dirtyExamIds.filter((id) => id !== examId);
      return {
        ...prev,
        hasCustomExams: true,
        dirtyExams: remainingDirty.length > 0,
        dirtyExamIds: remainingDirty,
        deletedExamIds: Array.from(new Set([...prev.deletedExamIds, examId])),
      };
    });
    setGradeExams(filtered);
    if (activeExamId === examId) {
      const nextId = filtered[0].id;
      markConfigDirty();
      setActiveExamId(nextId);
      saveToStorage('ismart_active_grade_exam_id', nextId);
    }
    deleteExamFromCloud(examId)
      .then(() => {
        updateSyncMetaState((prev) => ({
          ...prev,
          deletedExamIds: prev.deletedExamIds.filter((id) => id !== examId),
        }));
      })
      .catch((err) => {
        showToast(`Xóa đề thi trên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
      });
    showToast('Đã xóa đề thi và cập nhật Cloud!', 'info');
  };

  const handleRefreshCloudInventory = async () => {
    setIsCloudSyncing(true);
    try {
      const inv = await fetchCloudInventorySummary();
      setCloudInventory(inv);
      setCloudHealth(inv.errors.length === 0 ? 'connected' : cloudHealth);
      showToast(
        `☁️ Cloud hiện có: ${inv.examsCount} đề (${inv.examImagesCount} ảnh), ${inv.studentsCount} HS (${inv.scoredStudentsCount} có điểm), ${inv.teachersCount} GV.`,
        inv.errors.length > 0 ? 'warn' : 'info'
      );
    } catch (err) {
      showToast(`Lỗi kiểm tra Cloud: ${formatCloudError(err)}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handlePullAllFromCloud = async () => {
    setIsCloudSyncing(true);
    try {
      const [cloudConfig, cloudExams, cloudStudents, cloudTeachers] = await Promise.all([
        fetchAppConfigFromCloud().catch(() => null),
        fetchPublishedExamsFromCloud([]).catch(() => null),
        fetchAllStudentsFromCloud().catch(() => null),
        fetchTeachersForAdminFromCloud().catch(() => null),
      ]);

      if (cloudConfig) {
        if (cloudConfig.schools.length > 0) setSchools(cloudConfig.schools);
        if (cloudConfig.activeExamId) setActiveExamId(cloudConfig.activeExamId);
        if (cloudConfig.branding) {
          setAppBranding({ ...DEFAULT_APP_BRANDING, ...cloudConfig.branding });
        }
      }
      if (cloudExams && cloudExams.length > 0) setGradeExams(cloudExams);
      if (cloudStudents && cloudStudents.length > 0) setStudents(cloudStudents);
      if (cloudTeachers && cloudTeachers.length > 0) {
        const cleanMeta = createDefaultSyncMeta();
        cleanMeta.initialized = true;
        setTeachers((prev) => mergeTeachersList(prev, cloudTeachers, cleanMeta));
      }

      const inv = await fetchCloudInventorySummary();
      setCloudInventory(inv);
      setCloudHealth('connected');
      updateSyncMetaState(() => ({
        ...createDefaultSyncMeta(),
        initialized: true,
        hasCustomExams: Boolean(cloudExams && cloudExams.length > 0),
        hasCustomTeachers: Boolean(cloudTeachers && cloudTeachers.length > 0),
      }));
      showToast(
        `⬇️ Đã tải từ Cloud: ${cloudExams?.length || 0} đề thi, ${cloudStudents?.length || 0} học sinh, ${cloudTeachers?.length || 0} giáo viên!`,
        'success'
      );
    } catch (err) {
      showToast(`Lỗi tải từ Cloud: ${formatCloudError(err)}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Explicit Manual Save & Sync (Local IndexedDB + Firebase Cloud Firestore across ALL accounts)
  const handleManualSaveAndSync = async () => {
    setIsSaving(true);
    setIsCloudSyncing(true);
    const nowMs = Date.now();
    try {
      const stampedExams = gradeExams.map((e) => ({
        ...e,
        updatedAtMs: e.updatedAtMs || nowMs,
        isCustom: true,
      }));
      const stampedTeachers = teachers.map((t) => ({
        ...t,
        updatedAtMs: t.updatedAtMs || nowMs,
        isCustom: true,
      }));

      setGradeExams(stampedExams);
      setTeachers(stampedTeachers);

      await Promise.all([
        saveToStorage('ismart_grade_exam_profiles', stampedExams),
        saveToStorage('ismart_active_grade_exam_id', activeExamId),
        saveToStorage('ismart_exam_parts', parts),
        saveToStorage('ismart_questions', questions),
        saveToStorage('ismart_schools', schools),
        saveToStorage('ismart_students', students),
        saveToStorage('ismart_teachers', stampedTeachers),
        saveToStorage('ismart_exam_minutes', examMinutes),
        saveToStorage('ismart_admin_pin', adminPin),
        saveToStorage('ismart_app_branding', appBranding)
      ]);

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(nowStr);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        updateSyncMetaState((prev) => ({
          ...prev,
          dirtyConfig: true,
          configUpdatedAtMs: nowMs,
          dirtyExams: true,
          dirtyExamIds: stampedExams.map((e) => e.id),
          hasCustomExams: true,
          dirtyStudents: true,
          studentsUpdatedAtMs: nowMs,
          dirtyTeachers: true,
          teachersUpdatedAtMs: nowMs,
          hasCustomTeachers: true,
        }));
        setCloudHealth('offline');
        showToast(`💾 Đang mất mạng — đã lưu tạm trên máy (${nowStr}) và sẽ tự đẩy Cloud khi có mạng!`, 'warn');
        return;
      }

      const canEditExam = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('edit_exam');
      const canManageStudents = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('manage_students');
      const canResetScores = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('reset_scores');
      const canManageTeachers = currentUserRole === 'admin';

      const curMeta = syncMetaRef.current;
      const remainingDeletedExams: string[] = [...curMeta.deletedExamIds];
      if (canEditExam && curMeta.deletedExamIds.length > 0) {
        for (const delId of curMeta.deletedExamIds) {
          try {
            await deleteExamFromCloud(delId);
            const i = remainingDeletedExams.indexOf(delId);
            if (i >= 0) remainingDeletedExams.splice(i, 1);
          } catch {
            // keep in tombstone
          }
        }
      }

      const remainingDeletedTeachers: string[] = [...curMeta.deletedTeacherUsernames];
      if (canManageTeachers && curMeta.deletedTeacherUsernames.length > 0) {
        for (const uname of curMeta.deletedTeacherUsernames) {
          try {
            await deleteTeacherUsernameFromCloud(uname);
            const i = remainingDeletedTeachers.indexOf(uname);
            if (i >= 0) remainingDeletedTeachers.splice(i, 1);
          } catch {
            // keep in tombstone
          }
        }
      }

      const report = await syncAllDataToCloud({
        schools,
        activeExamId,
        gradeExams: stampedExams,
        students,
        teachers: stampedTeachers,
        branding: currentUserRole === 'admin' ? appBranding : undefined,
        ownerUid: cloudUser?.uid || `portal-${currentUserRole}`,
        cloudEmail: cloudUser?.email || null,
        canSyncConfig: currentUserRole === 'admin' || canEditExam || canManageStudents,
        canSyncExams: canEditExam,
        canSyncStudents: canManageStudents || canResetScores,
        canSyncTeachers: canManageTeachers,
      });
      setLastSyncReport(report);
      setCloudHealth('connected');

      const inv = await fetchCloudInventorySummary().catch(() => null);
      if (inv) setCloudInventory(inv);

      if (report.errors.length === 0) {
        updateSyncMetaState((prev) => ({
          ...prev,
          dirtyConfig: !(currentUserRole === 'admin' || canEditExam || canManageStudents) ? prev.dirtyConfig : false,
          configUpdatedAtMs: nowMs,
          dirtyExams: canEditExam ? false : prev.dirtyExams,
          dirtyExamIds: canEditExam ? [] : prev.dirtyExamIds,
          deletedExamIds: remainingDeletedExams,
          hasCustomExams: true,
          dirtyStudents: (canManageStudents || canResetScores) ? false : prev.dirtyStudents,
          dirtyTeachers: canManageTeachers ? false : prev.dirtyTeachers,
          teachersUpdatedAtMs: canManageTeachers ? nowMs : prev.teachersUpdatedAtMs,
          deletedTeacherUsernames: remainingDeletedTeachers,
          hasCustomTeachers: true,
        }));
        showToast(
          `☁️ Đã lưu Firebase Cloud: ${report.examsSaved} bài thi (${report.examImagesCount} ảnh), ${report.studentsSaved} HS (${report.scoredStudentsCount} có điểm), ${report.teachersSaved} GV lúc ${nowStr}!`,
          'success'
        );
      } else {
        updateSyncMetaState((prev) => ({
          ...prev,
          dirtyExams: canEditExam || prev.dirtyExams,
          dirtyTeachers: canManageTeachers || prev.dirtyTeachers,
          deletedExamIds: remainingDeletedExams,
          deletedTeacherUsernames: remainingDeletedTeachers,
        }));
        showToast(
          `⚠️ Đã lưu an toàn trên máy, nhưng đồng bộ Cloud bị lỗi: ${report.errors[0]}`,
          'error'
        );
      }
    } catch (err) {
      console.error('Lỗi khi lưu dữ liệu:', err);
      showToast(`Có lỗi xảy ra khi lưu dữ liệu: ${formatCloudError(err)}`, 'error');
    } finally {
      setIsSaving(false);
      setIsCloudSyncing(false);
    }
  };

  // Download JSON Backup / GitHub Snapshot
  const handleDownloadBackupJSON = (options?: { filename?: string; includeSensitiveAuth?: boolean }) => {
    const includeSensitiveAuth = options?.includeSensitiveAuth !== false;
    const backupData: Record<string, any> = {
      version: 2,
      timestamp: new Date().toISOString(),
      gradeExams,
      activeExamId,
      examMinutes,
      schools,
      students,
      parts,
      questions,
      branding: appBranding
    };
    if (includeSensitiveAuth) {
      backupData.adminPin = adminPin;
      backupData.teachers = teachers;
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options?.filename || `ismart-multi-grade-exam-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      `📦 Đã tải file ${a.download} (${gradeExams.length} đề thi, ${students.length} học sinh${includeSensitiveAuth ? `, ${teachers.length} giáo viên` : ''})!`,
      'success'
    );
  };

  // Apply parsed snapshot object to state + IndexedDB + auto-sync Cloud
  const handleApplyFullSnapshot = async (parsed: any) => {
    if (Array.isArray(parsed)) {
      markExamDirty(activeExamId);
      setQuestions(parsed);
      await saveToStorage('ismart_questions', parsed);
      showToast(`Đã khôi phục ${parsed.length} câu hỏi và tự động đồng bộ lên Firebase Cloud!`, 'success');
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      showToast('Dữ liệu JSON không hợp lệ!', 'error');
      return;
    }

    const nowMs = Date.now();
    let nextExams = gradeExams;
    let nextActiveExamId = activeExamId;
    let nextSchools = schools;
    let nextStudents = students;
    let nextTeachers = teachers;

    if (Array.isArray(parsed.gradeExams) && parsed.gradeExams.length > 0) {
      nextExams = parsed.gradeExams.map((ex: GradeExamProfile) => ({
        ...ex,
        updatedAtMs: ex.updatedAtMs || nowMs,
        isCustom: true,
      }));
      updateSyncMetaState((prev) => ({
        ...prev,
        dirtyExams: true,
        hasCustomExams: true,
        dirtyExamIds: Array.from(new Set([...prev.dirtyExamIds, ...nextExams.map((ex) => ex.id)])),
        deletedExamIds: [],
      }));
      setGradeExams(nextExams);
      await saveToStorage('ismart_grade_exam_profiles', nextExams);
      if (parsed.activeExamId) {
        nextActiveExamId = parsed.activeExamId;
        markConfigDirty(nowMs);
        setActiveExamId(nextActiveExamId);
        await saveToStorage('ismart_active_grade_exam_id', nextActiveExamId);
      }
    } else {
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        setParts(canonicalSortParts(parsed.parts));
        await saveToStorage('ismart_exam_parts', parsed.parts);
      }
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        await saveToStorage('ismart_questions', parsed.questions);
      }
    }
    if (Array.isArray(parsed.schools)) {
      nextSchools = parsed.schools;
      markConfigDirty(nowMs);
      setSchools(nextSchools);
      await saveToStorage('ismart_schools', nextSchools);
    }
    if (Array.isArray(parsed.students)) {
      nextStudents = parsed.students;
      updateSyncMetaState((prev) => ({ ...prev, dirtyStudents: true, studentsUpdatedAtMs: nowMs }));
      setStudents(nextStudents);
      await saveToStorage('ismart_students', nextStudents);
    }
    if (Array.isArray(parsed.teachers)) {
      nextTeachers = parsed.teachers.map((t: Teacher) => ({
        ...t,
        updatedAtMs: t.updatedAtMs || nowMs,
        isCustom: true,
      }));
      markTeachersDirty([], nextTeachers.map((t) => t.username));
      setTeachers(nextTeachers);
      await saveToStorage('ismart_teachers', nextTeachers);
    }
    if (typeof parsed.examMinutes === 'number') {
      setExamMinutes(parsed.examMinutes);
      await saveToStorage('ismart_exam_minutes', parsed.examMinutes);
    }
    if (typeof parsed.adminPin === 'string' && parsed.adminPin.trim()) {
      const nextPin = parsed.adminPin.trim();
      setAdminPin(nextPin);
      await saveToStorage('ismart_admin_pin', nextPin);
    }
    let nextBranding = appBranding;
    if (parsed.branding && typeof parsed.branding === 'object' && parsed.branding.appName) {
      nextBranding = { ...DEFAULT_APP_BRANDING, ...parsed.branding, updatedAtMs: nowMs };
      if (currentUserRole === 'admin') {
        markConfigDirty(nowMs);
      }
      setAppBranding(nextBranding);
      await saveToStorage('ismart_app_branding', nextBranding);
    }

    syncAllDataToCloud({
      schools: nextSchools,
      activeExamId: nextActiveExamId,
      gradeExams: nextExams,
      students: nextStudents,
      teachers: nextTeachers,
      branding: currentUserRole === 'admin' ? nextBranding : undefined,
      ownerUid: cloudUser?.uid || `portal-${currentUserRole}`,
      cloudEmail: cloudUser?.email || null,
      canSyncConfig: true,
      canSyncExams: true,
      canSyncStudents: true,
      canSyncTeachers: currentUserRole === 'admin',
    })
      .then((report) => {
        setLastSyncReport(report);
        if (report.errors.length === 0) {
          updateSyncMetaState((prev) => ({
            ...prev,
            dirtyConfig: false,
            dirtyExams: false,
            dirtyExamIds: [],
            dirtyStudents: false,
            dirtyTeachers: currentUserRole === 'admin' ? false : prev.dirtyTeachers,
          }));
        }
      })
      .catch(() => {});

    showToast(
      '✅ Đã nạp thành công toàn bộ đề thi, học sinh, điểm số & giáo viên và đang tự động đồng bộ lên Cloud!',
      'success'
    );
  };

  // Upload JSON Backup / GitHub Snapshot
  const handleUploadBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        await handleApplyFullSnapshot(parsed);
      } catch {
        showToast('File JSON không hợp lệ!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Mode switching guard
  const handleSwitchMode = (mode: ViewMode) => {
    if (isStudentKioskLocked && mode !== 'test') {
      setIsPinModalOpen(true);
      return;
    }

    // Role-based permission checks for Teacher
    if (currentUserRole === 'teacher' && currentTeacher) {
      if (mode === 'admin' && !currentTeacher.permissions.includes('edit_exam')) {
        showToast('Tài khoản của bạn không có quyền Soạn Đề. Vui lòng liên hệ Admin!', 'warn');
        return;
      }
      if (mode === 'students' && !currentTeacher.permissions.includes('manage_students')) {
        showToast('Tài khoản của bạn không có quyền Quản lý Học sinh. Vui lòng liên hệ Admin!', 'warn');
        return;
      }
      if (mode === 'scores' && !currentTeacher.permissions.includes('view_scores')) {
        showToast('Tài khoản của bạn không có quyền Xem Bảng Điểm & Xuất Kết Quả. Vui lòng liên hệ Admin!', 'warn');
        return;
      }
      if (mode === 'teachers') {
        showToast('Chỉ Quản trị viên (Admin) mới có quyền Quản lý & Phân quyền Giáo viên!', 'warn');
        return;
      }
      if (mode === 'json' && !currentTeacher.permissions.includes('view_json')) {
        showToast('Tài khoản của bạn không có quyền xem Cấu hình & Link thi!', 'warn');
        return;
      }
    }

    if (isTestRunMode && mode !== 'test') {
      setIsTestRunMode(false);
      setTestRunInitialPartId(undefined);
      setCurrentStudent(null);
    }
    setCurrentMode(mode);
    if (mode === 'scores') {
      handleRefreshScoresFromCloud(true);
    }
  };

  const handleStartTestRun = (initialPartId?: string) => {
    setIsTestRunMode(true);
    setTestRunInitialPartId(initialPartId);
    setCurrentStudent({
      id: 'TEST_TEACHER',
      name: currentTeacher ? `${currentTeacher.name} (Chạy Thử)` : 'Giáo viên - Bài Thi Thử Nghiệm',
      school: 'Phòng Thử Nghiệm Hệ Thống iSMART',
      grade: 'Khối 2',
      className: 'Test Run'
    });
    setCurrentMode('test');
    showToast('🚀 Đã bắt đầu Chế Độ Test Chạy Thử Đề Thi!', 'info');
  };

  const handleExitTestRun = () => {
    setIsTestRunMode(false);
    setTestRunInitialPartId(undefined);
    setCurrentStudent(null);
    setCurrentMode(currentUserRole === 'teacher' && !currentTeacher?.permissions.includes('edit_exam') ? 'students' : 'admin');
    showToast('↩️ Đã thoát chế độ chạy thử!', 'info');
  };

  const handleEnterStandaloneStudentPortal = () => {
    setIsTestRunMode(false);
    setIsStudentKioskLocked(true);
    setCurrentMode('test');
    showToast('🔒 Đã chuyển sang Trang Thi Học Sinh Độc Lập!', 'info');
  };

  const handleAdminPinUnlockSuccess = () => {
    setIsStudentKioskLocked(false);
    setIsPinModalOpen(false);
    setCurrentStudent(null);
    setCurrentUserRole('admin');
    setCurrentMode('admin');
    if (typeof window !== 'undefined' && window.location.search.includes('role=student')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
    showToast('🔓 Đã mở khóa quyền Quản trị viên (Admin) thành công!', 'success');
  };

  const handleLogout = () => {
    openConfirm(
      'Đăng xuất khỏi hệ thống?',
      'Bạn có chắc chắn muốn đăng xuất và quay lại cổng chọn vai trò đăng nhập không?',
      () => {
        setCurrentUserRole('guest');
        setCurrentTeacher(null);
        setCurrentStudent(null);
        setPortalPendingStudent(null);
        setIsStudentKioskLocked(false);
        setIsTestRunMode(false);
        sessionStorage.removeItem('ismart_user_role');
        sessionStorage.removeItem('ismart_current_teacher');
        sessionStorage.removeItem('ismart_current_student');
        if (typeof window !== 'undefined' && window.location.search.includes('role=student')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('role');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
        showToast('Đã đăng xuất khỏi hệ thống!', 'info');
      }
    );
  };

  const handleRefreshScoresFromCloud = async (silent = false) => {
    setIsCloudSyncing(true);
    try {
      const cloudStudents = await fetchAllStudentsFromCloud();
      if (cloudStudents && cloudStudents.length > 0) {
        setStudents((prev) => {
          const meta = syncMetaRef.current;
          const finalList = mergeStudentsList(prev, cloudStudents, meta.dirtyStudents, meta.deletedStudentIds);
          saveToStorage('ismart_students', finalList);
          return finalList;
        });
        setCloudHealth('connected');
        if (!silent) {
          const scoredCount = cloudStudents.filter((s) => s.score !== null && s.score !== undefined).length;
          showToast(`☁️ Đã cập nhật Bảng Điểm từ Cloud (${scoredCount} bài thi đã có điểm & bài làm chi tiết)!`, 'success');
        }
      } else if (!silent) {
        showToast('Chưa có thêm bài nộp mới nào trên Cloud.', 'info');
      }
    } catch (err) {
      if (!silent) {
        showToast(`Không thể tải điểm từ Cloud: ${formatCloudError(err)}`, 'warn');
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleUpdateStudentScore = (
    studentId: string,
    score: number,
    total: number,
    points10: string,
    partScores?: Record<string, PartScoreRecord>,
    questionScores?: Record<number, number>,
    details?: Record<number, any>,
    sectionScores?: Record<string, SectionScoreRecord>
  ) => {
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const targetStudent = students.find((s) => s.id === studentId) || currentStudent;
    const targetExam = findExamForStudent(gradeExams, targetStudent, activeExamId);

    setStudents((prev) => {
      const existsInPrev = prev.some((s) => s.id === studentId);
      const updated = existsInPrev
        ? prev.map((s) => {
            if (s.id === studentId) {
              return {
                ...s,
                examId: targetExam.id,
                score,
                total,
                points10,
                submittedAt: nowStr,
                sectionScores: sectionScores || s.sectionScores,
                partScores: partScores || s.partScores,
                questionScores: questionScores || s.questionScores,
                details: details || s.details
              };
            }
            return s;
          })
        : targetStudent
        ? [
            {
              ...targetStudent,
              examId: targetExam.id,
              score,
              total,
              points10,
              submittedAt: nowStr,
              sectionScores,
              partScores,
              questionScores,
              details
            },
            ...prev
          ]
        : prev;

      try {
        saveToStorage('ismart_students', updated);
      } catch {
        // ignore
      }
      return updated;
    });

    // Push graded exam score directly to Firebase Firestore (automatic for every student account)
    const studentMeta = targetStudent
      ? {
          name: targetStudent.name,
          grade: targetStudent.grade,
          className: targetStudent.className,
          school: targetStudent.school,
          examId: targetExam.id,
        }
      : undefined;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      submitStudentScoreToCloud({
        studentId,
        examId: targetExam.id,
        score,
        total,
        points10,
        submittedAt: nowStr,
        partScores,
        questionScores,
        details,
        sectionScores,
        studentMeta,
        examMeta: targetExam,
      }).catch(() => {
        // Queue for automatic retry if network drop happened right at submit
        try {
          const queueRaw = localStorage.getItem('ismart_offline_submission_queue') || '[]';
          const queue = JSON.parse(queueRaw);
          queue.push({
            studentId,
            examId: targetExam.id,
            totalEarnedPoints: score,
            maxExamPoints: total,
            pts10: points10,
            submittedAt: new Date().toISOString(),
            partScores,
            questionScores,
            userAnswers: details,
            sectionScores,
            studentMeta,
          });
          localStorage.setItem('ismart_offline_submission_queue', JSON.stringify(queue));
        } catch {
          // ignore
        }
      });
    } else {
      try {
        const queueRaw = localStorage.getItem('ismart_offline_submission_queue') || '[]';
        const queue = JSON.parse(queueRaw);
        queue.push({
          studentId,
          examId: targetExam.id,
          totalEarnedPoints: score,
          maxExamPoints: total,
          pts10: points10,
          submittedAt: new Date().toISOString(),
          partScores,
          questionScores,
          userAnswers: details,
          sectionScores,
          studentMeta,
        });
        localStorage.setItem('ismart_offline_submission_queue', JSON.stringify(queue));
      } catch {
        // ignore
      }
    }
  };

  const handleSaveGradedStudent = (studentData: {
    studentId: string;
    name: string;
    className: string;
    school: string;
    score: number;
    total: number;
    points10: string;
    questionScores: Record<number, number>;
    partScores: Record<string, PartScoreRecord>;
    details: Record<number, any>;
  }) => {
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const trimmedTargetName = (studentData.name || '').trim().toLowerCase();
    const trimmedTargetClass = (studentData.className || '').trim().toLowerCase();
    const targetId = (studentData.studentId || '').trim().toLowerCase();

    const existing = students.find((s) => {
      if (targetId && s.id.toLowerCase() === targetId) return true;
      if (
        trimmedTargetName &&
        s.name.trim().toLowerCase() === trimmedTargetName &&
        (!trimmedTargetClass || s.className.trim().toLowerCase() === trimmedTargetClass)
      ) {
        return true;
      }
      return false;
    });

    const syncedStudentRecord: Student = existing
      ? {
          ...existing,
          name: studentData.name || existing.name,
          className: studentData.className || existing.className,
          school: studentData.school || existing.school,
          score: studentData.score,
          total: studentData.total,
          points10: studentData.points10,
          questionScores: studentData.questionScores,
          partScores: studentData.partScores,
          details: studentData.details,
          submittedAt: `Chấm camera ${nowStr}`,
        }
      : {
          id: studentData.studentId || `HV-${Date.now().toString().slice(-4)}`,
          name: studentData.name || 'Học sinh chưa rõ tên',
          grade: activeExam?.grade || 'Khối 2',
          className: studentData.className || '2A',
          school: studentData.school || schools[0] || 'Trường Tiểu học',
          score: studentData.score,
          total: studentData.total,
          points10: studentData.points10,
          questionScores: studentData.questionScores,
          partScores: studentData.partScores,
          details: studentData.details,
          submittedAt: `Chấm camera ${nowStr}`,
        };

    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === syncedStudentRecord.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = syncedStudentRecord;
        return updated;
      }
      return [syncedStudentRecord, ...prev];
    });

    if (studentData.school && !schools.includes(studentData.school)) {
      markConfigDirty();
      setSchools((prev) => [...prev, studentData.school]);
    }

    syncStudentsBatchToCloud([syncedStudentRecord]).catch((err) => {
      updateSyncMetaState((prev) => ({ ...prev, dirtyStudents: true, studentsUpdatedAtMs: Date.now() }));
      showToast(`Đã lưu điểm trên máy, chưa đẩy Cloud: ${formatCloudError(err)}`, 'warn');
    });

    showToast(`✅ Đã lưu kết quả chấm camera & đồng bộ Cloud cho ${studentData.name} (${studentData.points10} điểm)!`, 'success');
  };

  const handleQuickLoginFromTable = (student: Student) => {
    setCurrentStudent(student);
    setIsStudentKioskLocked(true);
    setCurrentMode('test');
    showToast(`Đã chuyển thẳng vào phòng thi cho ${student.name}!`);
  };

  const handleSaveAppBranding = async (nextBranding: AppBranding, customToast?: string) => {
    if (currentUserRole !== 'admin') {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền thay đổi Logo & Tên hệ thống!', 'warn');
      return;
    }
    const nowMs = Date.now();
    const stampedBranding: AppBranding = { ...nextBranding, updatedAtMs: nowMs };
    setAppBranding(stampedBranding);
    markConfigDirty(nowMs);
    await saveToStorage('ismart_app_branding', stampedBranding);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Đã lưu Logo & Tên hệ thống trên máy (sẽ tự đẩy Cloud khi có mạng)!', 'info');
      return;
    }

    setIsCloudSyncing(true);
    try {
      await saveAppConfigToCloud(schools, activeExamId, stampedBranding);
      updateSyncMetaState((prev) => ({ ...prev, dirtyConfig: false, configUpdatedAtMs: nowMs }));
      setCloudHealth('connected');
      showToast(customToast || `✅ Đã cập nhật Logo & Tên "${stampedBranding.appName}" và đồng bộ Cloud!`, 'success');
    } catch (err) {
      showToast(`Đã lưu trên máy, đồng bộ Cloud bị lỗi: ${formatCloudError(err)}`, 'warn');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Download Standalone Self-contained HTML
  const handleDownloadStandaloneHTML = () => {
    const safeBrandName = (appBranding.appName || 'iSMART LMS').replace(/[<>&"]/g, '');
    const safeLogoText = (appBranding.logoText || 'iS').replace(/[<>&"]/g, '');
    const exportLogoW = Math.min(280, Math.max(24, Math.round(appBranding.logoWidth ?? 64)));
    const exportLogoH = Math.min(120, Math.max(24, Math.round(appBranding.logoHeight ?? 64)));
    const dataPayload = JSON.stringify({
      examMinutes,
      adminPin,
      schools,
      students,
      parts,
      questions,
      branding: appBranding
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeBrandName} - Trang Thi Độc Lập Cho Học Sinh</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; }
    .stage { position: relative; width: 100%; background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
    .canvas { position: relative; width: 100%; height: 0; background-size: 100% 100%; }
  </style>
</head>
<body class="p-6">
  <div class="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6 text-center">
    <div style="width:${exportLogoW}px;height:${exportLogoH}px" class="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-black mx-auto shadow-md overflow-hidden">
      ${safeLogoText}
    </div>
    <h1 class="text-2xl font-black text-slate-900">HỆ THỐNG THI TRỰC TUYẾN ${safeBrandName}</h1>
    <p class="text-sm text-slate-600 max-w-lg mx-auto">
      Gói đề thi độc lập gồm <strong>${questions.length} câu hỏi</strong>, thời gian làm bài <strong>${examMinutes} phút</strong>.
    </p>
    <div class="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-left text-xs text-blue-900 space-y-1">
      <div><strong>Trạng thái dữ liệu:</strong> Đã nhúng sẵn ${questions.length} câu hỏi & ${students.length} học sinh.</div>
      <div><strong>Hướng dẫn:</strong> Mở link trực tuyến của trường để làm bài có chấm điểm đồng bộ trực tiếp.</div>
    </div>
  </div>
  <script>
    window.__IS_STANDALONE_EXPORT__ = true;
    window.__IS_DATA__ = ${dataPayload};
  <\/script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trang-thi-hoc-sinh-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file HTML Trang Thi Độc Lập thành công!');
  };

  // Universal Portal Landing Screen when no role is logged in
  if (currentUserRole === 'guest') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <PortalLanding
          adminPin={adminPin}
          teachers={teachers}
          students={students}
          branding={appBranding}
          cloudHealth={cloudHealth}
          onLoginAdmin={() => {
            setPortalPendingStudent(null);
            setCurrentUserRole('admin');
            setCurrentMode('admin');
            setIsStudentKioskLocked(false);
            showToast('Chào mừng Quản trị viên (Admin) đăng nhập hệ thống!', 'success');
          }}
          onLoginTeacher={(teacher) => {
            setPortalPendingStudent(null);
            setCurrentUserRole('teacher');
            setCurrentTeacher(teacher);
            setIsStudentKioskLocked(false);
            if (teacher.permissions.includes('edit_exam')) {
              setCurrentMode('admin');
            } else if (teacher.permissions.includes('manage_students')) {
              setCurrentMode('students');
            } else if (teacher.permissions.includes('view_scores')) {
              setCurrentMode('scores');
            } else if (teacher.permissions.includes('test_run')) {
              setCurrentMode('test');
            } else {
              setCurrentMode('admin');
            }
            showToast(`Chào mừng ${teacher.name} đăng nhập Cổng Giáo Viên!`, 'success');
          }}
          onVerifyTeacherCloud={verifyTeacherLoginFromCloud}
          onLookupTeacherPublicCloud={lookupTeacherPublicByUsername}
          onLookupStudentCloud={lookupStudentByIdFromCloud}
          onGoToStudentExam={(prefillStudent) => {
            setPortalPendingStudent(prefillStudent || null);
            setCurrentUserRole('student');
            setIsStudentKioskLocked(true);
            setCurrentMode('test');
          }}
          showToast={showToast}
        />

        {/* Toast Notification Container */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm flex items-center gap-2 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
                t.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : t.type === 'warn'
                  ? 'bg-amber-500 text-white'
                  : t.type === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <i
                className={`fa-solid ${
                  t.type === 'success'
                    ? 'fa-circle-check'
                    : t.type === 'warn'
                    ? 'fa-triangle-exclamation'
                    : t.type === 'error'
                    ? 'fa-circle-xmark'
                    : 'fa-circle-info'
                }`}
              ></i>
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm flex items-center gap-2 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : t.type === 'warn'
                ? 'bg-amber-500 text-white'
                : t.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <i
              className={`fa-solid ${
                t.type === 'success'
                  ? 'fa-circle-check'
                  : t.type === 'warn'
                  ? 'fa-triangle-exclamation'
                  : t.type === 'error'
                  ? 'fa-circle-xmark'
                  : 'fa-circle-info'
              }`}
            ></i>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={() => {
          confirmState.onOk();
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Admin PIN Unlock Modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        adminPin={adminPin}
        onSuccess={handleAdminPinUnlockSuccess}
        onClose={() => setIsPinModalOpen(false)}
      />

      {/* PDF Exam Importer Modal */}
      <PdfExamImporterModal
        isOpen={isPdfImporterOpen}
        onClose={() => setIsPdfImporterOpen(false)}
        parts={parts}
        onAddQuestion={(newQ) => {
          setQuestions((prev) => [...prev, newQ]);
        }}
        showToast={showToast}
      />

      {/* AI Camera Exam Grader Modal */}
      <CameraExamGraderModal
        isOpen={isCameraGraderOpen}
        onClose={() => setIsCameraGraderOpen(false)}
        parts={parts}
        questions={questions}
        schools={schools}
        students={students}
        gradeExams={gradeExams}
        activeExamId={activeExamId}
        onSelectExam={handleSelectGradeExam}
        onSaveGradedStudent={handleSaveGradedStudent}
        showToast={showToast}
      />

      {/* Offline Exam & Answer Sheet Printer Modal */}
      <OfflineExamPrinterModal
        isOpen={isOfflinePrinterOpen}
        onClose={() => setIsOfflinePrinterOpen(false)}
        parts={parts}
        questions={questions}
        examMinutes={examMinutes}
        gradeExams={gradeExams}
        activeExamId={activeExamId}
        onSelectExam={handleSelectGradeExam}
      />

      {/* Export & Publish Online Student Exam Modal */}
      <ExportOnlineExamModal
        isOpen={isExportOnlineModalOpen}
        onClose={() => setIsExportOnlineModalOpen(false)}
        activeExam={activeExam}
        students={students}
        onEnterStandalonePortal={handleEnterStandaloneStudentPortal}
        showToast={showToast}
      />

      {/* Admin-only Branding Customization Modal */}
      {currentUserRole === 'admin' && (
        <AdminBrandingModal
          isOpen={isBrandingModalOpen}
          branding={appBranding}
          defaultBranding={DEFAULT_APP_BRANDING}
          onSave={handleSaveAppBranding}
          onClose={() => setIsBrandingModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* 1. Header for Standalone Student Mode */}
      {(() => {
        const brandLogoW = Math.min(280, Math.max(24, Math.round(appBranding.logoWidth ?? 40)));
        const brandLogoH = Math.min(120, Math.max(24, Math.round(appBranding.logoHeight ?? 40)));
        const brandLogoFitClass =
          appBranding.logoFit === 'fill' ? 'object-fill' : appBranding.logoFit === 'cover' ? 'object-cover' : 'object-contain';
        const brandLogoFontPx = Math.max(13, Math.min(34, Math.round(Math.min(brandLogoH * 0.48, brandLogoW * 0.44))));
        const brandLogoStyle = { width: `${brandLogoW}px`, height: `${brandLogoH}px` };

        return isStudentKioskLocked ? (
        <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm sticky top-0 z-30">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {appBranding.logoUrl ? (
                <img
                  src={appBranding.logoUrl}
                  alt={appBranding.appName}
                  style={brandLogoStyle}
                  className={`rounded-xl ${brandLogoFitClass} bg-white border border-slate-200 p-0.5 shadow-sm shrink-0`}
                />
              ) : (
                <div
                  style={{ ...brandLogoStyle, fontSize: `${brandLogoFontPx}px` }}
                  className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 shrink-0 px-1.5 text-center leading-none overflow-hidden"
                >
                  {appBranding.logoText || 'iS'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight"
                    data-preserve-content={appBranding.appName ? 'true' : undefined}
                  >
                    {appBranding.appName || 'HỆ THỐNG KIỂM TRA TRỰC TUYẾN'}
                  </h1>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <i className="fa-solid fa-shield-halved mr-1"></i>TRANG THI HỌC SINH ĐỘC LẬP
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Dữ liệu đề thi & kết quả được liên kết trực tiếp với máy chủ Quản trị viên
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <LanguageToggleButton variant="light" />
              <span className="hidden sm:flex px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Đã kết nối máy chủ Admin</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Quay lại cổng chọn vai trò đăng nhập"
                aria-label="Quay lại cổng chọn vai trò đăng nhập"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* 2. Admin & Teacher Header (Non-sticky & Compact) */
        <header className="bg-white border-b border-slate-200 shadow-2xs relative z-20">
          {/* Row 1: Compact Brand + Session & Publish Controls */}
          <div className="w-full px-3 sm:px-5 py-1.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUserRole === 'admin' ? (
                <button
                  type="button"
                  onClick={() => setIsBrandingModalOpen(true)}
                  title="Chỉ Admin: Nhấn để thay đổi Logo, Kích thước & Tên hệ thống"
                  className="group relative shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  {appBranding.logoUrl ? (
                    <img
                      src={appBranding.logoUrl}
                      alt={appBranding.appName}
                      style={brandLogoStyle}
                      className={`rounded-lg ${brandLogoFitClass} bg-white border border-slate-200 p-0.5 shadow-2xs group-hover:ring-2 group-hover:ring-amber-400 transition`}
                    />
                  ) : (
                    <div
                      style={{ ...brandLogoStyle, fontSize: `${brandLogoFontPx}px` }}
                      className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-sm shadow-blue-500/20 group-hover:brightness-110 transition px-1.5 text-center leading-none overflow-hidden"
                    >
                      {appBranding.logoText || 'iS'}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] flex items-center justify-center shadow border border-white opacity-90 group-hover:scale-110 transition">
                    <i className="fa-solid fa-pen"></i>
                  </span>
                </button>
              ) : appBranding.logoUrl ? (
                <img
                  src={appBranding.logoUrl}
                  alt={appBranding.appName}
                  style={brandLogoStyle}
                  className={`rounded-lg ${brandLogoFitClass} bg-white border border-slate-200 p-0.5 shadow-2xs shrink-0`}
                />
              ) : (
                <div
                  style={{ ...brandLogoStyle, fontSize: `${brandLogoFontPx}px` }}
                  className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-sm shadow-blue-500/20 shrink-0 px-1.5 text-center leading-none overflow-hidden"
                >
                  {appBranding.logoText || 'iS'}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentUserRole === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => setIsBrandingModalOpen(true)}
                      title="Chỉ Admin: Nhấn để đổi tên hệ thống hoặc logo"
                      data-preserve-content="true"
                      className="text-left text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight hover:text-blue-700 transition cursor-pointer"
                    >
                      {appBranding.appName || 'iSMART LMS'}
                    </button>
                  ) : (
                    <h1
                      data-preserve-content="true"
                      className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight"
                    >
                      {appBranding.appName || 'iSMART LMS'}
                    </h1>
                  )}
                  {currentUserRole === 'admin' ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                      <i className="fa-solid fa-user-shield text-[9px]"></i> ADMIN
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-900 border border-blue-300 inline-flex items-center gap-1">
                      <i className="fa-solid fa-chalkboard-user text-[9px]"></i>{' '}
                      <span data-preserve-content={currentTeacher?.name ? 'true' : undefined}>
                        {currentTeacher?.name || 'GIÁO VIÊN'}
                      </span>
                    </span>
                  )}
                  {currentUserRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setIsBrandingModalOpen(true)}
                      title="Chỉ Admin mới có quyền tùy chỉnh Logo và Tên hệ thống"
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-pen-to-square text-[9px]"></i>
                      <span className="hidden md:inline">Đổi Logo / Tên</span>
                    </button>
                  )}
                </div>

                {currentUserRole === 'admin' ? (() => {
                  const adminSubtitle =
                    appBranding.appSubtitle !== undefined
                      ? appBranding.appSubtitle
                      : (DEFAULT_APP_BRANDING.appSubtitle ?? '');

                  if (isEditingSubtitle) {
                    return (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const nextSub = subtitleDraft.trim().slice(0, 200);
                          setIsEditingSubtitle(false);
                          handleSaveAppBranding(
                            { ...appBranding, appSubtitle: nextSub },
                            nextSub
                              ? '✅ Đã cập nhật dòng mô tả và đồng bộ Cloud!'
                              : '🗑️ Đã xóa dòng mô tả và đồng bộ Cloud!'
                          );
                        }}
                        className="hidden sm:flex items-center gap-1 mt-0.5 flex-wrap"
                      >
                        <input
                          type="text"
                          autoFocus
                          maxLength={200}
                          value={subtitleDraft}
                          onChange={(e) => setSubtitleDraft(e.target.value)}
                          placeholder="Nhập dòng mô tả... (để trống để xóa)"
                          className="text-[11px] px-2 py-0.5 rounded border border-blue-400 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[220px] max-w-md"
                        />
                        <button
                          type="submit"
                          className="px-1.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition cursor-pointer"
                          title="Lưu dòng mô tả"
                        >
                          <i className="fa-solid fa-check mr-0.5"></i>Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingSubtitle(false);
                            handleSaveAppBranding(
                              { ...appBranding, appSubtitle: '' },
                              '🗑️ Đã xóa dòng mô tả và đồng bộ Cloud!'
                            );
                          }}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition cursor-pointer"
                          title="Xóa bỏ dòng mô tả này"
                        >
                          <i className="fa-solid fa-trash-can mr-0.5"></i>Xóa dòng
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingSubtitle(false)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold transition cursor-pointer"
                          title="Hủy"
                        >
                          Hủy
                        </button>
                      </form>
                    );
                  }

                  if (!adminSubtitle.trim()) {
                    return (
                      <div className="hidden sm:flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSubtitleDraft('');
                            setIsEditingSubtitle(true);
                          }}
                          title="Chỉ Admin: Thêm lại dòng mô tả dưới tên hệ thống"
                          className="text-[10px] font-semibold text-slate-400 hover:text-blue-600 border border-dashed border-slate-200 hover:border-blue-300 rounded px-1.5 py-0 transition cursor-pointer flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus text-[8px]"></i>
                          <span>Thêm dòng mô tả</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="hidden sm:flex items-center gap-1 group/subtitle">
                      <p
                        onClick={() => {
                          setSubtitleDraft(adminSubtitle);
                          setIsEditingSubtitle(true);
                        }}
                        title="Chỉ Admin: Nhấn để sửa dòng mô tả này"
                        data-preserve-content={
                          appBranding.appSubtitle &&
                          appBranding.appSubtitle !== DEFAULT_APP_BRANDING.appSubtitle
                            ? 'true'
                            : undefined
                        }
                        className="text-[11px] text-slate-500 hover:text-blue-700 transition cursor-pointer leading-tight truncate max-w-md"
                      >
                        {adminSubtitle}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSubtitleDraft(adminSubtitle);
                          setIsEditingSubtitle(true);
                        }}
                        title="Chỉ Admin: Sửa dòng mô tả"
                        className="opacity-50 group-hover/subtitle:opacity-100 p-0.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition cursor-pointer text-[9px]"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveAppBranding(
                            { ...appBranding, appSubtitle: '' },
                            '🗑️ Đã xóa dòng mô tả và đồng bộ Cloud!'
                          )
                        }
                        title="Chỉ Admin: Xóa dòng mô tả này"
                        className="opacity-50 group-hover/subtitle:opacity-100 p-0.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer text-[9px]"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  );
                })() : (
                  <p className="text-[11px] text-slate-500 hidden sm:block leading-tight">
                    {`Cổng Giáo Viên • Khối phụ trách: ${currentTeacher?.assignedGrades?.join(', ') || 'Chưa phân khối'}`}
                  </p>
                )}
              </div>
            </div>

            {/* Right Utility Strip: Duration, Cloud Sync, Save, Publish, Language, Logout */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('edit_exam')) && (
                <label className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700">
                  <span>⏱️ Phút:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={examMinutes}
                    onChange={(e) => setExamMinutes(+e.target.value || 15)}
                    className="w-11 px-1 py-0 text-center font-bold border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white"
                  />
                </label>
              )}

              <div
                title={
                  cloudHealth === 'offline'
                    ? 'Đang ngoại tuyến — dữ liệu lưu tạm trên máy và tự động đồng bộ khi có mạng'
                    : 'Tự động kết nối & lưu dữ liệu trực tiếp lên Firebase Cloud cho mọi tài khoản'
                }
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold ${
                  cloudHealth === 'offline'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isCloudSyncing
                      ? 'fa-rotate fa-spin text-blue-600'
                      : cloudHealth === 'offline'
                      ? 'fa-wifi-slash text-amber-600'
                      : 'fa-cloud-check text-emerald-600'
                  }`}
                ></i>
                <span className="hidden 2xl:inline">
                  {isCloudSyncing
                    ? 'Đang đồng bộ Cloud...'
                    : cloudHealth === 'offline'
                    ? 'Ngoại tuyến (Tự lưu máy)'
                    : 'Tự động lưu Cloud ✓'}
                </span>
                <span className="2xl:hidden">
                  {isCloudSyncing ? 'Sync...' : cloudHealth === 'offline' ? 'Offline' : 'Cloud ✓'}
                </span>
              </div>

              {(currentUserRole === 'admin' ||
                currentTeacher?.permissions.includes('edit_exam') ||
                currentTeacher?.permissions.includes('manage_students') ||
                currentTeacher?.permissions.includes('reset_scores')) && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleManualSaveAndSync}
                  title="Lưu và đồng bộ dữ liệu lên IndexedDB & Firebase Cloud Firestore"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {isSaving ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-floppy-disk"></i>
                  )}
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu & Đồng bộ'}</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('view_json')) && (
                <button
                  type="button"
                  onClick={() => setIsExportOnlineModalOpen(true)}
                  title="Xuất và phát hành đường link trang thi online độc lập cho học sinh"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-globe"></i>
                  <span>Xuất Trang Thi Online</span>
                </button>
              )}

              <LanguageToggleButton variant="light" />

              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất khỏi tài khoản hiện tại"
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <i className="fa-solid fa-right-from-bracket text-rose-500"></i>
                <span className="hidden sm:inline">Đăng Xuất</span>
              </button>
            </div>
          </div>

          {/* Row 2: Slim Unified Navigation Tabs + Exam Paper/AI Tools */}
          <div className="w-full px-3 sm:px-5 py-1.5 bg-slate-50/75 flex flex-wrap items-center justify-between gap-2">
            {/* Navigation Tabs based on RBAC */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-200 overflow-x-auto max-w-full gap-0.5">
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('edit_exam')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('admin')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'admin'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-pen-ruler"></i> 1. Soạn Đề
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('manage_students')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('students')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'students'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-users-gear"></i> 2. DS Học Sinh & Trường
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('view_scores')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('scores')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'scores'
                      ? 'bg-white text-cyan-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-chart-line text-cyan-600"></i> 3. Bảng Điểm & Xuất Điểm
                </button>
              )}

              {currentUserRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('teachers')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'teachers'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-user-gear text-amber-600"></i>
                  <span>4. QL Giáo Viên</span>
                  <span className="px-1.5 py-0 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                    {teachers.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleEnterStandaloneStudentPortal}
                className="px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 text-blue-800 bg-blue-50/90 hover:bg-blue-100 border border-blue-200/80 cursor-pointer"
              >
                <i className="fa-solid fa-display"></i> Mở Trang Thi Độc Lập
              </button>

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('test_run')) && (
                <button
                  type="button"
                  onClick={() => handleStartTestRun()}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'test' && isTestRunMode
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                  title="Chạy thử nghiệm đề thi sau khi soạn để kiểm tra hiển thị câu hỏi, audio, vẽ tô màu và tính điểm"
                >
                  <i className={`fa-solid fa-play text-[10px] ${currentMode === 'test' && isTestRunMode ? 'text-white' : 'text-emerald-600'}`}></i>
                  <span>Test Chạy Thử</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('view_json')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('json')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'json'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-code"></i> Cấu hình & Link
                </button>
              )}
            </div>

            {/* Compact Paper / PDF / Camera AI Tools */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('camera_grader')) && (
                <button
                  type="button"
                  onClick={() => setIsCameraGraderOpen(true)}
                  title="Chấm bài thi của học sinh bằng camera điện thoại hoặc tải ảnh chụp bài thi"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>Chấm Bài Camera AI</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('print_offline')) && (
                <button
                  type="button"
                  onClick={() => setIsOfflinePrinterOpen(true)}
                  title="In đề thi giấy và phiếu trả lời trắc nghiệm cho học sinh làm bài offline"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>In Đề Thi Offline</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('import_pdf')) && (
                <button
                  type="button"
                  onClick={() => setIsPdfImporterOpen(true)}
                  title="Mở bảng nạp đề từ file PDF của bạn, cắt hình ảnh và trích xuất nội dung vào đề thi"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>Nạp Đề Từ File PDF</span>
                </button>
              )}
            </div>
          </div>
        </header>
        );
      })()}

      {/* Main Content Area */}
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-5">
        {currentMode === 'admin' && (
          <AdminQuestionEditor
            parts={parts}
            onPartsChange={setParts}
            questions={questions}
            onChange={setQuestions}
            onSaveAndSync={handleManualSaveAndSync}
            isSaving={isSaving}
            lastSavedTime={lastSavedTime}
            gradeExams={gradeExams}
            activeExamId={activeExamId}
            onSelectExam={handleSelectGradeExam}
            onCreateExam={handleCreateGradeExam}
            onDuplicateExam={handleDuplicateGradeExam}
            onUpdateExamMeta={handleUpdateGradeExamMeta}
            onDeleteExam={handleDeleteGradeExam}
            availableClasses={Array.from(new Set(students.map((s) => s.className).filter(Boolean)))}
            onOpenPdfImporter={() => setIsPdfImporterOpen(true)}
            onOpenCameraGrader={() => setIsCameraGraderOpen(true)}
            onOpenOfflinePrinter={() => setIsOfflinePrinterOpen(true)}
            onStartTestRun={handleStartTestRun}
            onResetSample={() => {
              openConfirm(
                'Khôi phục bộ câu hỏi mẫu chuẩn cho đề này?',
                'Tất cả Part và câu hỏi của đề hiện tại sẽ được đặt lại theo mẫu chuẩn (Toán & Khoa học 3 Parts, 10 điểm).',
                () => {
                  setParts(getInitialParts());
                  setQuestions(getInitialQuestions());
                  showToast('Đã khôi phục bộ 3 Parts & 13 câu hỏi mẫu thành công!');
                }
              );
            }}
            showToast={showToast}
            openConfirm={openConfirm}
          />
        )}

        {currentMode === 'students' && (
          <StudentManager
            parts={parts}
            schools={schools}
            students={students}
            onSchoolsChange={(newSchools) => {
              const nowMs = Date.now();
              setSchools(newSchools);
              markConfigDirty(nowMs);
              saveAppConfigToCloud(newSchools, activeExamId, currentUserRole === 'admin' ? appBranding : undefined)
                .then(() => {
                  updateSyncMetaState((prev) => ({ ...prev, dirtyConfig: false, configUpdatedAtMs: nowMs }));
                })
                .catch((err) => {
                  showToast(`Lưu DS trường lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                });
            }}
            onStudentsChange={(newStudents) => {
              const prevIds = new Set(students.map((s) => s.id));
              const nextIds = new Set(newStudents.map((s) => s.id));
              const removedIds = Array.from(prevIds).filter((id) => !nextIds.has(id));
              const changed = newStudents.filter((ns) => {
                const old = students.find((os) => os.id === ns.id);
                return !old || JSON.stringify(old) !== JSON.stringify(ns);
              });
              setStudents(newStudents);
              saveToStorage('ismart_students', newStudents);
              updateSyncMetaState((prev) => ({
                ...prev,
                dirtyStudents: true,
                studentsUpdatedAtMs: Date.now(),
                deletedStudentIds: Array.from(
                  new Set([
                    ...prev.deletedStudentIds.filter((id) => !nextIds.has(id)),
                    ...removedIds,
                  ])
                ),
              }));
              if (changed.length > 0) {
                syncStudentsBatchToCloud(changed)
                  .then(() => {
                    updateSyncMetaState((prev) => ({ ...prev, dirtyStudents: false }));
                  })
                  .catch((err) => {
                    showToast(`Đồng bộ học sinh lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                  });
              }
              if (removedIds.length > 0) {
                deleteStudentsFromCloud(removedIds)
                  .then(() => {
                    const removedSet = new Set(removedIds);
                    updateSyncMetaState((prev) => ({
                      ...prev,
                      deletedStudentIds: prev.deletedStudentIds.filter((id) => !removedSet.has(id)),
                    }));
                  })
                  .catch((err) => {
                    showToast(`Xóa học sinh trên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                  });
              }
            }}
            onQuickLogin={handleQuickLoginFromTable}
            onOpenCameraGrader={() => setIsCameraGraderOpen(true)}
            onResetSampleStudents={() => {
              openConfirm(
                'Khôi phục danh sách học sinh mẫu?',
                'Danh sách sẽ được đặt lại theo các trường và học sinh mẫu.',
                () => {
                  const nowMs = Date.now();
                  const initSchools = getInitialSchools();
                  const initStudents = getInitialStudents();
                  markConfigDirty(nowMs);
                  updateSyncMetaState((prev) => ({
                    ...prev,
                    dirtyStudents: true,
                    studentsUpdatedAtMs: nowMs,
                    deletedStudentIds: [],
                  }));
                  setSchools(initSchools);
                  setStudents(initStudents);
                  saveAppConfigToCloud(initSchools, activeExamId, currentUserRole === 'admin' ? appBranding : undefined)
                    .then(() => updateSyncMetaState((prev) => ({ ...prev, dirtyConfig: false })))
                    .catch(() => {});
                  syncStudentsBatchToCloud(initStudents)
                    .then(() => updateSyncMetaState((prev) => ({ ...prev, dirtyStudents: false })))
                    .catch(() => {});
                  showToast('Đã khôi phục danh sách học sinh mẫu và đồng bộ Cloud!');
                }
              );
            }}
            showToast={showToast}
            openConfirm={openConfirm}
          />
        )}

        {currentMode === 'scores' && (
          <ExamScoreManager
            parts={parts}
            questions={questions}
            gradeExams={gradeExams}
            activeExamId={activeExamId}
            schools={schools}
            students={students}
            isCloudConnected={cloudHealth !== 'offline'}
            isRefreshingCloud={isCloudSyncing}
            onRefreshFromCloud={() => handleRefreshScoresFromCloud(false)}
            canResetScores={currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('reset_scores')}
            onStudentsChange={(newStudents) => {
              const resetIds = newStudents
                .filter((ns) => {
                  const old = students.find((os) => os.id === ns.id);
                  return old && old.submittedAt !== null && ns.submittedAt === null;
                })
                .map((s) => s.id);
              setStudents(newStudents);
              saveToStorage('ismart_students', newStudents);
              if (resetIds.length > 0) {
                resetStudentsScoreInCloud(resetIds).catch((err) => {
                  updateSyncMetaState((prev) => ({ ...prev, dirtyStudents: true, studentsUpdatedAtMs: Date.now() }));
                  showToast(`Xóa điểm trên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                });
              }
            }}
            onOpenCameraGrader={() => setIsCameraGraderOpen(true)}
            showToast={showToast}
            openConfirm={openConfirm}
          />
        )}

        {currentMode === 'teachers' && (
          <TeacherManager
            teachers={teachers}
            onUpdateTeachers={(newTeachers) => {
              const nowMs = Date.now();
              const nextKeys = new Set(newTeachers.map((t) => normalizeTeacherKey(t.username)));
              const removedTeachers = teachers.filter(
                (t) => !nextKeys.has(normalizeTeacherKey(t.username))
              );
              const removedUsernames = removedTeachers.map((t) => t.username);
              const stampedTeachers = newTeachers.map((t) => ({
                ...t,
                updatedAtMs: t.updatedAtMs || nowMs,
                isCustom: true,
              }));

              setTeachers(stampedTeachers);
              saveToStorage('ismart_teachers', stampedTeachers);
              markTeachersDirty(
                removedUsernames,
                stampedTeachers.map((t) => t.username)
              );

              Promise.all([
                saveTeachersToCloud(stampedTeachers),
                ...removedTeachers.map((rt) => deleteTeacherUsernameFromCloud(rt.username)),
              ])
                .then(() => {
                  const removedKeySet = new Set(removedUsernames.map(normalizeTeacherKey));
                  updateSyncMetaState((prev) => ({
                    ...prev,
                    dirtyTeachers: false,
                    deletedTeacherUsernames: prev.deletedTeacherUsernames.filter(
                      (u) => !removedKeySet.has(normalizeTeacherKey(u))
                    ),
                  }));
                })
                .catch((err) => {
                  showToast(`Đã lưu trên máy, đồng bộ danh sách GV lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                });
            }}
            showToast={showToast}
            openConfirm={openConfirm}
          />
        )}

        {currentMode === 'test' && (() => {
          const playerExam = isTestRunMode
            ? activeExam
            : findExamForStudent(gradeExams, currentStudent, activeExamId);

          return (
            <StudentExamPlayer
              parts={playerExam.parts}
              questions={playerExam.questions}
              students={students}
              currentStudent={currentStudent}
              examMinutes={playerExam.examMinutes}
              isTestRun={isTestRunMode}
              initialPartId={testRunInitialPartId}
              initialPendingStudent={isTestRunMode ? null : portalPendingStudent}
              onExitTestRun={handleExitTestRun}
              onLoginStudent={(stu) => {
                setPortalPendingStudent(null);
                setCurrentStudent(stu);
              }}
              onLogoutStudent={() => {
                if (isTestRunMode) {
                  handleExitTestRun();
                } else {
                  setCurrentStudent(null);
                  setPortalPendingStudent(null);
                  setCurrentUserRole('guest');
                  setIsStudentKioskLocked(false);
                  showToast('Đã quay về trang đăng nhập!');
                }
              }}
              onUpdateStudentScore={handleUpdateStudentScore}
              onRequestUnlockAdmin={() => setIsPinModalOpen(true)}
              onLookupStudentCloud={lookupStudentByIdFromCloud}
              onLookupClassStudentsCloud={lookupStudentsByClassFromCloud}
              showToast={showToast}
              openConfirm={openConfirm}
            />
          );
        })()}

        {currentMode === 'json' && (
          <JsonConfigView
            parts={parts}
            questions={questions}
            gradeExams={gradeExams}
            activeExamId={activeExamId}
            schools={schools}
            students={students}
            teachers={teachers}
            examMinutes={examMinutes}
            adminPin={adminPin}
            cloudUserEmail={cloudUser?.email || null}
            cloudHealth={cloudHealth}
            isCloudSyncing={isCloudSyncing}
            cloudInventory={cloudInventory}
            lastSyncReport={lastSyncReport}
            onPushAllToCloud={handleManualSaveAndSync}
            onPullAllFromCloud={handlePullAllFromCloud}
            onRefreshCloudInventory={handleRefreshCloudInventory}
            onApplySnapshot={handleApplyFullSnapshot}
            onDownloadGitHubSnapshot={(includeSensitiveAuth) =>
              handleDownloadBackupJSON({
                filename: 'ismart-snapshot.json',
                includeSensitiveAuth,
              })
            }
            onUploadBackupJSON={handleUploadBackupJSON}
            onPartsChange={setParts}
            onQuestionsChange={setQuestions}
            onSchoolsChange={(nextSchools) => {
              markConfigDirty();
              setSchools(nextSchools);
            }}
            onStudentsChange={(nextStudents) => {
              updateSyncMetaState((prev) => ({
                ...prev,
                dirtyStudents: true,
                studentsUpdatedAtMs: Date.now(),
              }));
              setStudents(nextStudents);
            }}
            onExamMinutesChange={setExamMinutes}
            onAdminPinChange={setAdminPin}
            onEnterStandaloneStudentPortal={handleEnterStandaloneStudentPortal}
            onDownloadStandaloneHTML={handleDownloadStandaloneHTML}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}
