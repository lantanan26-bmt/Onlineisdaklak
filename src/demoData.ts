import { Question, Student, ExamPart, Teacher } from './types';
export { getAdvancedGrade2Questions, getAdvancedGrade2Parts, GRADE2_MEDIA } from './advancedGrade2Data';

export function svgToDataUrl(svgString: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString.trim());
}

export function createClockSVG(hour: number, minute: number = 0, label: string = ''): string {
  const hAngle = ((hour % 12) + minute / 60) * 30;
  const mAngle = minute * 6;
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 220" width="260" height="220">
      <rect width="260" height="220" rx="18" fill="#f8fafc"/>
      <circle cx="130" cy="110" r="82" fill="#ffffff" stroke="#2563eb" stroke-width="8"/>
      <circle cx="130" cy="110" r="72" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="4 6"/>
      <text x="130" y="52" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="16" fill="#1e293b">12</text>
      <text x="192" y="116" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="16" fill="#1e293b">3</text>
      <text x="130" y="180" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="16" fill="#1e293b">6</text>
      <text x="68" y="116" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="16" fill="#1e293b">9</text>
      <line x1="130" y1="110" x2="130" y2="54" stroke="#0f172a" stroke-width="5" stroke-linecap="round" transform="rotate(${mAngle} 130 110)"/>
      <line x1="130" y1="110" x2="130" y2="72" stroke="#ef4444" stroke-width="7" stroke-linecap="round" transform="rotate(${hAngle} 130 110)"/>
      <circle cx="130" cy="110" r="6" fill="#1e293b"/>
      ${label ? `<text x="130" y="210" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="13" fill="#475569">${label}</text>` : ''}
    </svg>
  `);
}

export const DEMO_MEDIA = {
  clock6: createClockSVG(6, 0, "Clock: 6 o'clock"),
  clock8: createClockSVG(8, 0),
  clock3: createClockSVG(3, 0),
  clock10: createClockSVG(10, 0),
  clock9: createClockSVG(9, 0),
  bottle1L: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
      <rect width="320" height="200" rx="16" fill="#eff6ff"/>
      <rect x="138" y="20" width="44" height="18" rx="4" fill="#1d4ed8"/>
      <path d="M142 38 L178 38 L195 75 L195 170 Q195 182 183 182 L137 182 Q125 182 125 170 L125 75 Z" fill="#93c5fd" stroke="#1d4ed8" stroke-width="4"/>
      <text x="160" y="124" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="22" fill="#1d4ed8">1 L</text>
    </svg>
  `),
  jar1L: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
      <rect width="320" height="200" rx="16" fill="#f0fdf4"/>
      <rect x="115" y="32" width="90" height="16" rx="6" fill="#15803d"/>
      <rect x="105" y="48" width="110" height="130" rx="18" fill="#bbf7d0" stroke="#16a34a" stroke-width="4"/>
      <text x="160" y="122" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="24" fill="#166534">1 Litre</text>
    </svg>
  `),
  bookLaptop: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 200">
      <rect width="420" height="200" rx="16" fill="#fffbeb"/>
      <rect x="45" y="55" width="110" height="95" rx="8" fill="#f59e0b" stroke="#b45309" stroke-width="4"/>
      <text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff">BOOK</text>
      <text x="195" y="115" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="32" fill="#d97706">+</text>
      <rect x="245" y="50" width="130" height="80" rx="8" fill="#334155" stroke="#0f172a" stroke-width="4"/>
      <text x="310" y="92" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="18" fill="#38bdf8">LAPTOP</text>
    </svg>
  `),
  rice5kg: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
      <rect width="320" height="200" rx="16" fill="#fef2f2"/>
      <path d="M105 45 Q160 25 215 45 L225 165 Q160 180 95 165 Z" fill="#fca5a5" stroke="#dc2626" stroke-width="4"/>
      <text x="160" y="98" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#7f1d1d">RICE BAG</text>
      <text x="160" y="132" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="26" fill="#dc2626">5 kg</text>
    </svg>
  `),
  dogCat: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 200">
      <rect width="420" height="200" rx="16" fill="#f5f3ff"/>
      <circle cx="120" cy="95" r="52" fill="#ddd6fe" stroke="#7c3aed" stroke-width="4"/>
      <text x="120" y="90" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#4c1d95">🐶 DOG (9kg)</text>
      <text x="210" y="105" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="30" fill="#7c3aed">🐱 CAT</text>
      <text x="320" y="105" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="14" fill="#6d28d9">(-5kg lighter)</text>
    </svg>
  `),
  fillBlankLitre: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">
      <rect width="1000" height="600" fill="#eff6ff"/>
      <rect x="40" y="40" width="920" height="520" rx="28" fill="#ffffff" stroke="#bfdbfe" stroke-width="6"/>
      <text x="500" y="130" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="42" fill="#1e3a8a">SPELL THE UNIT OF CAPACITY</text>
      <rect x="410" y="170" width="180" height="210" rx="18" fill="#38bdf8" stroke="#0284c7" stroke-width="6"/>
      <text x="500" y="290" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="54" fill="#ffffff">1 L</text>
      <text x="230" y="520" font-family="monospace" font-weight="900" font-size="88" fill="#0f172a">l i t</text>
      <text x="570" y="520" font-family="monospace" font-weight="900" font-size="88" fill="#0f172a">e</text>
    </svg>
  `),
  trainLength: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 200">
      <rect width="460" height="200" rx="16" fill="#ecfeff"/>
      <rect x="40" y="70" width="380" height="65" rx="12" fill="#0284c7"/>
      <text x="230" y="50" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="22" fill="#0369a1">🚂 Length = 7 metres</text>
      <text x="230" y="112" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="24" fill="#ffffff">TRAIN CARRIAGE</text>
    </svg>
  `),
  connectPairsBoard1: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420">
      <rect width="700" height="420" fill="#f8fafc"/>
      <text x="350" y="38" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="20" fill="#1e293b">Match the object with its correct measurement</text>
      <text x="130" y="116" font-family="sans-serif" font-weight="700" font-size="16" fill="#1e293b">Water Bottle</text>
      <text x="130" y="226" font-family="sans-serif" font-weight="700" font-size="16" fill="#1e293b">Rice Bag</text>
      <text x="130" y="336" font-family="sans-serif" font-weight="700" font-size="16" fill="#1e293b">Toy Train</text>
      <text x="510" y="116" font-family="sans-serif" font-weight="800" font-size="16" fill="#0369a1">5 kg (Mass)</text>
      <text x="510" y="226" font-family="sans-serif" font-weight="800" font-size="16" fill="#0369a1">70 cm (Length)</text>
      <text x="510" y="336" font-family="sans-serif" font-weight="800" font-size="16" fill="#0369a1">1 Litre (Capacity)</text>
    </svg>
  `),
  connectPairsBoard2: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420">
      <rect width="700" height="420" fill="#fffbeb"/>
      <text x="350" y="38" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="20" fill="#78350f">Connect the Addition with its Result</text>
      <text x="140" y="138" font-family="sans-serif" font-weight="800" font-size="20" fill="#92400e">25 + 15 =</text>
      <text x="140" y="294" font-family="sans-serif" font-weight="800" font-size="20" fill="#92400e">50 + 35 =</text>
      <text x="500" y="138" font-family="sans-serif" font-weight="800" font-size="24" fill="#047857">85</text>
      <text x="500" y="294" font-family="sans-serif" font-weight="800" font-size="24" fill="#047857">40</text>
    </svg>
  `),
  connectPairsBoard3: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420">
      <rect width="700" height="420" fill="#f0fdf4"/>
      <text x="350" y="38" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="20" fill="#14532d">Match the Time in Words with Digital Time</text>
      <text x="130" y="138" font-family="sans-serif" font-weight="800" font-size="18" fill="#166534">Half past eight</text>
      <text x="130" y="294" font-family="sans-serif" font-weight="800" font-size="18" fill="#166534">Quarter to nine</text>
      <text x="500" y="138" font-family="sans-serif" font-weight="800" font-size="22" fill="#0284c7">08:45</text>
      <text x="500" y="294" font-family="sans-serif" font-weight="800" font-size="22" fill="#0284c7">08:30</text>
    </svg>
  `)
};

export function getInitialParts(): ExamPart[] {
  return [
    {
      id: 'part-1',
      section: 'listening',
      title: 'Part 1: Listening & Telling Time (Bài Nghe & Xem Giờ)',
      instructions: 'Lắng nghe audio hoặc quan sát hình ảnh đồng hồ để chọn đáp án chính xác nhất.',
      points: 3.0,
      audio: 'tts:Listen carefully to the questions and choose the best answer.',
      maxPlayCount: 2,
      example: {
        title: 'Ví dụ mẫu (Example): Telling Time / Xem giờ',
        questionText: 'Look at Clock: Kim ngắn chỉ số 6, kim dài chỉ số 12. What time is it?',
        img: DEMO_MEDIA.clock6,
        audio: 'tts:Look at the clock. It is six o\'clock. B is the correct answer.',
        type: 'multiple-choice',
        options: [
          { text: 'A. 3 o\'clock' },
          { text: 'B. 6 o\'clock' },
          { text: 'C. 12 o\'clock' }
        ],
        correctIndex: 1,
        answerText: 'B. 6 o\'clock',
        explanation: 'Hướng dẫn: Quan sát kỹ mặt đồng hồ. Khi kim ngắn chỉ số 6 và kim dài chỉ số 12, đồng hồ chỉ 6 giờ đúng (6 o\'clock). Em bấm chọn đáp án B.'
      }
    },
    {
      id: 'part-2',
      section: 'reading-writing',
      title: 'Part 1: Units of Measurement & Word Problems (Khối Lượng & Dung Tích)',
      instructions: 'Đọc kỹ các câu hỏi về đơn vị đo lường (kg, litre, m) và tính toán đáp án đúng.',
      points: 4.0,
      example: {
        title: 'Ví dụ mẫu (Example): Đơn vị đo dung tích (Litre)',
        questionText: 'Một chai nước chứa được 1 lít (1 L). Hỏi 3 chai nước như thế chứa được tất cả bao nhiêu lít nước?',
        img: DEMO_MEDIA.bottle1L,
        type: 'multiple-choice',
        options: [
          { text: 'A. 1 lít' },
          { text: 'B. 2 lít' },
          { text: 'C. 3 lít' }
        ],
        correctIndex: 2,
        answerText: 'C. 3 lít',
        explanation: 'Hướng dẫn: Mỗi chai có dung tích 1 lít, 3 chai có: 1 L × 3 = 3 lít. Em bấm chọn đáp án C.'
      }
    },
    {
      id: 'part-3',
      section: 'reading-writing',
      title: 'Part 2: Fill Blanks & Matching Pairs (Điền Khuyết & Nối Cặp)',
      instructions: 'Điền chữ cái còn thiếu vào chỗ trống và nối các cặp tương ứng chính xác.',
      points: 3.0,
      example: {
        title: 'Ví dụ mẫu (Example): Nối phép tính với kết quả',
        questionText: 'Nối phép tính với kết quả chính xác: "25 + 15 =" ➔ "40"',
        type: 'connect-pairs',
        img: DEMO_MEDIA.connectPairsBoard2,
        connectPair: {
          fromLabel: 'A',
          toLabel: 'D',
          fromText: '25 + 15',
          toText: '40',
          fromX: 210,
          fromY: 140,
          toX: 490,
          toY: 280,
          canvasWidth: 700,
          canvasHeight: 420
        },
        answerText: 'Nối "25 + 15" với "40"',
        explanation: 'Hướng dẫn: Bấm vào điểm tròn của phép tính "25 + 15", sau đó bấm vào điểm tròn của kết quả "40" ở cột bên phải để nối đường thẳng tương ứng. Cặp này đã được nối mẫu để em hiểu cách làm!'
      }
    }
  ];
}

export function getInitialQuestions(): Question[] {
  return [
    // PART 1: 4 questions x 0.75 points = 3.0 points
    {
      partId: "part-1",
      points: 0.75,
      q: "A: What time is it?\n<br>\nB: It is ______ o’clock.",
      img: DEMO_MEDIA.clock6,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. 3", img: "" },
        { text: "B. 6", img: "" },
        { text: "C. 12", img: "" }
      ],
      correctIndex: 1
    },
    {
      partId: "part-1",
      points: 0.75,
      q: "It is eight o’clock. Look at the clocks and choose the correct one:",
      img: "",
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A", img: DEMO_MEDIA.clock6 },
        { text: "B", img: DEMO_MEDIA.clock8 },
        { text: "C", img: DEMO_MEDIA.clock3 }
      ],
      correctIndex: 1
    },
    {
      partId: "part-1",
      points: 0.75,
      q: "What time is it? (Listening: It is nine o'clock)",
      img: "",
      video: "",
      audio: "tts:What time is it? It is nine o'clock.",
      type: "listening",
      options: [
        { text: "A", img: DEMO_MEDIA.clock10 },
        { text: "B", img: DEMO_MEDIA.clock9 },
        { text: "C", img: DEMO_MEDIA.clock3 }
      ],
      correctIndex: 1
    },
    {
      partId: "part-1",
      points: 0.75,
      q: "What is the length of the train? (Listening)",
      img: DEMO_MEDIA.trainLength,
      video: "",
      audio: "tts:Look at the train. The length of the train is seven metres.",
      type: "listening",
      options: [
        { text: "A. one metre", img: "" },
        { text: "B. two metres", img: "" },
        { text: "C. seven metres", img: "" }
      ],
      correctIndex: 2
    },

    // PART 2: 5 questions x 0.8 points = 4.0 points
    {
      partId: "part-2",
      points: 0.8,
      q: "The _____ of the bottle is 1 litre.",
      img: DEMO_MEDIA.bottle1L,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. mass", img: "" },
        { text: "B. capacity", img: "" },
        { text: "C. metres", img: "" }
      ],
      correctIndex: 1
    },
    {
      partId: "part-2",
      points: 0.8,
      q: "The capacity of the jar is 1 _____.",
      img: DEMO_MEDIA.jar1L,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. kilograms", img: "" },
        { text: "B. litre", img: "" },
        { text: "C. litres", img: "" }
      ],
      correctIndex: 1
    },
    {
      partId: "part-2",
      points: 0.8,
      q: "The book is 2kg. The laptop is 3kg. What is the total mass of the book and the laptop?",
      img: DEMO_MEDIA.bookLaptop,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. 1kg", img: "" },
        { text: "B. 2kg", img: "" },
        { text: "C. 5kg", img: "" }
      ],
      correctIndex: 2
    },
    {
      partId: "part-2",
      points: 0.8,
      q: "The mass of the rice bag is 5 _____.",
      img: DEMO_MEDIA.rice5kg,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. kilograms", img: "" },
        { text: "B. metres", img: "" },
        { text: "C. kilogram", img: "" }
      ],
      correctIndex: 0
    },
    {
      partId: "part-2",
      points: 0.8,
      q: "The mass of the dog is 9kg. The mass of the cat is 5kg lighter than the dog. What is the mass of the cat?",
      img: DEMO_MEDIA.dogCat,
      video: "",
      audio: "",
      type: "multiple-choice",
      options: [
        { text: "A. 4kg", img: "" },
        { text: "B. 5kg", img: "" },
        { text: "C. 6kg", img: "" }
      ],
      correctIndex: 0
    },

    // PART 3: 4 questions x 0.75 points = 3.0 points
    {
      partId: "part-3",
      points: 0.75,
      q: "Fill in the blank with <b>ONLY ONE LETTER</b> to complete the word.",
      img: DEMO_MEDIA.fillBlankLitre,
      video: "",
      audio: "",
      type: "fill-blanks",
      fillBlanks: {
        width: 1000,
        height: 600,
        boxes: [
          {
            x: 350,
            y: 440,
            w: 190,
            h: 90,
            answers: ["r", "R"],
            placeholder: "type letter"
          }
        ]
      }
    },
    {
      partId: "part-3",
      points: 0.75,
      q: "Connect each object on the left with its correct unit/measure on the right.",
      img: DEMO_MEDIA.connectPairsBoard1,
      video: "",
      audio: "",
      type: "connect-pairs",
      connectPairs: {
        width: 700,
        height: 420,
        tolerance: 22,
        showLabels: true,
        defaultColor: "#2563eb",
        points: [
          { x: 200, y: 110, label: "A", text: "Water Bottle", color: "#2563eb", r: 13 },
          { x: 200, y: 220, label: "B", text: "Rice Bag", color: "#2563eb", r: 13 },
          { x: 200, y: 330, label: "C", text: "Toy Train", color: "#2563eb", r: 13 },
          { x: 500, y: 110, label: "D", text: "5 kg (Mass)", color: "#2563eb", r: 13 },
          { x: 500, y: 220, label: "E", text: "70 cm (Length)", color: "#2563eb", r: 13 },
          { x: 500, y: 330, label: "F", text: "1 Litre (Capacity)", color: "#2563eb", r: 13 }
        ],
        pairs: [
          ["A", "F"],
          ["B", "D"],
          ["C", "E"]
        ],
        examplePair: ["A", "F"],
        examplePairLabel: "★ Ví dụ: Water Bottle ➔ 1 Litre"
      }
    },
    {
      partId: "part-3",
      points: 0.75,
      q: "Connect the calculation with its correct answer.",
      img: DEMO_MEDIA.connectPairsBoard2,
      video: "",
      audio: "",
      type: "connect-pairs",
      connectPairs: {
        width: 700,
        height: 420,
        tolerance: 22,
        showLabels: true,
        defaultColor: "#2563eb",
        points: [
          { x: 210, y: 140, label: "A", text: "25 + 15", color: "#2563eb", r: 13 },
          { x: 210, y: 280, label: "B", text: "50 + 35", color: "#2563eb", r: 13 },
          { x: 490, y: 140, label: "C", text: "85", color: "#2563eb", r: 13 },
          { x: 490, y: 280, label: "D", text: "40", color: "#2563eb", r: 13 }
        ],
        pairs: [
          ["A", "D"],
          ["B", "C"]
        ],
        examplePair: ["A", "D"],
        examplePairLabel: "★ Ví dụ: 25 + 15 ➔ 40"
      }
    },
    {
      partId: "part-3",
      points: 0.75,
      q: "Match the time in words with the correct digital clock.",
      img: DEMO_MEDIA.connectPairsBoard3,
      video: "",
      audio: "",
      type: "connect-pairs",
      connectPairs: {
        width: 700,
        height: 420,
        tolerance: 22,
        showLabels: true,
        defaultColor: "#2563eb",
        points: [
          { x: 210, y: 140, label: "A", text: "Half past eight", color: "#2563eb", r: 13 },
          { x: 210, y: 280, label: "B", text: "Quarter to nine", color: "#2563eb", r: 13 },
          { x: 490, y: 140, label: "C", text: "08:45", color: "#2563eb", r: 13 },
          { x: 490, y: 280, label: "D", text: "08:30", color: "#2563eb", r: 13 }
        ],
        pairs: [
          ["A", "D"],
          ["B", "C"]
        ],
        examplePair: ["A", "D"],
        examplePairLabel: "★ Ví dụ: Half past eight ➔ 08:30"
      }
    }
  ];
}

export function getInitialSchools(): string[] {
  return [
    'TH Quốc Tế iSMART',
    'TH Nguyễn Bỉnh Khiêm',
    'TH Lê Quý Đôn'
  ];
}

export function getInitialStudents(): Student[] {
  return [
    {
      id: 'HS2001',
      name: 'Nguyễn Minh An',
      grade: 'Khối 2',
      className: '2A1',
      school: 'TH Quốc Tế iSMART',
      score: null,
      total: null,
      submittedAt: null
    },
    {
      id: 'HS2002',
      name: 'Trần Hà My',
      grade: 'Khối 2',
      className: '2A1',
      school: 'TH Quốc Tế iSMART',
      score: null,
      total: null,
      submittedAt: null
    },
    {
      id: 'HS2003',
      name: 'Lê Hoàng Bảo',
      grade: 'Khối 2',
      className: '2A2',
      school: 'TH Quốc Tế iSMART',
      score: null,
      total: null,
      submittedAt: null
    },
    {
      id: 'HS3001',
      name: 'Phạm Gia Huy',
      grade: 'Khối 3',
      className: '3B1',
      school: 'TH Nguyễn Bỉnh Khiêm',
      score: null,
      total: null,
      submittedAt: null
    },
    {
      id: 'HS3002',
      name: 'Võ Ngọc Diệp',
      grade: 'Khối 3',
      className: '3B2',
      school: 'TH Nguyễn Bỉnh Khiêm',
      score: null,
      total: null,
      submittedAt: null
    },
    {
      id: 'HS4001',
      name: 'Đặng Tuấn Kiệt',
      grade: 'Khối 4',
      className: '4A1',
      school: 'TH Lê Quý Đôn',
      score: null,
      total: null,
      submittedAt: null
    }
  ];
}

export function getInitialTeachers(): Teacher[] {
  return [
    {
      id: 'GV01',
      name: 'Cô Hoàng Thu Hà',
      username: 'gv_thuha',
      password: '123',
      email: 'thuha@ismart.edu.vn',
      phone: '0912345678',
      assignedGrades: ['Khối 2', 'Khối 3'],
      permissions: ['edit_exam', 'test_run', 'manage_students', 'view_scores', 'reset_scores', 'import_pdf', 'camera_grader', 'print_offline', 'view_json'],
      isActive: true,
      createdAt: '01/09/2026'
    },
    {
      id: 'GV02',
      name: 'Thầy Trần Văn Nam',
      username: 'gv_nam',
      password: '123',
      email: 'vannam@ismart.edu.vn',
      phone: '0987654321',
      assignedGrades: ['Khối 1', 'Khối 2'],
      permissions: ['edit_exam', 'test_run', 'import_pdf'],
      isActive: true,
      createdAt: '05/09/2026'
    },
    {
      id: 'GV03',
      name: 'Cô Lê Phương Linh (Chủ nhiệm)',
      username: 'gv_phuonglinh',
      password: '123',
      email: 'phuonglinh@ismart.edu.vn',
      phone: '0903112233',
      assignedGrades: ['Khối 2'],
      permissions: ['manage_students', 'view_scores', 'reset_scores', 'print_offline', 'camera_grader'],
      isActive: true,
      createdAt: '10/09/2026'
    }
  ];
}
