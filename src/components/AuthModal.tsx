import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { authService } from '../services/auth';
import { UserAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserAccount | null) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setIsRegisterMode(false);
      setFullName('');
      setEmail('');
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsGoogleLoading(true);
    try {
      const res = await authService.signInWithGoogle();
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else if (res.message) {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsFormLoading(true);

    try {
      const res = isRegisterMode
        ? await authService.registerWithEmailPassword(fullName, email, password)
        : await authService.signInWithEmailPassword(email, password);

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setErrorMsg(res.message || 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Đã xảy ra lỗi khi xác thực tài khoản.');
    } finally {
      setIsFormLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Đăng nhập"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-white px-6 py-4 border-b border-sky-100 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Đăng nhập
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 whitespace-pre-line">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Unified Sign-In Options: Google Account Picker + Email & Password */}
        <div className="p-6 space-y-5">
          {/* Option 1: Google Account Selection */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isFormLoading}
            className="w-full py-3 px-4 rounded-2xl border-2 border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50/40 text-slate-800 font-bold text-sm shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            <span>
              {isGoogleLoading ? 'Đang kết nối...' : 'Chọn tài khoản Google'}
            </span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white">
              Hoặc
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Option 2: Email & Password Form (no pre-filled admin email hints) */}
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-3.5">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập địa chỉ email"
                  autoComplete="email"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isFormLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.99] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {isFormLoading
                ? 'Đang xác thực...'
                : isRegisterMode
                ? 'Đăng ký & Đăng nhập'
                : 'Đăng nhập'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
              >
                {isRegisterMode
                  ? 'Đã có tài khoản? Quay lại đăng nhập'
                  : 'Chưa có tài khoản? Đăng ký bằng Email'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
