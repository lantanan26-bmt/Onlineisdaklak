import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Student, ExamPart, PartScoreRecord, SectionScoreRecord, ExamSection } from '../types';

const getPartSection = (p?: ExamPart): ExamSection => {
  if (p?.section) return p.section;
  const t = (p?.title || '').toLowerCase();
  if (t.includes('listen') || t.includes('nghe')) return 'listening';
  return 'reading-writing';
};

interface StudentManagerProps {
  parts?: ExamPart[];
  schools: string[];
  students: Student[];
  onSchoolsChange: (schools: string[]) => void;
  onStudentsChange: (students: Student[]) => void;
  onQuickLogin: (student: Student) => void;
  onResetSampleStudents: () => void;
  onOpenCameraGrader?: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  parts = [],
  schools,
  students,
  onSchoolsChange,
  onStudentsChange,
  onQuickLogin,
  onResetSampleStudents,
  onOpenCameraGrader,
  showToast,
  openConfirm
}) => {
  // New school input
  const [newSchoolName, setNewSchoolName] = useState('');

  // Single student form
  const [stuId, setStuId] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuGrade, setStuGrade] = useState('Khối 2');
  const [stuClass, setStuClass] = useState('2A1');
  const [stuSchool, setStuSchool] = useState(schools[0] || '');

  // Excel import
  const [excelImportMode, setExcelImportMode] = useState<'merge' | 'replace'>('merge');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Filters
  const [filterSchool, setFilterSchool] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterKeyword, setFilterKeyword] = useState('');

  // Top stats
  const uniqueClassesCount = useMemo(() => {
    const set = new Set(students.map((s) => `${s.school}|${s.grade}|${s.className}`));
    return set.size;
  }, [students]);

  const completedCount = useMemo(() => {
    return students.filter((s) => s.score !== null && typeof s.score !== 'undefined').length;
  }, [students]);

  // Dynamic filter dropdown lists
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

  const filteredStudents = useMemo(() => {
    const kw = filterKeyword.trim().toLowerCase();
    return students.filter((s) => {
      if (filterSchool !== 'ALL' && s.school !== filterSchool) return false;
      if (filterGrade !== 'ALL' && s.grade !== filterGrade) return false;
      if (filterClass !== 'ALL' && s.className !== filterClass) return false;
      if (kw && !s.id.toLowerCase().includes(kw) && !s.name.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [students, filterSchool, filterGrade, filterClass, filterKeyword]);

  // Handlers for School
  const handleAddSchool = () => {
    const trimmed = newSchoolName.trim();
    if (!trimmed) return;
    if (schools.includes(trimmed)) {
      showToast('Tên trường đã tồn tại!', 'warn');
      return;
    }
    const next = [...schools, trimmed];
    onSchoolsChange(next);
    setNewSchoolName('');
    showToast(`Đã thêm trường "${trimmed}"`);
  };

  const handleDeleteSchool = (schoolName: string) => {
    if (schools.length <= 1) {
      showToast('Cần ít nhất 1 trường trong danh sách!', 'warn');
      return;
    }
    const studentCountInSchool = students.filter((s) => s.school === schoolName).length;
    openConfirm(
      `Xác nhận xóa trường "${schoolName}"?`,
      `CẢNH BÁO: Xóa trường này sẽ ĐỒNG THỜI XÓA TOÀN BỘ ${studentCountInSchool} học sinh thuộc trường "${schoolName}" và mọi kết quả thi liên quan khỏi hệ thống. Bạn có chắc chắn muốn xóa không?`,
      () => {
        const nextSchools = schools.filter((s) => s !== schoolName);
        const nextStudents = students.filter((s) => s.school !== schoolName);
        onSchoolsChange(nextSchools);
        onStudentsChange(nextStudents);

        if (filterSchool === schoolName) {
          setFilterSchool('ALL');
          setFilterClass('ALL');
        }
        if (stuSchool === schoolName) {
          setStuSchool(nextSchools[0] || '');
        }

        showToast(`Đã xóa trường "${schoolName}" và toàn bộ ${studentCountInSchool} học sinh thuộc trường!`, 'warn');
      }
    );
  };

  // Generate random student ID
  const handleGenerateId = () => {
    const numMatch = stuGrade.match(/\d+/);
    const gradeNum = numMatch ? numMatch[0] : '2';
    let candidate = '';
    do {
      candidate = `HS${gradeNum}${Math.floor(100 + Math.random() * 900)}`;
    } while (students.some((s) => s.id.toUpperCase() === candidate));
    setStuId(candidate);
  };

  // Add single student
  const handleAddSingleStudent = () => {
    const idClean = stuId.trim().toUpperCase();
    const nameClean = stuName.trim();
    const classClean = stuClass.trim().toUpperCase();
    const chosenSchool = stuSchool || schools[0] || 'TH iSMART';

    if (!idClean || !nameClean || !classClean) {
      showToast('Vui lòng điền đủ Mã ID, Họ tên và Lớp!', 'warn');
      return;
    }

    if (students.some((s) => s.id.toUpperCase() === idClean)) {
      showToast(`Mã ID ${idClean} đã tồn tại trong danh sách!`, 'warn');
      return;
    }

    const newStudent: Student = {
      id: idClean,
      name: nameClean,
      grade: stuGrade,
      className: classClean,
      school: chosenSchool,
      score: null,
      total: null,
      points10: null,
      submittedAt: null
    };

    onStudentsChange([newStudent, ...students]);
    setStuId('');
    setStuName('');
    showToast(`Đã thêm học sinh ${nameClean} (${idClean})!`);
  };

  // Excel template download
  const handleDownloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['DANH SÁCH HỌC SINH THAM GIA THI - iSMART LMS'],
      ['HƯỚNG DẪN: Không thay đổi tiêu đề cột ở Dòng 3'],
      ['STT', 'Mã ID', 'Họ và Tên', 'Khối', 'Lớp', 'Trường'],
      [1, 'HS2001', 'Nguyễn Minh An', 'Khối 2', '2A1', 'TH Quốc Tế iSMART'],
      [2, 'HS2002', 'Trần Hà My', 'Khối 2', '2A1', 'TH Quốc Tế iSMART'],
      [3, 'HS2003', 'Lê Hoàng Bảo', 'Khối 2', '2A2', 'TH Quốc Tế iSMART'],
      [4, 'HS3001', 'Phạm Gia Huy', 'Khối 3', '3B1', 'TH Nguyễn Bỉnh Khiêm'],
      [5, 'HS4001', 'Đặng Tuấn Kiệt', 'Khối 4', '4A1', 'TH Lê Quý Đôn']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Hoc_Sinh');
    XLSX.writeFile(wb, 'Mau_Nhap_Hoc_Sinh_iSMART.xlsx');
    showToast('Đã tải xuống file Excel mẫu!');
  };

  // Handle Excel upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const rowStr = rows[i].map((c) => String(c).toLowerCase()).join(' ');
          if (rowStr.includes('họ') || rowStr.includes('tên') || rowStr.includes('mã')) {
            headerRowIndex = i;
            break;
          }
        }

        const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;
        const newStudentsList: Student[] = [];
        const detectedSchools = new Set<string>();

        for (let i = dataStartIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          // Attempt to extract fields
          // Headers: STT, Mã ID, Họ và Tên, Khối, Lớp, Trường
          let id = '';
          let name = '';
          let grade = 'Khối 2';
          let className = '2A1';
          let school = schools[0] || 'TH iSMART';

          if (row[1] && row[2]) {
            id = String(row[1]).trim().toUpperCase();
            name = String(row[2]).trim();
            if (row[3]) grade = String(row[3]).trim();
            if (row[4]) className = String(row[4]).trim().toUpperCase();
            if (row[5]) school = String(row[5]).trim();
          } else if (row[0] && row[1] && isNaN(+row[0])) {
            id = String(row[0]).trim().toUpperCase();
            name = String(row[1]).trim();
            if (row[2]) grade = String(row[2]).trim();
            if (row[3]) className = String(row[3]).trim().toUpperCase();
            if (row[4]) school = String(row[4]).trim();
          }

          if (name) {
            if (!id) id = `HS2${Math.floor(100 + Math.random() * 900)}`;
            newStudentsList.push({
              id,
              name,
              grade,
              className,
              school,
              score: null,
              total: null,
              points10: null,
              submittedAt: null
            });
            if (school) detectedSchools.add(school);
          }
        }

        if (newStudentsList.length === 0) {
          setImportNotice('Không tìm thấy dữ liệu học sinh hợp lệ trong file!');
          showToast('File không chứa dữ liệu học sinh hợp lệ!', 'warn');
          return;
        }

        // Add any new schools found
        if (detectedSchools.size > 0) {
          const mergedSchools = Array.from(new Set([...schools, ...Array.from(detectedSchools)]));
          onSchoolsChange(mergedSchools);
        }

        if (excelImportMode === 'replace') {
          onStudentsChange(newStudentsList);
          setImportNotice(`Đã thay mới danh sách bằng ${newStudentsList.length} học sinh từ file Excel!`);
          showToast(`Đã thay mới ${newStudentsList.length} học sinh!`);
        } else {
          // Merge mode: update existing by ID, append new
          const map = new Map<string, Student>();
          students.forEach((s) => map.set(s.id.toUpperCase(), s));
          let addedCount = 0;
          let updatedCount = 0;

          newStudentsList.forEach((s) => {
            const key = s.id.toUpperCase();
            if (map.has(key)) {
              const existing = map.get(key)!;
              map.set(key, { ...existing, ...s });
              updatedCount++;
            } else {
              map.set(key, s);
              addedCount++;
            }
          });

          const finalList = Array.from(map.values());
          onStudentsChange(finalList);
          setImportNotice(`Gộp thành công: +${addedCount} học sinh mới, cập nhật ${updatedCount} học sinh cũ.`);
          showToast(`Đã gộp ${newStudentsList.length} học sinh từ Excel!`);
        }
      } catch (err) {
        showToast('Có lỗi khi xử lý file Excel!', 'error');
        setImportNotice('Lỗi: File Excel không đúng định dạng!');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* System Persistence Indicator */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
          <i className="fa-solid fa-database text-emerald-600"></i>
          <span>CSDL Hệ Thống: Danh sách học sinh & trường lớp được lưu trữ vĩnh viễn trên hệ thống (IndexedDB & LocalStorage).</span>
        </div>
        <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
          <i className="fa-solid fa-shield-check mr-1"></i>Tự động sao lưu & đồng bộ
        </span>
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-school"></i>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Tổng số Trường</div>
            <div className="text-2xl font-black text-slate-900">{schools.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Số Khối / Lớp</div>
            <div className="text-2xl font-black text-slate-900">{uniqueClassesCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-user-graduate"></i>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Tổng Học Sinh (Có ID)</div>
            <div className="text-2xl font-black text-slate-900">{students.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Đã hoàn thành bài thi</div>
            <div className="text-2xl font-black text-slate-900">
              {completedCount} / {students.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Management Tools (Left) & Filter/Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: School Management, Add Student, Excel Import */}
        <div className="lg:col-span-5 space-y-4">
          {/* School Management */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-building-columns text-blue-600"></i> Quản lý Danh sách Trường
              </h3>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Xóa trường sẽ xóa toàn bộ học sinh của trường đó
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSchool()}
                placeholder="Nhập tên trường mới..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
              <button
                type="button"
                onClick={handleAddSchool}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition cursor-pointer"
              >
                <i className="fa-solid fa-plus mr-1"></i>Thêm Trường
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {schools.map((sc, sidx) => {
                const countInSchool = students.filter((s) => s.school === sc).length;
                return (
                  <div
                    key={sidx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold"
                  >
                    <span>
                      🏫 {sc} ({countInSchool} HS)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSchool(sc)}
                      className="w-4 h-4 rounded-full hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center transition cursor-pointer"
                      title={`Xóa trường "${sc}" và toàn bộ ${countInSchool} học sinh của trường`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Single Student */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-emerald-600"></i> Thêm Học Sinh Mới (Cấp ID Dự Thi)
              </h3>
              <button
                type="button"
                onClick={handleGenerateId}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>Tạo mã ID ngẫu nhiên
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã ID Học Sinh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={stuId}
                  onChange={(e) => setStuId(e.target.value.toUpperCase())}
                  placeholder="VD: HS2001"
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và Tên Học Sinh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  placeholder="VD: Nguyễn Minh An"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Khối Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={stuGrade}
                  onChange={(e) => setStuGrade(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Khối 1">Khối 1</option>
                  <option value="Khối 2">Khối 2</option>
                  <option value="Khối 3">Khối 3</option>
                  <option value="Khối 4">Khối 4</option>
                  <option value="Khối 5">Khối 5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={stuClass}
                  onChange={(e) => setStuClass(e.target.value.toUpperCase())}
                  placeholder="VD: 2A1..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trường <span className="text-red-500">*</span>
                </label>
                <select
                  value={stuSchool}
                  onChange={(e) => setStuSchool(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {schools.map((s, idx) => (
                    <option key={idx} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddSingleStudent}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <i className="fa-solid fa-plus-circle"></i> Thêm Học Sinh Vào Danh Sách Thi
            </button>
          </div>

          {/* Excel Import Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-file-excel text-emerald-600 text-base"></i> Nhập Nhanh Số Lượng Lớn Từ File Excel
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11px]">
                Khuyên dùng
              </span>
            </div>

            {/* Step 1: Download Template */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-black">
                    1
                  </span>
                  <span>Tải file Excel mẫu chuẩn</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-file-arrow-down"></i> Tải File Mẫu (.xlsx)
                </button>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                File mẫu gồm các cột: <strong>Mã ID</strong>, <strong>Họ và Tên</strong>, <strong>Khối</strong>,{' '}
                <strong>Lớp</strong>, <strong>Trường</strong>.
              </p>
            </div>

            {/* Step 2: Upload Excel File */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
              <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-black">
                  2
                </span>
                <span>Chọn file Excel danh sách học sinh</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="excelImportMode"
                    value="merge"
                    checked={excelImportMode === 'merge'}
                    onChange={() => setExcelImportMode('merge')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Gộp thêm & cập nhật</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-red-700">
                  <input
                    type="radio"
                    name="excelImportMode"
                    value="replace"
                    checked={excelImportMode === 'replace'}
                    onChange={() => setExcelImportMode('replace')}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>Xóa cũ & thay mới</span>
                </label>
              </div>

              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl bg-white hover:bg-emerald-50/40 cursor-pointer transition text-center group">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg mb-1.5 group-hover:scale-105 transition">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <span className="text-xs font-extrabold text-emerald-800">
                  Nhấn vào đây để chọn file Excel (.xlsx, .xls)
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelUpload}
                />
              </label>

              {importNotice && (
                <div className="p-2.5 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                  <span>{importNotice}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Filter Bar & Table of Students */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Danh Sách Học Sinh Theo Trường & Lớp
              </h3>
              <p className="text-xs text-slate-500">
                Quản lý hồ sơ học sinh, phân khối lớp và cấp quyền dự thi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                Tổng: {students.length} học sinh
              </span>
              <button
                type="button"
                onClick={onResetSampleStudents}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                title="Khôi phục danh sách mẫu"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span className="hidden sm:inline">Đặt lại mẫu</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Lọc theo Trường</label>
              <select
                value={filterSchool}
                onChange={(e) => {
                  setFilterSchool(e.target.value);
                  setFilterClass('ALL');
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">-- Tất cả Trường --</option>
                {schools.map((s, idx) => (
                  <option key={idx} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Lọc theo Khối</label>
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value);
                  setFilterClass('ALL');
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">-- Tất cả Khối --</option>
                {availableGrades.map((g, idx) => (
                  <option key={idx} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Lọc theo Lớp</label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">-- Tất cả Lớp --</option>
                {availableClasses.map((c, idx) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Tìm Mã ID / Họ tên</label>
              <input
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="Gõ ID hoặc tên..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Filter summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <i className="fa-solid fa-users text-blue-600"></i>
              <span>
                Hiển thị: <strong>{filteredStudents.length}</strong> / {students.length} học sinh
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Điểm số và xuất báo cáo được quản lý riêng tại tab <strong>"3. Bảng Điểm & Xuất Điểm"</strong>
            </span>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] font-extrabold">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Mã ID</th>
                  <th className="p-3">Họ và Tên</th>
                  <th className="p-3">Khối / Lớp</th>
                  <th className="p-3">Trường</th>
                  <th className="p-3 text-center">Trạng Thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                      Không tìm thấy học sinh nào theo bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, idx) => {
                    const hasTaken = stu.score !== null && typeof stu.score !== 'undefined';
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50/90 transition">
                        <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-mono font-bold text-xs">
                            {stu.id}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{stu.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                            {stu.grade} - {stu.className}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">{stu.school}</td>
                        <td className="p-3 text-center">
                          {hasTaken ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1">
                              <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]"></i>
                              Đã nộp bài
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-[11px] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Sẵn sàng thi
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onQuickLogin(stu)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer"
                            title="Đăng nhập thử cho học sinh này"
                          >
                            Thi ngay
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openConfirm(
                                `Xóa học sinh ${stu.name} (${stu.id})?`,
                                `Học sinh này sẽ bị xóa khỏi danh sách dự thi.`,
                                () => {
                                  const next = students.filter((x) => x.id !== stu.id);
                                  onStudentsChange(next);
                                  showToast(`Đã xóa học sinh ${stu.name}`);
                                }
                              );
                            }}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold text-[11px] ml-1 transition cursor-pointer"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
