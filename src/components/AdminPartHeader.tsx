import React, { useState } from 'react';
import { ExamPart, QuestionType } from '../types';

interface AdminPartHeaderProps {
  part: ExamPart;
  partIndex: number;
  sectionIndex?: number;
  sectionTotalParts?: number;
  totalParts: number;
  questionsCount: number;
  exampleQuestionsCount?: number;
  questionsTotalPoints: number;
  onUpdatePart: (patch: Partial<ExamPart>) => void;
  onDeletePart: () => void;
  onMovePart: (direction: 'up' | 'down') => void;
  onAutoDistributePoints: () => void;
  onSyncPointsFromQuestions: () => void;
  onAddQuestionToPart: (type: QuestionType) => void;
  onTestPart?: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const AdminPartHeader: React.FC<AdminPartHeaderProps> = ({
  part,
  partIndex,
  sectionIndex,
  sectionTotalParts,
  totalParts,
  questionsCount,
  exampleQuestionsCount = 0,
  questionsTotalPoints,
  onUpdatePart,
  onDeletePart,
  onMovePart,
  onAutoDistributePoints,
  onSyncPointsFromQuestions,
  onAddQuestionToPart,
  onTestPart,
  showToast
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAudioConfig, setShowAudioConfig] = useState(false);
  const [showExampleConfig, setShowExampleConfig] = useState(false);
  const [showImageConfig, setShowImageConfig] = useState(false);
  const [ttsInput, setTtsInput] = useState(part.audio?.startsWith('tts:') ? part.audio.replace(/^tts:/, '') : '');

  const currentSection = part.section || (part.title.toLowerCase().includes('listen') ? 'listening' : 'reading-writing');
  const isListening = currentSection === 'listening';
  const isPointsBalanced = Math.abs(questionsTotalPoints - part.points) < 0.01;

  const handlePlayAudio = () => {
    if (!part.audio) return;
    if (part.audio.startsWith('tts:')) {
      const text = part.audio.replace(/^tts:/, '');
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
      showToast('Đang phát giọng đọc TTS của Part...', 'info');
    } else {
      const a = new Audio(part.audio);
      a.play().catch(() => showToast('Không thể phát file âm thanh URL này', 'warn'));
    }
  };

  return (
    <div className={`border-2 rounded-2xl p-4 sm:p-5 shadow-lg text-white space-y-4 ${
      isListening
        ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-indigo-400/50'
        : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-teal-400/50'
    }`}>
      {/* Top row: Section Selector, Part Number, Title input, Part Points, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px] flex-wrap sm:flex-nowrap">
          {/* Section Selector */}
          <select
            value={currentSection}
            onChange={(e) => onUpdatePart({ section: e.target.value as any })}
            className={`rounded-xl px-2.5 py-1 text-xs font-black border transition cursor-pointer ${
              isListening
                ? 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-400 text-white'
                : 'bg-teal-600/90 hover:bg-teal-600 border-teal-400 text-white'
            }`}
            title="Chọn phần thi lớn: Listening hoặc Reading & Writing"
          >
            <option value="listening" className="text-slate-900 font-bold">🎧 LISTENING</option>
            <option value="reading-writing" className="text-slate-900 font-bold">📖 READING & WRITING</option>
          </select>

          <span className={`px-2.5 py-1 rounded-xl text-white font-black text-xs tracking-wider shadow-sm flex items-center gap-1 shrink-0 ${
            isListening ? 'bg-indigo-500' : 'bg-teal-600'
          }`}>
            PART {sectionIndex !== undefined ? sectionIndex + 1 : partIndex + 1}
          </span>

          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              value={part.title}
              onChange={(e) => onUpdatePart({ title: e.target.value })}
              placeholder={isListening ? "Ví dụ: Part 1: Listen and draw lines..." : "Ví dụ: Part 1: Look and Read..."}
              className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 focus:border-indigo-400 rounded-xl px-3 py-1.5 text-sm sm:text-base font-extrabold text-white placeholder-white/40 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Part Points configuration */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-indigo-900/70 border border-indigo-300/40 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-indigo-200">Thang điểm Part:</span>
            <input
              type="number"
              step="0.25"
              min="0"
              max="100"
              value={part.points}
              onChange={(e) => onUpdatePart({ points: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-16 px-2 py-0.5 text-center text-sm font-black bg-white text-indigo-950 rounded-lg focus:ring-2 focus:ring-indigo-400"
            />
            <span className="text-xs font-black text-indigo-200">điểm</span>
          </div>

          {/* Part Order & Delete */}
          <div className="flex items-center gap-1">
            {onTestPart && (
              <button
                type="button"
                onClick={onTestPart}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/40 font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Chạy thử bài thi với Part này"
              >
                <i className="fa-solid fa-play text-[10px]"></i>
                <span>Test Part này</span>
              </button>
            )}
            <button
              type="button"
              disabled={sectionIndex !== undefined ? sectionIndex === 0 : partIndex === 0}
              onClick={() => onMovePart('up')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center disabled:opacity-30 transition cursor-pointer"
              title="Di chuyển Part lên trên trong phần thi này"
            >
              <i className="fa-solid fa-arrow-up"></i>
            </button>
            <button
              type="button"
              disabled={
                sectionIndex !== undefined && sectionTotalParts !== undefined
                  ? sectionIndex >= sectionTotalParts - 1
                  : partIndex >= totalParts - 1
              }
              onClick={() => onMovePart('down')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center disabled:opacity-30 transition cursor-pointer"
              title="Di chuyển Part xuống dưới trong phần thi này"
            >
              <i className="fa-solid fa-arrow-down"></i>
            </button>
            <button
              type="button"
              onClick={onDeletePart}
              className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-400/30 font-bold text-xs flex items-center justify-center transition cursor-pointer"
              title="Xóa Part này"
            >
              <i className="fa-regular fa-trash-can"></i>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer"
              title={isExpanded ? 'Thu gọn danh sách câu hỏi của Part' : 'Mở rộng danh sách câu hỏi của Part'}
            >
              <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Second row: Part Instructions & Points status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-white/10">
        <div className="md:col-span-8 space-y-1">
          <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wide">
            Hướng dẫn làm bài cho Part này (Instructions / Đề mục):
          </label>
          <input
            type="text"
            value={part.instructions || ''}
            onChange={(e) => onUpdatePart({ instructions: e.target.value })}
            placeholder="Ví dụ: Read the questions. Listen and write a name or a number. There are two examples."
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/15 focus:border-indigo-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none transition"
          />
        </div>

        {/* Status of questions in Part & points balance */}
        <div className="md:col-span-4 flex flex-col justify-end">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <span>Số câu thi:</span>
              <strong className="text-white text-sm">{questionsCount}</strong>
              {exampleQuestionsCount > 0 && (
                <span className="text-[10px] bg-amber-400/25 text-amber-200 border border-amber-400/40 px-1.5 py-0.5 rounded font-black tracking-wide" title="Câu hỏi ví dụ mẫu không tính điểm vào Part">
                  +{exampleQuestionsCount} ví dụ (0đ)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <span>Điểm câu thi:</span>
              <strong className={isPointsBalanced ? 'text-emerald-400' : 'text-amber-300'}>
                {questionsTotalPoints.toFixed(2)} / {part.points} đ
              </strong>
              {isPointsBalanced ? (
                <span className="text-[10px] bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-black">
                  ✓ Khớp
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/25 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-black" title="Tổng điểm các câu hỏi thi chưa khớp với Thang điểm của Part">
                  ⚠️ Chưa khớp
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Audio, Image, Examples & Quick Tools */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Audio Config Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAudioConfig(!showAudioConfig)}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              part.audio
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-white/10 hover:bg-white/15 text-slate-200'
            }`}
          >
            <i className="fa-solid fa-headphones"></i>
            <span>{part.audio ? 'Audio chung' : '+ Audio chung'}</span>
            <i className={`fa-solid ${showAudioConfig ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </button>

          {part.audio && (
            <button
              type="button"
              onClick={handlePlayAudio}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-play"></i> Nghe thử
            </button>
          )}

          {/* Image & Image Title Config Toggle Button */}
          <button
            type="button"
            onClick={() => setShowImageConfig(!showImageConfig)}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              part.img
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                : 'bg-white/10 hover:bg-white/15 text-slate-200'
            }`}
          >
            <i className="fa-solid fa-image"></i>
            <span>{part.img ? (part.imageTitle ? `Ảnh: ${part.imageTitle}` : 'Đã có Ảnh chung') : '+ Ảnh & Tên ảnh'}</span>
            <i className={`fa-solid ${showImageConfig ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </button>

          {/* Example Configuration Toggle Button */}
          <button
            type="button"
            onClick={() => setShowExampleConfig(!showExampleConfig)}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              (part.examplesList && part.examplesList.length > 0) || part.example
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                : 'bg-white/10 hover:bg-white/15 text-slate-200'
            }`}
          >
            <i className="fa-solid fa-lightbulb text-amber-300"></i>
            <span>{(part.examplesList && part.examplesList.length > 0) || part.example ? 'Ví dụ mẫu' : '+ Ví dụ mẫu'}</span>
            <i className={`fa-solid ${showExampleConfig ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </button>
        </div>

        {/* Quick Points Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isPointsBalanced && questionsCount > 0 && (
            <button
              type="button"
              onClick={onAutoDistributePoints}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold transition flex items-center gap-1.5 cursor-pointer"
              title={`Chia đều ${part.points} điểm cho ${questionsCount} câu hỏi (${(part.points / questionsCount).toFixed(2)}đ/câu)`}
            >
              <i className="fa-solid fa-bolt text-amber-300"></i>
              <span>Chia đều {part.points}đ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSyncPointsFromQuestions}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Đặt thang điểm Part bằng tổng điểm thực tế của các câu"
          >
            <i className="fa-solid fa-calculator"></i>
            <span>Lấy tổng điểm ({questionsTotalPoints.toFixed(2)}đ)</span>
          </button>
        </div>
      </div>

      {/* Expanded Audio Settings for whole part */}
      {showAudioConfig && (
        <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
              <i className="fa-solid fa-volume-high"></i> Cấu hình Audio bài nghe dùng chung cho toàn bộ Part {partIndex + 1}
            </span>
            {part.audio && (
              <button
                type="button"
                onClick={() => {
                  onUpdatePart({ audio: undefined, audioScript: undefined });
                  setTtsInput('');
                  showToast('Đã xóa audio chung của Part', 'info');
                }}
                className="text-red-400 hover:text-red-300 text-xs font-bold"
              >
                Xóa audio chung
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-300 font-bold">Giọng đọc mẫu TTS (AI Đọc đề bài Part):</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={ttsInput}
                  onChange={(e) => setTtsInput(e.target.value)}
                  placeholder="Nhập nội dung bài đọc bằng tiếng Anh..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!ttsInput.trim()) return;
                    onUpdatePart({ audio: `tts:${ttsInput.trim()}`, audioScript: ttsInput.trim() });
                    showToast('Đã lưu giọng đọc TTS cho Part!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0 cursor-pointer"
                >
                  Lưu TTS
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 font-bold">Hoặc Tải file MP3 / Dán URL âm thanh:</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={part.audio && !part.audio.startsWith('tts:') ? part.audio : ''}
                  onChange={(e) => onUpdatePart({ audio: e.target.value })}
                  placeholder="https://... hoặc data:audio..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                />
                <label className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold shrink-0 cursor-pointer flex items-center gap-1">
                  <i className="fa-solid fa-upload"></i> Chọn file
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const url = ev.target?.result as string;
                        onUpdatePart({ audio: url });
                        showToast('Đã tải file audio chung cho Part thành công!');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Image & Image Title Settings for Part (Part 2 Cambridge format) */}
      {showImageConfig && (
        <div className="p-4 rounded-xl bg-slate-900/90 border-2 border-sky-400/40 space-y-3.5 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-sky-300 flex items-center gap-1.5 uppercase">
              <i className="fa-solid fa-image"></i> 3. Cấu hình Hình ảnh & Tên bức tranh dùng chung (Dùng cho cả Part {partIndex + 1})
            </span>
            {part.img && (
              <button
                type="button"
                onClick={() => {
                  onUpdatePart({ img: undefined, imageTitle: undefined });
                  showToast('Đã xóa hình ảnh chung của Part', 'info');
                }}
                className="text-red-400 hover:text-red-300 text-xs font-bold transition cursor-pointer"
              >
                <i className="fa-regular fa-trash-can mr-1"></i> Xóa ảnh chung
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-300 font-bold">Tải file ảnh từ máy hoặc dán link ảnh URL:</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={part.img?.startsWith('data:image/svg+xml') ? '[Ảnh minh họa SVG]' : part.img || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '[Ảnh minh họa SVG]') {
                      onUpdatePart({ img: val });
                    }
                  }}
                  placeholder="https://... hoặc tải từ máy tính"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                />
                <label className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold shrink-0 cursor-pointer flex items-center gap-1">
                  <i className="fa-solid fa-upload"></i> Chọn ảnh
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const url = ev.target?.result as string;
                        onUpdatePart({ img: url });
                        showToast('Đã tải hình ảnh chung cho Part thành công!');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-amber-200 font-bold">
                Tên của bức tranh (Image Title / Caption - hiển thị ngay dưới ảnh):
              </label>
              <input
                type="text"
                value={part.imageTitle || ''}
                onChange={(e) => onUpdatePart({ imageTitle: e.target.value })}
                placeholder="Nhập tên bức tranh (hoặc để trống nếu không có tên)..."
                className="w-full bg-white/10 border border-amber-300/40 rounded-lg px-2.5 py-1.5 text-amber-200 font-black tracking-wide placeholder-white/30 text-xs uppercase"
              />
              <span className="text-[10px] text-slate-400 block">
                Nếu điền thì tên ảnh sẽ hiển thị in hoa đậm, căn giữa ngay bên dưới bức tranh. Nếu để trống thì không hiển thị tên.
              </span>
            </div>
          </div>

          {/* Live Preview of image and caption */}
          {part.img && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Xem trước giao diện tranh & Tên ảnh trên đề thi:
              </span>
              <div className="flex justify-center">
                <img
                  src={part.img}
                  alt={part.imageTitle || 'Ảnh Part'}
                  className="max-h-52 rounded-lg border border-white/20 object-contain bg-white/5 shadow-sm"
                />
              </div>
              {part.imageTitle && part.imageTitle.trim().length > 0 && (
                <div className="text-base font-black text-amber-300 uppercase tracking-widest pt-1 font-serif">
                  {part.imageTitle.trim()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded Example Settings for Part */}
      {showExampleConfig && (
        <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-400/40 space-y-3.5 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
              <i className="fa-solid fa-lightbulb"></i> 4. Cấu hình Các câu ví dụ mẫu (Examples) cho Part {partIndex + 1}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {isListening ? (
                <button
                  type="button"
                  onClick={() => {
                    const defaultExList = [
                      { question: "What is the girl's name?", answer: "Kim" },
                      { question: "How old is Kim?", answer: "8" }
                    ];
                    const sampleEx = {
                      title: `Examples`,
                      questionText: "What is the girl's name? ➔ <strong>Kim</strong><br/>How old is Kim? ➔ <strong>8</strong>",
                      answerText: 'Kim | 8',
                      explanation: 'Hướng dẫn: Lắng nghe thật kỹ bài đọc. Khi người nói đánh vần tên hoặc nói về con số, em viết đúng từ hoặc số vào chỗ trống.',
                      audio: `tts:Hello, what is the girl's name? Her name is Kim. How do you spell Kim? K - I - M. And how old is Kim? She is eight years old. Eight? Yes, that is right.`
                    };
                    onUpdatePart({
                      examplesList: defaultExList,
                      example: sampleEx
                    });
                    showToast('Đã khởi tạo 2 câu ví dụ mẫu chuẩn Cambridge Part 2 (Kim / 8)!');
                  }}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer"
                >
                  ✨ Nạp 2 ví dụ mẫu chuẩn Cambridge (Kim / 8)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const defaultExList = [
                      { question: "This is a pizza.", answer: "✓", isTick: true },
                      { question: "This is a puppy.", answer: "✗", isTick: false }
                    ];
                    const sampleEx = {
                      title: `Examples: Put a tick (✓) or a cross (✗) in the box`,
                      questionText: "Ví dụ 1: This is a pizza. ➔ Đánh dấu tick [ ✓ ]<br/>Ví dụ 2: This is a puppy. ➔ Đánh dấu cross [ ✗ ]",
                      answerText: 'Ví dụ 1: ✓  |  Ví dụ 2: ✗',
                      explanation: 'Hướng dẫn: Quan sát kỹ hình ảnh và câu miêu tả. Nếu câu đúng với hình thì chọn Tick (✓), nếu câu sai với hình thì chọn Cross (✗).'
                    };
                    onUpdatePart({
                      examplesList: defaultExList,
                      example: sampleEx
                    });
                    showToast('Đã khởi tạo 2 câu ví dụ mẫu chuẩn Cambridge Part 1 (Pizza ✔ / Puppy ✘)!');
                  }}
                  className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 font-black text-xs transition cursor-pointer"
                >
                  ✨ Nạp 2 ví dụ mẫu Cambridge Part 1 (Pizza ✔ / Puppy ✘)
                </button>
              )}

              {(part.example || (part.examplesList && part.examplesList.length > 0)) && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePart({ example: undefined, examplesList: undefined });
                    showToast('Đã xóa các câu ví dụ mẫu của Part', 'info');
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold transition cursor-pointer"
                >
                  <i className="fa-regular fa-trash-can mr-1"></i> Xóa ví dụ
                </button>
              )}
            </div>
          </div>

          {/* Multiple Examples List Manager (Cambridge standard: e.g. Question -> Answer) */}
          <div className="space-y-2.5 p-3 rounded-xl bg-black/25 border border-amber-300/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-200 uppercase tracking-wide flex items-center gap-1.5">
                <i className="fa-solid fa-list-check text-amber-400"></i>
                <span>Danh sách các câu ví dụ mẫu (Examples):</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const currentList = part.examplesList ? [...part.examplesList] : [
                    { question: "What is the girl's name?", answer: "Kim" }
                  ];
                  currentList.push({ question: "How old is Kim?", answer: "8" });
                  onUpdatePart({ examplesList: currentList });
                  showToast('Đã thêm 1 câu ví dụ mẫu!');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer"
              >
                + Thêm câu ví dụ
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {(part.examplesList || [
                { question: "What is the girl's name?", answer: "Kim" },
                { question: "How old is Kim?", answer: "8" }
              ]).map((exItem, exIdx) => (
                <div key={exIdx} className="flex items-center gap-2 bg-white/10 p-2 rounded-lg">
                  <span className="font-mono font-bold text-amber-300 shrink-0 w-5 text-center">
                    {exIdx + 1}.
                  </span>
                  <input
                    type="text"
                    value={exItem.question}
                    onChange={(e) => {
                      const list = [...(part.examplesList || [
                        { question: "What is the girl's name?", answer: "Kim" },
                        { question: "How old is Kim?", answer: "8" }
                      ])];
                      list[exIdx] = { ...list[exIdx], question: e.target.value };
                      onUpdatePart({ examplesList: list });
                    }}
                    placeholder="VD: What is the girl's name?"
                    className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                  />
                  <span className="text-amber-300 font-black">➔</span>
                  <input
                    type="text"
                    value={exItem.answer}
                    onChange={(e) => {
                      const list = [...(part.examplesList || [
                        { question: "What is the girl's name?", answer: "Kim" },
                        { question: "How old is Kim?", answer: "8" }
                      ])];
                      list[exIdx] = { ...list[exIdx], answer: e.target.value };
                      onUpdatePart({ examplesList: list });
                    }}
                    placeholder="VD: Kim"
                    className="w-28 bg-white/15 border border-amber-400/50 rounded px-2 py-1 text-amber-200 font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const list = (part.examplesList || []).filter((_, i) => i !== exIdx);
                      onUpdatePart({ examplesList: list });
                      showToast('Đã xóa câu ví dụ này', 'info');
                    }}
                    className="w-7 h-7 rounded text-red-400 hover:text-red-300 hover:bg-white/10 flex items-center justify-center cursor-pointer shrink-0"
                    title="Xóa ví dụ này"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {part.example ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-amber-200 font-bold">Tiêu đề ví dụ (Title):</label>
                  <input
                    type="text"
                    value={part.example.title || ''}
                    onChange={(e) =>
                      onUpdatePart({
                        example: { ...part.example!, title: e.target.value }
                      })
                    }
                    placeholder="Ví dụ: Ví dụ mẫu (Example): Telling Time..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-amber-200 font-bold">Dạng bài tập của ví dụ mẫu (Type):</label>
                  <select
                    value={part.example.type || 'multiple-choice'}
                    onChange={(e) =>
                      onUpdatePart({
                        example: { ...part.example!, type: e.target.value as QuestionType }
                      })
                    }
                    className="w-full bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                  >
                    <option value="multiple-choice">Trắc nghiệm 1 đáp án (Multiple Choice)</option>
                    <option value="yes-no">Đúng / Sai (Yes - No)</option>
                    <option value="multi-choice">Trắc nghiệm nhiều đáp án (Multi-choice)</option>
                    <option value="listening">Bài nghe (Listening)</option>
                    <option value="connect-pairs">Nối điểm / Nối cặp (Connect Pairs / Draw Lines)</option>
                    <option value="tick-cross">Tick / Cross (✔ / ✘)</option>
                    <option value="listen-write">Nghe & Viết tên/số (Listen & Write)</option>
                    <option value="unscramble-word">Sắp xếp chữ cái (Unscramble Word)</option>
                    <option value="story-word-bank">Điền từ vào câu chuyện (Story Word Bank)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-amber-200 font-bold">Đáp án mẫu hiển thị (Answer Text):</label>
                  <input
                    type="text"
                    value={part.example.answerText || ''}
                    onChange={(e) =>
                      onUpdatePart({
                        example: { ...part.example!, answerText: e.target.value }
                      })
                    }
                    placeholder="Ví dụ: May (Tên) | 8 (Tuổi) hoặc B. 6 o'clock..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs font-bold text-emerald-300"
                  />
                </div>
              </div>

              {/* Special Connect-Pairs Example Settings */}
              {part.example.type === 'connect-pairs' && (
                <div className="p-3 rounded-xl bg-black/20 border border-emerald-400/40 space-y-2">
                  <div className="text-[11px] font-black uppercase text-emerald-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-bezier-curve"></i>
                    <span>Cấu hình 1 điểm nối hiện làm ví dụ mẫu:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-sky-200">Vế 1 (Điểm bắt đầu nối):</label>
                      <input
                        type="text"
                        value={part.example.connectPair?.fromText || part.example.connectPair?.fromLabel || ''}
                        onChange={(e) => {
                          const cp = part.example!.connectPair || { fromLabel: 'A', toLabel: 'B' };
                          onUpdatePart({
                            example: {
                              ...part.example!,
                              connectPair: { ...cp, fromText: e.target.value, fromLabel: cp.fromLabel || 'A' }
                            }
                          });
                        }}
                        placeholder="VD: Ben (hoặc 25 + 15)..."
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-200">Vế 2 (Điểm kết thúc nối):</label>
                      <input
                        type="text"
                        value={part.example.connectPair?.toText || part.example.connectPair?.toLabel || ''}
                        onChange={(e) => {
                          const cp = part.example!.connectPair || { fromLabel: 'A', toLabel: 'B' };
                          onUpdatePart({
                            example: {
                              ...part.example!,
                              connectPair: { ...cp, toText: e.target.value, toLabel: cp.toLabel || 'B' }
                            }
                          });
                        }}
                        placeholder="VD: Cậu bé thả diều xanh (hoặc 40)..."
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-amber-200 font-bold">Đề bài câu hỏi ví dụ (Question text / HTML):</label>
                <textarea
                  rows={2}
                  value={part.example.questionText || ''}
                  onChange={(e) =>
                    onUpdatePart({
                      example: { ...part.example!, questionText: e.target.value }
                    })
                  }
                  placeholder="Nhập nội dung đề bài câu hỏi ví dụ..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-amber-200 font-bold">Lời giải thích & Hướng dẫn học sinh cách trả lời:</label>
                <textarea
                  rows={2}
                  value={part.example.explanation || ''}
                  onChange={(e) =>
                    onUpdatePart({
                      example: { ...part.example!, explanation: e.target.value }
                    })
                  }
                  placeholder="Ví dụ: Hướng dẫn: Đọc kỹ câu hỏi, quan sát hình ảnh rồi bấm chọn..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-amber-200 font-bold">Audio ví dụ (TTS hoặc URL file):</label>
                  <input
                    type="text"
                    value={part.example.audio || ''}
                    onChange={(e) =>
                      onUpdatePart({
                        example: { ...part.example!, audio: e.target.value }
                      })
                    }
                    placeholder="tts:Nội dung tiếng Anh hoặc https://..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-amber-200 font-bold">Hình ảnh minh họa ví dụ (URL hoặc Data):</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={part.example.img || ''}
                      onChange={(e) =>
                        onUpdatePart({
                          example: { ...part.example!, img: e.target.value }
                        })
                      }
                      placeholder="https://... hoặc data:image/..."
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold shrink-0 cursor-pointer flex items-center gap-1">
                      <i className="fa-solid fa-upload"></i> Chọn ảnh
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const url = ev.target?.result as string;
                            onUpdatePart({
                              example: { ...part.example!, img: url }
                            });
                            showToast('Đã tải ảnh ví dụ thành công!');
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-200/80 italic">
              Part này chưa có ví dụ mẫu. Bấm nút <strong>✨ Khởi tạo ví dụ mẫu mặc định</strong> ở trên để tạo câu ví dụ hướng dẫn cho học sinh.
            </p>
          )}
        </div>
      )}

      {/* Add Question to this Part Toolbar */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <i className="fa-solid fa-plus-circle text-indigo-400"></i>
          <span>Thêm câu hỏi vào Part {partIndex + 1}:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddQuestionToPart('multiple-choice')}
            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition cursor-pointer"
            title="Trắc nghiệm 1 đáp án đúng (Multiple-choice)"
          >
            + Trắc nghiệm
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('yes-no')}
            className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
            title="Dạng câu hỏi Đúng / Sai: Chọn YES hoặc NO"
          >
            <i className="fa-solid fa-circle-question text-[10px]"></i>
            <span>+ Yes - No</span>
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('multi-choice')}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
            title="Dạng trắc nghiệm nhiều đáp án đúng (Hộp kiểm Checkbox)"
          >
            <i className="fa-solid fa-list-check text-[10px]"></i>
            <span>+ Multi-choice</span>
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('listening')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
          >
            + Bài nghe
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('listen-colour')}
            className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer"
            title="Cambridge Listening: Nghe audio và tô màu chi tiết trên tranh"
          >
            🎨 + Nghe & Tô màu
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('tick-cross')}
            className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs transition cursor-pointer"
          >
            + Tick/Cross
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('listen-write')}
            className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition cursor-pointer"
          >
            + Nghe & Viết
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('unscramble-word')}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer"
          >
            + Xếp chữ
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('story-word-bank')}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
          >
            + Đoạn văn
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('connect-pairs')}
            className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition cursor-pointer"
          >
            + Nối điểm
          </button>
          <button
            type="button"
            onClick={() => onAddQuestionToPart('fill-blanks')}
            className="px-2.5 py-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            + Điền ô ảnh
          </button>
        </div>
      </div>
    </div>
  );
};
