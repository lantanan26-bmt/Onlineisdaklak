import React, { useState, useEffect } from 'react';
import { GradeExamProfile, Student } from '../types';

interface ExportOnlineExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeExam: GradeExamProfile;
  students: Student[];
  onEnterStandalonePortal: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const ExportOnlineExamModal: React.FC<ExportOnlineExamModalProps> = ({
  isOpen,
  onClose,
  activeExam,
  students,
  onEnterStandalonePortal,
  showToast
}) => {
  const [onlineUrl, setOnlineUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      setOnlineUrl(`${origin}${pathname}?role=student`);
    }
  }, []);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(onlineUrl);
      } else {
        const input = document.createElement('input');
        input.value = onlineUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast('Đã sao chép đường link Trang Thi Online Độc Lập thành công!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Không thể tự động sao chép, vui lòng bôi đen và copy đường dẫn.', 'warn');
    }
  };

  const handleOpenNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(onlineUrl, '_blank', 'noopener,noreferrer');
      showToast('Đã mở Trang Thi Học Sinh trong cửa sổ mới!');
    }
  };

  const handleDirectSwitch = () => {
    onClose();
    onEnterStandalonePortal();
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    onlineUrl
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/25 shrink-0">
              <i className="fa-solid fa-globe"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  Xuất & Phát Hành Trang Thi Online
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Trực Tuyến Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kết nối trực tiếp vào phòng thi độc lập dành cho học sinh thi trực tuyến
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Live Status Info Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-700 block">Đề thi kích hoạt</span>
            <span className="text-xs sm:text-sm font-black text-slate-900 block truncate" title={activeExam.title}>
              {activeExam.title}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {activeExam.grade} • {activeExam.questions.length} câu • {activeExam.examMinutes} phút
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-700 block">Dung lượng phòng thi</span>
            <span className="text-xs sm:text-sm font-black text-emerald-900 block">
              Hỗ trợ 500+ Học sinh
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Không trùng lặp tài khoản
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <span className="text-[11px] font-bold text-purple-700 block">Bảo mật hệ thống</span>
            <span className="text-xs sm:text-sm font-black text-purple-900 block">
              Khóa Kiosk Độc Lập
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Học sinh không thể vào Admin
            </span>
          </div>
        </div>

        {/* Link and QR Code Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
          {/* Left: QR Code */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
            <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <img
                src={qrImageUrl}
                alt="QR Code phòng thi online"
                className="w-36 h-36 rounded-lg object-contain"
                onError={(e) => {
                  // Fallback icon if offline
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1">
              <i className="fa-solid fa-qrcode text-indigo-600"></i> Quét mã vào thi ngay
            </span>
            <span className="text-[10px] text-slate-400">
              Dành cho điện thoại / iPad / Tablet
            </span>
          </div>

          {/* Right: Direct Link Actions */}
          <div className="md:col-span-8 space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Đường Dẫn (URL) Trang Thi Online Trực Tiếp:</span>
                <span className="text-[11px] font-normal text-indigo-600 font-mono">?role=student</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={onlineUrl}
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold text-indigo-900 bg-white border-2 border-indigo-200 rounded-xl select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  <span>{copied ? 'Đã Copy!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              👉 <strong>Cách sử dụng:</strong> Gửi link này cho học sinh qua Zalo, Teams, Google Classroom hoặc dán vào trình duyệt máy tính phòng lab. Học sinh truy cập link sẽ thấy ngay trang thi độc lập, chọn trường, lớp, tên và làm bài online.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Mở Trang Thi (Cửa Sổ Mới)</span>
              </button>

              <button
                type="button"
                onClick={handleDirectSwitch}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-display"></i>
                <span>Bật Chế Độ Thi Trên Máy Này</span>
              </button>
            </div>
          </div>
        </div>

        {/* Guidance and Confirmation Note */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <i className="fa-solid fa-circle-info text-amber-600"></i>
            <span>Quy trình thi độc lập:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Học sinh đăng nhập cần chọn đúng Khối, Trường, Lớp và Họ tên. Màn hình xác nhận thông tin sẽ hiện ra trước khi chính thức bấm "Bắt Đầu Làm Bài". Kết quả bài thi sẽ được tự động chấm điểm và lưu vào cơ sở dữ liệu hệ thống.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer transition"
          >
            Đóng bảng
          </button>
        </div>
      </div>
    </div>
  );
};
