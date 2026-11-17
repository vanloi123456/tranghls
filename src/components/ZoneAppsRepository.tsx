import React, { useRef } from 'react';
import {
  Cpu,
  Trash2,
  Edit3,
  Play,
  Camera,
  RotateCcw,
  Box,
  Gamepad2,
  Puzzle,
  Sparkles,
} from 'lucide-react';
import { ContentItem, UserRole, UserAccount } from '../types';
import { processImageFile } from '../utils/image';

interface ZoneAppsRepositoryProps {
  items: ContentItem[];
  role: UserRole;
  currentUser: UserAccount | null;
  avatarUrl?: string;
  onUploadAvatar?: (dataUrl: string) => void;
  onRemoveAvatar?: () => void;
  onOpenAuth: () => void;
  onSelectZone?: () => void;
  onEditItem: (item: ContentItem) => void;
  onDeleteItem: (item: ContentItem) => void;
  onLaunchApp: (item: ContentItem) => void;
}

function getAppIconConfig(title: string): {
  Icon: React.FC<{ className?: string }>;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  const lower = title.toLowerCase();
  if (lower.includes('3d') || lower.includes('ảo') || lower.includes('phòng học')) {
    return {
      Icon: Box,
      bgClass: 'from-sky-50 to-cyan-100',
      textClass: 'text-sky-600',
      borderClass: 'border-sky-200',
    };
  }
  if (lower.includes('kéo co') || lower.includes('chinh phục')) {
    return {
      Icon: Gamepad2,
      bgClass: 'from-indigo-50 to-violet-100',
      textClass: 'text-indigo-600',
      borderClass: 'border-indigo-200',
    };
  }
  if (lower.includes('kéo thả') || lower.includes('nối ý')) {
    return {
      Icon: Puzzle,
      bgClass: 'from-emerald-50 to-teal-100',
      textClass: 'text-teal-600',
      borderClass: 'border-teal-200',
    };
  }
  if (lower.includes('trưng bày') || lower.includes('ai')) {
    return {
      Icon: Sparkles,
      bgClass: 'from-amber-50 to-orange-100',
      textClass: 'text-amber-600',
      borderClass: 'border-amber-200',
    };
  }
  return {
    Icon: Cpu,
    bgClass: 'from-sky-50 to-blue-100',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-200',
  };
}

export const ZoneAppsRepository: React.FC<ZoneAppsRepositoryProps> = ({
  items,
  role,
  avatarUrl,
  onUploadAvatar,
  onRemoveAvatar,
  onSelectZone,
  onEditItem,
  onDeleteItem,
  onLaunchApp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';
  const canManage = isAdmin;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAvatar) return;
    try {
      const dataUrl = await processImageFile(file, 600);
      onUploadAvatar(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xử lý hình ảnh');
    }
    e.target.value = '';
  };

  return (
    <section id="kho-ung-dung" className="scroll-mt-28 md:scroll-mt-24 space-y-4">
      {/* Hidden file input for Admin */}
      {isAdmin && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {/* Zone Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-200/70">
        <div className="flex items-center gap-3">
          <div
            className={`relative ${isAdmin ? 'cursor-pointer group' : ''}`}
            onClick={() => isAdmin && fileInputRef.current?.click()}
            title={isAdmin ? 'Quản trị viên nhấn để thêm / thay đổi hình đại diện' : undefined}
          >
            {avatarUrl ? (
              <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-sky-400 shadow-md bg-slate-100 relative">
                <img src={avatarUrl} alt="Kho Ứng Dụng" className="w-full h-full object-cover" />
                {isAdmin && (
                  <div className="absolute inset-0 bg-sky-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Camera className="w-4 h-4" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <Cpu className="w-6 h-6" />
              </div>
            )}

            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute -bottom-1 -right-1 p-1 bg-sky-600 hover:bg-sky-700 text-white rounded-full shadow-xs cursor-pointer"
                title="Đổi hình đại diện Kho Ứng Dụng"
              >
                <Camera className="w-3 h-3" />
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onSelectZone}
                className="text-xl font-bold text-slate-900 hover:text-sky-700 font-display transition-colors cursor-pointer text-left"
              >
                Kho Ứng Dụng
              </button>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {items.length} ứng dụng
              </span>
            </div>

            {/* Admin dedicated avatar action toolbar */}
            {isAdmin && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200 shadow-2xs transition-colors cursor-pointer"
                  title="Tải lên hoặc thay đổi hình đại diện Kho Ứng Dụng"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  <span>{avatarUrl ? 'Thay đổi hình đại diện' : 'Thêm hình đại diện'}</span>
                </button>
                {avatarUrl && onRemoveAvatar && (
                  <button
                    onClick={onRemoveAvatar}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                    title="Xóa hình đại diện và khôi phục biểu tượng mặc định"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Xóa hình</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Icon + Title + Description + Bắt đầu button (NO live game iframe preview) */}
      {items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sky-200 bg-white/80 backdrop-blur-md p-12 text-center flex flex-col items-center justify-center transition-all hover:bg-white/90 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-xs border border-sky-100 text-sky-500 flex items-center justify-center mb-3">
            <Cpu className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Kho ứng dụng đang trống
          </h3>
          <p className="text-xs text-slate-600 max-w-md mb-2 leading-relaxed">
            Chưa có ứng dụng nào được tải lên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const { Icon, bgClass, textClass, borderClass } = getAppIconConfig(item.title);
            return (
              <div
                key={item.id}
                className="group bg-white/95 backdrop-blur-sm rounded-2xl border border-sky-100/90 hover:border-sky-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all p-5 flex flex-col justify-between gap-4"
              >
                {/* Top: Representative Icon & Title/Description */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${bgClass} border ${borderClass} ${textClass} flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-7 h-7" />
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                          title="Sửa mã nhúng hoặc đổi tên ứng dụng"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa ứng dụng này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3
                      className="text-base font-bold text-slate-900 line-clamp-2 font-display leading-snug"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-3 mt-1.5 leading-relaxed">
                      {item.description || 'Ứng dụng giáo dục tương tác dành cho giáo viên và học sinh.'}
                    </p>
                  </div>
                </div>

                {/* Bottom: Bắt đầu */}
                <div className="pt-3 border-t border-slate-100 flex items-center">
                  <button
                    type="button"
                    onClick={() => onLaunchApp(item)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-bold text-xs shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Bắt đầu</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
