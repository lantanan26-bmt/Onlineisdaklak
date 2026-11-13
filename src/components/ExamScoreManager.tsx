import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Student,
  ExamPart,
  PartScoreRecord,
  SectionScoreRecord,
  ExamSection,
  Question,
  GradeExamProfile
} from '../types';
import { findExamForStudent } from '../utils/gradeExamManager';
import { isQuestionExample, getStoryWordBankPointBreakdown } from '../utils/sectionUtils';
import { getListenColourPointBreakdown, formatPointsClean, isColorMatch } from '../utils/cambridgeColours';

const getPartSection = (p?: ExamPart): ExamSection => {
  if (p?.section) return p.section;
  const t = (p?.title || '').toLowerCase();
  if (t.includes('listen') || t.includes('nghe')) return 'listening';
  return 'reading-writing';
};

interface ExamScoreManagerProps {
  parts?: ExamPart[];
  questions?: Question[];
  gradeExams?: GradeExamProfile[];
  activeExamId?: string;
  schools: string[];
  students: Student[];
  onStudentsChange: (students: Student[]) => void;
  onOpenCameraGrader?: () => void;
  isCloudConnected?: boolean;
  isRefreshingCloud?: boolean;
  onRefreshFromCloud?: () => Promise<void> | void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
  canResetScores?: boolean;
}

export const ExamScoreManager: React.FC<ExamScoreManagerProps> = ({
  parts = [],
  questions = [],
  gradeExams = [],
  activeExamId = 'exam-grade-2',
  schools,
  students,
  onStudentsChange,
  onOpenCameraGrader,
  isCloudConnected = false,
  isRefreshingCloud = false,
  onRefreshFromCloud,
  showToast,
  openConfirm,
  canResetScores = false
}) => {
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  // Filters
  const [filterSchool, setFilterSchool] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'all' | 'taken' | 'not_taken' | 'high_score'>('all');
  const [filterKeyword, setFilterKeyword] = useState('');

  // Dropdown lists
  const availableGrades = useMemo(() => {
    const list = students
      .filter((s) => filterSchool === 'ALL' || s.school === filterSchool)
      .map((s) => s.grade)
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [students, filterSchool]);

  const availableClasses = useMemo(() => {
    const list = students
      .filter((s) => filterSchool === 'ALL' || s.school === filterSchool)
      .filter((s) => filterGrade === 'ALL' || s.grade === filterGrade)
      .map((s) => s.className)
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [students, filterSchool, filterGrade]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const kw = filterKeyword.trim().toLowerCase();
    return students.filter((s) => {
      if (filterSchool !== 'ALL' && s.school !== filterSchool) return false;
      if (filterGrade !== 'ALL' && s.grade !== filterGrade) return false;
      if (filterClass !== 'ALL' && s.className !== filterClass) return false;

      const hasTaken = s.score !== null && typeof s.score !== 'undefined';
      if (filterStatus === 'taken' && !hasTaken) return false;
      if (filterStatus === 'not_taken' && hasTaken) return false;
      if (filterStatus === 'high_score') {
        const pts10 = s.points10 ? parseFloat(s.points10) : (s.score && s.total ? (s.score / s.total) * 10 : 0);
        if (pts10 < 8.0) return false;
      }

      if (kw && !s.id.toLowerCase().includes(kw) && !s.name.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [students, filterSchool, filterGrade, filterClass, filterStatus, filterKeyword]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = students.length;
    const takenStudents = students.filter((s) => s.score !== null && typeof s.score !== 'undefined');
    const takenCount = takenStudents.length;
    const completionRate = total > 0 ? ((takenCount / total) * 100).toFixed(1) : '0';

    let avgScore10 = '0.0';
    let maxScore10 = '0.0';
    let minScore10 = '0.0';

    if (takenCount > 0) {
      const scores10 = takenStudents.map((s) => {
        if (s.points10) return parseFloat(s.points10);
        if (s.score && s.total) return (s.score / s.total) * 10;
        return 0;
      });
      const sum = scores10.reduce((acc, cur) => acc + cur, 0);
      avgScore10 = (sum / takenCount).toFixed(1);
      maxScore10 = Math.max(...scores10).toFixed(1);
      minScore10 = Math.min(...scores10).toFixed(1);
    }

    return { total, takenCount, completionRate, avgScore10, maxScore10, minScore10 };
  }, [students]);

  // Export to Excel: Filtered View
  const handleExportFiltered = () => {
    if (filteredStudents.length === 0) {
      showToast('Không có dữ liệu học sinh để xuất Excel!', 'warn');
      return;
    }

    const rows: any[] = [];
    const partHeaders = parts.map((p, idx) => `Part ${idx + 1}: ${p.title} (${p.points}đ)`);

    const headers = [
      'STT',
      'Mã Học Sinh',
      'Họ và Tên',
      'Trường Học',
      'Khối',
      'Lớp',
      'Điểm Listening (Nghe)',
      'Điểm Reading & Writing (Đọc/Viết)',
      ...partHeaders,
      'Tổng Điểm Bài Thi',
      'Thang Điểm Đề',
      'Điểm hệ 10',
      'Trạng Thái',
      'Thời Gian Nộp Bài'
    ];
    rows.push(headers);

    filteredStudents.forEach((stu, idx) => {
      const listeningSection = stu.sectionScores?.['listening'];
      const rwSection = stu.sectionScores?.['reading-writing'];

      const listeningText = listeningSection
        ? `${listeningSection.earnedPoints} / ${listeningSection.totalPoints}đ`
        : 'Chưa có';
      const rwText = rwSection
        ? `${rwSection.earnedPoints} / ${rwSection.totalPoints}đ`
        : 'Chưa có';

      const partCols = parts.map((p) => {
        const pRec = stu.partScores?.[p.id];
        return pRec ? `${pRec.earnedPoints} / ${p.points}đ` : '-';
      });

      const row = [
        idx + 1,
        stu.id,
        stu.name,
        stu.school,
        stu.grade,
        stu.className,
        listeningText,
        rwText,
        ...partCols,
        stu.score ?? 'Chưa thi',
        stu.total ?? '-',
        stu.points10 ?? '-',
        stu.score !== null && typeof stu.score !== 'undefined' ? 'Đã hoàn thành' : 'Chưa thi',
        stu.submittedAt || '-'
      ];
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');
    XLSX.writeFile(wb, `BangDiem_iSMART_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Đã xuất file bảng điểm Excel theo bộ lọc thành công!');
  };

  // Export to Excel: Split into Sheets by Class
  const handleExportMultiSheet = () => {
    if (students.length === 0) {
      showToast('Không có dữ liệu học sinh để xuất file!', 'warn');
      return;
    }

    const wb = XLSX.utils.book_new();
    const partHeaders = parts.map((p, idx) => `Part ${idx + 1} (${p.title})`);

    const classMap = new Map<string, Student[]>();
    students.forEach((s) => {
      const key = `${s.grade}_${s.className}`.replace(/[\/\\?*:[\]]/g, '_');
      if (!classMap.has(key)) classMap.set(key, []);
      classMap.get(key)!.push(s);
    });

    classMap.forEach((classList, classKey) => {
      const rows: any[] = [];
      const headers = [
        'STT',
        'Mã HS',
        'Họ và Tên',
        'Trường',
        'Khối',
        'Lớp',
        'Điểm Listening',
        'Điểm Reading & Writing',
        ...partHeaders,
        'Tổng Điểm',
        'Thang Điểm',
        'Điểm hệ 10',
        'Trạng Thái',
        'Thời Gian Nộp'
      ];
      rows.push(headers);

      classList.forEach((stu, idx) => {
        const listeningSection = stu.sectionScores?.['listening'];
        const rwSection = stu.sectionScores?.['reading-writing'];
        const partCols = parts.map((p) => {
          const pRec = stu.partScores?.[p.id];
          return pRec ? `${pRec.earnedPoints} / ${p.points}đ` : '-';
        });

        rows.push([
          idx + 1,
          stu.id,
          stu.name,
          stu.school,
          stu.grade,
          stu.className,
          listeningSection ? `${listeningSection.earnedPoints}/${listeningSection.totalPoints}` : '-',
          rwSection ? `${rwSection.earnedPoints}/${rwSection.totalPoints}` : '-',
          ...partCols,
          stu.score ?? 'Chưa thi',
          stu.total ?? '-',
          stu.points10 ?? '-',
          stu.score !== null && typeof stu.score !== 'undefined' ? 'Đã thi' : 'Chưa thi',
          stu.submittedAt || '-'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = classKey.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `BangDiem_TachLop_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Đã xuất file Excel tách sheet cho ${classMap.size} lớp học!`);
  };

  // Simulate Demo Scores for testing
  const handleSimulateDemoScores = () => {
    openConfirm(
      'Tạo điểm thi mẫu ngẫu nhiên?',
      'Hệ thống sẽ giả lập điểm thi thực tế (kèm điểm Listening, Reading & Writing và từng Part) cho các học sinh chưa có điểm.',
      () => {
        const totalExamPts = +(parts.reduce((sum, p) => sum + (p.points || 0), 0) || 10).toFixed(2);
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        const updated = students.map((s, idx) => {
          if (s.score !== null && typeof s.score !== 'undefined') return s;

          const ratio = Math.max(0.68, 0.96 - (idx % 5) * 0.06);
          const score = +(totalExamPts * ratio).toFixed(1);
          const points10 = ((score / totalExamPts) * 10).toFixed(1);

          const partScores: Record<string, PartScoreRecord> = {};
          const sectionScores: Record<string, SectionScoreRecord> = {
            listening: {
              section: 'listening',
              sectionTitle: 'Listening (Nghe hiểu)',
              earnedPoints: 0,
              totalPoints: 0,
              correctCount: 0,
              questionCount: 0
            },
            'reading-writing': {
              section: 'reading-writing',
              sectionTitle: 'Reading & Writing (Đọc & Viết)',
              earnedPoints: 0,
              totalPoints: 0,
              correctCount: 0,
              questionCount: 0
            }
          };

          parts.forEach((p, pIdx) => {
            const sec = getPartSection(p);
            const pRatio = Math.max(0.6, Math.min(1, ratio + ((pIdx % 3) - 1) * 0.05));
            const pEarned = +(p.points * pRatio).toFixed(1);
            const qCount = 4;
            const cCount = Math.round(qCount * pRatio);

            partScores[p.id] = {
              partId: p.id,
              partTitle: p.title,
              section: sec,
              earnedPoints: pEarned,
              totalPoints: p.points,
              correctCount: cCount,
              questionCount: qCount
            };

            if (sectionScores[sec]) {
              sectionScores[sec].totalPoints = +(sectionScores[sec].totalPoints + p.points).toFixed(1);
              sectionScores[sec].earnedPoints = +(sectionScores[sec].earnedPoints + pEarned).toFixed(1);
              sectionScores[sec].questionCount += qCount;
              sectionScores[sec].correctCount += cCount;
            }
          });

          return {
            ...s,
            score,
            total: totalExamPts,
            points10,
            sectionScores,
            partScores,
            submittedAt: nowStr
          };
        });

        onStudentsChange(updated);
        showToast('Đã tạo điểm thi mẫu và phân bổ kỹ năng thành công!');
      }
    );
  };

  // Reset single student's score so they can retake the exam
  const handleResetSingleStudentScore = (stu: Student) => {
    if (!canResetScores) {
      showToast('Bạn không có quyền xóa điểm học sinh! Vui lòng liên hệ Admin.', 'warn');
      return;
    }
    openConfirm(
      `Xóa điểm của thí sinh ${stu.name}?`,
      `Điểm thi của học sinh "${stu.name}" (Mã: ${stu.id} - Lớp: ${stu.className}) sẽ được xóa hoàn toàn và trở về trạng thái "Chưa thi". Học sinh sẽ có thể đăng nhập lại trang thi để làm lại bài từ đầu.`,
      () => {
        const updated = students.map((s) =>
          s.id === stu.id
            ? {
                ...s,
                score: null,
                total: null,
                points10: null,
                sectionScores: undefined,
                partScores: undefined,
                questionScores: undefined,
                submittedAt: null,
                details: undefined
              }
            : s
        );
        onStudentsChange(updated);
        if (selectedStudentDetail && selectedStudentDetail.id === stu.id) {
          setSelectedStudentDetail(null);
        }
        showToast(`Đã xóa điểm của học sinh ${stu.name}! Thí sinh có thể thi lại bài thi.`, 'success');
      }
    );
  };

  // Reset scores in bulk to allow retake
  const handleResetScores = () => {
    if (!canResetScores) {
      showToast('Bạn không có quyền xóa điểm thi! Vui lòng liên hệ Admin.', 'warn');
      return;
    }

    const hasFilter = filterSchool !== 'ALL' || filterGrade !== 'ALL' || filterClass !== 'ALL';
    const filterDesc = hasFilter
      ? `các học sinh theo bộ lọc đang chọn (${filterSchool !== 'ALL' ? filterSchool : ''} ${filterGrade !== 'ALL' ? filterGrade : ''} ${filterClass !== 'ALL' ? 'Lớp ' + filterClass : ''})`
      : 'toàn bộ danh sách học sinh';

    const targetStudents = hasFilter ? filteredStudents : students;
    const takenTargetCount = targetStudents.filter((s) => s.score !== null && typeof s.score !== 'undefined').length;

    if (takenTargetCount === 0) {
      showToast('Hiện không có học sinh nào trong nhóm này có điểm để xóa!', 'info');
      return;
    }

    openConfirm(
      `Xóa điểm thi cho ${filterDesc}?`,
      `Sẽ có ${takenTargetCount} bài thi đã hoàn thành được xóa điểm và đưa về trạng thái "Chưa thi". Sau khi xóa, các học sinh này có thể đăng nhập để làm lại bài thi mới.`,
      () => {
        const targetIds = new Set(targetStudents.map((s) => s.id));
        const cleared = students.map((s) => {
          if (targetIds.has(s.id)) {
            return {
              ...s,
              score: null,
              total: null,
              points10: null,
              sectionScores: undefined,
              partScores: undefined,
              questionScores: undefined,
              submittedAt: null,
              details: undefined
            };
          }
          return s;
        });
        onStudentsChange(cleared);
        showToast(`Đã xóa điểm của ${takenTargetCount} học sinh. Các em có thể thi lại bài thi!`, 'success');
      }
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Stats Overview */}
      <div className="bg-gradient-to-r from-cyan-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-cyan-700/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase tracking-wider">
                Báo Cáo & Khảo Thí
              </span>
              <span className="text-slate-400 text-xs">Cập nhật theo thời gian thực</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <i className="fa-solid fa-chart-line text-cyan-400"></i>
              Bảng Điểm & Xuất Kết Quả Thi
            </h1>
            <p className="text-xs sm:text-sm text-cyan-100/80 max-w-2xl leading-relaxed">
              Theo dõi chi tiết điểm số từng phần Listening, Reading & Writing của học sinh, thống kê theo trường/khối/lớp và xuất file báo cáo Excel đa năng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onRefreshFromCloud && (
              <button
                type="button"
                disabled={isRefreshingCloud}
                onClick={() => onRefreshFromCloud()}
                title={isCloudConnected ? 'Tải bài làm và điểm thí sinh mới nhất vừa nộp từ Firebase Cloud' : 'Tải điểm thí sinh từ Firebase Cloud'}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <i className={`fa-solid ${isRefreshingCloud ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-down'}`}></i>
                <span>{isRefreshingCloud ? 'Đang cập nhật...' : 'Cập nhật điểm từ Cloud'}</span>
              </button>
            )}

            {onOpenCameraGrader && (
              <button
                type="button"
                onClick={onOpenCameraGrader}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-camera"></i>
                <span>Chấm Bài Camera AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportFiltered}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span>Xuất Excel Bảng Điểm</span>
            </button>

            <button
              type="button"
              onClick={handleExportMultiSheet}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-table-columns"></i>
              <span className="hidden sm:inline">Xuất Tách Sheet Từng Lớp</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-cyan-800/60">
          <div className="p-3.5 rounded-2xl bg-slate-800/60 backdrop-blur-xs border border-cyan-500/20">
            <span className="text-[11px] font-bold text-cyan-300 block">Tổng Học Sinh</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white">{stats.total}</span>
              <span className="text-xs text-slate-400">thí sinh</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 backdrop-blur-xs border border-emerald-500/20">
            <span className="text-[11px] font-bold text-emerald-300 block">Đã Hoàn Thành</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-400">{stats.takenCount}</span>
              <span className="text-xs text-emerald-200">({stats.completionRate}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 backdrop-blur-xs border border-amber-500/20">
            <span className="text-[11px] font-bold text-amber-300 block">Điểm Trung Bình (Hệ 10)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-amber-400">{stats.avgScore10}</span>
              <span className="text-xs text-slate-400">/ 10.0</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 backdrop-blur-xs border border-purple-500/20">
            <span className="text-[11px] font-bold text-purple-300 block">Cao Nhất / Thấp Nhất</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-purple-300">{stats.maxScore10}</span>
              <span className="text-xs text-slate-400">/ {stats.minScore10}đ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Controls Header */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                <i className="fa-solid fa-filter"></i>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Bộ Lọc Điểm Thi & Báo Cáo</h3>
                <p className="text-xs text-slate-500">Lọc nhanh theo trường, khối, lớp và kết quả làm bài</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateDemoScores}
                title="Tạo điểm thi ngẫu nhiên thực tế để kiểm tra báo cáo"
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <i className="fa-solid fa-dice"></i>
                <span>Tạo Điểm Mẫu Thử</span>
              </button>

              {canResetScores && (
                <button
                  type="button"
                  onClick={handleResetScores}
                  title="Xóa điểm thi theo bộ lọc để học sinh làm lại"
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Xóa Điểm Thi Lại</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* School Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Trường học:</label>
              <select
                value={filterSchool}
                onChange={(e) => {
                  setFilterSchool(e.target.value);
                  setFilterClass('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-600"
              >
                <option value="ALL">-- Tất cả trường ({schools.length}) --</option>
                {schools.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Khối:</label>
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value);
                  setFilterClass('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-600"
              >
                <option value="ALL">-- Tất cả khối --</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lớp:</label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-600"
              >
                <option value="ALL">-- Tất cả lớp --</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kết quả thi:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-600"
              >
                <option value="all">Tất cả ({students.length})</option>
                <option value="taken">Đã nộp bài ({stats.takenCount})</option>
                <option value="not_taken">Chưa thi ({stats.total - stats.takenCount})</option>
                <option value="high_score">Điểm Giỏi (Từ 8.0đ trở lên)</option>
              </select>
            </div>

            {/* Search Keyword */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tìm học sinh:</label>
              <div className="relative">
                <input
                  type="text"
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  placeholder="Nhập tên hoặc mã HS..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-600"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3 w-28">Mã HS</th>
                <th className="py-3 px-4">Họ và Tên</th>
                <th className="py-3 px-3">Trường</th>
                <th className="py-3 px-2 w-20 text-center">Khối / Lớp</th>
                <th className="py-3 px-3 text-center">Listening</th>
                <th className="py-3 px-3 text-center">Reading & Writing</th>
                <th className="py-3 px-3 text-center">Điểm Bài Thi</th>
                <th className="py-3 px-3 text-center">Hệ 10</th>
                <th className="py-3 px-3 text-center">Thời Gian Nộp</th>
                <th className="py-3 px-3 text-center w-36">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                    <i className="fa-solid fa-inbox text-3xl mb-2 block opacity-40"></i>
                    Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu, index) => {
                  const hasTaken = stu.score !== null && typeof stu.score !== 'undefined';
                  const listeningSection = stu.sectionScores?.['listening'];
                  const rwSection = stu.sectionScores?.['reading-writing'];

                  return (
                    <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {stu.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {stu.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[160px]" title={stu.school}>
                        {stu.school}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {stu.className}
                        </span>
                      </td>

                      {/* Listening */}
                      <td className="py-3 px-3 text-center">
                        {listeningSection ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold text-[11px] border border-blue-200">
                            {listeningSection.earnedPoints} / {listeningSection.totalPoints}đ
                          </span>
                        ) : hasTaken ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">Chưa thi</span>
                        )}
                      </td>

                      {/* Reading & Writing */}
                      <td className="py-3 px-3 text-center">
                        {rwSection ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                            {rwSection.earnedPoints} / {rwSection.totalPoints}đ
                          </span>
                        ) : hasTaken ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">Chưa thi</span>
                        )}
                      </td>

                      {/* Score Raw */}
                      <td className="py-3 px-3 text-center">
                        {hasTaken ? (
                          <span className="font-black text-slate-900 text-xs">
                            {stu.score} <span className="text-slate-400 font-normal">/ {stu.total}đ</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Chưa thi
                          </span>
                        )}
                      </td>

                      {/* Score 10 */}
                      <td className="py-3 px-3 text-center">
                        {hasTaken && stu.points10 ? (
                          <span
                            className={`px-2.5 py-1 rounded-xl font-black text-xs inline-block ${
                              parseFloat(stu.points10) >= 8.0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : parseFloat(stu.points10) >= 6.5
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : parseFloat(stu.points10) >= 5.0
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {stu.points10}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3 px-3 text-center text-slate-500 text-[11px] font-mono">
                        {stu.submittedAt || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        {hasTaken ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewFilter('all');
                                setSelectedStudentDetail(stu);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-xs border border-cyan-200 transition cursor-pointer flex items-center gap-1"
                              title="Xem bài làm chi tiết từng câu (đối chiếu câu đúng/sai)"
                            >
                              <i className="fa-solid fa-file-circle-check text-[11px]"></i>
                              <span>Xem bài &amp; điểm</span>
                            </button>

                            {canResetScores && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleStudentScore(stu)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                                title="Xóa điểm để thí sinh này được làm lại bài thi từ đầu"
                              >
                                <i className="fa-solid fa-rotate-left text-[11px]"></i>
                                <span>Thi lại</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">Chưa có bài</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Đang hiển thị <strong>{filteredStudents.length}</strong> / {students.length} học sinh
          </span>
          <span>
            Có <strong>{stats.takenCount}</strong> học sinh đã hoàn thành bài thi có điểm số
          </span>
        </div>
      </div>

      {/* Student Detail & Question-by-Question Review Modal */}
      {selectedStudentDetail && (() => {
        const matchedExam: GradeExamProfile =
          (selectedStudentDetail.examId && gradeExams.find((e) => e.id === selectedStudentDetail.examId)) ||
          (gradeExams.length > 0
            ? findExamForStudent(gradeExams, selectedStudentDetail, activeExamId)
            : {
                id: activeExamId || 'active',
                grade: selectedStudentDetail.grade,
                title: 'Đề thi hiện tại',
                examMinutes: 45,
                parts,
                questions
              });

        const examParts = matchedExam.parts || parts;
        const examQuestions = matchedExam.questions || questions;
        const detailsMap: Record<string, any> = (selectedStudentDetail.details as Record<string, any>) || {};
        const qScoresMap: Record<string, number> = (selectedStudentDetail.questionScores as Record<string, number>) || {};
        const hasDetailedAnswers = Object.keys(detailsMap).length > 0 || Object.keys(qScoresMap).length > 0;

        const formatAnswerSummary = (q: Question, qIdx: number) => {
          const rawAns = detailsMap[qIdx] !== undefined ? detailsMap[qIdx] : detailsMap[String(qIdx)];
          const maxPts = q.points ?? 0.5;
          const earned = qScoresMap[qIdx] !== undefined ? Number(qScoresMap[qIdx]) : (qScoresMap[String(qIdx)] !== undefined ? Number(qScoresMap[String(qIdx)]) : null);

          let studentText = 'Chưa trả lời';
          let correctText = '';
          const subChecks: { label: string; studentVal: string; correctVal: string; ok: boolean }[] = [];

          if (q.type === 'multiple-choice' || q.type === 'yes-no' || q.type === 'listening') {
            const opts = q.options || [];
            if (typeof rawAns === 'number' && opts[rawAns]) {
              const letter = String.fromCharCode(65 + rawAns);
              studentText = `${letter}. ${opts[rawAns].text || '(Hình ảnh)'}`;
            } else if (typeof rawAns === 'number') {
              studentText = `Phương án ${String.fromCharCode(65 + rawAns)}`;
            }
            const cIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
            correctText = opts[cIdx]
              ? `${String.fromCharCode(65 + cIdx)}. ${opts[cIdx].text || '(Hình ảnh)'}`
              : `Phương án ${String.fromCharCode(65 + cIdx)}`;
          } else if (q.type === 'multi-choice') {
            const opts = q.options || [];
            if (Array.isArray(rawAns) && rawAns.length > 0) {
              studentText = rawAns
                .map((i: number) => `${String.fromCharCode(65 + i)}${opts[i]?.text ? `. ${opts[i].text}` : ''}`)
                .join(' | ');
            }
            correctText = (q.correctIndices || [])
              .map((i) => `${String.fromCharCode(65 + i)}${opts[i]?.text ? `. ${opts[i].text}` : ''}`)
              .join(' | ');
          } else if (q.type === 'tick-cross') {
            if (typeof rawAns === 'boolean') {
              studentText = rawAns ? '✔ Tick (Đúng)' : '✘ Cross (Sai)';
            }
            correctText = (q.isTick ?? true) ? '✔ Tick (Đúng)' : '✘ Cross (Sai)';
          } else if (q.type === 'unscramble-word') {
            studentText = rawAns ? String(rawAns) : 'Chưa điền';
            correctText =
              q.unscramble?.targetWord ||
              q.unscrambleTarget ||
              q.answerText ||
              (q.acceptableAnswers && q.acceptableAnswers[0]) ||
              '';
          } else if (q.type === 'listen-write') {
            studentText = rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '' ? String(rawAns) : 'Chưa điền';
            correctText = (q.acceptableAnswers || []).join(' / ') || q.answerText || '';
          } else if (q.type === 'fill-blanks') {
            const boxes = q.fillBlanks?.boxes || [];
            const uMap = (rawAns && typeof rawAns === 'object' ? rawAns : {}) as Record<string, string>;
            boxes.forEach((box, bIdx) => {
              const uVal = String(uMap[bIdx] ?? uMap[String(bIdx)] ?? '').trim();
              const ok = box.answers.some((a) => a.trim().toLowerCase() === uVal.toLowerCase());
              subChecks.push({
                label: `Ô (${bIdx + 1})`,
                studentVal: uVal || '(Trống)',
                correctVal: box.answers.join(' / '),
                ok
              });
            });
            studentText = subChecks.map((s) => `${s.label}: ${s.studentVal}`).join(' • ') || 'Chưa điền';
            correctText = subChecks.map((s) => `${s.label}: ${s.correctVal}`).join(' • ');
          } else if (q.type === 'story-word-bank') {
            const answersMap = q.storyBank?.answers || {};
            const sbBreakdown = getStoryWordBankPointBreakdown(q.storyBank, maxPts);
            const uMap = (rawAns && typeof rawAns === 'object' ? rawAns : {}) as Record<string, string>;
            const slots = Object.keys(answersMap).filter((k) => k !== '0').sort((a, b) => Number(a) - Number(b));
            slots.forEach((slot) => {
              const uVal = String(uMap[slot] || '').trim();
              const cVal = String(answersMap[slot] || '').trim();
              const slotPts = sbBreakdown.slotPointsMap[slot] ?? 0;
              subChecks.push({
                label: `Chỗ trống (${slot}) (${formatPointsClean(slotPts)}đ)`,
                studentVal: uVal || '(Trống)',
                correctVal: cVal,
                ok: uVal.toLowerCase() === cVal.toLowerCase()
              });
            });
            studentText = subChecks.map((s) => `${s.label.split(' ')[2] || ''} ${s.studentVal}`).join(' • ') || 'Chưa điền';
            correctText = subChecks.map((s) => `${s.label.split(' ')[2] || ''} ${s.correctVal}`).join(' • ');
          } else if (q.type === 'connect-pairs') {
            const norm = (p: [string, string]) => (p[0] < p[1] ? `${p[0]} ↔ ${p[1]}` : `${p[1]} ↔ ${p[0]}`);
            const targetPairs = q.connectPairs?.pairs || [];
            const exPair =
              q.connectPairs?.examplePair ||
              (q.connectPairs?.pairs && q.connectPairs.pairs.length > 1 ? q.connectPairs.pairs[0] : null);
            const exNorm = exPair ? norm(exPair) : null;
            const requiredPairs = exNorm ? targetPairs.filter((p) => norm(p) !== exNorm) : targetPairs;
            const userPairs: [string, string][] = Array.isArray(rawAns) ? rawAns : [];
            const providedPairs = exNorm ? userPairs.filter((p) => Array.isArray(p) && p.length >= 2 && norm(p) !== exNorm) : userPairs;
            const targetSet = new Set(requiredPairs.map(norm));

            providedPairs.forEach((p) => {
              const n = norm(p);
              subChecks.push({
                label: `Cặp nối ${p[0]} → ${p[1]}`,
                studentVal: `${p[0]} → ${p[1]}`,
                correctVal: targetSet.has(n) ? 'Đúng cặp' : 'Nối sai cặp',
                ok: targetSet.has(n)
              });
            });
            const providedSet = new Set(providedPairs.map(norm));
            requiredPairs.forEach((rp) => {
              if (!providedSet.has(norm(rp))) {
                subChecks.push({
                  label: `Thiếu cặp ${rp[0]} → ${rp[1]}`,
                  studentVal: '(Chưa nối)',
                  correctVal: `${rp[0]} → ${rp[1]}`,
                  ok: false
                });
              }
            });

            studentText = providedPairs.length > 0 ? providedPairs.map((p) => `${p[0]}→${p[1]}`).join(', ') : 'Chưa nối cặp nào';
            correctText = requiredPairs.map((p) => `${p[0]}→${p[1]}`).join(', ');
          } else if (q.type === 'listen-colour') {
            const allItems = q.listenColour?.items || [];
            const items = allItems.filter((it) => !it.isExample);
            const lcBreakdown = getListenColourPointBreakdown(allItems, maxPts);
            const uMap = (rawAns && typeof rawAns === 'object' ? rawAns : {}) as Record<string, string>;
            items.forEach((it) => {
              const uColor = String(uMap[it.id] || '').trim();
              const ok = isColorMatch(uColor, it.targetColor);
              const dotPts = lcBreakdown.itemPointsMap[it.id] ?? 0;
              subChecks.push({
                label: `${it.label} (${formatPointsClean(dotPts)}đ)`,
                studentVal: uColor || '(Chưa tô)',
                correctVal: it.targetColorName ? `${it.targetColorName} (${it.targetColor})` : it.targetColor,
                ok
              });
            });
            studentText = subChecks.map((s) => `${s.label}: ${s.studentVal}`).join(' • ') || 'Chưa tô màu';
            correctText = subChecks.map((s) => `${s.label}: ${s.correctVal}`).join(' • ');
          }

          const status: 'correct' | 'partial' | 'wrong' =
            earned === null
              ? 'wrong'
              : earned >= maxPts - 0.001
              ? 'correct'
              : earned > 0
              ? 'partial'
              : 'wrong';

          return { earned, maxPts, studentText, correctText, subChecks, status };
        };

        const reviewItems = examQuestions
          .map((q, qIdx) => {
            const part = examParts.find((pt) => pt.id === (q.partId || examParts[0]?.id)) || examParts[0];
            const isEx = Boolean(q.isExample || isQuestionExample(q, part));
            const summary = formatAnswerSummary(q, qIdx);
            return { q, qIdx, part, isEx, ...summary };
          })
          .filter((item) => !item.isEx);

        const correctQuestionsCount = reviewItems.filter((i) => i.status === 'correct').length;
        const wrongQuestionsCount = reviewItems.filter((i) => i.status !== 'correct').length;

        const filteredReviewItems = reviewItems.filter((item) => {
          if (reviewFilter === 'wrong') return item.status !== 'correct';
          if (reviewFilter === 'correct') return item.status === 'correct';
          return true;
        });

        const handleDownloadReviewReceipt = () => {
          const escapeHtml = (str: string) =>
            String(str || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

          const rowsHtml = reviewItems
            .map((it, idx) => {
              const statusLabel =
                it.status === 'correct' ? 'ĐÚNG' : it.status === 'partial' ? 'ĐÚNG MỘT PHẦN' : 'SAI / MẤT ĐIỂM';
              const statusColor =
                it.status === 'correct' ? '#15803d' : it.status === 'partial' ? '#b45309' : '#b91c1c';
              return `<tr>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;"><strong>${escapeHtml(it.part?.title || '')}</strong><br/>${escapeHtml(it.q.q || '')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(it.studentText)}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;color:#15803d;font-weight:bold;">${escapeHtml(it.correctText)}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;color:${statusColor};">${statusLabel}<br/>(${it.earned ?? 0} / ${it.maxPts} đ)</td>
              </tr>`;
            })
            .join('');

          const receiptHtml = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Phiếu Đối Chiếu Bài Làm - ${escapeHtml(selectedStudentDetail.name)}</title></head>
<body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
  <h2 style="margin:0 0 6px 0;">PHIẾU ĐỐI CHIẾU BÀI LÀM &amp; ĐIỂM THI CHI TIẾT</h2>
  <p style="margin:4px 0;"><strong>Thí sinh:</strong> ${escapeHtml(selectedStudentDetail.name)} (${escapeHtml(selectedStudentDetail.id)}) • <strong>Lớp:</strong> ${escapeHtml(selectedStudentDetail.className)} • <strong>Trường:</strong> ${escapeHtml(selectedStudentDetail.school)}</p>
  <p style="margin:4px 0 16px 0;"><strong>Đề thi:</strong> ${escapeHtml(matchedExam.title)} • <strong>Tổng điểm:</strong> ${selectedStudentDetail.score}/${selectedStudentDetail.total} đ (Hệ 10: ${selectedStudentDetail.points10} đ) • <strong>Thời gian nộp:</strong> ${escapeHtml(selectedStudentDetail.submittedAt || '-')}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px;border:1px solid #cbd5e1;">Câu</th>
        <th style="padding:8px;border:1px solid #cbd5e1;">Phần &amp; Nội dung câu hỏi</th>
        <th style="padding:8px;border:1px solid #cbd5e1;">Bài làm của thí sinh</th>
        <th style="padding:8px;border:1px solid #cbd5e1;">Đáp án đúng</th>
        <th style="padding:8px;border:1px solid #cbd5e1;">Kết quả &amp; Điểm</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;

          const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `PhieuDoiChieu_${selectedStudentDetail.id}_${selectedStudentDetail.name.replace(/\s+/g, '_')}.html`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Đã tải Phiếu Đối Chiếu Bài Làm chi tiết từng câu!', 'success');
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              {/* Sticky Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-xl shrink-0">
                    <i className="fa-solid fa-file-circle-check"></i>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Bài Làm &amp; Điểm Chi Tiết: {selectedStudentDetail.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mã HS: <strong>{selectedStudentDetail.id}</strong> • Lớp {selectedStudentDetail.className} • {selectedStudentDetail.school} • Đề: <strong>{matchedExam.title}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentDetail(null)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Total Points Highlight */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Tổng Điểm Bài Thi</span>
                    <span className="text-xl font-black text-slate-900">
                      {selectedStudentDetail.score} / {selectedStudentDetail.total} đ
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Quy Đổi Hệ 10</span>
                    <span className="text-xl font-black text-cyan-600">
                      {selectedStudentDetail.points10 || '-'} đ
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Số Câu Đúng / Sai</span>
                    <span className="text-sm font-black block mt-1">
                      <span className="text-emerald-600">{correctQuestionsCount} đúng</span> •{' '}
                      <span className="text-rose-600">{wrongQuestionsCount} sai</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Thời Gian Nộp</span>
                    <span className="text-xs font-bold text-slate-700 block mt-1 font-mono">
                      {selectedStudentDetail.submittedAt || '-'}
                    </span>
                  </div>
                </div>

                {/* Breakdown by Skill & Parts */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                    1. Điểm Từng Kỹ Năng &amp; Phần Thi:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedStudentDetail.sectionScores?.['listening'] && (
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-headphones text-blue-600"></i>
                          <span className="text-xs font-bold text-blue-900">Listening</span>
                        </div>
                        <span className="text-xs font-black text-blue-800">
                          {selectedStudentDetail.sectionScores['listening'].earnedPoints} / {selectedStudentDetail.sectionScores['listening'].totalPoints} đ
                        </span>
                      </div>
                    )}

                    {selectedStudentDetail.sectionScores?.['reading-writing'] && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-book-open text-emerald-600"></i>
                          <span className="text-xs font-bold text-emerald-900">Reading &amp; Writing</span>
                        </div>
                        <span className="text-xs font-black text-emerald-800">
                          {selectedStudentDetail.sectionScores['reading-writing'].earnedPoints} / {selectedStudentDetail.sectionScores['reading-writing'].totalPoints} đ
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedStudentDetail.partScores && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.values(selectedStudentDetail.partScores).map((p) => (
                        <div key={p.partId} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 truncate pr-2" title={p.partTitle}>
                            {p.partTitle}
                          </span>
                          <span className="font-mono font-bold text-slate-900 shrink-0">
                            {p.earnedPoints} / {p.totalPoints} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Question-by-Question Review (For Dispute / Verification) */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        2. Đối Chiếu Bài Làm Từng Câu (Xem Chỗ Sai Để Giải Đáp Thắc Mắc):
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Hiển thị nguyên văn câu trả lời thí sinh đã chọn/viết so với đáp án chuẩn của đề thi.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setReviewFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                          reviewFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tất cả ({reviewItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewFilter('wrong')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                          reviewFilter === 'wrong' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        Câu sai / Mất điểm ({wrongQuestionsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewFilter('correct')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                          reviewFilter === 'correct' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        Câu đúng ({correctQuestionsCount})
                      </button>
                    </div>
                  </div>

                  {!hasDetailedAnswers ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
                      <i className="fa-solid fa-circle-info text-amber-600 text-base shrink-0"></i>
                      <span>
                        Bài điểm này được tạo từ chế độ điểm mẫu hoặc chấm trước khi bật lưu chi tiết từng câu. Với mọi thí sinh nộp bài thi mới, toàn bộ câu trả lời sẽ được lưu đầy đủ tại đây.
                      </span>
                    </div>
                  ) : filteredReviewItems.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                      🎉 Không có câu nào trong mục lọc này!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredReviewItems.map((item, displayIdx) => {
                        const isOk = item.status === 'correct';
                        const isPartial = item.status === 'partial';
                        return (
                          <div
                            key={`${item.q.id || item.qIdx}-${displayIdx}`}
                            className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                              isOk
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50/50 border-amber-300'
                                : 'bg-rose-50/60 border-rose-300'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                    isOk
                                      ? 'bg-emerald-600 text-white'
                                      : isPartial
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-rose-600 text-white'
                                  }`}
                                >
                                  {isOk ? '✔ ĐÚNG' : isPartial ? '◐ ĐÚNG 1 PHẦN' : '✘ SAI'}
                                </span>
                                <span className="font-extrabold text-slate-900">
                                  Câu {item.qIdx + 1}
                                </span>
                                {item.part && (
                                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                                    {item.part.title}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`font-mono font-black px-2 py-0.5 rounded-lg ${
                                  isOk
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.earned ?? 0} / {item.maxPts} đ
                              </span>
                            </div>

                            {item.q.q && (
                              <div className="font-semibold text-slate-800 leading-relaxed">
                                {item.q.q}
                              </div>
                            )}

                            {/* Sub-items breakdown for multi-blank / story-word-bank / connect-pairs / listen-colour */}
                            {item.subChecks.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {item.subChecks.map((sc, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                                      sc.ok
                                        ? 'bg-white border-emerald-200 text-emerald-900'
                                        : 'bg-white border-rose-300 text-rose-900'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-700">{sc.label}:</span>{' '}
                                      <span className={sc.ok ? 'font-bold text-emerald-700' : 'font-bold text-rose-700 line-through'}>
                                        {sc.studentVal}
                                      </span>
                                      {!sc.ok && (
                                        <span className="ml-1.5 font-extrabold text-emerald-700">
                                          ➔ Đáp án: {sc.correctVal}
                                        </span>
                                      )}
                                    </div>
                                    <span className="shrink-0 font-black">
                                      {sc.ok ? '✔' : '✘'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <div className={`p-2.5 rounded-xl border bg-white ${isOk ? 'border-emerald-200' : 'border-rose-300'}`}>
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                    Thí sinh đã làm:
                                  </span>
                                  <span className={`font-bold ${isOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {item.studentText}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-emerald-200 bg-white">
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                    Đáp án đúng của đề:
                                  </span>
                                  <span className="font-extrabold text-emerald-700">
                                    {item.correctText}
                                  </span>
                                </div>
                              </div>
                            )}

                            {item.q.explanation && (
                              <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900">
                                <strong>Giải thích:</strong> {item.q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {canResetScores && selectedStudentDetail.score !== null && typeof selectedStudentDetail.score !== 'undefined' && (
                    <button
                      type="button"
                      onClick={() => handleResetSingleStudentScore(selectedStudentDetail)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
                    >
                      <i className="fa-solid fa-rotate-left"></i>
                      <span>Xóa Điểm (Cho Thi Lại)</span>
                    </button>
                  )}
                  {hasDetailedAnswers && (
                    <button
                      type="button"
                      onClick={handleDownloadReviewReceipt}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
                    >
                      <i className="fa-solid fa-file-arrow-down"></i>
                      <span>Tải Phiếu Đối Chiếu (.html)</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentDetail(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
