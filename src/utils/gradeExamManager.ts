import { GradeExamProfile, ExamPart, Question, Student } from '../types';
import { getAdvancedGrade2Parts, getAdvancedGrade2Questions } from '../advancedGrade2Data';
import { getInitialParts, getInitialQuestions } from '../demoData';

export const STANDARD_GRADES = ['Khối 1', 'Khối 2', 'Khối 3', 'Khối 4', 'Khối 5'];

export function createGrade1SampleExam(): { parts: ExamPart[]; questions: Question[] } {
  const parts: ExamPart[] = [
    {
      id: 'g1-part-1',
      section: 'listening',
      title: 'Part 1: Listen and choose the correct picture',
      instructions: 'Lắng nghe từ vựng và chọn bức tranh đúng.',
      points: 5.0,
      audio: 'tts:Part 1. Listen and choose the correct picture.',
      maxPlayCount: 2
    },
    {
      id: 'g1-part-2',
      section: 'reading-writing',
      title: 'Part 2: Look and tick (✔) or cross (✘)',
      instructions: 'Quan sát tranh và câu mô tả. Đánh dấu tick nếu đúng, cross nếu sai.',
      points: 5.0
    }
  ];

  const questions: Question[] = [
    {
      id: 'g1-q1',
      partId: 'g1-part-1',
      points: 2.5,
      q: 'Listen: Which animal is this?',
      audio: 'tts:It is an apple. It is red and delicious.',
      type: 'multiple-choice',
      options: [
        { text: 'Apple (Quả táo)' },
        { text: 'Banana (Quả chuối)' },
        { text: 'Cat (Con mèo)' }
      ],
      correctIndex: 0
    },
    {
      id: 'g1-q2',
      partId: 'g1-part-1',
      points: 2.5,
      q: 'Listen: What color is mentioned?',
      audio: 'tts:Blue. The sky is blue.',
      type: 'multiple-choice',
      options: [
        { text: 'Red (Màu đỏ)' },
        { text: 'Blue (Màu xanh da trời)' },
        { text: 'Yellow (Màu vàng)' }
      ],
      correctIndex: 1
    },
    {
      id: 'g1-q3',
      partId: 'g1-part-2',
      points: 2.5,
      q: 'This is a dog.',
      type: 'tick-cross',
      isTick: true,
      options: [{ text: '✔' }, { text: '✘' }],
      correctIndex: 0
    },
    {
      id: 'g1-q4',
      partId: 'g1-part-2',
      points: 2.5,
      q: 'Is this a pen? (Yes / No)',
      type: 'yes-no',
      options: [{ text: 'Yes' }, { text: 'No' }],
      correctIndex: 0
    }
  ];

  return { parts, questions };
}

export function createGrade4SampleExam(): { parts: ExamPart[]; questions: Question[] } {
  const parts: ExamPart[] = [
    {
      id: 'g4-part-1',
      section: 'listening',
      title: 'Part 1: Listening Comprehension',
      instructions: 'Listen to the conversation and answer the questions.',
      points: 5.0,
      audio: 'tts:Part 1. Grade 4 Listening comprehension.',
      maxPlayCount: 2
    },
    {
      id: 'g4-part-2',
      section: 'reading-writing',
      title: 'Part 2: Reading & Grammar',
      instructions: 'Read and choose the best answers.',
      points: 5.0
    }
  ];

  const questions: Question[] = [
    {
      id: 'g4-q1',
      partId: 'g4-part-1',
      points: 2.5,
      q: 'Where did Tony go last weekend?',
      audio: 'tts:Last Saturday, Tony and his family went camping by the lake.',
      type: 'multiple-choice',
      options: [
        { text: 'To the cinema' },
        { text: 'Camping by the lake' },
        { text: 'At school' }
      ],
      correctIndex: 1
    },
    {
      id: 'g4-q2',
      partId: 'g4-part-1',
      points: 2.5,
      q: 'What was the weather like?',
      audio: 'tts:The sun was shining brightly and there was a gentle cool breeze.',
      type: 'multiple-choice',
      options: [
        { text: 'Rainy and cold' },
        { text: 'Sunny and pleasant' },
        { text: 'Snowy' }
      ],
      correctIndex: 1
    },
    {
      id: 'g4-q3',
      partId: 'g4-part-2',
      points: 2.5,
      q: 'She _____ to school by bicycle every morning.',
      type: 'multiple-choice',
      options: [
        { text: 'goes' },
        { text: 'go' },
        { text: 'going' }
      ],
      correctIndex: 0
    },
    {
      id: 'g4-q4',
      partId: 'g4-part-2',
      points: 2.5,
      q: 'Select the adjectives in the sentence: "The smart robot solved difficult puzzles."',
      type: 'multi-choice',
      options: [
        { text: 'smart' },
        { text: 'robot' },
        { text: 'difficult' },
        { text: 'puzzles' }
      ],
      correctIndices: [0, 2]
    }
  ];

  return { parts, questions };
}

export function createGrade5SampleExam(): { parts: ExamPart[]; questions: Question[] } {
  const parts: ExamPart[] = [
    {
      id: 'g5-part-1',
      section: 'listening',
      title: 'Part 1: Advanced Listening',
      instructions: 'Listen and complete the notes.',
      points: 5.0,
      audio: 'tts:Welcome to Grade 5 English Exam.',
      maxPlayCount: 2
    },
    {
      id: 'g5-part-2',
      section: 'reading-writing',
      title: 'Part 2: Reading & Vocabulary',
      instructions: 'Read and select the correct responses.',
      points: 5.0
    }
  ];

  const questions: Question[] = [
    {
      id: 'g5-q1',
      partId: 'g5-part-1',
      points: 2.5,
      q: 'What is the main topic of the presentation?',
      audio: 'tts:Today we are going to explore renewable energy sources like solar and wind power.',
      type: 'multiple-choice',
      options: [
        { text: 'Fossil fuels' },
        { text: 'Renewable energy' },
        { text: 'Ocean animals' }
      ],
      correctIndex: 1
    },
    {
      id: 'g5-q2',
      partId: 'g5-part-1',
      points: 2.5,
      q: 'Does wind turbine produce clean energy? (Yes / No)',
      type: 'yes-no',
      options: [{ text: 'Yes' }, { text: 'No' }],
      correctIndex: 0
    },
    {
      id: 'g5-q3',
      partId: 'g5-part-2',
      points: 2.5,
      q: 'If it _____ tomorrow, we will visit the science museum.',
      type: 'multiple-choice',
      options: [
        { text: 'rains' },
        { text: 'will rain' },
        { text: 'rained' }
      ],
      correctIndex: 0
    },
    {
      id: 'g5-q4',
      partId: 'g5-part-2',
      points: 2.5,
      q: 'Solar panels turn sunlight into electricity.',
      type: 'tick-cross',
      isTick: true,
      options: [{ text: '✔' }, { text: '✘' }],
      correctIndex: 0
    }
  ];

  return { parts, questions };
}

export function getDefaultGradeExams(): GradeExamProfile[] {
  const g1 = createGrade1SampleExam();
  const g4 = createGrade4SampleExam();
  const g5 = createGrade5SampleExam();

  return [
    {
      id: 'exam-grade-2',
      grade: 'Khối 2',
      className: 'Tất cả các lớp',
      title: 'Đề thi Tiếng Anh Cambridge Khối 2',
      description: 'Đề thi chuẩn Cambridge: Listening (4 Parts) và Reading & Writing (4 Parts) với đầy đủ âm thanh, tô màu và hình ảnh.',
      examMinutes: 20,
      parts: getAdvancedGrade2Parts(),
      questions: getAdvancedGrade2Questions(),
      updatedAt: new Date().toLocaleDateString('vi-VN')
    },
    {
      id: 'exam-grade-3',
      grade: 'Khối 3',
      className: 'Tất cả các lớp',
      title: 'Đề thi Toán & Khoa Học iSMART Khối 3',
      description: 'Bộ 13 câu hỏi Toán & Khoa học song ngữ Anh - Việt với đồng hồ, cân nặng, thể tích và hình học.',
      examMinutes: 15,
      parts: getInitialParts(),
      questions: getInitialQuestions(),
      updatedAt: new Date().toLocaleDateString('vi-VN')
    },
    {
      id: 'exam-grade-1',
      grade: 'Khối 1',
      className: 'Tất cả các lớp',
      title: 'Đề thi Tiếng Anh Khởi Động Khối 1',
      description: 'Đề thi nhận biết hình ảnh, từ vựng và câu hỏi cơ bản cho học sinh Khối 1.',
      examMinutes: 15,
      parts: g1.parts,
      questions: g1.questions,
      updatedAt: new Date().toLocaleDateString('vi-VN')
    },
    {
      id: 'exam-grade-4',
      grade: 'Khối 4',
      className: 'Tất cả các lớp',
      title: 'Đề thi Tiếng Anh Nâng Cao Khối 4',
      description: 'Nghe hiểu hội thoại và ngữ pháp trọng tâm Tiếng Anh Khối 4.',
      examMinutes: 20,
      parts: g4.parts,
      questions: g4.questions,
      updatedAt: new Date().toLocaleDateString('vi-VN')
    },
    {
      id: 'exam-grade-5',
      grade: 'Khối 5',
      className: 'Tất cả các lớp',
      title: 'Đề thi Tiếng Anh & Khoa Học Tổng Hợp Khối 5',
      description: 'Đề thi toàn diện kỹ năng nghe, đọc hiểu và kiến thức khoa học Khối 5.',
      examMinutes: 25,
      parts: g5.parts,
      questions: g5.questions,
      updatedAt: new Date().toLocaleDateString('vi-VN')
    }
  ];
}

/**
 * Find the most matching exam profile for a student based on their grade and class.
 */
export function findExamForStudent(
  exams: GradeExamProfile[],
  student: Student | null,
  activeExamId?: string
): GradeExamProfile {
  if (!exams || exams.length === 0) {
    const fallback = getDefaultGradeExams()[0];
    return fallback;
  }

  if (!student) {
    if (activeExamId) {
      const found = exams.find((e) => e.id === activeExamId);
      if (found) return found;
    }
    return exams[0];
  }

  const sGrade = (student.grade || '').trim().toLowerCase();
  const sClass = (student.className || '').trim().toLowerCase();

  // 1. Exact match by both Grade and Class
  const exactClassMatch = exams.find(
    (e) =>
      e.grade.trim().toLowerCase() === sGrade &&
      e.className &&
      e.className !== 'Tất cả các lớp' &&
      e.className.trim().toLowerCase() === sClass
  );
  if (exactClassMatch) return exactClassMatch;

  // 2. Match by Grade (all classes or general grade exam)
  const gradeMatch = exams.find(
    (e) => e.grade.trim().toLowerCase() === sGrade
  );
  if (gradeMatch) return gradeMatch;

  // 3. Match by number inside grade/class (e.g. "2" in "Khối 2" vs "2A1")
  const gradeNum = sGrade.replace(/\D/g, '');
  if (gradeNum) {
    const numMatch = exams.find(
      (e) => e.grade.replace(/\D/g, '') === gradeNum
    );
    if (numMatch) return numMatch;
  }

  // 4. Fallback to activeExamId or first exam
  if (activeExamId) {
    const found = exams.find((e) => e.id === activeExamId);
    if (found) return found;
  }

  return exams[0];
}
