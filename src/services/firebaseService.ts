import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  auth,
  checkCloudConnectionStatus,
  CloudConnectionHealth,
  db,
  firebaseConfig,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  ExamPart,
  GradeExamProfile,
  PartScoreRecord,
  Question,
  SectionScoreRecord,
  Student,
  Teacher,
  TeacherPermission,
} from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'lantanan26@gmail.com';
const EXAM_META_TIMESTAMPS_KEY = 'ismart_cloud_exam_timestamps';

export const FIRESTORE_CONSOLE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;
export const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export { checkCloudConnectionStatus };
export type { CloudConnectionHealth };

const NESTED_ARRAY_KEY = '__fsArr';

function isPlainObject(val: unknown): val is Record<string, any> {
  if (typeof val !== 'object' || val === null) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/**
 * Encodes data cleanly for Firestore:
 * - Strips `undefined` values (Firestore rejects `undefined`)
 * - Preserves Firestore FieldValues like `serverTimestamp()`
 * - Converts nested arrays (e.g. connectPairs.pairs `[['A','B']]`) into native Firestore Map wrappers `{ __fsArr: [...] }`
 *   because Firestore strictly forbids arrays directly inside arrays (without using JSON.stringify).
 */
export function encodeForFirestore<T>(obj: T, insideArray = false): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    const mapped = obj.map((item) => encodeForFirestore(item, true));
    if (insideArray) {
      return { [NESTED_ARRAY_KEY]: mapped } as unknown as T;
    }
    return mapped as unknown as T;
  }

  if (isPlainObject(obj)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        out[String(k)] = encodeForFirestore(v, false);
      }
    }
    return out as T;
  }

  return obj;
}

export const sanitizeForFirestore = encodeForFirestore;

/**
 * Decodes Firestore documents back into client TypeScript shapes,
 * unwrapping `{ __fsArr: [...] }` back to native nested JS arrays seamlessly.
 */
export function decodeFromFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => decodeFromFirestore(item)) as unknown as T;
  }

  if (isPlainObject(obj)) {
    const record = obj as Record<string, any>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === NESTED_ARRAY_KEY && Array.isArray(record[NESTED_ARRAY_KEY])) {
      return decodeFromFirestore(record[NESTED_ARRAY_KEY]) as unknown as T;
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = decodeFromFirestore(v);
    }
    return out as T;
  }

  return obj;
}

/**
 * Compresses large data:image/... strings so Firestore documents stay well under 1 MiB
 * and consume minimal Spark free-tier storage & bandwidth.
 */
async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 900,
  quality = 0.72,
  targetMaxChars = 140_000
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < targetMaxChars) {
    return dataUrl;
  }
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }
  if (typeof document === 'undefined') return dataUrl;

  const tryCompress = (w: number, q: number): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = img.width > w ? w / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', q);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  let result = await tryCompress(maxWidth, quality);
  if (result.length > targetMaxChars) {
    result = await tryCompress(Math.round(maxWidth * 0.65), Math.max(0.45, quality - 0.2));
  }
  if (result.length > targetMaxChars * 1.8) {
    result = await tryCompress(Math.round(maxWidth * 0.45), 0.42);
  }
  return result;
}

async function compressQuestionMedia(
  q: Question,
  maxWidth = 880,
  quality = 0.7,
  targetMaxChars = 130_000
): Promise<Question> {
  const cloned: Question = { ...q };
  if (cloned.img) {
    cloned.img = await compressImageDataUrl(cloned.img, maxWidth, quality, targetMaxChars);
  }
  if (Array.isArray(cloned.options)) {
    cloned.options = await Promise.all(
      cloned.options.map(async (opt) => ({
        ...opt,
        img: opt.img
          ? await compressImageDataUrl(opt.img, Math.min(600, maxWidth), quality, Math.min(95_000, targetMaxChars))
          : undefined,
      }))
    );
  }
  if (cloned.connectPairs && Array.isArray(cloned.connectPairs.points)) {
    cloned.connectPairs = {
      ...cloned.connectPairs,
      points: await Promise.all(
        cloned.connectPairs.points.map(async (pt) => ({
          ...pt,
          img: pt.img
            ? await compressImageDataUrl(pt.img, Math.min(480, maxWidth), quality, Math.min(85_000, targetMaxChars))
            : undefined,
        }))
      ),
    };
  }
  if (cloned.storyBank) {
    const nextStoryBank = { ...cloned.storyBank };
    if (nextStoryBank.answerImages) {
      const nextImgs: Record<string, string> = {};
      for (const [slot, val] of Object.entries(nextStoryBank.answerImages)) {
        nextImgs[slot] =
          typeof val === 'string' && val
            ? await compressImageDataUrl(val, Math.min(480, maxWidth), quality, Math.min(85_000, targetMaxChars))
            : '';
      }
      nextStoryBank.answerImages = nextImgs;
    }
    if (nextStoryBank.example?.img) {
      nextStoryBank.example = {
        ...nextStoryBank.example,
        img: await compressImageDataUrl(
          nextStoryBank.example.img,
          Math.min(480, maxWidth),
          quality,
          Math.min(85_000, targetMaxChars)
        ),
      };
    }
    cloned.storyBank = nextStoryBank;
  }
  return cloned;
}

async function compressPartMedia(
  p: ExamPart,
  maxWidth = 900,
  quality = 0.72,
  targetMaxChars = 140_000
): Promise<ExamPart> {
  const cloned: ExamPart = { ...p };
  if (cloned.img) {
    cloned.img = await compressImageDataUrl(cloned.img, maxWidth, quality, targetMaxChars);
  }
  if (cloned.example?.img) {
    cloned.example = {
      ...cloned.example,
      img: await compressImageDataUrl(cloned.example.img, Math.min(720, maxWidth), quality, targetMaxChars),
    };
  }
  if (Array.isArray(cloned.examplesList)) {
    cloned.examplesList = await Promise.all(
      cloned.examplesList.map(async (ex) => ({
        ...ex,
        img: ex.img
          ? await compressImageDataUrl(ex.img, Math.min(600, maxWidth), quality, Math.min(95_000, targetMaxChars))
          : undefined,
      }))
    );
  }
  return cloned;
}

export function countExamImages(exam: GradeExamProfile): number {
  let count = 0;
  for (const p of exam.parts || []) {
    if (p.img && p.img.trim()) count++;
    if (p.example?.img && p.example.img.trim()) count++;
    for (const ex of p.examplesList || []) {
      if (ex.img && ex.img.trim()) count++;
    }
  }
  for (const q of exam.questions || []) {
    if (q.img && q.img.trim()) count++;
    for (const opt of q.options || []) {
      if (opt.img && opt.img.trim()) count++;
    }
    for (const pt of q.connectPairs?.points || []) {
      if (pt.img && pt.img.trim()) count++;
    }
    if (q.storyBank?.example?.img && q.storyBank.example.img.trim()) count++;
    if (q.storyBank?.answerImages) {
      for (const val of Object.values(q.storyBank.answerImages)) {
        if (typeof val === 'string' && val.trim()) count++;
      }
    }
  }
  return count;
}

/**
 * Computes SHA-256 hex digest for teacher credentials (never expose plaintext passwords in public docs).
 */
export async function hashPassword(raw: string): Promise<string> {
  const clean = (raw || '').trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(`ismart_v1:${clean}`);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fb_${(h >>> 0).toString(16).padStart(16, '0')}`;
}

export function sanitizeDocId(raw: string, fallback = 'doc'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned || fallback;
}

export function formatCloudError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Lỗi không xác định');
  let extracted = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) {
      extracted = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
    }
  } catch {
    // keep raw
  }

  const lower = extracted.toLowerCase();
  if (lower.includes('operation-not-allowed')) {
    return 'Chưa bật đăng nhập Google trong Firebase Console -> Authentication -> Sign-in method -> Google.';
  }
  if (lower.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'tên miền hiện tại';
    return `Tên miền "${host}" chưa được phép đăng nhập Google. Vào tab "Cấu hình & Link" bấm "Mở Authorized Domains (Firebase)" để thêm "${host}" 1 lần duy nhất.`;
  }
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    const currentEmail = auth.currentUser?.email || 'chưa đăng nhập Google';
    return `Bị từ chối quyền ghi Cloud (tài khoản Google đang đăng nhập: ${currentEmail}). Chỉ Admin (${BOOTSTRAP_ADMIN_EMAIL}) hoặc Giáo viên đã được cấp Email mới được ghi dữ liệu.`;
  }
  if (lower.includes('nested arrays')) {
    return 'Lỗi định dạng mảng lồng nhau khi lưu Firestore.';
  }
  if (lower.includes('exceeds the maximum allowed size') || lower.includes('1048576')) {
    return 'Một phần thi/câu hỏi chứa ảnh hoặc audio quá nặng (>1MB/tài liệu Firestore). Hãy giảm dung lượng file audio/ảnh.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Đã chạm hạn mức đọc/ghi miễn phí Firebase Spark trong ngày (tự reset vào ngày mai).';
  }
  return extracted;
}

// ==========================================
// 1. GOOGLE AUTHENTICATION (Admin / Teacher)
// ==========================================
export async function signInWithGoogleCloud(): Promise<{
  uid: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const email = (user.email || '').toLowerCase();
  const isBootstrapAdmin = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && user.emailVerified;

  if (isBootstrapAdmin) {
    const adminPath = `admins/${user.uid}`;
    try {
      await setDoc(
        doc(db, 'admins', user.uid),
        {
          uid: user.uid,
          email: user.email || BOOTSTRAP_ADMIN_EMAIL,
          createdAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch (error) {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
      if (!adminDoc?.exists()) {
        handleFirestoreError(error, OperationType.WRITE, adminPath);
      }
    }
  }

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName,
    isAdmin: isBootstrapAdmin,
  };
}

export async function signOutGoogleCloud(): Promise<void> {
  await signOut(auth);
}

// ==========================================
// 2. APP CONFIG (Schools & Active Exam ID)
// ==========================================
export async function fetchAppConfigFromCloud(): Promise<{
  schools: string[];
  activeExamId: string;
} | null> {
  const path = 'app_config/main';
  try {
    const snap = await getDoc(doc(db, 'app_config', 'main'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      schools: Array.isArray(data.schools) ? data.schools : [],
      activeExamId: typeof data.activeExamId === 'string' ? data.activeExamId : 'exam-grade-2',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveAppConfigToCloud(schools: string[], activeExamId: string): Promise<void> {
  const path = 'app_config/main';
  try {
    const safeSchools = schools
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 150))
      .slice(0, 50);
    await setDoc(doc(db, 'app_config', 'main'), {
      schools: safeSchools.length > 0 ? safeSchools : ['DL.BMT.TIH-NGUYENBINHKHIEM'],
      activeExamId: sanitizeDocId(activeExamId, 'exam-grade-2'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// 3. EXAMS (5+ Online Exams with Smart Chunking & Cache)
// ==========================================
function estimateByteSize(obj: any): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length * 2;
  }
}

function packQuestionsIntoBatches(questions: Question[], maxBytesPerBatch = 460_000, maxCountPerBatch = 35): Question[][] {
  const batches: Question[][] = [];
  let current: Question[] = [];
  let currentBytes = 0;

  for (const q of questions) {
    const qBytes = estimateByteSize(q);
    if (
      current.length > 0 &&
      (currentBytes + qBytes > maxBytesPerBatch || current.length >= maxCountPerBatch)
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(q);
    currentBytes += qBytes;
  }

  if (current.length > 0 || batches.length === 0) {
    batches.push(current);
  }
  return batches;
}

export async function saveGradeExamToCloud(exam: GradeExamProfile, ownerUid?: string): Promise<void> {
  const examId = sanitizeDocId(exam.id, `exam_${Date.now()}`);
  const examPath = `exams/${examId}`;
  try {
    let compressedParts = await Promise.all(
      (exam.parts || []).slice(0, 40).map((p) => compressPartMedia(p, 880, 0.7, 130_000))
    );
    if (estimateByteSize(compressedParts) > 700_000) {
      compressedParts = await Promise.all(
        compressedParts.map((p) => compressPartMedia(p, 580, 0.52, 70_000))
      );
    }
    if (estimateByteSize(compressedParts) > 880_000) {
      // Strip oversized inline audio (>350KB) in parts if total parts doc still nears 1MB limit
      compressedParts = compressedParts.map((p) => ({
        ...p,
        audio: p.audio && p.audio.length > 350_000 ? '' : p.audio,
      }));
    }

    const compressedQuestions = await Promise.all(
      (exam.questions || []).map(async (q) => {
        let cq = await compressQuestionMedia(q, 860, 0.7, 120_000);
        if (estimateByteSize(cq) > 720_000) {
          cq = await compressQuestionMedia(cq, 520, 0.5, 65_000);
        }
        return cq;
      })
    );

    const batches = packQuestionsIntoBatches(compressedQuestions);

    const existingSnap = await getDoc(doc(db, 'exams', examId));
    const prevBatchCount = existingSnap.exists() ? Number(existingSnap.data().batchCount || 0) : 0;

    const examPayload = encodeForFirestore({
      id: examId,
      grade: (exam.grade || 'Khối 2').trim().slice(0, 40) || 'Khối 2',
      className: (exam.className || 'Tất cả các lớp').trim().slice(0, 60),
      title: (exam.title || 'Đề thi iSMART').trim().slice(0, 200) || 'Đề thi iSMART',
      description: (exam.description || '').slice(0, 500),
      examMinutes: Math.min(180, Math.max(1, Number(exam.examMinutes || 45))),
      parts: compressedParts,
      batchCount: batches.length,
      isPublished: true,
      ownerUid: sanitizeDocId(ownerUid || auth.currentUser?.uid || 'admin', 'admin'),
      updatedAt: serverTimestamp(),
    });

    // Save exam profile document first
    await setDoc(doc(db, 'exams', examId), examPayload);

    // Save question batches in safe chunks (max 4 batches per WriteBatch to stay well under 10MB commit ceiling)
    const BATCH_COMMIT_GROUP = 4;
    for (let start = 0; start < batches.length; start += BATCH_COMMIT_GROUP) {
      const batchWriter = writeBatch(db);
      const end = Math.min(batches.length, start + BATCH_COMMIT_GROUP);
      for (let idx = start; idx < end; idx++) {
        const batchRef = doc(db, 'exams', examId, 'question_batches', `batch_${idx}`);
        batchWriter.set(
          batchRef,
          encodeForFirestore({
            examId,
            batchIndex: idx,
            questions: batches[idx],
            updatedAt: serverTimestamp(),
          })
        );
      }
      await batchWriter.commit();
    }

    if (prevBatchCount > batches.length) {
      const delWriter = writeBatch(db);
      for (let i = batches.length; i < prevBatchCount; i++) {
        delWriter.delete(doc(db, 'exams', examId, 'question_batches', `batch_${i}`));
      }
      await delWriter.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, examPath);
  }
}

export async function saveAllExamsToCloud(exams: GradeExamProfile[], ownerUid?: string): Promise<void> {
  for (const exam of exams) {
    await saveGradeExamToCloud(exam, ownerUid);
  }
}

export async function deleteExamFromCloud(examId: string): Promise<void> {
  const safeId = sanitizeDocId(examId);
  const path = `exams/${safeId}`;
  try {
    const batchesSnap = await getDocs(collection(db, 'exams', safeId, 'question_batches'));
    const batch = writeBatch(db);
    batchesSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'exams', safeId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetches published exams from Firestore using local IndexedDB timestamp cache
 * so returning students don't re-read unchanged question batches (saves ~80% Spark reads!).
 */
export async function fetchPublishedExamsFromCloud(
  cachedLocalExams: GradeExamProfile[] = []
): Promise<GradeExamProfile[] | null> {
  const path = 'exams';
  try {
    const q = query(collection(db, 'exams'), where('isPublished', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    let cachedTsMap: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(EXAM_META_TIMESTAMPS_KEY);
      if (raw) cachedTsMap = JSON.parse(raw);
    } catch {
      cachedTsMap = {};
    }

    const nextTsMap: Record<string, string> = { ...cachedTsMap };
    const results: GradeExamProfile[] = [];

    for (const examDoc of snap.docs) {
      const rawData = examDoc.data();
      const cloudTs = rawData.updatedAt?.toMillis ? String(rawData.updatedAt.toMillis()) : '';
      const data = decodeFromFirestore(rawData);
      const examId = data.id || examDoc.id;
      const cachedExam = cachedLocalExams.find((e) => e.id === examId);

      if (
        cachedExam &&
        cloudTs &&
        cachedTsMap[examId] === cloudTs &&
        Array.isArray(cachedExam.questions) &&
        cachedExam.questions.length > 0
      ) {
        results.push({
          ...cachedExam,
          grade: data.grade,
          className: data.className,
          title: data.title,
          description: data.description,
          examMinutes: Number(data.examMinutes || 45),
          parts: Array.isArray(data.parts) ? data.parts : cachedExam.parts,
          updatedAt: cloudTs,
        });
        continue;
      }

      const batchPath = `exams/${examId}/question_batches`;
      let mergedQuestions: Question[] = [];
      try {
        const batchSnap = await getDocs(collection(db, 'exams', examId, 'question_batches'));
        const sortedDocs = batchSnap.docs.sort(
          (a, b) => Number(a.data().batchIndex || 0) - Number(b.data().batchIndex || 0)
        );
        for (const bDoc of sortedDocs) {
          const bData = decodeFromFirestore(bDoc.data());
          if (Array.isArray(bData.questions)) {
            mergedQuestions = mergedQuestions.concat(bData.questions as Question[]);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, batchPath);
      }

      if (cloudTs) nextTsMap[examId] = cloudTs;

      results.push({
        id: examId,
        grade: data.grade || 'Khối 2',
        className: data.className || 'Tất cả các lớp',
        title: data.title || 'Đề thi iSMART',
        description: data.description || '',
        examMinutes: Number(data.examMinutes || 45),
        parts: Array.isArray(data.parts) ? data.parts : [],
        questions: mergedQuestions,
        updatedAt: cloudTs || new Date().toISOString(),
      });
    }

    try {
      localStorage.setItem(EXAM_META_TIMESTAMPS_KEY, JSON.stringify(nextTsMap));
    } catch {
      // ignore
    }

    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==========================================
// 4. STUDENTS (>1,000 Students, 1-Read Login & Chunked Batch Sync)
// ==========================================
function mapDocToStudent(rawData: Record<string, any>): Student {
  const data = decodeFromFirestore(rawData);
  return {
    id: data.id,
    name: data.name,
    grade: data.grade,
    className: data.className,
    school: data.school,
    examId: data.examId ?? null,
    score: data.score ?? null,
    total: data.total ?? null,
    points10: data.points10 ?? null,
    sectionScores: data.sectionScores ?? undefined,
    partScores: data.partScores ?? undefined,
    questionScores: data.questionScores ?? undefined,
    details: data.details ?? undefined,
    submittedAt: data.submittedAt ?? null,
  };
}

export async function lookupStudentByIdFromCloud(studentId: string): Promise<Student | null> {
  const safeId = sanitizeDocId(studentId.toUpperCase());
  const path = `students/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'students', safeId));
    if (!snap.exists()) return null;
    return mapDocToStudent(snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function lookupStudentsByClassFromCloud(className: string): Promise<Student[]> {
  const path = 'students';
  try {
    const q = query(collection(db, 'students'), where('className', '==', className), limit(60));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToStudent(d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllStudentsFromCloud(): Promise<Student[]> {
  const path = 'students';
  try {
    const snap = await getDocs(collection(db, 'students'));
    return snap.docs.map((d) => mapDocToStudent(d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function buildStudentFirestorePayload(s: Student): Record<string, any> {
  const sid = sanitizeDocId((s.id || '').toUpperCase(), `HS_${Date.now()}`);
  const safeName = (s.name || '').trim().slice(0, 120) || sid;
  const safeGrade = (s.grade || '').trim().slice(0, 40) || 'Khối 2';
  const safeClass = (s.className || '').trim().slice(0, 60) || '2A1';
  const safeSchool = (s.school || '').trim().slice(0, 150) || 'DL.BMT.TIH-NGUYENBINHKHIEM';

  return encodeForFirestore({
    id: sid,
    name: safeName,
    grade: safeGrade,
    className: safeClass,
    school: safeSchool,
    examId: s.examId ? sanitizeDocId(String(s.examId), 'exam-grade-2') : null,
    score: typeof s.score === 'number' && Number.isFinite(s.score) ? Math.min(1000, Math.max(0, s.score)) : null,
    total: typeof s.total === 'number' && Number.isFinite(s.total) ? Math.min(1000, Math.max(0, s.total)) : null,
    points10: s.points10 !== null && s.points10 !== undefined ? String(s.points10).slice(0, 16) : null,
    sectionScores: s.sectionScores ?? null,
    partScores: s.partScores ?? null,
    questionScores: s.questionScores ?? null,
    details: s.details ?? null,
    submittedAt: s.submittedAt !== null && s.submittedAt !== undefined ? String(s.submittedAt).slice(0, 64) : null,
    updatedAt: serverTimestamp(),
  });
}

export async function syncStudentsBatchToCloud(students: Student[]): Promise<number> {
  const path = 'students';
  const CHUNK_SIZE = 400;
  let synced = 0;

  try {
    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const slice = students.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const s of slice) {
        const payload = buildStudentFirestorePayload(s);
        batch.set(doc(db, 'students', payload.id), payload, { merge: false });
        synced++;
      }
      await batch.commit();
    }
    return synced;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStudentsFromCloud(studentIds: string[]): Promise<void> {
  const path = 'students';
  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
      const slice = studentIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of slice) {
        batch.delete(doc(db, 'students', sanitizeDocId(id.toUpperCase())));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Student Exam Submission: Writes immutable submission log & updates student's score doc.
 * Safely encodes nested arrays (e.g. connect-pairs answers) so Firestore writes never fail.
 */
export async function submitStudentScoreToCloud(params: {
  studentId: string;
  examId: string;
  score: number;
  total: number;
  points10: string;
  submittedAt: string;
  partScores?: Record<string, PartScoreRecord>;
  questionScores?: Record<number, number>;
  details?: Record<number, any>;
  sectionScores?: Record<string, SectionScoreRecord>;
}): Promise<void> {
  const safeStudentId = sanitizeDocId(params.studentId.toUpperCase());
  const safeExamId = sanitizeDocId(params.examId, 'exam-grade-2');
  const submissionId = sanitizeDocId(`${safeStudentId}_${safeExamId}_${Date.now()}`);

  const studentPath = `students/${safeStudentId}`;
  const submissionPath = `submissions/${submissionId}`;

  const safePoints10 = String(params.points10 || '0').trim().slice(0, 16) || '0';
  const safeSubmittedAt =
    String(params.submittedAt || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
      .trim()
      .slice(0, 64) || 'Đã nộp';

  const stringQuestionScores: Record<string, number> = {};
  if (params.questionScores) {
    for (const [k, v] of Object.entries(params.questionScores)) {
      stringQuestionScores[String(k)] = Number(v);
    }
  }

  const encodedDetails: Record<string, any> = {};
  if (params.details) {
    for (const [k, v] of Object.entries(params.details)) {
      if (v !== undefined) {
        encodedDetails[String(k)] = encodeForFirestore(v, false);
      }
    }
  }

  const encodedSectionScores = encodeForFirestore(params.sectionScores || {}, false);
  const encodedPartScores = encodeForFirestore(params.partScores || {}, false);

  // 1. Update student document FIRST so score & full per-question answers appear in Bảng Điểm immediately
  try {
    await updateDoc(
      doc(db, 'students', safeStudentId),
      encodeForFirestore({
        examId: safeExamId,
        score: Math.min(1000, Math.max(0, Number(params.score || 0))),
        total: Math.min(1000, Math.max(0, Number(params.total || 0))),
        points10: safePoints10,
        sectionScores: encodedSectionScores,
        partScores: encodedPartScores,
        questionScores: stringQuestionScores,
        details: encodedDetails,
        submittedAt: safeSubmittedAt,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, studentPath);
  }

  // 2. Write immutable submission log (non-blocking if exam doc wasn't published to Cloud yet, logs cleanly)
  try {
    await setDoc(
      doc(db, 'submissions', submissionId),
      encodeForFirestore({
        id: submissionId,
        studentId: safeStudentId,
        examId: safeExamId,
        score: Math.min(1000, Math.max(0, Number(params.score || 0))),
        total: Math.min(1000, Math.max(0, Number(params.total || 0))),
        points10: safePoints10,
        sectionScores: encodedSectionScores,
        partScores: encodedPartScores,
        questionScores: stringQuestionScores,
        details: encodedDetails,
        submittedAt: safeSubmittedAt,
        createdAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, submissionPath);
  }
}

export async function resetStudentsScoreInCloud(studentIds: string[]): Promise<void> {
  const path = 'students';
  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
      const slice = studentIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const sid of slice) {
        const ref = doc(db, 'students', sanitizeDocId(sid.toUpperCase()));
        batch.update(ref, {
          examId: null,
          score: null,
          total: null,
          points10: null,
          sectionScores: null,
          partScores: null,
          questionScores: null,
          details: null,
          submittedAt: null,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// 5. TEACHERS & RBAC PERMISSIONS (PII Split + Hashed Credentials)
// ==========================================
export async function saveTeachersToCloud(teachers: Teacher[]): Promise<void> {
  const path = 'teacher_accounts';
  try {
    for (const t of teachers) {
      const username = sanitizeDocId((t.username || t.id || '').toLowerCase(), `gv_${Date.now()}`);
      const teacherId = sanitizeDocId(t.id || username, username);
      const passHash = await hashPassword(t.password || '123');
      const safeCreatedAt = (t.createdAt || new Date().toLocaleDateString('vi-VN')).trim().slice(0, 40) || '01/01/2026';

      await setDoc(
        doc(db, 'teacher_accounts', username),
        encodeForFirestore({
          id: teacherId,
          name: (t.name || 'Giáo viên').trim().slice(0, 120) || 'Giáo viên',
          username,
          passHash,
          assignedGrades: (Array.isArray(t.assignedGrades) && t.assignedGrades.length > 0 ? t.assignedGrades : ['Khối 2']).slice(0, 10),
          permissions: (Array.isArray(t.permissions) ? t.permissions : []).slice(0, 15),
          isActive: Boolean(t.isActive),
          createdAt: safeCreatedAt,
          updatedAt: serverTimestamp(),
        })
      );

      await setDoc(
        doc(db, 'teacher_accounts', username, 'private', 'info'),
        encodeForFirestore({
          email: (t.email || '').trim().slice(0, 160),
          phone: (t.phone || '').trim().slice(0, 32),
          password: (t.password || '123').slice(0, 128),
          updatedAt: serverTimestamp(),
        })
      );

      if (t.email && t.email.includes('@')) {
        const cleanEmail = t.email.trim().toLowerCase().slice(0, 160);
        await setDoc(doc(db, 'teacher_emails', cleanEmail), {
          email: cleanEmail,
          permissions: (Array.isArray(t.permissions) ? t.permissions : []).slice(0, 15),
          isActive: Boolean(t.isActive),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeacherFromCloud(teacher: Teacher): Promise<void> {
  const username = sanitizeDocId(teacher.username.toLowerCase());
  const path = `teacher_accounts/${username}`;
  try {
    await deleteDoc(doc(db, 'teacher_accounts', username, 'private', 'info')).catch(() => {});
    await deleteDoc(doc(db, 'teacher_accounts', username));
    if (teacher.email && teacher.email.includes('@')) {
      await deleteDoc(doc(db, 'teacher_emails', teacher.email.trim().toLowerCase())).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchTeachersForAdminFromCloud(): Promise<Teacher[] | null> {
  const path = 'teacher_accounts';
  try {
    const snap = await getDocs(collection(db, 'teacher_accounts'));
    if (snap.empty) return null;

    const results: Teacher[] = [];
    for (const d of snap.docs) {
      const data = decodeFromFirestore(d.data());
      let email = '';
      let phone = '';
      let password = '123';

      try {
        const privSnap = await getDoc(doc(db, 'teacher_accounts', d.id, 'private', 'info'));
        if (privSnap.exists()) {
          const p = privSnap.data();
          email = p.email || '';
          phone = p.phone || '';
          password = p.password || '123';
        }
      } catch {
        // Ignore if non-admin
      }

      results.push({
        id: data.id || d.id,
        name: data.name || 'Giáo viên',
        username: data.username || d.id,
        password,
        email,
        phone,
        assignedGrades: Array.isArray(data.assignedGrades) ? data.assignedGrades : ['Khối 2'],
        permissions: Array.isArray(data.permissions) ? (data.permissions as TeacherPermission[]) : [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt || '',
      });
    }
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function verifyTeacherLoginFromCloud(
  username: string,
  password: string
): Promise<{ status: 'ok'; teacher: Teacher } | { status: 'inactive' } | { status: 'wrong_password' } | { status: 'not_found' }> {
  const cleanUser = sanitizeDocId(username.trim().toLowerCase());
  const path = `teacher_accounts/${cleanUser}`;
  try {
    const snap = await getDoc(doc(db, 'teacher_accounts', cleanUser));
    if (!snap.exists()) return { status: 'not_found' };
    const data = decodeFromFirestore(snap.data());

    if (data.isActive === false) {
      return { status: 'inactive' };
    }

    const inputHash = await hashPassword(password);
    if (inputHash !== data.passHash) {
      return { status: 'wrong_password' };
    }

    return {
      status: 'ok',
      teacher: {
        id: data.id,
        name: data.name,
        username: data.username,
        password,
        assignedGrades: Array.isArray(data.assignedGrades) ? data.assignedGrades : ['Khối 2'],
        permissions: Array.isArray(data.permissions) ? (data.permissions as TeacherPermission[]) : [],
        isActive: true,
        createdAt: data.createdAt || '',
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ==========================================
// 6. UNIFIED SYNC & CLOUD INVENTORY SUMMARY
// ==========================================
export interface CloudSyncReport {
  ok: boolean;
  cloudEmail: string | null;
  schoolsSaved: number;
  examsSaved: number;
  examImagesCount: number;
  studentsSaved: number;
  scoredStudentsCount: number;
  teachersSaved: number;
  errors: string[];
}

export async function syncAllDataToCloud(params: {
  schools: string[];
  activeExamId: string;
  gradeExams: GradeExamProfile[];
  students: Student[];
  teachers: Teacher[];
  ownerUid: string;
  cloudEmail: string | null;
  canSyncExams: boolean;
  canSyncStudents: boolean;
  canSyncTeachers: boolean;
}): Promise<CloudSyncReport> {
  const report: CloudSyncReport = {
    ok: true,
    cloudEmail: params.cloudEmail,
    schoolsSaved: 0,
    examsSaved: 0,
    examImagesCount: 0,
    studentsSaved: 0,
    scoredStudentsCount: 0,
    teachersSaved: 0,
    errors: [],
  };

  // 1. App Config (Schools & Active Exam)
  try {
    await saveAppConfigToCloud(params.schools, params.activeExamId);
    report.schoolsSaved = params.schools.length;
  } catch (err) {
    report.ok = false;
    report.errors.push(`Trường & Cấu hình: ${formatCloudError(err)}`);
  }

  // 2. Grade Exams (Questions, Parts, Images, Audio)
  if (params.canSyncExams) {
    for (const exam of params.gradeExams) {
      try {
        await saveGradeExamToCloud(exam, params.ownerUid);
        report.examsSaved++;
        report.examImagesCount += countExamImages(exam);
      } catch (err) {
        report.ok = false;
        report.errors.push(`Bài thi "${exam.title}": ${formatCloudError(err)}`);
      }
    }
  }

  // 3. Students & Saved Scores
  if (params.canSyncStudents) {
    try {
      const synced = await syncStudentsBatchToCloud(params.students);
      report.studentsSaved = synced;
      report.scoredStudentsCount = params.students.filter(
        (s) => s.score !== null && s.score !== undefined
      ).length;
    } catch (err) {
      report.ok = false;
      report.errors.push(`Danh sách Học sinh & Điểm: ${formatCloudError(err)}`);
    }
  }

  // 4. Teachers & Permissions
  if (params.canSyncTeachers) {
    try {
      await saveTeachersToCloud(params.teachers);
      report.teachersSaved = params.teachers.length;
    } catch (err) {
      report.ok = false;
      report.errors.push(`Danh sách Giáo viên: ${formatCloudError(err)}`);
    }
  }

  return report;
}

export interface CloudInventorySummary {
  checkedAt: string;
  cloudEmail: string | null;
  isBootstrapAdmin: boolean;
  schoolsCount: number;
  examsCount: number;
  examImagesCount: number;
  studentsCount: number;
  scoredStudentsCount: number;
  submissionsCount: number;
  teachersCount: number;
  errors: string[];
}

export async function fetchCloudInventorySummary(): Promise<CloudInventorySummary> {
  const email = auth.currentUser?.email || null;
  const isBootstrapAdmin =
    Boolean(email && email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && auth.currentUser?.emailVerified);

  const summary: CloudInventorySummary = {
    checkedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cloudEmail: email,
    isBootstrapAdmin,
    schoolsCount: 0,
    examsCount: 0,
    examImagesCount: 0,
    studentsCount: 0,
    scoredStudentsCount: 0,
    submissionsCount: 0,
    teachersCount: 0,
    errors: [],
  };

  try {
    const cfg = await fetchAppConfigFromCloud();
    if (cfg) summary.schoolsCount = cfg.schools.length;
  } catch (err) {
    summary.errors.push(`AppConfig: ${formatCloudError(err)}`);
  }

  try {
    const exams = await fetchPublishedExamsFromCloud([]);
    if (exams) {
      summary.examsCount = exams.length;
      summary.examImagesCount = exams.reduce((acc, ex) => acc + countExamImages(ex), 0);
    }
  } catch (err) {
    summary.errors.push(`Exams: ${formatCloudError(err)}`);
  }

  if (auth.currentUser) {
    try {
      const students = await fetchAllStudentsFromCloud();
      summary.studentsCount = students.length;
      summary.scoredStudentsCount = students.filter((s) => s.score !== null && s.score !== undefined).length;
    } catch (err) {
      summary.errors.push(`Students: ${formatCloudError(err)}`);
    }

    try {
      const teachers = await fetchTeachersForAdminFromCloud();
      summary.teachersCount = teachers ? teachers.length : 0;
    } catch (err) {
      // Non-admin teachers don't have list access on teacher_accounts
      if (!formatCloudError(err).toLowerCase().includes('quyền')) {
        summary.errors.push(`Teachers: ${formatCloudError(err)}`);
      }
    }

    try {
      const subsSnap = await getDocs(collection(db, 'submissions'));
      summary.submissionsCount = subsSnap.size;
    } catch {
      // Optional for non-admin
    }
  }

  return summary;
}
