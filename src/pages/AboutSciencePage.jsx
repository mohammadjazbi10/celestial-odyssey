import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight } from 'lucide-react';
import LightCurveChart from '../components/LightCurveChart';
import { SCIENCE_LEVELS, generateLightCurveData } from '../data/mockData';

export default function AboutSciencePage({ scienceMode = 'student', onModeChange }) {
  const [selectedModule, setSelectedModule] = useState('transit');
  const educationCurve = useMemo(() => generateLightCurveData('repeating_dip', 90), []);

  const currentLevelInfo = SCIENCE_LEVELS[scienceMode] || SCIENCE_LEVELS.student;

  const modules = [
    {
      id: 'lightcurve',
      title: 'What is a Light Curve?',
      tag: 'Core Concept',
      content: {
        beginner: 'A light curve is like a heart-rate monitor for a star. If an exoplanet passes between the star and our telescope, it blocks a tiny fraction of starlight, producing a measurable U-shaped dip in brightness.',
        student: 'A light curve plots normalized flux F(t) as a function of Barycentric TESS Julian Date (BTJD). Transit events appear as periodic negative excursions whose fractional depth is proportional to (Rp / R*)^2.',
        researcher: 'Time-series photometry corrected via Pre-search Data Conditioning (PDCSAP). Cotrending basis vectors (CBVs) eliminate thermal drifts, focus variations, and jitter before Mandel-Agol transit modeling.'
      }
    },
    {
      id: 'tess',
      title: 'NASA TESS & 2-Minute Cadence',
      tag: 'Survey Mission',
      content: {
        beginner: 'TESS is a NASA spacecraft in high Earth orbit. It uses 4 wide-angle cameras to stare at sectors of the sky for about 27 days each, monitoring 200,000+ bright nearby stars.',
        student: 'The Transiting Exoplanet Survey Satellite (TESS) samples high-priority targets at 2-minute cadence and the entire field at 200-second Full Frame Images (FFIs), optimized for M-dwarf habitability zones.',
        researcher: 'TESS utilizes an elliptical 2:1 lunar resonance orbit (P = 13.7 days). Photometric precision reaches < 200 ppm per 1-hour bin on V ~ 10 stars, sensitive to Earth-to-Neptune sized transits.'
      }
    },
    {
      id: 'tic',
      title: 'TIC IDs & Target Selection',
      tag: 'Catalog ID',
      content: {
        beginner: 'Every star in the mission has a unique national ID number called a TIC ID (TESS Input Catalog), helping astronomers across the globe identify the exact same star.',
        student: 'The TESS Input Catalog (TIC) compiles astrometric and photometric parameters for hundreds of millions of objects, synthesizing data from Gaia DR3, 2MASS, and Tycho-2.',
        researcher: 'TIC v8 includes stellar radii, effective temperatures (Teff), surface gravities (log g), and contamination ratios essential for deblending flux dilution in 21-arcsecond pixels.'
      }
    },
    {
      id: 'flares',
      title: 'Stellar Flares vs Transits',
      tag: 'Physics',
      content: {
        beginner: 'A transit makes the star look dimmer because a planet is in the way. A flare makes the star look suddenly much brighter because of an explosive eruption on the star surface.',
        student: 'Flares are rapid coronal magnetic reconnection events characterized by sharp impulsive rises followed by exponential cooling decays, contrasting with symmetric transit dips.',
        researcher: 'Flare energetics scale as E ~ 10^33 - 10^36 ergs (superflares). Differentiating chromospheric activity from planetary occultations requires multiband monitoring and morphological asymmetry filters.'
      }
    },
    {
      id: 'artifacts',
      title: 'Instrument Artifacts & Momentum Dumps',
      tag: 'Data Quality',
      content: {
        beginner: 'Telescopes have small thruster firings and mechanical shakes. Sometimes what looks like a planet is just the camera shifting slightly as it resets its spinning wheels.',
        student: 'Spacecraft reaction wheels saturate with angular momentum from solar radiation pressure. Routine momentum dumps cause pointing glitches marked with quality bit flags.',
        researcher: 'Quality bitmask 0x0001 (attitude tweak) and 0x0020 (momentum dump) exclude corrupted cadences. Pixel centroid motion tests confirm whether flux changes are on-target or blended background stars.'
      }
    },
    {
      id: 'verification',
      title: 'Why Verification Matters',
      tag: 'Validation',
      content: {
        beginner: 'Before announcing we found a new alien world, scientists do thorough checks to be certain it is not an instrument bug, an asteroid, or twin stars circling each other.',
        student: 'Over 50% of initial transit signals are false positives, including eclipsing binaries and background blends. Systematic checks like odd-even transit depth tests are mandatory.',
        researcher: 'Statistical validation tools (such as TRICERATOPS or VESPA) calculate false positive probabilities (FPP). Follow-up high-resolution spectroscopy confirms planetary masses via radial velocities.'
      }
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <BookOpen className="w-4 h-4" />
            <span>ASTROPHYSICS REPOSITORY // EXPLANATION PROTOCOL</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            About the Science + Explanation Levels
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            One consistent data truth, three explanation levels; learning aids never modify science.
          </p>
        </div>

        {/* Explanation Level Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-[#1B1A18] p-1.5 rounded-lg border border-[#ECE8DF]/15">
          <span className="text-[10px] font-sans font-bold tracking-widest text-[#C5A059] uppercase px-2">
            EXPLANATION LEVEL
          </span>
          {['beginner', 'student', 'researcher'].map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`py-1.5 px-3.5 rounded text-xs font-sans capitalize transition-all ${
                scienceMode === mode
                  ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow'
                  : 'text-[#ECE8DF]/60 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: What is a light curve? + Dynamic Explanation Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Left Column (2 Cols): What is a light curve? */}
        <div className="lg:col-span-2 rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-sans font-bold tracking-widest text-[#C5A059] uppercase">
                  PHOTOMETRIC FOUNDATION
                </span>
                <h2 className="text-2xl font-['Playfair_Display',serif] font-normal text-white mt-1">
                  What is a light curve?
                </h2>
                <p className="text-xs text-[#ECE8DF]/70 font-sans mt-0.5">
                  A star brightness chart across time, used to identify possible events.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-[#6EA893] bg-[#141312] px-3 py-1.5 rounded border border-[#ECE8DF]/15">
                <span>TRANSIT INGRESS & EGRESS</span>
              </div>
            </div>

            {/* Interactive Light Curve */}
            <div className="my-4">
              <LightCurveChart
                data={educationCurve}
                height={260}
                showMarkers={true}
                title="TIME (BTJD) // NORMALIZED FLUX DIP"
              />
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-[#ECE8DF]/15 flex flex-wrap items-center justify-between text-xs font-mono text-[#ECE8DF]/60 gap-2">
            <span>● Blue circle markers indicate automatically detected transit minima.</span>
            <span className="text-[#C5A059]">Flux baseline: 1.000</span>
          </div>
        </div>

        {/* Right Column: Dynamic Explanation Card */}
        <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-sans font-bold tracking-widest text-[#C5A059] uppercase">
              CURRENT LEVEL ADAPTATION
            </span>
            <h3 className="text-2xl font-['Playfair_Display',serif] font-normal text-white mt-1 uppercase">
              {currentLevelInfo.title}
            </h3>

            <div className="my-4 p-4 rounded-lg bg-[#141312] border border-[#ECE8DF]/15 text-xs leading-relaxed text-[#ECE8DF]/90 font-sans">
              {currentLevelInfo.summary}
            </div>

            <div className="space-y-2 mt-4 font-sans">
              <div className="text-[11px] font-bold text-[#C5A059] uppercase tracking-wider">
                Transit Mechanics:
              </div>
              <p className="text-xs text-[#ECE8DF]/80 leading-relaxed font-light">
                {currentLevelInfo.transitExplanation}
              </p>
            </div>
          </div>

          {/* Concepts tags */}
          <div className="mt-6 pt-4 border-t border-[#ECE8DF]/15">
            <div className="text-[10px] font-sans font-bold tracking-widest text-[#ECE8DF]/50 uppercase mb-2">
              Key Concepts at this Level:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentLevelInfo.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono bg-[#141312] text-[#C5A059] px-2 py-0.5 rounded border border-[#C5A059]/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: OTHER LEARNING MODULES */}
      <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl">
        <div className="pb-4 border-b border-[#ECE8DF]/15 mb-6">
          <h2 className="text-2xl font-['Playfair_Display',serif] font-normal text-white">
            Other learning modules
          </h2>
          <p className="text-xs font-sans text-[#ECE8DF]/60 mt-1">
            TESS / TIC ID / sectors / 2-minute cadence / transit / flare / artifacts / why verification matters
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const isSelected = selectedModule === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedModule(m.id)}
                className={`cursor-pointer rounded-xl bg-[#141312] border p-4 flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-[#C5A059] bg-[#191816] shadow-lg'
                    : 'border-[#ECE8DF]/15 hover:border-[#ECE8DF]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-sans font-bold tracking-wider text-[#C5A059] bg-[#1B1A18] px-2 py-0.5 rounded border border-[#C5A059]/30 uppercase">
                      {m.tag}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />}
                  </div>
                  <h3 className="text-base font-serif font-bold text-white mb-2">
                    {m.title}
                  </h3>
                  <p className="text-xs text-[#ECE8DF]/80 leading-relaxed font-sans">
                    {m.content[scienceMode] || m.content.student}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-[#ECE8DF]/10 flex items-center justify-between text-[11px] font-mono text-[#ECE8DF]/50">
                  <span>Level: {scienceMode}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C5A059]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
