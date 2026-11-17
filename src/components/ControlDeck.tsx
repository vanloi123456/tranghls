import React from 'react';
import {
  Home,
  GraduationCap,
  ShieldCheck,
  Maximize,
  Minimize,
  Edit3,
  Trash2,
  LogIn,
  Image as ImageIcon,
  Coins,
  KeyRound,
} from 'lucide-react';
import { UserRole, ContentItem, UserAccount, APP_LAUNCH_CREDIT_COST } from '../types';
import { authService } from '../services/auth';

interface ControlDeckProps {
  role: UserRole;
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onOpenAdminPanel: () => void;
  onOpenAdminPanelTab?: (tab: 'teachers' | 'promo_codes' | 'branding') => void;
  onOpenRedeemCode: () => void;
  onLogout: () => void;
  selectedItem: ContentItem | null;
  onEditSelected: () => void;
  onDeleteSelected: () => void;
  onResetView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  role,
  currentUser,
  onOpenAuth,
  onOpenAdminPanel,
  onOpenAdminPanelTab,
  onOpenRedeemCode,
  onLogout,
  selectedItem,
  onEditSelected,
  onDeleteSelected,
  onResetView,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const canManage = role === 'admin';
  const totalCredits = authService.getTotalCredits(currentUser);
  const isLowCredits = role === 'teacher' && totalCredits < APP_LAUNCH_CREDIT_COST;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left Side: Current Role Indicator & Credits */}
        <div className="flex items-center flex-wrap gap-2">
          {role === 'admin' ? (
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs flex-wrap">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold">Quản trị viên</span>
              <button
                onClick={onOpenAdminPanel}
                className="ml-1 px-2 py-0.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold rounded-md transition-colors cursor-pointer"
              >
                Quản lý Tài khoản
              </button>
              <button
                onClick={() =>
                  onOpenAdminPanelTab ? onOpenAdminPanelTab('promo_codes') : onOpenAdminPanel()
                }
                className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                title="Tạo và quản lý mã kích hoạt tín dụng AI"
              >
                <KeyRound className="w-3 h-3" />
                <span>Mã kích hoạt</span>
              </button>
              <button
                onClick={() =>
                  onOpenAdminPanelTab ? onOpenAdminPanelTab('branding') : onOpenAdminPanel()
                }
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-sky-200 text-[11px] font-semibold rounded-md border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                title="Thay đổi hình đại diện Kho ứng dụng, Học liệu số và Thí nghiệm"
              >
                <ImageIcon className="w-3 h-3 text-sky-400" />
                <span>Đổi hình đại diện</span>
              </button>
            </div>
          ) : role === 'teacher' ? (
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-sky-50 text-sky-900 px-3 py-1.5 rounded-xl border border-sky-200 shadow-xs">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-sky-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <GraduationCap className="w-4 h-4 text-sky-600" />
                )}
                <span className="text-xs font-bold truncate max-w-[140px]">
                  {currentUser?.fullName}
                </span>
                <button
                  onClick={onLogout}
                  className="ml-1 text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>

              {/* AI Credit Pill */}
              <button
                type="button"
                onClick={onOpenRedeemCode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isLowCredits
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
                title="Nhập mã kích hoạt để nạp thêm tín dụng AI"
              >
                <Coins
                  className={`w-4 h-4 ${isLowCredits ? 'text-rose-600' : 'text-amber-600'}`}
                />
                <span>{totalCredits} tín dụng AI</span>
                <span
                  className={`ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md ${
                    isLowCredits ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  <KeyRound className="w-2.5 h-2.5" />
                  <span>Nhập mã</span>
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>

        {/* Center: Selected Item Context Controls */}
        {selectedItem && canManage && (
          <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
            <span className="text-xs text-sky-900 font-semibold truncate max-w-[150px]">
              Đang chọn: {selectedItem.title}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onEditSelected}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa</span>
              </button>
              <button
                onClick={onDeleteSelected}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
        )}

        {/* Right Side: Primary Utilities */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onResetView}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors cursor-pointer"
            title="Về Trang chủ / Đầu trang"
          >
            <Home className="w-3.5 h-3.5 text-sky-600" />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Toàn màn hình</span>
          </button>
        </div>
      </div>
    </div>
  );
};
