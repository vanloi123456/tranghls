import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  return (
    <header className="md:hidden px-4 py-2.5 border-b border-sky-100/80">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-1 text-slate-700 hover:text-sky-600 rounded-xl hover:bg-sky-50 transition-colors cursor-pointer"
          title="Mở thanh điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a 
          href="#kho-ung-dung"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-base font-bold text-sky-950 font-display truncate hover:text-sky-700 transition-colors"
        >
          Học Liệu Số – Giáo Viên Sáng Tạo
        </a>

        <div className="w-8" />
      </div>
    </header>
  );
};
