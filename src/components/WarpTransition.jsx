import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

export default function WarpTransition({ targetTitle, isWarping }) {
  if (!isWarping) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-[#141312]/92 backdrop-blur-md animate-in fade-in duration-300">
      {/* Concentric orbital rings */}
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
        <div className="w-[580px] h-[580px] rounded-full border border-[#C5A059]/20 animate-orbit" />
        <div className="w-[360px] h-[360px] rounded-full border border-dashed border-[#ECE8DF]/25 animate-orbit-reverse" />
      </div>

      {/* Center Astrolabe HUD */}
      <div className="relative flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border border-[#C5A059] flex items-center justify-center text-[#C5A059]">
            <Compass className="w-8 h-8 animate-spin text-[#C5A059]" style={{ animationDuration: '20s' }} />
          </div>
          <span className="w-2 h-2 rounded-full bg-[#C5A059] absolute -top-1 -right-1 animate-ping" />
        </div>

        <div className="font-sans text-[11px] uppercase tracking-[0.28em] text-[#C5A059] mb-2 flex items-center gap-2">
          <span>THE CELESTIAL ODYSSEY // ROUTING</span>
        </div>

        <h2 className="text-3xl md:text-5xl font-['Playfair_Display',serif] font-normal tracking-wide text-[#ECE8DF]">
          {targetTitle}
        </h2>

        <div className="mt-3 flex items-center gap-2 font-sans text-[11px] text-[#ECE8DF]/60 tracking-widest uppercase">
          <span>COORDINATES LOCK: ESTABLISHED</span>
          <span className="text-[#C5A059]">● 100%</span>
        </div>
      </div>
    </div>
  );
}
