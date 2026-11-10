import React from 'react';
import { Telescope, Compass, Radio, Target, BookOpen, BookmarkCheck, LogIn, LogOut, Sparkles, UserCheck } from 'lucide-react';

export default function TopNavbar({
  activePage,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  scienceMode,
  onModeChange
}) {
  const navItems = [
    { id: 'overview', label: 'OVERVIEW', icon: Compass },
    { id: 'sky', label: 'SKY EXPLORER', icon: Telescope },
    { id: 'discover', label: 'DISCOVER', icon: Radio },
    { id: 'missions', label: 'MYSTERY MISSIONS', icon: Target },
    { id: 'investigations', label: 'MY INVESTIGATIONS', icon: BookmarkCheck },
    { id: 'science', label: 'ABOUT THE SCIENCE', icon: BookOpen },
  ];

  const handleNavClick = (pageId) => {
    if (!user && pageId !== 'home') {
      onOpenAuth();
      return;
    }
    onNavigate(pageId);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#141312]/92 backdrop-blur-md border-b border-[#ECE8DF]/15 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo - Innovision Celestial Odyssey Style */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          {/* Innovision style gear / telescope emblem */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full border border-[#ECE8DF]/30 bg-[#1B1A18] group-hover:border-[#C5A059] transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#C5A059] animate-spin" style={{ animationDuration: '30s' }}>
              <path d="M12 2L14 7L19 5L17 10L22 12L17 14L19 19L14 17L12 22L10 17L5 19L7 14L2 12L7 10L5 5L10 7Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="absolute w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
          </div>
          <div className="flex flex-col">
            <span className="font-['Cinzel',serif] font-bold text-xl tracking-[0.18em] text-[#ECE8DF] group-hover:text-[#C5A059] transition-colors">
              POLARIX
            </span>
            <span className="text-[9px] font-sans font-semibold tracking-[0.24em] text-[#C5A059] -mt-0.5 uppercase">
              The Celestial Odyssey
            </span>
          </div>
        </div>

        {/* Center Navigation Bar (Always on Top) */}
        <nav className="hidden lg:flex items-center gap-6 bg-[#1B1A18]/60 px-5 py-2 rounded-full border border-[#ECE8DF]/15">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-xs font-['Cinzel',serif] font-semibold tracking-[0.2em] transition-all relative py-1 ${
                  isActive
                    ? 'text-[#C5A059]'
                    : 'text-[#ECE8DF]/75 hover:text-[#ECE8DF]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#C5A059] rounded-full shadow-sm shadow-[#C5A059]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Side: Mode Switcher & User Profile / Login */}
        <div className="flex items-center gap-3">
          {/* Science Mode Toggle in Innovision minimal style */}
          <div className="hidden sm:flex items-center bg-[#1B1A18] border border-[#ECE8DF]/20 rounded-lg p-0.5 text-[11px] font-sans">
            {['beginner', 'student', 'researcher'].map((mode) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={`px-2.5 py-1 rounded capitalize transition-all ${
                  scienceMode === mode
                    ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow-sm'
                    : 'text-[#ECE8DF]/60 hover:text-[#ECE8DF]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* User Auth Status */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#1B1A18] border border-[#ECE8DF]/20 px-3 py-1.5 rounded-lg">
                <UserCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-serif font-bold text-[#ECE8DF] leading-tight">{user.name}</span>
                  <span className="text-[9px] font-sans tracking-wider text-[#C5A059] leading-tight">{user.role}</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Log Out"
                className="p-2 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[#ECE8DF]/60 hover:text-red-400 hover:border-red-400/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="chamfer-btn px-5 py-2 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] hover:text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase shadow-md transition-all flex items-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>LOG IN</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Row */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 bg-[#1B1A18] border-t border-[#ECE8DF]/15 gap-2 scrollbar-none">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`px-3 py-1 whitespace-nowrap text-[11px] font-['Cinzel',serif] tracking-wider rounded transition-all ${
                isActive
                  ? 'bg-[#C5A059] text-[#141312] font-bold'
                  : 'text-[#ECE8DF]/75 bg-[#141312]/60 hover:bg-[#141312]'
              }`}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
