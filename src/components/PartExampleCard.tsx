import React, { useState } from 'react';
import { PartExample } from '../types';

interface PartExampleCardProps {
  example: PartExample;
  partDisplayNumber?: number;
  partTitle?: string;
  defaultExpanded?: boolean;
}

export const PartExampleCard: React.FC<PartExampleCardProps> = ({
  example,
  partDisplayNumber,
  partTitle,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handlePlayAudio = () => {
    if (!example.audio) return;
    if (example.audio.startsWith('tts:')) {
      const text = example.audio.replace(/^tts:/, '');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        utter.rate = 0.9;
        utter.onstart = () => setIsPlayingAudio(true);
        utter.onend = () => setIsPlayingAudio(false);
        utter.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utter);
      }
    } else {
      const a = new Audio(example.audio);
      setIsPlayingAudio(true);
      a.onended = () => setIsPlayingAudio(false);
      a.onerror = () => setIsPlayingAudio(false);
      a.play().catch(() => setIsPlayingAudio(false));
    }
  };

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-50/70 p-4 sm:p-5 shadow-sm text-slate-900 space-y-3.5 transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-amber-200/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
            <i className="fa-solid fa-lightbulb"></i>
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-tight">
                {example.title || `VÍ DỤ MẪU (EXAMPLE) - PART ${partDisplayNumber || ''}`}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] sm:text-[11px] shadow-xs flex items-center gap-1">
                <i className="fa-solid fa-circle-check"></i> ĐÃ CÓ ĐÁP ÁN MẪU
              </span>
            </div>
            {partTitle && (
              <p className="text-[11px] text-amber-800 font-semibold truncate max-w-md">
                Áp dụng cho: <strong>{partTitle}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {example.audio && (
            <button
              type="button"
              onClick={handlePlayAudio}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isPlayingAudio
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
              title="Lắng nghe audio phát âm câu ví dụ"
            >
              <i className={`fa-solid ${isPlayingAudio ? 'fa-volume-high' : 'fa-play'}`}></i>
              <span>{isPlayingAudio ? 'Đang phát audio ví dụ...' : 'Nghe audio ví dụ'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
            title={isExpanded ? 'Thu gọn ví dụ mẫu' : 'Mở rộng xem chi tiết ví dụ mẫu'}
          >
            <span>{isExpanded ? 'Thu gọn' : 'Xem ví dụ'}</span>
            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          {/* Subtitle notice */}
          <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
            <i className="fa-solid fa-circle-info text-amber-600 shrink-0"></i>
            <span>
              Em hãy xem kỹ bài làm mẫu dưới đây để biết <strong>cách thức trả lời</strong> cho các câu hỏi trong Part này:
            </span>
          </div>

          {/* Example Question Prompt */}
          <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2.5 shadow-xs">
            <div className="flex items-start gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-xs shrink-0 mt-0.5">
                Câu hỏi ví dụ:
              </span>
              <div
                className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: example.questionText }}
              />
            </div>

            {/* Example Image if provided (if not displaying connect overlay canvas) */}
            {example.img && !(example.type === 'connect-pairs' && example.connectPair?.fromX !== undefined) && (
              <div className="flex justify-center py-2">
                <img
                  src={example.img}
                  alt="Minh họa ví dụ"
                  className="max-h-56 w-auto max-w-full rounded-xl border border-slate-200 shadow-xs object-contain bg-slate-50"
                />
              </div>
            )}
          </div>

          {/* Sample Answer Box - Visualized exactly as a solved question */}
          <div className="p-4 rounded-xl bg-emerald-50/90 border-2 border-emerald-300 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase">
                <i className="fa-solid fa-circle-check text-emerald-600"></i>
                <span>Bài làm mẫu (Cách chọn đáp án đúng):</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                ✓ Thao tác đã hoàn thành
              </span>
            </div>

            {/* Answer Display depending on Type */}
            {/* 1. Multiple Choice / Listening Options */}
            {example.options && example.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {example.options.map((opt, oIdx) => {
                  const isSampleSelected = oIdx === (example.correctIndex ?? 0);
                  return (
                    <div
                      key={oIdx}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-2 ${
                        isSampleSelected
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50'
                          : 'bg-white/80 text-slate-600 border-slate-200 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isSampleSelected ? 'bg-white text-emerald-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold truncate">{opt.text}</span>
                      </div>
                      {isSampleSelected && (
                        <span className="px-2 py-0.5 rounded-md bg-white text-emerald-800 text-[10px] font-black shrink-0 flex items-center gap-1 shadow-xs">
                          <i className="fa-solid fa-check"></i> ĐÁP ÁN MẪU
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Tick / Cross Display */}
            {example.type === 'tick-cross' && (
              <div className="flex items-center justify-center gap-4 py-2">
                <div
                  className={`px-5 py-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all ${
                    example.isTick !== false
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50'
                      : 'bg-white text-slate-400 border-slate-200 opacity-60'
                  }`}
                >
                  <span className="text-xl font-black">✔</span>
                  <div className="text-left">
                    <div className="text-xs font-black">TICK (✔ ĐÚNG)</div>
                    {example.isTick !== false && (
                      <div className="text-[10px] text-emerald-100 font-bold">✓ Đáp án mẫu đã chọn</div>
                    )}
                  </div>
                </div>

                <div
                  className={`px-5 py-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all ${
                    example.isTick === false
                      ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400/50'
                      : 'bg-white text-slate-400 border-slate-200 opacity-60'
                  }`}
                >
                  <span className="text-xl font-black">✘</span>
                  <div className="text-left">
                    <div className="text-xs font-black">CROSS (✘ SAI)</div>
                    {example.isTick === false && (
                      <div className="text-[10px] text-red-100 font-bold">✓ Đáp án mẫu đã chọn</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Listen and Write Input Display */}
            {example.type === 'listen-write' && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-emerald-200">
                <span className="text-xs font-bold text-slate-600">Ô gõ câu trả lời mẫu:</span>
                <div className="flex items-center gap-2 bg-emerald-100/80 border-2 border-emerald-500 rounded-xl px-4 py-2">
                  <span className="font-mono font-black text-sm sm:text-base text-emerald-950 tracking-wider">
                    {example.answerText || 'May'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 shadow-xs">
                    <i className="fa-solid fa-check"></i> ĐÃ ĐIỀN MẪU
                  </span>
                </div>
              </div>
            )}

            {/* 4. Unscramble Word Display */}
            {example.type === 'unscramble-word' && (
              <div className="space-y-2 p-3 rounded-xl bg-white border border-emerald-200">
                {example.unscrambleLetters && example.unscrambleLetters.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-600">Các chữ cái gợi ý:</span>
                    <div className="flex items-center gap-1.5">
                      {example.unscrambleLetters.map((letter, lIdx) => (
                        <span
                          key={lIdx}
                          className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black text-sm flex items-center justify-center uppercase shadow-xs"
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs font-bold text-slate-600">Từ đúng đã sắp xếp:</span>
                  <div className="flex items-center gap-1.5">
                    {(example.unscrambleTarget || example.answerText || 'duck')
                      .split('')
                      .map((char, cIdx) => (
                        <span
                          key={cIdx}
                          className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-mono font-black text-base flex items-center justify-center uppercase shadow-sm border border-emerald-700"
                        >
                          {char}
                        </span>
                      ))}
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-black flex items-center gap-1">
                    <i className="fa-solid fa-check text-emerald-600"></i> ĐÁP ÁN MẪU
                  </span>
                </div>
              </div>
            )}

            {/* 5. Connect Pairs Display with Pre-Connected Example Line */}
            {example.type === 'connect-pairs' && (
              <div className="p-3.5 rounded-2xl bg-white border-2 border-emerald-300 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                      ★
                    </span>
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-tight">
                      Đường Nối Mẫu Đã Nối Sẵn (Pre-connected Example Line)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-2xs flex items-center gap-1">
                    <i className="fa-solid fa-circle-check"></i> ĐÃ NỐI SẴN 1 ĐIỂM
                  </span>
                </div>

                {/* If coordinates and image are provided, render the actual visual diagram with the line drawn on the image */}
                {example.img &&
                example.connectPair &&
                typeof example.connectPair.fromX === 'number' &&
                typeof example.connectPair.fromY === 'number' &&
                typeof example.connectPair.toX === 'number' &&
                typeof example.connectPair.toY === 'number' ? (() => {
                  const cp = example.connectPair;
                  const fX = cp.fromX!;
                  const fY = cp.fromY!;
                  const tX = cp.toX!;
                  const tY = cp.toY!;
                  const cW = cp.canvasWidth || 800;
                  const cH = cp.canvasHeight || 520;
                  const midX = (fX + tX) / 2;
                  const midY = (fY + tY) / 2;
                  const badgeText = '★ ĐƯỜNG NỐI VÍ DỤ MẪU (EXAMPLE)';

                  return (
                    <div className="space-y-2">
                      <div className="stage max-w-2xl mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md">
                        <div
                          className="canvas relative"
                          style={{
                            paddingTop: `${(cH / cW) * 100}%`,
                            backgroundImage: `url("${example.img}")`
                          }}
                        >
                          <svg
                            className="cp-svg-layer"
                            viewBox={`0 0 ${cW} ${cH}`}
                          >
                            <defs>
                              <filter id="exGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                              </filter>
                            </defs>

                            {/* Outer Ambient Glow Line */}
                            <line
                              x1={fX}
                              y1={fY}
                              x2={tX}
                              y2={tY}
                              stroke="#10b981"
                              strokeWidth="10"
                              strokeOpacity="0.4"
                              strokeLinecap="round"
                            />

                            {/* Main Dashed Guide Line */}
                            <line
                              x1={fX}
                              y1={fY}
                              x2={tX}
                              y2={tY}
                              stroke="#047857"
                              strokeWidth="5"
                              strokeDasharray="9 6"
                              strokeLinecap="round"
                            />

                            {/* Inner Bright Neon Highlight Line */}
                            <line
                              x1={fX}
                              y1={fY}
                              x2={tX}
                              y2={tY}
                              stroke="#a7f3d0"
                              strokeWidth="2"
                              strokeDasharray="3 9"
                              strokeLinecap="round"
                            />

                            {/* Start Point Marker (A) */}
                            <circle
                              cx={fX}
                              cy={fY}
                              r="18"
                              fill="#047857"
                              stroke="#ffffff"
                              strokeWidth="3"
                            />
                            <text
                              x={fX}
                              y={fY + 4}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontWeight="900"
                              fontSize="11"
                              fontFamily="sans-serif"
                            >
                              {cp.fromLabel || 'A'}
                            </text>

                            {/* End Point Marker (B) */}
                            <circle
                              cx={tX}
                              cy={tY}
                              r="18"
                              fill="#047857"
                              stroke="#ffffff"
                              strokeWidth="3"
                            />
                            <text
                              x={tX}
                              y={tY + 4}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontWeight="900"
                              fontSize="11"
                              fontFamily="sans-serif"
                            >
                              {cp.toLabel || 'B'}
                            </text>
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })() : null}

                {/* Connection Pair Summary Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 py-1">
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50 border-2 border-blue-300 text-blue-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-mono">
                      {example.connectPair?.fromLabel || 'A'}
                    </span>
                    <span>{example.connectPair?.fromText || example.connectPair?.fromLabel || 'Ben'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-600 font-black px-2">
                    <span className="w-7 h-1 bg-emerald-500 rounded"></span>
                    <i className="fa-solid fa-arrow-right text-base text-emerald-600 animate-pulse"></i>
                  </div>

                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-mono">
                      {example.connectPair?.toLabel || 'B'}
                    </span>
                    <span>{example.connectPair?.toText || example.connectPair?.toLabel || 'Boy flying blue kite'}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed font-semibold">
                  <i className="fa-solid fa-circle-info text-emerald-600 mr-1.5"></i>
                  <strong>Ghi nhớ:</strong> Đường nối màu xanh lá cây trên hình đã được vẽ sẵn làm mẫu. Khi vào làm bài, em chỉ cần bấm vào các điểm còn lại để nối tiếp các cặp chưa nối!
                </div>
              </div>
            )}

            {/* 6. Story with Word Bank Display */}
            {example.type === 'story-word-bank' && (
              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2">
                {example.storySnippet && (
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {example.storySnippet}
                  </div>
                )}
                {example.storyWord && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Từ được chọn điền vào ô (0):</span>
                    <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-xs">
                      {example.storyWord} (Đã điền mẫu)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 7. Listen and Colour (Cambridge) Display */}
            {example.type === 'listen-colour' && (
              <div className="p-3.5 rounded-2xl bg-white border-2 border-orange-300 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-orange-950 flex items-center gap-1.5">
                    <span className="text-sm">🎨</span>
                    <span>Dạng bài Cambridge: Nghe & Tô màu (Listen and Colour)</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">
                    ★ ĐÃ TÔ MÀU MẪU
                  </span>
                </div>

                {example.colourItem && (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-orange-50/70 border border-orange-200 text-xs font-bold">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow-xs shrink-0"
                      style={{ backgroundColor: example.colourItem.color }}
                    />
                    <div>
                      <strong>Chi tiết mẫu:</strong> {example.colourItem.label} ➔{' '}
                      <span className="text-orange-900 font-black">
                        Đã tô màu {example.colourItem.colorName || example.colourItem.color}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 leading-relaxed font-semibold">
                  <i className="fa-solid fa-lightbulb text-amber-600 mr-1.5"></i>
                  <strong>Cách làm bài:</strong> Em bấm chọn bút chì màu bên dưới tranh, sau đó bấm vào chi tiết tương ứng trên tranh vẽ đen trắng để tô màu theo đúng nội dung nghe được trong audio!
                </div>
              </div>
            )}

            {/* Generic Answer text if not already covered */}
            {!example.options &&
              example.type !== 'tick-cross' &&
              example.type !== 'listen-write' &&
              example.type !== 'unscramble-word' &&
              example.type !== 'connect-pairs' &&
              example.type !== 'story-word-bank' &&
              example.type !== 'listen-colour' &&
              example.answerText && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Đáp án mẫu:</span>
                  <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs sm:text-sm shadow-xs">
                    {example.answerText}
                  </span>
                </div>
              )}
          </div>

          {/* Explanation & Instructions for the Student */}
          {example.explanation && (
            <div className="p-3.5 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-950 space-y-1.5 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-black text-amber-900 uppercase">
                <i className="fa-solid fa-graduation-cap text-amber-700"></i>
                <span>Hướng dẫn học sinh cách làm bài:</span>
              </div>
              <p className="font-semibold text-slate-800">{example.explanation}</p>
            </div>
          )}

          {/* Footer note */}
          <div className="text-[11px] font-bold text-slate-500 text-center pt-1 border-t border-amber-200/50">
            ℹ️ Câu ví dụ mẫu này được thiết kế để học sinh làm quen cách trả lời và <strong>không tính vào tổng điểm thi</strong>.
          </div>
        </div>
      )}
    </div>
  );
};
