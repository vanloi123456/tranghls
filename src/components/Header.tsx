import React, { useState } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import topBannerBg from '../assets/images/top_header_banner_1794961612725.jpg';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onNavigateHome }) => {
  const [bannerImgFailed, setBannerImgFailed] = useState(false);

  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-sky-950 via-sky-800 to-teal-900 border-b border-sky-300/30 shadow-xs">
      {/* Compact Top Banner Background Image */}
      {!bannerImgFailed && (
        <img
          src={topBannerBg}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setBannerImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.32] pointer-events-none select-none"
        />
      )}

      {/* Measured contrast scrim for crisp legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-sky-950/65 via-sky-900/35 to-sky-950/65 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 h-11 sm:h-12 flex items-center justify-between gap-3">
        {/* Left: Mobile navigation menu toggle */}
        <div className="w-9 flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 text-white/95 hover:text-white rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            title="Mở thanh điều hướng"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Compact Title Banner */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (onNavigateHome) {
              onNavigateHome();
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="flex items-center justify-center gap-2 min-w-0 text-white hover:text-sky-100 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0 hidden sm:inline-block" aria-hidden="true" />
          <span className="text-sm sm:text-base md:text-lg font-bold font-display tracking-wide truncate drop-shadow-xs">
            Học liệu số - Giáo viên sáng tạo
          </span>
        </a>

        {/* Right spacer for balanced horizontal centering */}
        <div className="w-9 shrink-0" aria-hidden="true" />
      </div>
    </header>
  );
};
