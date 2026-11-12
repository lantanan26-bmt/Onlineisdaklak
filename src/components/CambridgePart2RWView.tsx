import React, { useState } from 'react';
import { ExamPart, Question } from '../types';
import { isQuestionExample } from '../utils/sectionUtils';
import { GRADE2_MEDIA } from '../advancedGrade2Data';

export interface CambridgePart2RWItem {
  q: Question;
  originalIndex: number;
  localNumber: number;
}

export interface CambridgePart2RWViewProps {
  part: ExamPart;
  items: CambridgePart2RWItem[];
  userAnswers: Record<number, any>;
  onAnswerChange: (qIdx: number, val: number) => void;
  isSubmitted: boolean;
  isTestRun?: boolean;
  questionScores?: Record<number, number>;
  activeQuestionIndex?: number;
  onSelectQuestion?: (qIdx: number) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const CambridgePart2RWView: React.FC<CambridgePart2RWViewProps> = ({
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
  const [imageScale, setImageScale] = useState<number>(100);
  const [lightboxScale, setLightboxScale] = useState<number>(100);
  const [layoutMode, setLayoutMode] = useState<'top' | 'side'>('top');

  // Separate example questions from real questions
  const exampleItemsFromProps = items.filter((it) => isQuestionExample(it.q, part));
  const realItems = items.filter((it) => !isQuestionExample(it.q, part));

  // Determine examples to display in the Examples box
  const examples = (part.examplesList && part.examplesList.length > 0)
    ? part.examplesList
    : exampleItemsFromProps.length > 0
    ? exampleItemsFromProps.map((it) => {
        const cleanQ = it.q.q.replace(/<[^>]*>/g, '').replace(/^\d+[\.\)]\s*/, '').trim();
        const isYes = (it.q.correctIndex ?? 0) === 0;
        return {
          question: cleanQ || 'Example question',
          answer: isYes ? 'yes' : 'no'
        };
      })
    : [
        { question: 'A girl is playing the guitar.', answer: 'yes' },
        { question: 'The puppy is on the table.', answer: 'no' }
      ];

  // Renumber the real questions so the first real question starts at 1
  const displayItems = (realItems.length > 0 ? realItems : items).map((item, idx) => ({
    ...item,
    localNumber: idx + 1
  }));

  const totalPoints = part.points ?? 1.0;
  const questionCount = displayItems.length;

  // Scene image: priority from part.img, fallback to first question with an image, or standard party scene
  const sceneImage = part.img || items.find((it) => it.q.img)?.q.img || GRADE2_MEDIA?.partyBackyard;

  const playTTS = (text: string) => {
    if (!text) return;
    const clean = text.replace(/<[^>]*>/g, '').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
    showToast('Đang phát giọng đọc mẫu...', 'info');
  };

  // Reusable Picture Component
  const renderPictureBox = (isCompact: boolean = false) => {
    if (!sceneImage) return null;
    return (
      <div className="bg-slate-50 border-2 border-teal-300/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <span className="font-extrabold text-teal-950 flex items-center gap-1.5 uppercase text-xs sm:text-sm">
            <i className="fa-solid fa-image text-teal-600 text-sm"></i>
            <span>Bức tranh toàn cảnh (Look at the picture):</span>
          </span>

          {/* Quick Zoom Controls for Students */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-white border border-teal-300 rounded-xl px-1.5 py-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setImageScale((prev) => Math.max(100, prev - 25))}
                disabled={imageScale <= 100}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 disabled:opacity-30 cursor-pointer text-xs"
                title="Thu nhỏ ảnh"
              >
                <i className="fa-solid fa-minus"></i>
              </button>
              <span className="text-[11px] font-black text-teal-900 w-12 text-center select-none">
                {imageScale}%
              </span>
              <button
                type="button"
                onClick={() => setImageScale((prev) => Math.min(175, prev + 25))}
                disabled={imageScale >= 175}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 disabled:opacity-30 cursor-pointer text-xs"
                title="Phóng to ảnh"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setLightboxScale(100);
                setZoomImage(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Mở toàn màn hình để soi rõ từng chi tiết"
            >
              <i className="fa-solid fa-expand"></i>
              <span>Xem Toàn Màn Hình</span>
            </button>
          </div>
        </div>

        {/* Scrollable image container with scale zoom */}
        <div
          className={`relative group rounded-xl overflow-auto border-2 border-slate-300/80 bg-white shadow-inner flex items-center justify-center transition-all ${
            isCompact ? 'max-h-[480px]' : 'max-h-[580px] sm:max-h-[640px]'
          }`}
        >
          <img
            src={sceneImage}
            alt={part.imageTitle || 'Reading & Writing Part 2 Scene'}
            style={{
              transform: `scale(${imageScale / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out'
            }}
            className="w-full h-auto object-contain mx-auto block hover:opacity-95 cursor-zoom-in py-1"
            onClick={() => {
              setLightboxScale(100);
              setZoomImage(true);
            }}
          />
          <div
            onClick={() => {
              setLightboxScale(100);
              setZoomImage(true);
            }}
            className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur flex items-center gap-1.5 cursor-pointer transition shadow-md"
          >
            <i className="fa-solid fa-magnifying-glass-plus"></i>
            <span>Bấm để phóng cực to</span>
          </div>
        </div>

        {/* Picture Title / Caption */}
        {part.imageTitle && part.imageTitle.trim().length > 0 && (
          <div className="text-center pt-1.5">
            <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-900 font-serif">
              {part.imageTitle.trim()}
            </h3>
          </div>
        )}
      </div>
    );
  };

  // Reusable Examples Box Component
  const renderExamplesBox = () => (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300 rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200 pb-2">
        <span className="text-xs sm:text-sm font-black uppercase text-amber-950 tracking-wider flex items-center gap-2">
          <i className="fa-solid fa-lightbulb text-amber-600"></i>
          <span>Examples (Câu ví dụ mẫu):</span>
        </span>
        <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-900 bg-white px-2 py-0.5 rounded-full border border-amber-300 shadow-xs">
          ✓ 2 câu đã làm mẫu sẵn (0đ)
        </span>
      </div>

      <div className="space-y-2 text-xs sm:text-sm">
        {examples.map((ex, exIdx) => {
          const isYes = ex.answer?.toLowerCase().includes('yes') || ex.answer === '✓';
          return (
            <div
              key={exIdx}
              className="flex flex-wrap items-center justify-between gap-2 bg-white/90 p-2.5 rounded-xl border border-amber-200/80 shadow-xs"
            >
              <div className="flex items-start gap-2 flex-1 min-w-[200px]">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {exIdx + 1}
                </span>
                <span className="font-bold text-slate-800 leading-snug">
                  {ex.question}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <span className="text-slate-400 font-mono font-bold text-xs">➔</span>
                <span
                  className={`px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                    isYes
                      ? 'bg-emerald-600 text-white border border-emerald-500'
                      : 'bg-rose-600 text-white border border-rose-500'
                  }`}
                >
                  <i className={`fa-solid ${isYes ? 'fa-check' : 'fa-xmark'}`}></i>
                  <span>{isYes ? 'yes' : 'no'}</span>
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  Mẫu
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-amber-900 font-medium italic bg-amber-100/60 p-2 rounded-lg">
        💡 Hướng dẫn làm bài: Quan sát bức tranh toàn cảnh. Đọc từng câu và bấm nút <strong>YES</strong> nếu câu đó đúng với tranh, hoặc <strong>NO</strong> nếu câu sai.
      </div>
    </div>
  );

  // Reusable Questions List Component
  const renderQuestionsList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <h4 className="text-xs sm:text-sm font-black uppercase text-teal-950 flex items-center gap-1.5 tracking-wide">
          <i className="fa-solid fa-list-check text-teal-600"></i>
          <span>Questions (Các câu hỏi làm bài chính):</span>
        </h4>
        <span className="text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2.5 py-0.5 rounded-full border border-teal-300">
          {displayItems.filter((it) => userAnswers[it.originalIndex] !== undefined).length}/{displayItems.length} đã trả lời
        </span>
      </div>

      <div className="space-y-3.5">
        {displayItems.map((item) => {
          const currentAns = userAnswers[item.originalIndex];
          const hasAnswered = currentAns !== undefined && currentAns !== null;
          const isSelectedYes = currentAns === 0;
          const isSelectedNo = currentAns === 1;

          const correctIdx = item.q.correctIndex ?? 0;
          const isCorrect = hasAnswered && currentAns === correctIdx;
          const pointsEarned = questionScores ? questionScores[item.originalIndex] ?? (isCorrect ? (item.q.points ?? 0.25) : 0) : 0;
          const isActive = activeQuestionIndex === item.originalIndex;

          const cleanStatement = item.q.q
            .replace(/<[^>]*>/g, '')
            .replace(/^\d+[\.\)]\s*/, '')
            .replace(/Quan sát bức tranh.*$/i, '')
            .replace(/Chọn.*$/i, '')
            .trim();

          return (
            <div
              key={item.originalIndex}
              id={`cambridge-rw2-card-${item.originalIndex}`}
              onClick={() => onSelectQuestion && onSelectQuestion(item.originalIndex)}
              className={`border-2 rounded-2xl p-4 sm:p-4.5 transition-all space-y-3 ${
                isActive
                  ? 'border-teal-500 bg-teal-50/40 ring-4 ring-teal-300/40 shadow-md'
                  : hasAnswered
                  ? 'border-slate-300 bg-white shadow-xs hover:border-teal-300'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-white shadow-xs'
              }`}
            >
              {/* Question Header: Number, points & audio */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {item.localNumber}
                  </span>
                  <span className="font-extrabold text-xs text-slate-700">
                    Câu {item.localNumber}
                  </span>
                  <span className="text-[11px] font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded">
                    {item.q.points ?? 0.25} đ
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* TTS speaker button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTTS(cleanStatement);
                    }}
                    className="w-7 h-7 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 flex items-center justify-center text-xs transition cursor-pointer"
                    title="Nghe phát âm câu này (TTS)"
                  >
                    <i className="fa-solid fa-volume-high"></i>
                  </button>

                  {hasAnswered ? (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <i className="fa-solid fa-circle-check"></i> Đã chọn: {isSelectedYes ? 'YES' : 'NO'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Chưa trả lời
                    </span>
                  )}
                </div>
              </div>

              {/* Statement Sentence */}
              <div className="text-sm sm:text-base font-bold text-slate-900 pl-1 leading-relaxed">
                <span className="font-black text-teal-800 mr-1.5">{item.localNumber}.</span>
                <span>{cleanStatement}</span>
              </div>

              {/* YES / NO Interactive Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* YES Button */}
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnswerChange(item.originalIndex, 0);
                    showToast(`Câu ${item.localNumber}: Bạn đã chọn YES`, 'info');
                  }}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSelectedYes
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-4 ring-emerald-300/60 scale-[1.02]'
                      : isSubmitted
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500 shadow-xs active:scale-95'
                  }`}
                >
                  <i className="fa-solid fa-check text-base"></i>
                  <span>YES (Đúng)</span>
                  {isSelectedYes && (
                    <span className="ml-1 text-[11px] bg-white/25 px-1.5 py-0.2 rounded font-extrabold">
                      ✓ Đã chọn
                    </span>
                  )}
                </button>

                {/* NO Button */}
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnswerChange(item.originalIndex, 1);
                    showToast(`Câu ${item.localNumber}: Bạn đã chọn NO`, 'info');
                  }}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSelectedNo
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-4 ring-rose-300/60 scale-[1.02]'
                      : isSubmitted
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50 hover:border-rose-500 shadow-xs active:scale-95'
                  }`}
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                  <span>NO (Sai)</span>
                  {isSelectedNo && (
                    <span className="ml-1 text-[11px] bg-white/25 px-1.5 py-0.2 rounded font-extrabold">
                      ✓ Đã chọn
                    </span>
                  )}
                </button>
              </div>

              {/* Feedback when submitted or in test-run */}
              {(isSubmitted || isTestRun) && hasAnswered && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-xs font-bold flex flex-col gap-1 ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-black">
                      <i className={`fa-solid ${isCorrect ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}`}></i>
                      <span>{isCorrect ? 'Chính xác! (+ ' + pointsEarned + 'đ)' : 'Chưa đúng (0đ)'}</span>
                    </span>
                    <span>
                      Đáp án đúng: <strong>{correctIdx === 0 ? 'YES' : 'NO'}</strong>
                    </span>
                  </div>

                  {item.q.explanation && (
                    <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200 italic">
                      💡 Giải thích: {item.q.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-white border-2 border-teal-300/80 rounded-3xl p-4 sm:p-7 shadow-lg space-y-6 w-full font-sans text-slate-900">
      {/* 1. TOP HEADER: Tiêu đề Part 2, hướng dẫn & bộ điều khiển hiển thị */}
      <div className="space-y-3 border-b border-teal-100 pb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-teal-700 to-emerald-700 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-xs">
              <i className="fa-solid fa-book-open"></i>
              <span>{part.title || 'Part 2: Look and read (Yes / No)'}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-300 text-teal-900 text-xs font-bold">
              {questionCount} câu hỏi • Thang điểm: <strong>{totalPoints} đ</strong>
            </span>
          </div>

          {/* Layout Switcher (Ảnh lớn trên đầu / Ảnh chia đôi cột) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode('top')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'top'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Đặt bức tranh khổ to ở trên cùng để nhìn rõ nhất"
            >
              <i className="fa-solid fa-table-cells-large"></i>
              <span>Ảnh Lớn Trên Đầu</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('side')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'side'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Đặt ảnh song song bên trái câu hỏi"
            >
              <i className="fa-solid fa-table-columns"></i>
              <span>Ảnh Bên Cạnh</span>
            </button>
          </div>
        </div>

        {/* English instructions */}
        <div className="text-sm sm:text-base font-black text-teal-950 bg-teal-50/70 py-2 px-5 rounded-2xl border border-teal-200/70 inline-block max-w-3xl">
          {part.instructions || 'Look and read. Write yes or no. There are two examples.'}
        </div>

        {/* Vietnamese instructions */}
        <div className="text-xs sm:text-sm italic font-semibold text-slate-600">
          {part.subInstructions || 'Quan sát bức tranh toàn cảnh và đọc các câu dưới đây. Nếu câu nói ĐÚNG với tranh thì chọn YES, nếu câu nói SAI thì chọn NO.'}
        </div>
      </div>

      {/* 2. MAIN UNIFIED FRAME ACCORDING TO LAYOUT MODE */}
      {layoutMode === 'top' ? (
        // LAYOUT 1: BỨC TRANH TOÀN CẢNH KHỔ LỚN Ở TRÊN (CỰC KỲ RÕ RÀNG CHO HỌC SINH)
        <div className="space-y-6">
          {/* Full-width Big Picture */}
          {renderPictureBox(false)}

          {/* Examples and Questions side-by-side underneath */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-4">
              {renderExamplesBox()}
            </div>
            <div className="lg:col-span-7">
              {renderQuestionsList()}
            </div>
          </div>
        </div>
      ) : (
        // LAYOUT 2: BỨC TRANH SONG SONG BÊN TRÁI (SPLIT 2 CỘT)
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-4">
            {renderPictureBox(true)}
            {renderExamplesBox()}
          </div>
          <div className="lg:col-span-5">
            {renderQuestionsList()}
          </div>
        </div>
      )}

      {/* 3. LIGHTBOX ZOOM MODAL (Khi bấm phóng to toàn màn hình) */}
      {zoomImage && sceneImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in"
          onClick={() => setZoomImage(false)}
        >
          <div
            className="max-w-6xl w-full max-h-[95vh] bg-slate-900 border-2 border-teal-400/40 rounded-3xl p-3 sm:p-5 flex flex-col space-y-3 text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap">
              <div>
                <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                  <i className="fa-solid fa-image text-teal-400"></i>
                  <span>Bức tranh toàn cảnh: {part.imageTitle || 'Part 2 Scene'}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Phóng to cực đại để quan sát từng chi tiết nhỏ nhân vật, đồ vật và hoạt động
                </p>
              </div>

              {/* Modal Zoom & Close controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/10 border border-white/20 rounded-xl px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setLightboxScale((prev) => Math.max(100, prev - 25))}
                    disabled={lightboxScale <= 100}
                    className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center font-black text-white disabled:opacity-30 cursor-pointer text-xs"
                    title="Thu nhỏ"
                  >
                    <i className="fa-solid fa-minus"></i>
                  </button>
                  <span className="text-xs font-black text-amber-300 w-14 text-center select-none">
                    {lightboxScale}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxScale((prev) => Math.min(250, prev + 25))}
                    disabled={lightboxScale >= 250}
                    className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center font-black text-white disabled:opacity-30 cursor-pointer text-xs"
                    title="Phóng to"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxScale(100)}
                    className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white cursor-pointer"
                  >
                    Reset
                  </button>
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
            </div>

            <div className="flex-1 max-h-[78vh] overflow-auto flex items-center justify-center bg-black/60 rounded-2xl p-2 border border-white/10">
              <img
                src={sceneImage}
                alt="Scene full size"
                style={{
                  transform: `scale(${lightboxScale / 100})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                className="max-h-[74vh] w-auto object-contain mx-auto rounded-lg shadow-2xl"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-400">
              <span>💡 Dùng con lăn chuột hoặc nút [+] [-] để phóng to / thu nhỏ ảnh.</span>
              <button
                type="button"
                onClick={() => setZoomImage(false)}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
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
