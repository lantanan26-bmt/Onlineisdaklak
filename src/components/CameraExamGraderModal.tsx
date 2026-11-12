import React, { useState, useRef, useEffect } from 'react';
import { Question, ExamPart, Student, PartScoreRecord, GradeExamProfile } from '../types';

interface CameraExamGraderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: ExamPart[];
  questions: Question[];
  schools: string[];
  students: Student[];
  gradeExams?: GradeExamProfile[];
  activeExamId?: string;
  onSelectExam?: (examId: string) => void;
  onSaveGradedStudent: (studentData: {
    studentId: string;
    name: string;
    className: string;
    school: string;
    score: number;
    total: number;
    points10: string;
    questionScores: Record<number, number>;
    partScores: Record<string, PartScoreRecord>;
    details: Record<number, any>;
  }) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

interface QuestionResultItem {
  questionIndex: number;
  questionNumber: number;
  prompt: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  notes?: string;
}

interface ScanResultData {
  student: {
    name: string;
    className: string;
    school: string;
    studentId?: string;
  };
  scoreSummary: {
    earnedPoints: number;
    totalPoints: number;
    points10: string;
    correctCount: number;
    totalQuestions: number;
  };
  questionResults: QuestionResultItem[];
  confidenceNotes?: string;
}

export const CameraExamGraderModal: React.FC<CameraExamGraderModalProps> = ({
  isOpen,
  onClose,
  parts,
  questions,
  schools,
  students,
  gradeExams,
  activeExamId,
  onSelectExam,
  onSaveGradedStudent,
  showToast,
}) => {
  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasCameraError, setHasCameraError] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');

  // Captured image and AI scan states
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);

  // Editable Student metadata in review screen
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editId, setEditId] = useState('');

  // Editable question scores
  const [editableResults, setEditableResults] = useState<QuestionResultItem[]>([]);

  // Batch count
  const [gradedCount, setGradedCount] = useState(0);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing, capturedImage]);

  const startCamera = async () => {
    stopCamera();
    setHasCameraError(false);
    setCameraErrorMsg('');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      // Fallback try without strict facingMode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
      } catch (err2: any) {
        setHasCameraError(true);
        setCameraErrorMsg('Không thể mở camera tự động. Bạn có thể bấm nút "Tải ảnh từ máy" bên dưới để chọn ảnh chụp bài thi.');
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture snapshot from live camera
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
    // Trigger AI Scan immediately
    processPaperWithGemini(dataUrl);
  };

  // Handle file upload from phone gallery / camera file picker
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedImage(dataUrl);
      stopCamera();
      processPaperWithGemini(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send to backend Gemini API
  const processPaperWithGemini = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanStep('1. Đang tải hình ảnh và quét thông tin học sinh...');
    setScanResult(null);

    const stepTimer1 = setTimeout(() => {
      setScanStep('2. Đang đọc câu trả lời và bài làm trên giấy...');
    }, 2000);

    const stepTimer2 = setTimeout(() => {
      setScanStep('3. Đối chiếu đáp án với ngân hàng đề thi & tính điểm...');
    }, 4500);

    try {
      const res = await fetch('/api/scan-exam-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          parts,
          questions,
          schools,
          students,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi xử lý hình ảnh bài thi');
      }

      const data: ScanResultData = json.data;
      setScanResult(data);
      setEditableResults(data.questionResults || []);

      // Prefill editable fields
      const detectedName = data.student?.name || 'Học sinh chưa rõ tên';
      const detectedClass = data.student?.className || 'Khối 2';
      const detectedSchool = data.student?.school || schools[0] || 'Trường Tiểu học iSMART';
      const detectedId = data.student?.studentId || `OFFLINE_${Math.floor(1000 + Math.random() * 9000)}`;

      // Check if matches existing student
      const matched = students.find(
        (s) =>
          (data.student?.studentId && s.id === data.student.studentId) ||
          (s.name.trim().toLowerCase() === detectedName.trim().toLowerCase() &&
            s.className.trim().toLowerCase() === detectedClass.trim().toLowerCase())
      );

      if (matched) {
        setEditName(matched.name);
        setEditClass(matched.className);
        setEditSchool(matched.school);
        setEditId(matched.id);
        showToast(`Đã nhận diện khớp học sinh: ${matched.name} (${matched.className})!`, 'success');
      } else {
        setEditName(detectedName);
        setEditClass(detectedClass);
        setEditSchool(detectedSchool);
        setEditId(detectedId);
        showToast(`Đã chấm xong bài thi của ${detectedName}!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Không thể chấm bài thi tự động. Vui lòng thử lại với ảnh rõ nét hơn!', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Teacher manual override for a specific question score
  const handleToggleQuestionCorrect = (resIdx: number) => {
    setEditableResults((prev) => {
      const next = [...prev];
      const item = next[resIdx];
      const newIsCorrect = !item.isCorrect;
      next[resIdx] = {
        ...item,
        isCorrect: newIsCorrect,
        pointsEarned: newIsCorrect ? item.maxPoints : 0,
      };
      return next;
    });
  };

  // Re-calculate live total score based on editable results
  const currentTotalEarned = +(
    editableResults.reduce((acc, item) => acc + (item.pointsEarned || 0), 0)
  ).toFixed(2);
  const currentTotalPossible = +(
    editableResults.reduce((acc, item) => acc + (item.maxPoints || 0), 0)
  ).toFixed(2) || (scanResult?.scoreSummary?.totalPoints ?? 10);

  const currentPoints10 = currentTotalPossible > 0
    ? ((currentTotalEarned / currentTotalPossible) * 10).toFixed(1)
    : '0.0';

  const currentCorrectCount = editableResults.filter((r) => r.isCorrect).length;

  // Save current student score to App state
  const handleCommitStudentResult = () => {
    if (!editName.trim()) {
      showToast('Vui lòng nhập tên học sinh!', 'warn');
      return;
    }

    const studentFinalId = editId.trim() || `STUDENT_${Date.now()}`;

    // Build questionScores and details
    const questionScores: Record<number, number> = {};
    const details: Record<number, any> = {};

    editableResults.forEach((r) => {
      questionScores[r.questionIndex] = r.pointsEarned;
      details[r.questionIndex] = {
        userAnswer: r.studentAnswer,
        isCorrect: r.isCorrect,
        pointsEarned: r.pointsEarned,
        notes: r.notes,
      };
    });

    // Build partScores
    const partScores: Record<string, PartScoreRecord> = {};
    parts.forEach((p) => {
      const qInPart = questions
        .map((q, idx) => ({ q, idx }))
        .filter((item) => (item.q.partId || parts[0]?.id) === p.id);

      const earnedInPart = +(
        qInPart.reduce((acc, item) => acc + (questionScores[item.idx] || 0), 0)
      ).toFixed(2);

      const correctInPart = qInPart.filter((item) => {
        const r = editableResults.find((res) => res.questionIndex === item.idx);
        return r ? r.isCorrect : false;
      }).length;

      partScores[p.id] = {
        partId: p.id,
        partTitle: p.title,
        section: p.section,
        earnedPoints: earnedInPart,
        totalPoints: p.points,
        correctCount: correctInPart,
        questionCount: qInPart.length,
      };
    });

    onSaveGradedStudent({
      studentId: studentFinalId,
      name: editName.trim(),
      className: editClass.trim() || 'Khối 2',
      school: editSchool.trim() || 'Trường Tiểu học',
      score: currentTotalEarned,
      total: currentTotalPossible,
      points10: currentPoints10,
      questionScores,
      partScores,
      details,
    });

    setGradedCount((prev) => prev + 1);
    showToast(`🎉 Đã lưu kết quả của ${editName.trim()} (${currentPoints10}đ / 10đ) vào danh sách thi!`, 'success');

    // Reset for next paper
    handleResetForNextPaper();
  };

  const handleResetForNextPaper = () => {
    setCapturedImage(null);
    setScanResult(null);
    setEditableResults([]);
    setEditName('');
    setEditClass('');
    setEditSchool('');
    setEditId('');
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl max-w-5xl w-full text-white shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-400/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/50 text-indigo-300 flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-camera"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  QUÉT CHẤM BÀI THI BẰNG CAMERA ĐIỆN THOẠI
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-black">
                  AI Gemini 3.8 Vision
                </span>
                {gradedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold">
                    Đã chấm: {gradedCount} bài
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Dành cho bài thi Offline: Tự động quét Họ Tên, Lớp, Trường và chấm điểm câu trả lời trên giấy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {gradeExams && gradeExams.length > 0 && onSelectExam && (
              <div className="flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-400/40 px-2.5 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-amber-400">🎒 Đáp án đề:</span>
                <select
                  value={activeExamId || gradeExams[0]?.id}
                  onChange={(e) => onSelectExam(e.target.value)}
                  className="bg-slate-900 border border-indigo-500/50 rounded-lg px-2 py-1 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 text-xs"
                >
                  {gradeExams.map((ge) => (
                    <option key={ge.id} value={ge.id}>
                      {ge.grade} {ge.className && ge.className !== 'Tất cả các lớp' ? `(${ge.className})` : ''} - {ge.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              title="Đóng bảng quét"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* VIEW 1: LIVE CAMERA VIEWFINDER (When no image captured yet) */}
          {!capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] sm:aspect-[16/10] max-h-[520px] w-full bg-black rounded-3xl overflow-hidden border-2 border-indigo-500/40 shadow-xl flex items-center justify-center">
                {isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />

                    {/* Framing Alignment Guide for Paper Test */}
                    <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <span className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></span>
                        <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur text-emerald-300 text-xs font-bold border border-emerald-400/50">
                          Đặt bài thi giấy vào giữa khung hình
                        </div>
                        <span className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></span>
                        <span className="text-[11px] text-white/80 bg-black/50 px-2.5 py-1 rounded-md font-medium">
                          Đảm bảo nhìn rõ phần Họ Tên, Lớp và các câu trả lời
                        </span>
                        <span className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center space-y-3 max-w-md">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl mx-auto">
                      <i className="fa-solid fa-camera-rotate"></i>
                    </div>
                    <p className="text-sm font-bold text-slate-200">
                      {hasCameraError ? cameraErrorMsg : 'Đang khởi động Camera...'}
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-md"
                      >
                        Thử lại Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer border border-white/20"
                  title="Chuyển giữa Camera Sau và Camera Trước"
                >
                  <i className="fa-solid fa-arrows-rotate"></i>
                  <span>Đổi camera ({cameraFacing === 'environment' ? 'Camera Sau' : 'Camera Trước'})</span>
                </button>

                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={!isCameraActive}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center gap-2.5 transition active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  <i className="fa-solid fa-circle-dot text-lg text-emerald-950 animate-pulse"></i>
                  <span>CHỤP & QUÉT CHẤM ĐIỂM</span>
                </button>

                <label className="px-5 py-3 rounded-2xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer border border-indigo-400/40 shadow-md">
                  <i className="fa-solid fa-image"></i>
                  <span>Chọn ảnh từ Thư viện điện thoại / Máy tính</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          )}

          {/* VIEW 2: AI SCANNING IN PROGRESS */}
          {capturedImage && isScanning && (
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-800/80 border-2 border-indigo-400/50 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-emerald-400 animate-spin"></div>
                <div className="w-full h-full rounded-full flex items-center justify-center text-3xl text-emerald-300">
                  <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-white">AI Đang Phân Tích & Chấm Bài Thi...</h4>
                <p className="text-sm font-bold text-indigo-300 max-w-md mx-auto">{scanStep}</p>
                <p className="text-xs text-slate-400">
                  Hệ thống đang đối chiếu bài làm với {questions.length} câu hỏi và đáp án đề thi của bạn.
                </p>
              </div>

              {capturedImage && (
                <div className="max-w-xs mx-auto rounded-xl overflow-hidden border border-white/20 shadow-lg opacity-60">
                  <img src={capturedImage} alt="Bài thi đang quét" className="max-h-36 object-contain mx-auto" />
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: GRADING REVIEW & CONFIRMATION RESULT */}
          {capturedImage && !isScanning && scanResult && (
            <div className="space-y-6 animate-in fade-in">
              {/* Top Banner: Score & Verification Card */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Score Card */}
                <div className="md:col-span-5 p-5 rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 border-2 border-emerald-400/60 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
                      Kết Quả Chấm Điểm
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/40 text-[11px] font-bold">
                      {currentCorrectCount} / {editableResults.length} câu đúng
                    </span>
                  </div>

                  <div className="text-center py-2 space-y-1">
                    <div className="text-4xl sm:text-5xl font-black text-white font-serif tracking-tight">
                      {currentPoints10} <span className="text-2xl font-bold text-emerald-300">/ 10 đ</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-200/90">
                      Tổng điểm thô: {currentTotalEarned} / {currentTotalPossible} điểm
                    </div>
                  </div>

                  {/* Thumbnail of scanned paper */}
                  <div className="relative group rounded-2xl overflow-hidden border border-emerald-400/40 bg-black/40">
                    <img
                      src={capturedImage}
                      alt="Ảnh bài thi vừa quét"
                      className="w-full max-h-48 object-contain mx-auto"
                    />
                    <div className="p-1.5 bg-black/70 text-center text-[10px] text-slate-300 font-mono">
                      Ảnh bài thi đã chụp
                    </div>
                  </div>
                </div>

                {/* Student Detected Info Card */}
                <div className="md:col-span-7 p-5 rounded-3xl bg-slate-800/90 border-2 border-indigo-400/40 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-id-card"></i>
                      <span>Thông Tin Thí Sinh (Tự Động Quét)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 italic">
                      Bạn có thể chỉnh sửa nếu cần
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="block text-slate-300 font-bold">Họ và tên học sinh:</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nguyễn Văn A..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-300 font-bold">Lớp:</label>
                      <input
                        type="text"
                        value={editClass}
                        onChange={(e) => setEditClass(e.target.value)}
                        placeholder="2A1, 2B..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-300 font-bold">Trường học:</label>
                      <input
                        type="text"
                        value={editSchool}
                        onChange={(e) => setEditSchool(e.target.value)}
                        placeholder="Tiểu học iSMART..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-300 font-bold">Số báo danh / Mã HS:</label>
                      <input
                        type="text"
                        value={editId}
                        onChange={(e) => setEditId(e.target.value)}
                        placeholder="SBD01..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {scanResult.confidenceNotes && (
                    <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-400/30 text-[11px] text-indigo-200">
                      <i className="fa-solid fa-circle-info mr-1 text-indigo-400"></i>
                      <span>{scanResult.confidenceNotes}</span>
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleCommitStudentResult}
                      className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                    >
                      <i className="fa-solid fa-floppy-disk text-base"></i>
                      <span>LƯU ĐIỂM VÀO DANH SÁCH</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetForNextPaper}
                      className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Bỏ qua bài này và quét bài tiếp theo"
                    >
                      <i className="fa-solid fa-camera-rotate"></i>
                      <span>Quét bài khác</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed Question-by-Question Breakdown Table */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-800/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <i className="fa-solid fa-list-check text-indigo-400"></i>
                    <span>Chi Tiết Điểm Từng Câu Hỏi ({editableResults.length} câu):</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    Click vào nút điểm nếu bạn muốn điều chỉnh thủ công
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {editableResults.map((item, rIdx) => {
                    return (
                      <div
                        key={rIdx}
                        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition ${
                          item.isCorrect
                            ? 'bg-emerald-950/40 border-emerald-500/40'
                            : 'bg-red-950/30 border-red-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                              item.isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                            }`}
                          >
                            {item.isCorrect ? '✓' : '✗'}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>Câu {item.questionNumber}:</span>
                              <span className="text-slate-300 font-normal line-clamp-1 max-w-md">
                                {item.prompt || 'Đề bài'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                              <span>
                                Học sinh làm: <strong className="text-amber-300">{item.studentAnswer || 'Không chọn'}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Đáp án đúng: <strong className="text-emerald-300">{item.correctAnswer}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Point modifier button */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleQuestionCorrect(rIdx)}
                            className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer border ${
                              item.isCorrect
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-red-500/20 hover:text-red-300'
                                : 'bg-red-500/20 text-red-300 border-red-400/40 hover:bg-emerald-500/20 hover:text-emerald-300'
                            }`}
                            title="Bấm để đổi Đúng/Sai thủ công"
                          >
                            <span>+{item.pointsEarned} / {item.maxPoints} đ</span>
                            <span className="ml-1 text-[10px] opacity-75">(sửa)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-950 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-emerald-400"></i>
            <span>Dữ liệu chấm bài từ camera được đồng bộ thẳng vào Bảng Quản Trị Học Sinh & Điểm Số</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
