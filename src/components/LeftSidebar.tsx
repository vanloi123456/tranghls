import React, { useRef } from 'react';
import {
  Home,
  Cpu,
  Gamepad2,
  FlaskConical,
  GraduationCap,
  ShieldCheck,
  Maximize,
  Minimize,
  RotateCcw,
  Download,
  Upload,
  X,
  Sparkles,
  LogIn,
  LogOut,
  Settings,
  Coins,
  Phone,
} from 'lucide-react';
import {
  UserRole,
  UserAccount,
  SiteBranding,
  MIN_CREDIT_COST,
} from '../types';
import { authService } from '../services/auth';

interface LeftSidebarProps {
  role: UserRole;
  currentUser: UserAccount | null;
  branding?: SiteBranding;
  onOpenAuth: () => void;
  onOpenAdminPanel: () => void;
  onOpenContactAdmin: () => void;
  onLogout: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  onResetView: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  counts: {
    apps: number;
    games: number;
    sims: number;
  };
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  role,
  currentUser,
  branding,
  onOpenAuth,
  onOpenAdminPanel,
  onOpenContactAdmin,
  onLogout,
  activeSection,
  onNavigate,
  onResetView,
  onExport,
  onImport,
  isFullscreen,
  onToggleFullscreen,
  isOpenMobile,
  onCloseMobile,
  counts,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    {
      id: 'trang-chu',
      label: 'Trang Chủ',
      icon: Home,
      avatar: branding?.homeAvatar,
      color: 'text-sky-600',
    },
    {
      id: 'kho-ung-dung',
      label: 'Kho Ứng Dụng',
      icon: Cpu,
      avatar: branding?.appsAvatar,
      color: 'text-blue-600',
      badge: counts.apps,
    },
    {
      id: 'tro-choi-tuong-tac',
      label: 'Học Liệu Số',
      icon: Gamepad2,
      avatar: branding?.gamesAvatar,
      color: 'text-indigo-600',
      badge: counts.games,
    },
    {
      id: 'thi-nghiem-mo-phong',
      label: 'Thí Nghiệm Mô Phỏng',
      icon: FlaskConical,
      avatar: branding?.simsAvatar,
      color: 'text-teal-600',
      badge: counts.sims,
    },
  ];

  const canManage = role === 'admin';
  const totalCredits = authService.getTotalCredits(currentUser);
  const isLowCredits = role === 'teacher' && totalCredits < MIN_CREDIT_COST;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white/90 backdrop-blur-xl border-r border-sky-200/75 shadow-xs flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top: Brand Header */}
        <div className="p-5 border-b border-sky-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white flex items-center justify-center shadow-xs overflow-hidden">
                {branding?.homeAvatar ? (
                  <img src={branding.homeAvatar} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold font-display text-sky-950 leading-tight">
                  Học Liệu Số
                </span>
                <span className="text-xs text-sky-700 font-medium">
                  Giáo viên sáng tạo
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 md:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role summary banner */}
          {canManage ? (
            <div className="mt-4 p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-center">
              <span className="text-xs font-semibold text-sky-900">Quản trị nội dung & tài khoản</span>
            </div>
          ) : role === 'teacher' ? (
            <div className="mt-4 p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-center">
              <span className="text-xs font-semibold text-sky-900">Không gian học tập & giảng dạy</span>
            </div>
          ) : (
            <button
              onClick={() => {
                onOpenAuth();
                onCloseMobile();
              }}
              className="w-full mt-4 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>

        {/* Center: Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Điều hướng khu vực
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 text-sky-900 border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt=""
                      className="w-5 h-5 rounded-md object-cover border border-sky-200"
                    />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : item.color}`} />
                  )}
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-sky-200/70 text-sky-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* User Account / AI Credits Box */}
          <div className="pt-4 mt-3 border-t border-slate-100">
            {role === 'admin' ? (
              <div className="p-3 bg-gradient-to-br from-sky-900 to-indigo-900 text-white rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-300" />
                  <span className="text-xs font-bold text-sky-100">Quản trị hệ thống</span>
                </div>
                <button
                  onClick={() => {
                    onOpenAdminPanel();
                    onCloseMobile();
                  }}
                  className="w-full py-1.5 px-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Quản lý GV & Tín dụng</span>
                </button>
                <button
                  onClick={onLogout}
                  className="w-full text-center text-[11px] text-sky-200 hover:text-white pt-1 cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            ) : role === 'teacher' ? (
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-sky-300 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser?.email}</p>
                  </div>
                </div>

                {/* Credit Balance Strip */}
                <div
                  className={`p-2.5 rounded-xl border space-y-1 ${
                    isLowCredits
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-amber-50/80 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1 text-slate-800">
                      <Coins
                        className={`w-3.5 h-3.5 ${
                          isLowCredits ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      />
                      <span>Tín dụng AI</span>
                    </span>
                    <span
                      className={`font-mono ${
                        isLowCredits ? 'text-rose-600' : 'text-amber-800'
                      }`}
                    >
                      {totalCredits}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    5 tín dụng miễn phí/ngày · Làm mới sau 24h
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenContactAdmin();
                      onCloseMobile();
                    }}
                    className={`w-full mt-1 py-1.5 text-[11px] font-bold text-white rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      isLowCredits
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-sky-600 hover:bg-sky-700'
                    }`}
                  >
                    <Phone className="w-3 h-3" />
                    <span>Liên hệ Quản trị viên</span>
                  </button>
                </div>

                <button
                  onClick={onLogout}
                  className="w-full py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <button
                  onClick={() => {
                    onOpenAuth();
                    onCloseMobile();
                  }}
                  className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Utilities */}
        <div className="p-4 border-t border-sky-100 bg-slate-50/60">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onResetView}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Về đầu trang"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đầu trang</span>
            </button>

            <button
              onClick={onToggleFullscreen}
              className="p-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {canManage && (
              <>
                <button
                  onClick={onExport}
                  className="p-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="Sao lưu JSON"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="Nạp tệp JSON"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={onImport}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
