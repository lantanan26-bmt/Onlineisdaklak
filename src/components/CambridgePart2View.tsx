import React, { useState } from 'react';
import { ExamPart, Question } from '../types';
import { AudioPlayerBox } from './AudioPlayerBox';
import { isQuestionExample } from '../utils/sectionUtils';

interface CambridgePart2Item {
  q: Question;
  originalIndex: number;
  localNumber: number;
}

interface CambridgePart2ViewProps {
  part: ExamPart;
  items: CambridgePart2Item[];
  userAnswers: Record<number, any>;
  onAnswerChange: (qIdx: number, val: string) => void;
  isSubmitted: boolean;
  isTestRun?: boolean;
  questionScores?: Record<number, number>;
  activeQuestionIndex?: number;
  onSelectQuestion?: (qIdx: number) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const CambridgePart2View: React.FC<CambridgePart2ViewProps> = ({
  part,
  items,
  userAnswers,
  onAnswerChange,
  isSubmitted,
  isTestRun = false,
  questionScores,
  activeQuestionIndex,
  onSelectQuestion,
  showToast
}) => {
  const [zoomImage, setZoomImage] = useState(false);

  // Identify any example questions
  const exampleItemsFromProps = items.filter((it) => isQuestionExample(it.q, part));
  const realItems = items.filter((it) => !isQuestionExample(it.q, part));

  // Determine examples list for the EXAMPLES box
  const examples = (part.examplesList && part.examplesList.length > 0)
    ? part.examplesList
    : exampleItemsFromProps.length > 0
    ? exampleItemsFromProps.map((it) => ({
        question: it.q.q.replace(/<[^>]*>/g, '').replace(/^\d+[\.\)]\s*/, '').trim(),
        answer: (it.q.acceptableAnswers && it.q.acceptableAnswers[0]) || 'Mẫu'
      }))
    : [
        { question: "What is the girl's name?", answer: "Kim" },
        { question: "How old is Kim?", answer: "8" }
      ];

  // Renumber the real questions so the first real question starts at 1
  // (e.g. if Câu 1 and 2 in editor are examples, Câu 3 becomes Câu 1 in the exam)
  const displayItems = (realItems.length > 0 ? realItems : items).map((item, idx) => ({
    ...item,
    localNumber: idx + 1
  }));

  const totalPoints = part.points ?? 1.0;
  const questionCount = displayItems.length;

  return (
    <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-8 shadow-md space-y-6 w-full font-sans text-slate-900">
      {/* 1. TOP SECTION: ĐỀ BÀI (Chung cho cả Part 2) */}
      <div className="text-center space-y-2 border-b border-slate-200 pb-5">
        <div className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white font-black text-sm tracking-widest uppercase shadow-xs">
          {part.title || 'Part 2'}
        </div>
        <div className="text-xs sm:text-sm font-bold text-slate-600">
          {questionCount} questions ({totalPoints} {totalPoints === 1 ? 'point' : 'points'})
        </div>

        {/* English instructions */}
        <div className="text-sm sm:text-base font-extrabold text-slate-900 bg-slate-100/80 py-2 px-4 rounded-xl border border-slate-200/60 inline-block max-w-2xl">
          {part.instructions || 'Read the questions. Listen and write a name or a number. There are two examples.'}
        </div>

        {/* Vietnamese subtitle */}
        <div className="text-xs sm:text-sm italic font-semibold text-slate-600 max-w-2xl mx-auto">
          {part.subInstructions || 'Đọc câu hỏi. Lắng nghe và viết tên hoặc số thích hợp. Dưới đây là 2 ví dụ.'}
        </div>
      </div>

      {/* 2. AUDIO PLAYER CHUNG CHO CẢ PART 2 */}
      {part.audio && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="font-extrabold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
              <i className="fa-solid fa-headphones text-indigo-600 text-sm"></i>
              <span>File âm thanh bài nghe chung cho toàn bộ Part 2:</span>
            </span>
            <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
              Nghe chung cho câu ví dụ và các câu hỏi 1 - {questionCount}
            </span>
          </div>

          <AudioPlayerBox
            audio={part.audio}
            maxPlayCount={part.maxPlayCount ?? 2}
            isSubmitted={isSubmitted}
            questionIndex={-2}
            showToast={showToast}
          />
        </div>
      )}

      {/* 3. BỨC TRANH CHUNG CỦA PART 2 & TÊN CỦA ẢNH DƯỚI TRANH */}
      {part.img && (
        <div className="space-y-3 pt-1">
          <div className="flex justify-center">
            <div className="relative group max-w-5xl w-full rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md bg-amber-50/30">
              <img
                src={part.img}
                alt={part.imageTitle ? part.imageTitle.trim() : 'Part scene image'}
                className="w-full h-auto object-contain max-h-[580px] sm:max-h-[640px] mx-auto block cursor-zoom-in"
                onClick={() => setZoomImage(true)}
              />
              <button
                type="button"
                onClick={() => setZoomImage(true)}
                className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur flex items-center gap-1.5 cursor-pointer transition shadow-md"
              >
                <i className="fa-solid fa-expand"></i>
                <span>Xem Toàn Màn Hình</span>
              </button>
            </div>
          </div>

          {/* TÊN CỦA ẢNH (Chỉ hiển thị nếu giáo viên có điền tên, nếu không điền thì hoàn toàn không hiển thị) */}
          {part.imageTitle && part.imageTitle.trim().length > 0 && (
            <div className="text-center pt-1">
              <h3 className="text-base sm:text-xl font-black uppercase tracking-widest text-slate-900 font-serif">
                {part.imageTitle.trim()}
              </h3>
            </div>
          )}
        </div>
      )}

      {/* 4. PHẦN TIẾP THEO: CÁC CÂU VÍ DỤ (EXAMPLES) */}
      <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
          <span className="text-sm font-black italic uppercase text-amber-950 tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-lightbulb text-amber-600"></i>
            <span>Examples:</span>
          </span>
          <span className="text-[11px] font-bold text-amber-900 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
            ✓ 2 câu ví dụ mẫu đã có đáp án sẵn
          </span>
        </div>

        <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-bold text-slate-800 pl-1 sm:pl-3">
          {examples.map((ex, idx) => (
            <div key={idx} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-amber-100/80 pb-1.5 last:border-none">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <span className="text-slate-700">{ex.question}</span>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="inline-block min-w-[90px] text-right font-black text-sm sm:text-base text-slate-950 italic border-b-2 border-slate-800 pb-0.5 px-2">
                  {ex.answer}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Mẫu
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. CÁC CÂU HỎI VÀ TRẢ LỜI CÓ LIÊN QUAN TỚI ẢNH & AUDIO (Questions 1 - 4) */}
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between gap-2 border-b-2 border-slate-200 pb-2">
          <span className="text-xs sm:text-sm font-black uppercase text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-pencil text-blue-600"></i>
            <span>Questions (Nghe và điền câu trả lời):</span>
          </span>
          <span className="text-xs text-slate-500 font-semibold">
            Gõ tên (name) hoặc con số (number) nghe được vào dòng kẻ
          </span>
        </div>

        <div className="space-y-4">
          {displayItems.map((item) => {
            const q = item.q;
            const qIdx = item.originalIndex;
            const currentAns = String(userAnswers[qIdx] || '');
            const acceptableList = (q.acceptableAnswers || []).map((a) => a.trim().toLowerCase());
            const isCorrect = acceptableList.length === 0
              ? true
              : acceptableList.includes(currentAns.trim().toLowerCase());
            const earnedPoints = isCorrect ? (q.points ?? (totalPoints / questionCount)) : 0;
            const isActive = activeQuestionIndex === qIdx;

            // Strip leading "1. ", "2. ", "3. ", "1) " etc. so it cleanly uses item.localNumber
            const cleanQuestionText = q.q
              .replace(/^<strong>\s*\d+[\.\)]\s*/i, '<strong>')
              .replace(/^\d+[\.\)]\s*/i, '');

            return (
              <div
                key={qIdx}
                onClick={() => onSelectQuestion?.(qIdx)}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-2 ring-blue-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Question Number & Text */}
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5">
                      {item.localNumber}.
                    </span>
                    <div
                      className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed pt-1"
                      dangerouslySetInnerHTML={{ __html: cleanQuestionText }}
                    />
                  </div>

                  {/* Cambridge Underline Interactive Input */}
                  <div className="flex items-center gap-3 shrink-0 sm:min-w-[280px] justify-end">
                    <div className="relative w-full sm:w-60">
                      <input
                        type="text"
                        disabled={isSubmitted}
                        value={currentAns}
                        onChange={(e) => onAnswerChange(qIdx, e.target.value)}
                        placeholder="Điền tên hoặc số..."
                        className={`w-full py-1.5 px-3 text-sm sm:text-base font-bold text-slate-900 border-b-2 focus:outline-none transition-all ${
                          isSubmitted
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-black'
                              : 'border-red-500 bg-red-50/80 text-red-950 font-black'
                            : 'border-slate-800 focus:border-blue-600 bg-transparent placeholder-slate-400 focus:bg-blue-50/30'
                        }`}
                      />
                    </div>

                    {/* Result Badge after submission */}
                    {isSubmitted && (
                      <span
                        className={`px-2.5 py-1 rounded-xl font-black text-xs shrink-0 flex items-center gap-1 ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <i className="fa-solid fa-circle-check text-emerald-600"></i>
                            <span>+{earnedPoints.toFixed(2)}đ</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-circle-xmark text-red-600"></i>
                            <span>0đ</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acceptable answers display after submission */}
                {isSubmitted && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs flex items-center justify-between flex-wrap gap-2">
                    <span className="text-slate-500">
                      Đáp án được chấp nhận: <strong className="text-emerald-700">{(q.acceptableAnswers || []).join(' / ')}</strong>
                    </span>
                    {!isCorrect && (
                      <span className="text-red-600 font-bold text-[11px]">
                        Em đã điền: "{currentAns || '(chưa điền)'}"
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal for Picture */}
      {zoomImage && part.img && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 animate-in fade-in"
          onClick={() => setZoomImage(false)}
        >
          <div
            className="max-w-6xl w-full max-h-[95vh] bg-slate-900 border-2 border-indigo-400/40 rounded-3xl p-3 sm:p-5 flex flex-col space-y-3 text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                  <i className="fa-solid fa-image text-indigo-400"></i>
                  <span>Bức tranh toàn cảnh: {part.imageTitle || 'Part 2 Scene'}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Phóng to cực đại để học sinh quan sát rõ từng chi tiết
                </p>
              </div>

              <button
                type="button"
                onClick={() => setZoomImage(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
                title="Đóng xem to"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 max-h-[78vh] overflow-auto flex items-center justify-center bg-black/60 rounded-2xl p-2 border border-white/10">
              <img
                src={part.img}
                alt="Scene full size"
                className="max-h-[74vh] w-auto object-contain mx-auto rounded-lg shadow-2xl"
              />
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setZoomImage(false)}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Đóng ảnh & Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
