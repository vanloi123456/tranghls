import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Coins,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Play,
  Phone,
} from 'lucide-react';
import { UserAccount, MIN_CREDIT_COST, DAILY_FREE_CREDITS } from '../types';
import { authService, ADMIN_PHONE } from '../services/auth';

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
  const [promoInput, setPromoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redeemedUser, setRedeemedUser] = useState<UserAccount | null>(null);
  const autoLaunchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (autoLaunchTimerRef.current) {
        window.clearTimeout(autoLaunchTimerRef.current);
        autoLaunchTimerRef.current = null;
      }
      return;
    }
    setPromoInput('');
    setSubmitSuccess(null);
    setSubmitError(null);
    setRedeemedUser(null);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (autoLaunchTimerRef.current) {
        window.clearTimeout(autoLaunchTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !user) return null;

  const activeUser = redeemedUser || user;
  const totalCredits = authService.getTotalCredits(activeUser);
  const isInsufficient = totalCredits < requiredCredits;
  const remainingResetText = authService.formatTimeUntilFreeReset(activeUser);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) {
      setSubmitError('Vui lòng nhập mã kích hoạt do Quản trị viên cung cấp.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await authService.redeemPromoCode(activeUser, cleaned);
      if (res.success && res.user) {
        const updated = res.user;
        setRedeemedUser(updated);
        onUserUpdated(updated);
        setSubmitSuccess(res.message);
        setPromoInput('');

        if (
          updated.credits >= requiredCredits &&
          pendingItemTitle &&
          onContinueAfterRedeem
        ) {
          autoLaunchTimerRef.current = window.setTimeout(() => {
            onContinueAfterRedeem(updated);
          }, 900);
        }
      } else {
        setSubmitError(res.message || 'Mã kích hoạt không hợp lệ hoặc đã được sử dụng.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Đã xảy ra lỗi khi xác nhận mã kích hoạt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseNow = () => {
    if (autoLaunchTimerRef.current) {
      window.clearTimeout(autoLaunchTimerRef.current);
      autoLaunchTimerRef.current = null;
    }
    if (redeemedUser && onContinueAfterRedeem) {
      onContinueAfterRedeem(redeemedUser);
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
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-white p-5 border-b border-amber-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                {submitSuccess && !isInsufficient
                  ? 'Kích hoạt thành công!'
                  : isInsufficient
                  ? 'Không đủ tín dụng AI'
                  : 'Nhập mã kích hoạt (Redeem Code)'}
              </h2>
              <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                {reasonMessage ||
                  (isInsufficient
                    ? `Thao tác này cần ${requiredCredits} tín dụng AI. Vui lòng liên lạc Quản trị viên qua số điện thoại ${ADMIN_PHONE} để được cấp mã kích hoạt.`
                    : 'Nhập mã kích hoạt do Quản trị viên cấp để cộng thêm tín dụng AI vào tài khoản.')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="p-6 space-y-5">
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
                className={`text-2xl font-bold font-mono ${
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

          {/* Admin contact & daily 24h refresh prompt */}
          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">
                Yêu cầu Quản trị viên cấp mã kích hoạt để sử dụng ngay
              </p>
              <p className="text-sky-700 flex items-center gap-1.5 flex-wrap">
                <span>Liên lạc Quản trị viên qua số điện thoại:</span>
                <a
                  href={`tel:${ADMIN_PHONE}`}
                  className="inline-flex items-center gap-1 font-mono font-bold text-sky-900 hover:text-sky-600 underline underline-offset-2"
                >
                  <Phone className="w-3 h-3" />
                  <span>{ADMIN_PHONE}</span>
                </a>
              </p>
              <p className="text-[11px] text-sky-800/90">
                Hoặc chờ hệ thống tự động làm mới <strong>{DAILY_FREE_CREDITS} tín dụng AI miễn phí</strong> sau mỗi 24 giờ
                {remainingResetText ? ` (còn khoảng ${remainingResetText})` : ''}.
              </p>
            </div>
          </div>

          {/* Redeem Code Input */}
          <div className="space-y-2">
            <label
              htmlFor="redeem-code-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
            >
              Mã kích hoạt (Redeem Code)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="redeem-code-input"
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã kích hoạt (VD: HLS-A1B2C3)"
                autoComplete="off"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-hidden font-mono text-sm font-bold tracking-wider uppercase text-slate-900 bg-slate-50 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting || !promoInput.trim()}
                className="px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer shrink-0"
              >
                {isSubmitting ? 'Đang kiểm tra...' : 'Xác nhận'}
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                {pendingItemTitle
                  ? `Đang mở "${pendingItemTitle}"... Thầy/cô đã có thể sử dụng Kho Ứng Dụng, Học Liệu Số và Thí Nghiệm Mô Phỏng.`
                  : 'Thầy/cô đã có thể sử dụng ngay Kho Ứng Dụng, Học Liệu Số và Thí Nghiệm Mô Phỏng.'}
              </p>
              {!isInsufficient && (
                <button
                  type="button"
                  onClick={handleUseNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{pendingItemTitle ? `Mở ngay: ${pendingItemTitle}` : 'Bắt đầu sử dụng ngay'}</span>
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="truncate">Tài khoản: {activeUser.email}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Đóng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
