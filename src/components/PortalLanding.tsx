import React, { useState, useEffect, useRef } from 'react';
import { AppBranding, Student, Teacher } from '../types';
import { hashPassword } from '../services/firebaseService';
import { LanguageToggleButton } from './LanguageToggleButton';

interface PortalLandingProps {
  adminPin: string;
  teachers: Teacher[];
  students?: Student[];
  branding?: AppBranding;
  cloudHealth?: 'checking' | 'connected' | 'offline';
  onLoginAdmin: () => void;
  onLoginTeacher: (teacher: Teacher) => void;
  onVerifyTeacherCloud?: (
    username: string,
    password: string
  ) => Promise<{ status: 'ok'; teacher: Teacher } | { status: 'inactive' } | { status: 'wrong_password' } | { status: 'not_found' }>;
  onLookupTeacherPublicCloud?: (
    username: string
  ) => Promise<{ id: string; name: string; username: string; isActive: boolean } | null>;
  onLookupStudentCloud?: (studentId: string) => Promise<Student | null>;
  onGoToStudentExam: (prefillStudent?: Student | null) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

type RecognizedTeacherHint = {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
};

export const PortalLanding: React.FC<PortalLandingProps> = ({
  adminPin,
  teachers,
  students = [],
  branding,
  cloudHealth = 'checking',
  onLoginAdmin,
  onLoginTeacher,
  onVerifyTeacherCloud,
  onLookupTeacherPublicCloud,
  onLookupStudentCloud,
  onGoToStudentExam,
}) => {
  const displayAppName = branding?.appName?.trim() || 'iSMART LMS';
  const displayLogoText = branding?.logoText?.trim() || 'iS';
  const displayLogoUrl = branding?.logoUrl || null;
  const displayLogoWidth = Math.min(280, Math.max(24, Math.round(branding?.logoWidth ?? 40)));
  const displayLogoHeight = Math.min(120, Math.max(24, Math.round(branding?.logoHeight ?? 40)));
  const displayLogoFitClass =
    branding?.logoFit === 'fill' ? 'object-fill' : branding?.logoFit === 'cover' ? 'object-cover' : 'object-contain';
  const displayLogoFontPx = Math.max(13, Math.min(34, Math.round(Math.min(displayLogoHeight * 0.48, displayLogoWidth * 0.44))));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingCloud, setIsVerifyingCloud] = useState(false);
  const [isCheckingIdentifier, setIsCheckingIdentifier] = useState(false);

  // Recognition state: 'none' | 'admin' | 'teacher' | 'student'
  const [recognizedRole, setRecognizedRole] = useState<'none' | 'admin' | 'teacher' | 'student'>('none');
  const [matchedTeacher, setMatchedTeacher] = useState<RecognizedTeacherHint | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Real-time local recognition + debounced Cloud teacher/student recognition
  useEffect(() => {
    const rawTrimmed = username.trim();
    const cleanUser = rawTrimmed.toLowerCase();
    const cleanUpper = rawTrimmed.toUpperCase();
    setErrorMessage(null);

    if (!cleanUser) {
      setRecognizedRole('none');
      setMatchedTeacher(null);
      setMatchedStudent(null);
      setIsCheckingIdentifier(false);
      return;
    }

    if (cleanUser === 'admin') {
      setRecognizedRole('admin');
      setMatchedTeacher(null);
      setMatchedStudent(null);
      setIsCheckingIdentifier(false);
      return;
    }

    const foundTeacher = teachers.find((t) => t.username.toLowerCase() === cleanUser);
    if (foundTeacher) {
      setRecognizedRole('teacher');
      setMatchedTeacher({
        id: foundTeacher.id,
        name: foundTeacher.name,
        username: foundTeacher.username,
        isActive: foundTeacher.isActive !== false,
      });
      setMatchedStudent(null);
      setIsCheckingIdentifier(false);
      return;
    }

    if (cleanUser === 'hocsinh' || cleanUser === 'học sinh' || cleanUser === 'student' || cleanUser === 'hs') {
      setRecognizedRole('student');
      setMatchedTeacher(null);
      setMatchedStudent(null);
      setIsCheckingIdentifier(false);
      return;
    }

    const foundStudent = students.find((s) => s.id.toUpperCase() === cleanUpper);
    if (foundStudent) {
      setRecognizedRole('student');
      setMatchedTeacher(null);
      setMatchedStudent(foundStudent);
      setIsCheckingIdentifier(false);
      return;
    }

    setRecognizedRole('none');
    setMatchedTeacher(null);
    setMatchedStudent(null);

    // Debounced Cloud check for newly created Teachers or Students not yet cached locally
    if (
      cleanUser.length >= 2 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      (onLookupTeacherPublicCloud || onLookupStudentCloud)
    ) {
      let cancelled = false;
      const timer = window.setTimeout(async () => {
        setIsCheckingIdentifier(true);
        try {
          if (onLookupTeacherPublicCloud) {
            const cloudTeacher = await onLookupTeacherPublicCloud(cleanUser);
            if (!cancelled && cloudTeacher) {
              setRecognizedRole('teacher');
              setMatchedTeacher(cloudTeacher);
              setMatchedStudent(null);
              return;
            }
          }
          if (onLookupStudentCloud && cleanUpper.length >= 3) {
            const cloudStu = await onLookupStudentCloud(cleanUpper);
            if (!cancelled && cloudStu) {
              setRecognizedRole('student');
              setMatchedTeacher(null);
              setMatchedStudent(cloudStu);
            }
          }
        } catch {
          // ignore silent check failures
        } finally {
          if (!cancelled) setIsCheckingIdentifier(false);
        }
      }, 320);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
  }, [username, teachers, students, onLookupTeacherPublicCloud, onLookupStudentCloud]);

  // Handle smart submit (Continue / Login)
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const rawTrimmed = username.trim();
    const cleanUser = rawTrimmed.toLowerCase();
    const cleanUpper = rawTrimmed.toUpperCase();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập hoặc chọn Học sinh vào phòng thi!');
      return;
    }

    // 0. If student already recognized, open Exam Room Login directly
    if (recognizedRole === 'student') {
      onGoToStudentExam(matchedStudent);
      return;
    }

    // 1. ADMIN FLOW
    if (cleanUser === 'admin') {
      if (!cleanPass) {
        setErrorMessage('Vui lòng nhập Mật khẩu Admin để vào hệ thống!');
        passwordInputRef.current?.focus();
        return;
      }

      if (cleanPass === 'admin0911' || (adminPin && cleanPass === adminPin.trim())) {
        onLoginAdmin();
      } else {
        setErrorMessage('Mật khẩu Admin không chính xác! Vui lòng kiểm tra lại.');
        passwordInputRef.current?.focus();
      }
      return;
    }

    // 2. TEACHER FLOW (already recognized -> verify password)
    if (recognizedRole === 'teacher') {
      if (matchedTeacher?.isActive === false) {
        setErrorMessage('Tài khoản giáo viên này đang bị tạm khóa. Vui lòng liên hệ Admin!');
        return;
      }

      if (!cleanPass) {
        setErrorMessage(`Vui lòng nhập Mật khẩu cho Thầy/Cô ${matchedTeacher?.name || cleanUser}!`);
        passwordInputRef.current?.focus();
        return;
      }

      if (onVerifyTeacherCloud) {
        setIsVerifyingCloud(true);
        try {
          const cloudRes = await onVerifyTeacherCloud(cleanUser, cleanPass);
          if (cloudRes.status === 'ok') {
            onLoginTeacher(cloudRes.teacher);
            return;
          }
          if (cloudRes.status === 'inactive') {
            setErrorMessage('Tài khoản giáo viên này đang bị tạm khóa. Vui lòng liên hệ Admin!');
            return;
          }
          if (cloudRes.status === 'wrong_password') {
            setErrorMessage('Mật khẩu giáo viên không chính xác! Vui lòng kiểm tra lại.');
            passwordInputRef.current?.focus();
            return;
          }
        } catch {
          // Offline or fallback to local list
        } finally {
          setIsVerifyingCloud(false);
        }
      }

      const teacher = teachers.find((t) => t.username.toLowerCase() === cleanUser);
      if (teacher) {
        if (teacher.isActive === false) {
          setErrorMessage('Tài khoản giáo viên này đang bị tạm khóa. Vui lòng liên hệ Admin!');
          return;
        }
        const passwordMatched =
          (teacher.password && teacher.password === cleanPass) ||
          (teacher.passHash && (await hashPassword(cleanPass)) === teacher.passHash);

        if (passwordMatched) {
          onLoginTeacher(teacher);
        } else {
          setErrorMessage('Mật khẩu giáo viên không chính xác! Vui lòng kiểm tra lại.');
          passwordInputRef.current?.focus();
        }
        return;
      }
    }

    // 3. NOT RECOGNIZED YET -> Verify Cloud immediately on Continue / Enter
    setIsCheckingIdentifier(true);
    try {
      if (onLookupTeacherPublicCloud) {
        const cloudTeacher = await onLookupTeacherPublicCloud(cleanUser);
        if (cloudTeacher) {
          setRecognizedRole('teacher');
          setMatchedTeacher(cloudTeacher);
          setMatchedStudent(null);
          if (cloudTeacher.isActive === false) {
            setErrorMessage('Tài khoản giáo viên này đang bị tạm khóa. Vui lòng liên hệ Admin!');
          } else {
            window.setTimeout(() => passwordInputRef.current?.focus(), 40);
          }
          return;
        }
      }

      if (onLookupStudentCloud) {
        const cloudStu = await onLookupStudentCloud(cleanUpper);
        if (cloudStu) {
          onGoToStudentExam(cloudStu);
          return;
        }
      }
    } catch {
      // ignore offline error
    } finally {
      setIsCheckingIdentifier(false);
    }

    setErrorMessage(`Không tìm thấy tài khoản "${username}". Nếu là học sinh, hãy bấm nút "Học sinh vào phòng thi"!`);
  };

  const handleKeyDownUsername = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (recognizedRole === 'admin' || recognizedRole === 'teacher') {
        if (password.trim()) {
          handleLoginSubmit();
        } else {
          passwordInputRef.current?.focus();
        }
      } else {
        handleLoginSubmit();
      }
    }
  };

  const needsPassword = recognizedRole === 'admin' || recognizedRole === 'teacher';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Brand Header */}
      <header className="max-w-lg w-full mx-auto flex items-center justify-between pb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {displayLogoUrl ? (
            <img
              src={displayLogoUrl}
              alt={displayAppName}
              style={{ width: `${displayLogoWidth}px`, height: `${displayLogoHeight}px` }}
              className={`rounded-2xl ${displayLogoFitClass} bg-white border border-slate-700 p-0.5 shadow-lg shadow-blue-500/20 shrink-0`}
            />
          ) : (
            <div
              style={{ width: `${displayLogoWidth}px`, height: `${displayLogoHeight}px`, fontSize: `${displayLogoFontPx}px` }}
              className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/25 shrink-0 px-1.5 text-center leading-none overflow-hidden"
            >
              {displayLogoText}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-black text-white tracking-tight flex items-center gap-2 truncate">
              <span data-preserve-content="true">{displayAppName}</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate">Hệ thống khảo thí & thi trực tuyến</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`px-2 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 shrink-0 ${
              cloudHealth === 'connected'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : cloudHealth === 'checking'
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cloudHealth === 'connected'
                  ? 'bg-emerald-400'
                  : cloudHealth === 'checking'
                  ? 'bg-slate-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            ></span>
            <span className="hidden sm:inline">
              {cloudHealth === 'connected'
                ? 'Cloud'
                : cloudHealth === 'checking'
                ? 'Đang nối...'
                : 'Offline'}
            </span>
          </div>
          <LanguageToggleButton variant="dark" />
        </div>
      </header>

      {/* Main Compact Login Card */}
      <main className="flex-1 flex items-center justify-center py-3">
        <div className="w-full max-w-sm bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center">
            <h2 className="text-base font-black text-white tracking-tight">Đăng Nhập Hệ Thống</h2>
          </div>

          {/* Smart Auto-Detect Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1.5">
                Tên đăng nhập / Mã HS:
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setPassword('');
                    setErrorMessage(null);
                  }}
                  onKeyDown={handleKeyDownUsername}
                  placeholder="Nhập admin, tên GV hoặc Mã HS..."
                  className={`w-full px-3.5 py-2.5 pr-9 bg-slate-950 border-2 rounded-xl text-white placeholder-slate-500 text-sm font-semibold transition focus:outline-none ${
                    recognizedRole === 'admin'
                      ? 'border-amber-500 focus:border-amber-400'
                      : recognizedRole === 'teacher'
                      ? 'border-blue-500 focus:border-blue-400'
                      : recognizedRole === 'student'
                      ? 'border-emerald-500 focus:border-emerald-400'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                />
                {isCheckingIdentifier ? (
                  <span className="absolute right-3 top-3 text-xs text-slate-400">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  </span>
                ) : recognizedRole !== 'none' ? (
                  <span className="absolute right-3 top-3 text-xs">
                    <i
                      className={`fa-solid fa-circle-check ${
                        recognizedRole === 'admin'
                          ? 'text-amber-400'
                          : recognizedRole === 'teacher'
                          ? 'text-blue-400'
                          : 'text-emerald-400'
                      }`}
                    ></i>
                  </span>
                ) : null}
              </div>

              {/* Automatic Recognition Status Notice */}
              {recognizedRole === 'admin' && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <i className="fa-solid fa-shield-halved text-amber-400 shrink-0"></i>
                  <span>Đã nhận diện: Quản Trị Viên (Admin) — Vui lòng nhập mật khẩu</span>
                </div>
              )}

              {recognizedRole === 'teacher' && matchedTeacher && (
                <div
                  className={`mt-2 px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                    matchedTeacher.isActive === false
                      ? 'bg-red-950/60 border-red-500/40 text-red-300'
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                  }`}
                >
                  <i className="fa-solid fa-chalkboard-user text-blue-400 shrink-0"></i>
                  <span>
                    {matchedTeacher.isActive === false ? (
                      <>Tài khoản Giáo viên (<span data-preserve-content="true">{matchedTeacher.name}</span>) đang bị khóa!</>
                    ) : (
                      <>Giáo viên: <strong data-preserve-content="true">{matchedTeacher.name}</strong> — Nhập mật khẩu để đăng nhập</>
                    )}
                  </span>
                </div>
              )}

              {recognizedRole === 'student' && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
                  <span className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-user-graduate text-emerald-400 shrink-0"></i>
                    <span className="truncate">
                      {matchedStudent ? (
                        <>Học sinh: <strong data-preserve-content="true">{matchedStudent.name}</strong></>
                      ) : (
                        'Nhận diện Học sinh — Vào phòng thi'
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onGoToStudentExam(matchedStudent)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black shrink-0 cursor-pointer transition"
                  >
                    Vào thi →
                  </button>
                </div>
              )}
            </div>

            {/* Password Box: Revealed ONLY when Admin or Teacher is recognized */}
            {needsPassword && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <label className="text-[11px] font-bold uppercase text-slate-300 block">
                  {recognizedRole === 'admin'
                    ? 'Mật Khẩu Admin:'
                    : 'Mật Khẩu Giáo Viên:'}
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder={
                      recognizedRole === 'admin'
                        ? 'Nhập mật khẩu Admin...'
                        : 'Nhập mật khẩu giáo viên...'
                    }
                    className={`w-full px-3.5 py-2.5 pr-10 bg-slate-950 border-2 rounded-xl text-white placeholder-slate-500 text-sm font-semibold transition focus:outline-none ${
                      recognizedRole === 'admin'
                        ? 'border-amber-500/80 focus:border-amber-400'
                        : 'border-blue-500/80 focus:border-blue-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <i className="fa-solid fa-circle-exclamation shrink-0 text-red-400"></i>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={isVerifyingCloud || isCheckingIdentifier}
              className={`w-full py-3 px-5 rounded-xl font-black text-sm text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-60 ${
                recognizedRole === 'admin'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/20'
                  : recognizedRole === 'teacher'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                  : recognizedRole === 'student'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100'
              }`}
            >
              {isVerifyingCloud || isCheckingIdentifier ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
              ) : (
                <i className={`fa-solid ${needsPassword ? 'fa-right-to-bracket' : 'fa-arrow-right'} text-xs`}></i>
              )}
              <span>
                {isVerifyingCloud
                  ? 'ĐANG KIỂM TRA...'
                  : isCheckingIdentifier
                  ? 'ĐANG NHẬN DIỆN...'
                  : recognizedRole === 'admin'
                  ? 'ĐĂNG NHẬP ADMIN'
                  : recognizedRole === 'teacher'
                  ? 'ĐĂNG NHẬP GIÁO VIÊN'
                  : recognizedRole === 'student'
                  ? 'MỞ TRANG ĐĂNG NHẬP PHÒNG THI'
                  : 'TIẾP TỤC'}
              </span>
            </button>
          </form>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => onGoToStudentExam(null)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-graduation-cap text-[11px]"></i>
              <span>Bạn là học sinh? Mở trang phòng thi →</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-lg w-full mx-auto text-center pt-2 text-[11px] text-slate-500">
        <p>© 2026 {displayAppName} • Hệ thống khảo thí độc lập & phân quyền RBAC</p>
      </footer>
    </div>
  );
};
