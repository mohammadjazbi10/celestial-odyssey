import React, { useState, useEffect } from 'react';
import { Telescope, Compass, ArrowRight, ChevronDown, Sparkles, LogIn } from 'lucide-react';
import RotatingPlanet from '../components/RotatingPlanet';
import { EngravedBandedPlanet, EngravedRingedPlanet, EngravedAstronaut } from '../components/CelestialIllustrations';
import { apiGet } from '../lib/polarixApi';

export default function LandingPage({ onNavigate, onOpenAuth, user }) {
  const [zoomProgress, setZoomProgress] = useState(0);
  const [dataSummary, setDataSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet('/targets?limit=1'),
      apiGet('/targets?ml_analyzed=true&limit=1'),
      apiGet('/candidates?limit=1')
    ]).then(([targets, analyzed, candidates]) => {
      if (!cancelled) setDataSummary({ targets: targets.total, analyzed: analyzed.total, candidates: candidates.total });
    }).catch(() => {
      if (!cancelled) setDataSummary({ unavailable: true });
    });
    return () => { cancelled = true; };
  }, []);

  // Monitor scroll for circular telescope zoom effect when passing through the Polarix disc section
  useEffect(() => {
    const handleScroll = () => {
      const discSection = document.getElementById('polarix-front-page');
      if (!discSection) return;

      const rect = discSection.getBoundingClientRect();
      const windowH = window.innerHeight;

      // When the Polarix page is in view, calculate zoom as user scrolls through it
      const start = windowH * 0.4;
      const end = -windowH * 0.4;
      const current = rect.top;

      if (current > start) {
        setZoomProgress(0);
      } else if (current < end) {
        setZoomProgress(1);
      } else {
        setZoomProgress((start - current) / (start - end));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAction = (pageId) => {
    if (!user) {
      onOpenAuth();
    } else {
      onNavigate(pageId);
    }
  };

  // Zoom scale calculation: from 1 to 5.2
  const circleScale = 1 + zoomProgress * 4.2;

  // Innovision 4-point Diamond Twinkle SVG helper
  const TwinkleSparkle = ({ className = '', style = {} }) => (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={style}>
      <path d="M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z" />
    </svg>
  );

  return (
    <div className="relative text-[#141312] min-h-screen">
      {/* ========================================================
          PAGE 1: FIRST LANDING PAGE — "WELCOME TO POLARIX"
          (NIT Rourkela completely removed, pure Polarix science theme)
         ======================================================== */}
      <section className="relative min-h-[100vh] bg-[#141312] text-[#ECE8DF] flex flex-col items-center justify-center overflow-hidden px-4 select-none border-b border-[#ECE8DF]/15">
        {/* Starfield stipple texture */}
        <div className="absolute inset-0 stipple-bg pointer-events-none opacity-70" />

        {/* Viewport Corner Reticle Ticks */}
        <div className="absolute inset-4 sm:inset-8 pointer-events-none text-[#ECE8DF]/40 z-20">
          <span className="absolute left-0 top-0 w-6 h-6 border-l-2 border-t-2 border-[#C5A059]" />
          <span className="absolute right-0 top-0 w-6 h-6 border-r-2 border-t-2 border-[#C5A059]" />
          <span className="absolute left-0 bottom-0 w-6 h-6 border-l-2 border-b-2 border-[#C5A059]" />
          <span className="absolute right-0 bottom-0 w-6 h-6 border-r-2 border-b-2 border-[#C5A059]" />

          {/* Left vertical coordinate bar (no NIT Rourkela) */}
          <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[11px] font-sans font-bold tracking-[0.3em] text-[#C5A059] whitespace-nowrap">
            RA 135.42° · DEC -28.71° · TESS ARCHIVE · POLARIX
          </div>

          {/* Right cadence badge */}
          <div className="hidden sm:flex absolute right-2 top-8 flex-col text-right font-serif">
            <span className="text-[11px] font-sans font-bold tracking-[0.25em] text-[#C5A059] flex items-center justify-end gap-1.5 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-ping" />
              CELESTIAL SURVEY / 2026
            </span>
            <span className="text-2xl md:text-3xl font-bold text-[#ECE8DF] tracking-wider my-0.5">
              SECTOR 05
            </span>
            <span className="text-[10px] font-sans tracking-[0.2em] text-[#ECE8DF]/60 uppercase">
              TESS 2-MIN CADENCE
            </span>
          </div>
        </div>

        {/* Background Concentric Astrolabe Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[540px] h-[540px] rounded-full border border-[#C5A059]/15 animate-orbit" />
          <div className="w-[780px] h-[780px] rounded-full border border-dashed border-[#ECE8DF]/15 animate-orbit-reverse" />
          <div className="w-[1020px] h-[1020px] rounded-full border border-dotted border-[#C5A059]/10" />
        </div>

        {/* Floating Twinkle Sparkles */}
        <div className="absolute left-[15%] top-[25%] text-[#C5A059] animate-twinkle">
          <TwinkleSparkle className="w-5 h-5" />
        </div>
        <div className="absolute right-[18%] top-[22%] text-[#ECE8DF] animate-twinkle" style={{ animationDelay: '1.2s' }}>
          <TwinkleSparkle className="w-4 h-4" />
        </div>
        <div className="absolute left-[22%] bottom-[25%] text-[#ECE8DF] animate-twinkle" style={{ animationDelay: '0.8s' }}>
          <TwinkleSparkle className="w-3.5 h-3.5" />
        </div>
        <div className="absolute right-[24%] bottom-[28%] text-[#C5A059] animate-twinkle" style={{ animationDelay: '1.8s' }}>
          <TwinkleSparkle className="w-4.5 h-4.5" />
        </div>

        {/* Welcome Content Box (No NIT Rourkela) */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl px-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#1B1A18] border border-[#C5A059]/40 text-xs font-sans font-bold tracking-[0.28em] text-[#C5A059] uppercase mb-6 shadow-lg">
            <Compass className="w-3.5 h-3.5 text-[#C5A059] animate-spin" style={{ animationDuration: '24s' }} />
            <span>DEEP SKY EXOPLANET ARCHIVE · POLARIX OBSERVATORY PRESENTS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-['Cinzel',serif] font-normal tracking-[0.08em] text-white leading-tight my-2 glow-gold">
            WELCOME TO <span className="text-[#C5A059] font-bold">POLARIX</span>
          </h1>

          <div className="flex items-center justify-center gap-4 w-full max-w-lg my-4">
            <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#C5A059] to-[#C5A059]" />
            <span className="text-xs sm:text-sm font-sans font-bold tracking-[0.26em] text-[#C5A059] uppercase whitespace-nowrap">
              2026 · THE CELESTIAL ODYSSEY
            </span>
            <span className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#C5A059] to-[#C5A059]" />
          </div>

          <p className="max-w-2xl text-base sm:text-lg text-[#ECE8DF]/80 font-sans font-light leading-relaxed my-4">
            Explore the unknown. Investigate exoplanetary signals, cosmic anomalies, and light curves from the frontier of space science.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <button
              onClick={() => {
                const el = document.getElementById('polarix-front-page');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="chamfer-btn px-8 py-3.5 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase shadow-xl flex items-center gap-2 group"
            >
              <span>ENTER POLARIX ODYSSEY</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {!user ? (
              <button
                onClick={onOpenAuth}
                className="chamfer-btn px-6 py-3.5 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/30 text-[#ECE8DF] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase flex items-center gap-2"
              >
                <span>ASTRONOMER SIGN IN</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('overview')}
                className="chamfer-btn px-6 py-3.5 bg-[#1B1A18] hover:bg-[#23211E] border border-[#C5A059]/50 text-[#C5A059] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase flex items-center gap-2"
              >
                <span>COMMAND CENTER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scroll indicator pointing to the Polarix disc page */}
        <div
          onClick={() => {
            const el = document.getElementById('polarix-front-page');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-6 flex flex-col items-center gap-1.5 text-[#ECE8DF]/70 text-xs font-sans font-bold tracking-widest uppercase cursor-pointer animate-bounce z-20"
        >
          <span>SCROLL DOWN TO EXPLORE THE UNIVERSE</span>
          <ChevronDown className="w-4 h-4 text-[#C5A059]" />
        </div>
      </section>

      {/* ========================================================
          PAGE 2: THE POLARIX HOME PAGE
          (EXACT RECREATION OF UPLOADED INNOVISION SCREENSHOT)
          - Cream Parchment #ECE8DF background with stipple
          - Engraved Jupiter on bottom-left
          - Engraved Saturn & Asteroid on top-left
          - Engraved Astronaut on bottom-right
          - 2-3 Revolving small planets on background orbits
          - Large black circular disc with radar sweep
          - Giant POLARIX title spanning across disc with mix-blend-mode
          - Two chamfered buttons inside the disc
          - NO NIT Rourkela anywhere!
         ======================================================== */}
      <section
        id="polarix-front-page"
        className="relative min-h-[105vh] bg-[#ECE8DF] text-[#141312] flex flex-col items-center justify-center overflow-hidden px-4 select-none"
      >
        {/* Subtle stipple background texture */}
        <div className="absolute inset-0 stipple-bg-light pointer-events-none opacity-40" />

        {/* Viewport Corner Reticle Ticks & Coordinates */}
        <div className="absolute inset-4 sm:inset-8 pointer-events-none text-[#141312]/40 z-20">
          <span className="absolute left-0 top-0 w-6 h-6 border-l-2 border-t-2 border-[#141312]/50" />
          <span className="absolute right-0 top-0 w-6 h-6 border-r-2 border-t-2 border-[#141312]/50" />
          <span className="absolute left-0 bottom-0 w-6 h-6 border-l-2 border-b-2 border-[#141312]/50" />
          <span className="absolute right-0 bottom-0 w-6 h-6 border-r-2 border-b-2 border-[#141312]/50" />

          {/* Left Vertical Coordinate bar */}
          <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[11px] font-sans font-bold tracking-[0.3em] text-[#141312] whitespace-nowrap">
            22.2533° N · 84.9011° E · POLARIX OBSERVATORY
          </div>

          {/* Right Mission Dates Box (Innovision Screenshot Top-Right) */}
          <div className="hidden sm:flex absolute right-2 top-8 flex-col text-right font-serif">
            <span className="text-[11px] font-sans font-bold tracking-[0.25em] text-[#8a6a2a] flex items-center justify-end gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8a6a2a]" />
              MISSION CADENCE / 2026
            </span>
            <span className="text-3xl md:text-5xl font-bold text-[#141312] tracking-wider my-0.5 font-['Playfair_Display',serif]">
              13 — 15
            </span>
            <span className="text-[10px] font-sans tracking-[0.2em] text-[#141312]/70 uppercase">
              NOVEMBER · TESS ARCHIVE
            </span>
          </div>
        </div>

        {/* ========================================================
            CELESTIAL ARTWORK MATCHING UPLOADED SCREENSHOT
           ======================================================== */}
        {/* 1. TOP-LEFT: Engraved Saturn-like Ringed Planet & Asteroid */}
        <div className="absolute top-[8%] left-[6%] sm:left-[10%] w-36 sm:w-44 h-36 sm:h-44 pointer-events-none z-10 transition-transform duration-700 hover:scale-105">
          <EngravedRingedPlanet className="w-full h-full" />
        </div>

        {/* 2. BOTTOM-LEFT: Large Engraved Banded Planet (Jupiter) */}
        <div className="absolute -bottom-16 -left-16 sm:-bottom-12 sm:-left-12 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 pointer-events-none z-10">
          <EngravedBandedPlanet className="w-full h-full" />
        </div>

        {/* 3. BOTTOM-RIGHT: Vintage Engraved Astronaut drifting beside disc */}
        <div className="absolute bottom-[6%] right-[5%] sm:right-[10%] w-36 sm:w-48 h-52 sm:h-64 pointer-events-none z-10 animate-float">
          <EngravedAstronaut className="w-full h-full" />
        </div>

        {/* ========================================================
            BACKGROUND CONCENTRIC ORBITS & 2-3 REVOLVING SMALL PLANETS
           ======================================================== */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
          {/* ORBIT TRACK 1 (Radius 280px) */}
          <div
            className="absolute rounded-full border border-dashed border-[#141312]/20"
            style={{ width: '560px', height: '560px' }}
          />
          {/* PLANET 1: Small Terrestrial Moon */}
          <div className="absolute w-0 h-0 flex items-center justify-center animate-revolve-1">
            <div
              className="w-4 h-4 rounded-full bg-[#141312] border border-[#ECE8DF] shadow-md flex items-center justify-center overflow-hidden"
              title="Terrestrial Moon"
            >
              <div className="w-full h-full bg-gradient-to-tr from-[#141312] via-[#545048] to-[#ECE8DF]" />
            </div>
          </div>

          {/* ORBIT TRACK 2 (Radius 410px) */}
          <div
            className="absolute rounded-full border border-dotted border-[#141312]/25"
            style={{ width: '820px', height: '820px' }}
          />
          {/* PLANET 2: Small Ringed Planet */}
          <div className="absolute w-0 h-0 flex items-center justify-center animate-revolve-2">
            <div className="relative flex items-center justify-center" title="Ringed Exoplanet">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E5BE6C] via-[#C5A059] to-[#2b2518] shadow-md z-10" />
              <div
                className="absolute w-9 h-2.5 rounded-full border border-[#141312]/80 -rotate-15 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, rgba(197,160,89,0.6), rgba(20,19,18,0.2))' }}
              />
            </div>
          </div>

          {/* ORBIT TRACK 3 (Radius 530px) */}
          <div
            className="absolute rounded-full border border-[#141312]/15"
            style={{ width: '1060px', height: '1060px' }}
          />
          {/* PLANET 3: Small Terracotta Orb */}
          <div className="absolute w-0 h-0 flex items-center justify-center animate-revolve-3">
            <div
              className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#D97757] via-[#a84d31] to-[#141312] shadow-sm border border-[#141312]/30"
              title="Outer Terrestrial Orb"
            />
          </div>
        </div>

        {/* Floating Twinkle Sparkles */}
        <div className="absolute left-[12%] top-[22%] text-[#141312] animate-twinkle">
          <TwinkleSparkle className="w-4 h-4" />
        </div>
        <div className="absolute left-[20%] top-[68%] text-[#141312] animate-twinkle" style={{ animationDelay: '1s' }}>
          <TwinkleSparkle className="w-3 h-3" />
        </div>
        <div className="absolute right-[14%] top-[20%] text-[#141312] animate-twinkle" style={{ animationDelay: '1.5s' }}>
          <TwinkleSparkle className="w-5 h-5" />
        </div>
        <div className="absolute right-[18%] bottom-[22%] text-[#141312] animate-twinkle" style={{ animationDelay: '0.5s' }}>
          <TwinkleSparkle className="w-3.5 h-3.5" />
        </div>

        {/* ========================================================
            CENTRAL CELESTIAL DISC & GIANT POLARIX TITLE OVERLAY
            (Identical to the uploaded screenshot where INNOVISION
             stretches wider than the disc, and letters overlap!)
           ======================================================== */}
        <div className="relative flex items-center justify-center w-full max-w-4xl z-10 my-4">
          {/* The Central Black Disc */}
          <div
            id="telescope-portal-disc"
            className="relative flex items-center justify-center rounded-full shadow-2xl transition-transform duration-100 ease-out will-change-transform z-10"
            style={{
              width: 'min(500px, 86vw)',
              height: 'min(500px, 86vw)',
              background: '#141312',
              color: '#ECE8DF',
              transform: `scale(${circleScale})`,
              transformOrigin: 'center center'
            }}
          >
            {/* Inner dashed ring */}
            <div className="absolute inset-3 rounded-full border border-dashed border-[#ECE8DF]/15 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-[#ECE8DF]/10 pointer-events-none" />

            {/* Radar sweep beam */}
            <div className="absolute inset-0 rounded-full innovision-sweep pointer-events-none opacity-50" />

            {/* Inside disc sparkles */}
            <div className="absolute left-[26%] top-[28%] text-[#ECE8DF] animate-twinkle">
              <TwinkleSparkle className="w-2.5 h-2.5" />
            </div>
            <div className="absolute right-[28%] top-[28%] text-[#ECE8DF] animate-twinkle" style={{ animationDelay: '1.2s' }}>
              <TwinkleSparkle className="w-3 h-3" />
            </div>

            {/* Disc Top Text (Curved / Arched kicker, no NIT Rourkela) */}
            <div className="absolute top-10 sm:top-14 flex flex-col items-center text-center px-4 z-20 pointer-events-none">
              <span className="text-[10px] sm:text-[11px] font-sans font-bold tracking-[0.3em] text-[#ECE8DF] uppercase">
                DEEP SKY EXOPLANET ARCHIVE
              </span>
              <span className="text-[9px] sm:text-[10px] font-sans tracking-[0.24em] text-[#ECE8DF]/70 uppercase mt-0.5">
                CELESTIAL SURVEY PRESENTS
              </span>
            </div>

            {/* Subline with golden horizontal rules below the title */}
            <div className="absolute bottom-28 sm:bottom-32 flex items-center justify-center gap-2 w-full px-8 z-20 pointer-events-none">
              <span className="h-[1px] flex-1 bg-[#C5A059]" />
              <span className="text-[10px] sm:text-xs font-sans font-bold tracking-[0.26em] text-[#C5A059] uppercase whitespace-nowrap">
                2026 · THE CELESTIAL ODYSSEY
              </span>
              <span className="h-[1px] flex-1 bg-[#C5A059]" />
            </div>

            {/* Two Chamfered CTAs inside disc (matching screenshot) */}
            <div className="absolute bottom-12 sm:bottom-16 flex flex-wrap items-center justify-center gap-3 z-30 pointer-events-auto">
              <button
                onClick={() => {
                  if (zoomProgress < 0.6) {
                    const el = document.getElementById('odyssey-map-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    handleAction('overview');
                  }
                }}
                className="chamfer-btn px-5 sm:px-7 py-2.5 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase shadow-lg flex items-center gap-1.5"
              >
                <span>BEGIN THE ODYSSEY</span>
              </button>

              {!user && (
                <button
                  onClick={onOpenAuth}
                  className="chamfer-btn px-5 sm:px-7 py-2.5 bg-[#141312] hover:bg-[#1B1A18] text-[#ECE8DF] border border-[#ECE8DF]/40 font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-1.5"
                >
                  <span>REGISTER</span>
                </button>
              )}
            </div>
          </div>

          {/* GIANT TITLE: POLARIX
              Spanning WIDER than the disc with mix-blend-mode: difference!
              White on dark circle, Dark charcoal on cream background! */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <h1
              className="font-['Playfair_Display',serif] text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-normal tracking-[0.06em] text-white leading-none select-none text-center whitespace-nowrap"
              style={{
                mixBlendMode: 'difference',
                width: '100%'
              }}
            >
              POLARIX
            </h1>
          </div>
        </div>

        {/* Scroll Down Hint */}
        <div
          onClick={() => {
            const el = document.getElementById('odyssey-map-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-4 flex flex-col items-center gap-1 text-[#141312]/70 text-xs font-sans font-bold tracking-widest uppercase cursor-pointer animate-bounce z-20"
        >
          <span>SCROLL DOWN TO EXPLORE THE UNIVERSE</span>
          <ChevronDown className="w-4 h-4 text-[#8a6a2a]" />
        </div>
      </section>

      {/* ========================================================
          PAGE 3: INTRO NARRATIVE (Innovision Section 2 with Cream Canvas)
         ======================================================== */}
      <section className="relative z-20 py-24 sm:py-32 px-6 sm:px-12 lg:px-20 bg-[#ECE8DF] text-[#141312] border-t border-[#141312]/15 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-['Playfair_Display',serif] font-normal leading-[1.12] tracking-tight mb-12">
            For a few days, Polarix turns into a launch pad for builders, thinkers, and exoplanet hunters from across the world.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-[#141312]/20">
            <div className="md:col-span-2">
              <p className="text-base sm:text-lg text-[#2b2926] leading-relaxed font-sans max-w-2xl">
                Inspired by deep-space astrophysical archives and modern orbital photometers, Polarix charts a Celestial Odyssey across four scientific realms: <b>Overview Command</b> for real-time sector telemetry, <b>Sky Explorer</b> for interactive catalog star maps, <b>Discover Anomalies</b> for four distinct event families, and <b>Mystery Missions</b> for hands-on light curve detrending and AI verification.
              </p>
            </div>

            {/* Innovision 3-Column Meta Details */}
            <div className="grid grid-cols-3 gap-4 border-l border-dashed border-[#141312]/30 pl-6 self-start">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-sans font-bold tracking-[0.24em] text-[#8a6a2a] uppercase">HOST</span>
                <span className="text-sm font-serif font-bold text-[#141312]">TESS / MAST Archive</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-sans font-bold tracking-[0.24em] text-[#8a6a2a] uppercase">WORLDS</span>
                <span className="text-sm font-serif font-bold text-[#141312]">Four Frontiers</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-sans font-bold tracking-[0.24em] text-[#8a6a2a] uppercase">CREW</span>
                <span className="text-sm font-serif font-bold text-[#141312]">Astronomers & Explorers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          PAGE 4: THE ODYSSEY MAP (4 Cards with Moons)
         ======================================================== */}
      <section
        id="odyssey-map-section"
        className="relative z-20 py-28 px-4 sm:px-6 lg:px-12 bg-[#141312] text-[#ECE8DF] overflow-hidden"
      >
        <div className="absolute inset-0 stipple-bg pointer-events-none opacity-60" />

        <div className="relative max-w-7xl mx-auto">
          <header className="mb-14">
            <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>MISSION MAP // FOUR KINDS OF DISCOVERY</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-['Playfair_Display',serif] font-normal tracking-tight text-[#ECE8DF] m-0">
              The Odyssey Map
            </h2>
            <p className="text-base text-[#ECE8DF]/80 font-sans mt-3 max-w-xl">
              Four worlds, four kinds of mission. Each one opens into its own line-up of scientific tools and data streams.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 01 - Coral Accent */}
            <div className="group relative rounded-2xl bg-[#1B1A18] border border-[#D97757]/60 p-6 h-[540px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_35px_rgba(217,119,87,0.25)]">
              <div className="absolute -right-16 top-16 w-64 h-64 rounded-full bg-gradient-to-br from-[#ECE8DF]/15 to-transparent pointer-events-none border border-dashed border-[#ECE8DF]/20 group-hover:scale-105 transition-transform duration-700 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-dotted border-[#D97757]/40" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-['Playfair_Display',serif] text-5xl font-normal text-transparent" style={{ WebkitTextStroke: '1.5px #D97757' }}>
                    01
                  </span>
                  <span className="text-[11px] font-sans font-bold tracking-[0.28em] text-[#D97757]">
                    MISSION 01
                  </span>
                </div>

                <div className="mt-20">
                  <span className="text-xs font-sans font-bold tracking-[0.28em] text-[#D97757] block mb-2 uppercase">
                    TECHNICAL ARENA
                  </span>
                  <h3 className="font-['Playfair_Display',serif] text-3xl font-normal text-white">
                    Overview Command
                  </h3>
                  <p className="text-sm text-[#ECE8DF]/80 font-sans mt-3 leading-relaxed">
                    {dataSummary?.unavailable
                      ? 'Live science telemetry is unavailable until the local POLARIX data API is running.'
                      : dataSummary
                        ? `${dataSummary.targets} acquired targets · ${dataSummary.analyzed} with ML outputs · ${dataSummary.candidates} candidate records.`
                        : 'Loading counts from the local POLARIX data API…'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleAction('overview')}
                className="chamfer-btn w-fit px-5 py-3 bg-[#ECE8DF] hover:bg-[#D97757] text-[#141312] hover:text-white font-sans font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
              >
                <span>EXPLORE WORLD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 02 - Steel Blue Accent */}
            <div className="group relative rounded-2xl bg-[#1B1A18] border border-[#6B8EAE]/60 p-6 h-[540px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_35px_rgba(107,142,174,0.25)]">
              <div className="absolute -right-16 top-16 w-64 h-64 rounded-full bg-gradient-to-br from-[#ECE8DF]/15 to-transparent pointer-events-none border border-dashed border-[#ECE8DF]/20 group-hover:scale-105 transition-transform duration-700 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-dotted border-[#6B8EAE]/40" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-['Playfair_Display',serif] text-5xl font-normal text-transparent" style={{ WebkitTextStroke: '1.5px #6B8EAE' }}>
                    02
                  </span>
                  <span className="text-[11px] font-sans font-bold tracking-[0.28em] text-[#6B8EAE]">
                    MISSION 02
                  </span>
                </div>

                <div className="mt-20">
                  <span className="text-xs font-sans font-bold tracking-[0.28em] text-[#6B8EAE] block mb-2 uppercase">
                    CELESTIAL SURVEY
                  </span>
                  <h3 className="font-['Playfair_Display',serif] text-3xl font-normal text-white">
                    Sky Explorer
                  </h3>
                  <p className="text-sm text-[#ECE8DF]/80 font-sans mt-3 leading-relaxed">
                    Interactive celestial map overlaying true RA/DEC target coordinates, clickable TIC markers, and real-time target specs.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleAction('sky')}
                className="chamfer-btn w-fit px-5 py-3 bg-[#ECE8DF] hover:bg-[#6B8EAE] text-[#141312] hover:text-white font-sans font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
              >
                <span>EXPLORE WORLD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 03 - Violet Accent */}
            <div className="group relative rounded-2xl bg-[#1B1A18] border border-[#9D78A8]/60 p-6 h-[540px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_35px_rgba(157,120,168,0.25)]">
              <div className="absolute -right-16 top-16 w-64 h-64 rounded-full bg-gradient-to-br from-[#ECE8DF]/15 to-transparent pointer-events-none border border-dashed border-[#ECE8DF]/20 group-hover:scale-105 transition-transform duration-700 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-dotted border-[#9D78A8]/40" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-['Playfair_Display',serif] text-5xl font-normal text-transparent" style={{ WebkitTextStroke: '1.5px #9D78A8' }}>
                    03
                  </span>
                  <span className="text-[11px] font-sans font-bold tracking-[0.28em] text-[#9D78A8]">
                    MISSION 03
                  </span>
                </div>

                <div className="mt-20">
                  <span className="text-xs font-sans font-bold tracking-[0.28em] text-[#9D78A8] block mb-2 uppercase">
                    ANOMALY FAMILIES
                  </span>
                  <h3 className="font-['Playfair_Display',serif] text-3xl font-normal text-white">
                    Discover Anomalies
                  </h3>
                  <p className="text-sm text-[#ECE8DF]/80 font-sans mt-3 leading-relaxed">
                    Browse four understandable event families: Hidden Shadows, Sudden Flashes, Strange Patterns, and Single Mysteries.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleAction('discover')}
                className="chamfer-btn w-fit px-5 py-3 bg-[#ECE8DF] hover:bg-[#9D78A8] text-[#141312] hover:text-white font-sans font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
              >
                <span>EXPLORE WORLD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 04 - Sage Green Accent */}
            <div className="group relative rounded-2xl bg-[#1B1A18] border border-[#6EA893]/60 p-6 h-[540px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_35px_rgba(110,168,147,0.25)]">
              <div className="absolute -right-16 top-16 w-64 h-64 rounded-full bg-gradient-to-br from-[#ECE8DF]/15 to-transparent pointer-events-none border border-dashed border-[#ECE8DF]/20 group-hover:scale-105 transition-transform duration-700 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-dotted border-[#6EA893]/40" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-['Playfair_Display',serif] text-5xl font-normal text-transparent" style={{ WebkitTextStroke: '1.5px #6EA893' }}>
                    04
                  </span>
                  <span className="text-[11px] font-sans font-bold tracking-[0.28em] text-[#6EA893]">
                    MISSION 04
                  </span>
                </div>

                <div className="mt-20">
                  <span className="text-xs font-sans font-bold tracking-[0.28em] text-[#6EA893] block mb-2 uppercase">
                    LAB & AI VERIFICATION
                  </span>
                  <h3 className="font-['Playfair_Display',serif] text-3xl font-normal text-white">
                    Mystery Missions
                  </h3>
                  <p className="text-sm text-[#ECE8DF]/80 font-sans mt-3 leading-relaxed">
                    Guided learning missions, interactive Signal Lab aperture controls, and Gemma AI evidence-based investigation traces.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleAction('missions')}
                className="chamfer-btn w-fit px-5 py-3 bg-[#ECE8DF] hover:bg-[#6EA893] text-[#141312] hover:text-white font-sans font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
              >
                <span>EXPLORE WORLD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          PAGE 5: BIG BOLD QUOTE & REVOLVING ENGRAVED PLANET
         ======================================================== */}
      <section className="relative z-20 py-28 px-4 text-center bg-[#141312] text-[#ECE8DF] border-t border-[#ECE8DF]/15 overflow-hidden">
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.3em] uppercase mb-4">
            <TwinkleSparkle className="w-3.5 h-3.5" />
            <span>THE CELESTIAL ODYSSEY CONCLUDES</span>
          </div>

          <blockquote className="font-['Playfair_Display',serif] text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-[#ECE8DF] leading-tight uppercase">
            “LET'S START YOUR DISCOVERY JOURNEY WITH POLARIX”
          </blockquote>

          <p className="max-w-2xl text-[#ECE8DF]/80 text-base sm:text-lg font-sans mt-6 font-light leading-relaxed">
            Every dip in brightness tells the story of an orbiting world. Connect with real mission light curves and start formulating your hypotheses today.
          </p>

          <div className="my-10 relative flex items-center justify-center">
            <RotatingPlanet size={280} />
          </div>

          {!user ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 z-10">
              <button
                onClick={onOpenAuth}
                className="chamfer-btn px-8 py-3.5 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase shadow-xl flex items-center justify-center gap-2"
              >
                <span>SIGN UP / LOG IN</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleAction('overview')}
                className="chamfer-btn px-6 py-3.5 bg-[#1B1A18] hover:bg-[#23211E] text-[#ECE8DF] border border-[#ECE8DF]/30 font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase flex items-center justify-center gap-2"
              >
                <span>BROWSE COMMAND CENTER</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('overview')}
              className="chamfer-btn px-8 py-3.5 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase shadow-xl flex items-center justify-center gap-2"
            >
              <span>ENTER OVERVIEW DASHBOARD</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 border-t border-[#ECE8DF]/15 bg-[#141312] py-8 text-xs font-sans text-[#ECE8DF]/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-['Cinzel',serif] font-bold text-[#ECE8DF]">POLARIX</span>
            <span>· 2026 THE CELESTIAL ODYSSEY</span>
          </div>
          <div className="tracking-wider uppercase text-[10px]">
            HOSTED WITH NASA TESS DATA ARCHIVE
          </div>
        </div>
      </footer>
    </div>
  );
}
