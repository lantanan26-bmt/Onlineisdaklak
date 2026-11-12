import React, { useState } from 'react';
import { GradeExamProfile } from '../types';
import { STANDARD_GRADES } from '../utils/gradeExamManager';

interface GradeExamSelectorBarProps {
  gradeExams: GradeExamProfile[];
  activeExamId: string;
  onSelectExam: (examId: string) => void;
  onCreateExam: (newExam: {
    grade: string;
    className: string;
    title: string;
    description: string;
    examMinutes: number;
    copyFromId?: string;
  }) => void;
  onDuplicateExam: (sourceExamId: string, targetGrade: string, targetClass: string, targetTitle: string) => void;
  onUpdateExamMeta: (examId: string, patch: Partial<GradeExamProfile>) => void;
  onDeleteExam: (examId: string) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
  availableClasses?: string[];
}

export const GradeExamSelectorBar: React.FC<GradeExamSelectorBarProps> = ({
  gradeExams,
  activeExamId,
  onSelectExam,
  onCreateExam,
  onDuplicateExam,
  onUpdateExamMeta,
  onDeleteExam,
  showToast,
  openConfirm,
  availableClasses = ['2A1', '2A2', '3B1', '3B2', '4A1']
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMetaModalOpen, setIsEditMetaModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Form state for creating new exam
  const [newGrade, setNewGrade] = useState('Khối 2');
  const [newClassName, setNewClassName] = useState('Tất cả các lớp');
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState(15);
  const [copySourceId, setCopySourceId] = useState<string>('none');

  // Form state for editing meta
  const currentExam = gradeExams.find((e) => e.id === activeExamId) || gradeExams[0];
  const [editTitle, setEditTitle] = useState(currentExam?.title || '');
  const [editGrade, setEditGrade] = useState(currentExam?.grade || 'Khối 2');
  const [editClass, setEditClass] = useState(currentExam?.className || 'Tất cả các lớp');
  const [editMinutes, setEditMinutes] = useState(currentExam?.examMinutes || 15);

  // Form state for duplicating
  const [dupTargetGrade, setDupTargetGrade] = useState('Khối 3');
  const [dupTargetClass, setDupTargetClass] = useState('Tất cả các lớp');
  const [dupTargetTitle, setDupTargetTitle] = useState('');

  const handleOpenEditModal = () => {
    if (!currentExam) return;
    setEditTitle(currentExam.title);
    setEditGrade(currentExam.grade);
    setEditClass(currentExam.className || 'Tất cả các lớp');
    setEditMinutes(currentExam.examMinutes);
    setIsEditMetaModalOpen(true);
  };

  const handleSaveEditMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentExam) return;
    onUpdateExamMeta(currentExam.id, {
      title: editTitle.trim() || currentExam.title,
      grade: editGrade,
      className: editClass,
      examMinutes: editMinutes > 0 ? editMinutes : 15
    });
    setIsEditMetaModalOpen(false);
    showToast(`✅ Đã cập nhật thông tin đề: ${editTitle.trim() || currentExam.title}!`, 'success');
  };

  const handleOpenDuplicateModal = () => {
    if (!currentExam) return;
    setDupTargetGrade(currentExam.grade === 'Khối 2' ? 'Khối 3' : 'Khối 2');
    setDupTargetClass('Tất cả các lớp');
    setDupTargetTitle(`Bản sao - ${currentExam.title}`);
    setIsDuplicateModalOpen(true);
  };

  const handleConfirmDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentExam) return;
    onDuplicateExam(
      currentExam.id,
      dupTargetGrade,
      dupTargetClass,
      dupTargetTitle.trim() || `Bản sao - ${currentExam.title}`
    );
    setIsDuplicateModalOpen(false);
  };

  const handleConfirmCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultTitle = `Đề thi ${newGrade} ${newClassName !== 'Tất cả các lớp' ? `- Lớp ${newClassName}` : ''}`.trim();

    onCreateExam({
      grade: newGrade,
      className: newClassName,
      title: newTitle.trim() || defaultTitle,
      description: `Đề thi được tạo riêng cho ${newGrade} (${newClassName}).`,
      examMinutes: newMinutes > 0 ? newMinutes : 15,
      copyFromId: copySourceId !== 'none' ? copySourceId : undefined
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setCopySourceId('none');
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-4 sm:p-5 text-white shadow-xl border-2 border-indigo-500/40 space-y-4">
      {/* Top Header Row: Grade Switcher & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center text-xl font-black shadow-lg shadow-orange-500/20 shrink-0">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider">
                QUẢN LÝ ĐỀ THI THEO KHỐI & LỚP
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold text-xs">
                Tổng cộng {gradeExams.length} đề thi
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              <span>Đang soạn:</span>
              <span className="text-amber-300 underline decoration-amber-400 underline-offset-4">
                {currentExam?.title || 'Đề thi Khối 2'}
              </span>
            </h2>
          </div>
        </div>

        {/* Action Buttons: Add new, duplicate, edit */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Tạo thêm đề thi riêng cho khối khác (Khối 1, 3, 4, 5) hoặc tạo đề riêng cho một lớp cụ thể"
          >
            <i className="fa-solid fa-plus-circle"></i>
            <span>+ Tạo Đề Khối/Lớp Mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDuplicateModal}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Sao chép toàn bộ câu hỏi và part của đề hiện tại sang một khối hoặc lớp khác để tái sử dụng"
          >
            <i className="fa-solid fa-clone"></i>
            <span className="hidden sm:inline">Sao Chép Đề Này</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEditModal}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer"
            title="Đổi tên đề, sửa khối/lớp áp dụng và thời gian phút thi"
          >
            <i className="fa-solid fa-pen-to-square"></i>
            <span className="hidden sm:inline">Sửa thông tin đề</span>
          </button>

          {gradeExams.length > 1 && (
            <button
              type="button"
              onClick={() => {
                openConfirm(
                  `Xác nhận xóa đề "${currentExam?.title}"?`,
                  `Toàn bộ câu hỏi thuộc đề ${currentExam?.grade} (${currentExam?.className || 'Tất cả lớp'}) sẽ bị xóa. Bạn có chắc chắn không?`,
                  () => onDeleteExam(currentExam.id)
                );
              }}
              className="px-2.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-800 text-red-200 border border-red-500/40 font-bold text-xs transition cursor-pointer"
              title="Xóa đề thi này"
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          )}
        </div>
      </div>

      {/* Grade Selector Tabs / Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-900/60">
        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1 mr-1">
          <i className="fa-solid fa-layer-group"></i> Chọn khối/lớp cần soạn:
        </span>

        {gradeExams.map((exam) => {
          const isActive = exam.id === activeExamId;
          const qCount = exam.questions?.length || 0;
          const pCount = exam.parts?.length || 0;

          return (
            <button
              key={exam.id}
              type="button"
              onClick={() => onSelectExam(exam.id)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                isActive
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md font-black scale-102'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-indigo-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-black/20">
                {exam.grade.replace(/\D/g, '') || 'K'}
              </span>
              <span>
                {exam.grade}
                {exam.className && exam.className !== 'Tất cả các lớp' && (
                  <span className="ml-1 opacity-80 text-[11px]">({exam.className})</span>
                )}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-black/20 text-slate-950' : 'bg-indigo-950/80 text-indigo-300'
                }`}
              >
                {pCount}P • {qCount} câu
              </span>
            </button>
          );
        })}
      </div>

      {/* Info strip about current active grade exam */}
      <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-indigo-200">Khối áp dụng:</span>
          <span className="font-extrabold text-white bg-indigo-800/80 px-2 py-0.5 rounded border border-indigo-400/30">
            {currentExam?.grade}
          </span>
          <span className="text-indigo-200">Lớp:</span>
          <span className="font-extrabold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
            {currentExam?.className || 'Tất cả các lớp'}
          </span>
          <span className="text-indigo-200">Thời gian làm bài:</span>
          <span className="font-extrabold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            ⏱️ {currentExam?.examMinutes || 15} phút
          </span>
        </div>

        <div className="text-[11px] text-indigo-300 italic">
          💡 Mọi thay đổi về câu hỏi, part, ảnh và audio bên dưới chỉ lưu riêng cho{' '}
          <strong className="text-amber-300">{currentExam?.grade}</strong>
        </div>
      </div>

      {/* MODAL 1: Create New Exam */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                <i className="fa-solid fa-plus-circle"></i> Tạo Đề Thi Cho Khối / Lớp Mới
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCreate} className="space-y-4 text-xs">
              {/* Grade Selector */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  1. Chọn Khối học (Grade): <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {STANDARD_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setNewGrade(g);
                        if (!newTitle) {
                          setNewTitle(`Đề thi Tiếng Anh ${g}`);
                        }
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        newGrade === g
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Selector */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  2. Lớp áp dụng:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNewClassName('Tất cả các lớp')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      newClassName === 'Tất cả các lớp'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Tất cả các lớp trong khối
                  </button>
                  {availableClasses.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setNewClassName(cls)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                        newClassName === cls
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      Lớp {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exam Title */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  3. Tên đề thi: <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`Ví dụ: Đề thi ${newGrade} - Học kỳ 1`}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              {/* Exam Minutes */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  4. Thời gian làm bài (Phút):
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(+e.target.value || 15)}
                  className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              {/* Initial Content / Copy Source */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  5. Nguồn câu hỏi khởi tạo:
                </label>
                <select
                  value={copySourceId}
                  onChange={(e) => setCopySourceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                >
                  <option value="none">Đề trống (Bắt đầu với 1 Part mẫu để tự soạn)</option>
                  {gradeExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      Sao chép toàn bộ từ: {e.title} ({e.grade} - {e.questions.length} câu)
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-xs shadow-md cursor-pointer"
                >
                  <i className="fa-solid fa-check mr-1"></i>Tạo Đề Thi Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Metadata */}
      {isEditMetaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square"></i> Chỉnh Sửa Thông Tin Đề Thi
              </h3>
              <button
                type="button"
                onClick={() => setIsEditMetaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditMeta} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên đề thi:</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Khối học:</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                  >
                    {STANDARD_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Lớp áp dụng:</label>
                  <input
                    type="text"
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    placeholder="Tất cả các lớp hoặc 2A1..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Thời gian làm bài (Phút):</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(+e.target.value || 15)}
                  className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditMetaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-xs shadow-md cursor-pointer"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Duplicate Exam */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-indigo-300 flex items-center gap-2">
                <i className="fa-solid fa-clone"></i> Sao Chép Đề Sang Khối / Lớp Khác
              </h3>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDuplicate} className="space-y-4 text-xs">
              <p className="text-slate-300 text-xs leading-relaxed">
                Hệ thống sẽ nhân bản toàn bộ <strong>{currentExam?.parts.length} Parts</strong> và{' '}
                <strong>{currentExam?.questions.length} câu hỏi</strong> sang một đề mới để bạn tùy chỉnh.
              </p>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Sao chép sang Khối:</label>
                <select
                  value={dupTargetGrade}
                  onChange={(e) => {
                    setDupTargetGrade(e.target.value);
                    setDupTargetTitle(`Đề thi ${e.target.value} (Tạo từ ${currentExam?.grade})`);
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                >
                  {STANDARD_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Lớp áp dụng:</label>
                <input
                  type="text"
                  value={dupTargetClass}
                  onChange={(e) => setDupTargetClass(e.target.value)}
                  placeholder="Tất cả các lớp hoặc 2A1..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên đề thi mới:</label>
                <input
                  type="text"
                  required
                  value={dupTargetTitle}
                  onChange={(e) => setDupTargetTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs shadow-md cursor-pointer"
                >
                  <i className="fa-solid fa-copy mr-1"></i>Xác Nhận Sao Chép
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
