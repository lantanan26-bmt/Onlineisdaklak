import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionType, ExamPart } from '../types';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface PdfExamImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts?: ExamPart[];
  onAddQuestion: (q: Question) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const PdfExamImporterModal: React.FC<PdfExamImporterModalProps> = ({
  isOpen,
  onClose,
  parts = [],
  onAddQuestion,
  showToast
}) => {
  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Page Extracted Text
  const [pageText, setPageText] = useState<string>('');
  const [textLines, setTextLines] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');

  // Crop / Selection on Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Question Form State
  const [selectedPartId, setSelectedPartId] = useState<string>(parts[0]?.id || 'part-1');
  const [qPoints, setQPoints] = useState<number>(0.5);
  const [qType, setQType] = useState<QuestionType>('multiple-choice');
  const [qPrompt, setQPrompt] = useState<string>('');
  const [qSectionTitle, setQSectionTitle] = useState<string>('');
  const [qExampleHint, setQExampleHint] = useState<string>('');
  const [qImage, setQImage] = useState<string>('');

  useEffect(() => {
    if (parts.length > 0 && !parts.some((p) => p.id === selectedPartId)) {
      setSelectedPartId(parts[0].id);
    }
  }, [parts]);

  // Audio configuration in question builder
  const [audioMode, setAudioMode] = useState<'tts' | 'record' | 'upload' | 'url'>('tts');
  const [qAudio, setQAudio] = useState<string>('');
  const [ttsScript, setTtsScript] = useState<string>('');
  const [maxPlayCount, setMaxPlayCount] = useState<number>(2);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(false);
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState<boolean>(false);

  // Microphone recording state inside modal
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Type-specific form fields
  // 1. Multiple-choice
  const [options, setOptions] = useState<Array<{ text: string; img?: string }>>([
    { text: 'A', img: '' },
    { text: 'B', img: '' },
    { text: 'C', img: '' }
  ]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  // 2. Tick-cross
  const [isTick, setIsTick] = useState<boolean>(true);

  // 3. Listen-write
  const [acceptableAnswersStr, setAcceptableAnswersStr] = useState<string>('');

  // 4. Unscramble-word
  const [targetWord, setTargetWord] = useState<string>('');
  const [scrambledLettersStr, setScrambledLettersStr] = useState<string>('');

  // Counter of questions created in this session
  const [createdCount, setCreatedCount] = useState<number>(0);

  // Set workerSrc for pdfjsLib
  useEffect(() => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load PDF from ArrayBuffer (File input)
  const loadPdfFromArrayBuffer = async (buffer: ArrayBuffer, fileName: string) => {
    if (!window.pdfjsLib) {
      showToast('Đang khởi tạo trình đọc PDF, vui lòng thử lại sau giây lát!', 'warn');
      return;
    }
    setIsLoading(true);
    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setPdfFileName(fileName);
      setSelection(null);
      showToast(`Đã tải lên tệp "${fileName}" (${doc.numPages} trang)!`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Không thể đọc file PDF này: ' + (err.message || 'Lỗi định dạng'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle local PDF file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(file);
  };

  const processPdfFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Vui lòng chọn tệp có định dạng .PDF!', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      if (buffer) {
        loadPdfFromArrayBuffer(buffer, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processPdfFile(file);
    }
  };

  // Render current PDF page to canvas and extract text
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let isCancelled = false;

    const renderPage = async () => {
      setIsLoading(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        await page.render(renderContext).promise;
        if (isCancelled) return;

        // Extract text
        const textContent = await page.getTextContent();
        const items = textContent.items
          .map((item: any) => item.str?.trim())
          .filter((s: string) => Boolean(s));
        
        setPageText(items.join('\n'));
        setTextLines(items);
        setSelection(null);
      } catch (err) {
        console.error('Error rendering page:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  // Canvas Mouse Events for Selection Box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startPos.current = { x, y };
    setIsSelecting(true);
    setSelection({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(startPos.current.x, curX);
    const top = Math.min(startPos.current.y, curY);
    const width = Math.abs(curX - startPos.current.x);
    const height = Math.abs(curY - startPos.current.y);

    setSelection({ x: left, y: top, w: width, h: height });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  // Crop Selected Area for Question Image
  const getCroppedImageDataUrl = (): string | null => {
    if (!canvasRef.current || !selection || selection.w < 10 || selection.h < 10) {
      return null;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const sourceX = selection.x * scaleX;
    const sourceY = selection.y * scaleY;
    const sourceW = selection.w * scaleX;
    const sourceH = selection.h * scaleY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sourceW;
    cropCanvas.height = sourceH;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;

    cropCtx.drawImage(
      canvas,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      0,
      0,
      sourceW,
      sourceH
    );

    return cropCanvas.toDataURL('image/png');
  };

  const handleCropForQuestionImage = () => {
    const dataUrl = getCroppedImageDataUrl();
    if (!dataUrl) {
      showToast('Vui lòng kéo chuột tạo vùng chọn trên trang PDF trước khi cắt!', 'warn');
      return;
    }
    setQImage(dataUrl);
    showToast('Đã cắt ảnh vùng chọn làm ảnh minh họa câu hỏi!', 'success');
  };

  const handleCropForOption = (optIdx: number) => {
    const dataUrl = getCroppedImageDataUrl();
    if (!dataUrl) {
      showToast('Vui lòng kéo chuột tạo vùng chọn trên trang PDF trước khi cắt!', 'warn');
      return;
    }
    setOptions((prev) =>
      prev.map((opt, i) => (i === optIdx ? { ...opt, img: dataUrl } : opt))
    );
    showToast(`Đã gán ảnh vùng chọn cho Phương án ${String.fromCharCode(65 + optIdx)}!`, 'success');
  };

  // Capture Full Page
  const handleCaptureFullPage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setQImage(dataUrl);
    showToast('Đã chụp toàn bộ trang làm ảnh câu hỏi!', 'success');
  };

  // Preview TTS Audio
  const handlePreviewTts = () => {
    const text = ttsScript.trim() || qAudio.replace(/^tts:/, '').trim();
    if (!text) {
      showToast('Vui lòng nhập nội dung giọng đọc bài nghe!', 'warn');
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.95;

    utter.onstart = () => setIsAudioPreviewPlaying(true);
    utter.onend = () => setIsAudioPreviewPlaying(false);
    utter.onerror = () => setIsAudioPreviewPlaying(false);

    window.speechSynthesis.speak(utter);
    showToast('Đang phát giọng đọc mẫu TTS...', 'info');
  };

  const handleStopTts = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsAudioPreviewPlaying(false);
  };

  // Microphone recording
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Trình duyệt chưa hỗ trợ quyền Microphone!', 'error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setQAudio(base64Audio);
          showToast('Đã lưu bản ghi âm micro vào câu hỏi!', 'success');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      showToast('Đang ghi âm giọng đọc của bạn...', 'info');
    } catch (err: any) {
      showToast('Lỗi micro: ' + (err.message || 'Không thể truy cập micro'), 'error');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  // Handle Audio file upload inside importer
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setQAudio(dataUrl);
      showToast(`Đã đính kèm file âm thanh "${file.name}"!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Intelligent text auto-detect from current page
  const handleAutoDetectFromPage = () => {
    if (!textLines.length) {
      showToast('Không tìm thấy văn bản nào trên trang này!', 'warn');
      return;
    }

    // Try finding section header (e.g. PART 1, LISTENING, READING)
    const sectionLine = textLines.find((l) => /part\s+\d+|listening|reading|writing/i.test(l));
    if (sectionLine) {
      setQSectionTitle(sectionLine);
    }

    // Try finding question instruction or prompt
    const promptLine = textLines.find(
      (l) => /look and|listen and|read and|write|choose|what|where|who/i.test(l) && l.length > 10
    );
    if (promptLine) {
      setQPrompt(promptLine);
    } else {
      setQPrompt(textLines.slice(0, 2).join(' '));
    }

    // Check if page contains listening prompt
    const hasListenKeyword = textLines.some((l) => /listen|audio|hear|sound/i.test(l));
    if (hasListenKeyword) {
      const transcript = textLines.filter((l) => l.length > 8).slice(0, 4).join('. ');
      setTtsScript(transcript);
      setQAudio(`tts:${transcript}`);
    }

    // Check if there are options A, B, C or 1, 2, 3
    const optionCandidates = textLines.filter((l) => /^[A-D]\b|^[1-4]\b/i.test(l));
    if (optionCandidates.length >= 2) {
      setOptions(optionCandidates.slice(0, 4).map((text) => ({ text })));
    }

    showToast('✨ Đã tự động nhận diện nội dung trang đưa vào đề bài!', 'success');
  };

  // Add Question to Main Exam
  const handleSaveQuestion = () => {
    if (!qPrompt.trim() && !qImage) {
      showToast('Vui lòng nhập nội dung đề bài hoặc cắt hình ảnh từ PDF!', 'warn');
      return;
    }

    let finalAudio = qAudio;
    if (audioMode === 'tts' && ttsScript.trim()) {
      finalAudio = `tts:${ttsScript.trim()}`;
    }

    const newQ: Question = {
      q: qPrompt.trim() || 'Quan sát hình ảnh và trả lời câu hỏi:',
      type: qType,
      partId: selectedPartId,
      points: qPoints,
      img: qImage || undefined,
      audio: finalAudio || undefined,
      audioScript: ttsScript.trim() || undefined,
      maxPlayCount: finalAudio ? maxPlayCount : undefined,
      autoPlayAudio: finalAudio ? autoPlayAudio : undefined,
      sectionTitle: qSectionTitle.trim() || undefined,
      exampleHint: qExampleHint.trim() || undefined
    };

    if (qType === 'multiple-choice' || qType === 'listening') {
      newQ.options = options;
      newQ.correctIndex = correctIndex;
    } else if (qType === 'yes-no') {
      newQ.options = [{ text: 'yes (Đúng)' }, { text: 'no (Sai)' }];
      newQ.correctIndex = correctIndex;
    } else if (qType === 'tick-cross') {
      newQ.isTick = isTick;
    } else if (qType === 'listen-write') {
      newQ.acceptableAnswers = acceptableAnswersStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (qType === 'unscramble-word') {
      const target = targetWord.trim().toLowerCase();
      const letters = scrambledLettersStr
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      newQ.unscramble = {
        targetWord: target,
        scrambledLetters: letters.length ? letters : target.split('').sort(() => Math.random() - 0.5)
      };
    }

    onAddQuestion(newQ);
    setCreatedCount((prev) => prev + 1);
    showToast(`Đã thêm thành công câu hỏi vào đề thi! (Đã nạp: ${createdCount + 1} câu)`, 'success');

    // Reset some fields for next question but keep page open
    setQImage('');
    setQPrompt('');
    setTtsScript('');
    setQAudio('');
    setSelection(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-7xl h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-xs">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  BẢNG NẠP ĐỀ & TRÍCH XUẤT TỪ FILE PDF
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 text-[11px] font-black">
                  Tải Lên PDF Của Bạn
                </span>
              </div>
              <p className="text-xs text-blue-100 hidden sm:block">
                Xem từng trang PDF của bạn, kéo chuột cắt hình ảnh và trích xuất nội dung đưa trực tiếp vào đề thi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-white/15 text-xs font-bold hidden md:inline">
              Đã nạp vào đề: <strong className="text-emerald-300 font-black">{createdCount}</strong> câu
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        {/* Top Action & Navigation Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* File Picker & Upload Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95">
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>{pdfDoc ? 'Tải tệp PDF khác' : 'Chọn tệp PDF từ máy tính'}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {pdfFileName && (
              <span className="text-xs font-extrabold text-slate-700 bg-white border border-slate-300 px-3 py-1 rounded-xl shadow-2xs truncate max-w-xs">
                📄 {pdfFileName}
              </span>
            )}
          </div>

          {/* Page Pagination & Zoom Controls */}
          {numPages > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              <span className="text-xs font-extrabold text-slate-800 px-1">
                Trang {currentPage} / {numPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1"></div>

              {/* Zoom Buttons */}
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, s - 0.2))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                title="Thu nhỏ"
              >
                <i className="fa-solid fa-magnifying-glass-minus"></i>
              </button>
              <span className="text-[11px] font-mono text-slate-600 font-bold w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                title="Phóng to"
              >
                <i className="fa-solid fa-magnifying-glass-plus"></i>
              </button>
            </div>
          )}
        </div>

        {/* If no PDF is loaded yet: Welcoming Upload Workspace */}
        {!pdfDoc ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex-1 flex flex-col items-center justify-center p-6 text-center transition-all ${
              isDragOver ? 'bg-blue-50 border-2 border-dashed border-blue-500' : 'bg-slate-50'
            }`}
          >
            <div className="max-w-xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-black mx-auto shadow-xl shadow-blue-500/20">
                <i className="fa-solid fa-file-arrow-up"></i>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Tải Lên Bảng Đề Thi PDF Của Bạn
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Kéo thả file đề thi PDF của bạn vào đây hoặc nhấn nút bên dưới để bắt đầu. Bạn có thể xem từng trang, dùng chuột quét chọn để cắt hình ảnh và trích xuất nội dung văn bản trực tiếp.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <label className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer active:scale-95">
                  <i className="fa-solid fa-cloud-arrow-up text-base"></i>
                  <span>Chọn file PDF từ máy tính của bạn</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-blue-600 font-extrabold text-xs flex items-center gap-1.5">
                    <i className="fa-solid fa-crop"></i> 1. Cắt hình ảnh
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Kéo chuột chọn khu vực tranh ảnh bất kỳ trên trang PDF để cắt đưa vào câu hỏi.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-emerald-600 font-extrabold text-xs flex items-center gap-1.5">
                    <i className="fa-solid fa-file-lines"></i> 2. Lấy nội dung chữ
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tự động nhận diện chữ, đề bài và các phương án từ trang đề để nhập liệu tức thì.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-purple-600 font-extrabold text-xs flex items-center gap-1.5">
                    <i className="fa-solid fa-headphones"></i> 3. Đính kèm bài nghe
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tạo giọng đọc AI hoặc ghi âm bài nghe và đặt số lượt nghe cho học sinh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Split Body: Left PDF Canvas & Tools | Right Question Builder */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
            {/* Left Column (7 cols): User PDF Viewer & Extraction Tools */}
            <div className="lg:col-span-7 flex flex-col border-r border-slate-200 bg-slate-200/50 overflow-hidden">
              {/* Toolbar: Crop Actions & View Mode Tabs */}
              <div className="bg-white/90 backdrop-blur px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('visual')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'visual'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-image"></i> Bảng PDF & Cắt ảnh
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('text')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'text'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-align-left"></i> Văn bản trang ({textLines.length})
                  </button>
                </div>

                {activeTab === 'visual' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCropForQuestionImage}
                      disabled={!selection || selection.w < 10}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-scissors"></i> Lấy ảnh câu hỏi
                    </button>

                    <button
                      type="button"
                      onClick={handleCaptureFullPage}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-camera"></i> Chụp cả trang
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoDetectFromPage}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                      title="Tự động đọc nội dung trang và đưa vào đề bài"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Nhận diện trang
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: Visual PDF Canvas with Crop Overlay */}
              {activeTab === 'visual' && (
                <div
                  ref={containerRef}
                  className="flex-1 overflow-auto p-4 flex items-center justify-center relative select-none"
                >
                  {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
                      <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg border">
                        <span className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
                        <span className="text-xs font-bold text-slate-700">Đang tải trang PDF...</span>
                      </div>
                    </div>
                  )}

                  <div
                    className="relative shadow-xl rounded-lg overflow-hidden bg-white cursor-crosshair inline-block"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <canvas ref={canvasRef} className="block" />

                    {/* Selection Box Overlay */}
                    {selection && (
                      <div
                        className="absolute border-2 border-dashed border-blue-600 bg-blue-500/20 pointer-events-none"
                        style={{
                          left: selection.x,
                          top: selection.y,
                          width: selection.w,
                          height: selection.h
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-blue-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                          {Math.round(selection.w)} × {Math.round(selection.h)} px
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Extracted Text Lines with 1-click insert */}
              {activeTab === 'text' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
                    💡 Nhấp vào các nút bên cạnh từng dòng văn bản để đưa trực tiếp vào Đề bài, Tiêu đề hoặc Bài nghe.
                  </div>

                  {textLines.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 text-center">
                      Không tìm thấy văn bản nào trên trang này.
                    </p>
                  ) : (
                    textLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 flex items-center justify-between gap-3 text-xs shadow-2xs group"
                      >
                        <span className="font-sans text-slate-800 flex-1 leading-relaxed">
                          {line}
                        </span>

                        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setQPrompt((prev) => (prev ? prev + ' ' + line : line));
                              showToast('Đã thêm vào Đề bài!');
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-[11px] font-bold transition cursor-pointer"
                            title="Đưa vào đề bài"
                          >
                            + Đề bài
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQSectionTitle(line);
                              showToast('Đã gán làm Tiêu đề phần!');
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-[11px] font-bold transition cursor-pointer"
                            title="Đưa vào tiêu đề phần"
                          >
                            + Tiêu đề
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTtsScript((prev) => (prev ? prev + ' ' + line : line));
                              setQAudio(`tts:${line}`);
                              showToast('Đã đưa vào Lời thoại nghe!');
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-[11px] font-bold transition cursor-pointer"
                            title="Đưa vào bài nghe"
                          >
                            + Bài nghe
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Right Column (5 cols): Question Builder Form */}
            <div className="lg:col-span-5 flex flex-col bg-white overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    Soạn Thảo Câu Hỏi Đưa Lên
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Điền nội dung, đính kèm ảnh và âm thanh rồi bấm Thêm vào đề thi
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-plus"></i> Thêm vào đề thi
                </button>
              </div>

              {/* Form Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* Part Assignment & Question Points */}
                {parts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-extrabold text-indigo-950">
                        Thêm vào Part:
                      </label>
                      <select
                        value={selectedPartId}
                        onChange={(e) => setSelectedPartId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-indigo-300 rounded-lg text-indigo-900 focus:outline-none"
                      >
                        {parts.map((p, pi) => (
                          <option key={p.id} value={p.id}>
                            Part {pi + 1}: {p.title} ({p.points}đ)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-extrabold text-indigo-950">
                        Thang điểm câu này:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="100"
                          value={qPoints}
                          onChange={(e) => setQPoints(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs font-black bg-white border border-indigo-300 rounded-lg text-center text-slate-900"
                        />
                        <span className="text-xs font-bold text-indigo-900 shrink-0">điểm</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Question Type Selector */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Dạng câu hỏi:
                  </label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="multiple-choice">Trắc nghiệm chọn 1 đáp án (Multiple-choice)</option>
                    <option value="tick-cross">Đúng / Sai dạng ✔ hoặc ✘ (Tick / Cross)</option>
                    <option value="listen-write">Nghe & Điền tên hoặc số (Listen & Write)</option>
                    <option value="unscramble-word">Sắp xếp các chữ cái thành từ (Anagram)</option>
                    <option value="yes-no">Câu hỏi Yes / No</option>
                    <option value="multi-choice">Trắc nghiệm chọn nhiều đáp án</option>
                  </select>
                </div>

                {/* Section Title & Example Hint */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Tiêu đề phần (Section Title)
                    </label>
                    <input
                      type="text"
                      value={qSectionTitle}
                      onChange={(e) => setQSectionTitle(e.target.value)}
                      placeholder="VD: PART 1 - LISTENING"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Hướng dẫn / Ví dụ (Hint)
                    </label>
                    <input
                      type="text"
                      value={qExampleHint}
                      onChange={(e) => setQExampleHint(e.target.value)}
                      placeholder="VD: Look and read. Put a tick..."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nội dung câu hỏi (Đề bài):
                  </label>
                  <textarea
                    rows={2}
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    placeholder="Nhập nội dung câu hỏi hoặc lấy từ văn bản trang PDF..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                {/* Cropped Image Preview */}
                {qImage && (
                  <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>🖼️ Hình ảnh câu hỏi (Đã cắt từ PDF):</span>
                      <button
                        type="button"
                        onClick={() => setQImage('')}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Xóa ảnh
                      </button>
                    </div>
                    <div className="flex justify-center p-2 bg-white rounded-lg border border-slate-200">
                      <img src={qImage} alt="Crop preview" className="max-h-36 object-contain" />
                    </div>
                  </div>
                )}

                {/* KHUNG THÊM AUDIO CHO HỌC SINH */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <i className="fa-solid fa-headphones text-emerald-600"></i>
                      <span>Khung Âm Thanh Bài Nghe (Audio & TTS):</span>
                    </label>

                    {/* Audio Mode Tabs */}
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setAudioMode('tts')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                          audioMode === 'tts' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Giọng AI (TTS)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioMode('record')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                          audioMode === 'record' ? 'bg-rose-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Ghi âm
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioMode('upload')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                          audioMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Tải file
                      </button>
                    </div>
                  </div>

                  {/* Mode TTS */}
                  {audioMode === 'tts' && (
                    <div className="space-y-1.5">
                      <textarea
                        rows={2}
                        value={ttsScript}
                        onChange={(e) => {
                          setTtsScript(e.target.value);
                          setQAudio(e.target.value ? `tts:${e.target.value.trim()}` : '');
                        }}
                        placeholder="Nhập lời thoại tiếng Anh để hệ thống đọc cho học sinh nghe..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          Học sinh sẽ nghe giọng đọc phát âm chuẩn tiếng Anh.
                        </span>
                        {isAudioPreviewPlaying ? (
                          <button
                            type="button"
                            onClick={handleStopTts}
                            className="px-2.5 py-1 rounded bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Dừng nghe
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handlePreviewTts}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                          >
                            <i className="fa-solid fa-play text-[10px]"></i> Nghe thử TTS
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mode Record */}
                  {audioMode === 'record' && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-700 font-medium">
                        {isRecording ? `🔴 Đang ghi âm (${recordSeconds}s)...` : 'Microphone giáo viên'}
                      </span>
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                        >
                          <i className="fa-solid fa-microphone"></i> Bắt đầu ghi
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                        >
                          Dừng & Lưu
                        </button>
                      )}
                    </div>
                  )}

                  {/* Mode Upload */}
                  {audioMode === 'upload' && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                      <label className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1">
                        <i className="fa-solid fa-upload"></i> Chọn file MP3/WAV
                        <input type="file" accept="audio/*" onChange={handleAudioFileUpload} className="hidden" />
                      </label>
                      {qAudio && !qAudio.startsWith('tts:') && (
                        <span className="text-xs text-emerald-700 font-bold">✅ Đã có file audio</span>
                      )}
                    </div>
                  )}

                  {/* Audio Limits Setting */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">Lượt nghe:</span>
                      <select
                        value={maxPlayCount}
                        onChange={(e) => setMaxPlayCount(parseInt(e.target.value, 10))}
                        className="px-2 py-0.5 text-xs font-bold bg-white border border-emerald-300 rounded"
                      >
                        <option value={1}>1 lượt</option>
                        <option value={2}>2 lượt (Chuẩn)</option>
                        <option value={3}>3 lượt</option>
                        <option value={0}>Không giới hạn</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={autoPlayAudio}
                        onChange={(e) => setAutoPlayAudio(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-600"
                      />
                      <span>Tự động phát</span>
                    </label>
                  </div>
                </div>

                {/* Type-Specific Options Editor */}
                {/* 1. Multiple Choice */}
                {(qType === 'multiple-choice' || qType === 'listening') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Phương án lựa chọn (Chọn đáp án đúng):
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setOptions((prev) => [
                            ...prev,
                            { text: `Lựa chọn ${String.fromCharCode(65 + prev.length)}`, img: '' }
                          ])
                        }
                        className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        + Thêm phương án
                      </button>
                    </div>

                    <div className="space-y-2">
                      {options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            correctIndex === idx
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="correct_choice"
                            checked={correctIndex === idx}
                            onChange={() => setCorrectIndex(idx)}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                          />
                          <span className="font-black text-xs text-slate-700 w-4">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOptions((prev) =>
                                prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                              );
                            }}
                            placeholder={`Nội dung đáp án ${String.fromCharCode(65 + idx)}...`}
                            className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                          />

                          {selection && selection.w > 10 && (
                            <button
                              type="button"
                              onClick={() => handleCropForOption(idx)}
                              title="Gán ảnh vùng chọn trên PDF cho phương án này"
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold border border-blue-200 cursor-pointer"
                            >
                              Gán ảnh
                            </button>
                          )}

                          {opt.img && (
                            <img src={opt.img} alt="Opt" className="w-8 h-8 object-cover rounded border" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Tick or Cross */}
                {qType === 'tick-cross' && (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700">
                      Đáp án đúng là Đánh dấu Đúng (✔) hay Sai (✘)?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsTick(true)}
                        className={`p-3 rounded-xl border font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                          isTick
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>✔ TICK (Đúng)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTick(false)}
                        className={`p-3 rounded-xl border font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                          !isTick
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50'
                        }`}
                      >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>✘ CROSS (Sai)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Listen and Write */}
                {qType === 'listen-write' && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700">
                      Danh sách đáp án được chấp nhận (phân cách bằng dấu phẩy):
                    </label>
                    <input
                      type="text"
                      value={acceptableAnswersStr}
                      onChange={(e) => setAcceptableAnswersStr(e.target.value)}
                      placeholder="VD: May, may, MAY (hoặc: 6, six)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                    />
                    <p className="text-[11px] text-slate-500">
                      Học sinh nghe âm thanh rồi nhập từ hoặc số vào ô trống.
                    </p>
                  </div>
                )}

                {/* 4. Unscramble Word */}
                {qType === 'unscramble-word' && (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Từ mục tiêu (Đáp án đúng):
                      </label>
                      <input
                        type="text"
                        value={targetWord}
                        onChange={(e) => {
                          const w = e.target.value;
                          setTargetWord(w);
                          if (!scrambledLettersStr) {
                            setScrambledLettersStr(
                              w
                                .toLowerCase()
                                .split('')
                                .sort(() => Math.random() - 0.5)
                                .join(', ')
                            );
                          }
                        }}
                        placeholder="VD: valley, guitar, beach..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold uppercase tracking-wider"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Các chữ cái bị xáo trộn (phân cách bằng dấu phẩy):
                      </label>
                      <input
                        type="text"
                        value={scrambledLettersStr}
                        onChange={(e) => setScrambledLettersStr(e.target.value)}
                        placeholder="VD: l, l, e, a, v, y"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Add Question Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveQuestion}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus-circle text-base"></i>
                    <span>Thêm Câu Hỏi Này Vào Ngân Hàng Đề Thi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
