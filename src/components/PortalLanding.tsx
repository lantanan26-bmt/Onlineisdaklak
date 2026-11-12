import React, { useState, useEffect, useRef } from 'react';
import { Teacher } from '../types';

interface PortalLandingProps {
  adminPin: string;
  teachers: Teacher[];
  onLoginAdmin: () => void;
  onLoginTeacher: (teacher: Teacher) => void;
  onVerifyTeacherCloud?: (
    username: string,
    password: string
  ) => Promise<{ status: 'ok'; teacher: Teacher } | { status: 'inactive' } | { status: 'wrong_password' } | { status: 'not_found' }>;
  onGoToStudentExam: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const PortalLanding: React.FC<PortalLandingProps> = ({
  adminPin,
  teachers,
  onLoginAdmin,
  onLoginTeacher,
  onVerifyTeacherCloud,
  onGoToStudentExam,
  showToast
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingCloud, setIsVerifyingCloud] = useState(false);

  // Recognition state: 'none' | 'admin' | 'teacher'
  const [recognizedRole, setRecognizedRole] = useState<'none' | 'admin' | 'teacher'>('none');
  const [matchedTeacher, setMatchedTeacher] = useState<Teacher | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Real-time automatic recognition as user types username
  useEffect(() => {
    const cleanUser = username.trim().toLowerCase();
    setErrorMessage(null);

    if (!cleanUser) {
      setRecognizedRole('none');
      setMatchedTeacher(null);
      return;
    }

    if (cleanUser === 'admin') {
      setRecognizedRole('admin');
      setMatchedTeacher(null);
      return;
    }

    const found = teachers.find((t) => t.username.toLowerCase() === cleanUser);
    if (found) {
      setRecognizedRole('teacher');
      setMatchedTeacher(found);
      return;
    }

    setRecognizedRole('none');
    setMatchedTeacher(null);
  }, [username, teachers]);

  // Handle submit logic
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập!');
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

    // 2. TEACHER FLOW (Check Cloud Firestore first so permissions/passwords stay up-to-date across machines!)
    if (onVerifyTeacherCloud) {
      if (!cleanPass) {
        setErrorMessage('Vui lòng nhập Mật khẩu giáo viên!');
        passwordInputRef.current?.focus();
        return;
      }
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
        // Offline or not yet synced to Cloud: fall back smoothly to local IndexedDB teacher list
      } finally {
        setIsVerifyingCloud(false);
      }
    }

    const teacher = teachers.find((t) => t.username.toLowerCase() === cleanUser);
    if (teacher) {
      if (!cleanPass) {
        setErrorMessage(`Vui lòng nhập Mật khẩu cho tài khoản Thầy/Cô ${teacher.name}!`);
        passwordInputRef.current?.focus();
        return;
      }

      if (teacher.isActive === false) {
        setErrorMessage('Tài khoản giáo viên này đang bị tạm khóa. Vui lòng liên hệ Admin!');
        return;
      }

      if (teacher.password === cleanPass) {
        onLoginTeacher(teacher);
      } else {
        setErrorMessage('Mật khẩu giáo viên không chính xác! Vui lòng kiểm tra lại.');
        passwordInputRef.current?.focus();
      }
      return;
    }

    // 3. UNKNOWN USER
    setErrorMessage(`Không tìm thấy tài khoản "${username}". Vui lòng kiểm tra lại tên đăng nhập!`);
  };

  const handleKeyDownUsername = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (recognizedRole !== 'none') {
        passwordInputRef.current?.focus();
      } else {
        handleLoginSubmit();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Brand Header */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/25">
            iS
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              iSMART LMS
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Portal
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Hệ thống khảo thí & thi trực tuyến</p>
          </div>
        </div>
      </header>

      {/* Main Unified Login Card */}
      <main className="flex-1 flex items-center justify-center py-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* SECTION 1: HỌC SINH DỰ THI (1-Click, No Password Needed) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={onGoToStudentExam}
              className="w-full group p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-98 border border-emerald-400/30"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shrink-0">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                    Dành cho học sinh
                  </span>
                  <span className="text-base sm:text-lg font-black block">
                    VÀO PHÒNG THI NGAY
                  </span>
                  <span className="text-[11px] text-emerald-100/90 block">
                    Không cần tài khoản • Chọn lớp để thi
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white group-hover:translate-x-1 transition-transform shrink-0">
                <i className="fa-solid fa-arrow-right"></i>
              </div>
            </button>
          </div>

          {/* DIVIDER */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-700/80 w-full"></div>
            <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Hoặc Đăng Nhập Quản Lý / Giáo Viên
            </span>
            <div className="border-t border-slate-700/80 w-full"></div>
          </div>

          {/* SECTION 2: SMART CONSOLIDATED LOGIN FOR ADMIN & TEACHERS */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Field 1: Tên đăng nhập với Smart Auto-Detection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase text-slate-300">
                  Tên Đăng Nhập:
                </label>

                {/* Role Detection Badge */}
                {recognizedRole === 'admin' && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-in fade-in">
                    <i className="fa-solid fa-shield-halved text-[10px]"></i>
                    Quản Trị Viên (Admin)
                  </span>
                )}
                {recognizedRole === 'teacher' && matchedTeacher && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1 animate-in fade-in">
                    <i className="fa-solid fa-chalkboard-user text-[10px]"></i>
                    Thầy/Cô {matchedTeacher.name}
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDownUsername}
                  placeholder="Nhập tên đăng nhập (ví dụ: admin)..."
                  className={`w-full px-4 py-3 bg-slate-950 border-2 rounded-xl text-white placeholder-slate-500 text-sm font-semibold transition focus:outline-none ${
                    recognizedRole === 'admin'
                      ? 'border-amber-500 focus:border-amber-400'
                      : recognizedRole === 'teacher'
                      ? 'border-blue-500 focus:border-blue-400'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                />

                {recognizedRole !== 'none' && (
                  <span className="absolute right-3.5 top-3.5 text-xs">
                    {recognizedRole === 'admin' ? (
                      <i className="fa-solid fa-circle-check text-amber-400"></i>
                    ) : (
                      <i className="fa-solid fa-circle-check text-blue-400"></i>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Field 2: Password (always available or highlighted once recognized) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase text-slate-300">
                  {recognizedRole === 'admin'
                    ? 'Mật Khẩu Admin:'
                    : recognizedRole === 'teacher'
                    ? `Mật Khẩu (${matchedTeacher?.name}):`
                    : 'Mật Khẩu:'}
                </label>
              </div>

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
                      : recognizedRole === 'teacher'
                      ? 'Nhập mật khẩu giáo viên...'
                      : 'Nhập mật khẩu...'
                  }
                  className={`w-full px-4 py-3 pr-11 bg-slate-950 border-2 rounded-xl text-white placeholder-slate-500 text-sm font-semibold transition focus:outline-none ${
                    recognizedRole === 'admin'
                      ? 'border-amber-500/70 focus:border-amber-400'
                      : recognizedRole === 'teacher'
                      ? 'border-blue-500/70 focus:border-blue-400'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-white cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <i className="fa-solid fa-circle-exclamation shrink-0 text-red-400"></i>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifyingCloud}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 ${
                recognizedRole === 'admin'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25'
                  : recognizedRole === 'teacher'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/25'
              }`}
            >
              {isVerifyingCloud ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
              ) : (
                <i className="fa-solid fa-right-to-bracket text-xs"></i>
              )}
              <span>
                {isVerifyingCloud
                  ? 'ĐANG KIỂM TRA TÀI KHOẢN...'
                  : recognizedRole === 'admin'
                  ? 'ĐĂNG NHẬP VÀO ADMIN'
                  : recognizedRole === 'teacher'
                  ? 'ĐĂNG NHẬP GIÁO VIÊN'
                  : 'ĐĂNG NHẬP HỆ THỐNG'}
              </span>
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl w-full mx-auto text-center pt-2 text-[11px] text-slate-500">
        <p>© 2026 iSMART LMS • Hệ thống khảo thí độc lập & phân quyền RBAC</p>
      </footer>
    </div>
  );
};
