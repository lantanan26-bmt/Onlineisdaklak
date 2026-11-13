import React, { useState, useEffect } from 'react';
import { Question, Student, ExamPart, GradeExamProfile, Teacher } from '../types';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  CloudInventorySummary,
  CloudSyncReport,
  FIREBASE_AUTH_SETTINGS_URL,
  FIREBASE_PROJECT_ID,
  FIRESTORE_CONSOLE_URL,
} from '../services/firebaseService';

interface JsonConfigViewProps {
  parts?: ExamPart[];
  questions: Question[];
  gradeExams?: GradeExamProfile[];
  activeExamId?: string;
  schools: string[];
  students: Student[];
  teachers?: Teacher[];
  examMinutes: number;
  adminPin: string;
  cloudUserEmail?: string | null;
  cloudHealth?: 'checking' | 'connected' | 'offline';
  isCloudSyncing?: boolean;
  cloudInventory?: CloudInventorySummary | null;
  lastSyncReport?: CloudSyncReport | null;
  onConnectCloud?: () => void;
  onPushAllToCloud?: () => void;
  onPullAllFromCloud?: () => void;
  onRefreshCloudInventory?: () => void;
  onApplySnapshot?: (snapshot: Record<string, any>) => void;
  onDownloadGitHubSnapshot?: (includeSensitiveAuth: boolean) => void;
  onUploadBackupJSON?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPartsChange?: (p: ExamPart[]) => void;
  onQuestionsChange: (q: Question[]) => void;
  onSchoolsChange: (s: string[]) => void;
  onStudentsChange: (stu: Student[]) => void;
  onExamMinutesChange: (m: number) => void;
  onAdminPinChange: (pin: string) => void;
  onEnterStandaloneStudentPortal: () => void;
  onDownloadStandaloneHTML: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const JsonConfigView: React.FC<JsonConfigViewProps> = ({
  parts = [],
  questions,
  gradeExams = [],
  activeExamId = '',
  schools,
  students,
  teachers = [],
  examMinutes,
  adminPin,
  cloudUserEmail,
  cloudHealth = 'checking',
  isCloudSyncing = false,
  cloudInventory,
  lastSyncReport,
  onConnectCloud,
  onPushAllToCloud,
  onPullAllFromCloud,
  onRefreshCloudInventory,
  onApplySnapshot,
  onDownloadGitHubSnapshot,
  onUploadBackupJSON,
  onPartsChange,
  onQuestionsChange,
  onSchoolsChange,
  onStudentsChange,
  onExamMinutesChange,
  onAdminPinChange,
  onEnterStandaloneStudentPortal,
  onDownloadStandaloneHTML,
  showToast
}) => {
  const [jsonText, setJsonText] = useState('');
  const [tempPin, setTempPin] = useState(adminPin);
  const [includeAuthInSnapshot, setIncludeAuthInSnapshot] = useState(true);

  useEffect(() => {
    setTempPin(adminPin);
  }, [adminPin]);

  useEffect(() => {
    setJsonText(
      JSON.stringify(
        {
          version: 2,
          gradeExams,
          activeExamId,
          examMinutes,
          adminPin,
          schools,
          students,
          teachers,
          parts,
          questions
        },
        null,
        2
      )
    );
  }, [gradeExams, activeExamId, examMinutes, adminPin, schools, students, teachers, parts, questions]);

  const standaloneUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?role=student`
    : '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const copyTextWithToast = (text: string, successMessage: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showToast(successMessage);
        })
        .catch(() => {
          fallbackCopyText(text, successMessage);
        });
    } else {
      fallbackCopyText(text, successMessage);
    }
  };

  const handleCopyUrl = () => {
    copyTextWithToast(standaloneUrl, 'Đã sao chép đường dẫn Trang Thi Độc Lập!');
  };

  const handleCopyHost = () => {
    if (!currentHost) return;
    copyTextWithToast(currentHost, `Đã sao chép tên miền "${currentHost}"! Hãy dán vào Firebase Authorized domains.`);
  };

  const fallbackCopyText = (text: string, successMessage = 'Đã sao chép!') => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(successMessage);
    } catch {
      showToast('Không thể sao chép tự động, vui lòng sao chép thủ công.', 'warn');
    }
  };

  const handleUpdatePin = () => {
    const clean = tempPin.trim();
    if (!clean || clean.length < 3) {
      showToast('Mã PIN phải có ít nhất 3 chữ số!', 'warn');
      return;
    }
    onAdminPinChange(clean);
    showToast(`Đã cập nhật Mã PIN Admin: ${clean}`);
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (onApplySnapshot) {
        onApplySnapshot(parsed);
        return;
      }
      if (Array.isArray(parsed)) {
        onQuestionsChange(parsed);
      } else {
        if (parsed.parts && Array.isArray(parsed.parts) && onPartsChange) {
          onPartsChange(parsed.parts);
        }
        if (parsed.questions && Array.isArray(parsed.questions)) {
          onQuestionsChange(parsed.questions);
        }
        if (parsed.schools && Array.isArray(parsed.schools)) {
          onSchoolsChange(parsed.schools);
        }
        if (parsed.students && Array.isArray(parsed.students)) {
          onStudentsChange(parsed.students);
        }
        if (parsed.examMinutes && typeof parsed.examMinutes === 'number') {
          onExamMinutesChange(parsed.examMinutes);
        }
        if (parsed.adminPin) {
          onAdminPinChange(String(parsed.adminPin));
        }
      }
      showToast('Đã áp dụng dữ liệu JSON thành công!');
    } catch {
      showToast('Cấu trúc JSON không hợp lệ!', 'error');
    }
  };

  const handleExportJson = () => {
    if (onDownloadGitHubSnapshot) {
      onDownloadGitHubSnapshot(includeAuthInSnapshot);
      return;
    }
    const data = {
      version: 2,
      gradeExams,
      activeExamId,
      examMinutes,
      adminPin,
      schools,
      students,
      teachers,
      parts,
      questions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ismart-lms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file JSON dự phòng!');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onUploadBackupJSON) {
      onUploadBackupJSON(e);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onQuestionsChange(parsed);
        } else {
          if (parsed.parts && Array.isArray(parsed.parts) && onPartsChange) onPartsChange(parsed.parts);
          if (parsed.questions) onQuestionsChange(parsed.questions);
          if (parsed.schools) onSchoolsChange(parsed.schools);
          if (parsed.students) onStudentsChange(parsed.students);
          if (parsed.examMinutes) onExamMinutesChange(parsed.examMinutes);
          if (parsed.adminPin) onAdminPinChange(String(parsed.adminPin));
        }
        showToast('Đã nhập dữ liệu từ file JSON!');
      } catch {
        showToast('File JSON không hợp lệ!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const scoredStudentsCount = students.filter((s) => s.score !== null && s.score !== undefined).length;

  return (
    <div className="space-y-5">
      {/* Firebase Cloud Spark Storage & Live Sync Inspector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${cloudUserEmail ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <i className={`fa-solid ${cloudUserEmail ? 'fa-cloud-arrow-up' : 'fa-cloud-exclamation'}`}></i>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Trung Tâm Đồng Bộ &amp; Kiểm Tra Dữ Liệu Firebase Cloud (Gói Spark Miễn Phí)
              </h2>
              <p className="text-xs text-slate-500">
                {cloudUserEmail ? (
                  <>
                    Đang đăng nhập Google Cloud: <strong className="text-emerald-700">{cloudUserEmail}</strong>
                    {cloudUserEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
                      ? ' (Quyền Admin Toàn Hệ Thống)'
                      : ' (Kiểm tra quyền GV hoặc dùng đúng email Admin để ghi Cloud)'}
                  </>
                ) : (
                  <>Chưa kết nối tài khoản Google Cloud. Hãy bấm <strong>Kết nối Google Cloud</strong> (dùng email Admin <code>{BOOTSTRAP_ADMIN_EMAIL}</code>) để đẩy &amp; xem dữ liệu trên Firebase.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!cloudUserEmail && onConnectCloud && (
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={onConnectCloud}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                <i className="fa-brands fa-google"></i> Kết nối Google Cloud
              </button>
            )}
            {onPushAllToCloud && (
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={onPushAllToCloud}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                <i className={`fa-solid ${isCloudSyncing ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-up'}`}></i> Đẩy tất cả lên Cloud ngay
              </button>
            )}
            {onPullAllFromCloud && (
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={onPullAllFromCloud}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                <i className="fa-solid fa-cloud-arrow-down"></i> Tải từ Cloud về máy
              </button>
            )}
            {onRefreshCloudInventory && (
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={onRefreshCloudInventory}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
              >
                <i className="fa-solid fa-rotate"></i> Kiểm tra Cloud
              </button>
            )}
            <a
              href={FIRESTORE_CONSOLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <i className="fa-solid fa-database"></i> Mở Đúng Database Firebase
            </a>
          </div>
        </div>

        {/* Verified Cloud Counts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-bold text-blue-700">Bài thi (exams)</div>
            <div className="text-xl font-black text-blue-950">{cloudInventory ? cloudInventory.examsCount : '—'}</div>
            <div className="text-[11px] text-blue-600">Đề soạn đã lưu Cloud</div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
            <div className="text-[11px] font-bold text-purple-700">Ảnh bài thi (nén)</div>
            <div className="text-xl font-black text-purple-950">{cloudInventory ? cloudInventory.examImagesCount : '—'}</div>
            <div className="text-[11px] text-purple-600">Trong parts &amp; question_batches</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-[11px] font-bold text-emerald-700">Học sinh (students)</div>
            <div className="text-xl font-black text-emerald-950">{cloudInventory ? cloudInventory.studentsCount : '—'}</div>
            <div className="text-[11px] text-emerald-600">Hỗ trợ &gt;1.000 HS</div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200">
            <div className="text-[11px] font-bold text-cyan-700">Điểm &amp; Bài nộp</div>
            <div className="text-xl font-black text-cyan-950">
              {cloudInventory ? `${cloudInventory.scoredStudentsCount} / ${cloudInventory.submissionsCount}` : '—'}
            </div>
            <div className="text-[11px] text-cyan-600">HS có điểm / Lượt nộp (submissions)</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-[11px] font-bold text-amber-700">Giáo viên &amp; Quyền</div>
            <div className="text-xl font-black text-amber-950">{cloudInventory ? cloudInventory.teachersCount : '—'}</div>
            <div className="text-[11px] text-amber-600">teacher_accounts &amp; private</div>
          </div>
        </div>

        {/* Auto-Connect Guide for Netlify, Cloudflare Pages & Custom Online Hosts */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-700 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-extrabold text-emerald-900">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  cloudHealth === 'connected'
                    ? 'bg-emerald-500'
                    : cloudHealth === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span>
                Tự Động Kết Nối Khi Chạy Online (Netlify / Cloudflare Pages / Web Riêng) — Project:{' '}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">{FIREBASE_PROJECT_ID}</code>
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-bold text-emerald-800 text-[11px]">
              {cloudHealth === 'connected'
                ? 'Đã tự động kết nối Cloud'
                : cloudHealth === 'checking'
                ? 'Đang kiểm tra kết nối...'
                : 'Đang ngoại tuyến'}
            </span>
          </div>

          <div className="text-[11px] leading-relaxed text-slate-700 space-y-1">
            <div>
              <strong>• Học sinh &amp; Giáo viên:</strong> Cấu hình Firebase đã đóng gói sẵn trong bản build (<code>dist/</code>). Khi deploy lên Netlify hay Cloudflare Pages (<code>dash.cloudflare.com</code>), web <strong>tự động tải đề, tra mã SBD, nộp bài &amp; đăng nhập GV</strong> ngay lập tức mà không cần thiết lập biến môi trường.
            </div>
            <div>
              <strong>• Quyền Admin sửa &amp; đồng bộ trực tiếp trên tên miền mới:</strong> Nếu bạn mở web thử ở tên miền mới (<code>*.netlify.app</code> hoặc <code>*.pages.dev</code>) và muốn bấm <em>Kết nối Google Cloud</em>, hãy thêm tên miền hiện tại 1 lần vào danh sách cho phép của Firebase:
            </div>
          </div>

          {currentHost && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[11px] font-bold text-slate-600">Tên miền đang chạy:</span>
              <code className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] font-bold text-slate-900">
                {currentHost}
              </code>
              <button
                type="button"
                onClick={handleCopyHost}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-black text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
              >
                <i className="fa-regular fa-copy"></i> Copy Tên Miền
              </button>
              <a
                href={FIREBASE_AUTH_SETTINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 transition"
              >
                <i className="fa-solid fa-shield-check"></i> Mở Authorized Domains (Firebase)
              </a>
            </div>
          )}
        </div>

        {/* Location Map & Any Sync Errors */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
          <div>
            <strong>Nơi lưu dữ liệu trong Firestore:</strong> Database ID{' '}
            <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[11px]">
              ai-studio-ismartlmsquntrcu-a6821927-8527-43e7-8982-d703f300594c
            </code>{' '}
            (Lưu ý: Khi vào Firebase Console → Firestore Database, hãy chọn đúng Database ID này ở menu thả xuống phía trên, không phải <code>(default)</code>).
          </div>
          <div>
            <strong>Chi tiết các collection:</strong> <code>exams</code> &amp; <code>question_batches</code> (đề thi, câu hỏi, ảnh nén, audio) •{' '}
            <code>students</code> &amp; <code>submissions</code> (danh sách học sinh, điểm số, chi tiết từng câu) •{' '}
            <code>teacher_accounts</code>, <code>private</code> &amp; <code>teacher_emails</code> (danh sách GV &amp; quyền).
          </div>
        </div>

        {((lastSyncReport && lastSyncReport.errors.length > 0) || (cloudInventory && cloudInventory.errors.length > 0)) && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation"></i> Chi tiết lỗi đồng bộ Cloud gần nhất:
            </div>
            {lastSyncReport?.errors.map((err, i) => (
              <div key={`sync-err-${i}`}>• {err}</div>
            ))}
            {cloudInventory?.errors.map((err, i) => (
              <div key={`inv-err-${i}`}>• {err}</div>
            ))}
          </div>
        )}
      </div>

      {/* GitHub Repository Snapshot & Cross-Deploy Data Preservation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl shrink-0">
              <i className="fa-brands fa-github"></i>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Lưu Trữ &amp; Đồng Bộ Dữ Liệu Đã Test Sang GitHub (Không Cần Nhập Lại)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                Đẩy code lên GitHub chỉ lưu mã nguồn; còn <strong>đề thi, học sinh, giáo viên &amp; bài làm đã test</strong> đang lưu ở trình duyệt và Firebase. Tải file snapshot chuẩn bên dưới để lưu cứng vào GitHub hoặc chuyển giữa các máy/Cloudflare Pages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onDownloadGitHubSnapshot
                  ? onDownloadGitHubSnapshot(includeAuthInSnapshot)
                  : handleExportJson()
              }
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <i className="fa-solid fa-file-export"></i> Tải ismart-snapshot.json (Lưu GitHub)
            </button>
            <label className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition">
              <i className="fa-solid fa-file-import"></i> Nạp lại từ Snapshot (.json)
              <input type="file" accept=".json" className="hidden" onChange={handleImportJsonFile} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Đề thi hiện có (máy này)</div>
            <div className="text-lg font-black text-slate-900">{gradeExams.length || 1} đề</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Học sinh hiện có</div>
            <div className="text-lg font-black text-slate-900">{students.length} HS</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Bài đã chấm &amp; lưu chi tiết</div>
            <div className="text-lg font-black text-emerald-700">{scoredStudentsCount} bài</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Giáo viên &amp; quyền</div>
            <div className="text-lg font-black text-amber-700">{teachers.length} GV</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <label className="flex items-center gap-2 font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeAuthInSnapshot}
              onChange={(e) => setIncludeAuthInSnapshot(e.target.checked)}
              className="w-4 h-4 rounded accent-slate-900"
            />
            <span>Kèm danh sách Giáo viên &amp; Mã PIN Admin trong file snapshot</span>
          </label>
          <span className="text-[11px] text-amber-700 font-semibold">
            {includeAuthInSnapshot
              ? 'Lưu ý: Nếu đưa file này vào repo GitHub, hãy đặt repo ở chế độ Private để bảo mật tài khoản GV.'
              : 'Đã ẩn mật khẩu GV & PIN; tài khoản GV sẽ được đồng bộ an toàn qua Firebase Cloud.'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
          <div className="font-extrabold">Quy trình đồng bộ trọn vẹn Code + Dữ liệu lên GitHub &amp; Cloudflare:</div>
          <div>
            <strong>1. Lưu dữ liệu lên Cloud (Realtime):</strong> Bấm <strong>Kết nối Google Cloud</strong> → <strong>Đẩy tất cả lên Cloud ngay</strong>. Khi deploy lên Cloudflare Pages cùng Firebase này, toàn bộ đề, HS, GV &amp; điểm sẽ tự xuất hiện.
          </div>
          <div>
            <strong>2. Lưu cứng dữ liệu vào GitHub Repo:</strong> Bấm <strong>Tải ismart-snapshot.json</strong> rồi tải file đó vào thư mục <code className="px-1 py-0.5 bg-white rounded border border-indigo-200 font-mono">public/ismart-snapshot.json</code> trên GitHub của bạn — mọi trình duyệt mới mở web lên sẽ tự động nạp sẵn toàn bộ dữ liệu bạn đã test.
          </div>
          <div>
            <strong>3. Lưu mã nguồn ứng dụng lên GitHub:</strong> Bấm nút <strong>Save to GitHub</strong> trên thanh công cụ phía trên của trình tạo ứng dụng để đẩy phiên bản code mới nhất vào repo GitHub.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Standalone Student Portal link */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-link"></i>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Phát Hành Trang Thi Độc Lập Cho Học Sinh
              </h2>
              <p className="text-xs text-slate-500">
                Tách biệt hoàn toàn giao diện Học sinh và trang Quản trị Admin.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Đường dẫn (URL) Chế độ Thi Độc Lập (<code>?role=student</code>):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={standaloneUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-blue-700 font-bold"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition cursor-pointer"
                >
                  <i className="fa-regular fa-copy mr-1"></i>Copy Link
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(standaloneUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Mở Trang Thi Online (Tab Mới)
              </button>
              <button
                type="button"
                onClick={onEnterStandaloneStudentPortal}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-display"></i> Chuyển Máy Này Sang Chế Độ Học Sinh
              </button>
              <button
                type="button"
                onClick={onDownloadStandaloneHTML}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-file-arrow-down"></i> Tải Gói File HTML Dự Phòng
              </button>
            </div>
          </div>
        </div>

        {/* Right: Admin PIN Security */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-shield-keyhole"></i>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Bảo Mật Khóa Admin (Mã PIN)</h2>
              <p className="text-xs text-slate-500">Ngăn học sinh tự ý thoát khỏi trang thi</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu / Mã PIN mở khóa Admin:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono font-black bg-slate-50 border border-slate-300 rounded-xl text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={handleUpdatePin}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
                >
                  Cập nhật PIN
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Khi chế độ Học sinh được bật, Giám thị cần nhập mã PIN này để quay lại trang Admin.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Data Viewer & Editor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Cấu trúc dữ liệu liên kết (`QUESTIONS`, `SCHOOLS`, `STUDENTS`)
            </h2>
            <p className="text-xs text-slate-500">
              Sao lưu toàn bộ câu hỏi, học sinh, trường học và kết quả thi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition flex items-center gap-1.5">
              <i className="fa-solid fa-file-import"></i> Nhập JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImportJsonFile} />
            </label>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-download"></i> Xuất JSON
            </button>
            <button
              type="button"
              onClick={handleApplyJson}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-check"></i> Áp dụng JSON
            </button>
          </div>
        </div>

        <textarea
          rows={14}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full font-mono text-xs bg-slate-950 text-emerald-400 p-4 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
};
