import React, { useState } from 'react';
import { Telescope, Crosshair, ArrowRight, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { SKY_TARGETS } from '../data/mockData';

export default function SkyExplorerPage({ onNavigate, onSelectCandidate }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedTarget, setSelectedTarget] = useState(SKY_TARGETS[0]);
  const [zoomLevel, setZoomLevel] = useState(1);

  const filteredTargets = SKY_TARGETS.filter(t => {
    if (filterCategory === 'all') return true;
    return t.category === filterCategory;
  });

  const handleOpenCandidate = () => {
    if (onSelectCandidate) {
      if (selectedTarget.id === 'TIC-123456') onSelectCandidate('cand-1');
      else if (selectedTarget.id === 'TIC-994201') onSelectCandidate('cand-2');
      else if (selectedTarget.id === 'TIC-773120') onSelectCandidate('cand-3');
      else onSelectCandidate('cand-4');
    }
    onNavigate('discover');
  };

  const handleInvestigate = () => {
    if (onSelectCandidate) {
      if (selectedTarget.id === 'TIC-123456') onSelectCandidate('cand-1');
      else if (selectedTarget.id === 'TIC-994201') onSelectCandidate('cand-2');
      else if (selectedTarget.id === 'TIC-773120') onSelectCandidate('cand-3');
      else onSelectCandidate('cand-4');
    }
    onNavigate('missions');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <Telescope className="w-4 h-4" />
            <span>CELESTIAL SPHERE SURVEY // TESS FULL SKY</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            Sky Explorer
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            Explore real survey imagery; overlay only analyzed targets as clickable catalog markers.
          </p>
        </div>

        {/* Provenance Badges */}
        <div className="flex flex-wrap items-center gap-2 font-sans">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[11px] text-[#C5A059] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
            <span>ALADIN LITE / REAL SKY SURVEY</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[11px] text-[#ECE8DF]/60">
            TESS / DEMO DATA
          </div>
        </div>
      </div>

      {/* Main Layout: Sky Survey Map on Left, Selected Target on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Interactive Star Map */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="relative w-full h-[480px] rounded-xl bg-[#100F0E] border border-[#ECE8DF]/15 overflow-hidden shadow-2xl select-none group">
            {/* Real Deep Sky Imagery Background Simulation */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
              style={{
                transform: `scale(${zoomLevel})`,
                backgroundImage: `radial-gradient(circle at 60% 40%, rgba(197, 160, 89, 0.08) 0%, transparent 45%),
                                  radial-gradient(circle at 25% 75%, rgba(157, 120, 168, 0.08) 0%, transparent 50%),
                                  radial-gradient(circle at 50% 50%, #171614 0%, #100F0E 95%)`
              }}
            >
              {/* Star field background */}
              {Array.from({ length: 90 }).map((_, i) => {
                const top = ((i * 17) % 96) + 2;
                const left = ((i * 29) % 96) + 2;
                const size = (i % 3 === 0 ? 2.5 : 1.5);
                const opacity = 0.3 + ((i % 5) * 0.14);
                return (
                  <div
                    key={i}
                    className="absolute rounded-full bg-[#ECE8DF]"
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      opacity
                    }}
                  />
                );
              })}

              {/* Coordinate Grid Lines (RA / DEC) in Innovision Gold / Charcoal */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
                <line x1="20%" y1="0" x2="20%" y2="100%" stroke="#C5A059" strokeDasharray="4 4" />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#C5A059" strokeDasharray="4 4" />
                <line x1="80%" y1="0" x2="80%" y2="100%" stroke="#C5A059" strokeDasharray="4 4" />
                <line x1="0" y1="30%" x2="100%" y2="30%" stroke="#ECE8DF" strokeDasharray="4 4" />
                <line x1="0" y1="65%" x2="100%" y2="65%" stroke="#ECE8DF" strokeDasharray="4 4" />
                <text x="52%" y="18" fill="#C5A059" fontSize="10" fontFamily="monospace">RA: 180°</text>
                <text x="18" y="32%" fill="#ECE8DF" fontSize="10" fontFamily="monospace">DEC: +00°</text>
              </svg>
            </div>

            {/* Clickable Analyzed Target Markers */}
            {filteredTargets.map((target) => {
              const isSelected = selectedTarget?.id === target.id;
              let markerColor = '#C5A059';
              if (target.category === 'flares') markerColor = '#E5BE6C';
              if (target.category === 'strange') markerColor = '#9D78A8';

              return (
                <div
                  key={target.id}
                  onClick={() => setSelectedTarget(target)}
                  className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2 z-20 group/marker"
                  style={{
                    left: `${target.xPercent}%`,
                    top: `${target.yPercent}%`
                  }}
                >
                  <div
                    className="relative flex items-center justify-center transition-transform hover:scale-125"
                    style={{ width: '32px', height: '32px' }}
                  >
                    <div
                      className={`absolute inset-0 rounded-full border ${isSelected ? 'border-2 animate-ping' : 'border'}`}
                      style={{ borderColor: markerColor, opacity: isSelected ? 0.9 : 0.6 }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: markerColor }}
                    />

                    {/* Target Label Callout */}
                    <div
                      className={`absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                        isSelected
                          ? 'bg-[#1B1A18] border-[#C5A059] text-white shadow-lg'
                          : 'bg-[#141312]/90 border-[#ECE8DF]/20 text-[#ECE8DF]/80 opacity-80 group-hover/marker:opacity-100'
                      }`}
                    >
                      {target.name}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Map Top HUD */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-30">
              <div className="px-3 py-1 rounded bg-[#141312]/90 border border-[#ECE8DF]/20 text-[10px] font-sans font-bold tracking-wider text-[#C5A059] flex items-center gap-1.5 backdrop-blur-md">
                <Crosshair className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>OVERLAY: {filteredTargets.length} ANALYZED TARGETS</span>
              </div>
            </div>

            {/* Map Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-30">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2))}
                className="p-1.5 rounded bg-[#141312]/90 border border-[#ECE8DF]/20 hover:border-[#C5A059] text-[#ECE8DF]/80 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 1))}
                className="p-1.5 rounded bg-[#141312]/90 border border-[#ECE8DF]/20 hover:border-[#C5A059] text-[#ECE8DF]/80 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded bg-[#141312]/90 border border-[#ECE8DF]/20 hover:border-[#C5A059] text-[#ECE8DF]/80 hover:text-white"
                title="Reset View"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filter Buttons (from PDF page 3) */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All events' },
              { id: 'dips', label: 'Dips' },
              { id: 'flares', label: 'Flares' },
              { id: 'strange', label: 'Strange patterns' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`chamfer-btn px-4 py-2 text-xs font-['Cinzel',serif] tracking-wider transition-all ${
                  filterCategory === tab.id
                    ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow-md'
                    : 'bg-[#1B1A18] text-[#ECE8DF]/70 hover:text-white border border-[#ECE8DF]/15 hover:border-[#C5A059]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Selected Target Panel (from PDF page 3) */}
        <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#ECE8DF]/15">
              <div>
                <span className="text-[10px] font-sans font-bold tracking-[0.24em] text-[#C5A059] uppercase">
                  CATALOG INSPECTOR
                </span>
                <h3 className="text-2xl font-['Playfair_Display',serif] font-normal text-white mt-1">
                  Selected target
                </h3>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#C5A059] animate-ping" />
            </div>

            {selectedTarget ? (
              <div className="mt-4 space-y-4">
                <div className="bg-[#141312] p-3 rounded-lg border border-[#ECE8DF]/15">
                  <div className="text-sm font-bold text-white font-mono">
                    {selectedTarget.name} / {selectedTarget.sector}
                  </div>
                  <div className="text-xs text-[#C5A059] font-sans mt-0.5">
                    TESS Photometry / 2-minute Cadence
                  </div>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">RA</span>
                    <span className="text-white font-semibold">{selectedTarget.ra} deg</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">DEC</span>
                    <span className="text-white font-semibold">{selectedTarget.dec} deg</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">Event</span>
                    <span className="text-[#C5A059] font-semibold">{selectedTarget.event}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">Rank</span>
                    <span className="text-[#9D78A8] font-semibold">{selectedTarget.rank}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">Status</span>
                    <span className="text-[#6EA893] font-semibold">{selectedTarget.status}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#ECE8DF]/10">
                    <span className="text-[#ECE8DF]/60">Period</span>
                    <span className="text-[#ECE8DF]/90">{selectedTarget.period}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#ECE8DF]/60">Signal-to-Noise</span>
                    <span className="text-[#C5A059] font-semibold">{selectedTarget.snr} σ</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#ECE8DF]/60">
                Click on any catalog marker in the survey map to inspect target metadata.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-[#ECE8DF]/15 space-y-2.5">
            <button
              onClick={handleOpenCandidate}
              className="chamfer-btn w-full py-2.5 px-4 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2"
            >
              <span>Open candidate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleInvestigate}
              className="chamfer-btn w-full py-2.5 px-4 bg-[#141312] hover:bg-[#23211E] border border-[#ECE8DF]/25 text-[#ECE8DF] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2"
            >
              <span>Investigate</span>
            </button>

            <div className="text-[11px] font-sans text-[#ECE8DF]/50 text-center pt-1">
              Only processed targets have analysis results.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
