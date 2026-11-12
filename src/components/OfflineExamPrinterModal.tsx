import React, { useState } from 'react';
import { Question, ExamPart, GradeExamProfile } from '../types';

interface OfflineExamPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: ExamPart[];
  questions: Question[];
  examMinutes: number;
  gradeExams?: GradeExamProfile[];
  activeExamId?: string;
  onSelectExam?: (examId: string) => void;
}

export const OfflineExamPrinterModal: React.FC<OfflineExamPrinterModalProps> = ({
  isOpen,
  onClose,
  parts,
  questions,
  examMinutes,
  gradeExams,
  activeExamId,
  onSelectExam,
}) => {
  const [printTab, setPrintTab] = useState<'paper' | 'answersheet'>('paper');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full text-slate-900 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:border-none">
        {/* Modal Toolbar - Hidden during print */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-md">
              <i className="fa-solid fa-print"></i>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                IN ĐỀ THI & PHIẾU LÀM BÀI CHO HỌC SINH THI OFFLINE
              </h3>
              <p className="text-xs text-slate-400">
                In ra giấy để phát cho học sinh làm bài khi trường không có phòng máy vi tính
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {gradeExams && gradeExams.length > 0 && onSelectExam && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-amber-400">🎒 Chọn đề in:</span>
                <select
                  value={activeExamId || gradeExams[0]?.id}
                  onChange={(e) => onSelectExam(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {gradeExams.map((ge) => (
                    <option key={ge.id} value={ge.id}>
                      {ge.grade} {ge.className && ge.className !== 'Tất cả các lớp' ? `(${ge.className})` : ''} - {ge.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab switch */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintTab('paper')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  printTab === 'paper' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Đề thi đầy đủ
              </button>
              <button
                type="button"
                onClick={() => setPrintTab('answersheet')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  printTab === 'answersheet' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Phiếu trả lời (1 trang A4)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition active:scale-95"
            >
              <i className="fa-solid fa-print"></i>
              <span>In ra giấy (Print)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 font-sans print:overflow-visible print:p-4">
          {/* TAB 1: FULL EXAM PAPER */}
          {printTab === 'paper' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Paper Header Box */}
              <div className="border-2 border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div>
                    <h2 className="text-base font-black uppercase text-slate-900 tracking-wider">
                      BÀI KIỂM TRA ĐỊNH KỲ TIẾNG ANH
                    </h2>
                    <p className="text-xs text-slate-600 font-semibold">
                      Chương trình iSMART LMS • Thời gian làm bài: <strong>{examMinutes} phút</strong> • Tổng số câu: <strong>{questions.length} câu</strong>
                    </p>
                  </div>
                  <div className="border border-slate-400 p-2 text-center rounded-lg min-w-[100px]">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">Điểm số</span>
                    <span className="block text-xl font-black text-slate-800">..... / 10</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
                  <div>
                    <span className="text-slate-500 block">Họ và tên:</span>
                    <span className="border-b border-dotted border-slate-800 block pb-1">........................................</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lớp:</span>
                    <span className="border-b border-dotted border-slate-800 block pb-1">........................................</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Trường:</span>
                    <span className="border-b border-dotted border-slate-800 block pb-1">........................................</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Số báo danh (SBD):</span>
                    <span className="border-b border-dotted border-slate-800 block pb-1">........................................</span>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6 pt-2">
                {parts.map((p, pIdx) => {
                  const partQuestions = questions.filter((q) => (q.partId || parts[0]?.id) === p.id);
                  return (
                    <div key={p.id} className="space-y-4">
                      {/* Part Title */}
                      <div className="bg-slate-100 p-3 rounded-lg border-l-4 border-indigo-600">
                        <h3 className="text-sm font-black text-slate-900 uppercase">
                          {p.title} ({p.points} điểm)
                        </h3>
                        {p.instructions && (
                          <p className="text-xs text-slate-600 italic mt-0.5">{p.instructions}</p>
                        )}
                      </div>

                      {/* Part Picture if exists */}
                      {p.img && (
                        <div className="text-center space-y-1">
                          <img
                            src={p.img}
                            alt="Part picture"
                            className="max-h-56 mx-auto border border-slate-300 rounded-lg object-contain"
                          />
                          {p.imageTitle && (
                            <span className="block text-xs font-black uppercase tracking-widest text-slate-800 font-serif">
                              {p.imageTitle}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Part Questions */}
                      <div className="space-y-4 pl-2">
                        {partQuestions.map((q) => {
                          const globalIdx = questions.indexOf(q);
                          const isEx = !!q.isExample;
                          const realQuestionsBefore = questions.slice(0, globalIdx).filter((item) => !item.isExample).length;
                          const qNumber = isEx ? 0 : realQuestionsBefore + 1;
                          return (
                            <div key={globalIdx} className="space-y-2 border-b border-slate-200 pb-3">
                              <div className="flex items-start gap-2">
                                {isEx ? (
                                  <span className="font-black text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                                    ★ Ví dụ mẫu (0đ - Không tính điểm):
                                  </span>
                                ) : (
                                  <span className="font-black text-xs text-slate-900 min-w-[55px]">
                                    Câu {qNumber} ({q.points ?? 0.5}đ):
                                  </span>
                                )}
                                <div className="text-xs font-bold text-slate-800 flex-1">
                                  {q.q || 'Quan sát và trả lời:'}
                                </div>
                              </div>

                              {/* Question Image if any */}
                              {q.img && (
                                <img
                                  src={q.img}
                                  alt="Câu hỏi"
                                  className="max-h-40 rounded-lg border border-slate-200 object-contain ml-14"
                                />
                              )}

                              {/* Options */}
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-14 text-xs">
                                  {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full border border-slate-400 font-mono text-[11px] font-bold flex items-center justify-center">
                                        {String.fromCharCode(65 + oi)}
                                      </span>
                                      <span className="font-medium text-slate-700">{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Yes / No */}
                              {q.type === 'yes-no' && (
                                <div className="flex items-center gap-4 ml-14 text-xs font-bold">
                                  <label className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 border border-slate-400 inline-block"></span>
                                    <span>YES (Đúng)</span>
                                  </label>
                                  <label className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 border border-slate-400 inline-block"></span>
                                    <span>NO (Sai)</span>
                                  </label>
                                </div>
                              )}

                              {/* Tick / Cross */}
                              {q.type === 'tick-cross' && (
                                <div className="flex items-center gap-4 ml-14 text-xs font-bold">
                                  <label className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 border border-slate-400 inline-block"></span>
                                    <span>Tick [ ✔ ]</span>
                                  </label>
                                  <label className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 border border-slate-400 inline-block"></span>
                                    <span>Cross [ ✘ ]</span>
                                  </label>
                                </div>
                              )}

                              {/* Written Answer Line */}
                              {(q.type === 'listen-write' || q.type === 'unscramble-word') && (
                                <div className="ml-14 text-xs font-medium">
                                  Trả lời: ..........................................................................................
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: COMPACT 1-PAGE ANSWER SHEET (PHIẾU TRẢ LỜI) */}
          {printTab === 'answersheet' && (
            <div className="space-y-5 max-w-2xl mx-auto border-2 border-slate-800 p-6 rounded-2xl bg-white">
              <div className="text-center space-y-1 border-b-2 border-slate-800 pb-3">
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wider">
                  PHIẾU TRẢ LỜI BÀI THI TIẾNG ANH (ANSWER SHEET)
                </h2>
                <p className="text-xs text-slate-600">
                  Dùng camera điện thoại để quét và chấm tự động • Gồm {questions.length} câu hỏi
                </p>
              </div>

              {/* Student Header Info */}
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold border-b border-slate-300 pb-3">
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500">Họ và tên học sinh:</span>
                    <div className="border-b border-slate-600 h-6"></div>
                  </div>
                  <div>
                    <span className="text-slate-500">Lớp:</span>
                    <div className="border-b border-slate-600 h-6"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500">Trường học:</span>
                    <div className="border-b border-slate-600 h-6"></div>
                  </div>
                  <div>
                    <span className="text-slate-500">Số báo danh (SBD):</span>
                    <div className="border-b border-slate-600 h-6"></div>
                  </div>
                </div>
              </div>

              {/* Numbered Bubble / Answer Grid */}
              <div className="space-y-3">
                <div className="text-xs font-black uppercase text-slate-700 tracking-wide">
                  HỌC SINH TÔ ĐẬM VÀO ĐÁP ÁN ĐÚNG HOẶC VIẾT CÂU TRẢ LỜI:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {questions.map((q, idx) => {
                    const isEx = !!q.isExample;
                    const realQuestionsBefore = questions.slice(0, idx).filter((item) => !item.isExample).length;
                    const qNum = isEx ? 0 : realQuestionsBefore + 1;
                    if (isEx) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between border-b border-amber-200 bg-amber-50/70 p-1.5 rounded text-xs font-bold"
                        >
                          <span className="text-amber-900 flex items-center gap-1">
                            <i className="fa-solid fa-lightbulb text-amber-600 text-xs"></i>
                            <span>Ví dụ:</span>
                          </span>
                          <span className="text-[11px] text-amber-800 font-semibold italic">
                            Đã làm mẫu sẵn (0đ - Không chấm)
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-slate-200 pb-1.5 text-xs font-bold"
                      >
                        <span className="w-14 text-slate-900">Câu {qNum}:</span>

                        {q.options && q.options.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {q.options.map((_, oi) => (
                              <span
                                key={oi}
                                className="w-6 h-6 rounded-full border-2 border-slate-600 text-slate-700 font-mono text-[11px] font-black flex items-center justify-center"
                              >
                                {String.fromCharCode(65 + oi)}
                              </span>
                            ))}
                          </div>
                        ) : q.type === 'yes-no' ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded border border-slate-600 text-[11px]">YES</span>
                            <span className="px-2 py-0.5 rounded border border-slate-600 text-[11px]">NO</span>
                          </div>
                        ) : q.type === 'tick-cross' ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded border border-slate-600 text-[11px]">✔ Tick</span>
                            <span className="px-2 py-0.5 rounded border border-slate-600 text-[11px]">✘ Cross</span>
                          </div>
                        ) : (
                          <span className="border-b border-slate-400 w-32 inline-block"></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions footer */}
              <div className="border-t border-slate-300 pt-3 text-[11px] text-slate-500 text-center italic">
                * Hướng dẫn: Học sinh tô kín vòng tròn đáp án đúng bằng bút chì hoặc bút bi. Không làm rách hoặc gập mép giấy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
