import React, { useEffect } from 'react';
import { X, Cpu, Gamepad2, FlaskConical, Eye } from 'lucide-react';
import { ContentItem } from '../types';
import { generateSandboxHtml } from '../utils/embed';

interface ContentViewModalProps {
  item: ContentItem | null;
  onClose: () => void;
}

export const ContentViewModal: React.FC<ContentViewModalProps> = ({ item, onClose }) => {
  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const zoneMeta =
    item.zone === 'games'
      ? {
          label: 'Học Liệu Số',
          Icon: Gamepad2,
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          iconBgClass: 'bg-indigo-100 text-indigo-600',
        }
      : item.zone === 'simulations'
      ? {
          label: 'Thí Nghiệm Mô Phỏng',
          Icon: FlaskConical,
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
          iconBgClass: 'bg-teal-100 text-teal-600',
        }
      : {
          label: 'Kho Ứng Dụng',
          Icon: Cpu,
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
          iconBgClass: 'bg-sky-100 text-sky-600',
        };

  const ZoneIcon = zoneMeta.Icon;
  const previewHtml = item.embedCode
    ? generateSandboxHtml(item.embedCode, {
        teacherId: 'preview_readonly',
        itemId: item.id,
        readOnly: true,
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 bg-gradient-to-r from-sky-50 via-white to-slate-50 border-b border-sky-100">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${zoneMeta.iconBgClass}`}
            >
              <ZoneIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${zoneMeta.badgeClass}`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Xem nội dung • {zoneMeta.label}</span>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 font-display leading-snug">
                {item.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
            {item.description ||
              `Nội dung giáo dục thuộc khu vực ${zoneMeta.label} dành cho giáo viên và học sinh.`}
          </div>

          {previewHtml ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-950 overflow-hidden shadow-inner">
              <div className="px-4 py-2 bg-slate-900 text-[11px] font-semibold text-slate-300 border-b border-slate-800 flex items-center justify-between">
                <span>Bản xem trước nội dung (chế độ chỉ xem)</span>
              </div>
              <div className="aspect-video w-full bg-white">
                <iframe
                  srcDoc={previewHtml}
                  title={`Xem trước: ${item.title}`}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Nội dung này hiện chưa có bản xem trước trực quan.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
