import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Question, Student, ExamPart, PartScoreRecord, ExamSection, SectionScoreRecord } from '../types';
import { AudioPlayerBox } from './AudioPlayerBox';
import { PartExampleCard } from './PartExampleCard';
import { CambridgePart2View } from './CambridgePart2View';
import { CambridgePart1RWView } from './CambridgePart1RWView';
import { CambridgePart2RWView } from './CambridgePart2RWView';
import { ListenColourPlayer } from './ListenColourPlayer';
import { isColorMatch } from '../utils/cambridgeColours';
import { getQuestionPartAndIndex, isQuestionExample, getCleanPartTitle } from '../utils/sectionUtils';

interface StudentExamPlayerProps {
  parts: ExamPart[];
  questions: Question[];
  students: Student[];
  currentStudent: Student | null;
  examMinutes: number;
  isTestRun?: boolean;
  initialPartId?: string;
  onExitTestRun?: () => void;
  onLoginStudent: (student: Student) => void;
  onLogoutStudent: () => void;
  onUpdateStudentScore: (
    studentId: string,
    score: number,
    total: number,
    points10: string,
    partScores?: Record<string, PartScoreRecord>,
    questionScores?: Record<number, number>,
    details?: Record<number, any>,
    sectionScores?: Record<string, SectionScoreRecord>
  ) => void;
  onRequestUnlockAdmin?: () => void;
  onLookupStudentCloud?: (studentId: string) => Promise<Student | null>;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
}

export const StudentExamPlayer: React.FC<StudentExamPlayerProps> = ({
  parts,
  questions,
  students,
  currentStudent,
  examMinutes,
  isTestRun = false,
  initialPartId,
  onExitTestRun,
  onLoginStudent,
  onLogoutStudent,
  onUpdateStudentScore,
  onRequestUnlockAdmin,
  onLookupStudentCloud,
  showToast,
  openConfirm
}) => {
  // Login input state
  const [loginInputId, setLoginInputId] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingStudent, setPendingStudent] = useState<Student | null>(null);
  const [isLookingUpCloud, setIsLookingUpCloud] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [lookupSearch, setLookupSearch] = useState<string>('');

  // Network connection state (Offline / Online resilience)
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Check if there is an unfinished exam session saved locally on this machine (power loss / crash recovery)
  const [deviceActiveExam, setDeviceActiveExam] = useState<{
    studentId: string;
    student: Student;
    answers: Record<number, any>;
    remainingSeconds: number;
    currentQuestionIndex: number;
    savedAt: number;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('ismart_device_active_exam');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.student && parsed.studentId && parsed.answers) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Network status listener to warn student and auto-protect local storage
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('📶 Đã có kết nối mạng trở lại! Hệ thống sẵn sàng đồng bộ điểm thi.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('📶 Mất kết nối Internet! Đừng lo lắng, toàn bộ câu trả lời đang được lưu an toàn trực tiếp trên máy này.', 'warn');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Exam runtime state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(examMinutes * 60);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);
  const [showIncompleteModal, setShowIncompleteModal] = useState<{
    isOpen: boolean;
    unansweredCount: number;
    unansweredIndices: number[];
  } | null>(null);

  // User answers map: question index -> answer
  // For multiple-choice/yes-no/listening: number (option index)
  // For multi-choice: number[] (array of option indices)
  // For fill-blanks: Record<number, string> (boxIndex -> text)
  // For connect-pairs: [string, string][] (connected point label pairs)
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});

  // Active point selected in connect-pairs for connecting to next point
  const [activeConnectPoint, setActiveConnectPoint] = useState<{ qIdx: number; label: string } | null>(null);

  // Active slot (1, 2, 3, 4) selected in story-word-bank per question
  const [activeStorySlots, setActiveStorySlots] = useState<Record<number, string>>({});

  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Jump to initialPartId if provided in Test Run
  useEffect(() => {
    if (initialPartId && questions.length > 0) {
      const targetIdx = questions.findIndex((q) => (q.partId || parts[0]?.id) === initialPartId);
      if (targetIdx >= 0) {
        setCurrentQuestionIndex(targetIdx);
      }
    }
  }, [initialPartId, questions, parts]);

  // Reset or initialize exam when currentStudent changes (restoring progress if previously saved)
  useEffect(() => {
    if (currentStudent) {
      setIsSubmitted(false);
      setActiveStorySlots({});
      setIsTimerPaused(false);

      // Check for saved in-progress answers for this specific student on this machine
      const storageKey = `ismart_progress_${currentStudent.id}`;
      let loadedAnswers: Record<number, any> = {};
      let loadedSeconds = examMinutes * 60;
      let loadedIndex = 0;
      let wasRestored = false;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.answers && Object.keys(parsed.answers).length > 0) {
              loadedAnswers = parsed.answers;
              wasRestored = true;
            }
            if (typeof parsed.remainingSeconds === 'number' && parsed.remainingSeconds > 0) {
              loadedSeconds = parsed.remainingSeconds;
            }
            if (typeof parsed.currentQuestionIndex === 'number' && parsed.currentQuestionIndex >= 0) {
              loadedIndex = parsed.currentQuestionIndex;
            }
          }
        }
      } catch {
        // ignore
      }

      setUserAnswers(loadedAnswers);
      setRemainingSeconds(loadedSeconds);
      if (loadedIndex > 0 && loadedIndex < questions.length) {
        setCurrentQuestionIndex(loadedIndex);
      }

      if (wasRestored) {
        showToast(
          `⚡ Đã tự động khôi phục ${Object.keys(loadedAnswers).length} câu trả lời và thời gian thi trước đó trên máy này của ${currentStudent.name}!`,
          'success'
        );
      }

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStudent, examMinutes, questions.length, showToast]);

  // Auto-save exam progress locally per student ID and per physical device (zero data loss across power outage or network loss)
  useEffect(() => {
    if (currentStudent && !isSubmitted && !isTestRun) {
      try {
        const payload = {
          studentId: currentStudent.id,
          student: currentStudent,
          answers: userAnswers,
          remainingSeconds,
          currentQuestionIndex,
          savedAt: Date.now()
        };
        // 1. By student ID
        localStorage.setItem(`ismart_progress_${currentStudent.id}`, JSON.stringify(payload));
        // 2. Active session on this machine for instant reboot recovery
        localStorage.setItem('ismart_device_active_exam', JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  }, [userAnswers, remainingSeconds, currentQuestionIndex, currentStudent, isSubmitted, isTestRun]);

  // Handle timer pausing / unpausing
  useEffect(() => {
    if (!currentStudent || isSubmitted) return;
    if (isTimerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [isTimerPaused, currentStudent, isSubmitted]);

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (remainingSeconds === 0 && currentStudent && !isSubmitted) {
      showToast('Đã hết giờ làm bài! Hệ thống tự động thu bài.', 'warn');
      finalizeGrading();
    }
  }, [remainingSeconds, currentStudent, isSubmitted]);

  // Auto-logout countdown after student submits and results are saved
  useEffect(() => {
    if (logoutCountdown === null || isTestRun) return;
    if (logoutCountdown <= 0) {
      onLogoutStudent();
      return;
    }
    const timer = setTimeout(() => {
      setLogoutCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [logoutCountdown, isTestRun, onLogoutStudent]);

  // Format time MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Audio / TTS playback
  const handlePlayAudio = (audioStr?: string) => {
    if (!audioStr) return;
    if (audioStr.startsWith('tts:')) {
      const text = audioStr.replace(/^tts:/, '');
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
      showToast('Đang phát giọng đọc bài nghe (TTS)...', 'info');
    } else {
      const audio = new Audio(audioStr);
      audio.play().catch(() => showToast('Không thể phát file âm thanh', 'warn'));
    }
  };

  // Step 1: Tra cứu thông tin thí sinh theo Mã ID (1-read Firestore lookup + local fallback)
  const handleLookupStudent = async (idToLookup?: string) => {
    const rawInput = idToLookup || loginInputId;
    const cleanId = rawInput.trim().toUpperCase();
    if (!cleanId) {
      setLoginError('Vui lòng nhập Mã ID của em!');
      return;
    }

    let found: Student | undefined = students.find((s) => s.id.trim().toUpperCase() === cleanId);

    if (onLookupStudentCloud && navigator.onLine) {
      setIsLookingUpCloud(true);
      try {
        const cloudStudent = await onLookupStudentCloud(cleanId);
        if (cloudStudent) {
          found = cloudStudent;
        }
      } catch {
        // Fallback to local list if offline or unreachable
      } finally {
        setIsLookingUpCloud(false);
      }
    }

    if (!found) {
      setLoginError(`Mã ID "${cleanId}" không tồn tại trong danh sách phòng thi! Vui lòng kiểm tra lại hoặc hỏi Giám thị.`);
      return;
    }

    if (found.score !== null && typeof found.score !== 'undefined') {
      setLoginError(`Thí sinh "${found.name}" (Lớp ${found.className}) đã hoàn tất bài thi với điểm số ${found.score}/${found.total ?? 10} điểm. Nếu cần thi lại, vui lòng báo Giám thị phòng thi!`);
      return;
    }

    setLoginError(null);
    setPendingStudent(found);
  };

  // Step 2: Thí sinh xác nhận đúng Tên, Lớp, Trường và chính thức bắt đầu thi
  const handleConfirmLogin = () => {
    if (!pendingStudent) return;
    const studentToLogin = pendingStudent;
    setPendingStudent(null);
    setLoginInputId('');
    setLoginError(null);
    setShowLookupModal(false);
    onLoginStudent(studentToLogin);
    showToast(`✓ Xác nhận đúng thí sinh ${studentToLogin.name} (Lớp ${studentToLogin.className})! Bắt đầu tính giờ thi.`, 'success');
  };

  // Check if a question is answered
  const isAnswered = (idx: number) => {
    const q = questions[idx];
    const p = parts.find((pt) => pt.id === (q?.partId || parts[0]?.id));
    if (q?.isExample || isQuestionExample(q, p)) return true;
    const ans = userAnswers[idx];
    if (ans === undefined || ans === null) return false;

    if (q.type === 'multiple-choice' || q.type === 'yes-no' || q.type === 'listening') {
      return typeof ans === 'number';
    }
    if (q.type === 'tick-cross') {
      return typeof ans === 'boolean';
    }
    if (q.type === 'listen-write') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (q.type === 'unscramble-word') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (q.type === 'story-word-bank') {
      return typeof ans === 'object' && Object.values(ans).some((v: any) => String(v).trim().length > 0);
    }
    if (q.type === 'multi-choice') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'fill-blanks') {
      return typeof ans === 'object' && Object.values(ans).some((v: any) => String(v).trim().length > 0);
    }
    if (q.type === 'connect-pairs') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'listen-colour') {
      return typeof ans === 'object' && Object.keys(ans).length > 0;
    }
    return false;
  };

  // Evaluate if a question is answered correctly
  const isQuestionCorrect = (idx: number): boolean => {
    const q = questions[idx];
    const ans = userAnswers[idx];
    if (ans === undefined || ans === null) return false;

    if (q.type === 'multiple-choice' || q.type === 'yes-no' || q.type === 'listening') {
      return ans === (q.correctIndex ?? 0);
    }
    if (q.type === 'tick-cross') {
      return ans === (q.isTick ?? true);
    }
    if (q.type === 'listen-write') {
      const acceptable = (q.acceptableAnswers || []).map((a) => a.trim().toLowerCase());
      const userText = String(ans).trim().toLowerCase();
      return acceptable.length === 0 ? true : acceptable.includes(userText);
    }
    if (q.type === 'unscramble-word') {
      const target = (q.unscramble?.targetWord || q.unscrambleTarget || q.answerText || (q.acceptableAnswers && q.acceptableAnswers[0]) || '').trim().toLowerCase();
      const userText = String(ans || '').trim().toLowerCase();
      return target.length > 0 && userText === target;
    }
    if (q.type === 'story-word-bank') {
      const answersMap = q.storyBank?.answers || {};
      const userMap = (ans as Record<string, string>) || {};
      const testSlots = Object.keys(answersMap).filter((k) => k !== '0');
      if (testSlots.length === 0) return true;
      return testSlots.every((k) => String(userMap[k] || '').trim().toLowerCase() === answersMap[k].trim().toLowerCase());
    }
    if (q.type === 'multi-choice') {
      const target = (q.correctIndices || []).slice().sort();
      const user = (ans as number[]).slice().sort();
      return target.length === user.length && target.every((v, i) => v === user[i]);
    }
    if (q.type === 'fill-blanks') {
      const boxes = q.fillBlanks?.boxes || [];
      if (boxes.length === 0) return true;
      return boxes.every((box, bIdx) => {
        const val = String(ans[bIdx] || '').trim().toLowerCase();
        return box.answers.some((allowed) => allowed.trim().toLowerCase() === val);
      });
    }
    if (q.type === 'connect-pairs') {
      const targetPairs = q.connectPairs?.pairs || [];
      const userPairs = (ans as [string, string][]) || [];
      const norm = (p: [string, string]) => (p[0] < p[1] ? `${p[0]}-${p[1]}` : `${p[1]}-${p[0]}`);

      const exPair =
        q.connectPairs?.examplePair ||
        (q.connectPairs?.pairs && q.connectPairs.pairs.length > 1 ? q.connectPairs.pairs[0] : null);
      const exNorm = exPair ? norm(exPair) : null;

      // The example pair is pre-connected, so the student only needs to connect the remaining pairs
      const requiredPairs = exNorm ? targetPairs.filter((p) => norm(p) !== exNorm) : targetPairs;
      const providedPairs = exNorm ? userPairs.filter((p) => norm(p) !== exNorm) : userPairs;

      if (requiredPairs.length !== providedPairs.length) return false;

      const targetSet = new Set(requiredPairs.map(norm));
      return providedPairs.every((p) => targetSet.has(norm(p)));
    }
    if (q.type === 'listen-colour') {
      const items = q.listenColour?.items || [];
      const testItems = items.filter((it) => !it.isExample);
      if (testItems.length === 0) return true;
      const userMap = (ans as Record<string, string>) || {};
      return testItems.every((it) => isColorMatch(userMap[it.id], it.targetColor));
    }
    return false;
  };

  const getPartSection = (p?: ExamPart): ExamSection => {
    if (p?.section) return p.section;
    const t = (p?.title || '').toLowerCase();
    if (t.includes('listen') || t.includes('nghe')) return 'listening';
    return 'reading-writing';
  };

  // State to hold detailed submission results
  const [submissionResults, setSubmissionResults] = useState<{
    totalEarnedPoints: number;
    maxExamPoints: number;
    pts10: string;
    totalQuestionsCorrect: number;
    sectionScores: Record<string, SectionScoreRecord>;
    partScores: Record<string, PartScoreRecord>;
    questionScores: Record<number, number>;
  } | null>(null);

  // Finalize grading
  const finalizeGrading = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);

    const questionScores: Record<number, number> = {};
    const partScores: Record<string, PartScoreRecord> = {};
    const sectionScores: Record<string, SectionScoreRecord> = {
      listening: {
        section: 'listening',
        sectionTitle: 'Phần thi Listening (Nghe hiểu)',
        earnedPoints: 0,
        totalPoints: 0,
        correctCount: 0,
        questionCount: 0
      },
      'reading-writing': {
        section: 'reading-writing',
        sectionTitle: 'Phần thi Reading & Writing (Đọc & Viết)',
        earnedPoints: 0,
        totalPoints: 0,
        correctCount: 0,
        questionCount: 0
      }
    };

    parts.forEach((p) => {
      const sec = getPartSection(p);
      if (sectionScores[sec]) {
        sectionScores[sec].totalPoints = +(sectionScores[sec].totalPoints + (p.points || 0)).toFixed(2);
      }
      partScores[p.id] = {
        partId: p.id,
        partTitle: p.title,
        section: sec,
        earnedPoints: 0,
        totalPoints: p.points,
        correctCount: 0,
        questionCount: 0
      };
    });

    let totalEarnedPoints = 0;
    let totalQuestionsCorrect = 0;

    questions.forEach((q, idx) => {
      const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id)) || parts[0];
      if (q.isExample || isQuestionExample(q, p)) return;
      const isCorrect = isQuestionCorrect(idx);
      const qPts = q.points ?? 0.5;
      let earned = isCorrect ? qPts : 0;

      // Partial score for multi-item questions (listen-colour)
      if (!isCorrect && q.type === 'listen-colour') {
        const items = q.listenColour?.items || [];
        const testItems = items.filter((it) => !it.isExample);
        if (testItems.length > 0) {
          const userMap = (userAnswers[idx] as Record<string, string>) || {};
          const correctCount = testItems.filter((it) => isColorMatch(userMap[it.id], it.targetColor)).length;
          if (correctCount > 0) {
            earned = +((correctCount / testItems.length) * qPts).toFixed(2);
          }
        }
      }

      // Partial score for story-word-bank (câu này có bao nhiêu từ thì chia đều điểm từng từ đó)
      if (q.type === 'story-word-bank') {
        const answersMap = q.storyBank?.answers || {};
        const testSlots = Object.keys(answersMap).filter((k) => k !== '0');
        if (testSlots.length > 0) {
          const userMap = (userAnswers[idx] as Record<string, string>) || {};
          const correctCount = testSlots.filter(
            (k) => String(userMap[k] || '').trim().toLowerCase() === answersMap[k].trim().toLowerCase()
          ).length;
          earned = +((correctCount / testSlots.length) * qPts).toFixed(2);
        }
      }

      questionScores[idx] = earned;

      if (isCorrect || earned >= qPts) totalQuestionsCorrect++;
      totalEarnedPoints += earned;

      const pId = p.id;
      const sec = getPartSection(p);

      if (sectionScores[sec]) {
        sectionScores[sec].questionCount += 1;
        sectionScores[sec].earnedPoints = +(sectionScores[sec].earnedPoints + earned).toFixed(2);
        if (isCorrect || earned >= qPts) {
          sectionScores[sec].correctCount += 1;
        }
      }

      if (partScores[pId]) {
        partScores[pId].questionCount += 1;
        partScores[pId].earnedPoints = +(partScores[pId].earnedPoints + earned).toFixed(2);
        if (isCorrect || earned >= qPts) {
          partScores[pId].correctCount += 1;
        }
      }
    });

    totalEarnedPoints = +totalEarnedPoints.toFixed(2);
    const maxExamPoints = +(
      parts.reduce((sum, p) => sum + (p.points || 0), 0) ||
      questions
        .filter((q) => !q.isExample && !isQuestionExample(q, parts.find((pt) => pt.id === (q.partId || parts[0]?.id))))
        .reduce((sum, q) => sum + (q.points ?? 0.5), 0)
    ).toFixed(2);
    const pts10 = maxExamPoints > 0 ? ((totalEarnedPoints / maxExamPoints) * 10).toFixed(1) : '0.0';

    setSubmissionResults({
      totalEarnedPoints,
      maxExamPoints,
      pts10,
      totalQuestionsCorrect,
      sectionScores,
      partScores,
      questionScores
    });

    if (currentStudent && !isTestRun) {
      // 1. Send scored submission to central grading system
      onUpdateStudentScore(
        currentStudent.id,
        totalEarnedPoints,
        maxExamPoints,
        pts10,
        partScores,
        questionScores,
        userAnswers,
        sectionScores
      );

      // 2. Persist local submission backup on this machine (ensures 100% data retention even if internet is down)
      try {
        const submissionPayload = {
          studentId: currentStudent.id,
          student: currentStudent,
          totalEarnedPoints,
          maxExamPoints,
          pts10,
          submittedAt: new Date().toISOString(),
          partScores,
          questionScores,
          userAnswers,
          sectionScores,
          isOfflineSubmission: !isOnline
        };

        // Permanent submission record for this student on this machine
        localStorage.setItem(`ismart_submission_${currentStudent.id}`, JSON.stringify(submissionPayload));

        // If offline when submitting, queue to auto-sync when network returns
        if (!navigator.onLine) {
          const queueRaw = localStorage.getItem('ismart_offline_submission_queue') || '[]';
          const queue = JSON.parse(queueRaw);
          queue.push(submissionPayload);
          localStorage.setItem('ismart_offline_submission_queue', JSON.stringify(queue));
        }

        // Clean up unfinished in-progress draft from this device
        localStorage.removeItem(`ismart_progress_${currentStudent.id}`);
        localStorage.removeItem('ismart_device_active_exam');
        setDeviceActiveExam(null);
      } catch {
        // ignore
      }
    }

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    if (isTestRun) {
      showToast(`🧪 [TEST RUN] Hoàn thành bài thi thử! Điểm số: ${totalEarnedPoints}/${maxExamPoints} đ (${pts10}/10 điểm)`, 'success');
    } else {
      if (!isOnline) {
        showToast(`✅ Đã chấm điểm ${pts10}/10 đ và lưu an toàn trên máy! Sẽ tự động gửi lên hệ thống khi có mạng lại.`, 'success');
      } else {
        showToast(`✅ Đã lưu bài thi và gửi kết quả lên hệ thống chấm điểm thành công! (${pts10} điểm hệ 10)`, 'success');
      }
      setLogoutCountdown(8);
    }
  };

  const handleAutoFillCorrect = () => {
    const answers: Record<number, any> = {};

    questions.forEach((q, idx) => {
      if (q.type === 'multiple-choice' || q.type === 'yes-no' || q.type === 'listening') {
        answers[idx] = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
      } else if (q.type === 'tick-cross') {
        answers[idx] = q.isTick ?? true;
      } else if (q.type === 'multi-choice') {
        answers[idx] = q.correctIndices && q.correctIndices.length > 0 ? [...q.correctIndices] : [0];
      } else if (q.type === 'fill-blanks') {
        const boxMap: Record<number, string> = {};
        if (q.fillBlanks?.boxes) {
          q.fillBlanks.boxes.forEach((box, bIdx) => {
            boxMap[bIdx] = box.answers && box.answers.length > 0 ? box.answers[0] : '';
          });
        }
        answers[idx] = boxMap;
      } else if (q.type === 'connect-pairs') {
        if (q.connectPairs?.pairs) {
          answers[idx] = [...q.connectPairs.pairs];
        }
      } else if (q.type === 'unscramble-word') {
        answers[idx] = q.unscramble?.targetWord || '';
      } else if (q.type === 'story-word-bank') {
        if (q.storyBank?.answers) {
          answers[idx] = { ...q.storyBank.answers };
        }
      } else if (q.type === 'listen-write') {
        answers[idx] = q.acceptableAnswers && q.acceptableAnswers.length > 0 ? q.acceptableAnswers[0] : '';
      } else if (q.type === 'listen-colour') {
        const colourMap: Record<string, string> = {};
        if (q.listenColour?.items) {
          q.listenColour.items.forEach((item) => {
            colourMap[item.id] = item.targetColor;
          });
        }
        answers[idx] = colourMap;
      }
    });

    setUserAnswers(answers);
    showToast('⚡ Đã tự động điền 100% đáp án chuẩn cho tất cả các câu!', 'success');
  };

  const handleResetExamAnswers = () => {
    openConfirm(
      'Đặt lại bài làm thử?',
      'Xóa toàn bộ câu trả lời đã điền và bắt đầu làm lại bài thi từ câu 1?',
      () => {
        setUserAnswers({});
        setCurrentQuestionIndex(0);
        setIsSubmitted(false);
        setSubmissionResults(null);
        setRemainingSeconds(examMinutes * 60);
        setIsTimerPaused(false);
        showToast('Đã đặt lại bài làm thử!', 'info');
      }
    );
  };

  const handleSubmitExam = () => {
    const realQuestions = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
        return !q.isExample && !isQuestionExample(q, p);
      });
    const unanswered = realQuestions.filter(({ idx }) => !isAnswered(idx));

    // Bắt buộc học sinh phải thi hết tất cả các câu mới được nộp bài
    if (unanswered.length > 0 && !isTestRun) {
      setShowIncompleteModal({
        isOpen: true,
        unansweredCount: unanswered.length,
        unansweredIndices: unanswered.map((u) => u.idx)
      });
      return;
    }

    if (unanswered.length > 0 && isTestRun) {
      openConfirm(
        'Xác nhận nộp bài thi chạy thử',
        `Còn ${unanswered.length} câu chưa trả lời. Bạn có muốn nộp bài test ngay để kiểm tra tính điểm không?`,
        () => {
          finalizeGrading();
        }
      );
      return;
    }

    openConfirm(
      'Xác nhận nộp bài thi',
      `Em đã hoàn thành đầy đủ tất cả ${realQuestions.length}/${realQuestions.length} câu hỏi! Em có chắc chắn muốn nộp bài để chấm điểm và lưu kết quả không? Sau khi nộp bài, hệ thống sẽ lưu điểm và tự động chuyển về màn hình đăng nhập.`,
      () => {
        finalizeGrading();
      }
    );
  };

  // If no student is logged in, show the Student Login Gate
  if (!currentStudent) {
    if (isTestRun) {
      return (
        <div className="max-w-xl mx-auto my-6">
          <div className="bg-white border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-600/25">
                <i className="fa-solid fa-flask-vial"></i>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">CHẾ ĐỘ TEST CHẠY THỬ ĐỀ THI</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Bạn đang chạy thử nghiệm đề thi để kiểm tra hiển thị câu hỏi, audio, vẽ nối, tô màu và tính điểm.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  onLoginStudent({
                    id: 'TEST_TEACHER',
                    name: 'Giáo viên - Bài Thi Thử Nghiệm',
                    school: 'Phòng Thử Nghiệm Hệ Thống iSMART',
                    grade: 'Khối 2',
                    className: 'Test Run'
                  })
                }
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <i className="fa-solid fa-play"></i> BẮT ĐẦU CHẠY THỬ NGAY (TÀI KHOẢN GIÁO VIÊN)
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-xs font-bold uppercase">Hoặc thử với tư cách học sinh</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {students.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">
                    Chọn học sinh bất kỳ để chạy thử hồ sơ:
                  </label>
                  <select
                    onChange={(e) => {
                      const found = students.find((s) => s.id === e.target.value);
                      if (found) onLoginStudent(found);
                    }}
                    defaultValue=""
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>-- Chọn học sinh từ danh sách --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} - {s.name} ({s.school} - {s.className})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {onExitTestRun && (
                <button
                  type="button"
                  onClick={onExitTestRun}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <i className="fa-solid fa-arrow-left"></i> Quay lại màn hình Soạn Đề
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (pendingStudent) {
      return (
        <div className="max-w-xl mx-auto my-6 px-3">
          <div className="bg-white border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
                <i className="fa-solid fa-circle-check text-emerald-600"></i> Bước 2: Xác Nhận Thông Tin Thí Sinh
              </div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/25">
                <i className="fa-solid fa-id-card-clip"></i>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                XÁC NHẬN THÔNG TIN TRƯỚC KHI VÀO THI
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Vui lòng kiểm tra chính xác các thông tin dưới đây để đảm bảo điểm thi được lưu đúng hồ sơ của em.
              </p>
            </div>

            {/* Student Card Info */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase text-slate-500">Mã ID Thí Sinh (SBD)</span>
                <span className="text-base font-mono font-black text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-sm">
                  {pendingStudent.id}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Họ Và Tên Thí Sinh</span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <i className="fa-solid fa-user-graduate text-emerald-600 text-xl sm:text-2xl"></i>
                  <span>{pendingStudent.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Lớp & Khối</span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">
                    Lớp {pendingStudent.className} {pendingStudent.grade ? `(${pendingStudent.grade})` : ''}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Trường Học</span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5 truncate" title={pendingStudent.school}>
                    {pendingStudent.school}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 text-xs">
                  <span className="text-emerald-800 font-bold block">Thời gian làm bài:</span>
                  <span className="text-emerald-950 font-black text-sm">⏱️ {examMinutes} phút</span>
                </div>
                <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 text-xs">
                  <span className="text-blue-800 font-bold block">Số lượng câu hỏi:</span>
                  <span className="text-blue-950 font-black text-sm">📝 {questions.filter((q) => !q.isExample).length} câu chính thức</span>
                </div>
              </div>
            </div>

            {/* Notice */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-base shrink-0 mt-0.5"></i>
              <div>
                <strong>Lưu ý quan trọng:</strong> Nếu thông tin <strong>Họ tên, Lớp hoặc Trường</strong> ở trên không phải của em, hãy bấm nút <em>"Không phải tôi / Đổi ID"</em> bên dưới để nhập lại. Tránh thi nhầm bài của bạn khác!
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmLogin}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
              >
                <i className="fa-solid fa-circle-check text-xl"></i>
                <span>✓ ĐÚNG THÔNG TIN CỦA EM - BẮT ĐẦU VÀO THI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingStudent(null);
                  setLoginError(null);
                }}
                className="w-full py-3 px-4 rounded-xl border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>✕ Không phải thông tin của em (Nhập lại Mã ID khác)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    const availableClasses = Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
    const filteredLookupStudents = students.filter((s) => {
      const matchesClass = selectedClassFilter === 'all' || s.className === selectedClassFilter;
      const matchesSearch =
        !lookupSearch.trim() ||
        s.name.toLowerCase().includes(lookupSearch.toLowerCase().trim()) ||
        s.id.toLowerCase().includes(lookupSearch.toLowerCase().trim());
      return matchesClass && matchesSearch;
    });

    return (
      <div className="max-w-lg mx-auto my-6 px-3">
        {/* Device Crash / Power Loss Recovery Card */}
        {deviceActiveExam && (
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl p-5 sm:p-6 shadow-xl mb-6 border-2 border-white/30 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shrink-0 shadow-inner">
                <i className="fa-solid fa-laptop-medical"></i>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                  TỰ ĐỘNG BẢO VỆ KHI MẤT ĐIỆN / MẤT MẠNG / LỖI MÁY
                </div>
                <h3 className="text-base sm:text-lg font-black leading-snug">
                  Phát hiện bài thi đang làm dở dang trên máy tính này!
                </h3>
                <p className="text-xs text-white/95 leading-relaxed">
                  Thí sinh: <strong>{deviceActiveExam.student.name}</strong> • SBD: <strong>{deviceActiveExam.student.id}</strong> • Lớp: <strong>{deviceActiveExam.student.className}</strong>
                </p>
                <div className="text-[11px] bg-black/20 rounded-xl px-3 py-1.5 inline-block font-mono">
                  ⏱️ Còn lại {Math.floor(deviceActiveExam.remainingSeconds / 60)} phút • Đã làm {Object.keys(deviceActiveExam.answers).length} câu • Lưu lúc {new Date(deviceActiveExam.savedAt).toLocaleTimeString('vi-VN')}
                </div>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLoginStudent(deviceActiveExam.student);
                      showToast(`Đã khôi phục bài thi cho ${deviceActiveExam.student.name}!`, 'success');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white text-orange-800 hover:bg-orange-50 font-black text-xs sm:text-sm shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <i className="fa-solid fa-rotate-left text-orange-600"></i>
                    <span>TIẾP TỤC KHÔI PHỤC BÀI THI NGAY</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openConfirm(
                        'Hủy phiên thi dở dang này?',
                        `Bạn có chắc chắn muốn xóa phiên thi dở dang của ${deviceActiveExam.student.name} trên máy này để bắt đầu bài thi mới không?`,
                        () => {
                          try {
                            localStorage.removeItem('ismart_device_active_exam');
                            localStorage.removeItem(`ismart_progress_${deviceActiveExam.studentId}`);
                            setDeviceActiveExam(null);
                            showToast('Đã xóa phiên thi dở dang trên máy này!', 'info');
                          } catch {}
                        }
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Bỏ qua phiên này
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black uppercase tracking-wider mb-1">
              <i className="fa-solid fa-shield-halved text-blue-600"></i> Bước 1: Nhập Mã ID Thí Sinh
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-blue-600/25">
              <i className="fa-solid fa-user-lock"></i>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">CỔNG ĐĂNG NHẬP PHÒNG THI</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Vui lòng nhập <strong>Mã ID Học Sinh</strong> đã được Giám thị cấp để xác nhận thông tin trước khi bắt đầu.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                Nhập Mã ID Dự Thi Của Em
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={loginInputId}
                  onChange={(e) => {
                    setLoginInputId(e.target.value.toUpperCase());
                    setLoginError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLookupStudent();
                  }}
                  placeholder="Ví dụ: HS2001"
                  className="w-full px-4 py-3.5 text-base sm:text-lg font-mono font-black uppercase tracking-wider text-center bg-slate-50 border-2 border-slate-300 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>
              {loginError && (
                <div className="mt-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation text-base shrink-0 mt-0.5"></i>
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isLookingUpCloud}
              onClick={() => handleLookupStudent()}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-sm sm:text-base shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-60"
            >
              {isLookingUpCloud ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fa-solid fa-magnifying-glass"></i>
              )}
              <span>{isLookingUpCloud ? 'ĐANG TRA CỨU THÍ SINH...' : 'TIẾP TỤC & XÁC NHẬN THÔNG TIN THÍ SINH'}</span>
            </button>

            {students.length > 0 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowLookupModal(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-address-book"></i> Quên hoặc cần xem danh sách Mã ID theo Lớp?
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">
                <i className="fa-solid fa-server text-emerald-600 mr-1"></i>Hạ tầng thi đồng thời (500+ thí sinh):
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Cách ly phiên độc lập
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
              <div>
                • Mỗi thiết bị/tab trình duyệt chạy phiên độc lập, <strong>không bị trùng lặp câu trả lời hoặc xung đột dữ liệu</strong>.
              </div>
              <div>
                • <strong>Tự động lưu trên máy:</strong> Khi máy tính mất điện, mất mạng hay tắt đột ngột, toàn bộ bài làm sẽ được lưu an toàn trực tiếp trên máy và khôi phục khi mở lại.
              </div>
              <div>
                • Bắt buộc xác nhận đúng <strong>Họ tên, Lớp và Trường</strong> ở bước tiếp theo trước khi chính thức mở đề thi.
              </div>
            </div>

            {onRequestUnlockAdmin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onRequestUnlockAdmin}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-key text-amber-500"></i>
                  <span>Bạn là Giám thị / Quản trị viên? Nhập PIN quay lại Admin</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal tra cứu mã ID theo Lớp */}
        {showLookupModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col border border-slate-200">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <i className="fa-solid fa-address-book text-blue-600"></i> Tra Cứu Mã ID Thí Sinh Theo Lớp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn nhanh lớp và tên của em để lấy đúng mã ID dự thi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo Lớp:</label>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tất cả các lớp ({students.length} thí sinh)</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Lớp {cls} ({students.filter((s) => s.className === cls).length} hs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tìm theo Tên hoặc Mã ID:</label>
                  <input
                    type="text"
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    placeholder="Nhập tên học sinh..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto max-h-[50vh] divide-y divide-slate-100 space-y-2">
                {filteredLookupStudents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-semibold">
                    Không tìm thấy học sinh nào phù hợp với bộ lọc!
                  </div>
                ) : (
                  filteredLookupStudents.map((st) => (
                    <div
                      key={st.id}
                      className="pt-2 flex items-center justify-between hover:bg-blue-50/50 p-2 rounded-xl transition"
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{st.name}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            {st.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Lớp {st.className} • Trường {st.school}
                          {st.score !== null && typeof st.score !== 'undefined' && (
                            <span className="ml-2 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Đã nộp bài ({st.score}đ)
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setLoginInputId(st.id);
                          setShowLookupModal(false);
                          handleLookupStudent(st.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer shrink-0 ml-2"
                      >
                        Chọn & Xác Nhận <i className="fa-solid fa-arrow-right ml-1"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active Exam Workspace
  const answeredCount = questions.filter((_, i) => isAnswered(i)).length;
  const questionsToShow = viewMode === 'single' ? [currentQuestionIndex] : questions.map((_, i) => i);

  // Section & Part hierarchy data
  const currentQ = questions[currentQuestionIndex];
  const activePart = parts.find((p) => p.id === (currentQ?.partId || parts[0]?.id)) || parts[0];
  const currentSection: ExamSection = getPartSection(activePart);

  const listeningParts = parts.map((p, idx) => ({ p, idx })).filter(({ p }) => getPartSection(p) === 'listening');
  const readingWritingParts = parts.map((p, idx) => ({ p, idx })).filter(({ p }) => getPartSection(p) === 'reading-writing');

  const listeningPartPoints = listeningParts.reduce((acc, { p }) => acc + (p.points || 0), 0);
  const readingWritingPartPoints = readingWritingParts.reduce((acc, { p }) => acc + (p.points || 0), 0);

  const listeningQuestions = questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    return p && getPartSection(p) === 'listening' && !isQuestionExample(q, p);
  });
  const readingWritingQuestions = questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    return p && getPartSection(p) === 'reading-writing' && !isQuestionExample(q, p);
  });

  const realQuestionsList = [...listeningQuestions, ...readingWritingQuestions];
  const unansweredQuestionsList = realQuestionsList.filter(({ idx }) => !isAnswered(idx));
  const unansweredQuestionsCount = unansweredQuestionsList.length;

  const currentSectionParts = currentSection === 'listening' ? listeningParts : readingWritingParts;

  const isCambridgePart2 = (p?: ExamPart, itemQ?: Question) => {
    if (!p) return false;
    const sec = getPartSection(p);
    if (sec !== 'listening') return false;
    return (
      p.id === 'part-g2-2' ||
      (Boolean(p.img) && (itemQ?.type === 'listen-write' || p.title.toLowerCase().includes('part 2')))
    );
  };

  const isCambridgePart1RW = (p?: ExamPart, itemQ?: Question) => {
    if (!p) return false;
    if (p.id === 'part-g2-5') return true;
    const sec = getPartSection(p);
    if (sec !== 'reading-writing') return false;
    const isTickPart =
      itemQ?.type === 'tick-cross' ||
      p.title.toLowerCase().includes('tick') ||
      p.title.toLowerCase().includes('look and read') ||
      questions.some((q) => (q.partId || parts[0]?.id) === p.id && q.type === 'tick-cross');
    return isTickPart;
  };

  const isCambridgePart2RW = (p?: ExamPart, itemQ?: Question) => {
    if (!p) return false;
    const sec = getPartSection(p);
    if (sec !== 'reading-writing') return false;
    if (p.id === 'part-g2-6') return true;
    const lowTitle = (p.title || '').toLowerCase();
    const rwParts = parts.filter((pt) => getPartSection(pt) === 'reading-writing');
    const rwIndex = rwParts.findIndex((pt) => pt.id === p.id);
    const isPart2ByOrderOrTitle =
      rwIndex === 1 ||
      lowTitle.includes('part 2') ||
      p.id.endsWith('-6') ||
      p.id.endsWith('-2');

    const hasYesNoQuestions = questions.some(
      (q) => (q.partId || parts[0]?.id) === p.id && q.type === 'yes-no'
    );
    const isYesNoPart =
      itemQ?.type === 'yes-no' ||
      lowTitle.includes('yes') ||
      lowTitle.includes('no') ||
      hasYesNoQuestions;

    return (
      (isPart2ByOrderOrTitle && (isYesNoPart || Boolean(p.img) || Boolean(p.examplesList))) ||
      isYesNoPart
    );
  };

  return (
    <div className="space-y-4 pb-36 sm:pb-32 relative">
      {/* Test Run Simulation Top Banner */}
      {isTestRun && (
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg border-2 border-emerald-400/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-xl shadow-inner shrink-0">
              🧪
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base tracking-tight text-white">
                  CHẾ ĐỘ TEST CHẠY THỬ ĐỀ THI (SIMULATION PREVIEW)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Giáo Viên / Quản Trị
                </span>
                {isTimerPaused && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <i className="fa-solid fa-pause"></i> Đang dừng giờ
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 opacity-90">
                Bạn đang chạy thử nghiệm toàn bộ đề thi thực tế (Nghe audio, tô màu tranh nét Cambridge, nối cặp, điền từ & chấm điểm tự động).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoFillCorrect}
              title="Tự động điền 100% đáp án đúng cho tất cả các câu hỏi để kiểm tra tính điểm tối đa"
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Điền thử ĐÚNG (100%)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsTimerPaused(!isTimerPaused);
                showToast(isTimerPaused ? 'Đã tiếp tục đếm giờ làm bài!' : 'Đã tạm dừng đếm giờ làm bài!', 'info');
              }}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur transition flex items-center gap-1.5 cursor-pointer"
              title="Tạm dừng hoặc tiếp tục thời gian làm bài"
            >
              <i className={`fa-solid ${isTimerPaused ? 'fa-play' : 'fa-pause'}`}></i>
              <span>{isTimerPaused ? 'Tiếp tục giờ' : 'Tạm dừng giờ'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetExamAnswers}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur transition flex items-center gap-1.5 cursor-pointer"
              title="Xóa làm lại từ đầu"
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>Làm lại</span>
            </button>
            {onExitTestRun && (
              <button
                type="button"
                onClick={onExitTestRun}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Thoát chế độ chạy thử và quay lại màn hình soạn đề"
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>Quay lại Soạn Đề</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. FIXED TOP-RIGHT: Countdown Timer Widget (Always visible when scrolling) */}
      <div
        className={`fixed top-20 right-3 sm:right-6 z-40 flex items-center gap-2.5 sm:gap-3.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl border backdrop-blur transition-all duration-300 select-none ${
          remainingSeconds < 120
            ? 'bg-red-600/95 text-white border-red-300 shadow-red-600/30 animate-pulse'
            : remainingSeconds < 300
            ? 'bg-amber-600/95 text-white border-amber-300 shadow-amber-600/30'
            : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-400/50 shadow-blue-600/25'
        }`}
        style={{ minWidth: '155px' }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-wider font-extrabold opacity-90 flex items-center gap-1.5">
            <span>THỜI GIAN CÒN LẠI</span>
            {isTimerPaused && (
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                TẠM DỪNG
              </span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-black tracking-tight font-mono leading-none mt-0.5">
            {formatTime(remainingSeconds)}
          </div>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-inner">
          <i className="fa-regular fa-clock"></i>
        </div>
      </div>

      {/* Top Student Identification Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 text-white shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
            iS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-white truncate">
                {currentStudent.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono font-black text-xs">
                ID: {currentStudent.id}
              </span>
              {/* Realtime Local Save & Network Status */}
              {isOnline ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold"
                  title="Toàn bộ câu trả lời đang được tự động lưu liên tục vào bộ nhớ máy tính này"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Đã lưu trên máy • Trực tuyến</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse"
                  title="Mất kết nối Internet - Bài làm vẫn đang được lưu an toàn trực tiếp trên máy này"
                >
                  <i className="fa-solid fa-wifi-slash text-[10px]"></i>
                  <span>Mất mạng • Đang lưu offline trên máy</span>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2 sm:gap-3 flex-wrap">
              <span>
                Khối: <strong className="text-sky-300">{currentStudent.grade}</strong> - Lớp:{' '}
                <strong className="text-sky-300">{currentStudent.className}</strong>
              </span>
              <span>•</span>
              <span className="truncate">
                Trường: <strong className="text-amber-300">{currentStudent.school}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pr-0 sm:pr-44">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitted) {
                openConfirm(
                  'Quay về trang đăng nhập?',
                  'Bài làm hiện tại chưa được nộp. Bạn có chắc chắn muốn thoát về trang đăng nhập để đổi thí sinh không?',
                  () => onLogoutStudent()
                );
              } else {
                onLogoutStudent();
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-xs active:scale-95"
            title="Quay về trang đăng nhập để đổi thí sinh khác"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Đổi thí sinh</span>
          </button>
        </div>
      </div>

      {/* Offline Alert Banner if Internet drops */}
      {!isOnline && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-bold border-2 border-amber-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg shrink-0">
              <i className="fa-solid fa-wifi-slash"></i>
            </div>
            <div>
              <span className="font-black uppercase tracking-wider block text-amber-100 text-[11px]">
                CẢNH BÁO MẤT MẠNG INTERNET
              </span>
              <span>
                Toàn bộ câu trả lời của em đang được tự động lưu liên tục trên máy tính này. Em tiếp tục làm bài bình thường, không lo mất dữ liệu! Khi hoàn thành nộp bài, điểm sẽ tự động đồng bộ lên hệ thống.
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-black/25 text-xs font-black uppercase tracking-wider shrink-0 border border-white/20">
            Đang bảo vệ dữ liệu trên máy
          </span>
        </div>
      )}

      {/* Result Banner when submitted with Section & Part Breakdown */}
      {isSubmitted && submissionResults && (
        <div className="p-4 sm:p-6 rounded-3xl border-2 border-emerald-500 bg-white shadow-lg text-left space-y-4 animate-in fade-in zoom-in-95">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2.5">
            <i className="fa-solid fa-cloud-arrow-up text-emerald-600 text-lg shrink-0"></i>
            <div>
              <strong>ĐÃ NỘP BÀI THÀNH CÔNG:</strong> Điểm thi của thí sinh <strong>{currentStudent.name}</strong> đã được chấm điểm tự động và gửi lưu vào hệ thống danh sách điểm chung.
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-700">
                Kết Quả Bài Làm Của Thí Sinh
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600">
                {submissionResults.totalEarnedPoints} / {submissionResults.maxExamPoints} đ
              </div>
              <div className="text-xs font-bold text-slate-600">
                Đúng {submissionResults.totalQuestionsCorrect}/{questions.length} câu • Quy đổi: {submissionResults.pts10}/10 điểm
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setUserAnswers({});
                  setRemainingSeconds(examMinutes * 60);
                  setCurrentQuestionIndex(0);
                  showToast('Bắt đầu làm lại đề thi!');
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>Làm lại đề này</span>
              </button>
              {isTestRun && onExitTestRun && (
                <button
                  type="button"
                  onClick={onExitTestRun}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>Quay lại Soạn Đề</span>
                </button>
              )}
            </div>
          </div>

          {/* 2 Section Result Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section 1: LISTENING Results */}
            {submissionResults.sectionScores.listening && listeningParts.length > 0 && (() => {
              const sec = submissionResults.sectionScores.listening;
              const pct = sec.totalPoints > 0 ? Math.round((sec.earnedPoints / sec.totalPoints) * 100) : 0;
              return (
                <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-black text-blue-950 pb-1.5 border-b border-blue-200/60">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-headphones text-blue-600"></i>
                      <span>1. LISTENING</span>
                    </span>
                    <span className="text-blue-800">
                      {sec.earnedPoints} / {sec.totalPoints} đ ({pct}%)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {listeningParts.map(({ p }, lIdx) => {
                      const rec = submissionResults.partScores[p.id] || {
                        earnedPoints: 0,
                        totalPoints: p.points,
                        correctCount: 0,
                        questionCount: 0
                      };
                      const partPct = rec.totalPoints > 0 ? Math.round((rec.earnedPoints / rec.totalPoints) * 100) : 0;
                      return (
                        <div key={p.id} className="p-2 rounded-xl bg-white border border-blue-100 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="truncate max-w-[200px]" title={p.title}>
                              Part {lIdx + 1}: {p.title}
                            </span>
                            <span className="text-blue-700 font-black shrink-0">
                              {rec.earnedPoints} / {p.points} đ
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Đúng {rec.correctCount}/{rec.questionCount} câu</span>
                            <span className="font-bold">{partPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, partPct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section 2: READING & WRITING Results */}
            {submissionResults.sectionScores['reading-writing'] && readingWritingParts.length > 0 && (() => {
              const sec = submissionResults.sectionScores['reading-writing'];
              const pct = sec.totalPoints > 0 ? Math.round((sec.earnedPoints / sec.totalPoints) * 100) : 0;
              return (
                <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-black text-teal-950 pb-1.5 border-b border-teal-200/60">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-book-open text-teal-600"></i>
                      <span>2. READING & WRITING</span>
                    </span>
                    <span className="text-teal-800">
                      {sec.earnedPoints} / {sec.totalPoints} đ ({pct}%)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {readingWritingParts.map(({ p }, rwIdx) => {
                      const rec = submissionResults.partScores[p.id] || {
                        earnedPoints: 0,
                        totalPoints: p.points,
                        correctCount: 0,
                        questionCount: 0
                      };
                      const partPct = rec.totalPoints > 0 ? Math.round((rec.earnedPoints / rec.totalPoints) * 100) : 0;
                      return (
                        <div key={p.id} className="p-2 rounded-xl bg-white border border-teal-100 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="truncate max-w-[200px]" title={p.title}>
                              Part {rwIdx + 1}: {p.title}
                            </span>
                            <span className="text-teal-700 font-black shrink-0">
                              {rec.earnedPoints} / {p.points} đ
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Đúng {rec.correctCount}/{rec.questionCount} câu</span>
                            <span className="font-bold">{partPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, partPct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main Full-Width Question Viewer */}
      <div className="w-full space-y-4">
        {/* Tier 1: Section Switcher (Listening vs Reading & Writing) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Section 1 Button: Listening */}
          <button
            type="button"
            onClick={() => {
              const firstListen = questions.findIndex((q) => {
                const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
                return p && getPartSection(p) === 'listening';
              });
              if (firstListen >= 0) {
                setCurrentQuestionIndex(firstListen);
                if (viewMode === 'all') {
                  const el = document.getElementById(`student-qcard-${firstListen}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }}
            className={`p-3.5 rounded-2xl text-left border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
              currentSection === 'listening'
                ? 'bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white border-blue-500 shadow-md ring-2 ring-blue-400/40'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                currentSection === 'listening' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700'
              }`}>
                <i className="fa-solid fa-headphones"></i>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    currentSection === 'listening' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-800'
                  }`}>
                    PHẦN 1
                  </span>
                  <h4 className="text-xs sm:text-sm font-black truncate">LISTENING (BÀI NGHE)</h4>
                </div>
                <p className={`text-[11px] font-semibold truncate ${
                  currentSection === 'listening' ? 'text-blue-200' : 'text-slate-500'
                }`}>
                  {listeningParts.length} Parts • {listeningQuestions.length} câu • {listeningPartPoints.toFixed(1)} đ
                </p>
              </div>
            </div>
            {currentSection === 'listening' && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                <i className="fa-solid fa-check"></i>
              </span>
            )}
          </button>

          {/* Section 2 Button: Reading & Writing */}
          <button
            type="button"
            onClick={() => {
              const firstRw = questions.findIndex((q) => {
                const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
                return p && getPartSection(p) === 'reading-writing';
              });
              if (firstRw >= 0) {
                setCurrentQuestionIndex(firstRw);
                if (viewMode === 'all') {
                  const el = document.getElementById(`student-qcard-${firstRw}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }}
            className={`p-3.5 rounded-2xl text-left border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
              currentSection === 'reading-writing'
                ? 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 text-white border-teal-500 shadow-md ring-2 ring-teal-400/40'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                currentSection === 'reading-writing' ? 'bg-teal-600 text-white shadow-xs' : 'bg-teal-50 text-teal-700'
              }`}>
                <i className="fa-solid fa-book-open-reader"></i>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    currentSection === 'reading-writing' ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-800'
                  }`}>
                    PHẦN 2
                  </span>
                  <h4 className="text-xs sm:text-sm font-black truncate">READING & WRITING</h4>
                </div>
                <p className={`text-[11px] font-semibold truncate ${
                  currentSection === 'reading-writing' ? 'text-teal-200' : 'text-slate-500'
                }`}>
                  {readingWritingParts.length} Parts • {readingWritingQuestions.length} câu • {readingWritingPartPoints.toFixed(1)} đ
                </p>
              </div>
            </div>
            {currentSection === 'reading-writing' && (
              <span className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                <i className="fa-solid fa-check"></i>
              </span>
            )}
          </button>
        </div>

        {/* Tier 2: Sub-Part Navigation Bar for the Active Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-black text-slate-500 uppercase shrink-0 px-1 flex items-center gap-1">
            {currentSection === 'listening' ? (
              <>
                <i className="fa-solid fa-headphones text-blue-600"></i>
                <span>Parts bài nghe:</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-book-open text-teal-600"></i>
                <span>Parts đọc & viết:</span>
              </>
            )}
          </span>

          {currentSectionParts.map(({ p, idx: globalPIdx }, secIdx) => {
            const isCurrentPart = activePart.id === p.id;
            const firstQIdx = questions.findIndex((q) => (q.partId || parts[0]?.id) === p.id);
            const count = questions.filter((q) => (q.partId || parts[0]?.id) === p.id).length;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (firstQIdx >= 0) {
                    setCurrentQuestionIndex(firstQIdx);
                    if (viewMode === 'all') {
                      const el = document.getElementById(`student-qcard-${firstQIdx}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isCurrentPart
                    ? currentSection === 'listening'
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-300'
                      : 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Part {globalPIdx + 1}</span>
                <span className="truncate max-w-[110px]">{p.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                    isCurrentPart ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.points}đ ({count}c)
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode & Navigation Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Chế độ hiển thị:</span>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Từng câu một
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Toàn bộ đề thi
            </button>
          </div>

          {viewMode === 'single' && (() => {
            const activeQ = questions[currentQuestionIndex];
            const activeQInfo = getQuestionPartAndIndex(activeQ, currentQuestionIndex, questions, parts);
            const realQuestionIndices = questions
              .map((q, idx) => ({ q, idx }))
              .filter(({ q }) => {
                const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
                return !isQuestionExample(q, p);
              })
              .map(({ idx }) => idx);
            const currentRealPos = realQuestionIndices.indexOf(currentQuestionIndex);

            return (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentRealPos <= 0}
                  onClick={() => {
                    if (currentRealPos > 0) {
                      setCurrentQuestionIndex(realQuestionIndices[currentRealPos - 1]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-left"></i> Câu trước
                </button>
                <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                  Part {activeQInfo.partDisplayNumber} - Câu {activeQInfo.localQuestionNumber} / {activeQInfo.totalInPart}
                </div>
                <button
                  type="button"
                  disabled={currentRealPos >= realQuestionIndices.length - 1 || currentRealPos === -1}
                  onClick={() => {
                    if (currentRealPos < realQuestionIndices.length - 1 && currentRealPos >= 0) {
                      setCurrentQuestionIndex(realQuestionIndices[currentRealPos + 1]);
                    } else if (currentRealPos === -1 && realQuestionIndices.length > 0) {
                      setCurrentQuestionIndex(realQuestionIndices[0]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  Câu tiếp <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            );
          })()}
        </div>

        {/* Single View: Hierarchical Banner (Section -> Part -> Question) with Instructions & Audio */}
        {viewMode === 'single' && !isCambridgePart2(activePart, currentQ) && !isCambridgePart1RW(activePart, currentQ) && !isCambridgePart2RW(activePart, currentQ) && (() => {
          const activeQ = questions[currentQuestionIndex];
          if (!activeQ) return null;
          const activeQInfo = getQuestionPartAndIndex(activeQ, currentQuestionIndex, questions, parts);
          const isListen = currentSection === 'listening';

          return (
            <div className={`p-4 rounded-2xl shadow-sm space-y-3 text-white transition-all ${
              isListen
                ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 border-2 border-indigo-400/30'
                : 'bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 border-2 border-teal-400/30'
            }`}>
              {/* Hierarchy Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-black pb-2 border-b border-white/10">
                <span className={`px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                  isListen ? 'bg-blue-600 text-white' : 'bg-teal-600 text-white'
                }`}>
                  <i className={`fa-solid ${isListen ? 'fa-headphones' : 'fa-book-open'}`}></i>
                  <span>{isListen ? '1. LISTENING' : '2. READING & WRITING'}</span>
                </span>
                <span className="text-white/40">➔</span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-white">
                  Part {activeQInfo.partDisplayNumber}: {getCleanPartTitle(activePart.title)}
                </span>
                <span className="text-white/40">➔</span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black">
                  Câu {activeQInfo.localQuestionNumber} / {activeQInfo.totalInPart} ({activeQ.points ?? 0.5}đ)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Part {activeQInfo.partDisplayNumber}: {getCleanPartTitle(activePart.title)}
                  </h3>
                  {activePart.instructions && (
                    <p className="text-xs text-slate-300 leading-relaxed font-medium mt-1">
                      {activePart.instructions}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold text-slate-200">
                    Thang điểm Part: <strong className="text-white">{activePart.points} đ</strong> ({activeQInfo.totalInPart} câu)
                  </span>
                </div>
              </div>

              {/* Part Shared Audio */}
              {activePart.audio && (
                <div className="pt-2 border-t border-white/10 space-y-1">
                  <div className="text-[11px] font-extrabold text-indigo-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-headphones"></i> Audio bài nghe chung của Part {activeQInfo.partDisplayNumber}:
                  </div>
                  <AudioPlayerBox
                    audio={activePart.audio}
                    maxPlayCount={activePart.maxPlayCount ?? 2}
                    isSubmitted={isSubmitted}
                    questionIndex={-1}
                    showToast={showToast}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* Single View: Part Example Card showing sample solution to guide students */}
        {viewMode === 'single' && !isCambridgePart2(activePart, currentQ) && !isCambridgePart1RW(activePart, currentQ) && !isCambridgePart2RW(activePart, currentQ) && activePart.example && (
          <PartExampleCard
            example={activePart.example}
            partDisplayNumber={
              getQuestionPartAndIndex(currentQ, currentQuestionIndex, questions, parts).partDisplayNumber
            }
            partTitle={`Part ${getQuestionPartAndIndex(currentQ, currentQuestionIndex, questions, parts).partDisplayNumber}: ${getCleanPartTitle(activePart.title)}`}
            defaultExpanded={true}
          />
        )}

        {/* Questions Cards */}
        <div className="space-y-5">
          {questionsToShow.map((qIdx) => {
            const q = questions[qIdx];
            if (!q) return null;
            const isCorrect = isQuestionCorrect(qIdx);
            const qInfo = getQuestionPartAndIndex(q, qIdx, questions, parts);
            const qPart = qInfo.part;
            const isQListen = qInfo.isListening;

            // In 'all' view, check if this is the start of a Section or Part
            const isFirstOfSection = viewMode === 'all' && (
              qIdx === 0 ||
              getQuestionPartAndIndex(questions[qIdx - 1], qIdx - 1, questions, parts).isListening !== isQListen
            );
            const isFirstOfPart = viewMode === 'all' && (
              qIdx === 0 ||
              getQuestionPartAndIndex(questions[qIdx - 1], qIdx - 1, questions, parts).part.id !== qPart.id
            );

            // Special Cambridge Listening Part 2 Handling:
            // Combines Shared Title, Shared Audio, Shared Picture + Image Title, Examples, and Questions 1-4
            if (isCambridgePart2(qPart, q)) {
              const allPart2Questions = questions
                .map((itemQ, originalIndex) => ({ q: itemQ, originalIndex }))
                .filter((item) => (item.q.partId || parts[0]?.id) === qPart.id);
              const realPart2Questions = allPart2Questions.filter(
                (item) => !isQuestionExample(item.q, qPart)
              );
              // Only real questions are shown in the answer section, renumbered from 1
              // (e.g. if Q1 & Q2 are examples, Q3 becomes Q1 for students)
              const part2Items = (realPart2Questions.length > 0 ? realPart2Questions : allPart2Questions).map(
                (item, localIdx) => ({
                  q: item.q,
                  originalIndex: item.originalIndex,
                  localNumber: localIdx + 1
                })
              );

              if (viewMode === 'all') {
                if (!isFirstOfPart) return null;
                return (
                  <React.Fragment key={`cambridge-part2-all-${qPart.id}`}>
                    {/* Section Header Divider in All-View */}
                    {isFirstOfSection && (
                      <div className={`p-4 sm:p-5 rounded-2xl text-white shadow-md flex items-center justify-between gap-3 ${
                        isQListen
                          ? 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 border-2 border-blue-400/40'
                          : 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 border-2 border-teal-400/40'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                            <i className={`fa-solid ${isQListen ? 'fa-headphones' : 'fa-book-open-reader'}`}></i>
                          </span>
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20">
                              {isQListen ? 'PHẦN THI 1' : 'PHẦN THI 2'}
                            </span>
                            <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                              {isQListen ? 'LISTENING (BÀI THI NGHE HIỂU)' : 'READING & WRITING (BÀI THI ĐỌC & VIẾT)'}
                            </h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-white/15 text-xs font-black">
                          Thang điểm: {isQListen ? listeningPartPoints.toFixed(1) : readingWritingPartPoints.toFixed(1)} đ
                        </span>
                      </div>
                    )}

                    <CambridgePart2View
                      part={qPart}
                      items={part2Items}
                      userAnswers={userAnswers}
                      onAnswerChange={(targetIdx, val) =>
                        setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                      }
                      isSubmitted={isSubmitted}
                      isTestRun={isTestRun}
                      questionScores={currentStudent?.questionScores}
                      showToast={showToast}
                    />
                  </React.Fragment>
                );
              } else {
                // Single View: Renders the full Cambridge Part 2 with active question highlighted
                return (
                  <CambridgePart2View
                    key={`cambridge-part2-single-${qPart.id}`}
                    part={qPart}
                    items={part2Items}
                    userAnswers={userAnswers}
                    onAnswerChange={(targetIdx, val) =>
                      setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                    }
                    isSubmitted={isSubmitted}
                    isTestRun={isTestRun}
                    questionScores={currentStudent?.questionScores}
                    activeQuestionIndex={currentQuestionIndex}
                    onSelectQuestion={(targetIdx) => setCurrentQuestionIndex(targetIdx)}
                    showToast={showToast}
                  />
                );
              }
            }

            // Special Cambridge Reading & Writing Part 1 Handling: Look and Read (Tick or Cross)
            // Displays the authentic Cambridge 2-column dashed-card grid with square answer boxes [✓] and [✗]
            if (isCambridgePart1RW(qPart, q)) {
              const allPart1Questions = questions
                .map((itemQ, originalIndex) => ({ q: itemQ, originalIndex }))
                .filter((item) => (item.q.partId || parts[0]?.id) === qPart.id);
              const realPart1Questions = allPart1Questions.filter(
                (item) => !isQuestionExample(item.q, qPart)
              );
              const part1Items = (realPart1Questions.length > 0 ? realPart1Questions : allPart1Questions).map(
                (item, localIdx) => ({
                  q: item.q,
                  originalIndex: item.originalIndex,
                  localNumber: localIdx + 1
                })
              );

              if (viewMode === 'all') {
                if (!isFirstOfPart) return null;
                return (
                  <React.Fragment key={`cambridge-part1-rw-all-${qPart.id}`}>
                    {/* Section Header Divider in All-View */}
                    {isFirstOfSection && (
                      <div className={`p-4 sm:p-5 rounded-2xl text-white shadow-md flex items-center justify-between gap-3 ${
                        isQListen
                          ? 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 border-2 border-blue-400/40'
                          : 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 border-2 border-teal-400/40'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                            <i className={`fa-solid ${isQListen ? 'fa-headphones' : 'fa-book-open-reader'}`}></i>
                          </span>
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20">
                              {isQListen ? 'PHẦN THI 1' : 'PHẦN THI 2'}
                            </span>
                            <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                              {isQListen ? 'LISTENING (BÀI THI NGHE HIỂU)' : 'READING & WRITING (BÀI THI ĐỌC & VIẾT)'}
                            </h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-white/15 text-xs font-black">
                          Thang điểm: {isQListen ? listeningPartPoints.toFixed(1) : readingWritingPartPoints.toFixed(1)} đ
                        </span>
                      </div>
                    )}

                    <CambridgePart1RWView
                      part={qPart}
                      items={part1Items}
                      userAnswers={userAnswers}
                      onAnswerChange={(targetIdx, val) =>
                        setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                      }
                      isSubmitted={isSubmitted}
                      isTestRun={isTestRun}
                      questionScores={currentStudent?.questionScores}
                      activeQuestionIndex={currentQuestionIndex}
                      onSelectQuestion={(targetIdx) => setCurrentQuestionIndex(targetIdx)}
                      showToast={showToast}
                    />
                  </React.Fragment>
                );
              } else {
                // Single View: Renders the full Cambridge Part 1 with active question highlighted
                return (
                  <CambridgePart1RWView
                    key={`cambridge-part1-rw-single-${qPart.id}`}
                    part={qPart}
                    items={part1Items}
                    userAnswers={userAnswers}
                    onAnswerChange={(targetIdx, val) =>
                      setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                    }
                    isSubmitted={isSubmitted}
                    isTestRun={isTestRun}
                    questionScores={currentStudent?.questionScores}
                    activeQuestionIndex={currentQuestionIndex}
                    onSelectQuestion={(targetIdx) => setCurrentQuestionIndex(targetIdx)}
                    showToast={showToast}
                  />
                );
              }
            }

            // Special Cambridge Reading & Writing Part 2 Handling: Look and Read (Yes or No)
            // Displays Common Image, Examples, and Main Questions 1-N together in a single unified frame
            if (isCambridgePart2RW(qPart, q)) {
              const allPart2RWQuestions = questions
                .map((itemQ, originalIndex) => ({ q: itemQ, originalIndex }))
                .filter((item) => (item.q.partId || parts[0]?.id) === qPart.id);
              const realPart2RWQuestions = allPart2RWQuestions.filter(
                (item) => !isQuestionExample(item.q, qPart)
              );
              const part2RWItems = (realPart2RWQuestions.length > 0 ? realPart2RWQuestions : allPart2RWQuestions).map(
                (item, localIdx) => ({
                  q: item.q,
                  originalIndex: item.originalIndex,
                  localNumber: localIdx + 1
                })
              );

              if (viewMode === 'all') {
                if (!isFirstOfPart) return null;
                return (
                  <React.Fragment key={`cambridge-rw2-all-${qPart.id}`}>
                    {/* Section Header Divider in All-View */}
                    {isFirstOfSection && (
                      <div className={`p-4 sm:p-5 rounded-2xl text-white shadow-md flex items-center justify-between gap-3 ${
                        isQListen
                          ? 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 border-2 border-blue-400/40'
                          : 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 border-2 border-teal-400/40'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                            <i className={`fa-solid ${isQListen ? 'fa-headphones' : 'fa-book-open-reader'}`}></i>
                          </span>
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20">
                              {isQListen ? 'PHẦN THI 1' : 'PHẦN THI 2'}
                            </span>
                            <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                              {isQListen ? 'LISTENING (BÀI THI NGHE HIỂU)' : 'READING & WRITING (BÀI THI ĐỌC & VIẾT)'}
                            </h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-white/15 text-xs font-black">
                          Thang điểm: {isQListen ? listeningPartPoints.toFixed(1) : readingWritingPartPoints.toFixed(1)} đ
                        </span>
                      </div>
                    )}

                    <CambridgePart2RWView
                      part={qPart}
                      items={part2RWItems}
                      userAnswers={userAnswers}
                      onAnswerChange={(targetIdx, val) =>
                        setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                      }
                      isSubmitted={isSubmitted}
                      isTestRun={isTestRun}
                      questionScores={currentStudent?.questionScores}
                      activeQuestionIndex={currentQuestionIndex}
                      onSelectQuestion={(targetIdx) => setCurrentQuestionIndex(targetIdx)}
                      showToast={showToast}
                    />
                  </React.Fragment>
                );
              } else {
                // Single View: Renders the full Cambridge Reading & Writing Part 2 unified frame
                return (
                  <CambridgePart2RWView
                    key={`cambridge-rw2-single-${qPart.id}`}
                    part={qPart}
                    items={part2RWItems}
                    userAnswers={userAnswers}
                    onAnswerChange={(targetIdx, val) =>
                      setUserAnswers((prev) => ({ ...prev, [targetIdx]: val }))
                    }
                    isSubmitted={isSubmitted}
                    isTestRun={isTestRun}
                    questionScores={currentStudent?.questionScores}
                    activeQuestionIndex={currentQuestionIndex}
                    onSelectQuestion={(targetIdx) => setCurrentQuestionIndex(targetIdx)}
                    showToast={showToast}
                  />
                );
              }
            }

            return (
              <React.Fragment key={qIdx}>
                {/* Section Header Divider in All-View */}
                {isFirstOfSection && (
                  <div className={`p-4 sm:p-5 rounded-2xl text-white shadow-md flex items-center justify-between gap-3 ${
                    isQListen
                      ? 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 border-2 border-blue-400/40'
                      : 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 border-2 border-teal-400/40'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                        <i className={`fa-solid ${isQListen ? 'fa-headphones' : 'fa-book-open-reader'}`}></i>
                      </span>
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20">
                          {isQListen ? 'PHẦN THI 1' : 'PHẦN THI 2'}
                        </span>
                        <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                          {isQListen ? 'LISTENING (BÀI THI NGHE HIỂU)' : 'READING & WRITING (BÀI THI ĐỌC & VIẾT)'}
                        </h3>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-white/15 text-xs font-black">
                      Thang điểm: {isQListen ? listeningPartPoints.toFixed(1) : readingWritingPartPoints.toFixed(1)} đ
                    </span>
                  </div>
                )}

                {/* Part Header Banner in All-View */}
                {isFirstOfPart && (
                  <div className={`p-3.5 rounded-xl border space-y-2 ${
                    isQListen
                      ? 'bg-blue-50/90 border-blue-200 text-blue-950'
                      : 'bg-teal-50/90 border-teal-200 text-teal-950'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-black text-xs text-white ${
                          isQListen ? 'bg-blue-600' : 'bg-teal-600'
                        }`}>
                          Part {qInfo.partDisplayNumber}
                        </span>
                        <h4 className="font-extrabold text-sm">{qPart.title}</h4>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
                        Thang điểm Part: <strong>{qPart.points} đ</strong> ({qInfo.totalInPart} câu)
                      </span>
                    </div>
                    {qPart.instructions && (
                      <p className="text-xs text-slate-600 font-medium">{qPart.instructions}</p>
                    )}
                    {qPart.audio && (
                      <div className="pt-2 border-t border-slate-200/80">
                        <AudioPlayerBox
                          audio={qPart.audio}
                          maxPlayCount={qPart.maxPlayCount ?? 2}
                          isSubmitted={isSubmitted}
                          questionIndex={-1}
                          showToast={showToast}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Part Example Card in All-View */}
                {isFirstOfPart && qPart.example && (
                  <PartExampleCard
                    example={qPart.example}
                    partDisplayNumber={qInfo.partDisplayNumber}
                    partTitle={qPart.title}
                    defaultExpanded={true}
                  />
                )}

                <div
                  id={`student-qcard-${qIdx}`}
                  className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 transition ${
                    isSubmitted
                      ? isCorrect
                        ? 'border-emerald-300 ring-2 ring-emerald-400/40'
                        : 'border-red-300 ring-2 ring-red-400/40'
                      : 'border-slate-200'
                  }`}
                >
                  {/* If question is marked as an Example */}
                  {q.isExample && (
                    <div className="bg-amber-500 text-white px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-black shadow-xs">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb text-base"></i>
                        <span>VÍ DỤ MẪU (EXAMPLE) - BÀI LÀM ĐÃ CÓ ĐÁP ÁN ĐỂ EM LÀM QUEN</span>
                      </div>
                      <span className="bg-black/20 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                        Không tính vào điểm thi
                      </span>
                    </div>
                  )}
                  {/* Section Title Banner (for Cambridge / Grade 2 parts) */}
                  {q.sectionTitle && (
                    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-3.5 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-black shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs">
                          <i className="fa-solid fa-graduation-cap"></i>
                        </span>
                        <span>{q.sectionTitle}</span>
                      </div>
                      {q.exampleHint && (
                        <span className="text-[11px] font-semibold text-blue-100 bg-black/20 px-2.5 py-0.5 rounded-md">
                          {q.exampleHint}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Question Header with Hierarchy Badge (Listening/Reading -> Part -> Câu) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xs">
                        Câu {qInfo.localQuestionNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-md font-extrabold text-[11px] flex items-center gap-1 ${
                        isQListen
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-teal-100 text-teal-900 border border-teal-200'
                      }`}>
                        <span>{isQListen ? '🎧 LISTENING' : '📖 READING & WRITING'}</span>
                        <span>•</span>
                        <span>Part {qInfo.partDisplayNumber}</span>
                        <span>•</span>
                        <span>Câu {qInfo.localQuestionNumber} / {qInfo.totalInPart}</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black">
                        Thang điểm: {q.points ?? 0.5} đ
                      </span>
                    </div>

                  {isSubmitted && (
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : (currentStudent?.questionScores?.[qIdx] || 0) > 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <i className="fa-solid fa-circle-check text-emerald-600"></i>
                          <span>Đạt +{q.points ?? 0.5} đ</span>
                        </>
                      ) : (currentStudent?.questionScores?.[qIdx] || 0) > 0 ? (
                        <>
                          <i className="fa-solid fa-circle-check text-amber-600"></i>
                          <span>Đạt +{currentStudent?.questionScores?.[qIdx]} / {q.points ?? 0.5} đ</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-circle-xmark text-red-600"></i>
                          <span>0 / {q.points ?? 0.5} đ</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Question Prompt Text (renders HTML like <br>, <b>) */}
                <div
                  className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: q.q || '' }}
                />

                {/* Media: Image */}
                {q.img && q.type !== 'listen-colour' && q.type !== 'fill-blanks' && (
                  <div className="flex justify-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <img
                      src={q.img}
                      alt={`Minh họa câu ${qIdx + 1}`}
                      className="max-h-60 object-contain rounded-lg"
                    />
                  </div>
                )}

                {/* Media: Audio / Listening Player Box */}
                {q.audio && (
                  <AudioPlayerBox
                    audio={q.audio}
                    maxPlayCount={q.maxPlayCount ?? 2}
                    autoPlay={q.autoPlayAudio}
                    isSubmitted={isSubmitted}
                    questionIndex={qIdx}
                    showToast={showToast}
                  />
                )}

                {/* Media: Video Player */}
                {q.video && (
                  <div className="aspect-video w-full max-w-xl mx-auto rounded-xl overflow-hidden border border-slate-200">
                    {q.video.includes('youtube.com') || q.video.includes('youtu.be') ? (
                      <iframe
                        src={q.video.replace('watch?v=', 'embed/')}
                        title="Video câu hỏi"
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : (
                      <video src={q.video} controls className="w-full h-full object-cover" />
                    )}
                  </div>
                )}

                {/* 1. Multiple Choice / Yes-No / Listening Answers */}
                {(q.type === 'multiple-choice' || q.type === 'yes-no' || q.type === 'listening') && (
                  <div className={`grid gap-3 pt-1 ${
                    q.type === 'yes-no' ? 'grid-cols-2 max-w-md' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {(q.options && q.options.length > 0
                      ? q.options
                      : q.type === 'yes-no'
                      ? [{ text: 'Yes', img: '' }, { text: 'No', img: '' }]
                      : []
                    ).map((op, optIdx) => {
                      const isSelected = userAnswers[qIdx] === optIdx;
                      const isYesNo = q.type === 'yes-no';
                      const isYesOpt = optIdx === 0 || op.text.trim().toLowerCase().startsWith('yes');
                      let btnCls = 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800';

                      if (isSubmitted) {
                        const isCorrectOption = optIdx === q.correctIndex;
                        if (isCorrectOption) {
                          btnCls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-black shadow-xs';
                        } else if (isSelected && !isCorrectOption) {
                          btnCls = 'border-red-500 bg-red-50 text-red-900 line-through';
                        }
                      } else if (isSelected) {
                        btnCls = isYesNo
                          ? (isYesOpt ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black ring-2 ring-emerald-400' : 'border-rose-600 bg-rose-50 text-rose-950 font-black ring-2 ring-rose-400')
                          : 'border-blue-600 bg-blue-50 text-blue-900 font-black ring-2 ring-blue-500/30';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => {
                            setUserAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                          }}
                          className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left font-bold text-sm transition flex flex-col justify-between gap-2 cursor-pointer shadow-xs ${btnCls}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isYesNo ? (
                              <span
                                className={`w-8 h-8 rounded-xl text-sm flex items-center justify-center font-black ${
                                  isSelected
                                    ? (isYesOpt ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')
                                    : (isYesOpt ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')
                                }`}
                              >
                                {isYesOpt ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-xmark"></i>}
                              </span>
                            ) : (
                              <span
                                className={`w-7 h-7 rounded-xl font-mono text-xs flex items-center justify-center font-extrabold ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                            )}
                            <span className={isYesNo ? 'text-base font-black uppercase' : 'text-sm'}>
                              {op.text || (isYesNo ? (isYesOpt ? 'YES' : 'NO') : `Phương án ${String.fromCharCode(65 + optIdx)}`)}
                            </span>
                          </div>
                          {op.img && (
                            <img
                              src={op.img}
                              alt="Minh họa"
                              className="max-h-24 rounded-lg object-contain mx-auto mt-1"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. Multi-choice (Multiple correct checkboxes) */}
                {q.type === 'multi-choice' && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-slate-500">
                      (Em có thể chọn nhiều hơn một đáp án đúng)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(q.options || []).map((op, optIdx) => {
                        const selectedList: number[] = userAnswers[qIdx] || [];
                        const isChecked = selectedList.includes(optIdx);

                        return (
                          <label
                            key={optIdx}
                            className={`p-3 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition ${
                              isChecked
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isSubmitted}
                              checked={isChecked}
                              onChange={(e) => {
                                let nextList: number[] = [];
                                if (e.target.checked) {
                                  nextList = [...selectedList, optIdx];
                                } else {
                                  nextList = selectedList.filter((x) => x !== optIdx);
                                }
                                setUserAnswers((prev) => ({ ...prev, [qIdx]: nextList }));
                              }}
                              className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-semibold">{op.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Fill-blanks Interactive Image Canvas */}
                {q.type === 'fill-blanks' && (
                  <div className="space-y-3 pt-1">
                    <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-pen-to-square"></i>
                      <span>Gõ chữ/từ cần điền trực tiếp vào các ô chữ nhật trên ảnh:</span>
                    </div>

                    <div className="stage max-w-2xl mx-auto shadow-md">
                      <div
                        className="canvas"
                        style={{
                          paddingTop: `${((q.fillBlanks?.height || 600) / (q.fillBlanks?.width || 1000)) * 100}%`,
                          backgroundImage: q.img ? `url("${q.img}")` : 'none'
                        }}
                      >
                        {(q.fillBlanks?.boxes || []).map((box, bIdx) => {
                          const W = q.fillBlanks?.width || 1000;
                          const H = q.fillBlanks?.height || 600;
                          const currentVal = (userAnswers[qIdx] && userAnswers[qIdx][bIdx]) || '';
                          const isBoxCorrect = box.answers.some(
                            (a) => a.trim().toLowerCase() === currentVal.trim().toLowerCase()
                          );

                          return (
                            <div
                              key={bIdx}
                              className="absolute"
                              style={{
                                left: `${(box.x / W) * 100}%`,
                                top: `${(box.y / H) * 100}%`,
                                width: `${(box.w / W) * 100}%`,
                                height: `${(box.h / H) * 100}%`
                              }}
                            >
                              <input
                                type="text"
                                disabled={isSubmitted}
                                value={currentVal}
                                onChange={(e) => {
                                  const prevBoxMap = userAnswers[qIdx] || {};
                                  setUserAnswers((prev) => ({
                                    ...prev,
                                    [qIdx]: { ...prevBoxMap, [bIdx]: e.target.value }
                                  }));
                                }}
                                placeholder={box.placeholder || '...'}
                                className={`w-full h-full text-center font-bold font-mono text-sm sm:text-base border-2 rounded-xl focus:outline-none shadow-md transition ${
                                  isSubmitted
                                    ? isBoxCorrect
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-black'
                                      : 'border-red-500 bg-red-50 text-red-800 font-black'
                                    : 'border-blue-500 bg-white/95 text-blue-900 focus:ring-2 focus:ring-blue-400'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {isSubmitted && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <strong>Đáp án đúng:</strong>{' '}
                        {(q.fillBlanks?.boxes || [])
                          .map((b, i) => `Ô #${i + 1}: [${b.answers.join(' hoặc ')}]`)
                          .join(' | ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Connect-pairs Interactive Canvas */}
                {q.type === 'connect-pairs' && (
                  <div className="space-y-3 pt-1">
                    {/* Status banner for example line if present */}
                    {(() => {
                      const ex =
                        q.connectPairs?.examplePair ||
                        (q.connectPairs?.pairs && q.connectPairs.pairs.length > 1 ? q.connectPairs.pairs[0] : null);
                      if (!ex) return null;
                      const pA = q.connectPairs?.points.find((p) => p.label === ex[0]);
                      const pB = q.connectPairs?.points.find((p) => p.label === ex[1]);
                      return (
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                              ★
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 font-black uppercase text-emerald-900">
                                <span>Đường nối ví dụ mẫu (Example):</span>
                                <span className="px-2 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">ĐÃ NỐI SẴN</span>
                              </div>
                              <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                                Cặp <strong className="underline text-emerald-950">{pA?.text || pA?.label}</strong> ➔ <strong className="underline text-emerald-950">{pB?.text || pB?.label}</strong> đã được nối sẵn trên tranh để hướng dẫn cách làm. Em hãy nối các cặp còn lại!
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-bezier-curve"></i>
                        <span>
                          Nhấn vào điểm thứ nhất rồi nhấn vào điểm thứ hai để nối đường kẻ:
                        </span>
                      </div>
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserAnswers((prev) => ({ ...prev, [qIdx]: [] }));
                            setActiveConnectPoint(null);
                          }}
                          className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Xóa tất cả đường nối của em
                        </button>
                      )}
                    </div>

                    <div className="stage max-w-2xl mx-auto shadow-md">
                      <div
                        className="canvas"
                        style={{
                          paddingTop: `${((q.connectPairs?.height || 420) / (q.connectPairs?.width || 700)) * 100}%`,
                          backgroundImage: q.img ? `url("${q.img}")` : 'none'
                        }}
                      >
                        <svg
                          className="cp-svg-layer"
                          viewBox={`0 0 ${q.connectPairs?.width || 700} ${q.connectPairs?.height || 420}`}
                        >
                          {/* Pre-connected Example Line */}
                          {(() => {
                            const exPair =
                              q.connectPairs?.examplePair ||
                              (q.connectPairs?.pairs && q.connectPairs.pairs.length > 1
                                ? q.connectPairs.pairs[0]
                                : null);
                            if (!exPair) return null;
                            const ptA = q.connectPairs?.points.find((p) => p.label === exPair[0]);
                            const ptB = q.connectPairs?.points.find((p) => p.label === exPair[1]);
                            if (!ptA || !ptB) return null;
                            const midX = (ptA.x + ptB.x) / 2;
                            const midY = (ptA.y + ptB.y) / 2;
                            const badgeText =
                              q.connectPairs?.examplePairLabel ||
                              `★ VÍ DỤ (EXAMPLE): ${ptA.text || ptA.label} ➔ ${ptB.text || ptB.label}`;

                            return (
                              <g key="example-pair-line">
                                {/* Outer ambient glow */}
                                <line
                                  x1={ptA.x}
                                  y1={ptA.y}
                                  x2={ptB.x}
                                  y2={ptB.y}
                                  stroke="#10b981"
                                  strokeWidth="10"
                                  strokeOpacity="0.35"
                                  strokeLinecap="round"
                                />
                                {/* Main dashed guide line */}
                                <line
                                  x1={ptA.x}
                                  y1={ptA.y}
                                  x2={ptB.x}
                                  y2={ptB.y}
                                  stroke="#047857"
                                  strokeWidth="4.5"
                                  strokeDasharray="9 6"
                                  strokeLinecap="round"
                                />
                                {/* Inner bright highlight line */}
                                <line
                                  x1={ptA.x}
                                  y1={ptA.y}
                                  x2={ptB.x}
                                  y2={ptB.y}
                                  stroke="#6ee7b7"
                                  strokeWidth="2"
                                  strokeDasharray="3 9"
                                  strokeLinecap="round"
                                />
                              </g>
                            );
                          })()}

                          {/* Student Answer Connected Lines */}
                          {((userAnswers[qIdx] as [string, string][]) || []).map((pair, pIdx) => {
                            const ptA = q.connectPairs?.points.find((p) => p.label === pair[0]);
                            const ptB = q.connectPairs?.points.find((p) => p.label === pair[1]);
                            if (!ptA || !ptB) return null;
                            return (
                              <line
                                key={pIdx}
                                x1={ptA.x}
                                y1={ptA.y}
                                x2={ptB.x}
                                y2={ptB.y}
                                stroke={isSubmitted ? (isCorrect ? '#16a34a' : '#dc2626') : (q.connectPairs?.defaultColor || '#2563eb')}
                                strokeWidth="4.5"
                                strokeLinecap="round"
                              />
                            );
                          })}
                        </svg>

                        {(q.connectPairs?.points || []).map((pt, pti) => {
                          const W = q.connectPairs?.width || 700;
                          const H = q.connectPairs?.height || 420;
                          const curEx =
                            q.connectPairs?.examplePair ||
                            (q.connectPairs?.pairs && q.connectPairs.pairs.length > 1
                              ? q.connectPairs.pairs[0]
                              : null);
                          const isExamplePoint =
                            curEx && (pt.label === curEx[0] || pt.label === curEx[1]);
                          const isCurrentActive =
                            activeConnectPoint?.qIdx === qIdx && activeConnectPoint?.label === pt.label;

                          return (
                            <button
                              key={pti}
                              type="button"
                              disabled={isSubmitted}
                              onClick={() => {
                                if (isSubmitted) return;
                                if (isExamplePoint) {
                                  showToast(`Điểm "${pt.text || pt.label}" là câu ví dụ mẫu đã được nối sẵn!`, 'info');
                                  return;
                                }
                                if (!activeConnectPoint || activeConnectPoint.qIdx !== qIdx) {
                                  setActiveConnectPoint({ qIdx, label: pt.label });
                                } else if (activeConnectPoint.label === pt.label) {
                                  setActiveConnectPoint(null);
                                } else {
                                  // Connect activeConnectPoint.label with pt.label
                                  const currentPairs: [string, string][] = (userAnswers[qIdx] as [string, string][]) || [];
                                  // Remove any existing pair that includes either of these points
                                  const filtered = currentPairs.filter(
                                    (p) =>
                                      p[0] !== activeConnectPoint.label &&
                                      p[1] !== activeConnectPoint.label &&
                                      p[0] !== pt.label &&
                                      p[1] !== pt.label
                                  );
                                  filtered.push([activeConnectPoint.label, pt.label]);
                                  setUserAnswers((prev) => ({ ...prev, [qIdx]: filtered }));
                                  setActiveConnectPoint(null);
                                }
                              }}
                              className={`absolute flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 border-2 shadow-md cursor-pointer transition select-none ${
                                isCurrentActive
                                  ? 'border-yellow-500 ring-4 ring-offset-2 ring-yellow-400 scale-110 z-20 shadow-xl'
                                  : isExamplePoint
                                  ? 'border-emerald-500 z-15 bg-white/95'
                                  : 'border-slate-200 hover:border-blue-500 hover:scale-105 z-10'
                              }`}
                              style={{
                                left: `${(pt.x / W) * 100}%`,
                                top: `${(pt.y / H) * 100}%`,
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              {/* Dot Anchor (Mặc định toàn bộ điểm cùng 1 màu để học sinh không đoán qua màu sắc) */}
                              <div
                                className="w-7 h-7 rounded-full text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0"
                                style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                              >
                                {pt.label}
                              </div>

                              {/* Attached Image Thumbnail */}
                              {pt.img && (
                                <img
                                  src={pt.img}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white shrink-0 pointer-events-none"
                                />
                              )}

                              {/* Attached Text / Word */}
                              {pt.text && (
                                <span className="font-extrabold text-xs sm:text-sm text-slate-800 px-1 truncate max-w-[150px] pointer-events-none">
                                  {pt.text}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {isSubmitted && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <strong>Các cặp đúng:</strong>{' '}
                        {(q.connectPairs?.pairs || []).map((p) => `${p[0]} ↔ ${p[1]}`).join('  |  ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Tick-cross (Cambridge Look and Read: Put a tick or a cross in the box) */}
                {q.type === 'tick-cross' && (
                  <div className="space-y-4 pt-2">
                    <div className="border-2 border-dashed border-slate-400 bg-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                      {/* Left: Illustration Image if present */}
                      {q.img && (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          <img
                            src={q.img}
                            alt=""
                            className="max-w-full max-h-full object-contain pointer-events-none"
                          />
                        </div>
                      )}

                      {/* Middle: Statement Text */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Câu miêu tả hình ảnh:
                        </div>
                        <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                          {q.q.replace(/<[^>]*>/g, '').replace(/^\d+[\.\)]\s*/, '')}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic">
                          Bấm vào ô vuông hoặc chọn nút Tick / Cross bên dưới:
                        </p>
                      </div>

                      {/* Right: Cambridge Square Answer Box [   ] */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => {
                            if (isSubmitted) return;
                            const cur = userAnswers[qIdx];
                            if (cur === undefined || cur === null) {
                              setUserAnswers((prev) => ({ ...prev, [qIdx]: true }));
                            } else if (cur === true) {
                              setUserAnswers((prev) => ({ ...prev, [qIdx]: false }));
                            } else {
                              setUserAnswers((prev) => ({ ...prev, [qIdx]: null }));
                            }
                          }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-2xl flex items-center justify-center font-black text-3xl sm:text-4xl transition select-none cursor-pointer shadow-sm ${
                            userAnswers[qIdx] === true
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/25'
                              : userAnswers[qIdx] === false
                              ? 'border-rose-600 bg-rose-50 text-rose-700 ring-4 ring-rose-500/25'
                              : 'border-slate-800 bg-white hover:bg-slate-100 hover:border-indigo-600 text-slate-400'
                          } ${
                            isSubmitted
                              ? isCorrect
                                ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                                : 'border-red-600 bg-red-100 text-red-800'
                              : ''
                          }`}
                          title="Bấm để đánh dấu Tick (✓) hoặc Cross (X)"
                        >
                          {userAnswers[qIdx] === true ? (
                            <span>✓</span>
                          ) : userAnswers[qIdx] === false ? (
                            <span>X</span>
                          ) : (
                            <span className="text-slate-300 text-xl font-normal opacity-40">?</span>
                          )}
                        </button>
                        <span className="text-xs font-bold text-slate-500">
                          {userAnswers[qIdx] === true ? '✓ Tick (Đúng)' : userAnswers[qIdx] === false ? 'X Cross (Sai)' : 'Ô trống'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Button Selectors */}
                    <div className="flex items-center justify-center gap-4">
                      {/* Tick Button ✔ */}
                      <button
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => setUserAnswers((prev) => ({ ...prev, [qIdx]: true }))}
                        className={`flex-1 max-w-[200px] py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition cursor-pointer select-none font-black text-sm ${
                          userAnswers[qIdx] === true
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-md scale-105'
                            : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        <span className="text-lg">✓</span>
                        <span>TICK (Đúng)</span>
                      </button>

                      {/* Cross Button ✘ */}
                      <button
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => setUserAnswers((prev) => ({ ...prev, [qIdx]: false }))}
                        className={`flex-1 max-w-[200px] py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition cursor-pointer select-none font-black text-sm ${
                          userAnswers[qIdx] === false
                            ? 'border-rose-600 bg-rose-600 text-white shadow-md scale-105'
                            : 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900'
                        }`}
                      >
                        <span className="text-lg">X</span>
                        <span>CROSS (Sai)</span>
                      </button>

                      {typeof userAnswers[qIdx] === 'boolean' && !isSubmitted && (
                        <button
                          type="button"
                          onClick={() => setUserAnswers((prev) => ({ ...prev, [qIdx]: null }))}
                          className="text-xs text-slate-500 hover:text-slate-800 underline font-bold"
                        >
                          Xóa chọn
                        </button>
                      )}
                    </div>

                    {isSubmitted && (
                      <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center font-bold">
                        Đáp án đúng: <span className={q.isTick ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                          [ {q.isTick ? '✓ TICK (Đúng với hình)' : 'X CROSS (Sai so với hình)'} ]
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Listen & Write (Name or number) */}
                {q.type === 'listen-write' && (
                  <div className="space-y-3 pt-2 max-w-lg mx-auto">
                    <label className="block text-xs font-bold text-slate-600">
                      Điền tên (name) hoặc số (number) nghe được:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isSubmitted}
                        value={userAnswers[qIdx] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUserAnswers((prev) => ({ ...prev, [qIdx]: val }));
                        }}
                        placeholder="Nhập câu trả lời (ví dụ: May, 6, Ben, 2)..."
                        className={`w-full px-4 py-3 text-lg font-bold text-center border-2 rounded-2xl focus:outline-none transition ${
                          isSubmitted
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-black'
                              : 'border-red-500 bg-red-50 text-red-900 font-black'
                            : 'border-blue-300 focus:border-blue-600 bg-white'
                        }`}
                      />
                    </div>
                    {isSubmitted && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                        <strong>Đáp án chấp nhận:</strong>{' '}
                        <span className="font-bold text-emerald-700">{(q.acceptableAnswers || []).join(' / ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Unscramble Word (Letters anagram builder) */}
                {q.type === 'unscramble-word' && (() => {
                  const target = (q.unscramble?.targetWord || q.unscrambleTarget || q.answerText || (q.acceptableAnswers && q.acceptableAnswers[0]) || '').trim();
                  const cleanTarget = target.toLowerCase();
                  const targetChars = target.toUpperCase().split('');
                  const letters = (q.unscramble?.scrambledLetters && q.unscramble.scrambledLetters.length > 0)
                    ? q.unscramble.scrambledLetters
                    : (target ? target.split('').sort(() => 0.5 - Math.random()) : ['d', 'u', 'c', 'k']);
                  const isExampleQ = Boolean(q.isExample || isQuestionExample(q, qPart));
                  const currentWord = isExampleQ ? cleanTarget : String(userAnswers[qIdx] || '');

                  if (isExampleQ) {
                    return (
                      <div className="space-y-3.5 pt-2 max-w-xl mx-auto text-center animate-in fade-in">
                        {/* Example Badge */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-950 font-black text-xs uppercase shadow-2xs">
                          <i className="fa-solid fa-circle-check text-emerald-600"></i>
                          <span>CÂU VÍ DỤ MẪU (EXAMPLE) • 0 ĐIỂM</span>
                        </div>

                        {/* Scrambled Letters of the Example */}
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Các chữ cái xáo trộn (Scrambled letters):
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-2xl bg-amber-50/90 border border-amber-300">
                            {letters.map((char, charIdx) => (
                              <span
                                key={charIdx}
                                className="w-11 h-11 rounded-xl bg-white border-2 border-amber-400 font-mono font-black text-xl text-amber-950 shadow-xs flex items-center justify-center uppercase select-none"
                              >
                                {char}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <div className="flex items-center justify-center gap-2 text-emerald-700 font-black text-xs sm:text-sm">
                          <i className="fa-solid fa-arrow-down"></i>
                          <span>Từ tiếng Anh mục tiêu đúng đã được ghép mẫu:</span>
                          <i className="fa-solid fa-arrow-down"></i>
                        </div>

                        {/* Completed Assembled Target Word in green letter tiles */}
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 shadow-sm space-y-2">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {targetChars.map((char, cIdx) => (
                              <span
                                key={cIdx}
                                className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-mono font-black text-2xl flex items-center justify-center uppercase shadow-md border-2 border-emerald-700 select-none animate-in zoom-in-75 duration-200"
                              >
                                {char}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-center gap-2 text-xs font-black text-emerald-900 pt-1">
                            <span className="bg-white px-3 py-1 rounded-full border border-emerald-300 shadow-2xs">
                              Đáp án mẫu: <strong className="font-mono text-sm tracking-wider text-emerald-700">{target.toUpperCase()}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-amber-900 bg-amber-100/70 p-2.5 rounded-xl border border-amber-300 text-center font-medium leading-relaxed">
                          💡 <strong>Hướng dẫn:</strong> Đây là câu ví dụ mẫu (không tính điểm). Em quan sát cách ghép từ các chữ cái xáo trộn thành từ tiếng Anh mục tiêu đúng <strong>"{target.toUpperCase()}"</strong> ở trên để làm các câu thi tiếp theo.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4 pt-2 max-w-xl mx-auto text-center">
                      <div className="text-xs font-bold text-slate-600">
                        Bấm vào các ô chữ cái bên dưới để ghép thành từ tiếng Anh đúng (hoặc gõ trực tiếp):
                      </div>

                      {/* Scrambled Letter Badges */}
                      <div className="flex flex-wrap items-center justify-center gap-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200">
                        {letters.map((char, charIdx) => (
                          <button
                            key={charIdx}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => {
                              if (isSubmitted) return;
                              setUserAnswers((prev) => ({
                                ...prev,
                                [qIdx]: currentWord + char.toLowerCase()
                              }));
                            }}
                            className="w-12 h-12 rounded-xl bg-white hover:bg-amber-100 border-2 border-amber-400 font-mono font-black text-2xl text-amber-950 shadow-sm transition active:scale-90 hover:scale-105 cursor-pointer flex items-center justify-center uppercase"
                          >
                            {char}
                          </button>
                        ))}
                      </div>

                      {/* Input / Assembled word with Clear button */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={isSubmitted}
                          value={currentWord}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase();
                            setUserAnswers((prev) => ({ ...prev, [qIdx]: val }));
                          }}
                          placeholder="Bấm chữ hoặc gõ từ ghép..."
                          className={`flex-1 px-4 py-3 text-xl font-mono font-black text-center uppercase tracking-widest border-2 rounded-2xl focus:outline-none transition ${
                            isSubmitted
                              ? isCorrect
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                : 'border-red-500 bg-red-50 text-red-900'
                              : 'border-blue-400 focus:border-blue-600 bg-white'
                          }`}
                        />
                        {!isSubmitted && currentWord.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserAnswers((prev) => ({
                                ...prev,
                                [qIdx]: currentWord.slice(0, -1)
                              }));
                            }}
                            title="Xóa ký tự cuối"
                            className="px-3.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
                          >
                            <i className="fa-solid fa-delete-left text-lg"></i>
                          </button>
                        )}
                        {!isSubmitted && currentWord.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserAnswers((prev) => ({ ...prev, [qIdx]: '' }));
                            }}
                            title="Xóa hết"
                            className="px-3.5 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs cursor-pointer"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      {/* Feedback when submitted */}
                      {isSubmitted && (
                        <div className={`p-3 rounded-xl border text-xs font-bold ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="flex items-center gap-1.5 font-black">
                              <i className={`fa-solid ${isCorrect ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}`}></i>
                              <span>{isCorrect ? 'Chính xác! (+ ' + (q.points ?? 0.25) + 'đ)' : 'Chưa đúng (0đ)'}</span>
                            </span>
                            <span>
                              Từ tiếng Anh mục tiêu (Đáp án đúng):{' '}
                              <strong className="font-mono text-sm uppercase tracking-wider text-emerald-700">
                                {target.toUpperCase()}
                              </strong>
                            </span>
                          </div>
                          {!isCorrect && currentWord && (
                            <div className="text-[11px] text-slate-500 pt-1 text-left">
                              Em đã ghép: <strong className="font-mono uppercase text-rose-700">{currentWord}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 8. Story Word Bank (Cloze with Word Bank & Pictures) */}
                {q.type === 'story-word-bank' && (() => {
                  const storyBank = q.storyBank;
                  const currentAnswers: Record<string, string> = userAnswers[qIdx] || {};
                  const activeSlot = activeStorySlots[qIdx] || '1';
                  const words = storyBank?.words || [];
                  const correctAnswers = storyBank?.answers || {};
                  const testSlots = Object.keys(correctAnswers).filter((k) => k !== '0');
                  const qPoints = q.points ?? 1.0;
                  const pointPerWord = testSlots.length > 0 ? (qPoints / testSlots.length).toFixed(2) : '0.25';

                  return (
                    <div className="space-y-5 pt-2">
                      {/* Visual Word Bank Cards */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
                        <div className="text-xs font-bold text-sky-900 flex items-center justify-between flex-wrap gap-2">
                          <span className="flex items-center gap-1.5">
                            <i className="fa-solid fa-layer-group text-sky-600"></i>
                            <span>Ngân hàng từ vựng kèm hình ảnh (Bấm chọn ô trống rồi bấm từ để điền):</span>
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-sky-800 font-extrabold border border-sky-200 shadow-2xs">
                            Đang điền cho ô: <strong className="text-blue-700">({activeSlot})</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                          {words.map((wItem) => {
                            const isEx =
                              storyBank?.example?.word === wItem.word ||
                              correctAnswers['0'] === wItem.word;
                            const matchingSlot = Object.entries(correctAnswers).find(
                              ([k, v]) => v.toLowerCase() === wItem.word.toLowerCase()
                            )?.[0];
                            const wordImg =
                              wItem.img ||
                              (matchingSlot ? storyBank?.answerImages?.[matchingSlot] : undefined) ||
                              (isEx ? storyBank?.example?.img || storyBank?.answerImages?.['0'] : undefined);

                            return (
                              <button
                                key={wItem.id}
                                type="button"
                                disabled={isSubmitted || isEx}
                                onClick={() => {
                                  if (isSubmitted || isEx) return;
                                  setUserAnswers((prev) => {
                                    const prevMap = prev[qIdx] || {};
                                    return {
                                      ...prev,
                                      [qIdx]: { ...prevMap, [activeSlot]: wItem.word }
                                    };
                                  });
                                  // Auto-advance to next empty slot
                                  const nextSlot = testSlots.find((s) => s !== activeSlot && !currentAnswers[s]);
                                  if (nextSlot) {
                                    setActiveStorySlots((prev) => ({ ...prev, [qIdx]: nextSlot }));
                                  }
                                }}
                                className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-2 transition text-center select-none cursor-pointer shadow-xs ${
                                  isEx
                                    ? 'border-slate-300 bg-slate-100 opacity-60 cursor-not-allowed'
                                    : 'border-sky-300 bg-white hover:border-blue-600 hover:shadow-md hover:scale-[1.02] active:scale-95'
                                }`}
                              >
                                {wordImg ? (
                                  <img
                                    src={wordImg}
                                    alt={wItem.word}
                                    className="h-16 w-16 object-contain rounded-xl bg-white border border-slate-200 p-1 shadow-2xs"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-xl bg-sky-100/60 border border-sky-200 flex items-center justify-center text-sky-500 text-xl">
                                    <i className="fa-solid fa-font"></i>
                                  </div>
                                )}
                                <span className="font-mono font-black text-sm text-slate-800 tracking-wide">
                                  {wItem.word}
                                </span>
                                {isEx && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                                    (0) Ví dụ
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Story Text Box with dynamic gap parsing */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-slate-200 shadow-sm leading-relaxed text-sm sm:text-base font-medium space-y-4">
                        {storyBank?.title && (
                          <h4 className="text-base sm:text-lg font-black text-slate-900 border-b pb-2 flex items-center gap-2">
                            <span>📖</span>
                            <span>{storyBank.title}</span>
                          </h4>
                        )}

                        {(() => {
                          const rawStory =
                            storyBank?.story ||
                            "Today is Ben's (0) birthday party. He is having a party at the beach. Everyone is sitting by the (1) _______. His friends are (2) _______ a song for him. At the party, they eat cake and (3) _______. One boy says “Look! I can see a (4) _______.”";

                          // Tokenize by (0), (1), (2), (3), (4)...
                          const tokens = rawStory.split(/(\(\d+\)(?:\s*_{2,})?)/g);

                          return (
                            <div className="text-slate-800 leading-loose text-sm sm:text-base">
                              {tokens.map((token, tIdx) => {
                                const match = token.match(/\((\d+)\)/);
                                if (!match) {
                                  return <span key={tIdx}>{token}</span>;
                                }

                                const slotNum = match[1];

                                // 1. Example Slot (0)
                                if (slotNum === '0') {
                                  const exWord = storyBank?.example?.word || correctAnswers['0'] || 'birthday';
                                  const exImg = storyBank?.example?.img || storyBank?.answerImages?.['0'];

                                  return (
                                    <span
                                      key={tIdx}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 mx-1.5 rounded-xl bg-slate-100 border-2 border-slate-300 font-black text-slate-900 shadow-2xs select-none align-middle"
                                      title="Câu ví dụ mẫu đã được điền sẵn"
                                    >
                                      {exImg && <img src={exImg} alt="" className="w-5 h-5 object-contain rounded" />}
                                      <span className="font-mono text-slate-500 text-xs">(0)</span>
                                      <span className="underline decoration-2 decoration-slate-400 font-extrabold">{exWord}</span>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                        Ví dụ
                                      </span>
                                    </span>
                                  );
                                }

                                // 2. Test Slots (1), (2), (3), (4)...
                                const userVal = currentAnswers[slotNum];
                                const correctVal = correctAnswers[slotNum];
                                const isSlotCorrect =
                                  isSubmitted &&
                                  userVal &&
                                  correctVal &&
                                  userVal.trim().toLowerCase() === correctVal.trim().toLowerCase();
                                const isSlotWrong =
                                  isSubmitted &&
                                  (!userVal || userVal.trim().toLowerCase() !== correctVal?.trim().toLowerCase());

                                return (
                                  <span
                                    key={tIdx}
                                    onClick={() => !isSubmitted && setActiveStorySlots((prev) => ({ ...prev, [qIdx]: slotNum }))}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 mx-1.5 my-1 rounded-xl border-2 font-black cursor-pointer transition select-none shadow-2xs align-middle ${
                                      activeSlot === slotNum && !isSubmitted
                                        ? 'border-blue-600 ring-2 ring-blue-400 bg-blue-50 text-blue-950 scale-105'
                                        : 'border-slate-300 bg-slate-50 hover:bg-white text-slate-800'
                                    } ${
                                      isSlotCorrect
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400'
                                        : isSlotWrong
                                        ? 'border-red-500 bg-red-50 text-red-950 ring-1 ring-red-400'
                                        : ''
                                    }`}
                                  >
                                    <span className="font-mono text-xs opacity-70">({slotNum})</span>
                                    {userVal ? (
                                      <span className="underline font-black text-blue-900">{userVal}</span>
                                    ) : (
                                      <span className="text-slate-400 font-mono tracking-widest">______</span>
                                    )}
                                    {isSlotCorrect && <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>}
                                    {isSlotWrong && (
                                      <span className="text-xs text-red-700 flex items-center gap-1">
                                        <i className="fa-solid fa-circle-xmark text-red-500"></i>
                                        <span className="text-[11px] font-bold bg-white px-1.5 py-0.5 rounded border border-red-300 text-emerald-800">
                                          Đáp án: {correctVal}
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Score Result Breakdown when submitted */}
                      {isSubmitted && (() => {
                        const correctCount = testSlots.filter(
                          (k) => String(currentAnswers[k] || '').trim().toLowerCase() === correctAnswers[k]?.trim().toLowerCase()
                        ).length;
                        const earnedScore =
                          testSlots.length > 0 ? +((correctCount / testSlots.length) * qPoints).toFixed(2) : qPoints;

                        return (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 shadow-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-black text-sm text-slate-900">
                                Kết quả câu {qIdx + 1}:{' '}
                                <span className="text-emerald-700 text-base">
                                  {earnedScore} / {qPoints} điểm
                                </span>
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-200">
                                Đúng {correctCount}/{testSlots.length} từ ({pointPerWord}đ / mỗi từ đúng)
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 font-mono flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                                (0) Ví dụ: <strong>{storyBank?.example?.word || correctAnswers['0'] || 'birthday'}</strong>
                              </span>
                              {testSlots.map((k) => (
                                <span key={k} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800">
                                  ({k}): <strong className="text-emerald-800">{correctAnswers[k]}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* 9. Listen & Colour (Cambridge Listen and colour on picture) */}
                {q.type === 'listen-colour' && (
                  <ListenColourPlayer
                    question={q}
                    questionIndex={qIdx}
                    userAnswer={userAnswers[qIdx] || {}}
                    onChangeAnswer={(ans) => setUserAnswers((prev) => ({ ...prev, [qIdx]: ans }))}
                    isSubmitted={isSubmitted}
                  />
                )}
              </div>
            </React.Fragment>
          );
        })}
        </div>
      </div>

      {/* 2. FIXED BOTTOM: Horizontal Question Palette (always visible on scroll) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-slate-300 shadow-2xl transition-all duration-300">
        <div className="w-full px-3 sm:px-6 py-2">
          {/* Bar Controls Row */}
          <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                <i className="fa-solid fa-list-check"></i>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  Danh sách câu hỏi
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-black">
                  Đã làm: {answeredCount}/{listeningQuestions.length + readingWritingQuestions.length}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2 w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      (answeredCount / ((listeningQuestions.length + readingWritingQuestions.length) || 1)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Switcher */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tất cả câu
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'single' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Từng câu
                </button>
              </div>

              {/* Submit & Retry Buttons */}
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className={`py-1.5 px-3.5 sm:px-4 rounded-xl font-black text-xs sm:text-sm shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    unansweredQuestionsCount > 0 && !isTestRun
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25 ring-1 ring-amber-300'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/30 ring-2 ring-emerald-300/50'
                  }`}
                  title={
                    unansweredQuestionsCount > 0 && !isTestRun
                      ? `Còn ${unansweredQuestionsCount} câu chưa trả lời. Bắt buộc hoàn thành tất cả mới được nộp bài.`
                      : 'Đã hoàn thành toàn bộ câu hỏi. Nhấn để nộp bài và lưu điểm.'
                  }
                >
                  <i className={`fa-solid ${unansweredQuestionsCount > 0 && !isTestRun ? 'fa-lock' : 'fa-paper-plane'}`}></i>
                  <span>
                    {unansweredQuestionsCount > 0 && !isTestRun
                      ? `Nộp Bài (Còn ${unansweredQuestionsCount}c)`
                      : 'Nộp Bài Thi'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setUserAnswers({});
                    setRemainingSeconds(examMinutes * 60);
                    setCurrentQuestionIndex(0);
                    showToast('Bắt đầu làm lại đề thi!');
                  }}
                  className="py-1 px-3 rounded-xl bg-slate-900 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  <span>Làm lại</span>
                </button>
              )}

              {/* Collapse / Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsPaletteCollapsed(!isPaletteCollapsed)}
                className="p-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                title={isPaletteCollapsed ? 'Mở rộng danh sách câu hỏi' : 'Thu gọn danh sách câu hỏi'}
              >
                <span className="hidden sm:inline text-[11px] font-semibold">{isPaletteCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
                <i className={`fa-solid ${isPaletteCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>
            </div>
          </div>

          {/* Horizontal Question Groups by Section */}
          {!isPaletteCollapsed && (
            <div className="pt-1.5 flex items-stretch gap-3 overflow-x-auto pb-1 max-w-full scrollbar-thin">
              {/* Section 1: LISTENING */}
              {listeningParts.length > 0 && (
                <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center gap-2.5 shrink-0">
                  <div className="border-r border-blue-200/80 pr-2 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] font-black text-blue-900 whitespace-nowrap">
                      <i className="fa-solid fa-headphones text-blue-600"></i>
                      <span>1. LISTENING</span>
                    </div>
                    <div className="text-[10px] text-blue-700 font-bold whitespace-nowrap">
                      {listeningQuestions.length} câu • {listeningPartPoints.toFixed(1)}đ
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {listeningParts.map(({ p, idx: globalPIdx }) => {
                      const partQuestions = questions
                        .map((q, idx) => ({ q, idx }))
                        .filter((item) => (item.q.partId || parts[0]?.id) === p.id && !isQuestionExample(item.q, p));

                      if (partQuestions.length === 0) return null;

                      return (
                        <div key={p.id} className="flex items-center gap-1.5 bg-white/80 px-2 py-1 rounded-lg border border-blue-100 shrink-0">
                          <span className="text-[10px] font-black text-blue-800 whitespace-nowrap">
                            Part {globalPIdx + 1} ({p.points}đ):
                          </span>
                          <div className="flex items-center gap-1">
                            {partQuestions.map(({ idx: qIdx }, pQIdx) => {
                              const answered = isAnswered(qIdx);
                              const isCurrent = viewMode === 'single' && qIdx === currentQuestionIndex;
                              let styleCls = 'bg-white text-blue-900 hover:bg-blue-100 border-blue-200';

                              if (isSubmitted) {
                                const correct = isQuestionCorrect(qIdx);
                                styleCls = correct
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-red-500 text-white border-red-500';
                              } else if (answered) {
                                styleCls = 'bg-blue-600 text-white border-blue-600 shadow-xs';
                              }

                              if (isCurrent) {
                                styleCls += ' ring-2 ring-offset-1 ring-blue-500 font-black scale-105';
                              }

                              return (
                                <button
                                  key={qIdx}
                                  type="button"
                                  onClick={() => {
                                    setCurrentQuestionIndex(qIdx);
                                    if (viewMode === 'all') {
                                      const el = document.getElementById(`student-qcard-${qIdx}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className={`w-7 h-7 rounded-lg font-black text-xs border transition cursor-pointer flex items-center justify-center select-none ${styleCls}`}
                                  title={`Part ${globalPIdx + 1} - Câu ${pQIdx + 1} (${p.title})`}
                                >
                                  {pQIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: READING & WRITING */}
              {readingWritingParts.length > 0 && (
                <div className="p-2 rounded-xl bg-teal-50/70 border border-teal-200/80 flex items-center gap-2.5 shrink-0">
                  <div className="border-r border-teal-200/80 pr-2 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] font-black text-teal-900 whitespace-nowrap">
                      <i className="fa-solid fa-book-open text-teal-600"></i>
                      <span>2. READING & WRITING</span>
                    </div>
                    <div className="text-[10px] text-teal-700 font-bold whitespace-nowrap">
                      {readingWritingQuestions.length} câu • {readingWritingPartPoints.toFixed(1)}đ
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {readingWritingParts.map(({ p, idx: globalPIdx }) => {
                      const partQuestions = questions
                        .map((q, idx) => ({ q, idx }))
                        .filter((item) => (item.q.partId || parts[0]?.id) === p.id && !isQuestionExample(item.q, p));

                      if (partQuestions.length === 0) return null;

                      return (
                        <div key={p.id} className="flex items-center gap-1.5 bg-white/80 px-2 py-1 rounded-lg border border-teal-100 shrink-0">
                          <span className="text-[10px] font-black text-teal-800 whitespace-nowrap">
                            Part {globalPIdx + 1} ({p.points}đ):
                          </span>
                          <div className="flex items-center gap-1">
                            {partQuestions.map(({ idx: qIdx }, pQIdx) => {
                              const answered = isAnswered(qIdx);
                              const isCurrent = viewMode === 'single' && qIdx === currentQuestionIndex;
                              let styleCls = 'bg-white text-teal-900 hover:bg-teal-100 border-teal-200';

                              if (isSubmitted) {
                                const correct = isQuestionCorrect(qIdx);
                                styleCls = correct
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-red-500 text-white border-red-500';
                              } else if (answered) {
                                styleCls = 'bg-teal-700 text-white border-teal-700 shadow-xs';
                              }

                              if (isCurrent) {
                                styleCls += ' ring-2 ring-offset-1 ring-teal-500 font-black scale-105';
                              }

                              return (
                                <button
                                  key={qIdx}
                                  type="button"
                                  onClick={() => {
                                    setCurrentQuestionIndex(qIdx);
                                    if (viewMode === 'all') {
                                      const el = document.getElementById(`student-qcard-${qIdx}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className={`w-7 h-7 rounded-lg font-black text-xs border transition cursor-pointer flex items-center justify-center select-none ${styleCls}`}
                                  title={`Part ${globalPIdx + 1} - Câu ${pQIdx + 1} (${p.title})`}
                                >
                                  {pQIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL: Cảnh báo chưa hoàn thành tất cả các câu hỏi */}
      {showIncompleteModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-300 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shrink-0">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Chưa Thể Nộp Bài Thi</h3>
                  <p className="text-xs font-semibold text-amber-700">Quy định: Bắt buộc hoàn thành 100% câu hỏi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIncompleteModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
              <p className="font-bold">
                Em bắt buộc phải trả lời hết tất cả các câu hỏi của đề thi mới được phép nộp bài.
              </p>
              <div className="flex items-center justify-between text-xs font-black pt-1 border-t border-amber-200">
                <span>Số câu em chưa làm:</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-mono text-sm">
                  {showIncompleteModal.unansweredCount} câu
                </span>
              </div>
            </div>

            {/* Quick Jump List of unanswered questions */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-600">
                Bấm vào câu bên dưới để làm tiếp ngay:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                {showIncompleteModal.unansweredIndices.map((qIdx) => {
                  const q = questions[qIdx];
                  const qInfo = getQuestionPartAndIndex(q, qIdx, questions, parts);
                  return (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => {
                        setShowIncompleteModal(null);
                        setCurrentQuestionIndex(qIdx);
                        if (viewMode === 'all') {
                          const el = document.getElementById(`student-qcard-${qIdx}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-slate-800 hover:text-blue-700 font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>Part {qInfo.partDisplayNumber} - Câu #{qInfo.localQuestionNumber}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-blue-500"></i>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowIncompleteModal(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstUnanswered = showIncompleteModal.unansweredIndices[0];
                  setShowIncompleteModal(null);
                  if (typeof firstUnanswered === 'number') {
                    setCurrentQuestionIndex(firstUnanswered);
                    if (viewMode === 'all') {
                      const el = document.getElementById(`student-qcard-${firstUnanswered}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-pencil"></i>
                <span>Làm tiếp câu chưa trả lời</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: Nộp bài thành công, chấm điểm đã lưu & Tự động thoát ra màn hình đăng nhập */}
      {isSubmitted && !isTestRun && logoutCountdown !== null && currentStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-emerald-400 space-y-5 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-4xl mx-auto shadow-xl shadow-emerald-500/30">
              <i className="fa-solid fa-circle-check"></i>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                Đã Lưu Điểm & Bài Thi Thành Công
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                CHÚC MỪNG EM ĐÃ HOÀN THÀNH!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Thí sinh: <strong>{currentStudent.name}</strong> • Lớp: <strong>{currentStudent.className}</strong> (ID: {currentStudent.id})
              </p>
            </div>

            {/* Score Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-300 space-y-2">
              <div className="text-xs uppercase tracking-wider font-extrabold text-emerald-800">
                Kết Quả Chấm Điểm
              </div>
              <div className="text-4xl sm:text-5xl font-black text-emerald-600 font-mono">
                {submissionResults?.totalEarnedPoints} <span className="text-2xl sm:text-3xl font-bold text-slate-500">/ {submissionResults?.maxExamPoints} đ</span>
              </div>
              <div className="text-sm font-bold text-slate-700">
                Quy đổi: <strong className="text-emerald-700">{submissionResults?.pts10} / 10 điểm</strong> • Đúng <strong className="text-emerald-700">{submissionResults?.totalQuestionsCorrect}/{questions.filter((q) => !q.isExample).length} câu</strong>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-left text-xs text-blue-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-blue-950">
                <i className="fa-solid fa-database text-blue-600"></i>
                <span>Toàn bộ kết quả và chi tiết câu trả lời đã được lưu vào hệ thống.</span>
              </div>
              <div className="text-blue-700 font-semibold">
                Máy tính sẽ tự động thoát bài thi và quay về màn hình đăng nhập để học sinh tiếp theo làm bài sau:
              </div>
              <div className="text-center pt-1 font-mono text-xl font-black text-blue-800">
                ⏳ {logoutCountdown} giây...
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLogoutCountdown(null);
                  showToast('Đang mở chế độ xem lại bài làm — câu sai được đánh dấu đỏ để em kiểm tra.', 'info');
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-2 border-cyan-300 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>Xem lại câu đúng / sai</span>
              </button>
              <button
                type="button"
                onClick={() => onLogoutStudent()}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Thoát Ngay ({logoutCountdown}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
