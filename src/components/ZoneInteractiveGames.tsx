import React, { useRef } from 'react';
import { 
  Gamepad2, 
  Maximize2, 
  Trash2, 
  Edit3, 
  PlayCircle,
  Camera,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { 
  ContentItem, 
  UserRole, 
  UserAccount
} from '../types';
import { generateSandboxHtml } from '../utils/embed';
import { processImageFile } from '../utils/image';

interface ZoneInteractiveGamesProps {
  items: ContentItem[];
  role: UserRole;
  currentUser?: UserAccount | null;
  avatarUrl?: string;
  onUploadAvatar?: (dataUrl: string) => void;
  onRemoveAvatar?: () => void;
  onSelectZone?: () => void;
  onEditItem: (item: ContentItem) => void;
  onDeleteItem: (item: ContentItem) => void;
  onViewGame: (item: ContentItem) => void;
  onPlayGame: (item: ContentItem) => void;
}

export const ZoneInteractiveGames: React.FC<ZoneInteractiveGamesProps> = ({
  items,
  role,
  avatarUrl,
  onUploadAvatar,
  onRemoveAvatar,
  onSelectZone,
  onEditItem,
  onDeleteItem,
  onViewGame,
  onPlayGame,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = role === 'admin';
  const isAdmin = role === 'admin';

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
    <section id="tro-choi-tuong-tac" className="scroll-mt-36 space-y-4">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-200/70">
        <div className="flex items-center gap-3">
          <div 
            className={`relative ${isAdmin ? 'cursor-pointer group' : ''}`}
            onClick={() => isAdmin && fileInputRef.current?.click()}
            title={isAdmin ? 'Quản trị viên nhấn để thêm / thay đổi hình đại diện' : undefined}
          >
            {avatarUrl ? (
              <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-md bg-slate-100 relative">
                <img src={avatarUrl} alt="Học Liệu Số" className="w-full h-full object-cover" />
                {isAdmin && (
                  <div className="absolute inset-0 bg-indigo-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Camera className="w-4 h-4" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Gamepad2 className="w-6 h-6" />
              </div>
            )}

            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xs cursor-pointer"
                title="Đổi hình đại diện Học Liệu Số"
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
                className="text-xl font-bold text-slate-900 hover:text-indigo-700 font-display transition-colors cursor-pointer text-left"
              >
                Học Liệu Số
              </button>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                {items.length} học liệu
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Kho học liệu số hỗ trợ học tập và rèn luyện kiến thức
            </p>

            {/* Admin dedicated avatar action toolbar */}
            {isAdmin && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 shadow-2xs transition-colors cursor-pointer"
                  title="Tải lên hoặc thay đổi hình đại diện Học Liệu Số"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
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

      {/* Content Grid or Empty State */}
      {items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-indigo-200 bg-white/80 backdrop-blur-md p-12 text-center flex flex-col items-center justify-center transition-all hover:bg-white/90 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-xs border border-indigo-100 text-indigo-500 flex items-center justify-center mb-3">
            <Gamepad2 className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Khu vực học liệu số đang trống
          </h3>
          <p className="text-xs text-slate-600 max-w-md mb-2 leading-relaxed">
            Chưa có học liệu số nào được hiển thị tại khu vực này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const previewDoc = item.embedCode ? generateSandboxHtml(item.embedCode) : '';

            return (
              <div
                key={item.id}
                className="group bg-white/95 backdrop-blur-sm rounded-2xl border border-indigo-100/90 hover:border-indigo-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
              >
                {/* Game Interactive Preview Frame */}
                <div className="relative aspect-16/10 bg-slate-950 overflow-hidden">
                  {item.embedCode ? (
                    <div className="w-full h-full relative pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
                      <iframe
                        srcDoc={previewDoc}
                        title={item.title}
                        sandbox="allow-scripts allow-same-origin"
                        className="w-full h-full border-0 transform scale-90 origin-center"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Gamepad2 className="w-12 h-12" />
                    </div>
                  )}

                  {/* Play Action Overlay */}
                  <div 
                    onClick={() => onPlayGame(item)}
                    className="absolute inset-0 bg-slate-950/30 hover:bg-slate-950/10 transition-colors flex items-center justify-center cursor-pointer group/btn"
                  >
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 group-hover/btn:bg-indigo-400 text-slate-950 font-bold text-xs shadow-lg group-hover/btn:scale-105 transition-all">
                      <PlayCircle className="w-4 h-4 fill-current" />
                      <span>Bắt đầu chơi tương tác</span>
                    </div>
                  </div>
                </div>

                {/* Game Meta & Controls */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3
                      onClick={() => onPlayGame(item)}
                      className="text-base font-bold text-slate-800 line-clamp-1 hover:text-indigo-600 cursor-pointer font-display"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1">
                        Học liệu số hỗ trợ học tập
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewGame(item)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Xem nội dung học liệu số"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlayGame(item)}
                        className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Thực hiện truy cập học liệu số"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Truy cập</span>
                      </button>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Sửa mã nhúng hoặc đổi tên học liệu"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa học liệu này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
