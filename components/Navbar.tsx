'use client';

import React from 'react';
import { Package, Download, Terminal } from 'lucide-react';

interface NavbarProps {
  onScrollTo: (sectionId: string) => void;
  onQuickBuild: () => void;
  isBuilding?: boolean;
}

export function Navbar({ onScrollTo, onQuickBuild, isBuilding }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#EAE6E1]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#D97757] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            L
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-[#1F1E1D] leading-none">
              Larp v1.1
            </span>
            <span className="text-[11px] text-[#8C867D] font-medium leading-tight">
              Capacitor Bundler Engine
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single line, clean typography) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B6661]">
          <button
            onClick={() => onScrollTo('research')}
            className="hover:text-[#1F1E1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            Research & Architecture
          </button>
          <button
            onClick={() => onScrollTo('bundler')}
            className="hover:text-[#1F1E1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            Bundler Console
          </button>
          <button
            onClick={() => onScrollTo('simulator')}
            className="hover:text-[#1F1E1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            Device Simulator
          </button>
          <button
            onClick={() => onScrollTo('downloads')}
            className="hover:text-[#1F1E1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            Downloads & Artifacts
          </button>
          <button
            onClick={() => onScrollTo('api-docs')}
            className="hover:text-[#1F1E1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            API Reference
          </button>
          <a
            href="/documentation"
            className="text-[#D97757] font-semibold hover:text-[#B85434] transition-colors whitespace-nowrap"
          >
            Documentation
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onQuickBuild}
            disabled={isBuilding}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#D97757] hover:bg-[#C86646] active:scale-[0.98] rounded-lg transition-all shadow-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            {isBuilding ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Bundling App...</span>
              </>
            ) : (
              <>
                <Package className="w-3.5 h-3.5" />
                <span>Build Native App</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
