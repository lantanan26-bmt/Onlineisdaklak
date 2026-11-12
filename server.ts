import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Allow large image uploads from smartphone cameras
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Initialize Gemini API client on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Route: /api/scan-exam-paper
 * Uses Gemini 3.8 Flash to scan paper tests photographed by phone or uploaded as photos.
 * Detects:
 * - Student Name, Class, School, SBD/ID
 * - Student answers for each question on paper
 * - Automatically grades against the provided exam questions and keys
 */
app.post('/api/scan-exam-paper', async (req, res) => {
  try {
    const { image, parts = [], questions = [], schools = [], students = [] } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Vui lòng cung cấp hình ảnh bài thi' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra Settings > Secrets.',
      });
    }

    // Clean image data for Gemini API inlineData
    let base64Data = image;
    let mimeType = 'image/jpeg';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    // Construct detailed grading rubric from actual questions in the exam
    const questionRubric = (questions || []).map((q: any, idx: number) => {
      const qNum = idx + 1;
      let answerKey = '';

      if (q.type === 'multiple-choice' || q.type === 'listening') {
        const correctOpt = q.options?.[q.correctIndex ?? 0];
        const letter = String.fromCharCode(65 + (q.correctIndex ?? 0));
        answerKey = `Đáp án đúng là ${letter} (${correctOpt?.text || ''})`;
      } else if (q.type === 'yes-no') {
        const isYes = (q.correctIndex ?? 0) === 0;
        answerKey = `Đáp án đúng là ${isYes ? 'YES' : 'NO'}`;
      } else if (q.type === 'tick-cross') {
        const isTick = q.isTick ?? true;
        answerKey = `Đáp án đúng là ${isTick ? 'Tick ✔ (Đúng)' : 'Cross ✘ (Sai)'}`;
      } else if (q.type === 'listen-write') {
        const allowed = (q.acceptableAnswers || []).join(' HOẶC ');
        answerKey = `Đáp án đúng là: ${allowed || 'Chấp nhận từ khóa phù hợp'}`;
      } else if (q.type === 'unscramble-word') {
        answerKey = `Từ ghép đúng là: ${q.unscramble?.targetWord || ''}`;
      } else if (q.type === 'story-word-bank') {
        answerKey = `Từ điền đúng theo thứ tự: ${JSON.stringify(q.storyBank?.answers || {})}`;
      } else if (q.type === 'multi-choice') {
        const indices = (q.correctIndices || []).map((i: number) => String.fromCharCode(65 + i)).join(', ');
        answerKey = `Các đáp án đúng gồm: ${indices}`;
      } else if (q.type === 'fill-blanks') {
        const boxAns = (q.fillBlanks?.boxes || []).map((b: any, bi: number) => `Ô ${bi + 1}: ${b.answers.join('/')}`).join('; ');
        answerKey = `Các từ điền: ${boxAns}`;
      } else if (q.type === 'connect-pairs') {
        const pairs = (q.connectPairs?.pairs || []).map((p: any) => `${p[0]} ↔ ${p[1]}`).join(', ');
        answerKey = `Cặp nối đúng: ${pairs}`;
      } else {
        answerKey = `Đáp án câu hỏi: ${(q.options?.[0]?.text || 'Xem đề bài')}`;
      }

      const isEx = !!q.isExample;

      return {
        questionIndex: idx,
        questionNumber: qNum,
        type: q.type,
        prompt: q.q || '',
        points: isEx ? 0 : (q.points ?? 0.5),
        isExample: isEx,
        partId: q.partId,
        answerKey: isEx ? `(Câu ví dụ mẫu - không tính điểm): ${answerKey}` : answerKey,
        options: (q.options || []).map((o: any, oi: number) => `${String.fromCharCode(65 + oi)}. ${o.text}`),
      };
    });

    const promptText = `
Bạn là Giám thị và Chuyên gia chấm thi tiếng Anh thông minh của Hệ thống LMS iSMART.
Nhiệm vụ của bạn là quan sát bức ảnh chụp bài thi giấy của học sinh (chụp từ điện thoại/webcam):
1. Đọc và nhận diện thông tin thí sinh ở phần đầu trang bài thi:
   - Họ và tên học sinh (name): chữ viết tay hoặc in
   - Lớp (className): ví dụ 2A1, 2B, Khối 2...
   - Trường học (school): trường tiểu học của học sinh (gợi ý các trường: ${schools.join(', ')})
   - Số báo danh hoặc Mã học sinh (studentId hoặc sbd): nếu có trên bài thi, nếu không có hãy tạo mã ngẫu nhiên dạng "OFFLINE_${Date.now().toString().slice(-4)}"

2. Đọc câu trả lời của học sinh trên bài thi và đối chiếu với đáp án chuẩn của ngân hàng đề thi sau đây:
DANH SÁCH ${questionRubric.length} CÂU HỎI VÀ ĐÁP ÁN CHUẨN:
${JSON.stringify(questionRubric, null, 2)}

3. Chấm điểm từng câu:
   - Đọc học sinh đã khoanh, đánh dấu tick/cross, chọn A/B/C/D, hoặc viết từ gì trên giấy.
   - So khớp với đáp án chuẩn.
   - LƯU Ý ĐẶC BIỆT: Những câu hỏi có "isExample": true là CÂU HỎI VÍ DỤ MẪU (points = 0). Tuyệt đối KHÔNG tính điểm cho câu ví dụ mẫu này vào tổng điểm của bài thi hay của từng Part!
   - Với các câu hỏi thi thực sự (isExample = false): Nếu đúng cho đủ điểm câu đó (points). Nếu sai hoặc bỏ trống: 0 điểm.
   - Tính tổng điểm đạt được (earnedPoints) trên tổng điểm tối đa (totalPoints) CHỈ CỦA CÁC CÂU THI (loại trừ câu ví dụ).
   - Quy đổi sang thang điểm 10 (points10) làm tròn 1-2 chữ số thập phân (VD: "8.5").

HÃY TRẢ VỀ DỮ LIỆU ĐÚNG ĐỊNH DẠNG JSON SAU ĐÂY (chỉ JSON thuần túy, không có thẻ markdown \`\`\`json):
{
  "student": {
    "name": "Tên học sinh nhận diện được",
    "className": "Lớp nhận diện được",
    "school": "Trường nhận diện được",
    "studentId": "Mã học sinh / SBD nhận diện được"
  },
  "scoreSummary": {
    "earnedPoints": 8.5,
    "totalPoints": 10.0,
    "points10": "8.5",
    "correctCount": 17,
    "totalQuestions": ${questionRubric.length}
  },
  "questionResults": [
    {
      "questionIndex": 0,
      "questionNumber": 1,
      "prompt": "Tóm tắt đề bài",
      "studentAnswer": "Lựa chọn của học sinh trên giấy (VD: B, Yes, Tick ✔, Kim)",
      "correctAnswer": "Đáp án chuẩn",
      "isCorrect": true,
      "pointsEarned": 0.5,
      "maxPoints": 0.5,
      "notes": "Giải thích ngắn gọn lý do đúng/sai"
    }
  ],
  "confidenceNotes": "Ghi chú về độ rõ nét của ảnh bài thi và độ tin cậy khi chấm"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch {
      // Strip markdown code fences if present
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    }

    return res.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('Error scanning exam paper with Gemini:', error);
    return res.status(500).json({
      error: 'Không thể xử lý hình ảnh bài thi qua AI: ' + (error.message || String(error)),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });
}

startServer();
