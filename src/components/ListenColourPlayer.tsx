import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Question, ColourItem } from '../types';
import { CAMBRIDGE_CRAYONS, getCrayonInfo, isColorMatch } from '../utils/cambridgeColours';

interface ListenColourPlayerProps {
  question: Question;
  questionIndex: number;
  userAnswer?: Record<string, string>; // { [itemId: string]: colorIdOrHex }
  onChangeAnswer: (answer: Record<string, string>) => void;
  isSubmitted?: boolean;
}

export const ListenColourPlayer: React.FC<ListenColourPlayerProps> = ({
  question,
  questionIndex,
  userAnswer = {},
  onChangeAnswer,
  isSubmitted = false
}) => {
  const config = question.listenColour || {
    width: 800,
    height: 520,
    items: []
  };

  const W = config.width || 800;
  const H = config.height || 520;
  const items: ColourItem[] = config.items || [];

  // Allowed palette (default to all 9 Cambridge crayons + eraser)
  const allowedColors =
    config.palette && config.palette.length > 0
      ? CAMBRIDGE_CRAYONS.filter(
          (c) => c.id === 'eraser' || config.palette?.includes(c.id) || config.palette?.includes(c.hex)
        )
      : CAMBRIDGE_CRAYONS;

  // Selected tool states
  const [selectedColor, setSelectedColor] = useState<string>('yellow');
  const [toolMode, setToolMode] = useState<'crayon' | 'bucket'>('crayon'); // crayon = tô tự do, bucket = đổ màu nhanh
  const [brushSize, setBrushSize] = useState<number>(26); // 14: nhỏ, 26: vừa, 45: to, 80: chổi mảng rộng

  // Canvas & Drawing refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const userAnswerRef = useRef<Record<string, string>>(userAnswer);
  const savedDrawingDataUrlRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    userAnswerRef.current = userAnswer;
  }, [userAnswer]);

  const activeCrayon = getCrayonInfo(selectedColor);
  const exampleItem = items.find((it) => it.isExample);
  const testItems = items.filter((it) => !it.isExample);

  // Convert client pointer event to native canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Draw continuous stroke segment between two points
  const drawSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    crayonId: string,
    size: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (crayonId === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else {
      const crayon = getCrayonInfo(crayonId);
      // Realistic crayon / colored pencil texture: semi-transparent so line art outlines remain visible
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = crayon.hex;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw a circular dab / dot for single click / tap
  const drawDab = (pt: { x: number; y: number }, crayonId: string, size: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (crayonId === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const crayon = getCrayonInfo(crayonId);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = crayon.hex;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Smart Fill: Fills an entire object / wide region smoothly (ideal for wide grass, sky, mountain, lake or objects)
  const performSmartBucketFill = (pt: { x: number; y: number }, crayonId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find if the click is within any item's area (testing bounding box for wide areas)
    let matchedItem: ColourItem | null = null;
    let minDistance = Infinity;

    for (const it of testItems) {
      const w = it.w || 64;
      const h = it.h || 64;
      const halfW = w / 2 + 25;
      const halfH = h / 2 + 25;
      const inBox = Math.abs(pt.x - it.x) <= halfW && Math.abs(pt.y - it.y) <= halfH;
      const dist = Math.hypot(pt.x - it.x, pt.y - it.y);

      if ((inBox || dist <= Math.max(halfW, halfH)) && dist < minDistance) {
        minDistance = dist;
        matchedItem = it;
      }
    }

    ctx.save();
    if (crayonId === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      if (matchedItem) {
        const rx = Math.max((matchedItem.w || 64) / 2, 35);
        const ry = Math.max((matchedItem.h || 64) / 2, 35);
        ctx.beginPath();
        ctx.ellipse(matchedItem.x, matchedItem.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const crayon = getCrayonInfo(crayonId);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = crayon.hex;

      if (matchedItem) {
        const rx = Math.max((matchedItem.w || 64) / 2, 32);
        const ry = Math.max((matchedItem.h || 64) / 2, 32);
        ctx.beginPath();
        ctx.ellipse(matchedItem.x, matchedItem.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Free-space bucket click: soft paint dab
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 50, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Update item answer if matched
    if (matchedItem) {
      const next = { ...userAnswerRef.current };
      if (crayonId === 'eraser') {
        delete next[matchedItem.id];
      } else {
        next[matchedItem.id] = crayonId;
      }
      userAnswerRef.current = next;
      onChangeAnswer(next);
    }
  };

  // Robust Hit-Testing: supports both small items AND wide areas (e.g. grass, hills, sky, river)
  const checkHitTest = (pt: { x: number; y: number }, crayonId: string) => {
    let changed = false;
    const next = { ...userAnswerRef.current };

    for (const it of testItems) {
      const w = it.w || 64;
      const h = it.h || 64;
      const halfW = w / 2 + 25;
      const halfH = h / 2 + 25;

      // Check both bounding rectangle and distance from center
      const inBox = Math.abs(pt.x - it.x) <= halfW && Math.abs(pt.y - it.y) <= halfH;
      const inRadius = Math.hypot(pt.x - it.x, pt.y - it.y) <= Math.max(halfW, halfH);

      if (inBox || inRadius) {
        if (crayonId === 'eraser') {
          if (next[it.id]) {
            delete next[it.id];
            changed = true;
          }
        } else {
          if (next[it.id] !== crayonId) {
            next[it.id] = crayonId;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      userAnswerRef.current = next;
      onChangeAnswer(next);
    }
  };

  // Pre-render the example item and existing answers onto the canvas
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas
    ctx.clearRect(0, 0, W, H);

    // 1. If child previously drew on this canvas, restore their exact real drawing!
    if (savedDrawingDataUrlRef.current) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = savedDrawingDataUrlRef.current;
      return;
    }

    // 2. Pre-render Example item as a gentle colored patch so child sees what to do
    if (exampleItem) {
      const exColor = getCrayonInfo(exampleItem.targetColor);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = exColor.hex;
      ctx.beginPath();
      const rx = Math.max((exampleItem.w || 70) / 2, 28);
      const ry = Math.max((exampleItem.h || 70) / 2, 28);
      ctx.ellipse(exampleItem.x, exampleItem.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [W, H, exampleItem]);

  useEffect(() => {
    initializeCanvas();
  }, [questionIndex, question.img, initializeCanvas]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isSubmitted) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const pt = getCanvasCoords(e);

    if (toolMode === 'bucket') {
      performSmartBucketFill(pt, selectedColor);
      if (canvasRef.current) {
        savedDrawingDataUrlRef.current = canvasRef.current.toDataURL();
      }
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = pt;
    drawDab(pt, selectedColor, brushSize);
    checkHitTest(pt, selectedColor);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || isSubmitted || toolMode === 'bucket') return;
    const pt = getCanvasCoords(e);
    if (lastPointRef.current) {
      drawSegment(lastPointRef.current, pt, selectedColor, brushSize);
    }
    lastPointRef.current = pt;
    checkHitTest(pt, selectedColor);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current && canvasRef.current) {
      savedDrawingDataUrlRef.current = canvasRef.current.toDataURL();
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Clear all strokes and re-initialize
  const handleClearCanvas = () => {
    if (isSubmitted) return;
    onChangeAnswer({});
    userAnswerRef.current = {};
    savedDrawingDataUrlRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        if (exampleItem) {
          const exColor = getCrayonInfo(exampleItem.targetColor);
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = exColor.hex;
          ctx.beginPath();
          const rx = Math.max((exampleItem.w || 70) / 2, 28);
          const ry = Math.max((exampleItem.h || 70) / 2, 28);
          ctx.ellipse(exampleItem.x, exampleItem.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  };

  const answeredCount = testItems.filter((it) => !!userAnswer[it.id]).length;

  return (
    <div className="space-y-4 pt-1">
      {/* Cambridge listening prompt banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 shadow-xs flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5 text-xs font-bold text-amber-950">
          <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
            🎨
          </span>
          <div>
            <div className="font-extrabold text-sm text-amber-950">
              Lắng nghe audio và tô màu trực tiếp lên tranh:
            </div>
            <div className="text-[11px] text-amber-800 font-semibold">
              Bé chọn màu sáp, sau đó rê chuột tô tự do bất cứ nơi nào trên tranh hoặc dùng thùng đổ màu cho vùng rộng!
            </div>
          </div>
        </div>

        {/* Progress & Example Badge */}
        <div className="flex items-center gap-2">
          {exampleItem && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
              <i className="fa-solid fa-star text-amber-500"></i>
              <span>Ví dụ: {exampleItem.label} (đã tô màu {getCrayonInfo(exampleItem.targetColor).name})</span>
            </span>
          )}
          <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs">
            Đã tô: {answeredCount}/{testItems.length} chi tiết
          </span>
        </div>
      </div>

      {/* Crayon Toolbar & Tool Controls */}
      {!isSubmitted && (
        <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
            {/* Tool Mode Switcher: ✏️ Bút sáp (Tô tự do) VS 🪣 Đổ màu (Phủ vùng nhanh) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">Kiểu tô:</span>
              <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setToolMode('crayon')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    toolMode === 'crayon'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tô màu sáp tự do: Rê chuột tô bất kỳ nơi nào trên tranh"
                >
                  <i className="fa-solid fa-pencil"></i>
                  <span>✏️ Bút sáp (Tô tự do)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setToolMode('bucket')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    toolMode === 'bucket'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Đổ màu thông minh: Chạm 1 cái để phủ màu kín cả chi tiết hoặc vùng rộng lớn như bãi cỏ, bầu trời"
                >
                  <i className="fa-solid fa-fill-drip"></i>
                  <span>🪣 Đổ màu nhanh</span>
                </button>
              </div>

              {/* Active tool indicator */}
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border transition"
                style={{
                  backgroundColor: activeCrayon.id === 'eraser' ? '#f1f5f9' : activeCrayon.hex + '20',
                  borderColor: activeCrayon.borderHex,
                  color: activeCrayon.id === 'eraser' ? '#334155' : activeCrayon.borderHex
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block border border-black/20"
                  style={{ backgroundColor: activeCrayon.hex }}
                />
                <strong className="text-slate-900">{activeCrayon.name} ({activeCrayon.enName})</strong>
              </div>
            </div>

            {/* Brush Size Controls & Clear Button */}
            <div className="flex items-center gap-2 flex-wrap">
              {toolMode === 'crayon' && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-700">
                  <span className="text-[11px] text-slate-500 px-1 font-semibold">Cỡ nét:</span>
                  <button
                    type="button"
                    onClick={() => setBrushSize(14)}
                    className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      brushSize === 14 ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-300' : 'hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Nét nhỏ (14px) - Tô viền chi tiết nhỏ"
                  >
                    Nhỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(26)}
                    className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      brushSize === 26 ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-300' : 'hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Nét vừa (26px) - Tô đồ vật thông thường"
                  >
                    Vừa
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(45)}
                    className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      brushSize === 45 ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-300' : 'hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Nét to (45px) - Tô mảng đồ vật lớn"
                  >
                    To
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(80)}
                    className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      brushSize === 80 ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-300' : 'hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Chổi quét mảng rộng (80px) - Quét nhanh bãi cỏ, bầu trời, dãy núi chỉ với 1-2 đường rê chuột!"
                  >
                    🧹 Quét rộng
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleClearCanvas}
                className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Xóa tất cả nét vẽ trên tranh để tô lại từ đầu"
              >
                <i className="fa-solid fa-rotate-left"></i> Tô lại
              </button>
            </div>
          </div>

          {/* Crayon Color Palette */}
          <div className="flex items-center gap-2 flex-wrap">
            {allowedColors.map((crayon) => {
              const isSelected = selectedColor === crayon.id || selectedColor === crayon.hex;
              const isEraser = crayon.id === 'eraser';

              return (
                <button
                  key={crayon.id}
                  type="button"
                  onClick={() => setSelectedColor(crayon.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 select-none shadow-xs active:scale-95 ${
                    isSelected
                      ? 'scale-105 ring-4 ring-offset-1 shadow-md -translate-y-0.5'
                      : 'hover:scale-102 hover:shadow-xs opacity-90 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: crayon.hex,
                    color: crayon.textColor,
                    border: `2px solid ${crayon.borderHex}`,
                    outlineColor: crayon.borderHex
                  }}
                  title={`Chọn bút màu ${crayon.name} (${crayon.enName})`}
                >
                  <span className="text-sm">{isEraser ? '🧽' : '✏️'}</span>
                  <span>{crayon.name}</span>
                  {isSelected && <span className="text-[10px] bg-black/25 text-white px-1 py-0.2 rounded font-black">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Picture Canvas Stage (Paper Coloring Experience) */}
      <div className="relative max-w-3xl mx-auto rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md bg-white select-none">
        <div
          className="relative w-full overflow-hidden"
          style={{
            paddingTop: `${(H / W) * 100}%`,
            backgroundImage: question.img ? `url("${question.img}")` : 'none',
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#ffffff'
          }}
        >
          {/* HTML5 Canvas overlay for real crayon painting anywhere on the paper */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute inset-0 w-full h-full touch-none ${
              isSubmitted
                ? 'cursor-default'
                : selectedColor === 'eraser'
                ? 'cursor-cell'
                : toolMode === 'bucket'
                ? 'cursor-pointer'
                : 'cursor-crosshair'
            }`}
          />

          {/* Submission Evaluation Highlights (ONLY shown AFTER exam is submitted) */}
          {isSubmitted &&
            testItems.map((item) => {
              const userColor = userAnswer[item.id];
              const correct = isColorMatch(userColor, item.targetColor);
              const targetCrayon = getCrayonInfo(item.targetColor);
              const leftPct = (item.x / W) * 100;
              const topPct = (item.y / H) * 100;
              const wPct = ((item.w || 64) / W) * 100;
              const hPct = ((item.h || 64) / H) * 100;

              return (
                <div
                  key={item.id}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${wPct}%`,
                    height: `${hPct}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className={`absolute rounded-2xl pointer-events-none z-20 flex flex-col items-center justify-center p-1 border-2 shadow-lg ${
                    correct
                      ? 'border-emerald-500 bg-emerald-500/20 ring-4 ring-emerald-400'
                      : 'border-red-500 bg-red-500/20 ring-4 ring-red-400'
                  }`}
                >
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm text-white ${
                      correct ? 'bg-emerald-600' : 'bg-red-600'
                    }`}
                  >
                    {correct ? '✔ Đúng' : `✘ Màu đúng: ${targetCrayon.name}`}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Helpful usage tip during exam */}
      {!isSubmitted && (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/90 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className="text-base text-amber-500">💡</span>
            <div>
              <strong>Phương án tô mảng rộng (bãi cỏ, núi, bầu trời):</strong>
              <div className="text-[11px] text-slate-500 mt-0.5">
                • Dùng <strong>✏️ Bút sáp</strong> chọn cỡ <strong>🧹 Quét rộng (80px)</strong> để quẹt nhanh 1-2 đường lướt chuột qua bãi cỏ / núi.<br />
                • Hoặc chuyển sang chế độ <strong>🪣 Đổ màu nhanh</strong> để chạm 1 cái là phủ màu trọn vẹn cả khu vực rộng!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Answer Key Details (ONLY shown AFTER exam submission) */}
      {isSubmitted && (
        <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-300 text-xs text-slate-700 space-y-2.5 shadow-sm">
          <div className="font-extrabold text-sm text-emerald-950 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-emerald-600"></i>
              <span>Đáp án chi tiết bài nghe & tô màu (Answer Key):</span>
            </span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
              Điểm đúng: {testItems.filter((it) => isColorMatch(userAnswer[it.id], it.targetColor)).length} / {testItems.length} chi tiết
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {items.map((item, i) => {
              const targetCrayon = getCrayonInfo(item.targetColor);
              const userColor = userAnswer[item.id];
              const userCrayon = userColor ? getCrayonInfo(userColor) : null;
              const isCorrect = isColorMatch(userColor, item.targetColor);

              return (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 bg-white ${
                    item.isExample
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : isCorrect
                      ? 'border-emerald-400 shadow-2xs'
                      : 'border-red-300 bg-red-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="w-5 h-5 rounded-full shrink-0 border border-black/15 shadow-2xs"
                      style={{ backgroundColor: targetCrayon.hex }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {item.label}
                        {item.isExample && (
                          <span className="ml-1 text-[10px] text-emerald-700 font-black">[Ví dụ mẫu]</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Đáp án đúng: <strong className="text-emerald-800">{targetCrayon.name} ({targetCrayon.enName})</strong>
                      </div>
                    </div>
                  </div>

                  {!item.isExample && (
                    <div className="shrink-0 text-right text-xs font-bold">
                      {isCorrect ? (
                        <span className="text-emerald-700 font-black">✔ Đúng (+0.5đ)</span>
                      ) : (
                        <div className="text-red-700 leading-tight">
                          <span className="font-black">✘ Chưa đúng</span>
                          <div className="text-[10px] text-slate-500">
                            {userCrayon ? `Bé đã tô: ${userCrayon.name}` : 'Chưa tô màu'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
