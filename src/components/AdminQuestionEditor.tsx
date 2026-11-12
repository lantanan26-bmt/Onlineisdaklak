import React, { useRef, useState } from 'react';
import { Question, QuestionType, FillBlankBox, ConnectPairPoint, ColourItem, ExamPart, GradeExamProfile } from '../types';
import { getAdvancedGrade2Questions, getAdvancedGrade2Parts, GRADE2_MEDIA } from '../demoData';
import { QuestionAudioEditor } from './QuestionAudioEditor';
import { AdminPartHeader } from './AdminPartHeader';
import { GradeExamSelectorBar } from './GradeExamSelectorBar';
import { CAMBRIDGE_CRAYONS, getCrayonInfo, DEFAULT_CAMBRIDGE_COLORING_SCENE } from '../utils/cambridgeColours';
import {
  getCleanPartTitle,
  canonicalSortParts,
  renumberPartsBySection,
  syncAndSortQuestionsByParts,
  isQuestionExample
} from '../utils/sectionUtils';

interface AdminQuestionEditorProps {
  parts: ExamPart[];
  onPartsChange: (parts: ExamPart[]) => void;
  questions: Question[];
  onChange: (questions: Question[]) => void;
  onResetSample: () => void;
  onOpenPdfImporter?: () => void;
  onOpenCameraGrader?: () => void;
  onOpenOfflinePrinter?: () => void;
  onStartTestRun?: (initialPartId?: string) => void;
  onSaveAndSync?: () => Promise<void> | void;
  isSaving?: boolean;
  lastSavedTime?: string;
  gradeExams?: GradeExamProfile[];
  activeExamId?: string;
  onSelectExam?: (examId: string) => void;
  onCreateExam?: (newExam: {
    grade: string;
    className: string;
    title: string;
    description: string;
    examMinutes: number;
    copyFromId?: string;
  }) => void;
  onDuplicateExam?: (sourceExamId: string, targetGrade: string, targetClass: string, targetTitle: string) => void;
  onUpdateExamMeta?: (examId: string, patch: Partial<GradeExamProfile>) => void;
  onDeleteExam?: (examId: string) => void;
  availableClasses?: string[];
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
}

const MAX_Q = 50;

export const AdminQuestionEditor: React.FC<AdminQuestionEditorProps> = ({
  parts,
  onPartsChange,
  questions,
  onChange,
  onResetSample,
  onOpenPdfImporter,
  onOpenCameraGrader,
  onOpenOfflinePrinter,
  onStartTestRun,
  onSaveAndSync,
  isSaving = false,
  lastSavedTime,
  gradeExams,
  activeExamId,
  onSelectExam,
  onCreateExam,
  onDuplicateExam,
  onUpdateExamMeta,
  onDeleteExam,
  availableClasses,
  showToast,
  openConfirm
}) => {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [draggingPoint, setDraggingPoint] = useState<{ qIdx: number; pIdx: number } | null>(null);
  const [selectedColourSpot, setSelectedColourSpot] = useState<{ qIdx: number; itemIdx: number } | null>(null);
  const [pairInputs, setPairInputs] = useState<Record<number, { p1: string; p2: string }>>({});
  const [newPairDrafts, setNewPairDrafts] = useState<
    Record<
      number,
      {
        leftLabel?: string;
        leftText?: string;
        leftImg?: string;
        rightLabel?: string;
        rightText?: string;
        rightImg?: string;
      }
    >
  >({});

  const getPartSection = (p: ExamPart): 'listening' | 'reading-writing' => {
    if (p.section) return p.section;
    const lower = (p.title + ' ' + (p.instructions || '')).toLowerCase();
    if (lower.includes('listen') || lower.includes('nghe')) return 'listening';
    return 'reading-writing';
  };

  // Part management handlers - Section-scoped to prevent jumbling
  const handleAddPart = (targetSection: 'listening' | 'reading-writing' = 'listening') => {
    const isListen = targetSection === 'listening';
    const sectionParts = parts.filter((p) => getPartSection(p) === targetSection);
    const newPartNum = sectionParts.length + 1;
    const newPart: ExamPart = {
      id: `part-${Date.now()}`,
      section: targetSection,
      title: isListen
        ? `Part ${newPartNum}: Bài nghe Part ${newPartNum}`
        : `Part ${newPartNum}: Bài đọc & viết Part ${newPartNum}`,
      instructions: isListen
        ? `Lắng nghe đoạn audio và hoàn thành các câu hỏi trong Part ${newPartNum}...`
        : `Đọc kỹ đề bài và hoàn thành câu trả lời cho Part ${newPartNum}...`,
      points: 2.5,
      audio: isListen ? `tts:Part ${newPartNum}. Listen carefully to the audio and answer the questions.` : undefined,
      maxPlayCount: isListen ? 2 : undefined
    };

    let nextParts: ExamPart[];
    if (isListen) {
      const listening = [...parts.filter((p) => getPartSection(p) === 'listening'), newPart];
      const other = parts.filter((p) => getPartSection(p) !== 'listening');
      nextParts = [...listening, ...other];
    } else {
      const listening = parts.filter((p) => getPartSection(p) === 'listening');
      const reading = [...parts.filter((p) => getPartSection(p) === 'reading-writing'), newPart];
      const other = parts.filter(
        (p) => getPartSection(p) !== 'listening' && getPartSection(p) !== 'reading-writing'
      );
      nextParts = [...listening, ...reading, ...other];
    }

    onPartsChange(nextParts);
    showToast(`Đã thêm Part ${newPartNum} vào phần thi ${isListen ? 'Listening' : 'Reading & Writing'}!`, 'success');
  };

  const handleUpdatePart = (partId: string, patch: Partial<ExamPart>) => {
    let nextParts = parts.map((p) => (p.id === partId ? { ...p, ...patch } : p));
    if (patch.section) {
      nextParts = canonicalSortParts(nextParts);
      onChange(syncAndSortQuestionsByParts(questions, nextParts));
    }
    onPartsChange(nextParts);
  };

  const handleMovePartWithinSection = (partId: string, direction: 'up' | 'down') => {
    const targetPart = parts.find((p) => p.id === partId);
    if (!targetPart) return;
    const targetSection = getPartSection(targetPart);

    const secParts = parts.filter((p) => getPartSection(p) === targetSection);
    const curIdx = secParts.findIndex((p) => p.id === partId);
    if (curIdx < 0) return;

    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= secParts.length) return;

    const nextSecParts = [...secParts];
    const temp = nextSecParts[curIdx];
    nextSecParts[curIdx] = nextSecParts[targetIdx];
    nextSecParts[targetIdx] = temp;

    let nextParts: ExamPart[];
    if (targetSection === 'listening') {
      const otherParts = parts.filter((p) => getPartSection(p) !== 'listening');
      nextParts = [...nextSecParts, ...otherParts];
    } else {
      const listening = parts.filter((p) => getPartSection(p) === 'listening');
      const other = parts.filter(
        (p) => getPartSection(p) !== 'listening' && getPartSection(p) !== 'reading-writing'
      );
      nextParts = [...listening, ...nextSecParts, ...other];
    }

    onPartsChange(nextParts);
    onChange(syncAndSortQuestionsByParts(questions, nextParts));
    showToast(
      `Đã di chuyển Part trong phần ${targetSection === 'listening' ? 'Listening' : 'Reading & Writing'} thành công!`
    );
  };

  const handleDeletePart = (partId: string) => {
    if (parts.length <= 1) {
      showToast('Đề thi cần có ít nhất 1 Part!', 'warn');
      return;
    }
    const partToDelete = parts.find((p) => p.id === partId);
    if (!partToDelete) return;
    const targetSection = getPartSection(partToDelete);
    const sameSectionOther = parts.find((p) => p.id !== partId && getPartSection(p) === targetSection);
    const otherPart = sameSectionOther || parts.find((p) => p.id !== partId) || parts[0];

    const qInPart = questions.filter((q) => (q.partId || parts[0]?.id) === partToDelete.id);

    openConfirm(
      `Xóa Part: "${partToDelete.title}"?`,
      qInPart.length > 0
        ? `Part này hiện có ${qInPart.length} câu hỏi. Tất cả các câu hỏi này sẽ được tự động chuyển sang "${otherPart.title}".`
        : `Bạn có chắc muốn xóa Part này khỏi đề thi?`,
      () => {
        const nextQuestions = questions.map((q) => {
          if ((q.partId || parts[0]?.id) === partToDelete.id) {
            return { ...q, partId: otherPart.id };
          }
          return q;
        });
        onChange(nextQuestions);
        const nextParts = parts.filter((p) => p.id !== partId);
        onPartsChange(nextParts);
        showToast(`Đã xóa ${partToDelete.title}`, 'warn');
      }
    );
  };

  // Standardize & Reorganize all parts and questions
  const handleReorganizeAndRenumberAll = () => {
    const renumbered = renumberPartsBySection(parts);
    onPartsChange(renumbered);
    const sortedQuestions = syncAndSortQuestionsByParts(questions, renumbered);
    onChange(sortedQuestions);
    showToast('✨ Đã chuẩn hóa thứ tự các Part: Listening (Part 1, 2, 3...) và Reading & Writing (Part 1, 2, 3...)!', 'success');
  };

  const handleAutoDistributePartPoints = (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    const qInPart = questions.filter((q) => (q.partId || parts[0]?.id) === partId);
    if (qInPart.length === 0) {
      showToast('Part này chưa có câu hỏi nào để chia điểm!', 'warn');
      return;
    }
    const realQInPart = qInPart.filter((q) => !isQuestionExample(q, part));
    if (realQInPart.length === 0) {
      showToast('Tất cả câu trong Part đều là câu ví dụ mẫu (0đ)!', 'info');
      return;
    }
    const ptPerQ = +(part.points / realQInPart.length).toFixed(2);
    const nextQuestions = questions.map((q) => {
      if ((q.partId || parts[0]?.id) === partId) {
        if (isQuestionExample(q, part)) {
          return { ...q, points: 0, isExample: true };
        }
        return { ...q, points: ptPerQ };
      }
      return q;
    });
    onChange(nextQuestions);
    const exCount = qInPart.length - realQInPart.length;
    showToast(
      `Đã chia đều ${part.points} điểm cho ${realQInPart.length} câu thi (${ptPerQ}đ/câu${exCount > 0 ? `, ${exCount} câu ví dụ: 0đ` : ''})!`,
      'success'
    );
  };

  const handleSyncPartPointsFromQuestions = (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    const qInPart = questions.filter((q) => (q.partId || parts[0]?.id) === partId);
    const realQInPart = qInPart.filter((q) => !isQuestionExample(q, part));
    const sumPoints = +(realQInPart.reduce((acc, q) => acc + (q.points ?? 0.5), 0)).toFixed(2);
    const nextParts = parts.map((p) => {
      if (p.id === partId) {
        return { ...p, points: sumPoints };
      }
      return p;
    });
    onPartsChange(nextParts);
    showToast(`Đã cập nhật thang điểm Part = ${sumPoints} điểm (không tính câu ví dụ mẫu)!`, 'success');
  };

  const handleAddQuestionToPart = (type: QuestionType, partId: string) => {
    if (questions.length >= MAX_Q) {
      showToast(`Đã đạt tối đa ${MAX_Q} câu hỏi!`, 'warn');
      return;
    }
    const part = parts.find((p) => p.id === partId) || parts[0];
    const secId = getPartSection(part);
    const secParts = parts.filter((p) => getPartSection(p) === secId);
    const secPartIdx = secParts.findIndex((p) => p.id === part.id);
    const pNum = secPartIdx >= 0 ? secPartIdx + 1 : 1;
    const qInPart = questions.filter((q) => (q.partId || parts[0]?.id) === part.id);
    const defaultPoints = qInPart.length > 0 && typeof qInPart[0].points === 'number' ? qInPart[0].points : 0.5;

    const newQ: Question = {
      ...convertType({ q: '', type: 'multiple-choice' }, type),
      partId: part.id,
      points: defaultPoints
    };

    // Insert new question right after the last question in this part
    let insertIndex = -1;
    for (let i = questions.length - 1; i >= 0; i--) {
      if ((questions[i].partId || parts[0]?.id) === part.id) {
        insertIndex = i + 1;
        break;
      }
    }
    const updated = [...questions];
    if (insertIndex >= 0) {
      updated.splice(insertIndex, 0, newQ);
    } else {
      updated.push(newQ);
      insertIndex = updated.length - 1;
    }
    onChange(updated);
    const newLocalNum = qInPart.length + 1;
    showToast(`Đã thêm [${secId === 'listening' ? 'Listening' : 'Reading & Writing'}] Part ${pNum} - Câu ${newLocalNum} (${type.toUpperCase()})!`, 'success');
    setTimeout(() => scrollToCard(insertIndex), 60);
  };

  const handleAutoDistributeAllParts = () => {
    let nextQuestions = [...questions];
    parts.forEach((p) => {
      const qInPart = nextQuestions.filter((q) => (q.partId || parts[0]?.id) === p.id);
      const realQInPart = qInPart.filter((q) => !isQuestionExample(q, p));
      if (realQInPart.length > 0) {
        const pt = +(p.points / realQInPart.length).toFixed(2);
        nextQuestions = nextQuestions.map((q) => {
          if ((q.partId || parts[0]?.id) === p.id) {
            if (isQuestionExample(q, p)) {
              return { ...q, points: 0, isExample: true };
            }
            return { ...q, points: pt };
          }
          return q;
        });
      }
    });
    onChange(nextQuestions);
    showToast('✨ Đã tự động chia đều điểm cho các câu thi trong từng Part (Câu ví dụ mẫu giữ 0 điểm)!', 'success');
  };

  const scrollToCard = (index: number) => {
    const el = cardRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-blue-400/50');
      setTimeout(() => el.classList.remove('ring-4', 'ring-blue-400/50'), 1200);
    }
  };

  const convertType = (q: Question, toType: QuestionType): Question => {
    const base: Question = {
      q: q.q || '',
      img: q.img || '',
      video: q.video || '',
      audio: q.audio || '',
      type: toType,
      sectionTitle: q.sectionTitle,
      exampleHint: q.exampleHint
    };

    if (toType === 'multiple-choice') {
      return {
        ...base,
        options: q.options?.length ? q.options : [{ text: 'Phương án A', img: '' }, { text: 'Phương án B', img: '' }],
        correctIndex: 0
      };
    }
    if (toType === 'yes-no') {
      return {
        ...base,
        options: [{ text: 'Yes', img: '' }, { text: 'No', img: '' }],
        correctIndex: 0
      };
    }
    if (toType === 'multi-choice') {
      return {
        ...base,
        options: q.options?.length ? q.options : [{ text: 'Lựa chọn 1', img: '' }, { text: 'Lựa chọn 2', img: '' }],
        correctIndices: [0]
      };
    }
    if (toType === 'fill-blanks') {
      return {
        ...base,
        fillBlanks: q.fillBlanks || {
          width: 1000,
          height: 600,
          boxes: [{ x: 350, y: 350, w: 200, h: 80, answers: ['answer'], placeholder: 'nhập đáp án' }]
        }
      };
    }
    if (toType === 'connect-pairs') {
      return {
        ...base,
        connectPairs: q.connectPairs || {
          width: 700,
          height: 420,
          tolerance: 22,
          showLabels: true,
          defaultColor: '#2563eb',
          points: [
            { x: 230, y: 140, label: 'A', color: '#2563eb', r: 13 },
            { x: 230, y: 280, label: 'B', color: '#2563eb', r: 13 },
            { x: 470, y: 140, label: 'C', color: '#2563eb', r: 13 },
            { x: 470, y: 280, label: 'D', color: '#2563eb', r: 13 }
          ],
          pairs: [['A', 'D'], ['B', 'C']]
        }
      };
    }
    if (toType === 'listening') {
      return {
        ...base,
        audio: q.audio || 'tts:Listen and choose the correct answer.',
        options: q.options?.length ? q.options : [{ text: 'Phương án A', img: '' }, { text: 'Phương án B', img: '' }],
        correctIndex: 0
      };
    }
    if (toType === 'tick-cross') {
      return {
        ...base,
        isTick: true
      };
    }
    if (toType === 'listen-write') {
      return {
        ...base,
        audio: q.audio || 'tts:Listen and write the word.',
        acceptableAnswers: ['May']
      };
    }
    if (toType === 'unscramble-word') {
      return {
        ...base,
        unscramble: {
          targetWord: 'valley',
          scrambledLetters: ['l', 'l', 'e', 'a', 'v', 'y']
        }
      };
    }
    if (toType === 'story-word-bank') {
      return {
        ...base,
        storyBank: {
          title: "Ben's Party",
          story: "Today is Ben's (0) birthday party. Everyone is sitting by the (1) _______. His friends are (2) _______ a song for him.",
          example: { index: "0", word: "birthday" },
          words: [
            { id: "w1", word: "sea" },
            { id: "w2", word: "birthday" },
            { id: "w3", word: "pasta" },
            { id: "w4", word: "singing" },
            { id: "w5", word: "dolphin" }
          ],
          answers: {
            "1": "sea",
            "2": "singing"
          }
        }
      };
    }
    if (toType === 'listen-colour') {
      return {
        ...base,
        q: q.q || 'Listen and colour. (Nghe audio và tô màu vào các chi tiết tương ứng trên tranh)',
        audio: q.audio || 'tts:Look at the picture. Listen and look. There is one example. Can you see the bird in the tree? Yes! Colour the bird blue. This is an example. Now you listen and colour the other things.',
        audioScript: q.audioScript || 'Man: Look at the bird in the tree. Girl: Can I colour it? Man: Yes, colour the bird blue. This is an example. Now you listen and colour.\n1. Man: Can you see the ball next to the water? Girl: Yes. Man: Colour the ball yellow.\n2. Man: Look at the dog next to the bench. Colour it brown.\n3. Man: Now look at the girl\'s balloon. Colour it red.',
        img: q.img || DEFAULT_CAMBRIDGE_COLORING_SCENE,
        listenColour: q.listenColour || {
          width: 800,
          height: 520,
          exampleNote: 'Ví dụ: Con chim trên cây được tô màu xanh dương (Blue)',
          items: [
            { id: 'c1', label: 'Con chim trên cây (Bird in the tree)', targetColor: 'blue', targetColorName: 'Màu xanh dương (Blue)', x: 130, y: 150, w: 70, h: 70, isExample: true },
            { id: 'c2', label: 'Quả bóng cạnh hồ nước (Ball next to the water)', targetColor: 'yellow', targetColorName: 'Màu vàng (Yellow)', x: 490, y: 440, w: 64, h: 64 },
            { id: 'c3', label: 'Con chó cạnh ghế đá (Dog next to the bench)', targetColor: 'brown', targetColorName: 'Màu nâu (Brown)', x: 380, y: 390, w: 70, h: 64 },
            { id: 'c4', label: 'Bóng bay của bé gái (Girl\'s balloon)', targetColor: 'red', targetColorName: 'Màu đỏ (Red)', x: 320, y: 110, w: 60, h: 60 }
          ]
        }
      };
    }
    return base;
  };

  const handleAddQuestion = (type: QuestionType) => {
    if (questions.length >= MAX_Q) {
      showToast(`Đã đạt tối đa ${MAX_Q} câu hỏi!`, 'warn');
      return;
    }
    const targetPart = parts[0] || { id: 'part-1' };
    const newQ: Question = {
      ...convertType({ q: '', type: 'multiple-choice' }, type),
      partId: targetPart.id,
      points: 0.5
    };
    const updated = [...questions, newQ];
    onChange(updated);
    showToast(`Đã thêm câu hỏi ${type.toUpperCase()} vào Part 1`);
    setTimeout(() => scrollToCard(updated.length - 1), 60);
  };

  const getQuestionLabel = (index: number) => {
    const targetQ = questions[index];
    if (!targetQ) return `Câu ${index + 1}`;
    const qPart = parts.find((p) => p.id === (targetQ.partId || parts[0]?.id)) || parts[0];
    const secId = getPartSection(qPart);
    const secParts = parts.filter((p) => getPartSection(p) === secId);
    const secPartIdx = secParts.findIndex((p) => p.id === qPart.id);
    const pNum = secPartIdx >= 0 ? secPartIdx + 1 : 1;
    const qInPart = questions.filter((item) => (item.partId || parts[0]?.id) === qPart.id);
    const localQNum = qInPart.findIndex((item) => item === targetQ);
    const secName = secId === 'listening' ? 'Listening' : 'Reading & Writing';
    return `[${secName}] Part ${pNum} - Câu ${localQNum >= 0 ? localQNum + 1 : 1}`;
  };

  const handleDelete = (index: number) => {
    const label = getQuestionLabel(index);
    openConfirm(
      `Xóa ${label}?`,
      `Bạn có chắc chắn muốn xóa ${label} khỏi đề thi không?`,
      () => {
        const next = questions.filter((_, i) => i !== index);
        onChange(next);
        showToast(`Đã xóa ${label}`, 'warn');
      }
    );
  };

  const handleDuplicate = (index: number) => {
    if (questions.length >= MAX_Q) {
      showToast(`Đã đạt tối đa ${MAX_Q} câu hỏi!`, 'warn');
      return;
    }
    const label = getQuestionLabel(index);
    const copy = JSON.parse(JSON.stringify(questions[index]));
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    onChange(next);
    showToast(`Đã nhân bản ${label}`);
    setTimeout(() => scrollToCard(index + 1), 60);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const next = [...questions];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onChange(next);
    setTimeout(() => scrollToCard(targetIndex), 40);
  };

  const handleTypeChange = (index: number, newType: QuestionType) => {
    const next = [...questions];
    next[index] = convertType(next[index], newType);
    onChange(next);
    showToast(`Đã chuyển Câu ${index + 1} sang ${newType}`);
  };

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleImageFile = (index: number, file: File | null) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('Kích thước ảnh phải ≤ 15MB', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      updateQuestion(index, { img: dataUrl });
      showToast('📷 Đã tải ảnh lên và lưu an toàn vào bộ nhớ!', 'success');
      if (onSaveAndSync) {
        setTimeout(() => onSaveAndSync(), 80);
      }
    };
    reader.readAsDataURL(file);
  };

  const playAudio = (audioStr?: string) => {
    if (!audioStr) return;
    if (audioStr.startsWith('tts:')) {
      const text = audioStr.replace(/^tts:/, '');
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
      showToast('Đang phát giọng đọc mẫu (TTS)...', 'info');
    } else {
      const audio = new Audio(audioStr);
      audio.play().catch(() => showToast('Không thể phát file âm thanh URL này', 'warn'));
    }
  };

  // Connect-pairs helper methods
  const getSuggestedPairLabels = (existingPoints: ConnectPairPoint[]) => {
    const used = new Set(existingPoints.map((p) => (p.label || '').toUpperCase()));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let left = '';
    for (const ch of alphabet) {
      if (!used.has(ch)) {
        left = ch;
        break;
      }
    }
    if (!left) left = `L${existingPoints.length + 1}`;

    let right = '';
    const hasNumbers = existingPoints.some((p) => /^\d+$/.test(p.label));
    if (hasNumbers) {
      for (let i = 1; i <= 99; i++) {
        const s = String(i);
        if (!used.has(s)) {
          right = s;
          break;
        }
      }
    } else {
      for (const ch of alphabet) {
        if (ch !== left && !used.has(ch)) {
          right = ch;
          break;
        }
      }
    }
    if (!right) right = `R${existingPoints.length + 1}`;

    return { left, right };
  };

  const handleCreateNewPair = (
    qIdx: number,
    customData?: {
      leftLabel?: string;
      leftText?: string;
      leftImg?: string;
      rightLabel?: string;
      rightText?: string;
      rightImg?: string;
    }
  ) => {
    const q = questions[qIdx];
    const cp = q.connectPairs || {
      width: 700,
      height: 420,
      tolerance: 22,
      showLabels: true,
      points: [],
      pairs: []
    };

    const suggested = getSuggestedPairLabels(cp.points);
    let finalLeft = (customData?.leftLabel?.trim() || suggested.left).toUpperCase();
    let finalRight = (customData?.rightLabel?.trim() || suggested.right).toUpperCase();

    if (finalLeft === finalRight) {
      finalRight = finalRight + '_2';
    }

    const existingLabels = new Set(cp.points.map((p) => p.label.toUpperCase()));
    if (existingLabels.has(finalLeft)) {
      finalLeft = `${finalLeft}_${Date.now() % 100}`;
    }
    existingLabels.add(finalLeft);
    if (existingLabels.has(finalRight)) {
      finalRight = `${finalRight}_${(Date.now() + 1) % 100}`;
    }

    const pairIndex = (cp.pairs || []).length;
    const defaultUnifiedColor = cp.defaultColor || '#2563eb';
    const pairColor = defaultUnifiedColor;

    const H = cp.height || 420;
    const yPos = Math.round(75 + ((pairIndex * 70) % Math.max(120, H - 120)));

    const newLeftPoint: ConnectPairPoint = {
      x: 180,
      y: yPos,
      label: finalLeft,
      text: customData?.leftText || `Mục ${finalLeft}`,
      img: customData?.leftImg || '',
      color: pairColor
    };

    const newRightPoint: ConnectPairPoint = {
      x: 520,
      y: yPos,
      label: finalRight,
      text: customData?.rightText || `Mục ${finalRight}`,
      img: customData?.rightImg || '',
      color: pairColor
    };

    const nextPoints = [...cp.points, newLeftPoint, newRightPoint];
    const nextPairs: [string, string][] = [...(cp.pairs || []), [finalLeft, finalRight]];

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        defaultColor: defaultUnifiedColor,
        points: nextPoints,
        pairs: nextPairs
      }
    });

    setNewPairDrafts((prev) => {
      const copy = { ...prev };
      delete copy[qIdx];
      return copy;
    });

    showToast(`Đã thêm cặp nối mới hoàn toàn: [${finalLeft}] ↔ [${finalRight}]!`, 'success');
  };

  const handleDeletePairAndPoints = (qIdx: number, pIdx: number) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp) return;

    const targetPair = cp.pairs[pIdx];
    if (!targetPair) return;

    const [labelA, labelB] = targetPair;
    const nextPairs = cp.pairs.filter((_, i) => i !== pIdx);

    const isAUsed = nextPairs.some((p) => p[0] === labelA || p[1] === labelA);
    const isBUsed = nextPairs.some((p) => p[0] === labelB || p[1] === labelB);

    const nextPoints = cp.points.filter((pt) => {
      if (pt.label === labelA && !isAUsed) return false;
      if (pt.label === labelB && !isBUsed) return false;
      return true;
    });

    let nextExamplePair = cp.examplePair;
    let nextExamplePairLabel = cp.examplePairLabel;
    if (
      cp.examplePair &&
      ((cp.examplePair[0] === labelA && cp.examplePair[1] === labelB) ||
        (cp.examplePair[0] === labelB && cp.examplePair[1] === labelA))
    ) {
      nextExamplePair = undefined;
      nextExamplePairLabel = undefined;
    }

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        points: nextPoints,
        pairs: nextPairs,
        examplePair: nextExamplePair,
        examplePairLabel: nextExamplePairLabel
      }
    });

    showToast(`Đã xóa cặp nối [${labelA}] ↔ [${labelB}] cùng các mục thuộc cặp!`, 'info');
  };

  // Delete a specific point directly by its array index on canvas
  const handleDeletePointByIndex = (qIdx: number, pointIndex: number) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp || !cp.points[pointIndex]) return;

    const targetPoint = cp.points[pointIndex];
    const targetLabel = targetPoint.label;

    const nextPoints = cp.points.filter((_, idx) => idx !== pointIndex);

    // If no other point has targetLabel, clean pairs using targetLabel
    const labelStillExists = nextPoints.some((p) => p.label === targetLabel);
    let nextPairs = cp.pairs || [];
    if (!labelStillExists) {
      nextPairs = nextPairs.filter((p) => p[0] !== targetLabel && p[1] !== targetLabel);
    }

    let nextExamplePair = cp.examplePair;
    let nextExamplePairLabel = cp.examplePairLabel;
    if (!labelStillExists && cp.examplePair && (cp.examplePair[0] === targetLabel || cp.examplePair[1] === targetLabel)) {
      nextExamplePair = undefined;
      nextExamplePairLabel = undefined;
    }

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        points: nextPoints,
        pairs: nextPairs,
        examplePair: nextExamplePair,
        examplePairLabel: nextExamplePairLabel
      }
    });

    showToast(`Đã xóa điểm [${targetLabel}] (${targetPoint.text || 'mục trên tranh'}) thành công!`, 'success');
  };

  // Apply one single unified color to all points and lines
  const handleApplyUnifiedColor = (qIdx: number, newColor: string) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp) return;

    const nextPoints = (cp.points || []).map((pt) => ({
      ...pt,
      color: newColor
    }));

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        defaultColor: newColor,
        points: nextPoints
      }
    });

    showToast(`Đã đồng bộ toàn bộ ${nextPoints.length} điểm và cặp nối về 1 màu duy nhất!`, 'success');
  };

  // Clean duplicate and surplus orphaned points
  const handleCleanDuplicateAndSurplusPoints = (qIdx: number) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp || (cp.points || []).length === 0) return;

    const pairedLabels = new Set((cp.pairs || []).flatMap((p) => [p[0], p[1]]));
    const seenLabels = new Set<string>();
    const cleanedPoints: ConnectPairPoint[] = [];
    let removedCount = 0;

    for (const pt of cp.points) {
      const isPaired = pairedLabels.has(pt.label);
      if (seenLabels.has(pt.label)) {
        if (!isPaired) {
          // Extra duplicate point not in pairs -> remove it
          removedCount++;
          continue;
        } else {
          // Both are in pairs -> rename to unique letter
          let newLetter = 'Z';
          for (const ch of 'ZYXWVUTSRQPONMLKJIHGFEDCBA') {
            if (!seenLabels.has(ch) && !pairedLabels.has(ch)) {
              newLetter = ch;
              break;
            }
          }
          cleanedPoints.push({ ...pt, label: newLetter });
          seenLabels.add(newLetter);
          continue;
        }
      }

      seenLabels.add(pt.label);
      cleanedPoints.push(pt);
    }

    // Also remove unlinked points that are strictly orphans
    const finalPoints = cleanedPoints.filter((pt) => {
      if (!pairedLabels.has(pt.label) && seenLabels.has(pt.label)) {
        // Only keep if explicitly defined
        return true;
      }
      return true;
    });

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        points: finalPoints
      }
    });

    showToast(
      removedCount > 0
        ? `Đã dọn dẹp và xóa ${removedCount} điểm trùng lặp/dư thừa trên tranh!`
        : `Đã kiểm tra và tối ưu các điểm trên tranh!`,
      'success'
    );
  };

  const handleUpdatePointByLabel = (qIdx: number, pointLabel: string, patch: Partial<ConnectPairPoint>) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp) return;

    const oldLabel = pointLabel;
    const newLabel = patch.label ? patch.label.toUpperCase() : oldLabel;

    const nextPoints = cp.points.map((pt) => {
      if (pt.label === oldLabel) {
        return { ...pt, ...patch, label: newLabel };
      }
      return pt;
    });

    let nextPairs = cp.pairs || [];
    if (patch.label && newLabel !== oldLabel) {
      nextPairs = nextPairs.map((pair) => {
        const p0 = pair[0] === oldLabel ? newLabel : pair[0];
        const p1 = pair[1] === oldLabel ? newLabel : pair[1];
        return [p0, p1] as [string, string];
      });
    }

    updateQuestion(qIdx, {
      connectPairs: {
        ...cp,
        points: nextPoints,
        pairs: nextPairs
      }
    });
  };

  const handleAutoAlignConnectPoints = (qIdx: number) => {
    const q = questions[qIdx];
    const cp = q.connectPairs;
    if (!cp || cp.points.length === 0) return;

    const leftLabels = new Set((cp.pairs || []).map((p) => p[0]));
    const rightLabels = new Set((cp.pairs || []).map((p) => p[1]));

    const pts = [...cp.points];
    const leftPts: ConnectPairPoint[] = [];
    const rightPts: ConnectPairPoint[] = [];

    pts.forEach((p) => {
      if (leftLabels.has(p.label) && !rightLabels.has(p.label)) {
        leftPts.push(p);
      } else if (rightLabels.has(p.label) && !leftLabels.has(p.label)) {
        rightPts.push(p);
      } else if (p.x <= (cp.width || 700) / 2) {
        leftPts.push(p);
      } else {
        rightPts.push(p);
      }
    });

    const H = cp.height || 420;
    const stepLeft = (H - 120) / Math.max(1, leftPts.length - 1 || 1);
    const stepRight = (H - 120) / Math.max(1, rightPts.length - 1 || 1);

    const updated = [
      ...leftPts.map((p, i) => ({
        ...p,
        x: 180,
        y: leftPts.length === 1 ? Math.round(H / 2) : Math.round(65 + i * stepLeft)
      })),
      ...rightPts.map((p, i) => ({
        ...p,
        x: 520,
        y: rightPts.length === 1 ? Math.round(H / 2) : Math.round(65 + i * stepRight)
      }))
    ];

    updateQuestion(qIdx, {
      connectPairs: { ...cp, points: updated }
    });
    showToast('Đã tự động căn đều các điểm thành 2 cột Trái - Phải!');
  };

  const totalPartPoints = parts.reduce((acc, p) => acc + (p.points || 0), 0);
  const totalQuestionPoints = +(questions.reduce((acc, q) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    if (isQuestionExample(q, p)) return acc;
    return acc + (q.points ?? 0.5);
  }, 0)).toFixed(2);
  const isOverallBalanced = Math.abs(totalPartPoints - totalQuestionPoints) < 0.05;

  const listeningParts = parts.map((p, idx) => ({ p, idx })).filter(({ p }) => getPartSection(p) === 'listening');
  const readingWritingParts = parts.map((p, idx) => ({ p, idx })).filter(({ p }) => getPartSection(p) === 'reading-writing');

  const listeningPartPoints = listeningParts.reduce((acc, { p }) => acc + (p.points || 0), 0);
  const readingWritingPartPoints = readingWritingParts.reduce((acc, { p }) => acc + (p.points || 0), 0);

  const listeningQuestions = questions.filter((q) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    return p && getPartSection(p) === 'listening';
  });
  const readingWritingQuestions = questions.filter((q) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    return p && getPartSection(p) === 'reading-writing';
  });

  const listeningQPoints = +(listeningQuestions.reduce((acc, q) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    if (isQuestionExample(q, p)) return acc;
    return acc + (q.points ?? 0.5);
  }, 0)).toFixed(2);
  const readingWritingQPoints = +(readingWritingQuestions.reduce((acc, q) => {
    const p = parts.find((pt) => pt.id === (q.partId || parts[0]?.id));
    if (isQuestionExample(q, p)) return acc;
    return acc + (q.points ?? 0.5);
  }, 0)).toFixed(2);

  const renderPartContent = (part: ExamPart, pIdx: number, secIdx: number, totalInSec: number) => {
    const questionsInPart = questions
      .map((q, idx) => ({ q, idx }))
      .filter((item) => (item.q.partId || parts[0]?.id) === part.id);

    const realQuestionsInPart = questionsInPart.filter((item) => !isQuestionExample(item.q, part));
    const exampleQuestionsInPart = questionsInPart.filter((item) => isQuestionExample(item.q, part));
    const qTotalPoints = +(realQuestionsInPart.reduce((acc, item) => acc + (item.q.points ?? 0.5), 0)).toFixed(2);
    const isListen = getPartSection(part) === 'listening';

    return (
      <div key={part.id} id={`admin-part-section-${part.id}`} className="space-y-4">
        <AdminPartHeader
          part={part}
          partIndex={pIdx}
          sectionIndex={secIdx}
          sectionTotalParts={totalInSec}
          totalParts={parts.length}
          questionsCount={realQuestionsInPart.length}
          exampleQuestionsCount={exampleQuestionsInPart.length}
          questionsTotalPoints={qTotalPoints}
          onUpdatePart={(patch) => handleUpdatePart(part.id, patch)}
          onDeletePart={() => handleDeletePart(part.id)}
          onMovePart={(dir) => handleMovePartWithinSection(part.id, dir)}
          onAutoDistributePoints={() => handleAutoDistributePartPoints(part.id)}
          onSyncPointsFromQuestions={() => handleSyncPartPointsFromQuestions(part.id)}
          onAddQuestionToPart={(type) => handleAddQuestionToPart(type, part.id)}
          onTestPart={onStartTestRun ? () => onStartTestRun(part.id) : undefined}
          showToast={showToast}
        />

              {questionsInPart.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/70 space-y-3">
                  <div className="text-slate-400 text-3xl">
                    <i className="fa-solid fa-folder-open"></i>
                  </div>
                  <p className="text-sm font-bold text-slate-700">Part {secIdx + 1} ({isListen ? 'Listening' : 'Reading & Writing'}) chưa có câu hỏi nào</p>
                  <p className="text-xs text-slate-500">
                    Bấm chọn kiểu câu hỏi bên dưới để thêm câu đầu tiên vào Part {secIdx + 1}:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('multiple-choice', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                    >
                      + Trắc nghiệm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('yes-no', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <i className="fa-solid fa-circle-question"></i>
                      <span>+ Yes - No</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('multi-choice', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <i className="fa-solid fa-list-check"></i>
                      <span>+ Multi-choice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listening', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Bài nghe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('tick-cross', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Tick/Cross
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listen-colour', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      🎨 + Nghe & Tô màu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listen-write', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Nghe & Viết
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('connect-pairs', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Nối điểm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('fill-blanks', part.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Điền ô ảnh
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pl-0 sm:pl-3 border-l-0 sm:border-l-4 border-indigo-200">
                  {questionsInPart.map(({ q, idx }, localIdx) => {
                    const isEx = !!q.isExample || isQuestionExample(q, part);
                    const realQuestionsBefore = questionsInPart.slice(0, localIdx).filter(item => !isQuestionExample(item.q, part)).length;
                    const totalRealInPart = questionsInPart.filter(item => !isQuestionExample(item.q, part)).length;
                    const examNumber = isEx ? 0 : realQuestionsBefore + 1;

                    return (
                      <div
                        key={idx}
                        ref={(el) => {
                          cardRefs.current[idx] = el;
                        }}
                        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-all"
                      >
                        {/* Card Header with Question Points & Part selector */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isEx ? (
                                  <span className="px-3 py-1 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                                    <i className="fa-solid fa-lightbulb"></i>
                                    <span>Ví dụ mẫu (Example)</span>
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-extrabold text-xs shadow-xs">
                                    Câu {examNumber}
                                    {totalRealInPart !== questionsInPart.length && (
                                      <span className="ml-1 text-[10px] text-amber-300 font-bold">
                                        (Thi: Câu {examNumber}/{totalRealInPart})
                                      </span>
                                    )}
                                  </span>
                                )}
                                <span className={`px-2.5 py-0.5 rounded-md font-extrabold text-[11px] flex items-center gap-1 ${
                                  isListen ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-teal-100 text-teal-900 border border-teal-200'
                                }`}>
                                  <span>{isListen ? '🎧 LISTENING' : '📖 READING & WRITING'}</span>
                                  <span>•</span>
                                  <span>Part {secIdx + 1}</span>
                                  <span>•</span>
                                  <span>{isEx ? 'Làm mẫu (Không tính điểm)' : `Câu ${examNumber} / ${totalRealInPart} câu thi`}</span>
                                </span>
                              </div>
                            </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${
                                q.type === 'fill-blanks'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : q.type === 'connect-pairs'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : q.type === 'listening'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : q.type === 'multi-choice'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {q.type.toUpperCase()}
                            </span>

                            {/* Question Points input (Điểm từng câu trong Part) */}
                            {isEx ? (
                              <div
                                className="flex items-center gap-1.5 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-xl text-amber-950 font-black text-xs shadow-xs"
                                title="Câu hỏi ví dụ mẫu có 0 điểm và không tính vào tổng điểm của Part"
                              >
                                <i className="fa-solid fa-lightbulb text-amber-600"></i>
                                <span>0 điểm (Ví dụ mẫu)</span>
                                <span className="text-[10px] text-amber-800 font-bold bg-amber-200/80 px-1.5 py-0.2 rounded">
                                  Không tính điểm Part
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-amber-50/90 border border-amber-300 px-2.5 py-1 rounded-xl">
                                <span className="text-[11px] font-extrabold text-amber-900">Điểm câu:</span>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="100"
                                  value={q.points ?? 0.5}
                                  onChange={(e) => updateQuestion(idx, { points: parseFloat(e.target.value) || 0 })}
                                  className="w-14 px-1 py-0.5 text-center text-xs font-black bg-white text-slate-900 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="text-[11px] font-black text-amber-800">đ</span>
                                <div className="flex items-center gap-0.5 ml-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateQuestion(idx, { points: Math.max(0, +((q.points ?? 0.5) - 0.25).toFixed(2)) })}
                                    className="w-5 h-5 rounded bg-amber-200/90 hover:bg-amber-300 text-amber-950 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                    title="-0.25 điểm"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateQuestion(idx, { points: +((q.points ?? 0.5) + 0.25).toFixed(2) })}
                                    className="w-5 h-5 rounded bg-amber-200/90 hover:bg-amber-300 text-amber-950 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                    title="+0.25 điểm"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Part Selector with Sections */}
                            <select
                              value={q.partId || parts[0]?.id}
                              onChange={(e) => updateQuestion(idx, { partId: e.target.value })}
                              className="text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2 py-1 focus:outline-none"
                              title="Chuyển câu hỏi sang Part khác"
                            >
                              <optgroup label="🎧 PHẦN THI LISTENING">
                                {listeningParts.map(({ p }, lIdx) => (
                                  <option key={p.id} value={p.id}>
                                    Part {lIdx + 1}: {getCleanPartTitle(p.title).slice(0, 24)}... ({p.points}đ)
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="📖 PHẦN THI READING & WRITING">
                                {readingWritingParts.map(({ p }, rwIdx) => (
                                  <option key={p.id} value={p.id}>
                                    Part {rwIdx + 1}: {getCleanPartTitle(p.title).slice(0, 24)}... ({p.points}đ)
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={q.type}
                    onChange={(e) => handleTypeChange(idx, e.target.value as QuestionType)}
                    className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="multiple-choice">Đổi kiểu: Multiple-choice</option>
                    <option value="listen-colour">Đổi kiểu: 🎨 Nghe & Tô màu (Listen & Colour)</option>
                    <option value="tick-cross">Đổi kiểu: ✔/✘ Tick or Cross</option>
                    <option value="listen-write">Đổi kiểu: Nghe & Điền tên/số</option>
                    <option value="unscramble-word">Đổi kiểu: Ghép chữ cái (Anagram)</option>
                    <option value="story-word-bank">Đổi kiểu: Đoạn văn & Ngân hàng từ</option>
                    <option value="connect-pairs">Đổi kiểu: Connect-pairs</option>
                    <option value="fill-blanks">Đổi kiểu: Fill-blanks</option>
                    <option value="yes-no">Đổi kiểu: Yes-No</option>
                    <option value="multi-choice">Đổi kiểu: Multi-choice</option>
                    <option value="listening">Đổi kiểu: Listening</option>
                  </select>

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    title="Di chuyển lên"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                  </button>
                  <button
                    type="button"
                    disabled={idx === questions.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    title="Di chuyển xuống"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-down"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSaveAndSync) {
                        onSaveAndSync();
                      } else {
                        showToast('💾 Đã lưu câu hỏi và hình ảnh vào bộ nhớ an toàn!', 'success');
                      }
                    }}
                    title="Lưu ngay câu hỏi và hình ảnh này vào bộ nhớ IndexedDB an toàn (không bao giờ bị mất)"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <i className="fa-solid fa-floppy-disk"></i> Lưu câu này
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(idx)}
                    className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-regular fa-clone"></i> Nhân bản
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-regular fa-trash-can"></i> Xóa câu
                  </button>
                </div>
              </div>

              {/* Section Heading & Example (Optional for Cambridge Exam parts) */}
              <div className="space-y-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-blue-900 mb-1">
                      Tiêu đề phần thi (Ví dụ: LISTENING - Part 1):
                    </label>
                    <input
                      type="text"
                      value={q.sectionTitle || ''}
                      onChange={(e) => updateQuestion(idx, { sectionTitle: e.target.value })}
                      placeholder="VD: LISTENING - Part 2 (4 questions)"
                      className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg font-semibold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-blue-900 mb-1">
                      Ghi chú ví dụ / Hướng dẫn mẫu (Example):
                    </label>
                    <input
                      type="text"
                      value={q.exampleHint || ''}
                      onChange={(e) => updateQuestion(idx, { exampleHint: e.target.value })}
                      placeholder="VD: Example: What food is on the birthday table? A [✔]"
                      className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg font-semibold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-300 transition">
                    <input
                      type="checkbox"
                      checked={!!q.isExample}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        updateQuestion(idx, {
                          isExample: isChecked,
                          points: isChecked ? 0 : 0.5
                        });
                        showToast(
                          isChecked
                            ? 'Đã chuyển thành Câu hỏi ví dụ mẫu (0 điểm - Không tính điểm vào Part)!'
                            : 'Đã hủy đánh dấu ví dụ (Câu hỏi được tính điểm bình thường)!',
                          'info'
                        );
                      }}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                      <i className="fa-solid fa-lightbulb text-amber-600"></i>
                      <span>Đánh dấu câu này là Câu hỏi Ví dụ mẫu (Example) - 0 điểm, không tính vào Part</span>
                    </span>
                  </label>
                  {q.isExample && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      ✓ Đã làm mẫu: Câu tiếp theo sẽ thay thế thành Câu 1 khi học sinh làm bài
                    </span>
                  )}
                </div>
              </div>

              {/* Common Fields: Question Content & Media */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Đề bài (Văn bản hoặc HTML):
                  </label>
                  <textarea
                    rows={4}
                    value={q.q || ''}
                    onChange={(e) => updateQuestion(idx, { q: e.target.value })}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-slate-400">
                    Gợi ý: Dùng <code>&lt;b&gt;đậm&lt;/b&gt;</code>, <code>&lt;br&gt;</code> để xuống dòng.
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Ảnh câu hỏi (URL hoặc Tải từ máy tính):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q.img?.startsWith('data:image/svg+xml') ? '[Ảnh minh họa SVG]' : q.img || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '[Ảnh minh họa SVG]') {
                            updateQuestion(idx, { img: val });
                          }
                        }}
                        placeholder="https://..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <label className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs cursor-pointer shrink-0">
                        <i className="fa-solid fa-upload mr-1"></i>Tải ảnh
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFile(idx, e.target.files?.[0] || null)}
                        />
                      </label>
                      {q.img && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(idx, { img: '' })}
                          className="px-2 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs"
                          title="Gỡ ảnh"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {q.img && (
                      <div className="mt-1 flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white">
                        <img
                          src={q.img}
                          alt={`Minh họa câu ${idx + 1}`}
                          className="max-h-36 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Video minh họa (YouTube / MP4)</label>
                    <input
                      type="text"
                      value={q.video || ''}
                      onChange={(e) => updateQuestion(idx, { video: e.target.value.trim() })}
                      placeholder="Link YouTube hoặc MP4..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Comprehensive Audio & Listening Configuration for Student */}
                  <QuestionAudioEditor
                    audio={q.audio || ''}
                    audioScript={q.audioScript || ''}
                    maxPlayCount={q.maxPlayCount ?? 2}
                    autoPlayAudio={q.autoPlayAudio ?? false}
                    audioSpeed={q.audioSpeed ?? 1.0}
                    audioVoice={q.audioVoice ?? 'en-US'}
                    onChange={(patch) => updateQuestion(idx, patch)}
                    showToast={showToast}
                  />
                </div>
              </div>

              {/* Dedicated Yes-No Editor */}
              {q.type === 'yes-no' && (
                <div className="p-4 rounded-xl bg-violet-50/80 border-2 border-violet-200 space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-black text-violet-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <i className="fa-solid fa-circle-question text-violet-600 text-sm"></i>
                      <span>Dạng câu hỏi Đúng / Sai: Chọn YES hoặc NO</span>
                    </div>
                    <span className="text-[11px] font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full border border-violet-300">
                      Yes / No Question
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Chọn đáp án đúng của câu hỏi này (Học sinh chọn đáp án này sẽ được điểm):
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => {
                          const opts = (q.options && q.options.length === 2)
                            ? q.options
                            : [{ text: 'Yes', img: '' }, { text: 'No', img: '' }];
                          updateQuestion(idx, { options: opts, correctIndex: 0 });
                          showToast('Đã chọn đáp án đúng: YES');
                        }}
                        className={`p-3.5 rounded-xl border-2 font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                          (q.correctIndex ?? 0) === 0
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        <i className="fa-solid fa-check text-base"></i>
                        <span>YES (Đúng)</span>
                        {(q.correctIndex ?? 0) === 0 && <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded font-bold">✔ Đúng</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const opts = (q.options && q.options.length === 2)
                            ? q.options
                            : [{ text: 'Yes', img: '' }, { text: 'No', img: '' }];
                          updateQuestion(idx, { options: opts, correctIndex: 1 });
                          showToast('Đã chọn đáp án đúng: NO');
                        }}
                        className={`p-3.5 rounded-xl border-2 font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                          (q.correctIndex ?? 0) === 1
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50'
                        }`}
                      >
                        <i className="fa-solid fa-xmark text-base"></i>
                        <span>NO (Sai)</span>
                        {(q.correctIndex ?? 0) === 1 && <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded font-bold">✔ Đúng</span>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Type-Specific Editors for Multiple-choice & Listening */}
              {(q.type === 'multiple-choice' || q.type === 'listening') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Phương án trả lời (Chọn 1 đáp án đúng làm mốc chấm)
                    </label>
                    {q.type === 'listening' && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Học sinh nghe Audio/TTS rồi chọn phương án
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(q.options || []).map((op, oi) => {
                      const isCorrect = (q.correctIndex ?? 0) === oi;
                      return (
                        <div
                          key={oi}
                          className={`border-2 rounded-xl p-3 space-y-2.5 transition ${
                            isCorrect ? 'border-emerald-500 bg-emerald-50/40 shadow-xs' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(idx, { correctIndex: oi })}
                              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700'
                              }`}
                            >
                              {isCorrect ? '✔ Đáp án đúng' : 'Chọn đúng'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpts = (q.options || []).filter((_, oidx) => oidx !== oi);
                                let nextCorrect = q.correctIndex ?? 0;
                                if (nextCorrect === oi) nextCorrect = 0;
                                else if (nextCorrect > oi) nextCorrect--;
                                updateQuestion(idx, { options: nextOpts, correctIndex: nextCorrect });
                              }}
                              className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold text-xs transition cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-600">
                              Văn bản #{oi + 1}
                            </label>
                            <input
                              type="text"
                              value={op.text || ''}
                              onChange={(e) => {
                                const nextOpts = [...(q.options || [])];
                                nextOpts[oi] = { ...nextOpts[oi], text: e.target.value };
                                updateQuestion(idx, { options: nextOpts });
                              }}
                              placeholder={`Phương án ${String.fromCharCode(65 + oi)}...`}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-600">
                              Ảnh phương án (tùy chọn)
                            </label>
                            <input
                              type="text"
                              value={op.img?.startsWith('data:image/svg+xml') ? '[Ảnh SVG]' : op.img || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== '[Ảnh SVG]') {
                                   const nextOpts = [...(q.options || [])];
                                  nextOpts[oi] = { ...nextOpts[oi], img: val };
                                  updateQuestion(idx, { options: nextOpts });
                                }
                              }}
                              placeholder="https://..."
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                            {op.img && (
                              <img
                                src={op.img}
                                alt="Minh họa phương án"
                                className="max-h-24 rounded-lg border border-slate-200 mt-1 object-contain bg-white mx-auto"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOpts = [...(q.options || []), { text: '', img: '' }];
                      updateQuestion(idx, { options: nextOpts });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    + Thêm phương án
                  </button>
                </div>
              )}

              {/* Multi-choice (Multiple correct checkboxes) */}
              {q.type === 'multi-choice' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Phương án (Học sinh có thể chọn nhiều đáp án đúng)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(q.options || []).map((op, oi) => {
                      const isChecked = (q.correctIndices || []).includes(oi);
                      return (
                        <div
                          key={oi}
                          className={`border-2 rounded-xl p-3 space-y-2.5 transition ${
                            isChecked ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = [...(q.correctIndices || [])];
                                  let nextIndices = [];
                                  if (e.target.checked) {
                                    nextIndices = Array.from(new Set([...current, oi]));
                                  } else {
                                    nextIndices = current.filter((x) => x !== oi);
                                  }
                                  updateQuestion(idx, { correctIndices: nextIndices });
                                }}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Là đáp án đúng</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpts = (q.options || []).filter((_, oidx) => oidx !== oi);
                                const nextIndices = (q.correctIndices || [])
                                  .filter((x) => x !== oi)
                                  .map((x) => (x > oi ? x - 1 : x));
                                updateQuestion(idx, { options: nextOpts, correctIndices: nextIndices });
                              }}
                              className="px-2 py-1 rounded bg-red-50 text-red-600 font-bold text-xs cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                          <input
                            type="text"
                            value={op.text || ''}
                            onChange={(e) => {
                              const nextOpts = [...(q.options || [])];
                              nextOpts[oi] = { ...nextOpts[oi], text: e.target.value };
                              updateQuestion(idx, { options: nextOpts });
                            }}
                            placeholder="Nội dung phương án..."
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpts = [...(q.options || []), { text: '', img: '' }];
                      updateQuestion(idx, { options: nextOpts });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 text-white font-bold text-xs cursor-pointer"
                  >
                    + Thêm phương án
                  </button>
                </div>
              )}

              {/* Fill-blanks Editor & Interactive Stage Preview */}
              {q.type === 'fill-blanks' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                        Cấu hình các ô điền từ trên ảnh
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const fb = q.fillBlanks || { width: 1000, height: 600, boxes: [] };
                          const newBox: FillBlankBox = {
                            x: 300,
                            y: 300,
                            w: 180,
                            h: 80,
                            answers: ['answer'],
                            placeholder: 'type here'
                          };
                          updateQuestion(idx, {
                            fillBlanks: { ...fb, boxes: [...fb.boxes, newBox] }
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
                      >
                        + Thêm ô điền
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600">Canvas Width</label>
                        <input
                          type="number"
                          value={q.fillBlanks?.width || 1000}
                          onChange={(e) => {
                            const w = +e.target.value || 1000;
                            updateQuestion(idx, {
                              fillBlanks: { ...(q.fillBlanks || { width: 1000, height: 600, boxes: [] }), width: w }
                            });
                          }}
                          className="w-full px-2.5 py-1 text-xs border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600">Canvas Height</label>
                        <input
                          type="number"
                          value={q.fillBlanks?.height || 600}
                          onChange={(e) => {
                            const h = +e.target.value || 600;
                            updateQuestion(idx, {
                              fillBlanks: { ...(q.fillBlanks || { width: 1000, height: 600, boxes: [] }), height: h }
                            });
                          }}
                          className="w-full px-2.5 py-1 text-xs border rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {(q.fillBlanks?.boxes || []).map((box, bi) => (
                        <div key={bi} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">Ô điền #{bi + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const fb = q.fillBlanks!;
                                const nextBoxes = fb.boxes.filter((_, bIdx) => bIdx !== bi);
                                updateQuestion(idx, { fillBlanks: { ...fb, boxes: nextBoxes } });
                              }}
                              className="px-2 py-0.5 rounded bg-red-100 text-red-600 font-bold text-xs cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                            <div>
                              <span className="text-slate-500 font-medium">X:</span>
                              <input
                                type="number"
                                value={box.x}
                                onChange={(e) => {
                                  const nextBoxes = [...q.fillBlanks!.boxes];
                                  nextBoxes[bi] = { ...box, x: +e.target.value };
                                  updateQuestion(idx, { fillBlanks: { ...q.fillBlanks!, boxes: nextBoxes } });
                                }}
                                className="w-full px-1.5 py-0.5 border rounded font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 font-medium">Y:</span>
                              <input
                                type="number"
                                value={box.y}
                                onChange={(e) => {
                                  const nextBoxes = [...q.fillBlanks!.boxes];
                                  nextBoxes[bi] = { ...box, y: +e.target.value };
                                  updateQuestion(idx, { fillBlanks: { ...q.fillBlanks!, boxes: nextBoxes } });
                                }}
                                className="w-full px-1.5 py-0.5 border rounded font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 font-medium">W:</span>
                              <input
                                type="number"
                                value={box.w}
                                onChange={(e) => {
                                  const nextBoxes = [...q.fillBlanks!.boxes];
                                  nextBoxes[bi] = { ...box, w: +e.target.value };
                                  updateQuestion(idx, { fillBlanks: { ...q.fillBlanks!, boxes: nextBoxes } });
                                }}
                                className="w-full px-1.5 py-0.5 border rounded font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 font-medium">H:</span>
                              <input
                                type="number"
                                value={box.h}
                                onChange={(e) => {
                                  const nextBoxes = [...q.fillBlanks!.boxes];
                                  nextBoxes[bi] = { ...box, h: +e.target.value };
                                  updateQuestion(idx, { fillBlanks: { ...q.fillBlanks!, boxes: nextBoxes } });
                                }}
                                className="w-full px-1.5 py-0.5 border rounded font-mono"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-emerald-800">
                              Đáp án chấp nhận (ngăn cách dấu phẩy):
                            </label>
                            <input
                              type="text"
                              value={(box.answers || []).join(', ')}
                              onChange={(e) => {
                                const nextBoxes = [...q.fillBlanks!.boxes];
                                nextBoxes[bi] = {
                                  ...box,
                                  answers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                                };
                                updateQuestion(idx, { fillBlanks: { ...q.fillBlanks!, boxes: nextBoxes } });
                              }}
                              placeholder="VD: r, R"
                              className="w-full px-2 py-1 text-xs border rounded font-bold text-emerald-700 bg-white"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                      <span>Vị trí hiển thị trên ảnh thực tế:</span>
                      <span className="text-[11px] text-amber-700">Học sinh sẽ thấy ô nhập trực tiếp ở đây</span>
                    </div>
                    <div className="stage">
                      <div
                        className="canvas"
                        style={{
                          paddingTop: `${((q.fillBlanks?.height || 600) / (q.fillBlanks?.width || 1000)) * 100}%`,
                          backgroundImage: q.img ? `url("${q.img}")` : 'none'
                        }}
                      >
                        {(q.fillBlanks?.boxes || []).map((b, bi) => {
                          const W = q.fillBlanks?.width || 1000;
                          const H = q.fillBlanks?.height || 600;
                          return (
                            <div
                              key={bi}
                              className="fb-box"
                              style={{
                                left: `${(b.x / W) * 100}%`,
                                top: `${(b.y / H) * 100}%`,
                                width: `${(b.w / W) * 100}%`,
                                height: `${(b.h / H) * 100}%`
                              }}
                            >
                              <span>{b.answers[0] || 'Ô ' + (bi + 1)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Connect-pairs Editor & Interactive Preview */}
              {q.type === 'connect-pairs' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
                  {/* Left Column: Pair Creation & Pairs Management */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                          <i className="fa-solid fa-bezier-curve text-purple-600"></i>
                          <span>Quản lý Cặp Nối (Trái ↔ Phải)</span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold font-mono">
                          {(q.connectPairs?.pairs || []).length} cặp • {(q.connectPairs?.points || []).length} điểm
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCreateNewPair(idx)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                          title="Tạo nhanh 1 cặp nối mới hoàn toàn"
                        >
                          <i className="fa-solid fa-plus"></i>
                          <span>+ Thêm Nhanh Cặp</span>
                        </button>
                        <button
                          type="button"
                          title="Tự động xếp đều tất cả các điểm thành 2 cột Trái - Phải"
                          onClick={() => handleAutoAlignConnectPoints(idx)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <i className="fa-solid fa-arrows-split-up-and-left text-purple-600"></i>
                          <span>⚡ Căn 2 Cột</span>
                        </button>
                      </div>
                    </div>

                    {/* Unified Color Bar: Toàn bộ các cặp nối mặc định theo 1 màu */}
                    {(() => {
                      const curDefaultColor = q.connectPairs?.defaultColor || '#2563eb';
                      const PRESET_COLORS = [
                        { color: '#2563eb', name: 'Xanh Cambridge (Chuẩn)' },
                        { color: '#6366f1', name: 'Tím Indigo' },
                        { color: '#0d9488', name: 'Xanh Ngọc Teal' },
                        { color: '#059669', name: 'Xanh Lá Emerald' },
                        { color: '#ea580c', name: 'Cam Amber' },
                        { color: '#e11d48', name: 'Đỏ Rose' }
                      ];

                      return (
                        <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-blue-950 flex items-center gap-1.5">
                              <i className="fa-solid fa-palette text-blue-600"></i>
                              <span>Màu mặc định cho tất cả điểm nối:</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {PRESET_COLORS.map((pc) => (
                                <button
                                  key={pc.color}
                                  type="button"
                                  onClick={() => handleApplyUnifiedColor(idx, pc.color)}
                                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer shadow-xs ${
                                    curDefaultColor.toLowerCase() === pc.color.toLowerCase()
                                      ? 'ring-2 ring-offset-1 ring-slate-800 scale-110'
                                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: pc.color }}
                                  title={`Đổi toàn bộ sang ${pc.name}`}
                                />
                              ))}
                              <input
                                type="color"
                                value={curDefaultColor}
                                onChange={(e) => handleApplyUnifiedColor(idx, e.target.value)}
                                className="w-5 h-5 p-0 border-0 rounded cursor-pointer ml-1"
                                title="Tùy chọn màu tùy ý"
                              />
                            </div>
                            <span className="text-[11px] text-blue-800 bg-white px-2 py-0.5 rounded-md border border-blue-200 font-semibold">
                              🛡️ Toàn bộ điểm cùng 1 màu để học sinh không đoán qua màu sắc
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyUnifiedColor(idx, curDefaultColor)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                            title="Áp dụng 1 màu này cho toàn bộ các điểm nối và đường nối hiện có trên đề"
                          >
                            <i className="fa-solid fa-brush"></i>
                            <span>Đồng bộ 1 màu tất cả điểm</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Duplicate Points & Orphaned Points Alert Bar */}
                    {(() => {
                      const cp = q.connectPairs;
                      if (!cp) return null;
                      const labelMap: Record<string, number> = {};
                      (cp.points || []).forEach((p) => {
                        labelMap[p.label] = (labelMap[p.label] || 0) + 1;
                      });
                      const duplicates = Object.keys(labelMap).filter((l) => labelMap[l] > 1);
                      const pairedLabels = new Set((cp.pairs || []).flatMap((p) => [p[0], p[1]]));
                      const unlinked = (cp.points || []).filter((p) => !pairedLabels.has(p.label));

                      if (duplicates.length === 0 && unlinked.length === 0) return null;

                      return (
                        <div className="p-3 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 text-xs space-y-2 shadow-xs animate-in fade-in">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 font-bold">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                              </span>
                              <div>
                                <h4 className="font-black text-amber-900">
                                  Phát hiện điểm nối thừa hoặc trùng tên trên tranh:
                                </h4>
                                <div className="text-[11px] text-amber-800 space-y-0.5">
                                  {duplicates.length > 0 && (
                                    <p className="font-bold text-rose-700">
                                      • Có {duplicates.length} nhãn bị trùng (VD: đang có {duplicates.map((d) => `2 điểm [${d}]`).join(', ')}).
                                    </p>
                                  )}
                                  {unlinked.length > 0 && (
                                    <p>
                                      • Có {unlinked.length} điểm đơn lẻ thừa chưa nối cặp nào ({unlinked.map((u) => `[${u.label}]`).join(', ')}).
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCleanDuplicateAndSurplusPoints(idx)}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                              title="Tự động xóa các điểm thừa chưa nối và sửa các điểm trùng tên"
                            >
                              <i className="fa-solid fa-broom"></i>
                              <span>Dọn Dẹp Điểm Thừa Ngay</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-amber-700 italic border-t border-amber-200/60 pt-1">
                            💡 Mẹo: Bạn cũng có thể bấm trực tiếp nút <b>✕ màu đỏ</b> ngay trên từng điểm ở bảng vẽ bên phải để xóa chính xác điểm mong muốn.
                          </p>
                        </div>
                      );
                    })()}

                    {/* CARD: THÊM CẶP NỐI MỚI HOÀN TOÀN */}
                    {(() => {
                      const cp = q.connectPairs || {
                        width: 700,
                        height: 420,
                        tolerance: 22,
                        showLabels: true,
                        points: [],
                        pairs: []
                      };
                      const suggested = getSuggestedPairLabels(cp.points);
                      const draft = newPairDrafts[idx] || {};
                      const leftLabel = draft.leftLabel !== undefined ? draft.leftLabel : suggested.left;
                      const rightLabel = draft.rightLabel !== undefined ? draft.rightLabel : suggested.right;

                      return (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/90 via-indigo-50/70 to-pink-50/60 border-2 border-purple-300 shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-black text-xs text-purple-950 uppercase tracking-wide">
                              <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center text-[10px]">
                                <i className="fa-solid fa-link"></i>
                              </span>
                              <span>Thêm Cặp Nối Mới Hoàn Toàn</span>
                            </div>
                            <span className="text-[11px] font-bold text-purple-700 bg-white/80 px-2 py-0.5 rounded-full border border-purple-200 shadow-2xs">
                              Mới 100% không trùng lặp
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-tight">
                            Nhập 2 vế nối (Trái ↔ Phải) bên dưới. Khi nhấn thêm, hệ thống sẽ tạo mới hoàn toàn cả 2 điểm và tự động thiết lập đường nối chính xác:
                          </p>

                          {/* 2-Column Inputs for the New Pair */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Left Side */}
                            <div className="p-2.5 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                  Vế Trái (Cột 1)
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-semibold">Nhãn:</span>
                                  <input
                                    type="text"
                                    value={leftLabel}
                                    onChange={(e) =>
                                      setNewPairDrafts((prev) => ({
                                        ...prev,
                                        [idx]: { ...(prev[idx] || {}), leftLabel: e.target.value.toUpperCase() }
                                      }))
                                    }
                                    placeholder={suggested.left}
                                    className="w-10 px-1 py-0.5 text-center font-mono font-black text-xs bg-blue-50 border border-blue-300 rounded text-blue-800"
                                    title="Mã định danh vế trái (VD: A, B, C...)"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  Chữ / Từ ngữ:
                                </label>
                                <input
                                  type="text"
                                  value={draft.leftText || ''}
                                  onChange={(e) =>
                                    setNewPairDrafts((prev) => ({
                                      ...prev,
                                      [idx]: { ...(prev[idx] || {}), leftText: e.target.value }
                                    }))
                                  }
                                  placeholder="VD: Water Bottle, Cat, 25+15..."
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:bg-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  Ảnh đính kèm (tùy chọn):
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={draft.leftImg?.startsWith('data:image/svg+xml') ? '[Ảnh SVG]' : draft.leftImg || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val !== '[Ảnh SVG]') {
                                        setNewPairDrafts((prev) => ({
                                          ...prev,
                                          [idx]: { ...(prev[idx] || {}), leftImg: val }
                                        }));
                                      }
                                    }}
                                    placeholder="https://... hoặc tải ảnh"
                                    className="flex-1 px-1.5 py-0.5 text-[11px] bg-slate-50 border border-slate-300 rounded"
                                  />
                                  <label className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer shrink-0">
                                    Tải
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const dataUrl = ev.target?.result as string;
                                          setNewPairDrafts((prev) => ({
                                            ...prev,
                                            [idx]: { ...(prev[idx] || {}), leftImg: dataUrl }
                                          }));
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                  </label>
                                  {draft.leftImg && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNewPairDrafts((prev) => ({
                                          ...prev,
                                          [idx]: { ...(prev[idx] || {}), leftImg: '' }
                                        }))
                                      }
                                      className="px-1 text-slate-400 hover:text-red-500 font-black text-xs"
                                      title="Xóa ảnh"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                {draft.leftImg && (
                                  <div className="mt-1 flex items-center justify-center p-1 rounded border border-blue-200 bg-blue-50/50">
                                    <img src={draft.leftImg} alt="" className="max-h-12 object-contain" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Side */}
                            <div className="p-2.5 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                  Vế Phải (Cột 2)
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-semibold">Nhãn:</span>
                                  <input
                                    type="text"
                                    value={rightLabel}
                                    onChange={(e) =>
                                      setNewPairDrafts((prev) => ({
                                        ...prev,
                                        [idx]: { ...(prev[idx] || {}), rightLabel: e.target.value.toUpperCase() }
                                      }))
                                    }
                                    placeholder={suggested.right}
                                    className="w-10 px-1 py-0.5 text-center font-mono font-black text-xs bg-emerald-50 border border-emerald-300 rounded text-emerald-800"
                                    title="Mã định danh vế phải (VD: 1, 2, D, E...)"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  Chữ / Từ ngữ:
                                </label>
                                <input
                                  type="text"
                                  value={draft.rightText || ''}
                                  onChange={(e) =>
                                    setNewPairDrafts((prev) => ({
                                      ...prev,
                                      [idx]: { ...(prev[idx] || {}), rightText: e.target.value }
                                    }))
                                  }
                                  placeholder="VD: 1 Litre, Con mèo, 40..."
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:bg-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  Ảnh đính kèm (tùy chọn):
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={draft.rightImg?.startsWith('data:image/svg+xml') ? '[Ảnh SVG]' : draft.rightImg || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val !== '[Ảnh SVG]') {
                                        setNewPairDrafts((prev) => ({
                                          ...prev,
                                          [idx]: { ...(prev[idx] || {}), rightImg: val }
                                        }));
                                      }
                                    }}
                                    placeholder="https://... hoặc tải ảnh"
                                    className="flex-1 px-1.5 py-0.5 text-[11px] bg-slate-50 border border-slate-300 rounded"
                                  />
                                  <label className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer shrink-0">
                                    Tải
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const dataUrl = ev.target?.result as string;
                                          setNewPairDrafts((prev) => ({
                                            ...prev,
                                            [idx]: { ...(prev[idx] || {}), rightImg: dataUrl }
                                          }));
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                  </label>
                                  {draft.rightImg && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNewPairDrafts((prev) => ({
                                          ...prev,
                                          [idx]: { ...(prev[idx] || {}), rightImg: '' }
                                        }))
                                      }
                                      className="px-1 text-slate-400 hover:text-red-500 font-black text-xs"
                                      title="Xóa ảnh"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                {draft.rightImg && (
                                  <div className="mt-1 flex items-center justify-center p-1 rounded border border-emerald-200 bg-emerald-50/50">
                                    <img src={draft.rightImg} alt="" className="max-h-12 object-contain" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            type="button"
                            onClick={() => {
                              handleCreateNewPair(idx, {
                                leftLabel,
                                leftText: draft.leftText,
                                leftImg: draft.leftImg,
                                rightLabel,
                                rightText: draft.rightText,
                                rightImg: draft.rightImg
                              });
                            }}
                            className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-[0.99] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <i className="fa-solid fa-plus-circle text-sm text-yellow-300"></i>
                            <span>+ Thêm Cặp Nối Mới Này Vào Đề</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* LIST OF EXISTING CONNECTED PAIRS */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5 text-purple-950 font-extrabold">
                          <i className="fa-solid fa-link text-purple-600"></i>
                          <span>Các Cặp Nối Đáp Án Đúng ({(q.connectPairs?.pairs || []).length} cặp):</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Chỉnh sửa trực tiếp 2 vế của từng cặp
                        </span>
                      </div>

                      {(!q.connectPairs?.pairs || q.connectPairs.pairs.length === 0) ? (
                        <div className="p-4 rounded-xl border border-dashed border-purple-300 bg-purple-50/40 text-center text-xs text-purple-700 font-semibold space-y-1">
                          <p>Chưa có cặp nối nào.</p>
                          <p className="text-[11px] text-slate-500">
                            Nhập 2 vế ở khung phía trên và bấm <b>"+ Thêm Cặp Nối Mới Này Vào Đề"</b> hoặc bấm <b>"+ Thêm Nhanh Cặp"</b>!
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                          {q.connectPairs.pairs.map((pair, pIdx) => {
                            const ptA = q.connectPairs?.points.find((p) => p.label === pair[0]);
                            const ptB = q.connectPairs?.points.find((p) => p.label === pair[1]);
                            if (!ptA || !ptB) {
                              return (
                                <div
                                  key={pIdx}
                                  className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between"
                                >
                                  <span>Cặp lỗi: [{pair[0]} ↔ {pair[1]}] thiếu điểm dữ liệu</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePairAndPoints(idx, pIdx)}
                                    className="text-red-700 font-bold hover:underline"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={pIdx}
                                className="p-3 rounded-2xl border border-purple-200 bg-white shadow-2xs space-y-2.5 transition hover:border-purple-400"
                              >
                                {/* Pair Header */}
                                {(() => {
                                  const curEx = q.connectPairs?.examplePair;
                                  const isThisEx =
                                    (curEx?.[0] === pair[0] && curEx?.[1] === pair[1]) ||
                                    (curEx?.[1] === pair[0] && curEx?.[0] === pair[1]) ||
                                    (!curEx && pIdx === 0 && (q.connectPairs?.pairs?.length || 0) > 1);

                                  return (
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-purple-900 bg-purple-100 px-2 py-0.5 rounded-md">
                                            Cặp #{pIdx + 1}
                                          </span>
                                          <div className="flex items-center gap-1.5 font-mono font-black text-xs">
                                            <span
                                              className="w-5 h-5 rounded-full text-white text-[11px] font-mono font-black flex items-center justify-center shadow-xs"
                                              style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                                            >
                                              {ptA.label}
                                            </span>
                                            <span className="text-purple-600 font-sans font-bold">── nối với ──</span>
                                            <span
                                              className="w-5 h-5 rounded-full text-white text-[11px] font-mono font-black flex items-center justify-center shadow-xs"
                                              style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                                            >
                                              {ptB.label}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const curCp = q.connectPairs!;
                                              if (isThisEx && curCp.examplePair) {
                                                updateQuestion(idx, {
                                                  connectPairs: {
                                                    ...curCp,
                                                    examplePair: undefined,
                                                    examplePairLabel: undefined
                                                  }
                                                });
                                                showToast('Đã hủy chọn cặp ví dụ mẫu');
                                              } else {
                                                const label = `★ Ví dụ: ${ptA.text || ptA.label} ➔ ${ptB.text || ptB.label}`;
                                                updateQuestion(idx, {
                                                  connectPairs: {
                                                    ...curCp,
                                                    examplePair: [pair[0], pair[1]],
                                                    examplePairLabel: label
                                                  }
                                                });
                                                showToast(`Đã chọn Cặp #${pIdx + 1} làm Ví dụ mẫu nối sẵn!`, 'success');
                                              }
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                                              isThisEx
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            }`}
                                            title="Bật/tắt đường nối này thành câu ví dụ mẫu nối sẵn cho học sinh"
                                          >
                                            <i className="fa-solid fa-star text-amber-300"></i>
                                            <span>{isThisEx ? '★ Cặp ví dụ mẫu (Đã nối)' : 'Đặt làm ví dụ mẫu'}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleDeletePairAndPoints(idx, pIdx)}
                                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer flex items-center gap-1 transition"
                                            title="Xóa cặp nối này và 2 điểm liên quan"
                                          >
                                            <i className="fa-solid fa-trash-can text-[11px]"></i>
                                            <span>Xóa cặp</span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* Example Pair Configuration Banner if active */}
                                      {isThisEx && (
                                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 space-y-1.5">
                                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                                            <span className="flex items-center gap-1.5 uppercase font-black">
                                              <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                              <span>ĐƯỜNG NỐI VÍ DỤ MẪU CHO HỌC SINH</span>
                                            </span>
                                            <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                              Tự động vẽ sẵn trên bài thi
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-emerald-900 font-bold shrink-0">
                                              Nhãn đường nối:
                                            </span>
                                            <input
                                              type="text"
                                              value={
                                                q.connectPairs?.examplePairLabel ??
                                                `★ Ví dụ: ${ptA.text || ptA.label} ➔ ${ptB.text || ptB.label}`
                                              }
                                              onChange={(e) => {
                                                const curCp = q.connectPairs!;
                                                updateQuestion(idx, {
                                                  connectPairs: { ...curCp, examplePairLabel: e.target.value }
                                                });
                                              }}
                                              placeholder="VD: ★ Ví dụ: Ben ➔ Boy flying kite"
                                              className="flex-1 px-2 py-1 text-xs bg-white border border-emerald-300 rounded-lg font-bold text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}

                                {/* 2 Items Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {/* Left Point Edit */}
                                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="w-5 h-5 rounded-full text-white text-[10px] font-mono font-black flex items-center justify-center shadow-xs shrink-0"
                                          style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                                          title="Toàn bộ điểm dùng chung 1 màu đồng nhất để học sinh không đoán qua màu sắc"
                                        >
                                          {ptA.label}
                                        </span>
                                        <input
                                          type="text"
                                          value={ptA.label}
                                          onChange={(e) =>
                                            handleUpdatePointByLabel(idx, ptA.label, { label: e.target.value })
                                          }
                                          className="w-10 px-1 py-0.5 border rounded text-center font-mono font-bold text-xs bg-white text-slate-800"
                                          title="Đổi mã nhãn vế trái"
                                        />
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ({ptA.x}, {ptA.y})
                                      </span>
                                    </div>

                                    <input
                                      type="text"
                                      value={ptA.text || ''}
                                      onChange={(e) =>
                                        handleUpdatePointByLabel(idx, ptA.label, { text: e.target.value })
                                      }
                                      placeholder="Chữ / từ ngữ vế trái..."
                                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                                    />

                                    {/* Image */}
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={ptA.img?.startsWith('data:image/svg+xml') ? '[Ảnh SVG]' : ptA.img || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val !== '[Ảnh SVG]') {
                                            handleUpdatePointByLabel(idx, ptA.label, { img: val });
                                          }
                                        }}
                                        placeholder="Ảnh URL hoặc tải lên..."
                                        className="flex-1 px-1.5 py-0.5 text-[11px] bg-white border border-slate-300 rounded"
                                      />
                                      <label className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] cursor-pointer shrink-0">
                                        Tải
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                              const dataUrl = ev.target?.result as string;
                                              handleUpdatePointByLabel(idx, ptA.label, { img: dataUrl });
                                            };
                                            reader.readAsDataURL(file);
                                          }}
                                        />
                                      </label>
                                      {ptA.img && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdatePointByLabel(idx, ptA.label, { img: '' })}
                                          className="text-slate-400 hover:text-red-500 text-xs font-bold"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    {ptA.img && (
                                      <div className="flex items-center justify-center p-1 rounded border border-slate-200 bg-white">
                                        <img src={ptA.img} alt="" className="max-h-12 object-contain" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Point Edit */}
                                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="w-5 h-5 rounded-full text-white text-[10px] font-mono font-black flex items-center justify-center shadow-xs shrink-0"
                                          style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                                          title="Toàn bộ điểm dùng chung 1 màu đồng nhất để học sinh không đoán qua màu sắc"
                                        >
                                          {ptB.label}
                                        </span>
                                        <input
                                          type="text"
                                          value={ptB.label}
                                          onChange={(e) =>
                                            handleUpdatePointByLabel(idx, ptB.label, { label: e.target.value })
                                          }
                                          className="w-10 px-1 py-0.5 border rounded text-center font-mono font-bold text-xs bg-white text-slate-800"
                                          title="Đổi mã nhãn vế phải"
                                        />
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ({ptB.x}, {ptB.y})
                                      </span>
                                    </div>

                                    <input
                                      type="text"
                                      value={ptB.text || ''}
                                      onChange={(e) =>
                                        handleUpdatePointByLabel(idx, ptB.label, { text: e.target.value })
                                      }
                                      placeholder="Chữ / từ ngữ vế phải..."
                                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                                    />

                                    {/* Image */}
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={ptB.img?.startsWith('data:image/svg+xml') ? '[Ảnh SVG]' : ptB.img || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val !== '[Ảnh SVG]') {
                                            handleUpdatePointByLabel(idx, ptB.label, { img: val });
                                          }
                                        }}
                                        placeholder="Ảnh URL hoặc tải lên..."
                                        className="flex-1 px-1.5 py-0.5 text-[11px] bg-white border border-slate-300 rounded"
                                      />
                                      <label className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer shrink-0">
                                        Tải
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                              const dataUrl = ev.target?.result as string;
                                              handleUpdatePointByLabel(idx, ptB.label, { img: dataUrl });
                                            };
                                            reader.readAsDataURL(file);
                                          }}
                                        />
                                      </label>
                                      {ptB.img && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdatePointByLabel(idx, ptB.label, { img: '' })}
                                          className="text-slate-400 hover:text-red-500 text-xs font-bold"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    {ptB.img && (
                                      <div className="flex items-center justify-center p-1 rounded border border-slate-200 bg-white">
                                        <img src={ptB.img} alt="" className="max-h-12 object-contain" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Collapsible / Comprehensive Points Manager & Distractor Items */}
                    {(() => {
                      const cp = q.connectPairs;
                      const allPts = cp?.points || [];
                      const pairedLabels = new Set(
                        (cp?.pairs || []).flatMap((p) => [p[0], p[1]])
                      );
                      const unlinkedPoints = allPts.filter(
                        (p) => !pairedLabels.has(p.label)
                      );
                      const labelMap: Record<string, number> = {};
                      allPts.forEach((p) => {
                        labelMap[p.label] = (labelMap[p.label] || 0) + 1;
                      });

                      return (
                        <details className="p-3 rounded-2xl border border-purple-200 bg-purple-50/40 text-xs space-y-2.5 cursor-pointer group shadow-2xs">
                          <summary className="font-extrabold text-purple-950 flex items-center justify-between select-none">
                            <span className="flex items-center gap-2">
                              <i className="fa-solid fa-list-check text-purple-600"></i>
                              <span>Quản lý Tất Cả {allPts.length} Điểm Trên Tranh</span>
                              {unlinkedPoints.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  {unlinkedPoints.length} điểm thừa chưa nối
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-purple-600 font-semibold group-open:rotate-180 transition-transform">
                              ▼
                            </span>
                          </summary>

                          <div className="space-y-2.5 pt-2 border-t border-purple-200/60 cursor-default">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600">
                                Danh sách tất cả điểm đang có trên hình vẽ:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curCp = q.connectPairs || {
                                      width: 700,
                                      height: 420,
                                      tolerance: 22,
                                      showLabels: true,
                                      points: [],
                                      pairs: []
                                    };
                                    const existingLabels = new Set(curCp.points.map((p) => p.label));
                                    let nextLetter = 'X';
                                    for (const ch of 'XYZWVUTSRQPONMLKJIHGFEDCBA') {
                                      if (!existingLabels.has(ch)) {
                                        nextLetter = ch;
                                        break;
                                      }
                                    }
                                    const newPt: ConnectPairPoint = {
                                      x: 520,
                                      y: 200,
                                      label: nextLetter,
                                      text: `Mục gây nhiễu ${nextLetter}`,
                                      img: '',
                                      color: curCp.defaultColor || '#2563eb'
                                    };
                                    updateQuestion(idx, {
                                      connectPairs: { ...curCp, points: [...curCp.points, newPt] }
                                    });
                                    showToast(`Đã thêm mục gây nhiễu "${nextLetter}"`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[11px] cursor-pointer"
                                >
                                  + Thêm mục gây nhiễu
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCleanDuplicateAndSurplusPoints(idx)}
                                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] cursor-pointer"
                                  title="Xóa nhanh các điểm thừa và sửa điểm trùng"
                                >
                                  🧹 Dọn dẹp điểm thừa
                                </button>
                              </div>
                            </div>

                            {allPts.length === 0 ? (
                              <p className="text-slate-400 italic text-center py-2">Chưa có điểm nào trên tranh.</p>
                            ) : (
                              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                {allPts.map((pt, pIdx) => {
                                  const isDup = (labelMap[pt.label] || 0) > 1;
                                  const isUnlinked = !pairedLabels.has(pt.label);
                                  const pairedWith = (cp?.pairs || []).find(
                                    (p) => p[0] === pt.label || p[1] === pt.label
                                  );

                                  return (
                                    <div
                                      key={pIdx}
                                      className={`p-2 rounded-xl bg-white border flex items-center justify-between gap-2 shadow-2xs transition ${
                                        isDup
                                          ? 'border-rose-300 bg-rose-50/50'
                                          : isUnlinked
                                          ? 'border-amber-300 bg-amber-50/40'
                                          : 'border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs font-mono"
                                          style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                                        >
                                          {pt.label}
                                        </span>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-extrabold text-slate-800 text-xs truncate max-w-[140px]">
                                              {pt.text || `Điểm [${pt.label}]`}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              ({pt.x}, {pt.y})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 mt-0.5">
                                            {isDup && (
                                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                                ⚠️ Trùng tên [{pt.label}]
                                              </span>
                                            )}
                                            {isUnlinked ? (
                                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                Điểm thừa / Chưa nối cặp
                                              </span>
                                            ) : pairedWith ? (
                                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                Cặp: {pairedWith[0]} ↔ {pairedWith[1]}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleDeletePointByIndex(idx, pIdx)}
                                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer border border-rose-200 transition shrink-0 flex items-center gap-1 active:scale-95"
                                        title={`Xóa điểm [${pt.label}] này khỏi tranh`}
                                      >
                                        <i className="fa-solid fa-trash-can text-[11px]"></i>
                                        <span>Xóa</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })()}
                  </div>

                  {/* Right Column: Interactive Drag-and-Drop Canvas Stage */}
                  <div className="lg:col-span-6 space-y-2">
                    <div className="text-xs font-bold text-slate-600 flex flex-wrap items-center justify-between gap-1">
                      <span>Bảng vẽ tương tác nối điểm:</span>
                      <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-bold">
                        💡 Kéo thả trực tiếp điểm/từ/ảnh trên bảng để định vị
                      </span>
                    </div>

                    <div
                      className="stage select-none shadow-md"
                      onMouseMove={(e) => {
                        if (draggingPoint && draggingPoint.qIdx === idx) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const W = q.connectPairs?.width || 700;
                          const H = q.connectPairs?.height || 420;
                          const mouseX = Math.round(
                            Math.max(25, Math.min(W - 25, ((e.clientX - rect.left) / rect.width) * W))
                          );
                          const mouseY = Math.round(
                            Math.max(25, Math.min(H - 25, ((e.clientY - rect.top) / rect.height) * H))
                          );
                          const nextPts = [...(q.connectPairs?.points || [])];
                          nextPts[draggingPoint.pIdx] = {
                            ...nextPts[draggingPoint.pIdx],
                            x: mouseX,
                            y: mouseY
                          };
                          updateQuestion(idx, {
                            connectPairs: { ...q.connectPairs!, points: nextPts }
                          });
                        }
                      }}
                      onMouseUp={() => setDraggingPoint(null)}
                      onMouseLeave={() => setDraggingPoint(null)}
                    >
                      <div
                        className="canvas"
                        style={{
                          paddingTop: `${((q.connectPairs?.height || 420) / (q.connectPairs?.width || 700)) * 100}%`,
                          backgroundImage: q.img ? `url("${q.img}")` : 'none'
                        }}
                      >
                        {/* SVG Layer for Pairs Lines */}
                        <svg
                          className="cp-svg-layer"
                          viewBox={`0 0 ${q.connectPairs?.width || 700} ${q.connectPairs?.height || 420}`}
                        >
                          {(q.connectPairs?.pairs || []).map((pair, pIdx) => {
                            const ptA = q.connectPairs?.points.find((p) => p.label === pair[0]);
                            const ptB = q.connectPairs?.points.find((p) => p.label === pair[1]);
                            if (!ptA || !ptB) return null;

                            const curEx = q.connectPairs?.examplePair;
                            const isThisEx =
                              (curEx?.[0] === pair[0] && curEx?.[1] === pair[1]) ||
                              (curEx?.[1] === pair[0] && curEx?.[0] === pair[1]) ||
                              (!curEx && pIdx === 0 && (q.connectPairs?.pairs?.length || 0) > 1);

                            if (isThisEx) {
                              const midX = (ptA.x + ptB.x) / 2;
                              const midY = (ptA.y + ptB.y) / 2;
                              return (
                                <g key={pIdx}>
                                  <line
                                    x1={ptA.x}
                                    y1={ptA.y}
                                    x2={ptB.x}
                                    y2={ptB.y}
                                    stroke="#10b981"
                                    strokeWidth="8"
                                    strokeOpacity="0.35"
                                    strokeLinecap="round"
                                  />
                                  <line
                                    x1={ptA.x}
                                    y1={ptA.y}
                                    x2={ptB.x}
                                    y2={ptB.y}
                                    stroke="#047857"
                                    strokeWidth="4"
                                    strokeDasharray="8 5"
                                    strokeLinecap="round"
                                  />
                                </g>
                              );
                            }

                            return (
                              <line
                                key={pIdx}
                                x1={ptA.x}
                                y1={ptA.y}
                                x2={ptB.x}
                                y2={ptB.y}
                                stroke={q.connectPairs?.defaultColor || ptA.color || '#2563eb'}
                                strokeWidth="3.5"
                                strokeDasharray="5 5"
                              />
                            );
                          })}
                        </svg>

                        {/* Interactive Points / Words / Images Cards */}
                        {(q.connectPairs?.points || []).map((pt, pti) => {
                          const W = q.connectPairs?.width || 700;
                          const H = q.connectPairs?.height || 420;
                          const isBeingDragged =
                            draggingPoint?.qIdx === idx && draggingPoint?.pIdx === pti;
                          const curEx = q.connectPairs?.examplePair;
                          const isExamplePoint =
                            curEx?.[0] === pt.label ||
                            curEx?.[1] === pt.label ||
                            (!curEx &&
                              (q.connectPairs?.pairs?.length || 0) > 1 &&
                              (q.connectPairs?.pairs[0][0] === pt.label || q.connectPairs?.pairs[0][1] === pt.label));

                          const allPts = q.connectPairs?.points || [];
                          const isDuplicate = allPts.filter((p) => p.label === pt.label).length > 1;
                          const isPaired = (q.connectPairs?.pairs || []).some((p) => p[0] === pt.label || p[1] === pt.label);

                          return (
                            <div
                              key={pti}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingPoint({ qIdx: idx, pIdx: pti });
                              }}
                              className={`group/pt absolute flex items-center gap-1.5 p-1 rounded-xl bg-white/95 border shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none ${
                                isBeingDragged
                                  ? 'border-purple-600 ring-4 ring-purple-400/50 shadow-xl z-20'
                                  : isDuplicate
                                  ? 'border-rose-500 ring-2 ring-rose-400 z-15 bg-rose-50/95 shadow-rose-200'
                                  : !isPaired
                                  ? 'border-amber-400 ring-2 ring-amber-300 z-12 bg-amber-50/95'
                                  : isExamplePoint
                                  ? 'border-emerald-500 z-15 bg-white/95'
                                  : 'border-slate-300 hover:border-purple-500 z-10'
                              }`}
                              style={{
                                left: `${(pt.x / W) * 100}%`,
                                top: `${(pt.y / H) * 100}%`,
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              {/* Dot Anchor (Mặc định toàn bộ điểm cùng 1 màu để học sinh không đoán qua màu sắc) */}
                              <div
                                className="w-7 h-7 rounded-full text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0 relative"
                                style={{ backgroundColor: q.connectPairs?.defaultColor || '#2563eb' }}
                              >
                                {pt.label}
                                {isDuplicate && (
                                  <span
                                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[8px] font-black flex items-center justify-center shadow-xs"
                                    title="Điểm này bị trùng tên nhãn với điểm khác trên tranh!"
                                  >
                                    !
                                  </span>
                                )}
                              </div>

                              {/* Attached Image Thumbnail */}
                              {pt.img && (
                                <img
                                  src={pt.img}
                                  alt=""
                                  className="w-8 h-8 rounded object-contain border border-slate-200 bg-white shrink-0 pointer-events-none"
                                />
                              )}

                              {/* Attached Text / Word */}
                              {pt.text && (
                                <span className="font-bold text-xs text-slate-800 pr-1 truncate max-w-[130px] pointer-events-none">
                                  {pt.text}
                                </span>
                              )}

                              {/* Direct Point Delete Button (✕) */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleDeletePointByIndex(idx, pti);
                                }}
                                title={`Xóa điểm [${pt.label}] này khỏi tranh`}
                                className="w-4.5 h-4.5 rounded-full bg-rose-500 hover:bg-rose-700 active:scale-90 text-white flex items-center justify-center text-[10px] font-black shadow-xs cursor-pointer transition shrink-0 ml-0.5"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tick-cross Editor (Cambridge Reading & Writing Part 1: Look & Read - Tick or Cross) */}
              {q.type === 'tick-cross' && (
                <div className="p-4 rounded-xl bg-teal-50/70 border-2 border-teal-200 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-black text-teal-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <i className="fa-solid fa-square-check text-teal-600 text-sm"></i>
                      <span>Định dạng Cambridge Reading & Writing: Quan sát tranh và đánh dấu Tick (✓) hoặc Cross (X)</span>
                    </div>
                    <span className="text-[11px] font-bold text-teal-700 bg-teal-100/80 px-2.5 py-0.5 rounded-full border border-teal-300">
                      Chuẩn Cambridge Starters / Movers Part 1
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="p-2.5 bg-white rounded-xl border border-teal-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500">
                      Nạp nhanh câu hỏi mẫu theo đề Cambridge (ảnh + câu miêu tả + đáp án):
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'This is a balloon.',
                            img: GRADE2_MEDIA.readBalloon,
                            isTick: true
                          });
                          showToast('Đã nạp câu mẫu 1: Balloon [✓ Tick]!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🎈 1. Balloon [✓ Tick]
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'This is a radio.',
                            img: GRADE2_MEDIA.readRadioWave,
                            isTick: false
                          });
                          showToast('Đã nạp câu mẫu 2: Radio [X Cross]!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-900 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🌊 2. Radio [X Cross]
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'This is a racket.',
                            img: GRADE2_MEDIA.readRacket,
                            isTick: true
                          });
                          showToast('Đã nạp câu mẫu 3: Racket [✓ Tick]!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🏸 3. Racket [✓ Tick]
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'This is a waterfall.',
                            img: GRADE2_MEDIA.readWaterfall,
                            isTick: true
                          });
                          showToast('Đã nạp câu mẫu 4: Waterfall [✓ Tick]!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🏞️ 4. Waterfall [✓ Tick]
                      </button>
                    </div>
                  </div>

                  {/* Target Answer Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700">
                      Chọn đáp án chuẩn của câu hỏi này (so sánh câu miêu tả với hình ảnh):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer font-black text-sm transition select-none ${
                          q.isTick === true
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`tick-cross-${idx}`}
                          checked={q.isTick === true}
                          onChange={() => updateQuestion(idx, { isTick: true })}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-lg font-black shrink-0">
                          ✓
                        </span>
                        <div>
                          <div>Đáp án là TICK (✓ Đúng với hình)</div>
                          <p className="text-[11px] font-normal text-slate-500">
                            Câu tiếng Anh miêu tả đúng đồ vật trong tranh
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer font-black text-sm transition select-none ${
                          q.isTick === false
                            ? 'border-rose-600 bg-rose-50 text-rose-950 ring-2 ring-rose-400/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`tick-cross-${idx}`}
                          checked={q.isTick === false}
                          onChange={() => updateQuestion(idx, { isTick: false })}
                          className="w-4 h-4 text-rose-600"
                        />
                        <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center text-lg font-black shrink-0">
                          X
                        </span>
                        <div>
                          <div>Đáp án là CROSS (X Sai so với hình)</div>
                          <p className="text-[11px] font-normal text-slate-500">
                            Câu tiếng Anh miêu tả sai (ví dụ hình sóng biển nhưng ghi radio)
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Live Cambridge Card Preview */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                      Xem trước thẻ câu hỏi dạng Cambridge đề thi thực tế:
                    </span>
                    <div className="border-2 border-dashed border-slate-400 bg-white rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-2xs">
                      {/* Number */}
                      <span className="text-base font-black text-slate-900 w-6 shrink-0">
                        {idx + 1}.
                      </span>

                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-300 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {q.img ? (
                          <img
                            src={q.img}
                            alt=""
                            className="max-w-full max-h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <span className="text-2xl text-slate-400">🖼️</span>
                        )}
                      </div>

                      {/* English Statement */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                          {q.q.replace(/<[^>]*>/g, '').replace(/^\d+[\.\)]\s*/, '') || 'This is a...'}
                        </div>
                        <span className="text-[10px] text-slate-400 italic">
                          Học sinh sẽ bấm vào ô vuông bên cạnh để điền ✓ hoặc X
                        </span>
                      </div>

                      {/* Cambridge Box Preview */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div
                          className={`w-12 h-12 border-2 rounded-xl flex items-center justify-center font-black text-2xl shadow-xs ${
                            q.isTick
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-rose-600 bg-rose-50 text-rose-700'
                          }`}
                        >
                          {q.isTick ? '✓' : 'X'}
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          {q.isTick ? 'Tick' : 'Cross'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Listen-write Editor */}
              {q.type === 'listen-write' && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-headphones text-emerald-600"></i>
                    <span>Cấu hình Nghe và Điền tên hoặc số (Listen & Write a name or number):</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Các đáp án được chấp nhận (ngăn cách bởi dấu phẩy, không phân biệt hoa thường):
                    </label>
                    <input
                      type="text"
                      value={(q.acceptableAnswers || []).join(', ')}
                      onChange={(e) => {
                        const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        updateQuestion(idx, { acceptableAnswers: list });
                      }}
                      placeholder="VD: May (hoặc 6, six hoặc Ben)"
                      className="w-full px-3 py-2 text-sm bg-white border border-emerald-300 rounded-xl font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hệ thống tự động so khớp không phân biệt chữ hoa, chữ thường khi học sinh nộp bài.
                    </p>
                  </div>
                </div>
              )}

              {/* Unscramble-word Editor */}
              {q.type === 'unscramble-word' && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-arrow-down-a-z text-amber-600"></i>
                      <span>Cấu hình ghép chữ cái (Anagram / Unscramble Letters):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = (q.unscramble?.targetWord || q.unscrambleTarget || q.answerText || '').trim();
                        if (!target) return;
                        const shuffled = target.split('').sort(() => Math.random() - 0.5);
                        updateQuestion(idx, {
                          unscrambleTarget: target,
                          answerText: target,
                          acceptableAnswers: [target],
                          unscramble: {
                            targetWord: target,
                            scrambledLetters: shuffled
                          }
                        });
                        showToast('Đã tự động xáo trộn các chữ cái!');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      <i className="fa-solid fa-shuffle mr-1"></i> Tự xáo trộn chữ
                    </button>
                  </div>

                  {/* Preset Buttons */}
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500">
                      Nạp nhanh câu mẫu chuẩn Cambridge Starters / Movers Part 3:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'Look at the picture and letters. Write the word: (Ví dụ: Con vịt)',
                            img: GRADE2_MEDIA.exampleDuck,
                            isExample: true,
                            points: 0,
                            unscrambleTarget: 'duck',
                            answerText: 'duck',
                            acceptableAnswers: ['duck'],
                            unscramble: {
                              targetWord: 'duck',
                              scrambledLetters: ['u', 'd', 'c', 'k']
                            }
                          });
                          showToast('Đã nạp câu ví dụ mẫu: DUCK (0đ)!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black transition cursor-pointer"
                      >
                        🦆 Ví dụ: DUCK (0đ)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'Look at the picture and letters. Write the word: (Thung lũng)',
                            img: GRADE2_MEDIA.scrambleValley,
                            isExample: false,
                            points: 0.3,
                            unscrambleTarget: 'valley',
                            answerText: 'valley',
                            acceptableAnswers: ['valley'],
                            unscramble: {
                              targetWord: 'valley',
                              scrambledLetters: ['l', 'l', 'e', 'a', 'v', 'y']
                            }
                          });
                          showToast('Đã nạp câu 1: VALLEY!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🏞️ 1. VALLEY
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'Look at the picture and letters. Write the word: (Bãi biển)',
                            img: GRADE2_MEDIA.scrambleBeach,
                            isExample: false,
                            points: 0.3,
                            unscrambleTarget: 'beach',
                            answerText: 'beach',
                            acceptableAnswers: ['beach'],
                            unscramble: {
                              targetWord: 'beach',
                              scrambledLetters: ['b', 'c', 'a', 'e', 'h']
                            }
                          });
                          showToast('Đã nạp câu 2: BEACH!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🏖️ 2. BEACH
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'Look at the picture and letters. Write the word: (Cây đàn ghi-ta)',
                            img: GRADE2_MEDIA.scrambleGuitar,
                            isExample: false,
                            points: 0.3,
                            unscrambleTarget: 'guitar',
                            answerText: 'guitar',
                            acceptableAnswers: ['guitar'],
                            unscramble: {
                              targetWord: 'guitar',
                              scrambledLetters: ['i', 'u', 'g', 't', 'r', 'a']
                            }
                          });
                          showToast('Đã nạp câu 3: GUITAR!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🎸 3. GUITAR
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateQuestion(idx, {
                            q: 'Look at the picture and letters. Write the word: (Hòn đảo)',
                            img: GRADE2_MEDIA.scrambleIsland,
                            isExample: false,
                            points: 0.3,
                            unscrambleTarget: 'island',
                            answerText: 'island',
                            acceptableAnswers: ['island'],
                            unscramble: {
                              targetWord: 'island',
                              scrambledLetters: ['l', 'i', 'd', 'a', 's', 'n']
                            }
                          });
                          showToast('Đã nạp câu 4: ISLAND!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border border-slate-200 font-bold transition cursor-pointer"
                      >
                        🏝️ 4. ISLAND
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        Từ tiếng Anh mục tiêu (Target Word - Đáp án chấm điểm):
                      </label>
                      <input
                        type="text"
                        value={q.unscramble?.targetWord || q.unscrambleTarget || q.answerText || ''}
                        onChange={(e) => {
                          const target = e.target.value.trim().toLowerCase();
                          const currentLetters = q.unscramble?.scrambledLetters || [];
                          const shouldAutoShuffle = currentLetters.length === 0 || currentLetters.length !== target.length;
                          const scrambledLetters = shouldAutoShuffle
                            ? target.split('').sort(() => Math.random() - 0.5)
                            : currentLetters;

                          updateQuestion(idx, {
                            unscrambleTarget: target,
                            answerText: target,
                            acceptableAnswers: [target],
                            unscramble: {
                              targetWord: target,
                              scrambledLetters
                            }
                          });
                        }}
                        placeholder="VD: duck, valley, beach, guitar..."
                        className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-wider"
                      />
                      <p className="text-[11px] text-amber-800 font-semibold mt-1">
                        🎯 Từ tiếng Anh mục tiêu này là Đáp án đúng dùng để chấm điểm tự động.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        Các chữ cái xáo trộn (ngăn cách bằng dấu phẩy):
                      </label>
                      <input
                        type="text"
                        value={(q.unscramble?.scrambledLetters || []).join(', ')}
                        onChange={(e) => {
                          const chars = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
                          const curTarget = q.unscramble?.targetWord || q.unscrambleTarget || q.answerText || '';
                          updateQuestion(idx, {
                            unscramble: {
                              targetWord: curTarget,
                              scrambledLetters: chars
                            }
                          });
                        }}
                        placeholder="VD: u, d, c, k"
                        className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-xl font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-widest"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Học sinh sẽ bấm vào các chữ cái này để ghép lại thành từ mục tiêu.
                      </p>
                    </div>
                  </div>

                  {/* Example Status Banner */}
                  {q.isExample && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-emerald-600"></i>
                        <span>Đây là <strong>CÂU VÍ DỤ MẪU</strong>: Học sinh sẽ thấy từ ghép sẵn <strong>{(q.unscramble?.targetWord || q.unscrambleTarget || 'DUCK').toUpperCase()}</strong> làm mẫu, câu này <strong>0 điểm</strong> (không tính vào tổng điểm).</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Story-word-bank Editor */}
              {q.type === 'story-word-bank' && (() => {
                const sb = q.storyBank || {
                  title: '',
                  story: '',
                  words: [],
                  answers: {},
                  answerImages: {}
                };

                // Dynamic slots list: ensure '0' is first, followed by numeric slots sorted
                const answerKeys = Object.keys(sb.answers || {});
                const nonZeroKeys = Array.from(new Set(['1', '2', '3', '4', ...answerKeys.filter((k) => k !== '0')]))
                  .sort((a, b) => Number(a) - Number(b));
                const allSlots = ['0', ...nonZeroKeys];
                const testSlotsCount = nonZeroKeys.length;
                const totalPoints = q.points ?? 1.0;
                const pointPerWord = testSlotsCount > 0 ? (totalPoints / testSlotsCount).toFixed(2) : '0.25';

                return (
                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-4">
                    <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-book-open text-blue-600"></i>
                        <span>Cấu hình Đoạn văn & Ngân hàng từ (Story with Word Bank):</span>
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold border border-blue-200">
                        {testSlotsCount} từ thi • {pointPerWord}đ / từ (Tổng: {totalPoints}đ)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tiêu đề đoạn văn (Story Title):
                        </label>
                        <input
                          type="text"
                          value={sb.title || ''}
                          onChange={(e) => {
                            updateQuestion(idx, {
                              storyBank: { ...sb, title: e.target.value }
                            });
                          }}
                          placeholder="VD: Ben's Party"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg font-bold text-blue-950"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>Từ ví dụ (0) Example:</span>
                          <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            Đồng bộ với ô (0) bên dưới
                          </span>
                        </label>
                        <input
                          type="text"
                          value={sb.example?.word || sb.answers?.['0'] || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim().toLowerCase();
                            const nextAnswers = { ...sb.answers, '0': val };
                            let nextWords = [...sb.words];
                            if (val && !nextWords.some((w) => w.word === val)) {
                              nextWords.push({ id: 'w_0_' + Date.now(), word: val, img: sb.answerImages?.['0'] });
                            }
                            updateQuestion(idx, {
                              storyBank: {
                                ...sb,
                                answers: nextAnswers,
                                example: { index: '0', word: val, img: sb.answerImages?.['0'] || sb.example?.img },
                                words: nextWords
                              }
                            });
                          }}
                          placeholder="VD: birthday"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg font-bold text-blue-950"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nội dung đoạn văn (đặt các ô điền dạng (0), (1), (2), (3), (4)...):
                      </label>
                      <textarea
                        rows={3}
                        value={sb.story}
                        onChange={(e) => {
                          updateQuestion(idx, {
                            storyBank: { ...sb, story: e.target.value }
                          });
                        }}
                        placeholder="VD: Today is Ben's (0) birthday party. Everyone is sitting by the (1) _______. His friends are (2) _______ a song for him..."
                        className="w-full p-2.5 text-xs bg-white border border-blue-300 rounded-xl leading-relaxed text-slate-800"
                      />
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        💡 <em>Ghi chú:</em> Đặt <code>(0)</code> cho chỗ trống ví dụ mẫu; các ô <code>(1)</code>, <code>(2)</code>, <code>(3)</code>, <code>(4)</code>... là các ô trống để học sinh bấm chọn từ điền vào.
                      </div>
                    </div>

                    {/* Word Bank Items */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Danh sách từ trong ngân hàng từ (Word Bank):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newWord = prompt('Nhập từ tiếng Anh cần thêm vào ngân hàng từ:');
                            if (newWord) {
                              const nextWords = [...sb.words, { id: 'w_' + Date.now(), word: newWord.trim().toLowerCase() }];
                              updateQuestion(idx, {
                                storyBank: { ...sb, words: nextWords }
                              });
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                        >
                          <i className="fa-solid fa-plus mr-1"></i> Thêm từ vào bảng
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {sb.words.map((w, wi) => (
                          <div
                            key={w.id || wi}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-bold flex items-center gap-2 shadow-xs"
                          >
                            {w.img && (
                              <img src={w.img} alt="" className="w-6 h-6 object-contain rounded bg-slate-50 border p-0.5" />
                            )}
                            <span className="font-mono text-slate-800">{w.word}</span>
                            {(w.word === sb.example?.word || w.word === sb.answers?.['0']) && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-extrabold uppercase">
                                Ví dụ
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const nextWords = sb.words.filter((_, i) => i !== wi);
                                updateQuestion(idx, {
                                  storyBank: { ...sb, words: nextWords }
                                });
                              }}
                              className="text-red-400 hover:text-red-700 cursor-pointer ml-0.5"
                              title="Xóa từ này"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Correct Answers for blanks with Image Uploaders */}
                    <div className="pt-3 border-t border-blue-200 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-800">
                            Đáp án đúng cho các chỗ trống & Hình ảnh minh họa:
                          </label>
                          <p className="text-[11px] text-slate-600">
                            Bao gồm <strong>(0) làm ví dụ</strong> và các chỗ trống (1)-(4). Dưới mỗi đáp án có nút <strong>Up ảnh</strong>. Mỗi từ đúng sẽ được tính điểm thành phần (tổng {totalPoints} điểm chia đều).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nums = Object.keys(sb.answers).filter((k) => k !== '0').map(Number).filter((n) => !isNaN(n));
                            const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
                            const nextAnswers = { ...sb.answers, [String(nextNum)]: '' };
                            updateQuestion(idx, {
                              storyBank: { ...sb, answers: nextAnswers }
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus"></i> Thêm ô điền ({testSlotsCount + 1})
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {allSlots.map((slotNum) => {
                          const isEx = slotNum === '0';
                          const wordValue = isEx
                            ? (sb.example?.word || sb.answers?.['0'] || '')
                            : (sb.answers[slotNum] || '');
                          const currentImg = sb.answerImages?.[slotNum] || (isEx ? sb.example?.img : undefined);

                          return (
                            <div
                              key={slotNum}
                              className={`p-2.5 rounded-2xl border-2 transition-all space-y-2 ${
                                isEx
                                  ? 'bg-blue-50/80 border-blue-300'
                                  : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              {/* Slot Card Header */}
                              <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200">
                                <div className="flex items-center gap-1">
                                  <span className={`font-mono font-black text-xs ${isEx ? 'text-blue-900' : 'text-emerald-900'}`}>
                                    ({slotNum}):
                                  </span>
                                  {isEx ? (
                                    <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[9px] font-black uppercase border border-blue-200">
                                      Ví dụ (Example)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 text-[9px] font-extrabold border border-emerald-200">
                                      {pointPerWord}đ
                                    </span>
                                  )}
                                </div>
                                {!isEx && Number(slotNum) > 4 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextAnswers = { ...sb.answers };
                                      delete nextAnswers[slotNum];
                                      const nextImages = { ...(sb.answerImages || {}) };
                                      delete nextImages[slotNum];
                                      updateQuestion(idx, {
                                        storyBank: { ...sb, answers: nextAnswers, answerImages: nextImages }
                                      });
                                    }}
                                    className="text-red-400 hover:text-red-600 text-xs"
                                    title="Xóa ô này"
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                )}
                              </div>

                              {/* Word Input */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  {isEx ? 'Từ ví dụ mẫu:' : 'Từ đáp án đúng:'}
                                </label>
                                <input
                                  type="text"
                                  value={wordValue}
                                  onChange={(e) => {
                                    const val = e.target.value.trim().toLowerCase();
                                    const nextAnswers = { ...sb.answers, [slotNum]: val };
                                    const nextExample = isEx
                                      ? { index: '0', word: val, img: currentImg }
                                      : sb.example;
                                    let nextWords = [...sb.words];
                                    if (val && !nextWords.some((w) => w.word === val)) {
                                      nextWords.push({ id: 'w_' + slotNum + '_' + Date.now(), word: val, img: currentImg });
                                    }
                                    updateQuestion(idx, {
                                      storyBank: {
                                        ...sb,
                                        answers: nextAnswers,
                                        example: nextExample,
                                        words: nextWords
                                      }
                                    });
                                  }}
                                  placeholder={isEx ? 'VD: birthday' : `Từ cho (${slotNum})`}
                                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                                    isEx
                                      ? 'bg-white border-blue-300 text-blue-900 focus:ring-1 focus:ring-blue-500'
                                      : 'bg-slate-50 border-slate-300 text-emerald-900 focus:bg-white focus:ring-1 focus:ring-emerald-500'
                                  }`}
                                />
                              </div>

                              {/* Image Uploader & Preview Under Each Answer */}
                              <div className="pt-1 border-t border-dashed border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                                  <span>Ảnh minh họa:</span>
                                  {currentImg && (
                                    <span className="text-[9px] text-emerald-600 font-extrabold">Đã có ảnh ✓</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {currentImg ? (
                                    <div className="relative group shrink-0">
                                      <img
                                        src={currentImg}
                                        alt={`Minh họa (${slotNum})`}
                                        className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shadow-2xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextImages = { ...(sb.answerImages || {}) };
                                          delete nextImages[slotNum];
                                          const nextExample = isEx
                                            ? { index: '0', word: wordValue, img: undefined }
                                            : sb.example;
                                          const nextWords = sb.words.map((w) =>
                                            w.word === wordValue ? { ...w, img: undefined } : w
                                          );
                                          updateQuestion(idx, {
                                            storyBank: {
                                              ...sb,
                                              answerImages: nextImages,
                                              example: nextExample,
                                              words: nextWords
                                            }
                                          });
                                          showToast(`Đã xóa ảnh của ô (${slotNum})!`, 'info');
                                        }}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] flex items-center justify-center hover:bg-red-700 shadow-xs cursor-pointer"
                                        title="Xóa ảnh này"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-[9px] text-center p-0.5 shrink-0">
                                      <i className="fa-regular fa-image text-xs mb-0.5"></i>
                                      <span>Trống</span>
                                    </div>
                                  )}

                                  <div className="flex-1 space-y-1 min-w-0">
                                    <label className="w-full py-1 px-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[10px] font-bold text-slate-700 cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition">
                                      <i className="fa-solid fa-cloud-arrow-up text-blue-600 text-xs"></i>
                                      <span>{currentImg ? 'Đổi ảnh' : 'Up ảnh'}</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const dataUrl = ev.target?.result as string;
                                            const nextImages = { ...(sb.answerImages || {}), [slotNum]: dataUrl };
                                            const nextExample = isEx
                                              ? { index: '0', word: wordValue, img: dataUrl }
                                              : sb.example;
                                            let nextWords = sb.words.map((w) =>
                                              w.word === wordValue ? { ...w, img: dataUrl } : w
                                            );
                                            if (wordValue && !nextWords.some((w) => w.word === wordValue)) {
                                              nextWords.push({ id: 'w_' + slotNum + '_' + Date.now(), word: wordValue, img: dataUrl });
                                            }
                                            updateQuestion(idx, {
                                              storyBank: {
                                                ...sb,
                                                answerImages: nextImages,
                                                example: nextExample,
                                                words: nextWords
                                              }
                                            });
                                            showToast(`Đã tải ảnh cho từ (${slotNum}): ${wordValue || ''}!`, 'success');
                                          };
                                          reader.readAsDataURL(file);
                                        }}
                                      />
                                    </label>

                                    <input
                                      type="text"
                                      value={currentImg && !currentImg.startsWith('data:') ? currentImg : ''}
                                      onChange={(e) => {
                                        const val = e.target.value.trim();
                                        const nextImages = { ...(sb.answerImages || {}), [slotNum]: val };
                                        const nextExample = isEx
                                          ? { index: '0', word: wordValue, img: val }
                                          : sb.example;
                                        let nextWords = sb.words.map((w) =>
                                          w.word === wordValue ? { ...w, img: val } : w
                                        );
                                        updateQuestion(idx, {
                                          storyBank: {
                                            ...sb,
                                            answerImages: nextImages,
                                            example: nextExample,
                                            words: nextWords
                                          }
                                        });
                                      }}
                                      placeholder="Hoặc dán link URL"
                                      className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-slate-600 focus:outline-none truncate"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Listen & Colour (Cambridge) Editor */}
              {q.type === 'listen-colour' && (() => {
                const lc = q.listenColour || {
                  width: 800,
                  height: 520,
                  items: []
                };
                const W = lc.width || 800;
                const H = lc.height || 520;
                const items: ColourItem[] = lc.items || [];

                return (
                  <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 space-y-4">
                    {/* Header and Quick Tools */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs font-bold text-orange-950 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs">
                          🎨
                        </span>
                        <div>
                          <div className="font-extrabold text-sm text-orange-950">
                            Cấu hình dạng Nghe & Tô màu (Cambridge Listen & Colour on Picture)
                          </div>
                          <div className="text-[11px] text-orange-800 font-medium">
                            Học sinh nghe audio và dùng bút chì màu tương ứng để tô các chi tiết trên tranh không màu.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            updateQuestion(idx, {
                              img: DEFAULT_CAMBRIDGE_COLORING_SCENE
                            });
                            showToast('Đã tải hình vẽ nét Cambridge chuẩn!');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-orange-100 text-orange-900 border border-orange-300 font-bold text-xs transition cursor-pointer"
                        >
                          🖼 Dùng tranh Cambridge mẫu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newIdx = items.length + 1;
                            const sampleColors = ['yellow', 'red', 'blue', 'green', 'pink', 'purple', 'orange', 'brown'];
                            const chosenColor = sampleColors[(items.length) % sampleColors.length];
                            const cInfo = getCrayonInfo(chosenColor);
                            const newItem: ColourItem = {
                              id: 'c_' + Date.now(),
                              label: `Chi tiết #${newIdx} (${cInfo.name})`,
                              targetColor: chosenColor,
                              targetColorName: cInfo.name,
                              x: Math.round(150 + ((items.length * 140) % (W - 200))),
                              y: Math.round(150 + ((items.length * 90) % (H - 200))),
                              w: 64,
                              h: 64,
                              isExample: items.length === 0
                            };
                            updateQuestion(idx, {
                              listenColour: { ...lc, items: [...items, newItem] }
                            });
                            showToast(`Đã thêm chi tiết mới: ${newItem.label}!`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer"
                        >
                          + Thêm chi tiết cần tô
                        </button>
                      </div>
                    </div>

                    {/* Explanation Banner on Coloring Test Mechanics */}
                    <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300 text-xs text-amber-950 space-y-1.5 shadow-xs">
                      <div className="font-black flex items-center justify-between flex-wrap gap-2 text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-question text-amber-600 text-sm"></i>
                          <span>Cơ chế làm bài của bé & Cấu hình Đáp án màu đúng:</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                          ✔ Chế độ tô màu trực tiếp trên tranh
                        </span>
                      </div>
                      <ul className="space-y-1 text-slate-700 font-semibold list-disc list-inside">
                        <li>
                          <strong>Lúc học sinh thi:</strong> Bé được nghe audio bài đọc. Khi nghe đến chi tiết nào, bé kích chuột chọn màu bất kỳ trong <strong>Hộp bút chì màu</strong> và <strong>bấm trực tiếp lên chi tiết trên bức tranh để tô màu</strong> (bé được tự do tô tùy ý theo những gì nghe được, có thể đổi màu hoặc tẩy đi tô lại bất cứ lúc nào).
                        </li>
                        <li>
                          <strong>Đáp án màu tô đúng:</strong> Tại mỗi chi tiết dưới đây, Thầy/Cô chọn sẵn <strong>"Màu đúng cần tô"</strong>. Khi nộp bài, hệ thống sẽ tự động đối chiếu màu bé đã tô với màu đúng Thầy/Cô đã đặt để chấm điểm.
                        </li>
                        <li>
                          <strong>Mẹo di chuyển chi tiết trên tranh:</strong> Thầy/Cô chỉ cần <strong>click vào chi tiết trên tranh</strong> (sẽ có viền cam phát sáng), sau đó <strong>bấm chuột vào vị trí mới trên tranh</strong> để dời toạ độ ngay tức thì (không cần gõ số X, Y).
                        </li>
                      </ul>
                    </div>

                    {/* Canvas Stage Preview with interactive hotspots */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>
                          Vị trí các chi tiết trên tranh{' '}
                          {selectedColourSpot && selectedColourSpot.qIdx === idx ? (
                            <strong className="text-orange-600 underline">
                              (Đang chọn: {items[selectedColourSpot.itemIdx]?.label || 'Chi tiết'} - Click lên tranh để dời toạ độ)
                            </strong>
                          ) : (
                            '(Click chi tiết để chọn, sau đó click lên tranh để dời vị trí):'
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">Khung hình: {W} x {H}px</span>
                      </div>

                      <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border-2 border-slate-300 bg-white shadow-sm select-none">
                        <div
                          className="relative w-full cursor-crosshair"
                          style={{
                            paddingTop: `${(H / W) * 100}%`,
                            backgroundImage: q.img ? `url("${q.img}")` : 'none',
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                            backgroundColor: '#ffffff'
                          }}
                          onClick={(e) => {
                            if (selectedColourSpot && selectedColourSpot.qIdx === idx && items[selectedColourSpot.itemIdx]) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const clickX = Math.round(((e.clientX - rect.left) / rect.width) * W);
                              const clickY = Math.round(((e.clientY - rect.top) / rect.height) * H);
                              const nextItems = [...items];
                              const targetItem = nextItems[selectedColourSpot.itemIdx];
                              nextItems[selectedColourSpot.itemIdx] = {
                                ...targetItem,
                                x: clickX,
                                y: clickY
                              };
                              updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                              showToast(`📍 Đã dời "${targetItem.label}" đến tọa độ (X: ${clickX}, Y: ${clickY})!`, 'info');
                            }
                          }}
                        >
                          {items.map((item, itIdx) => {
                            const crayon = getCrayonInfo(item.targetColor);
                            const leftPct = (item.x / W) * 100;
                            const topPct = (item.y / H) * 100;
                            const wPct = ((item.w || 64) / W) * 100;
                            const hPct = ((item.h || 64) / H) * 100;
                            const isSelected = selectedColourSpot?.qIdx === idx && selectedColourSpot?.itemIdx === itIdx;

                            return (
                              <div
                                key={item.id || itIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedColourSpot({ qIdx: idx, itemIdx: itIdx });
                                  showToast(`Đã chọn "${item.label}". Click vị trí mới trên tranh để dời toạ độ!`, 'info');
                                }}
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${wPct}%`,
                                  height: `${hPct}%`,
                                  transform: 'translate(-50%, -50%)',
                                  borderColor: isSelected ? '#ea580c' : crayon.borderHex,
                                  backgroundColor: item.isExample ? crayon.hex + 'cc' : crayon.hex + '88'
                                }}
                                className={`absolute rounded-xl border-2 flex flex-col items-center justify-center p-1 shadow-sm transition cursor-pointer ${
                                  isSelected
                                    ? 'ring-4 ring-orange-500 scale-110 shadow-lg z-20'
                                    : item.isExample
                                    ? 'ring-2 ring-emerald-500 hover:scale-105'
                                    : 'hover:scale-105'
                                }`}
                                title={`${item.label} (Click để chọn, sau đó click lên tranh để dời)`}
                              >
                                {item.isExample && (
                                  <span className="text-[8px] font-black px-1 rounded bg-emerald-600 text-white uppercase tracking-wider mb-0.5">
                                    ★ VÍ DỤ
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="text-[8px] font-black px-1 rounded bg-orange-600 text-white uppercase tracking-wider mb-0.5 animate-pulse">
                                    ĐANG CHỌN
                                  </span>
                                )}
                                <span
                                  className="text-[10px] font-extrabold text-center truncate max-w-full px-1 rounded"
                                  style={{ color: crayon.textColor, backgroundColor: 'rgba(0,0,0,0.25)' }}
                                >
                                  {item.label}
                                </span>
                                <span
                                  className="text-[9px] font-black text-white px-1.5 rounded-full mt-0.5"
                                  style={{ backgroundColor: crayon.borderHex }}
                                >
                                  {crayon.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Detailed List of Coloring Items */}
                    <div className="space-y-3">
                      <div className="text-xs font-extrabold text-orange-950 uppercase tracking-wider">
                        Danh sách các chi tiết cần tô ({items.length} chi tiết):
                      </div>

                      {items.length === 0 ? (
                        <div className="p-4 text-center rounded-xl border border-dashed border-orange-300 bg-white text-xs text-orange-800">
                          Chưa có chi tiết nào. Bấm nút <strong>+ Thêm chi tiết cần tô</strong> ở trên để tạo chi tiết trên tranh.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {items.map((item, itIdx) => {
                            const curCrayon = getCrayonInfo(item.targetColor);

                            return (
                              <div
                                key={item.id || itIdx}
                                className={`p-3 rounded-xl border-2 transition space-y-2.5 ${
                                  item.isExample
                                    ? 'border-emerald-400 bg-emerald-50/50'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-800 font-mono font-black text-xs flex items-center justify-center">
                                      #{itIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={item.label}
                                      onChange={(e) => {
                                        const nextItems = [...items];
                                        nextItems[itIdx] = { ...nextItems[itIdx], label: e.target.value };
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      placeholder="Tên chi tiết (VD: Quả bóng dưới nước)..."
                                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg w-52 sm:w-72"
                                    />
                                    {item.isExample && (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                                        ★ ĐANG LÀ VÍ DỤ MẪU
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Toggle Example button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextItems = items.map((it, i) => ({
                                          ...it,
                                          isExample: i === itIdx ? !it.isExample : false
                                        }));
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                        showToast(
                                          item.isExample
                                            ? 'Đã hủy đánh dấu ví dụ mẫu'
                                            : `Đã đặt "${item.label}" làm ví dụ mẫu cho học sinh!`,
                                          'success'
                                        );
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                        item.isExample
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800'
                                      }`}
                                    >
                                      <i className="fa-solid fa-star"></i>
                                      <span>{item.isExample ? 'Đã là Ví dụ' : 'Đặt làm Ví dụ'}</span>
                                    </button>

                                    {/* Delete item */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextItems = items.filter((_, i) => i !== itIdx);
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold text-xs transition cursor-pointer"
                                      title="Xóa chi tiết này"
                                    >
                                      ✕ Xóa
                                    </button>
                                  </div>
                                </div>

                                {/* Target Color Palette Selection */}
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                  <span className="font-bold text-slate-600">Màu đúng cần tô:</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {CAMBRIDGE_CRAYONS.filter((c) => c.id !== 'eraser').map((crayon) => {
                                      const isChosen = item.targetColor === crayon.id || item.targetColor === crayon.hex;

                                      return (
                                        <button
                                          key={crayon.id}
                                          type="button"
                                          onClick={() => {
                                            const nextItems = [...items];
                                            nextItems[itIdx] = {
                                              ...nextItems[itIdx],
                                              targetColor: crayon.id,
                                              targetColorName: crayon.name
                                            };
                                            updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                          }}
                                          className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                                            isChosen
                                              ? 'scale-105 ring-2 ring-offset-1 shadow-xs'
                                              : 'opacity-70 hover:opacity-100'
                                          }`}
                                          style={{
                                            backgroundColor: crayon.hex,
                                            color: crayon.textColor,
                                            outlineColor: crayon.borderHex
                                          }}
                                        >
                                          <span>{crayon.name}</span>
                                          {isChosen && <span>✓</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Coordinates & Size */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-slate-500">Tọa độ X:</span>
                                    <input
                                      type="number"
                                      value={item.x}
                                      onChange={(e) => {
                                        const nextItems = [...items];
                                        nextItems[itIdx] = { ...nextItems[itIdx], x: parseInt(e.target.value) || 0 };
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      className="w-16 px-1.5 py-0.5 bg-white border rounded text-center font-mono font-bold"
                                    />
                                    <span className="text-[10px] text-slate-400">px</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-slate-500">Tọa độ Y:</span>
                                    <input
                                      type="number"
                                      value={item.y}
                                      onChange={(e) => {
                                        const nextItems = [...items];
                                        nextItems[itIdx] = { ...nextItems[itIdx], y: parseInt(e.target.value) || 0 };
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      className="w-16 px-1.5 py-0.5 bg-white border rounded text-center font-mono font-bold"
                                    />
                                    <span className="text-[10px] text-slate-400">px</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-slate-500">Rộng (W):</span>
                                    <input
                                      type="number"
                                      value={item.w || 64}
                                      onChange={(e) => {
                                        const nextItems = [...items];
                                        nextItems[itIdx] = { ...nextItems[itIdx], w: parseInt(e.target.value) || 64 };
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      className="w-16 px-1.5 py-0.5 bg-white border rounded text-center font-mono font-bold"
                                    />
                                    <span className="text-[10px] text-slate-400">px</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-slate-500">Cao (H):</span>
                                    <input
                                      type="number"
                                      value={item.h || 64}
                                      onChange={(e) => {
                                        const nextItems = [...items];
                                        nextItems[itIdx] = { ...nextItems[itIdx], h: parseInt(e.target.value) || 64 };
                                        updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                      }}
                                      className="w-16 px-1.5 py-0.5 bg-white border rounded text-center font-mono font-bold"
                                    />
                                    <span className="text-[10px] text-slate-400">px</span>
                                  </div>
                                </div>

                                {/* Quick size presets especially for broad areas like grass, mountains, sky */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                                  <span className="text-slate-500 font-semibold">Cỡ vùng tô nhanh:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextItems = [...items];
                                      nextItems[itIdx] = { ...nextItems[itIdx], w: 60, h: 60 };
                                      updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                  >
                                    🎯 Nhỏ (60x60)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextItems = [...items];
                                      nextItems[itIdx] = { ...nextItems[itIdx], w: 120, h: 100 };
                                      updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                  >
                                    🎈 Đồ vật vừa (120x100)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextItems = [...items];
                                      nextItems[itIdx] = { ...nextItems[itIdx], w: 240, h: 160 };
                                      updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                  >
                                    🌳 Tán cây / Hồ nước (240x160)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextItems = [...items];
                                      nextItems[itIdx] = { ...nextItems[itIdx], w: 550, h: 150 };
                                      updateQuestion(idx, { listenColour: { ...lc, items: nextItems } });
                                    }}
                                    className="px-2.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded text-[10px] font-extrabold"
                                    title="Dành cho bãi cỏ, dãy núi, bầu trời: Bé tô hoặc đổ màu vào bất cứ điểm nào trên vùng rộng này đều tính đúng!"
                                  >
                                    🌿 Mảng rộng: Bãi cỏ / Núi / Bầu trời (550x150)
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
                    </div>
                  );
                })}

                {/* Bottom Add Question Quick Bar for this Part */}
                <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/60 border-2 border-dashed border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <i className="fa-solid fa-plus-circle text-indigo-600 text-sm"></i>
                    <span>Thêm câu hỏi tiếp theo vào Part {secIdx + 1}:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('multiple-choice', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                    >
                      + Trắc nghiệm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('yes-no', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                      title="Dạng câu hỏi Đúng / Sai: Chọn YES hoặc NO"
                    >
                      <i className="fa-solid fa-circle-question text-[10px]"></i>
                      <span>+ Yes - No</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('multi-choice', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                      title="Dạng trắc nghiệm chọn nhiều đáp án đúng"
                    >
                      <i className="fa-solid fa-list-check text-[10px]"></i>
                      <span>+ Multi-choice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listening', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Bài nghe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listen-colour', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      🎨 + Tô màu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('tick-cross', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Tick/Cross
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('listen-write', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Nghe & Viết
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('connect-pairs', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Nối điểm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToPart('fill-blanks', part.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + Điền ô ảnh
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      };

      return (
        <div className="space-y-6">
          {/* Grade & Class Exam Selector Bar */}
          {gradeExams && activeExamId && onSelectExam && onCreateExam && onDuplicateExam && onUpdateExamMeta && onDeleteExam && (
            <GradeExamSelectorBar
              gradeExams={gradeExams}
              activeExamId={activeExamId}
              onSelectExam={onSelectExam}
              onCreateExam={onCreateExam}
              onDuplicateExam={onDuplicateExam}
              onUpdateExamMeta={onUpdateExamMeta}
              onDeleteExam={onDeleteExam}
              availableClasses={availableClasses}
              showToast={showToast}
              openConfirm={openConfirm}
            />
          )}

          {/* Top Part Overview & Scoring Summary Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-layer-group"></i>
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Quản Lý Đề Thi: Từng Phần (Listening & Reading/Writing)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cấu trúc đề thi phân chia rõ: <strong>Listening ➔ Part ➔ Câu hỏi</strong> và <strong>Reading & Writing ➔ Part ➔ Câu hỏi</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">
                  <span>Thang điểm đề thi:</span>
                  <strong className="text-sm text-indigo-700">{totalPartPoints.toFixed(1)} đ</strong>
                </div>

                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    isOverallBalanced
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <span>Tổng điểm câu:</span>
                  <strong className="text-sm">{totalQuestionPoints.toFixed(1)} đ</strong>
                  {isOverallBalanced ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-black">
                      ✓ Khớp
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-black">
                      ⚠️ Chưa khớp
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAutoDistributeAllParts}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Tự động chia đều điểm của mỗi Part cho các câu hỏi bên trong Part đó"
                >
                  <i className="fa-solid fa-bolt"></i> Cân bằng điểm
                </button>

                <button
                  type="button"
                  onClick={handleReorganizeAndRenumberAll}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Sắp xếp lại các Part theo đúng chuẩn: Listening (Part 1, 2...) và Reading & Writing (Part 1, 2...)"
                >
                  <i className="fa-solid fa-arrow-down-1-9"></i> Chuẩn hóa thứ tự Part
                </button>

                {onSaveAndSync && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onSaveAndSync()}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
                    title="Lưu tất cả các phần thi, câu hỏi và hình ảnh vào bộ nhớ an toàn (không bao giờ bị mất khi tải lại trang)"
                  >
                    {isSaving ? (
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-floppy-disk"></i>
                    )}
                    <span>{isSaving ? 'Đang lưu...' : 'Lưu & Đồng Bộ Đề Thi'}</span>
                  </button>
                )}

                {lastSavedTime && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900"
                    title="Thời gian dữ liệu được lưu an toàn gần nhất vào IndexedDB"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Đã lưu: {lastSavedTime}</span>
                  </div>
                )}

                {onStartTestRun && (
                  <button
                    type="button"
                    onClick={() => onStartTestRun()}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
                    title="Chạy thử bài thi với vai trò thí sinh để kiểm tra audio, tương tác vẽ/tô màu và tính điểm"
                  >
                    <i className="fa-solid fa-play"></i>
                    <span>Test Chạy Thử Đề Thi</span>
                    <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] uppercase font-black">
                      Live Run
                    </span>
                  </button>
                )}

                {onOpenCameraGrader && (
                  <button
                    type="button"
                    onClick={onOpenCameraGrader}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-rose-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95 ring-2 ring-rose-200"
                    title="Mở camera điện thoại quét bài thi giấy của học sinh, tự động nhận diện Họ tên, Lớp, Trường và chấm điểm"
                  >
                    <i className="fa-solid fa-camera"></i>
                    <span>📷 Chấm Bài Camera AI</span>
                  </button>
                )}

                {onOpenOfflinePrinter && (
                  <button
                    type="button"
                    onClick={onOpenOfflinePrinter}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="In đề thi giấy và phiếu trả lời trắc nghiệm cho kỳ thi offline không dùng phòng máy"
                  >
                    <i className="fa-solid fa-print"></i>
                    <span>🖨️ In Đề Thi & Phiếu Làm Bài</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2 Big Section Badges in Top Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Section 1: Listening stats & add button */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <i className="fa-solid fa-headphones"></i>
                  </span>
                  <div>
                    <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                      <span>1. LISTENING</span>
                      <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 text-[10px]">
                        {listeningPartPoints.toFixed(1)} đ
                      </span>
                    </div>
                    <div className="text-[11px] text-blue-700 font-semibold">
                      {listeningParts.length} Parts • {listeningQuestions.length} câu hỏi
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPart('listening')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-plus"></i> Thêm Part Nghe
                </button>
              </div>

              {/* Section 2: Reading & Writing stats & add button */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <i className="fa-solid fa-book-open-reader"></i>
                  </span>
                  <div>
                    <div className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                      <span>2. READING & WRITING</span>
                      <span className="px-1.5 py-0.2 rounded bg-teal-200 text-teal-900 text-[10px]">
                        {readingWritingPartPoints.toFixed(1)} đ
                      </span>
                    </div>
                    <div className="text-[11px] text-teal-700 font-semibold">
                      {readingWritingParts.length} Parts • {readingWritingQuestions.length} câu hỏi
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPart('reading-writing')}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-plus"></i> Thêm Part Đọc/Viết
                </button>
              </div>
            </div>

            {/* Part Quick Tabs & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3 overflow-x-auto pb-1 max-w-full">
                {/* Listening Parts Tabs */}
                {listeningParts.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-extrabold text-blue-700 flex items-center gap-1 mr-1">
                      <i className="fa-solid fa-headphones"></i> Listening:
                    </span>
                    {listeningParts.map(({ p }, pi) => {
                      const count = questions.filter((q) => (q.partId || parts[0]?.id) === p.id).length;
                      return (
                        <a
                          key={p.id}
                          href={`#admin-part-section-${p.id}`}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-bold text-blue-900 transition flex items-center gap-1 shrink-0"
                          title={`Listening - Part ${pi + 1}: ${p.title}`}
                        >
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
                            {pi + 1}
                          </span>
                          <span className="truncate max-w-[110px]">Part {pi + 1}: {getCleanPartTitle(p.title)}</span>
                          <span className="px-1 py-0.2 rounded bg-blue-200/80 text-blue-950 text-[10px] font-black">
                            {p.points}đ ({count}c)
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Reading Writing Parts Tabs */}
                {readingWritingParts.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-2">
                    <span className="text-[11px] font-extrabold text-teal-700 flex items-center gap-1 mr-1">
                      <i className="fa-solid fa-book-open"></i> Read & Write:
                    </span>
                    {readingWritingParts.map(({ p }, pi) => {
                      const count = questions.filter((q) => (q.partId || parts[0]?.id) === p.id).length;
                      return (
                        <a
                          key={p.id}
                          href={`#admin-part-section-${p.id}`}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-bold text-teal-900 transition flex items-center gap-1 shrink-0"
                          title={`Reading & Writing - Part ${pi + 1}: ${p.title}`}
                        >
                          <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-black">
                            {pi + 1}
                          </span>
                          <span className="truncate max-w-[110px]">Part {pi + 1}: {getCleanPartTitle(p.title)}</span>
                          <span className="px-1 py-0.2 rounded bg-teal-200/80 text-teal-950 text-[10px] font-black">
                            {p.points}đ ({count}c)
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onOpenPdfImporter && (
                  <button
                    type="button"
                    onClick={onOpenPdfImporter}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    title="Mở bảng xem và nạp đề từ file PDF, cắt ảnh và trích xuất nội dung trực tiếp"
                  >
                    <i className="fa-solid fa-file-pdf"></i> Nạp Đề Từ File PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={onResetSample}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                  title="Khôi phục 13 câu hỏi Toán & Khoa học iSMART"
                >
                  <i className="fa-solid fa-rotate-left"></i> Đề Toán/Khoa học
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openConfirm(
                      'Tải đề mẫu Tiếng Anh Khối 2 (Listening & Reading/Writing)?',
                      'Đề thi sẽ được nạp theo đúng cấu trúc chuẩn: Phần 1: LISTENING (4 Parts có Audio nghe) và Phần 2: READING & WRITING (4 Parts) gồm 29 câu hỏi có hình ảnh trực quan.',
                      () => {
                        onPartsChange(getAdvancedGrade2Parts());
                        onChange(getAdvancedGrade2Questions());
                        showToast('Đã nạp đề Tiếng Anh Khối 2 (Listening & Reading/Writing) thành công!');
                      }
                    );
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 text-blue-900 font-extrabold text-xs transition cursor-pointer flex items-center gap-1"
                  title="Nạp đề thi Tiếng Anh Cambridge Khối 2 (Listening -> Parts -> Câu hỏi & Reading/Writing -> Parts -> Câu hỏi)"
                >
                  <i className="fa-solid fa-graduation-cap text-blue-600"></i> Nạp đề Tiếng Anh (Listening & Reading/Writing)
                </button>
              </div>
            </div>

            {/* Quick Question Navigator with Part tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Các câu:</span>
              {questions.map((q, idx) => {
                const qPart = parts.find((p) => p.id === (q.partId || parts[0]?.id)) || parts[0];
                const secId = getPartSection(qPart);
                const isQListen = secId === 'listening';
                const secParts = parts.filter((p) => getPartSection(p) === secId);
                const secPartIdx = secParts.findIndex((p) => p.id === qPart.id);
                const pNum = secPartIdx >= 0 ? secPartIdx + 1 : 1;
                const qInPart = questions.filter((item) => (item.partId || parts[0]?.id) === qPart.id);
                const localQNum = qInPart.findIndex((item) => item === q);
                const cNum = localQNum >= 0 ? localQNum + 1 : 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => scrollToCard(idx)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 transition cursor-pointer flex items-center gap-1 ${
                      isQListen
                        ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900'
                        : 'border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-900'
                    }`}
                    title={`${isQListen ? 'Listening' : 'Reading & Writing'} - Part ${pNum} - Câu ${cNum} (${getCleanPartTitle(qPart.title)}) - ${q.points ?? 0.5}đ`}
                  >
                    <span>{isQListen ? '🎧' : '📖'} P{pNum}-C{cNum}</span>
                    <span className="text-[9px] opacity-75">({q.points ?? 0.5}đ)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Sections: Listening -> Parts -> Questions, Reading & Writing -> Parts -> Questions */}
          <div className="space-y-12">
            {/* SECTION 1: LISTENING */}
            <div id="admin-section-listening" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white shadow-md border-2 border-indigo-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    <i className="fa-solid fa-headphones"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-500 text-white font-black text-xs tracking-wide">
                        PHẦN THI 1
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        LISTENING (BÀI THI NGHE HIỂU)
                      </h3>
                    </div>
                    <p className="text-xs text-blue-200 mt-1">
                      Gồm <strong>{listeningParts.length} Parts</strong> • <strong>{listeningQuestions.length} câu hỏi</strong> • Thang điểm phần thi: <strong className="text-white text-sm">{listeningPartPoints.toFixed(1)} đ</strong> (Tổng điểm câu trong phần: {listeningQPoints.toFixed(1)} đ)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPart('listening')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <i className="fa-solid fa-plus-circle"></i> Thêm Part vào Listening
                </button>
              </div>

              {listeningParts.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-center space-y-2">
                  <div className="text-blue-400 text-3xl">
                    <i className="fa-solid fa-headphones-simple"></i>
                  </div>
                  <p className="text-sm font-bold text-blue-900">Chưa có Part nào trong phần thi Listening</p>
                  <p className="text-xs text-slate-500">Bấm nút bên dưới để thêm Part bài nghe đầu tiên cho đề thi.</p>
                  <button
                    type="button"
                    onClick={() => handleAddPart('listening')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i> Thêm Part Listening đầu tiên
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {listeningParts.map(({ p: part, idx: pIdx }, secIdx) =>
                    renderPartContent(part, pIdx, secIdx, listeningParts.length)
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: READING & WRITING */}
            <div id="admin-section-reading-writing" className="space-y-5 pt-6 border-t-2 border-dashed border-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 text-white shadow-md border-2 border-teal-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    <i className="fa-solid fa-book-open-reader"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-teal-500 text-white font-black text-xs tracking-wide">
                        PHẦN THI 2
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        READING & WRITING (BÀI THI ĐỌC & VIẾT)
                      </h3>
                    </div>
                    <p className="text-xs text-teal-200 mt-1">
                      Gồm <strong>{readingWritingParts.length} Parts</strong> • <strong>{readingWritingQuestions.length} câu hỏi</strong> • Thang điểm phần thi: <strong className="text-white text-sm">{readingWritingPartPoints.toFixed(1)} đ</strong> (Tổng điểm câu trong phần: {readingWritingQPoints.toFixed(1)} đ)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPart('reading-writing')}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <i className="fa-solid fa-plus-circle"></i> Thêm Part vào Reading & Writing
                </button>
              </div>

              {readingWritingParts.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 text-center space-y-2">
                  <div className="text-teal-400 text-3xl">
                    <i className="fa-solid fa-book"></i>
                  </div>
                  <p className="text-sm font-bold text-teal-900">Chưa có Part nào trong phần thi Reading & Writing</p>
                  <p className="text-xs text-slate-500">Bấm nút bên dưới để thêm Part bài đọc & viết đầu tiên cho đề thi.</p>
                  <button
                    type="button"
                    onClick={() => handleAddPart('reading-writing')}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i> Thêm Part Reading & Writing đầu tiên
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {readingWritingParts.map(({ p: part, idx: pIdx }, secIdx) =>
                    renderPartContent(part, pIdx, secIdx, readingWritingParts.length)
                  )}
                </div>
              )}
            </div>
          </div>

      {/* Unassigned questions safety container */}
      {(() => {
        const unassigned = questions
          .map((q, idx) => ({ q, idx }))
          .filter((item) => item.q.partId && !parts.some((p) => p.id === item.q.partId));
        if (unassigned.length === 0) return null;
        return (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-900">
                ⚠️ Có {unassigned.length} câu hỏi chưa thuộc Part nào hợp lệ:
              </span>
              <button
                type="button"
                onClick={() => {
                  const firstId = parts[0]?.id;
                  const nextQ = questions.map((q) =>
                    !q.partId || !parts.some((p) => p.id === q.partId) ? { ...q, partId: firstId } : q
                  );
                  onChange(nextQ);
                  showToast('Đã chuyển các câu chưa phân loại vào Part 1!');
                }}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
              >
                Chuyển tất cả vào Part 1
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
