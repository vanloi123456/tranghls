import React, { useState, useEffect } from 'react';
import {
  X,
  Coins,
  ShieldCheck,
  Phone,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Play,
  Clock,
} from 'lucide-react';
import { UserAccount, MIN_CREDIT_COST, DAILY_FREE_CREDITS } from '../types';
import { authService, ADMIN_PHONE, ADMIN_CREDENTIALS } from '../services/auth';

interface RedeemCodeModalProps {
  isOpen: boolean;
  user: UserAccount | null;
  reasonMessage?: string;
  pendingItemTitle?: string;
  requiredCredits?: number;
  onUserUpdated: (user: UserAccount) => void;
  onContinueAfterRedeem?: (updatedUser: UserAccount) => void;
  onClose: () => void;
}

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({
  isOpen,
  user,
  reasonMessage,
  pendingItemTitle,
  requiredCredits = MIN_CREDIT_COST,
  onUserUpdated,
  onContinueAfterRedeem,
  onClose,
}) => {
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [latestUser, setLatestUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCopiedField(null);
    setRefreshStatus(null);
    setLatestUser(null);
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const activeUser = latestUser || user;
  const totalCredits = authService.getTotalCredits(activeUser);
  const isInsufficient = totalCredits < requiredCredits;
  const remainingResetText = authService.formatTimeUntilFreeReset(activeUser);

  const handleCopy = (field: 'phone' | 'email', text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    setRefreshStatus(null);
    try {
      const updated = await authService.refreshCurrentUser(activeUser);
      setLatestUser(updated);
      onUserUpdated(updated);
      const nextTotal = authService.getTotalCredits(updated);
      if (nextTotal >= requiredCredits) {
        setRefreshStatus(`Đã cập nhật số dư: ${nextTotal} tín dụng AI. Thầy/cô có thể tiếp tục sử dụng ngay.`);
      } else {
        setRefreshStatus(`Số dư hiện tại là ${nextTotal} tín dụng AI. Vui lòng liên hệ Quản trị viên để được cấp thêm.`);
      }
    } catch {
      setRefreshStatus('Không thể làm mới số dư lúc này. Vui lòng thử lại.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleContinueNow = () => {
    if (onContinueAfterRedeem) {
      onContinueAfterRedeem(activeUser);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sky-200 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Liên hệ Quản trị viên"
      >
        {/* Header */}
        <div
          className={`p-5 border-b flex items-start justify-between gap-4 ${
            isInsufficient
              ? 'bg-gradient-to-r from-rose-50 via-amber-50 to-white border-rose-100'
              : 'bg-gradient-to-r from-sky-50 via-cyan-50 to-white border-sky-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-sm shrink-0 ${
                isInsufficient
                  ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                  : 'bg-gradient-to-br from-sky-500 to-blue-600'
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                {isInsufficient
                  ? 'Hết tín dụng AI – Liên hệ Quản trị viên'
                  : 'Liên hệ Quản trị viên'}
              </h2>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                {reasonMessage ||
                  (isInsufficient
                    ? `Số dư tín dụng AI của thầy/cô đã hết hoặc không đủ (cần ${requiredCredits} tín dụng AI). Vui lòng liên hệ Quản trị viên để được cấp thêm tín dụng và tiếp tục sử dụng.`
                    : 'Liên hệ Quản trị viên khi cần hỗ trợ kỹ thuật hoặc cấp thêm tín dụng AI để tiếp tục sử dụng hệ thống.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current Balance Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              isInsufficient
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Số dư tín dụng AI hiện tại
              </span>
              <span
                className={`text-2xl font-bold font-mono tabular-nums ${
                  isInsufficient ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {totalCredits} tín dụng AI
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Coins className={`w-5 h-5 ${isInsufficient ? 'text-rose-500' : 'text-emerald-600'}`} />
            </div>
          </div>

          {/* Admin Contact Card */}
          <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Thông tin liên hệ Quản trị viên
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Đào Văn Lợi – PHT Trường TH&THCS Tân Khánh Trung, tỉnh Đồng Tháp
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Phone / Zalo */}
              <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-sky-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-500 block">Điện thoại / Zalo</span>
                    <a
                      href={`tel:${ADMIN_PHONE}`}
                      className="text-sm font-bold font-mono text-sky-800 hover:text-sky-600 underline underline-offset-2"
                    >
                      {ADMIN_PHONE}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy('phone', ADMIN_PHONE)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedField === 'phone' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`tel:${ADMIN_PHONE}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi ngay</span>
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-sky-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-500 block">Email quản trị</span>
                    <a
                      href={`mailto:${ADMIN_CREDENTIALS.email}`}
                      className="text-xs font-semibold font-mono text-sky-800 hover:text-sky-600 truncate block"
                    >
                      {ADMIN_CREDENTIALS.email}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('email', ADMIN_CREDENTIALS.email)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  {copiedField === 'email' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 24h auto-refresh note */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Hệ thống sẽ tự động làm mới <strong>{DAILY_FREE_CREDITS} tín dụng AI miễn phí</strong> mỗi ngày sau 24 giờ
              {remainingResetText ? ` (dự kiến còn khoảng ${remainingResetText})` : ''}. Sau khi Quản trị viên cộng thêm tín dụng cho tài khoản, thầy/cô bấm nút kiểm tra số dư bên dưới để tiếp tục ngay.
            </p>
          </div>

          {refreshStatus && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                !isInsufficient
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {refreshStatus}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
              Tài khoản: {activeUser.email}
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleRefreshBalance}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Đang kiểm tra...' : 'Kiểm tra lại số dư'}</span>
              </button>

              {!isInsufficient && pendingItemTitle && onContinueAfterRedeem && (
                <button
                  type="button"
                  onClick={handleContinueNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tiếp tục sử dụng</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
