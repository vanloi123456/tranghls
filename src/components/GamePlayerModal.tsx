import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Gamepad2,
  CloudCheck,
  ChevronRight,
  Home,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ContentItem } from '../types';
import { generateSandboxHtml } from '../utils/embed';

interface GamePlayerModalProps {
  item: ContentItem | null;
  teacherId?: string | null;
  initialAppData?: Record<string, string>;
  externalSyncEvent?: { itemId: string; data: Record<string, string>; ts: number } | null;
  onStorageMutation?: (
    itemId: string,
    payload: { op: 'set' | 'remove' | 'clear'; key?: string; value?: string }
  ) => void;
  onNavigateHome?: () => void;
  onNavigateZone?: () => void;
  onClose: () => void;
}

export const GamePlayerModal: React.FC<GamePlayerModalProps> = ({
  item,
  teacherId,
  initialAppData,
  externalSyncEvent,
  onStorageMutation,
  onNavigateHome,
  onNavigateZone,
  onClose,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialDataRef = useRef<Record<string, string>>({});

  initialDataRef.current = initialAppData || {};

  const pushLatestDataToIframe = (data?: Record<string, string>) => {
    if (!item || !teacherId || !data) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'TEACHER_APP_STORAGE_EXTERNAL_SYNC',
        teacherId,
        itemId: item.id,
        data,
      },
      '*'
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!item || !teacherId || !onStorageMutation) return;

    const handleMessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || msg.type !== 'TEACHER_APP_STORAGE_MUTATION') return;
      if (msg.itemId !== item.id || msg.teacherId !== teacherId) return;

      setSyncStatus('saving');
      onStorageMutation(item.id, {
        op: msg.op,
        key: msg.key,
        value: msg.value,
      });
      setTimeout(() => setSyncStatus('saved'), 250);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [item?.id, teacherId, onStorageMutation]);

  useEffect(() => {
    if (!externalSyncEvent || !item || !teacherId) return;
    if (externalSyncEvent.itemId !== item.id) return;
    pushLatestDataToIframe(externalSyncEvent.data);
    setSyncStatus('saved');
  }, [externalSyncEvent, item?.id, teacherId]);

  useEffect(() => {
    if (!item || !teacherId || !initialAppData) return;
    pushLatestDataToIframe(initialAppData);
  }, [initialAppData, item?.id, teacherId]);

  const sandboxContent = useMemo(() => {
    if (!item?.embedCode) return '';
    return generateSandboxHtml(
      item.embedCode,
      teacherId
        ? {
            teacherId,
            itemId: item.id,
            initialData: initialDataRef.current,
          }
        : undefined
    );
  }, [item?.id, item?.embedCode, refreshKey, teacherId]);

  if (!item || !item.embedCode) return null;

  const handleCelebrate = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#818cf8'],
    });
  };

  const handleRestart = () => {
    setRefreshKey((k) => k + 1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Game Stage Topbar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900/90 border-b border-sky-950/60 text-white gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-[11px] text-sky-300/90 font-medium flex-wrap mb-0.5"
            >
              <button
                type="button"
                onClick={onNavigateHome || onClose}
                className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <Home className="w-3 h-3" />
                <span>Trang chủ</span>
              </button>
              <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              <button
                type="button"
                onClick={onNavigateZone || onClose}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Học Liệu Số
              </button>
              <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="text-sky-200 font-semibold truncate max-w-[200px]">
                {item.title}
              </span>
              {teacherId && (
                <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CloudCheck className="w-3 h-3" />
                  <span>
                    {syncStatus === 'saving'
                      ? 'Đang đồng bộ...'
                      : 'Tự động lưu theo tài khoản'}
                  </span>
                </span>
              )}
            </nav>
            <h2 className="text-base font-bold text-white font-display truncate max-w-lg">
              {item.title}
            </h2>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleCelebrate}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Tung hoa chúc mừng học sinh trả lời đúng hoặc hoàn thành"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Khen ngợi học sinh 🎉</span>
          </button>

          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Chơi lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Chơi lại</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Bật / Tắt toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <div className="w-px h-6 bg-slate-800 mx-1" />

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
            title="Thoát trò chơi (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Embedded Safe Game Frame */}
      <div className="flex-1 w-full h-full relative bg-slate-900 overflow-hidden flex items-center justify-center p-2 sm:p-4">
        <div className="w-full h-full max-w-7xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-sky-900/40 relative">
          <iframe
            ref={iframeRef}
            key={`${item.id}_${refreshKey}_${teacherId || 'guest'}`}
            srcDoc={sandboxContent}
            onLoad={() => pushLatestDataToIframe(initialDataRef.current)}
            title={item.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-autoplay allow-downloads allow-modals"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            className="w-full h-full border-0 block"
          />
        </div>
      </div>
    </div>
  );
};
