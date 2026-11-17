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
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { authService } from '../services/auth';
import { storageService } from '../services/storage';
import { UserAccount, SiteBranding, PromoCode } from '../types';
import { processImageFile } from '../utils/image';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  initialTab?: 'teachers' | 'promo_codes' | 'branding';
  branding: SiteBranding;
  onUpdateBranding: (branding: SiteBranding) => void;
  contentCounts: {
    apps: number;
    games: number;
    simulations: number;
  };
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
  const [activeTab, setActiveTab] = useState<'teachers' | 'promo_codes' | 'branding'>(
    initialTab
  );
  const [teachers, setTeachers] = useState<UserAccount[]>(() => authService.getTeachers());
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() =>
    authService.getPromoCodes()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Promo code creation form states
  const [newCodeInput, setNewCodeInput] = useState('');
  const [newCodeCredits, setNewCodeCredits] = useState<number>(30);
  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Per-teacher direct code issuance state
  const [issueTargetId, setIssueTargetId] = useState<string | null>(null);
  const [issueCodeInput, setIssueCodeInput] = useState('');
  const [issueCreditsInput, setIssueCreditsInput] = useState<number>(30);
  const [isIssuingToTeacher, setIsIssuingToTeacher] = useState(false);

  const refreshData = async () => {
    const [list, codes] = await Promise.all([
      authService.fetchTeachersFromServer(),
      authService.fetchPromoCodes(),
    ]);
    setTeachers(list);
    setPromoCodes(codes);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setActiveTab(initialTab);
    refreshData();

    const unsubscribe = storageService.subscribeRealtime((ev) => {
      if (ev?.type === 'teachers_updated' || ev?.type === 'promo_codes_updated') {
        refreshData();
      }
    });
    return unsubscribe;
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

  const handleTopUp = async (teacherId: string, amount: number) => {
    const res = await authService.adminTopUpCredits(teacherId, amount);
    if (res.success) {
      await refreshData();
      showNotice(
        res.message ||
          `Đã cấp mã ${res.code || ''} (+${amount} tín dụng AI) thành công!`
      );
    } else {
      alert(res.message || 'Không thể cộng tín dụng AI.');
    }
  };

  const handleOpenIssueCode = (teacher: UserAccount) => {
    if (issueTargetId === teacher.id) {
      setIssueTargetId(null);
      return;
    }
    setIssueTargetId(teacher.id);
    setIssueCodeInput('');
    setIssueCreditsInput(30);
  };

  const handleConfirmIssueCode = async (e: React.FormEvent, teacherId: string) => {
    e.preventDefault();
    if (!Number.isFinite(issueCreditsInput) || issueCreditsInput <= 0) {
      alert('Vui lòng nhập số tín dụng AI hợp lệ (> 0).');
      return;
    }
    setIsIssuingToTeacher(true);
    try {
      const res = await authService.adminTopUpCredits(
        teacherId,
        Math.floor(issueCreditsInput),
        issueCodeInput.trim().toUpperCase() || undefined
      );
      if (res.success) {
        setIssueTargetId(null);
        setIssueCodeInput('');
        await refreshData();
        showNotice(res.message);
      } else {
        alert(res.message || 'Không thể cấp mã kích hoạt cho giáo viên.');
      }
    } finally {
      setIsIssuingToTeacher(false);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(newCodeCredits) || newCodeCredits <= 0) {
      alert('Vui lòng nhập số điểm tín dụng hợp lệ (> 0).');
      return;
    }

    setIsCreatingCode(true);
    try {
      const res = await authService.adminCreatePromoCode({
        code: newCodeInput.trim().toUpperCase() || undefined,
        credit_value: Math.floor(newCodeCredits),
      });
      if (res.success) {
        setNewCodeInput('');
        await refreshData();
        showNotice(res.message);
      } else {
        alert(res.message || 'Không thể tạo mã kích hoạt.');
      }
    } finally {
      setIsCreatingCode(false);
    }
  };

  const handleDeletePromoCode = async (code: string) => {
    const ok = await authService.adminDeletePromoCode(code);
    if (ok) {
      await refreshData();
      showNotice(`Đã xóa mã kích hoạt ${code}.`);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

  const unusedCodesCount = promoCodes.filter((c) => !c.is_used).length;

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
            onClick={() => setActiveTab('promo_codes')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'promo_codes'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>
              Mã kích hoạt ({unusedCodesCount} khả dụng)
            </span>
          </button>

          <button
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
            <span className="text-slate-500 block text-[11px]">Người dùng</span>
            <span className="text-lg font-bold font-mono text-sky-700">{teachers.length}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Mã kích hoạt khả dụng</span>
            <span className="text-lg font-bold font-mono text-amber-600">{unusedCodesCount}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Kho Ứng Dụng</span>
            <span className="text-lg font-bold font-mono text-blue-700">{contentCounts.apps}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Học liệu số & Thí nghiệm</span>
            <span className="text-lg font-bold font-mono text-teal-700">
              {contentCounts.games + contentCounts.simulations}
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
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Danh sách tài khoản người dùng ({filteredTeachers.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Mỗi tài khoản nhận 5 tín dụng AI miễn phí mỗi ngày (tự động làm mới sau 24 giờ). Quản trị viên có thể cấp mã kích hoạt hoặc cộng trực tiếp tín dụng AI.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm người dùng, email..."
                  className="pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 w-full sm:w-60"
                />
              </div>
            </div>

            {filteredTeachers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 text-slate-400 flex items-center justify-center mb-3">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 mb-1">
                  Chưa có tài khoản người dùng nào
                </h4>
                <p className="text-xs text-slate-500 max-w-md">
                  Khi người dùng đăng nhập hệ thống, hồ sơ và số dư tín dụng AI (5 tín dụng miễn phí mỗi ngày, tự làm mới sau 24 giờ) sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Tín dụng AI</th>
                      <th className="py-3 px-4">Mã đã dùng gần nhất</th>
                      <th className="py-3 px-4 text-right">Quản lý & Cộng tín dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map((teacher) => {
                      const total = teacher.credits ?? 0;
                      const latestPromoForTeacher = promoCodes
                        .filter((p) => p.is_used && p.used_by === teacher.id)
                        .sort(
                          (a, b) =>
                            (b.used_at || b.created_at || 0) -
                            (a.used_at || a.created_at || 0)
                        )[0];
                      const displayedCode =
                        teacher.lastRedeemedCode || latestPromoForTeacher?.code;
                      const unusedCodes = promoCodes.filter((p) => !p.is_used);
                      const isIssuingThisRow = issueTargetId === teacher.id;

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
                                <span className="font-mono">{total}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {displayedCode ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-mono font-bold text-[11px]">
                                  <span>{displayedCode}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCode(displayedCode)}
                                    className="p-0.5 text-sky-500 hover:text-sky-700 rounded cursor-pointer"
                                    title="Sao chép mã đã cấp"
                                  >
                                    {copiedCode === displayedCode ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="font-mono text-[11px] text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenIssueCode(teacher)}
                                  className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    isIssuingThisRow
                                      ? 'bg-indigo-600 text-white border-indigo-700'
                                      : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                                  }`}
                                  title="Cấp mã kích hoạt riêng và lưu vào Mã đã dùng gần nhất"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>Cấp mã</span>
                                </button>
                                {[5, 10, 20, 50, 100].map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => handleTopUp(teacher.id, amt)}
                                    className={`px-2 py-1 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 ${
                                      amt >= 50
                                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                        : 'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200'
                                    }`}
                                    title={`Cộng ${amt} tín dụng AI & tự động lưu mã kích hoạt`}
                                  >
                                    <span>+{amt}</span>
                                  </button>
                                ))}

                                {deleteConfirmId === teacher.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteTeacher(teacher.id)}
                                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-2 py-1 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
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

                          {isIssuingThisRow && (
                            <tr className="bg-indigo-50/60">
                              <td colSpan={4} className="px-4 py-3 border-t border-indigo-100">
                                <form
                                  onSubmit={(e) => handleConfirmIssueCode(e, teacher.id)}
                                  className="flex flex-col gap-2.5"
                                >
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                                    <div className="flex-1">
                                      <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                                        Mã kích hoạt cấp cho {teacher.fullName} (tự tạo nếu để trống)
                                      </label>
                                      <input
                                        type="text"
                                        value={issueCodeInput}
                                        onChange={(e) =>
                                          setIssueCodeInput(e.target.value.toUpperCase())
                                        }
                                        placeholder="VD: HLS-GV2026"
                                        className="w-full px-3 py-1.5 text-xs font-mono uppercase rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </div>
                                    <div className="w-full sm:w-36">
                                      <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                                        Số tín dụng cộng
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={100000}
                                        value={issueCreditsInput}
                                        onChange={(e) =>
                                          setIssueCreditsInput(Number(e.target.value))
                                        }
                                        className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                        required
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="submit"
                                        disabled={isIssuingToTeacher}
                                        className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                                      >
                                        {isIssuingToTeacher ? 'Đang lưu...' : 'Xác nhận cấp mã'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setIssueTargetId(null)}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
                                      >
                                        Đóng
                                      </button>
                                    </div>
                                  </div>

                                  {unusedCodes.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-indigo-800">
                                      <span className="font-semibold">Chọn nhanh mã khả dụng:</span>
                                      {unusedCodes.slice(0, 6).map((uc) => (
                                        <button
                                          key={uc.code}
                                          type="button"
                                          onClick={() => {
                                            setIssueCodeInput(uc.code);
                                            setIssueCreditsInput(uc.credit_value);
                                          }}
                                          className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 hover:bg-indigo-100 font-mono font-bold text-indigo-700 cursor-pointer"
                                        >
                                          {uc.code} (+{uc.credit_value})
                                        </button>
                                      ))}
                                    </div>
                                  )}
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

        {/* TAB 2: PROMO CODES MANAGEMENT (promo_codes) */}
        {activeTab === 'promo_codes' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Create promo code form */}
            <form
              onSubmit={handleCreatePromoCode}
              className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Tạo mã kích hoạt mới (promo_codes)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Mã kích hoạt (tự động nếu để trống)
                  </label>
                  <input
                    type="text"
                    value={newCodeInput}
                    onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: HLS-VIP50"
                    className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Số tín dụng cộng (credit_value)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={newCodeCredits}
                    onChange={(e) => setNewCodeCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isCreatingCode}
                    className="w-full py-2 px-4 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isCreatingCode ? 'Đang tạo...' : 'Tạo mã kích hoạt'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Promo codes list */}
            {promoCodes.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Chưa có mã kích hoạt nào. Hãy tạo mã ở khung phía trên để gửi cho người dùng khi hết tín dụng AI.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <th className="py-3 px-4">Mã kích hoạt</th>
                      <th className="py-3 px-4">Giá trị (credit_value)</th>
                      <th className="py-3 px-4">Trạng thái (is_used)</th>
                      <th className="py-3 px-4">Người dùng sử dụng (used_by)</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {promoCodes.map((item) => (
                      <tr key={item.code} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                              {item.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.code)}
                              className="p-1 text-slate-400 hover:text-sky-600 rounded-md hover:bg-sky-50 cursor-pointer"
                              title="Sao chép mã"
                            >
                              {copiedCode === item.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-700">
                            +{item.credit_value} tín dụng
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {item.is_used ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[11px]">
                              Đã sử dụng
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                              Chưa sử dụng
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-600">
                          {item.used_by ? (
                            (() => {
                              const matched = teachers.find((t) => t.id === item.used_by);
                              return matched ? (
                                <div>
                                  <div className="font-semibold text-slate-800">{matched.fullName}</div>
                                  <div className="text-slate-500 font-mono">{matched.email}</div>
                                </div>
                              ) : (
                                <span className="font-mono">{item.used_by}</span>
                              );
                            })()
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeletePromoCode(item.code)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa mã kích hoạt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BRANDING & AVATAR UPLOADS */}
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
                    onClick={() => homeFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.homeAvatar ? 'Đổi logo' : 'Thêm logo'}</span>
                  </button>
                  {branding.homeAvatar && (
                    <button
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
                    onClick={() => appsFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.appsAvatar ? 'Đổi ảnh Kho Ứng Dụng' : 'Thêm ảnh Kho Ứng Dụng'}</span>
                  </button>
                  {branding.appsAvatar && (
                    <button
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
                    onClick={() => gamesFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.gamesAvatar ? 'Đổi ảnh Học Liệu Số' : 'Thêm ảnh Học Liệu Số'}</span>
                  </button>
                  {branding.gamesAvatar && (
                    <button
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
                    onClick={() => simsFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{branding.simsAvatar ? 'Đổi ảnh Thí Nghiệm' : 'Thêm ảnh Thí Nghiệm'}</span>
                  </button>
                  {branding.simsAvatar && (
                    <button
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
          <span>Quản trị viên quản lý tài khoản người dùng, mã kích hoạt và hình đại diện khu vực.</span>
          <button
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
