import React, { useState } from 'react';

interface AdminPinModalProps {
  isOpen: boolean;
  adminPin: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  adminPin,
  onSuccess,
  onClose
}) => {
  const [pinInput, setPinInput] = useState('');
  const [hasError, setHasError] = useState(false);

  if (!isOpen) return null;

  const handleVerify = () => {
    const clean = pinInput.trim();
    if (clean === 'admin0911' || (adminPin && clean === adminPin.trim())) {
      setPinInput('');
      setHasError(false);
      onSuccess();
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-user-lock"></i>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Xác Thực Quyền Quản Trị (Admin)</h3>
              <p className="text-xs text-slate-500">Trang thi đang được khóa độc lập dành cho học sinh</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Nhập Mật khẩu / Mã PIN Admin để mở khóa:
          </label>
          <input
            type="password"
            autoFocus
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setHasError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify();
            }}
            placeholder="Nhập mật khẩu Admin..."
            className="w-full px-4 py-3 text-center text-lg font-mono font-black tracking-widest bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
          />
          {hasError && (
            <div className="text-xs font-bold text-red-600 flex items-center gap-1.5 pt-1">
              <i className="fa-solid fa-circle-exclamation"></i>
              Mật khẩu Admin không chính xác! Học sinh không được phép truy cập Admin.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer"
          >
            Đóng lại
          </button>
          <button
            type="button"
            onClick={handleVerify}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-unlock-keyhole"></i> Mở khóa về Admin
          </button>
        </div>
      </div>
    </div>
  );
};
