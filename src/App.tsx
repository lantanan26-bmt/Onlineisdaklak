/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, Question, Student, ExamPart, PartScoreRecord, SectionScoreRecord, GradeExamProfile, Teacher, UserRole } from './types';
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
import { canonicalSortParts } from './utils/sectionUtils';
import { saveToStorage, loadFromStorage, getInitialSyncStorage } from './utils/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  checkCloudConnectionStatus,
  CloudInventorySummary,
  CloudSyncReport,
  deleteExamFromCloud,
  deleteStudentsFromCloud,
  deleteTeacherFromCloud,
  fetchAllStudentsFromCloud,
  fetchAppConfigFromCloud,
  fetchCloudInventorySummary,
  fetchPublishedExamsFromCloud,
  fetchTeachersForAdminFromCloud,
  formatCloudError,
  lookupStudentByIdFromCloud,
  resetStudentsScoreInCloud,
  saveAllExamsToCloud,
  saveAppConfigToCloud,
  saveTeachersToCloud,
  signInWithGoogleCloud,
  signOutGoogleCloud,
  submitStudentScoreToCloud,
  syncAllDataToCloud,
  syncStudentsBatchToCloud,
  verifyTeacherLoginFromCloud,
} from './services/firebaseService';

interface ToastItem {
  id: string;
  msg: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

export default function App() {
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

  // Setters that update the active grade exam inside gradeExams
  const setParts = useCallback((newParts: ExamPart[] | ((prev: ExamPart[]) => ExamPart[])) => {
    hasLocalEditsRef.current = true;
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newParts === 'function' ? newParts(e.parts) : newParts;
          return {
            ...e,
            parts: canonicalSortParts(resolved),
            updatedAt: new Date().toLocaleDateString('vi-VN')
          };
        }
        return e;
      })
    );
  }, [activeExamId]);

  const setQuestions = useCallback((newQuestions: Question[] | ((prev: Question[]) => Question[])) => {
    hasLocalEditsRef.current = true;
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newQuestions === 'function' ? newQuestions(e.questions) : newQuestions;
          return {
            ...e,
            questions: resolved,
            updatedAt: new Date().toLocaleDateString('vi-VN')
          };
        }
        return e;
      })
    );
  }, [activeExamId]);

  const setExamMinutes = useCallback((newMinutes: number | ((prev: number) => number)) => {
    hasLocalEditsRef.current = true;
    setGradeExams((prevExams) =>
      prevExams.map((e) => {
        if (e.id === activeExamId) {
          const resolved = typeof newMinutes === 'function' ? newMinutes(e.examMinutes) : newMinutes;
          return { ...e, examMinutes: resolved };
        }
        return e;
      })
    );
  }, [activeExamId]);

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
        const [savedGradeExams, savedActiveExamId, savedParts, savedQuestions, savedSchools, savedStudents, savedMinutes, savedPin, savedTeachers] = await Promise.all([
          loadFromStorage<GradeExamProfile[] | null>('ismart_grade_exam_profiles', null),
          loadFromStorage<string | null>('ismart_active_grade_exam_id', null),
          loadFromStorage<ExamPart[] | null>('ismart_exam_parts', null),
          loadFromStorage<Question[] | null>('ismart_questions', null),
          loadFromStorage<string[] | null>('ismart_schools', null),
          loadFromStorage<Student[] | null>('ismart_students', null),
          loadFromStorage<number | null>('ismart_exam_minutes', null),
          loadFromStorage<string | null>('ismart_admin_pin', null),
          loadFromStorage<Teacher[] | null>('ismart_teachers', null)
        ]);

        let hydratedExams = savedGradeExams && Array.isArray(savedGradeExams) && savedGradeExams.length > 0 ? savedGradeExams : null;
        let hydratedActiveExamId = savedActiveExamId;
        let hydratedSchools = savedSchools && Array.isArray(savedSchools) && savedSchools.length > 0 ? savedSchools : null;
        let hydratedStudents = savedStudents && Array.isArray(savedStudents) && savedStudents.length > 0 ? savedStudents : null;
        let hydratedTeachers = savedTeachers && Array.isArray(savedTeachers) && savedTeachers.length > 0 ? savedTeachers : null;
        let hydratedPin = savedPin;

        const hasLocalSavedState = Boolean(
          hydratedExams ||
          (savedQuestions && Array.isArray(savedQuestions) && savedQuestions.length > 0) ||
          hydratedStudents ||
          hydratedTeachers ||
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
                }
              }
            }
          } catch {
            // Snapshot file not bundled in public/: continue normally
          }
        }

        if (!active) return;

        if (hydratedExams && hydratedExams.length > 0) {
          setGradeExams(hydratedExams);
        } else if (savedParts && Array.isArray(savedParts) && savedParts.length > 0 && savedQuestions) {
          const defaults = getDefaultGradeExams();
          setGradeExams(
            defaults.map((e) =>
              e.id === 'exam-grade-2'
                ? { ...e, parts: canonicalSortParts(savedParts), questions: savedQuestions }
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
        if (hydratedTeachers && hydratedTeachers.length > 0) {
          setTeachers(hydratedTeachers);
        }
        if (hydratedPin) {
          setAdminPin(hydratedPin === '1234' ? 'admin0911' : hydratedPin);
        } else {
          setAdminPin('admin0911');
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

  // Firebase Cloud Auth & Sync state
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudHealth, setCloudHealth] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudInventory, setCloudInventory] = useState<CloudInventorySummary | null>(null);
  const [lastSyncReport, setLastSyncReport] = useState<CloudSyncReport | null>(null);
  const hasLocalEditsRef = React.useRef<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCloudUser(u);
    });
    return () => unsub();
  }, []);

  // On startup after IndexedDB hydration, automatically connect & verify Firebase Cloud + pull published exams/config
  useEffect(() => {
    if (!isHydrated) return;
    let active = true;

    const syncPublicCloudOnBoot = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (active) setCloudHealth('offline');
        return;
      }
      try {
        const [health, cloudConfig, cloudExams] = await Promise.all([
          checkCloudConnectionStatus(),
          fetchAppConfigFromCloud().catch(() => null),
          fetchPublishedExamsFromCloud(gradeExams).catch(() => null),
        ]);
        if (!active) return;

        setCloudHealth(health.reachable ? 'connected' : 'offline');

        if (cloudConfig) {
          if (cloudConfig.schools && cloudConfig.schools.length > 0) {
            setSchools(cloudConfig.schools);
          }
          if (cloudConfig.activeExamId) {
            setActiveExamId(cloudConfig.activeExamId);
          }
        }
        if (cloudExams && cloudExams.length > 0) {
          setGradeExams(cloudExams);
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

  // When Admin/Authorized Teacher connects Google Cloud, inspect Cloud & independently sync per collection
  useEffect(() => {
    if (!cloudUser || !isHydrated) return;
    if (currentUserRole !== 'admin' && currentUserRole !== 'teacher') return;
    let active = true;

    const syncAdminCloudData = async () => {
      try {
        const inv = await fetchCloudInventorySummary();
        if (!active) return;
        setCloudHealth('connected');
        setCloudInventory(inv);

        const canEditExam = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('edit_exam');
        const canManageStudents = currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('manage_students');
        const canManageTeachers = currentUserRole === 'admin';
        const hasPendingLocal = hasLocalEditsRef.current;

        // 1. Pull categories that ALREADY exist on Cloud (unless user made unpushed local edits)
        if (!hasPendingLocal) {
          const [cloudConfig, cloudExams, cloudStudents, cloudTeachers] = await Promise.all([
            inv.schoolsCount > 0 ? fetchAppConfigFromCloud().catch(() => null) : Promise.resolve(null),
            inv.examsCount > 0 ? fetchPublishedExamsFromCloud(gradeExams).catch(() => null) : Promise.resolve(null),
            inv.studentsCount > 0 ? fetchAllStudentsFromCloud().catch(() => null) : Promise.resolve(null),
            canManageTeachers && inv.teachersCount > 0
              ? fetchTeachersForAdminFromCloud().catch(() => null)
              : Promise.resolve(null),
          ]);
          if (!active) return;

          if (cloudConfig) {
            if (cloudConfig.schools.length > 0) setSchools(cloudConfig.schools);
            if (cloudConfig.activeExamId) setActiveExamId(cloudConfig.activeExamId);
          }
          if (cloudExams && cloudExams.length > 0) {
            setGradeExams(cloudExams);
          }
          if (cloudStudents && cloudStudents.length > 0) {
            setStudents(cloudStudents);
          }
          if (cloudTeachers && cloudTeachers.length > 0) {
            setTeachers(cloudTeachers);
          }
        }

        // 2. Push ONLY categories that are still empty on Cloud OR have local edits
        const needPushExams = canEditExam && (inv.examsCount === 0 || hasPendingLocal);
        const needPushStudents = canManageStudents && (inv.studentsCount === 0 || hasPendingLocal);
        const needPushTeachers = canManageTeachers && (inv.teachersCount === 0 || hasPendingLocal);

        if (needPushExams || needPushStudents || needPushTeachers) {
          const report = await syncAllDataToCloud({
            schools,
            activeExamId,
            gradeExams,
            students,
            teachers,
            ownerUid: cloudUser.uid,
            cloudEmail: cloudUser.email,
            canSyncExams: needPushExams,
            canSyncStudents: needPushStudents,
            canSyncTeachers: needPushTeachers,
          });
          if (!active) return;
          setLastSyncReport(report);
          if (report.errors.length === 0) {
            hasLocalEditsRef.current = false;
          }
          const refreshed = await fetchCloudInventorySummary();
          if (active) setCloudInventory(refreshed);
        }
      } catch {
        // Ignore if rules deny non-authorized Google account
      }
    };

    syncAdminCloudData();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, currentUserRole, isHydrated]);

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
                await submitStudentScoreToCloud({
                  studentId: qItem.studentId,
                  examId: qItem.examId || activeExamId,
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

    const newId = `exam-${newExamData.grade.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const newProfile: GradeExamProfile = {
      id: newId,
      grade: newExamData.grade,
      className: newExamData.className || 'Tất cả các lớp',
      title: newExamData.title,
      description: newExamData.description,
      examMinutes: newExamData.examMinutes || 15,
      parts: initialParts,
      questions: initialQuestions,
      updatedAt: new Date().toLocaleDateString('vi-VN')
    };

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

    const newId = `exam-${targetGrade.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const duplicated: GradeExamProfile = {
      id: newId,
      grade: targetGrade,
      className: targetClass || 'Tất cả các lớp',
      title: targetTitle,
      description: `Bản sao từ ${source.title} (${source.grade})`,
      examMinutes: source.examMinutes,
      parts: JSON.parse(JSON.stringify(source.parts)),
      questions: JSON.parse(JSON.stringify(source.questions)),
      updatedAt: new Date().toLocaleDateString('vi-VN')
    };

    setGradeExams((prev) => [duplicated, ...prev]);
    setActiveExamId(newId);
    saveToStorage('ismart_active_grade_exam_id', newId);
    showToast(`📋 Đã sao chép đề sang ${targetGrade} (${targetClass}) thành công!`, 'success');
  };

  const handleUpdateGradeExamMeta = (examId: string, patch: Partial<GradeExamProfile>) => {
    setGradeExams((prev) =>
      prev.map((e) =>
        e.id === examId ? { ...e, ...patch, updatedAt: new Date().toLocaleDateString('vi-VN') } : e
      )
    );
  };

  const handleDeleteGradeExam = (examId: string) => {
    if (gradeExams.length <= 1) {
      showToast('Không thể xóa đề thi duy nhất còn lại!', 'warn');
      return;
    }
    const filtered = gradeExams.filter((e) => e.id !== examId);
    setGradeExams(filtered);
    if (activeExamId === examId) {
      const nextId = filtered[0].id;
      setActiveExamId(nextId);
      saveToStorage('ismart_active_grade_exam_id', nextId);
    }
    if (cloudUser) {
      deleteExamFromCloud(examId).catch(() => {});
    }
    showToast('Đã xóa đề thi!', 'info');
  };

  // Connect Google Account for Firebase Cloud Admin/Teacher Sync
  const handleConnectGoogleCloud = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await signInWithGoogleCloud();
      showToast(
        `☁️ Đã kết nối Firebase Cloud (${res.email})${
          res.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? ' • Quyền Admin Cloud' : ''
        }!`,
        'success'
      );
    } catch (err: any) {
      showToast(`Không thể đăng nhập Google Cloud: ${formatCloudError(err)}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleRefreshCloudInventory = async () => {
    setIsCloudSyncing(true);
    try {
      const inv = await fetchCloudInventorySummary();
      setCloudInventory(inv);
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
        cloudUser ? fetchAllStudentsFromCloud().catch(() => null) : Promise.resolve(null),
        cloudUser && currentUserRole === 'admin'
          ? fetchTeachersForAdminFromCloud().catch(() => null)
          : Promise.resolve(null),
      ]);

      if (cloudConfig) {
        if (cloudConfig.schools.length > 0) setSchools(cloudConfig.schools);
        if (cloudConfig.activeExamId) setActiveExamId(cloudConfig.activeExamId);
      }
      if (cloudExams && cloudExams.length > 0) setGradeExams(cloudExams);
      if (cloudStudents && cloudStudents.length > 0) setStudents(cloudStudents);
      if (cloudTeachers && cloudTeachers.length > 0) setTeachers(cloudTeachers);

      const inv = await fetchCloudInventorySummary();
      setCloudInventory(inv);
      hasLocalEditsRef.current = false;
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

  // Explicit Manual Save & Sync (Local IndexedDB + Firebase Cloud Firestore)
  const handleManualSaveAndSync = async () => {
    setIsSaving(true);
    setIsCloudSyncing(true);
    try {
      await Promise.all([
        saveToStorage('ismart_grade_exam_profiles', gradeExams),
        saveToStorage('ismart_active_grade_exam_id', activeExamId),
        saveToStorage('ismart_exam_parts', parts),
        saveToStorage('ismart_questions', questions),
        saveToStorage('ismart_schools', schools),
        saveToStorage('ismart_students', students),
        saveToStorage('ismart_teachers', teachers),
        saveToStorage('ismart_exam_minutes', examMinutes),
        saveToStorage('ismart_admin_pin', adminPin)
      ]);

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(nowStr);

      if (!cloudUser) {
        hasLocalEditsRef.current = true;
        showToast(
          `💾 Đã lưu trên máy (${nowStr}). Hãy bấm nút "Kết nối Cloud (Free)" ở góc trên để đẩy lên Firebase Cloud!`,
          'warn'
        );
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        hasLocalEditsRef.current = true;
        showToast(`💾 Đang mất mạng — đã lưu tạm trên máy (${nowStr})!`, 'warn');
        return;
      }

      const report = await syncAllDataToCloud({
        schools,
        activeExamId,
        gradeExams,
        students,
        teachers,
        ownerUid: cloudUser.uid,
        cloudEmail: cloudUser.email,
        canSyncExams: currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('edit_exam'),
        canSyncStudents: currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('manage_students'),
        canSyncTeachers: currentUserRole === 'admin',
      });
      setLastSyncReport(report);

      const inv = await fetchCloudInventorySummary().catch(() => null);
      if (inv) setCloudInventory(inv);

      if (report.errors.length === 0) {
        hasLocalEditsRef.current = false;
        showToast(
          `☁️ Đã lưu Firebase Cloud: ${report.examsSaved} bài thi (${report.examImagesCount} ảnh), ${report.studentsSaved} HS (${report.scoredStudentsCount} có điểm), ${report.teachersSaved} GV lúc ${nowStr}!`,
          'success'
        );
      } else {
        showToast(
          `⚠️ Đã lưu trên máy, nhưng đồng bộ Cloud bị lỗi: ${report.errors[0]}`,
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
      questions
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

  // Apply parsed snapshot object to state + IndexedDB
  const handleApplyFullSnapshot = async (parsed: any) => {
    hasLocalEditsRef.current = true;
    if (Array.isArray(parsed)) {
      setQuestions(parsed);
      await saveToStorage('ismart_questions', parsed);
      showToast(`Đã khôi phục ${parsed.length} câu hỏi từ dữ liệu JSON!`, 'success');
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      showToast('Dữ liệu JSON không hợp lệ!', 'error');
      return;
    }
    if (Array.isArray(parsed.gradeExams) && parsed.gradeExams.length > 0) {
      setGradeExams(parsed.gradeExams);
      await saveToStorage('ismart_grade_exam_profiles', parsed.gradeExams);
      if (parsed.activeExamId) {
        setActiveExamId(parsed.activeExamId);
        await saveToStorage('ismart_active_grade_exam_id', parsed.activeExamId);
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
      setSchools(parsed.schools);
      await saveToStorage('ismart_schools', parsed.schools);
    }
    if (Array.isArray(parsed.students)) {
      setStudents(parsed.students);
      await saveToStorage('ismart_students', parsed.students);
    }
    if (Array.isArray(parsed.teachers)) {
      setTeachers(parsed.teachers);
      await saveToStorage('ismart_teachers', parsed.teachers);
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
    showToast(
      cloudUser
        ? '✅ Đã nạp thành công snapshot! Bấm "Đẩy tất cả lên Cloud ngay" để lưu đồng bộ lên Firebase.'
        : '✅ Đã nạp thành công toàn bộ đề thi, học sinh, điểm số & giáo viên từ file snapshot!',
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
    if (mode === 'scores' && cloudUser) {
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
    if (!cloudUser) {
      if (!silent) {
        showToast('Hãy bấm "Kết nối Cloud (Free)" bằng tài khoản Admin/Giáo viên để tải điểm mới từ Cloud!', 'warn');
      }
      return;
    }
    setIsCloudSyncing(true);
    try {
      const cloudStudents = await fetchAllStudentsFromCloud();
      if (cloudStudents && cloudStudents.length > 0) {
        setStudents((prev) => {
          const cloudMap = new Map(cloudStudents.map((cs) => [cs.id, cs]));
          const merged = prev.map((localStu) => {
            const cloudStu = cloudMap.get(localStu.id);
            if (!cloudStu) return localStu;
            // Always prefer Cloud submitted score & answer details if student has submitted on Cloud
            if (cloudStu.score !== null && cloudStu.score !== undefined) {
              return { ...localStu, ...cloudStu };
            }
            return localStu;
          });
          // Add any Cloud students not yet in local list
          const localIds = new Set(prev.map((s) => s.id));
          const newOnes = cloudStudents.filter((cs) => !localIds.has(cs.id));
          const finalList = [...merged, ...newOnes];
          saveToStorage('ismart_students', finalList);
          return finalList;
        });
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

    // Push graded exam score directly to Firebase Firestore (supports Cloudflare multi-device exams!)
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
          });
          localStorage.setItem('ismart_offline_submission_queue', JSON.stringify(queue));
        } catch {
          // ignore
        }
      });
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
    let syncedStudentRecord: Student | null = null;

    setStudents((prev) => {
      const trimmedTargetName = (studentData.name || '').trim().toLowerCase();
      const trimmedTargetClass = (studentData.className || '').trim().toLowerCase();
      const targetId = (studentData.studentId || '').trim().toLowerCase();

      const existingIndex = prev.findIndex((s) => {
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

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        syncedStudentRecord = {
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
          submittedAt: `Chấm camera ${nowStr}`
        };
        updated[existingIndex] = syncedStudentRecord;
        return updated;
      } else {
        syncedStudentRecord = {
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
          submittedAt: `Chấm camera ${nowStr}`
        };
        return [syncedStudentRecord, ...prev];
      }
    });

    if (studentData.school && !schools.includes(studentData.school)) {
      setSchools((prev) => [...prev, studentData.school]);
    }

    hasLocalEditsRef.current = true;
    if (cloudUser && syncedStudentRecord) {
      syncStudentsBatchToCloud([syncedStudentRecord]).catch((err) => {
        showToast(`Đã lưu điểm trên máy, chưa đẩy Cloud: ${formatCloudError(err)}`, 'warn');
      });
    }

    showToast(`✅ Đã lưu kết quả chấm camera cho ${studentData.name} (${studentData.points10} điểm)!`, 'success');
  };

  const handleQuickLoginFromTable = (student: Student) => {
    setCurrentStudent(student);
    setIsStudentKioskLocked(true);
    setCurrentMode('test');
    showToast(`Đã chuyển thẳng vào phòng thi cho ${student.name}!`);
  };

  // Download Standalone Self-contained HTML
  const handleDownloadStandaloneHTML = () => {
    const dataPayload = JSON.stringify({
      examMinutes,
      adminPin,
      schools,
      students,
      parts,
      questions
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iSMART LMS - Trang Thi Độc Lập Cho Học Sinh</title>
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
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-black mx-auto shadow-md">
      iS
    </div>
    <h1 class="text-2xl font-black text-slate-900">HỆ THỐNG THI TRỰC TUYẾN iSMART LMS</h1>
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
          cloudHealth={cloudHealth}
          onLoginAdmin={() => {
            setCurrentUserRole('admin');
            setCurrentMode('admin');
            setIsStudentKioskLocked(false);
            showToast('Chào mừng Quản trị viên (Admin) đăng nhập hệ thống!', 'success');
          }}
          onLoginTeacher={(teacher) => {
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
          onGoToStudentExam={() => {
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

      {/* 1. Header for Standalone Student Mode */}
      {isStudentKioskLocked ? (
        <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm sticky top-0 z-30">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
                iS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    HỆ THỐNG KIỂM TRA TRỰC TUYẾN
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

            <div className="flex items-center gap-2.5">
              <span className="hidden sm:flex px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Đã kết nối máy chủ Admin</span>
              </span>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                title="Quản trị viên / Giám thị: Bấm để nhập mật khẩu Admin quay lại trang Quản trị Soạn Đề"
                className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs sm:text-sm shadow-md shadow-orange-500/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-key text-amber-200"></i>
                <span>Trở về Admin (Nhập PIN)</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Quay lại cổng chọn vai trò đăng nhập"
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span className="hidden md:inline">Đổi Vai Trò</span>
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* 2. Admin & Teacher Header */
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
                iS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    iSMART LMS
                  </h1>
                  {currentUserRole === 'admin' ? (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <i className="fa-solid fa-user-shield text-[10px]"></i> ADMIN
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                      <i className="fa-solid fa-chalkboard-user text-[10px]"></i> {currentTeacher?.name || 'GIÁO VIÊN'}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Đồng bộ Live</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {currentUserRole === 'admin'
                    ? 'Quản trị toàn diện: Ngân hàng đề, phân quyền giáo viên & liên kết trang thi học sinh'
                    : `Cổng Giáo Viên • Khối phụ trách: ${currentTeacher?.assignedGrades?.join(', ') || 'Chưa phân khối'}`}
                </p>
              </div>
            </div>

            {/* Navigation Tabs based on RBAC */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap gap-1">
              {/* Tab 1: Soạn Đề */}
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('edit_exam')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'admin'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-pen-ruler"></i> 1. Soạn Đề
                </button>
              )}

              {/* Tab 2: DS Học Sinh & Trường */}
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('manage_students')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('students')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'students'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-users-gear"></i> 2. DS Học Sinh & Trường
                </button>
              )}

              {/* Tab 3: Bảng Điểm & Xuất Kết Quả */}
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('view_scores')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('scores')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'scores'
                      ? 'bg-white text-cyan-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-chart-line text-cyan-600"></i> 3. Bảng Điểm & Xuất Điểm
                </button>
              )}

              {/* Tab 4: QL Giáo Viên & Phân Quyền (CHỈ DÀNH CHO ADMIN) */}
              {currentUserRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('teachers')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'teachers'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-user-gear text-amber-600"></i>
                  <span>4. QL Giáo Viên</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                    {teachers.length}
                  </span>
                </button>
              )}

              {/* Tab 4: Mở Trang Thi Độc Lập */}
              <button
                type="button"
                onClick={handleEnterStandaloneStudentPortal}
                className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
              >
                <i className="fa-solid fa-display"></i> Mở Trang Thi Độc Lập
              </button>

              {/* Tab 5: Test Chạy Thử Đề Thi */}
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('test_run')) && (
                <button
                  type="button"
                  onClick={() => handleStartTestRun()}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'test' && isTestRunMode
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                  }`}
                  title="Chạy thử nghiệm đề thi sau khi soạn để kiểm tra hiển thị câu hỏi, audio, vẽ tô màu và tính điểm"
                >
                  <i className="fa-solid fa-play text-xs text-emerald-600"></i>
                  <span>Test Chạy Thử</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/90 text-emerald-950 text-[10px] font-black uppercase">
                    Test
                  </span>
                </button>
              )}

              {/* Tab 6: Cấu hình & Link Thi */}
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('view_json')) && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentMode === 'json'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-code"></i> Cấu hình & Link
                </button>
              )}
            </div>

            {/* Right Tools: Minutes, AI Camera, Offline Printer, PDF, Save & Logout */}
            <div className="flex items-center gap-2 flex-wrap">
              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('edit_exam')) && (
                <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700">
                  <span>⏱️ Phút:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={examMinutes}
                    onChange={(e) => setExamMinutes(+e.target.value || 15)}
                    className="w-14 px-1.5 py-0.5 text-center font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('camera_grader')) && (
                <button
                  type="button"
                  onClick={() => setIsCameraGraderOpen(true)}
                  title="Chấm bài thi của học sinh bằng camera điện thoại hoặc tải ảnh chụp bài thi"
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition active:scale-95 cursor-pointer ring-2 ring-white/50 animate-pulse hover:animate-none"
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>📷 Chấm Bài Camera AI</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('print_offline')) && (
                <button
                  type="button"
                  onClick={() => setIsOfflinePrinterOpen(true)}
                  title="In đề thi giấy và phiếu trả lời trắc nghiệm cho học sinh làm bài offline"
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-black text-xs sm:text-sm shadow-md shadow-slate-700/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>🖨️ In Đề Thi Offline</span>
                </button>
              )}

              {(currentUserRole === 'admin' || currentTeacher?.permissions.includes('import_pdf')) && (
                <button
                  type="button"
                  onClick={() => setIsPdfImporterOpen(true)}
                  title="Mở bảng nạp đề từ file PDF của bạn, cắt hình ảnh và trích xuất nội dung vào đề thi"
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  <span className="hidden lg:inline">Nạp Đề Từ File PDF</span>
                </button>
              )}

              {/* Firebase Cloud Free-Tier Connection Button */}
              {cloudUser ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  <i className="fa-solid fa-cloud-check text-emerald-600"></i>
                  <span className="hidden xl:inline max-w-[140px] truncate" title={cloudUser.email || ''}>
                    {cloudUser.email}
                  </span>
                  <span className="xl:hidden">Cloud ✓</span>
                  <button
                    type="button"
                    onClick={() => signOutGoogleCloud()}
                    title="Ngắt kết nối Google Cloud"
                    className="ml-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <i className="fa-solid fa-power-off text-[11px]"></i>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isCloudSyncing}
                  onClick={handleConnectGoogleCloud}
                  title="Đăng nhập Google để bật đồng bộ miễn phí Firebase Cloud (5 bài thi + >1.000 học sinh)"
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <i className={`fa-brands fa-google text-amber-600 ${isCloudSyncing ? 'fa-spin' : ''}`}></i>
                  <span>{isCloudSyncing ? 'Đang kết nối...' : 'Kết nối Cloud (Free)'}</span>
                </button>
              )}

              {(currentUserRole === 'admin' ||
                currentTeacher?.permissions.includes('edit_exam') ||
                currentTeacher?.permissions.includes('manage_students') ||
                currentTeacher?.permissions.includes('reset_scores')) && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleManualSaveAndSync}
                  title="Lưu và đồng bộ dữ liệu lên IndexedDB & Firebase Cloud Firestore"
                  className="px-3 py-2 rounded-xl bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-green-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
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
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-globe"></i>
                  <span>Xuất Trang Thi Online</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất khỏi tài khoản hiện tại"
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket text-rose-500"></i>
                <span className="hidden sm:inline">Đăng Xuất</span>
              </button>
            </div>
          </div>
        </header>
      )}

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
              hasLocalEditsRef.current = true;
              setSchools(newSchools);
              if (cloudUser) {
                saveAppConfigToCloud(newSchools, activeExamId).catch((err) => {
                  showToast(`Lưu DS trường lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                });
              }
            }}
            onStudentsChange={(newStudents) => {
              hasLocalEditsRef.current = true;
              const prevIds = new Set(students.map((s) => s.id));
              const nextIds = new Set(newStudents.map((s) => s.id));
              const removedIds = Array.from(prevIds).filter((id) => !nextIds.has(id));
              const changed = newStudents.filter((ns) => {
                const old = students.find((os) => os.id === ns.id);
                return !old || JSON.stringify(old) !== JSON.stringify(ns);
              });
              setStudents(newStudents);
              if (cloudUser) {
                if (changed.length > 0) {
                  syncStudentsBatchToCloud(changed).catch((err) => {
                    showToast(`Đồng bộ học sinh lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                  });
                }
                if (removedIds.length > 0) {
                  deleteStudentsFromCloud(removedIds).catch((err) => {
                    showToast(`Xóa học sinh trên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                  });
                }
              }
            }}
            onQuickLogin={handleQuickLoginFromTable}
            onOpenCameraGrader={() => setIsCameraGraderOpen(true)}
            onResetSampleStudents={() => {
              openConfirm(
                'Khôi phục danh sách học sinh mẫu?',
                'Danh sách sẽ được đặt lại theo các trường và học sinh mẫu.',
                () => {
                  hasLocalEditsRef.current = true;
                  const initSchools = getInitialSchools();
                  const initStudents = getInitialStudents();
                  setSchools(initSchools);
                  setStudents(initStudents);
                  if (cloudUser) {
                    saveAppConfigToCloud(initSchools, activeExamId).catch(() => {});
                    syncStudentsBatchToCloud(initStudents).catch(() => {});
                  }
                  showToast('Đã khôi phục danh sách học sinh mẫu!');
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
            isCloudConnected={!!cloudUser}
            isRefreshingCloud={isCloudSyncing}
            onRefreshFromCloud={() => handleRefreshScoresFromCloud(false)}
            canResetScores={currentUserRole === 'admin' || !!currentTeacher?.permissions.includes('reset_scores')}
            onStudentsChange={(newStudents) => {
              hasLocalEditsRef.current = true;
              const resetIds = newStudents
                .filter((ns) => {
                  const old = students.find((os) => os.id === ns.id);
                  return old && old.submittedAt !== null && ns.submittedAt === null;
                })
                .map((s) => s.id);
              setStudents(newStudents);
              saveToStorage('ismart_students', newStudents);
              if (cloudUser && resetIds.length > 0) {
                resetStudentsScoreInCloud(resetIds).catch((err) => {
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
              hasLocalEditsRef.current = true;
              const nextUsernames = new Set(newTeachers.map((t) => t.username.toLowerCase()));
              const removedTeachers = teachers.filter((t) => !nextUsernames.has(t.username.toLowerCase()));
              setTeachers(newTeachers);
              saveToStorage('ismart_teachers', newTeachers);
              if (cloudUser) {
                saveTeachersToCloud(newTeachers).catch((err) => {
                  showToast(`Lưu danh sách GV lên Cloud lỗi: ${formatCloudError(err)}`, 'warn');
                });
                removedTeachers.forEach((rt) => deleteTeacherFromCloud(rt).catch(() => {}));
              }
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
              onExitTestRun={handleExitTestRun}
              onLoginStudent={(stu) => setCurrentStudent(stu)}
              onLogoutStudent={() => {
                if (isTestRunMode) {
                  handleExitTestRun();
                } else {
                  setCurrentStudent(null);
                  setCurrentUserRole('guest');
                  setIsStudentKioskLocked(false);
                  showToast('Đã quay về trang đăng nhập!');
                }
              }}
              onUpdateStudentScore={handleUpdateStudentScore}
              onRequestUnlockAdmin={() => setIsPinModalOpen(true)}
              onLookupStudentCloud={lookupStudentByIdFromCloud}
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
            onConnectCloud={handleConnectGoogleCloud}
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
            onSchoolsChange={setSchools}
            onStudentsChange={setStudents}
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
