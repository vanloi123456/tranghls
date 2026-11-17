import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cpu, 
  Gamepad2, 
  FlaskConical, 
  Code2, 
  Bot, 
  AlertCircle,
  Eye,
  Check
} from 'lucide-react';
import { 
  ContentItem, 
  ContentType, 
  ZoneType
} from '../types';
import { validateAndFormatEmbed } from '../utils/embed';

interface AddEditContentModalProps {
  isOpen: boolean;
  defaultZone: ZoneType;
  editingItem: ContentItem | null;
  onSave: (item: Partial<ContentItem>) => Promise<void>;
  onClose: () => void;
}

export const AddEditContentModal: React.FC<AddEditContentModalProps> = ({
  isOpen,
  defaultZone,
  editingItem,
  onSave,
  onClose,
}) => {
  const [zone, setZone] = useState<ZoneType>(defaultZone);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Embed code
  const [embedCode, setEmbedCode] = useState('');
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [embedValidation, setEmbedValidation] = useState<{ isValid: boolean; message?: string }>({ isValid: true });
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setZone(editingItem.zone);
      setTitle(editingItem.title || '');
      setDescription(editingItem.description || '');
      setEmbedCode(editingItem.embedCode || '');
    } else {
      setZone(defaultZone);
      setTitle('');
      setDescription('');
      setEmbedCode('');
    }
    setEmbedValidation({ isValid: true });
    setShowEmbedPreview(false);
  }, [editingItem, defaultZone, isOpen]);

  if (!isOpen) return null;

  // Validate HTML / embed code
  const handleEmbedChange = (code: string) => {
    setEmbedCode(code);
    if (code.trim()) {
      const result = validateAndFormatEmbed(code);
      setEmbedValidation({
        isValid: result.isValid,
        message: result.errorMessage,
      });
    } else {
      setEmbedValidation({ isValid: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Vui lòng nhập tên nội dung');
      return;
    }

    if (!embedCode.trim()) {
      alert('Vui lòng dán mã nhúng HTML ứng dụng/trò chơi/thí nghiệm tạo từ Gemini hoặc Google AI Studio');
      return;
    }

    const val = validateAndFormatEmbed(embedCode);
    if (!val.isValid) {
      setEmbedValidation({ isValid: false, message: val.errorMessage });
      alert(val.errorMessage || 'Mã nhúng không hợp lệ');
      return;
    }

    let contentType: ContentType = 'app';
    if (zone === 'games') contentType = 'game';
    if (zone === 'simulations') contentType = 'simulation';

    setIsSubmitting(true);
    try {
      await onSave({
        zone,
        title: title.trim(),
        description: description.trim(),
        type: contentType,
        embedCode,
        grade: undefined,
        subject: undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu nội dung. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-sky-50 via-cyan-50/50 to-white border-b border-sky-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              {zone === 'apps' && <Cpu className="w-5 h-5" />}
              {zone === 'games' && <Gamepad2 className="w-5 h-5" />}
              {zone === 'simulations' && <FlaskConical className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                {editingItem ? 'Chỉnh sửa nội dung' : 'Thêm mới nội dung'}
              </h2>
              <p className="text-xs text-sky-700">
                Học liệu số – Giáo viên sáng tạo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Zone Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Khu vực học liệu
            </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setZone('apps')}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    zone === 'apps'
                      ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span className="truncate">Kho Ứng Dụng (AI)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setZone('games')}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    zone === 'games'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Gamepad2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Học Liệu Số</span>
                </button>

                <button
                  type="button"
                  onClick={() => setZone('simulations')}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    zone === 'simulations'
                      ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FlaskConical className="w-4 h-4 shrink-0" />
                  <span className="truncate">Thí Nghiệm Mô Phỏng</span>
                </button>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tiêu đề {zone === 'apps' ? 'Ứng dụng' : zone === 'games' ? 'Học liệu số' : 'Thí nghiệm'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mô tả / Hướng dẫn hoạt động (tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả hoặc hướng dẫn..."
              rows={2}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* HTML Embed Code */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã nhúng HTML ứng dụng / trò chơi / thí nghiệm từ Gemini & Google AI Studio <span className="text-rose-500">*</span>
              </label>
              {embedCode && embedValidation.isValid && (
                <button
                  type="button"
                  onClick={() => setShowEmbedPreview(!showEmbedPreview)}
                  className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showEmbedPreview ? 'Ẩn xem trước' : 'Xem trước'}</span>
                </button>
              )}
            </div>

            <textarea
              value={embedCode}
              onChange={(e) => handleEmbedChange(e.target.value)}
              placeholder="Dán mã nhúng HTML hoặc thẻ <iframe>..."
              rows={5}
              className={`w-full px-4 py-2.5 rounded-xl border font-mono text-xs focus:outline-hidden focus:ring-2 transition-all ${
                embedValidation.isValid
                  ? 'border-slate-200 focus:ring-sky-500 bg-slate-900 text-sky-300'
                  : 'border-rose-300 focus:ring-rose-500 bg-rose-50/30 text-rose-900'
              }`}
              required
            />

            {!embedValidation.isValid && embedValidation.message && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{embedValidation.message}</span>
              </div>
            )}

            {showEmbedPreview && embedValidation.isValid && embedCode && (
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-2">Xem trước trong Sandbox an toàn:</p>
                <div className="aspect-video w-full bg-white rounded-xl overflow-hidden">
                  <iframe
                    srcDoc={embedCode}
                    title="Xem trước"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-98 rounded-xl transition-all shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Xác nhận lưu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
