import React from 'react';
import { ExamPart, Question } from '../types';
import { isQuestionExample } from '../utils/sectionUtils';

interface CambridgePart1Item {
  q: Question;
  originalIndex: number;
  localNumber: number;
}

interface CambridgePart1RWViewProps {
  part: ExamPart;
  items: CambridgePart1Item[];
  userAnswers: Record<number, any>;
  onAnswerChange: (qIdx: number, val: boolean | null) => void;
  isSubmitted: boolean;
  isTestRun?: boolean;
  questionScores?: Record<number, number>;
  activeQuestionIndex?: number;
  onSelectQuestion?: (qIdx: number) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const CambridgePart1RWView: React.FC<CambridgePart1RWViewProps> = ({
  part,
  items,
  userAnswers,
  onAnswerChange,
  isSubmitted,
  questionScores,
  activeQuestionIndex,
  onSelectQuestion,
  showToast
}) => {
  // Separate any example items if configured as questions
  const exampleQuestions = items.filter((it) => isQuestionExample(it.q, part));
  const realQuestions = items.filter((it) => !isQuestionExample(it.q, part));

  // Determine examples to display in the ▲ Examples section
  const examplesList =
    part.examplesList && part.examplesList.length > 0
      ? part.examplesList
      : exampleQuestions.length > 0
      ? exampleQuestions.map((it) => ({
          question: it.q.q.replace(/<[^>]*>/g, '').replace(/^\d+[\.\)]\s*/, '').trim(),
          answer: it.q.isTick ? '✓' : '✗',
          img: it.q.img,
          isTick: it.q.isTick
        }))
      : [
          {
            question: 'This is a pizza.',
            answer: '✓',
            img: part.example?.img,
            isTick: true
          },
          {
            question: 'This is a puppy.',
            answer: '✗',
            img: undefined,
            isTick: false
          }
        ];

  // Renumber the display items 1, 2, 3, 4...
  const displayItems = (realQuestions.length > 0 ? realQuestions : items).map((it, idx) => ({
    ...it,
    localNumber: idx + 1
  }));

  const totalPoints = part.points ?? 1.0;
  const questionCount = displayItems.length;

  // Clean statement text (remove tags or "1. ", "2. ")
  const cleanStatement = (text: string) => {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^Question\s+\d+[:\.]\s*/i, '')
      .trim();
  };

  return (
    <div className="bg-white border-2 border-slate-300 rounded-3xl p-4 sm:p-7 shadow-md space-y-6 w-full font-sans text-slate-900">
      {/* 1. TOP HEADER - Exact Cambridge Exam Style */}
      <div className="text-center space-y-2 border-b border-slate-200 pb-5">
        <div className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white font-black text-sm tracking-widest uppercase shadow-xs">
          {part.title || 'Part 1'}
        </div>
        <div className="text-xs sm:text-sm font-bold text-slate-600">
          {questionCount} questions ({totalPoints} {totalPoints === 1 ? 'point' : 'points'})
        </div>

        {/* English instructions */}
        <div className="text-sm sm:text-base font-extrabold text-slate-900 bg-slate-100/90 py-2 px-4 rounded-xl border border-slate-200 inline-block max-w-2xl">
          {part.instructions ||
            'Look and read. Put a tick (✓) or a cross (✗) in the box. There are two examples.'}
        </div>

        {/* Vietnamese subtitle */}
        <div className="text-xs sm:text-sm italic font-semibold text-slate-600 max-w-2xl mx-auto">
          {part.subInstructions ||
            'Quan sát và đọc. Đánh dấu (✓) hoặc (✗) vào ô trống. Dưới đây là 2 ví dụ.'}
        </div>
      </div>

      {/* 2. EXAMPLES SECTION - Dashed Box with Triangle Arrow */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
          <span className="text-slate-800">▲</span>
          <span>Examples:</span>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 lowercase">
            (2 câu ví dụ mẫu của bài thi)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {examplesList.map((ex, exIdx) => {
            const isTick = ex.isTick ?? (ex.answer === '✓' || ex.answer === 'tick');
            return (
              <div
                key={exIdx}
                className="border-2 border-dashed border-slate-400 bg-slate-50/70 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs"
              >
                {/* Image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  {ex.img ? (
                    <img
                      src={ex.img}
                      alt={ex.question}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span className="text-2xl">🖼️</span>
                  )}
                </div>

                {/* Statement */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Ví dụ {exIdx + 1}:
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                    {ex.question}
                  </div>
                </div>

                {/* Cambridge Square Box [✓] or [✗] */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 border-2 border-slate-900 rounded-xl flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xs select-none ${
                      isTick
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-700'
                        : 'bg-rose-50 text-rose-700 border-rose-700'
                    }`}
                    title="Ví dụ mẫu đã được đánh dấu sẵn"
                  >
                    {isTick ? '✓' : 'X'}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {isTick ? 'Tick' : 'Cross'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. QUESTIONS SECTION - 2-Column Dashed Cambridge Cards Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
          <div className="flex items-center gap-2">
            <span>Questions:</span>
            <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 lowercase">
              (Bấm vào ô vuông hoặc nút Tick/Cross để chọn đáp án)
            </span>
          </div>

          {!isSubmitted && (
            <span className="text-[11px] font-normal text-slate-500 italic lowercase">
              Mẹo: Bấm trực tiếp vào ô vuông để đổi qua lại giữa Tick (✓) và Cross (X)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {displayItems.map((item) => {
            const currentAnswer = userAnswers[item.originalIndex]; // true | false | undefined
            const isActive = activeQuestionIndex === item.originalIndex;
            const targetAnswer = item.q.isTick ?? true;
            const isAnswered = typeof currentAnswer === 'boolean';
            const isCorrect = isAnswered && currentAnswer === targetAnswer;
            const earnedScore = questionScores?.[item.originalIndex] ?? (isCorrect ? (item.q.points ?? 0.25) : 0);

            // Cycle answer: undefined -> true -> false -> undefined
            const handleBoxClick = () => {
              if (isSubmitted) return;
              if (onSelectQuestion) onSelectQuestion(item.originalIndex);

              if (currentAnswer === undefined || currentAnswer === null) {
                onAnswerChange(item.originalIndex, true);
                showToast(`Câu ${item.localNumber}: Đã chọn Tick (✓)`, 'info');
              } else if (currentAnswer === true) {
                onAnswerChange(item.originalIndex, false);
                showToast(`Câu ${item.localNumber}: Đã đổi sang Cross (X)`, 'info');
              } else {
                onAnswerChange(item.originalIndex, null);
                showToast(`Câu ${item.localNumber}: Đã xóa lựa chọn`, 'info');
              }
            };

            return (
              <div
                key={item.originalIndex}
                onClick={() => onSelectQuestion && onSelectQuestion(item.originalIndex)}
                className={`border-2 border-dashed rounded-2xl p-3 sm:p-3.5 transition flex flex-col justify-between gap-2.5 bg-white ${
                  isActive
                    ? 'border-indigo-600 ring-4 ring-indigo-400/25 shadow-md bg-indigo-50/20'
                    : isSubmitted
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-red-400 bg-red-50/30'
                    : 'border-slate-400 hover:border-slate-700 shadow-2xs'
                }`}
              >
                {/* Main Row: [Number] [Image] [Sentence] [Square Box] */}
                <div className="flex items-center gap-3">
                  {/* Number 1., 2., 3., 4. */}
                  <div className="text-base sm:text-lg font-black text-slate-900 w-6 shrink-0 text-left">
                    {item.localNumber}.
                  </div>

                  {/* Illustration Image */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 border border-slate-300 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    {item.q.img ? (
                      <img
                        src={item.q.img}
                        alt={item.q.q}
                        className="max-w-full max-h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span className="text-2xl">🖼️</span>
                    )}
                  </div>

                  {/* English Sentence */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                      {cleanStatement(item.q.q)}
                    </div>
                    {item.q.exampleHint && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.q.exampleHint}
                      </div>
                    )}
                  </div>

                  {/* Cambridge Square Answer Box [   ] */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isSubmitted}
                      onClick={handleBoxClick}
                      className={`w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-xl flex items-center justify-center font-black text-2xl sm:text-3xl transition select-none cursor-pointer shadow-xs ${
                        currentAnswer === true
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400/40'
                          : currentAnswer === false
                          ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-400/40'
                          : 'border-slate-800 bg-white hover:bg-slate-100 hover:border-indigo-600 text-slate-400'
                      } ${
                        isSubmitted
                          ? isCorrect
                            ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                            : 'border-red-600 bg-red-100 text-red-800'
                          : ''
                      }`}
                      title={isSubmitted ? undefined : 'Bấm để đánh dấu Tick (✓) hoặc Cross (X)'}
                    >
                      {currentAnswer === true ? (
                        <span>✓</span>
                      ) : currentAnswer === false ? (
                        <span>X</span>
                      ) : (
                        <span className="text-slate-300 text-lg opacity-40">?</span>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-slate-500">
                      {currentAnswer === true ? '✓ Tick' : currentAnswer === false ? 'X Cross' : 'Ô trống'}
                    </span>
                  </div>
                </div>

                {/* Sub-bar: Touch-friendly Quick Buttons & Result Status */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  {!isSubmitted ? (
                    <div className="flex items-center gap-2 w-full justify-end">
                      <span className="text-[11px] font-semibold text-slate-500 mr-auto">
                        Chọn nhanh:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onAnswerChange(item.originalIndex, true);
                          if (onSelectQuestion) onSelectQuestion(item.originalIndex);
                          showToast(`Câu ${item.localNumber}: Đã chọn Tick (✓)`, 'info');
                        }}
                        className={`px-3 py-1 rounded-lg font-black text-xs transition cursor-pointer flex items-center gap-1 ${
                          currentAnswer === true
                            ? 'bg-emerald-600 text-white shadow-xs scale-105'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        <span>✓</span>
                        <span>Tick</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onAnswerChange(item.originalIndex, false);
                          if (onSelectQuestion) onSelectQuestion(item.originalIndex);
                          showToast(`Câu ${item.localNumber}: Đã chọn Cross (X)`, 'info');
                        }}
                        className={`px-3 py-1 rounded-lg font-black text-xs transition cursor-pointer flex items-center gap-1 ${
                          currentAnswer === false
                            ? 'bg-rose-600 text-white shadow-xs scale-105'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        <span>X</span>
                        <span>Cross</span>
                      </button>

                      {isAnswered && (
                        <button
                          type="button"
                          onClick={() => {
                            onAnswerChange(item.originalIndex, null);
                            showToast(`Câu ${item.localNumber}: Đã xóa lựa chọn`, 'info');
                          }}
                          className="px-2 py-1 text-slate-400 hover:text-slate-700 text-[11px] font-semibold hover:underline"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Grading Result */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 font-black">
                        {isCorrect ? (
                          <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-circle-check"></i>
                            <span>ĐÚNG (+{earnedScore.toFixed(2)}đ)</span>
                          </span>
                        ) : (
                          <span className="text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-circle-xmark"></i>
                            <span>SAI (0đ)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-extrabold text-slate-700">
                        Đáp án đúng:{' '}
                        <strong className={targetAnswer ? 'text-emerald-700' : 'text-rose-700'}>
                          [ {targetAnswer ? '✓ Tick' : 'X Cross'} ]
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
