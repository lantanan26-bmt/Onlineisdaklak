import React, { useState } from 'react';
import { Teacher, TeacherPermission } from '../types';

interface TeacherManagerProps {
  teachers: Teacher[];
  onUpdateTeachers: (teachers: Teacher[]) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  openConfirm: (title: string, message: string, onOk: () => void) => void;
}

const PERMISSION_CONFIG: {
  id: TeacherPermission;
  label: string;
  icon: string;
  color: string;
  desc: string;
}[] = [
  {
    id: 'edit_exam',
    label: 'Soạn Đề & Câu Hỏi',
    icon: 'fa-solid fa-pen-to-square',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'Tạo, sửa đề thi theo khối/lớp, thêm câu hỏi, nạp audio, vẽ Cambridge, sửa điểm'
  },
  {
    id: 'manage_students',
    label: 'DS Học Sinh & Trường',
    icon: 'fa-solid fa-users-gear',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'Nhập học sinh từ file Excel, thêm/sửa/xóa thí sinh, quản lý danh sách trường lớp'
  },
  {
    id: 'view_scores',
    label: 'Bảng Điểm & Xuất Kết Quả',
    icon: 'fa-solid fa-chart-line',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    desc: 'Xem bảng điểm thi học sinh, thống kê theo khối/lớp, chi tiết bài làm, xuất file Excel'
  },
  {
    id: 'camera_grader',
    label: 'Chấm Bài Camera AI',
    icon: 'fa-solid fa-camera',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'Quét và chấm điểm tự động bài thi giấy qua webcam hoặc camera điện thoại'
  },
  {
    id: 'print_offline',
    label: 'In Đề & Phiếu Offline',
    icon: 'fa-solid fa-print',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'Xuất bản in đề thi giấy và phiếu trả lời trắc nghiệm chuẩn khổ A4'
  },
  {
    id: 'import_pdf',
    label: 'Nạp Đề Từ File PDF',
    icon: 'fa-solid fa-file-pdf',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Trích xuất tự động các phần thi và câu hỏi từ tài liệu PDF đề thi'
  },
  {
    id: 'test_run',
    label: 'Test Chạy Thử Đề Thi',
    icon: 'fa-solid fa-vial-virus',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    desc: 'Mô phỏng làm bài thi thực tế của học sinh để kiểm tra audio, vẽ nối và chấm điểm'
  },
  {
    id: 'view_json',
    label: 'Cấu Hình & Link Thi',
    icon: 'fa-solid fa-code',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    desc: 'Xem mã nguồn JSON của đề thi, xuất cấu hình và lấy link chia sẻ đề thi'
  },
  {
    id: 'reset_scores',
    label: 'Xóa Điểm (Cho Thi Lại)',
    icon: 'fa-solid fa-rotate-left',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Cho phép xóa điểm thi của học sinh (từng em hoặc cả lớp) để học sinh được thi lại bài thi'
  }
];

const AVAILABLE_GRADES = ['Khối 1', 'Khối 2', 'Khối 3', 'Khối 4', 'Khối 5'];

export const TeacherManager: React.FC<TeacherManagerProps> = ({
  teachers,
  onUpdateTeachers,
  showToast,
  openConfirm
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    username: string;
    password: string;
    email: string;
    phone: string;
    assignedGrades: string[];
    permissions: TeacherPermission[];
    isActive: boolean;
  }>({
    id: '',
    name: '',
    username: '',
    password: '123',
    email: '',
    phone: '',
    assignedGrades: ['Khối 2'],
    permissions: ['edit_exam', 'test_run'],
    isActive: true
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const nextNum = teachers.length + 1;
    const autoId = `GV${String(nextNum).padStart(2, '0')}`;
    setEditingTeacher(null);
    setFormData({
      id: autoId,
      name: '',
      username: `gv_${nextNum}`,
      password: '123',
      email: '',
      phone: '',
      assignedGrades: ['Khối 2'],
      permissions: ['edit_exam', 'test_run'],
      isActive: true
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      id: teacher.id,
      name: teacher.name,
      username: teacher.username,
      password: teacher.password,
      email: teacher.email || '',
      phone: teacher.phone || '',
      assignedGrades: teacher.assignedGrades || ['Khối 2'],
      permissions: [...teacher.permissions],
      isActive: teacher.isActive
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Toggle single permission
  const handleTogglePermission = (perm: TeacherPermission) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm]
      };
    });
  };

  // Toggle grade assignment
  const handleToggleGrade = (grade: string) => {
    setFormData((prev) => {
      const exists = prev.assignedGrades.includes(grade);
      return {
        ...prev,
        assignedGrades: exists
          ? prev.assignedGrades.filter((g) => g !== grade)
          : [...prev.assignedGrades, grade]
      };
    });
  };

  // Apply quick permission presets
  const applyPreset = (preset: 'all' | 'exam_only' | 'homeroom' | 'scores_only') => {
    if (preset === 'all') {
      setFormData((prev) => ({
        ...prev,
        permissions: PERMISSION_CONFIG.map((p) => p.id)
      }));
      showToast('Đã cấp toàn bộ quyền cho giáo viên!');
    } else if (preset === 'exam_only') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['edit_exam', 'test_run', 'import_pdf']
      }));
      showToast('Đã chọn nhóm quyền Soạn Đề!');
    } else if (preset === 'homeroom') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['manage_students', 'view_scores', 'reset_scores', 'camera_grader', 'print_offline']
      }));
      showToast('Đã chọn nhóm quyền Chủ Nhiệm & Bảng Điểm (kèm quyền cho thi lại)!');
    } else if (preset === 'scores_only') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['view_scores', 'camera_grader']
      }));
      showToast('Đã chọn nhóm quyền Giám Thị & Xem Bảng Điểm!');
    }
  };

  // Save Modal
  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Vui lòng nhập Họ và tên giáo viên!');
      return;
    }
    const cleanUser = formData.username.trim().toLowerCase();
    if (!cleanUser) {
      setFormError('Vui lòng nhập Tên đăng nhập!');
      return;
    }
    if (!formData.password.trim()) {
      setFormError('Vui lòng nhập Mật khẩu cho giáo viên!');
      return;
    }

    // Check duplicate username
    const duplicate = teachers.find(
      (t) => t.username.toLowerCase() === cleanUser && t.id !== (editingTeacher?.id || '')
    );
    if (duplicate) {
      setFormError(`Tên đăng nhập "${cleanUser}" đã được giáo viên khác sử dụng! Vui lòng chọn tên khác.`);
      return;
    }

    if (formData.permissions.length === 0) {
      setFormError('Vui lòng cấp ít nhất 1 quyền chức năng cho giáo viên!');
      return;
    }

    if (editingTeacher) {
      // Update
      const updated = teachers.map((t) =>
        t.id === editingTeacher.id
          ? {
              ...t,
              name: formData.name.trim(),
              username: cleanUser,
              password: formData.password.trim(),
              email: formData.email.trim(),
              phone: formData.phone.trim(),
              assignedGrades: formData.assignedGrades,
              permissions: formData.permissions,
              isActive: formData.isActive
            }
          : t
      );
      onUpdateTeachers(updated);
      showToast(`✅ Đã lưu giáo viên ${formData.name.trim()} & toàn bộ phân quyền vĩnh viễn vào hệ thống!`, 'success');
    } else {
      // Create new
      const newTeacher: Teacher = {
        id: formData.id.trim() || `GV${Date.now().toString().slice(-4)}`,
        name: formData.name.trim(),
        username: cleanUser,
        password: formData.password.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        assignedGrades: formData.assignedGrades,
        permissions: formData.permissions,
        isActive: formData.isActive,
        createdAt: new Date().toLocaleDateString('vi-VN')
      };
      onUpdateTeachers([...teachers, newTeacher]);
      showToast(`✅ Đã thêm giáo viên ${newTeacher.name} & lưu phân quyền vĩnh viễn vào hệ thống!`, 'success');
    }

    setIsModalOpen(false);
  };

  // Toggle active status
  const handleToggleStatus = (teacherId: string) => {
    const target = teachers.find((t) => t.id === teacherId);
    if (!target) return;
    const newStatus = !target.isActive;
    const updated = teachers.map((t) => (t.id === teacherId ? { ...t, isActive: newStatus } : t));
    onUpdateTeachers(updated);
    showToast(
      newStatus
        ? `Đã kích hoạt tài khoản của ${target.name}!`
        : `Đã tạm khóa tài khoản của ${target.name}!`,
      newStatus ? 'success' : 'warn'
    );
  };

  // Delete Teacher
  const handleDeleteTeacher = (teacher: Teacher) => {
    openConfirm(
      'Xóa tài khoản giáo viên?',
      `Bạn có chắc chắn muốn xóa giáo viên "${teacher.name}" (@${teacher.username}) khỏi hệ thống không? Hành động này không thể hoàn tác.`,
      () => {
        const filtered = teachers.filter((t) => t.id !== teacher.id);
        onUpdateTeachers(filtered);
        showToast(`Đã xóa giáo viên ${teacher.name} khỏi hệ thống!`, 'info');
      }
    );
  };

  // Filtered teachers
  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      !searchTerm.trim() ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      t.username.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (t.phone && t.phone.includes(searchTerm.trim()));

    const matchesGrade =
      gradeFilter === 'all' || (t.assignedGrades && t.assignedGrades.includes(gradeFilter));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && t.isActive) ||
      (statusFilter === 'inactive' && !t.isActive);

    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div className="w-full space-y-6 animate-in fade-in pb-12">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-800">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                <i className="fa-solid fa-shield-halved"></i> Phân Quyền Vai Trò (RBAC)
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                <i className="fa-solid fa-database text-[11px]"></i> Đã lưu vĩnh viễn trên CSDL hệ thống
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Quản Lý Giáo Viên & Phân Quyền Hệ Thống
            </h2>
            <p className="text-xs sm:text-sm text-blue-200 leading-relaxed">
              Admin quản lý danh sách giáo viên và phân quyền chi tiết cho từng chức năng (Soạn đề, Thêm học sinh, Bảng điểm, Cho thi lại...). Mọi thông tin và quyền được lưu vĩnh viễn trên hệ thống.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 transition flex items-center gap-2.5 active:scale-95 cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-user-plus text-base"></i>
            <span>+ Thêm Giáo Viên Mới</span>
          </button>
        </div>

        {/* Counter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-blue-800/80">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-blue-200 block uppercase">Tổng Số Giáo Viên</span>
            <span className="text-2xl font-black text-white">{teachers.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-emerald-300 block uppercase">Đang Hoạt Động</span>
            <span className="text-2xl font-black text-emerald-300">
              {teachers.filter((t) => t.isActive).length}
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-amber-300 block uppercase">Quyền Soạn Đề</span>
            <span className="text-2xl font-black text-amber-300">
              {teachers.filter((t) => t.permissions.includes('edit_exam')).length}
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-purple-300 block uppercase">Quyền QL Học Sinh</span>
            <span className="text-2xl font-black text-purple-300">
              {teachers.filter((t) => t.permissions.includes('manage_students')).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-grow max-w-md">
          <div className="relative w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-sm"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Tên, Mã GV, Username, SĐT..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Grade Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Khối:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả các khối</option>
              {AVAILABLE_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã tạm khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Teacher Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto">
              <i className="fa-solid fa-user-slash"></i>
            </div>
            <h4 className="text-base font-bold text-slate-700">Không tìm thấy giáo viên nào</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Không có giáo viên phù hợp với từ khóa hoặc bộ lọc tìm kiếm của bạn.
            </p>
          </div>
        ) : (
          filteredTeachers.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-3xl p-5 sm:p-6 border-2 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 ${
                t.isActive ? 'border-slate-200 hover:border-blue-400' : 'border-rose-200 bg-rose-50/20 opacity-80'
              }`}
            >
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-lg font-black shadow-md shadow-blue-500/20 shrink-0">
                      {t.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(-1)[0]
                        ?.charAt(0) || 'G'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">{t.name}</h3>
                        {!t.isActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                            Khóa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {t.id}
                        </span>
                        <span>@{t.username}</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Status */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(t.id)}
                    title={t.isActive ? 'Bấm để tạm khóa tài khoản' : 'Bấm để kích hoạt tài khoản'}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                      t.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {t.isActive ? '✓ Hoạt động' : 'Tạm khóa'}
                  </button>
                </div>

                {/* Contact & Assigned Grades */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Khối phụ trách:</span>
                    <span className="font-bold text-slate-800">
                      {t.assignedGrades && t.assignedGrades.length > 0
                        ? t.assignedGrades.join(', ')
                        : 'Chưa phân khối'}
                    </span>
                  </div>
                  {t.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">SĐT:</span>
                      <span className="font-mono font-bold text-slate-800">{t.phone}</span>
                    </div>
                  )}
                  {t.email && (
                    <div className="flex items-center justify-between truncate">
                      <span className="text-slate-400 font-semibold">Email:</span>
                      <span className="font-medium text-slate-800 truncate" title={t.email}>
                        {t.email}
                      </span>
                    </div>
                  )}
                </div>

                {/* Permissions Badges */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Quyền hạn được cấp ({t.permissions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {t.permissions.map((pId) => {
                      const cfg = PERMISSION_CONFIG.find((p) => p.id === pId);
                      if (!cfg) return null;
                      return (
                        <span
                          key={pId}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${cfg.color}`}
                        >
                          <i className={`${cfg.icon} text-[9px]`}></i>
                          <span>{cfg.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400 font-mono">
                  Pass: <strong className="text-slate-700">{t.password}</strong>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(t)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    <span>Sửa & Phân Quyền</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(t)}
                    className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer"
                    title="Xóa giáo viên này"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT TEACHER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg">
                  <i className="fa-solid fa-user-gear"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black">
                    {editingTeacher ? 'Chỉnh Sửa Giáo Viên & Phân Quyền' : 'Thêm Mới Giáo Viên'}
                  </h3>
                  <p className="text-xs text-blue-200">
                    Cấp tài khoản đăng nhập và chọn quyền hạn chức năng cụ thể
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveTeacher} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-base shrink-0"></i>
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên giáo viên <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Cô Nguyễn Thu Trang"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã Giáo Viên (ID):
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                    placeholder="Ví dụ: GV04"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3">
                <span className="text-xs font-black text-blue-900 uppercase block tracking-wider">
                  Thông Tin Đăng Nhập Của Giáo Viên
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên đăng nhập (Username) <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })
                      }
                      placeholder="Ví dụ: gv_thutrang"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mật khẩu đăng nhập <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Nhập mật khẩu..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact info & Grade Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại:</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email:</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ví dụ: thutrang@ismart.edu.vn"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Assigned Grades Multi-select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Khối Lớp Phụ Trách:
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_GRADES.map((grade) => {
                    const isSelected = formData.assignedGrades.includes(grade);
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => handleToggleGrade(grade)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'} text-[10px]`}></i>
                        <span>{grade}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RBAC PERMISSIONS SELECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider">
                      Phân Quyền Chức Năng Cụ Thể (RBAC) <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Chọn các quyền mà giáo viên này được phép truy cập trong hệ thống
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer transition"
                    >
                      ✓ Cấp Toàn Quyền
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('exam_only')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold cursor-pointer transition"
                    >
                      ✏️ Nhóm Soạn Đề
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('homeroom')}
                      className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold cursor-pointer transition"
                    >
                      👥 Nhóm Chủ Nhiệm
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('scores_only')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-[11px] font-bold cursor-pointer transition"
                    >
                      📊 Giám Thị & Bảng Điểm
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {PERMISSION_CONFIG.map((perm) => {
                    const isChecked = formData.permissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleTogglePermission(perm.id)}
                        className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? 'bg-blue-50/50 border-blue-500 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div
                          className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${perm.color}`}>
                              <i className={perm.icon}></i>
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-900">
                              {perm.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {perm.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status active */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Kích hoạt tài khoản ngay (Cho phép giáo viên đăng nhập vào hệ thống)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-database text-emerald-600"></i>
                  <span>Lưu vĩnh viễn trên hệ thống (IndexedDB & LocalStorage)</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-600/25 transition cursor-pointer flex items-center gap-2"
                  >
                    <i className="fa-solid fa-floppy-disk"></i>
                    <span>Lưu Giáo Viên & Phân Quyền</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
