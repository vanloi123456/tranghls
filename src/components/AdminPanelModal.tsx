import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Users,
  Coins,
  Trash2,
  CheckCircle2,
  LogOut,
  Search,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Cpu,
  Gamepad2,
  FlaskConical,
  Home,
  Camera,
  PlusCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { authService } from '../services/auth';
import { storageService } from '../services/storage';
import { UserAccount, SiteBranding } from '../types';
import { processImageFile } from '../utils/image';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  initialTab?: 'teachers' | 'branding';
  branding: SiteBranding;
  onUpdateBranding: (branding: SiteBranding) => void;
  contentCounts: {
    apps: number;
    games: number;
    simulations: number;
  };
}

function formatDateTime(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  initialTab = 'teachers',
  branding,
  onUpdateBranding,
  contentCounts,
}) => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'branding'>(initialTab);
  const [teachers, setTeachers] = useState<UserAccount[]>(() => authService.getTeachers());
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(() =>
    authService.isFirebaseAdminConnected()
  );
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isRefreshingList, setIsRefreshingList] = useState(false);

  // Per-teacher custom top-up state
  const [customTargetId, setCustomTargetId] = useState<string | null>(null);
  const [customCreditsInput, setCustomCreditsInput] = useState<number>(20);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const refreshData = async () => {
    setIsRefreshingList(true);
    try {
      const list = await authService.fetchTeachersFromServer();
      setTeachers(list);
      setIsFirebaseConnected(authService.isFirebaseAdminConnected());
    } finally {
      setIsRefreshingList(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setActiveTab(initialTab);
    setIsFirebaseConnected(authService.isFirebaseAdminConnected());
    refreshData();

    const unsubscribeFs = authService.subscribeTeachersRealtime((latestList) => {
      setTeachers(latestList);
    });

    const unsubscribeSse = storageService.subscribeRealtime((ev) => {
      if (ev?.type === 'teachers_updated') {
        refreshData();
      }
    });

    return () => {
      unsubscribeFs();
      unsubscribeSse();
    };
  }, [isOpen, initialTab]);

  // File input refs for uploading avatars
  const homeFileInputRef = useRef<HTMLInputElement>(null);
  const appsFileInputRef = useRef<HTMLInputElement>(null);
  const gamesFileInputRef = useRef<HTMLInputElement>(null);
  const simsFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleConnectGoogleAdmin = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await authService.signInWithGoogle();
      setIsFirebaseConnected(authService.isFirebaseAdminConnected());
      if (res.success) {
        await refreshData();
        showNotice('Đã đồng bộ toàn bộ danh sách tài khoản từ Cloud Firestore!');
      } else if (res.message) {
        alert(res.message);
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleTopUp = async (teacherId: string, amount: number) => {
    const res = await authService.adminTopUpCredits(teacherId, amount);
    if (res.success) {
      await refreshData();
      showNotice(res.message || `Đã cộng +${amount} tín dụng AI thành công!`);
    } else {
      alert(res.message || 'Không thể cộng tín dụng AI.');
    }
  };

  const handleOpenCustomTopUp = (teacher: UserAccount) => {
    if (customTargetId === teacher.id) {
      setCustomTargetId(null);
      return;
    }
    setCustomTargetId(teacher.id);
    setCustomCreditsInput(20);
  };

  const handleConfirmCustomTopUp = async (e: React.FormEvent, teacherId: string) => {
    e.preventDefault();
    if (!Number.isFinite(customCreditsInput) || customCreditsInput <= 0) {
      alert('Vui lòng nhập số tín dụng AI hợp lệ (> 0).');
      return;
    }
    setIsSubmittingCustom(true);
    try {
      const res = await authService.adminTopUpCredits(
        teacherId,
        Math.floor(customCreditsInput)
      );
      if (res.success) {
        setCustomTargetId(null);
        await refreshData();
        showNotice(res.message);
      } else {
        alert(res.message || 'Không thể cộng tín dụng cho giáo viên.');
      }
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    await authService.adminDeleteTeacher(teacherId);
    setDeleteConfirmId(null);
    await refreshData();
  };

  const handleImageFileChange = async (
    key: keyof SiteBranding,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      alert('Vui lòng chọn hình ảnh định dạng JPG, PNG hoặc WEBP');
      return;
    }

    try {
      const maxDim = key === 'homeAvatar' ? 1400 : 700;
      const dataUrl = await processImageFile(file, maxDim);
      onUpdateBranding({
        ...branding,
        [key]: dataUrl,
      });
      showNotice('Đã cập nhật hình đại diện thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xử lý hình ảnh');
    }
    e.target.value = '';
  };

  const handleRemoveImage = (key: keyof SiteBranding) => {
    const updated = { ...branding };
    delete updated[key];
    onUpdateBranding(updated);
    showNotice('Đã xóa hình đại diện và trở về mặc định.');
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-sky-200 overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-950 text-white p-6 border-b border-sky-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-500/30">
                Trung tâm quản trị hệ thống
              </span>
              <h2 className="text-xl font-bold font-display text-white mt-0.5">
                Bảng Điều Khiển Quản Trị Viên
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'teachers'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tài khoản & Tín dụng ({teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'branding'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Hình đại diện các khu vực</span>
          </button>
        </div>

        {/* Snapshot Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-sky-50/60 border-b border-sky-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Tài khoản đã đăng nhập</span>
            <span className="text-lg font-bold font-mono tabular-nums text-sky-700">
              {teachers.length}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Kho Ứng Dụng</span>
            <span className="text-lg font-bold font-mono tabular-nums text-blue-700">
              {contentCounts.apps}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Học Liệu Số</span>
            <span className="text-lg font-bold font-mono tabular-nums text-indigo-700">
              {contentCounts.games}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Thí Nghiệm Mô Phỏng</span>
            <span className="text-lg font-bold font-mono tabular-nums text-teal-700">
              {contentCounts.simulations}
            </span>
          </div>
        </div>

        {/* Notice feedback */}
        {notice && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* TAB 1: USERS & CREDITS MANAGEMENT */}
        {activeTab === 'teachers' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!isFirebaseConnected && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Để tự động hiển thị toàn bộ tài khoản giáo viên đã đăng nhập trên Vercel theo thời gian thực và cấp tín dụng trực tuyến, hãy kết nối phiên Google Quản trị.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConnectGoogleAdmin}
                  disabled={isConnectingGoogle}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {isConnectingGoogle ? 'Đang kết nối...' : 'Kết nối Google Quản trị'}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Danh sách tài khoản đã đăng nhập ({filteredTeachers.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Mỗi giáo viên nhận 5 tín dụng AI miễn phí mỗi ngày (tự động làm mới sau 24 giờ). Khi giáo viên liên hệ, Quản trị viên cộng trực tiếp tín dụng tại đây.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên, email..."
                    className="pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 w-full sm:w-52"
                  />
                </div>
                <button
                  type="button"
                  onClick={refreshData}
                  disabled={isRefreshingList}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer shrink-0"
                  title="Tải lại danh sách tài khoản mới nhất"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingList ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {filteredTeachers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 text-slate-400 flex items-center justify-center mb-3">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 mb-1">
                  Chưa có tài khoản giáo viên nào
                </h4>
                <p className="text-xs text-slate-500 max-w-md">
                  Khi giáo viên đăng nhập hệ thống (kể cả trên Vercel), hồ sơ và số dư tín dụng AI sẽ tự động lưu tại đây.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Tín dụng AI</th>
                      <th className="py-3 px-4">Đăng nhập gần nhất</th>
                      <th className="py-3 px-4 text-right">Cộng tín dụng & Quản lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map((teacher) => {
                      const total = teacher.credits ?? 0;
                      const isCustomRowOpen = customTargetId === teacher.id;

                      return (
                        <React.Fragment key={teacher.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                {teacher.photoURL ? (
                                  <img
                                    src={teacher.photoURL}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover border border-sky-200 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0">
                                    {teacher.fullName?.charAt(0)?.toUpperCase() || 'G'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900">{teacher.fullName}</div>
                                  <div className="text-slate-500 text-[11px] font-mono">{teacher.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                                <Coins className="w-3.5 h-3.5 text-amber-600" />
                                <span className="font-mono tabular-nums">{total}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500 tabular-nums">
                              {formatDateTime(teacher.updatedAt || teacher.createdAt)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCustomTopUp(teacher)}
                                  className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    isCustomRowOpen
                                      ? 'bg-indigo-600 text-white border-indigo-700'
                                      : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                                  }`}
                                  title="Nhập số tín dụng tùy chỉnh để cộng cho giáo viên"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Cộng tùy chọn</span>
                                </button>
                                {[5, 10, 20, 50, 100].map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => handleTopUp(teacher.id, amt)}
                                    className={`px-2 py-1 text-xs font-bold border rounded-lg transition-colors cursor-pointer tabular-nums ${
                                      amt >= 50
                                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                        : 'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200'
                                    }`}
                                    title={`Cộng +${amt} tín dụng AI`}
                                  >
                                    +{amt}
                                  </button>
                                ))}

                                {deleteConfirmId === teacher.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTeacher(teacher.id)}
                                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-2 py-1 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(teacher.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xóa tài khoản này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {isCustomRowOpen && (
                            <tr className="bg-indigo-50/60">
                              <td colSpan={4} className="px-4 py-3 border-t border-indigo-100">
                                <form
                                  onSubmit={(e) => handleConfirmCustomTopUp(e, teacher.id)}
                                  className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
                                >
                                  <div className="flex-1">
                                    <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                                      Số tín dụng AI cộng thêm cho {teacher.fullName}
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={100000}
                                      value={customCreditsInput}
                                      onChange={(e) =>
                                        setCustomCreditsInput(Number(e.target.value))
                                      }
                                      className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                      required
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="submit"
                                      disabled={isSubmittingCustom}
                                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      {isSubmittingCustom ? 'Đang lưu...' : 'Xác nhận cộng'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCustomTargetId(null)}
                                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
                                    >
                                      Đóng
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BRANDING & AVATAR UPLOADS */}
        {activeTab === 'branding' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Quản lý hình đại diện của các khu vực
              </h3>
              <p className="text-xs text-slate-500">
                Quản trị viên có thể tải lên hình ảnh từ máy tính (JPG, PNG, WEBP) làm logo hệ thống và hình đại diện cho Kho Ứng Dụng, Học Liệu Số, Thí Nghiệm Mô Phỏng.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. Logo hệ thống */}
              <div className="p-4 rounded-2xl border border-sky-100 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-800">1. Logo hệ thống</span>
                  </div>
                  {branding.homeAvatar && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Đã có hình đại diện
                    </span>
                  )}
                </div>

                <div className="h-28 w-full bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-300">
                  {branding.homeAvatar ? (
                    <img src={branding.homeAvatar} alt="Logo hệ thống" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">Sử dụng biểu tượng mặc định</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={homeFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleImageFileChange('homeAvatar', e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => homeFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.homeAvatar ? 'Đổi logo' : 'Thêm logo'}</span>
                  </button>
                  {branding.homeAvatar && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage('homeAvatar')}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Khôi phục mặc định"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Kho Ứng Dụng Avatar */}
              <div className="p-4 rounded-2xl border border-sky-100 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">2. Kho Ứng Dụng</span>
                  </div>
                  {branding.appsAvatar && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Đã có hình đại diện
                    </span>
                  )}
                </div>

                <div
                  onClick={() => appsFileInputRef.current?.click()}
                  className="h-28 w-full bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-300 cursor-pointer group/prev"
                  title="Nhấn để chọn ảnh mới"
                >
                  {branding.appsAvatar ? (
                    <>
                      <img src={branding.appsAvatar} alt="Kho Ứng Dụng" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-blue-950/40 opacity-0 group-hover/prev:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                        <Camera className="w-4 h-4" />
                        <span>Nhấn để đổi ảnh</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium group-hover/prev:text-blue-600">
                      Sử dụng biểu tượng mặc định (Nhấn để thêm ảnh)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={appsFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleImageFileChange('appsAvatar', e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => appsFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.appsAvatar ? 'Đổi ảnh Kho Ứng Dụng' : 'Thêm ảnh Kho Ứng Dụng'}</span>
                  </button>
                  {branding.appsAvatar && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage('appsAvatar')}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Khôi phục mặc định"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Học Liệu Số Avatar */}
              <div className="p-4 rounded-2xl border border-sky-100 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">3. Học Liệu Số</span>
                  </div>
                  {branding.gamesAvatar && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Đã có hình đại diện
                    </span>
                  )}
                </div>

                <div
                  onClick={() => gamesFileInputRef.current?.click()}
                  className="h-28 w-full bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-300 cursor-pointer group/prev"
                  title="Nhấn để chọn ảnh mới"
                >
                  {branding.gamesAvatar ? (
                    <>
                      <img src={branding.gamesAvatar} alt="Học Liệu Số" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover/prev:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                        <Camera className="w-4 h-4" />
                        <span>Nhấn để đổi ảnh</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium group-hover/prev:text-indigo-600">
                      Sử dụng biểu tượng mặc định (Nhấn để thêm ảnh)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={gamesFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleImageFileChange('gamesAvatar', e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => gamesFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.gamesAvatar ? 'Đổi ảnh Học Liệu Số' : 'Thêm ảnh Học Liệu Số'}</span>
                  </button>
                  {branding.gamesAvatar && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage('gamesAvatar')}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Khôi phục mặc định"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Thí Nghiệm Mô Phỏng Avatar */}
              <div className="p-4 rounded-2xl border border-sky-100 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">4. Thí Nghiệm Mô Phỏng</span>
                  </div>
                  {branding.simsAvatar && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Đã có hình đại diện
                    </span>
                  )}
                </div>

                <div
                  onClick={() => simsFileInputRef.current?.click()}
                  className="h-28 w-full bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-300 cursor-pointer group/prev"
                  title="Nhấn để chọn ảnh mới"
                >
                  {branding.simsAvatar ? (
                    <>
                      <img src={branding.simsAvatar} alt="Thí Nghiệm" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-teal-950/40 opacity-0 group-hover/prev:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                        <Camera className="w-4 h-4" />
                        <span>Nhấn để đổi ảnh</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium group-hover/prev:text-teal-600">
                      Sử dụng biểu tượng mặc định (Nhấn để thêm ảnh)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={simsFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleImageFileChange('simsAvatar', e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => simsFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.simsAvatar ? 'Đổi ảnh Thí Nghiệm' : 'Thêm ảnh Thí Nghiệm'}</span>
                  </button>
                  {branding.simsAvatar && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage('simsAvatar')}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Khôi phục mặc định"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Quản trị viên quản lý toàn bộ tài khoản đã đăng nhập, tín dụng AI và hình đại diện khu vực.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Đóng bảng quản trị
          </button>
        </div>
      </div>
    </div>
  );
};
