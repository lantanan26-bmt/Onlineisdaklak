export type QuestionType =
  | 'multiple-choice'
  | 'yes-no'
  | 'multi-choice'
  | 'fill-blanks'
  | 'connect-pairs'
  | 'listening'
  | 'tick-cross'
  | 'unscramble-word'
  | 'story-word-bank'
  | 'listen-write'
  | 'listen-colour';

export interface QuestionOption {
  text: string;
  img?: string;
}

export interface FillBlankBox {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  answers: string[];
  placeholder?: string;
}

export interface FillBlanksConfig {
  width: number;
  height: number;
  boxes: FillBlankBox[];
}

export interface ConnectPairPoint {
  id?: string;
  x: number;
  y: number;
  label: string;
  color: string;
  r?: number;
  text?: string;
  img?: string;
}

export interface ConnectPairsConfig {
  width: number;
  height: number;
  tolerance?: number;
  showLabels?: boolean;
  points: ConnectPairPoint[];
  pairs: [string, string][];
  examplePair?: [string, string]; // Cặp điểm được nối sẵn trên hình làm ví dụ mẫu cho học sinh
  examplePairLabel?: string; // Nhãn hiển thị trên đường nối ví dụ (e.g. "Ví dụ (Example)")
  defaultColor?: string; // Màu mặc định đồng nhất cho tất cả các điểm và đường nối cặp
}

export interface WordBankItem {
  id: string;
  word: string;
  img?: string;
}

export interface StoryWordBankConfig {
  title?: string;
  story: string;
  words: WordBankItem[];
  answers: Record<string, string>; // e.g. { "0": "birthday", "1": "sea", "2": "singing", "3": "pasta", "4": "dolphin" }
  answerImages?: Record<string, string>; // e.g. { "0": "imgUrl", "1": "imgUrl", ... } - Hình ảnh minh họa cho từng đáp án
  example?: { index: number | string; word: string; img?: string };
}

export interface ColourItem {
  id: string; // ID duy nhất của chi tiết cần tô (e.g. "c1", "c2")
  label: string; // Tên chi tiết, e.g. "Quả bóng dưới nước (Ball in the water)"
  targetColor: string; // Màu đúng cần tô: 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'pink' | 'brown' | 'black' hoặc mã HEX
  targetColorName?: string; // Tên hiển thị của màu, e.g. "Màu vàng (Yellow)"
  x: number; // Tọa độ X trên tranh (0 - 100 theo % hoặc pixel)
  y: number; // Tọa độ Y trên tranh (0 - 100 theo % hoặc pixel)
  w?: number; // Bán kính hoặc chiều rộng vùng bấm tô màu
  h?: number;
  shape?: 'circle' | 'rect' | 'star';
  isExample?: boolean; // Chi tiết này đã được tô sẵn làm ví dụ mẫu cho học sinh
}

export interface ListenColourConfig {
  width: number;
  height: number;
  items: ColourItem[];
  palette?: string[]; // Danh sách màu cho phép chọn
  exampleNote?: string; // Ghi chú ví dụ
}

export interface UnscrambleWordConfig {
  targetWord: string;
  scrambledLetters: string[];
}

export type ExamSection = 'listening' | 'reading-writing';

export interface PartExample {
  title?: string; // Tiêu đề ví dụ, e.g. "Ví dụ mẫu (Example)"
  questionText: string; // Nội dung câu hỏi/đề bài ví dụ
  img?: string; // Hình ảnh minh họa cho ví dụ
  audio?: string; // Audio bài nghe cho ví dụ (tts: hoặc URL)
  audioScript?: string;
  type?: QuestionType; // Phân loại dạng câu hỏi của ví dụ
  options?: QuestionOption[]; // Danh sách lựa chọn nếu là trắc nghiệm
  correctIndex?: number; // Chỉ số đáp án đúng
  isTick?: boolean; // Cho dạng Tick/Cross (true = Tick ✔, false = Cross ✘)
  answerText?: string; // Chuỗi đáp án mẫu hiển thị (e.g. "May", "8", "6 o'clock")
  explanation?: string; // Lời giải thích / hướng dẫn chi tiết cách trả lời cho học sinh
  unscrambleLetters?: string[]; // Danh sách chữ cái xáo trộn (dạng unscramble)
  unscrambleTarget?: string; // Từ đích hoàn chỉnh
  connectPair?: {
    fromLabel: string;
    toLabel: string;
    fromText?: string;
    toText?: string;
    fromX?: number; // Tọa độ X vế 1 (nếu vẽ trực tiếp trên ảnh mẫu)
    fromY?: number; // Tọa độ Y vế 1
    toX?: number;   // Tọa độ X vế 2
    toY?: number;   // Tọa độ Y vế 2
    canvasWidth?: number;
    canvasHeight?: number;
  };
  storySnippet?: string; // Đoạn văn mẫu điền từ
  storyWord?: string; // Từ điền vào chỗ trống
  colourItem?: {
    label: string;
    color: string;
    colorName?: string;
  };
}

export interface PartExampleItem {
  question: string;
  answer: string;
  img?: string;
  isTick?: boolean;
}

export interface ExamPart {
  id: string;
  section?: ExamSection; // Phân loại phần thi lớn: 'listening' hoặc 'reading-writing'
  title: string;
  instructions?: string;
  subInstructions?: string; // Hướng dẫn tiếng Việt/phụ, e.g. "Đọc câu hỏi. Lắng nghe và viết tên hoặc số thích hợp. Dưới đây là 2 ví dụ."
  points: number; // Tổng điểm của Part (ví dụ: 2.5 hoặc 3.0 điểm)
  audio?: string; // Audio chung cho toàn bộ Part
  audioScript?: string;
  maxPlayCount?: number;
  img?: string; // Hình ảnh chung cho toàn bộ Part (e.g. Tranh sinh nhật Part 2)
  imageTitle?: string; // Tên/tiêu đề bức tranh hiển thị bên dưới ảnh (e.g. "KIM'S BIRTHDAY PARTY")
  example?: PartExample; // Ví dụ mẫu cho học sinh hiểu cách trả lời trong Part này
  examplesList?: PartExampleItem[]; // Danh sách các câu ví dụ mẫu (e.g. What is the girl's name? -> Kim)
}

export interface SectionScoreRecord {
  section: ExamSection;
  sectionTitle: string;
  earnedPoints: number;
  totalPoints: number;
  correctCount: number;
  questionCount: number;
}

export interface PartScoreRecord {
  partId: string;
  partTitle: string;
  section?: ExamSection;
  earnedPoints: number;
  totalPoints: number;
  correctCount: number;
  questionCount: number;
}

export interface Question {
  id?: string;
  partId?: string; // ID của Part mà câu hỏi thuộc về
  points?: number; // Điểm của riêng câu hỏi này trong Part (ví dụ: 0.5 điểm)
  isExample?: boolean; // Đánh dấu là câu hỏi ví dụ mẫu (không tính điểm, tự động hiện đáp án)
  q: string;
  img?: string;
  video?: string;
  audio?: string; // audio data URL, http URL, or "tts:English text to speak"
  audioScript?: string; // Optional transcript / listening script
  maxPlayCount?: number; // Limit play count for student (e.g. 1, 2, or undefined for unlimited)
  autoPlayAudio?: boolean; // Whether to auto-play audio when student views this question
  audioSpeed?: number; // TTS speed multiplier, e.g. 0.8, 1.0, 1.2
  audioVoice?: string; // Voice accent, e.g. 'en-US' | 'en-GB'
  type: QuestionType;
  options?: QuestionOption[];
  correctIndex?: number;
  correctIndices?: number[];
  fillBlanks?: FillBlanksConfig;
  connectPairs?: ConnectPairsConfig;
  listenColour?: ListenColourConfig; // Cho dạng Cambridge 'listen-colour' (Nghe và tô màu trên tranh)
  // Extended fields for Cambridge / Grade 2 format:
  isTick?: boolean; // For 'tick-cross': true for ✔ (tick), false for ✘ (cross)
  unscramble?: UnscrambleWordConfig; // For 'unscramble-word'
  unscrambleTarget?: string; // Target unscrambled English word
  answerText?: string; // Formatted answer text / target word
  storyBank?: StoryWordBankConfig; // For 'story-word-bank'
  acceptableAnswers?: string[]; // For 'listen-write': list of valid names/numbers (e.g. ['May'], ['6', 'six'])
  sectionTitle?: string; // Optional section heading, e.g. "LISTENING - Part 1"
  exampleHint?: string; // Optional subtitle/example note
  explanation?: string; // Optional teacher explanation for the question solution
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  className: string;
  school: string;
  examId?: string | null; // ID đề thi mà học sinh đã làm (dùng để đối chiếu bài làm chi tiết)
  score?: number | null; // Tổng điểm thực tế đạt được (ví dụ: 8.5)
  total?: number | null; // Tổng điểm tối đa của đề thi (ví dụ: 10.0)
  points10?: string | null;
  sectionScores?: Record<string, SectionScoreRecord>; // Điểm theo kỹ năng (Listening, Reading & Writing)
  partScores?: Record<string, PartScoreRecord>; // Điểm chi tiết theo từng Part
  questionScores?: Record<number, number>; // Điểm chi tiết từng câu
  submittedAt?: string | null;
  details?: Record<number, any>;
}

export type ViewMode = 'admin' | 'students' | 'scores' | 'teachers' | 'test' | 'json';

export type UserRole = 'guest' | 'admin' | 'teacher' | 'student';

export type TeacherPermission =
  | 'edit_exam'          // Soạn & chỉnh sửa đề thi, câu hỏi, part, audio
  | 'manage_students'    // Quản lý danh sách học sinh, trường và lớp
  | 'view_scores'        // Xem bảng điểm, thống kê & xuất kết quả thi Excel
  | 'reset_scores'       // Xóa điểm thi cho phép học sinh thi lại
  | 'test_run'           // Test chạy thử đề thi
  | 'import_pdf'         // Nạp đề từ file PDF
  | 'camera_grader'      // Chấm bài Camera AI
  | 'print_offline'      // In đề thi & phiếu trả lời trắc nghiệm offline
  | 'view_json';         // Cấu hình & link thi

export interface Teacher {
  id: string;            // Mã GV (e.g. "GV01")
  name: string;          // Họ và tên giáo viên
  username: string;      // Tên đăng nhập
  password: string;      // Mật khẩu
  email?: string;
  phone?: string;
  assignedGrades?: string[]; // Khối phụ trách (e.g. ['Khối 2', 'Khối 3'])
  permissions: TeacherPermission[];
  isActive: boolean;
  createdAt: string;
}

export interface GradeExamProfile {
  id: string; // e.g. "exam-grade-1", "exam-grade-2", "exam-class-2A1"
  grade: string; // e.g. "Khối 1", "Khối 2", "Khối 3", "Khối 4", "Khối 5"
  className?: string; // e.g. "Tất cả các lớp" or "2A1", "2A2", "3B1"
  title: string; // e.g. "Đề thi Tiếng Anh Cambridge Khối 2"
  description?: string;
  examMinutes: number;
  parts: ExamPart[];
  questions: Question[];
  updatedAt?: string;
}
