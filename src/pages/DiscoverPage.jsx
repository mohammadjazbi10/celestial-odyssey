import React, { useState, useMemo, useEffect } from 'react';
import { Radio, Search, SlidersHorizontal, ArrowRight, CheckCircle2 } from 'lucide-react';
import LightCurveChart from '../components/LightCurveChart';
import { apiGet, lightCurvePoints } from '../lib/polarixApi';

const categoryFor = (eventType = '') => {
  if (eventType.includes('flare')) return 'sudden_flashes';
  if (eventType.includes('periodic')) return 'hidden_shadows';
  if (eventType.includes('isolated')) return 'single_mysteries';
  return 'strange_patterns';
};

const eventLabel = (eventType = 'event candidate') => eventType.replace(/_candidate$/, '').replaceAll('_', ' ');
const formatValue = (value, digits = 4) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'Not available';

export default function DiscoverPage({ onNavigate, onSelectCandidate }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank');
  const [candidates, setCandidates] = useState([]);
  const [candidateCurves, setCandidateCurves] = useState({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCandidates() {
      try {
        const payload = await apiGet('/candidates?limit=500');
        if (cancelled) return;
        const rows = payload.results || [];
        setCandidates(rows);
        const uniqueTargets = [...new Map(rows
          .filter((row) => row.lightcurve_available)
          .map((row) => [`${row.tic_id}:${row.sector}`, row])).values()];
        const curves = await Promise.all(uniqueTargets.map(async (row) => {
          try {
            const curve = await apiGet(`/lightcurves/${row.tic_id}?sector=${row.sector}&max_points=180`);
            return [`${row.tic_id}:${row.sector}`, lightCurvePoints(curve)];
          } catch {
            return [`${row.tic_id}:${row.sector}`, []];
          }
        }));
        if (!cancelled) setCandidateCurves(Object.fromEntries(curves));
      } catch (error) {
        if (!cancelled) setApiError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCandidates();
    return () => { cancelled = true; };
  }, []);

  // 4 Categories matching Innovision 4 missions palette
  const categories = [
    {
      id: 'hidden_shadows',
      title: 'HIDDEN SHADOWS',
      sub: 'Periodic dips',
      desc: 'Transiting exoplanet worlds blocking stellar disks at regular orbital intervals.',
      color: '#D97757'
    },
    {
      id: 'sudden_flashes',
      title: 'SUDDEN FLASHES',
      sub: 'Stellar flares',
      desc: 'Explosive magnetic reconnection events from high-energy stellar coronae.',
      color: '#C5A059'
    },
    {
      id: 'strange_patterns',
      title: 'STRANGE PATTERNS',
      sub: 'Irregular changes',
      desc: 'Asymmetrical dips, circumstellar dust clouds, or multi-star eclipses.',
      color: '#9D78A8'
    },
    {
      id: 'single_mysteries',
      title: 'SINGLE MYSTERIES',
      sub: 'One-time dips',
      desc: 'Solitary deep occultations from long-period planets or wandering bodies.',
      color: '#6EA893'
    }
  ];

  const filteredCandidates = useMemo(() => {
    return candidates.filter(cand => {
      const matchesCategory = selectedCategory === 'all' || categoryFor(cand.event_type) === selectedCategory;
      const matchesSearch =
        String(cand.tic_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(cand.candidate_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        eventLabel(cand.event_type).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'rank') return Number(b.candidate_priority_score || 0) - Number(a.candidate_priority_score || 0);
      if (sortBy === 'event') return String(a.event_type).localeCompare(String(b.event_type));
      return String(a.verification_status).localeCompare(String(b.verification_status));
    });
  }, [candidates, selectedCategory, searchQuery, sortBy]);

  const handleExploreCandidate = async (candidate) => {
    if (onSelectCandidate) {
      onSelectCandidate(candidate.candidate_id);
    }
    setSelectedCandidate(candidate);
    setCandidateDetail(null);
    setDetailLoading(true);
    try {
      setCandidateDetail(await apiGet(`/candidates/${encodeURIComponent(candidate.candidate_id)}`));
    } catch (error) {
      setApiError(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <Radio className="w-4 h-4" />
            <span>EXOPLANETARY TAXONOMY // ANOMALY CLUSTERS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            Discover anomalies
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            Candidate records and light curves loaded from the available POLARIX ML outputs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[11px] font-sans tracking-wider text-[#C5A059]">
            TESS / REAL ML OUTPUTS
          </div>
        </div>
      </div>

      {/* 4 Category Tiles (from PDF page 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <div
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
              className={`cursor-pointer rounded-xl bg-[#1B1A18] border p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
                isSelected
                  ? 'border-[#C5A059] shadow-xl bg-[#23211E]'
                  : 'border-[#ECE8DF]/15 hover:border-[#ECE8DF]/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-['Cinzel',serif] font-bold tracking-wider"
                    style={{ color: cat.color }}
                  >
                    {cat.title}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />}
                </div>
                <div className="text-base font-serif font-bold text-white mb-2">
                  {cat.sub}
                </div>
                <p className="text-xs text-[#ECE8DF]/70 leading-relaxed font-sans">
                  {cat.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#ECE8DF]/15 flex items-center justify-between text-xs font-sans">
                <span className={isSelected ? 'text-[#C5A059] font-bold' : 'text-[#ECE8DF]/60'}>
                  {isSelected ? 'Active filter' : 'Explore category'}
                </span>
                <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#C5A059] translate-x-1' : 'text-[#ECE8DF]/40'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Gallery Header & Controls */}
      <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#ECE8DF]/15">
          <div>
            <h2 className="text-2xl font-['Playfair_Display',serif] font-normal text-white">
              Candidate gallery
            </h2>
            <div className="text-xs font-sans text-[#ECE8DF]/60 mt-0.5">
              {loading ? 'Loading ML output…' : apiError && candidates.length === 0 ? 'Candidate records unavailable' : `Showing ${filteredCandidates.length} of ${candidates.length} candidate records`}
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#ECE8DF]/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search: TIC ID or name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#141312] border border-[#ECE8DF]/20 focus:border-[#C5A059] focus:outline-none rounded-lg py-1.5 pl-9 pr-3 text-xs text-white placeholder-stone-600 w-48 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#141312] border border-[#ECE8DF]/20 rounded-lg px-2.5 py-1 text-xs font-mono text-[#ECE8DF]/80">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
              <span className="text-[#ECE8DF]/50">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent focus:outline-none text-[#ECE8DF] text-xs cursor-pointer font-mono"
              >
                <option value="rank" className="bg-[#1B1A18]">Anomaly rank</option>
                <option value="event" className="bg-[#1B1A18]">Event family</option>
                <option value="verification" className="bg-[#1B1A18]">Verification status</option>
              </select>
            </div>

            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-sans text-[#C5A059] hover:text-[#ECE8DF] underline underline-offset-2"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Candidate Cards Grid */}
        {apiError && (
          <div role="alert" className="mt-5 rounded-lg border border-[#D97757]/40 bg-[#D97757]/10 px-4 py-3 text-xs text-[#ECE8DF]">
            Data API unavailable: {apiError}. Start the POLARIX API to load real candidate results.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.candidate_id}
              className="rounded-xl bg-[#141312] border border-[#ECE8DF]/15 hover:border-[#C5A059] p-4 transition-all duration-200 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-serif font-bold text-white">
                    {eventLabel(candidate.event_type)}
                  </h3>
                  <span className="text-[10px] font-mono text-[#C5A059] bg-[#1B1A18] px-2 py-0.5 rounded border border-[#C5A059]/30">
                    {candidate.rank_within_category ? `#${candidate.rank_within_category}` : 'Unranked'}
                  </span>
                </div>

                {/* Interactive Mini Light Curve */}
                <div className="my-3">
                  <LightCurveChart
                    data={candidateCurves[`${candidate.tic_id}:${candidate.sector}`] || []}
                    height={150}
                    showMarkers={false}
                    interactive={false}
                  />
                </div>

                <div className="text-[11px] font-mono text-[#ECE8DF]/60 mb-1">
                  TIC {candidate.tic_id} / Sector {candidate.sector} / {candidate.verification_status || 'status unavailable'}
                </div>
                <p className="text-xs text-[#ECE8DF]/80 font-sans line-clamp-2">
                  {candidate.candidate_id} · priority {formatValue(candidate.candidate_priority_score, 3)}
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleExploreCandidate(candidate)}
                className="chamfer-btn mt-4 w-full py-2.5 px-3 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-1.5"
              >
                <span>Explore candidate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {!loading && filteredCandidates.length === 0 && !apiError && (
            <div className="col-span-full py-12 text-center text-xs text-[#ECE8DF]/60">
              No candidate records are available for this filter. The page does not fill missing results with demo candidates.
            </div>
          )}
        </div>
      </div>

      {selectedCandidate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCandidate(null); }}>
          <section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-[#C5A059]/40 bg-[#1B1A18] p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="candidate-detail-title">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#ECE8DF]/15 pb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#C5A059]">Candidate detail · TIC {selectedCandidate.tic_id} · Sector {selectedCandidate.sector}</div>
                <h2 id="candidate-detail-title" className="mt-1 text-2xl font-serif capitalize text-white">{eventLabel(selectedCandidate.event_type)}</h2>
                <div className="mt-1 text-[11px] font-mono text-[#ECE8DF]/60">{selectedCandidate.candidate_id}</div>
              </div>
              <button className="rounded border border-[#ECE8DF]/20 px-3 py-1.5 text-xs text-[#ECE8DF] hover:border-[#C5A059]" onClick={() => setSelectedCandidate(null)}>Close</button>
            </div>
            {detailLoading && <p className="py-8 text-center text-sm text-[#ECE8DF]/60">Loading linked candidate, event, and feature records…</p>}
            {!detailLoading && !candidateDetail && <p className="py-8 text-center text-sm text-[#ECE8DF]/60">Candidate detail is unavailable from the data API. No replacement record is shown.</p>}
            {!detailLoading && candidateDetail && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['Candidate priority', formatValue(candidateDetail.candidate_priority_score, 4)],
                    ['Star anomaly score', formatValue(candidateDetail.star_anomaly_score, 4)],
                    ['Event time (BTJD)', formatValue(candidateDetail.event_time_btjd, 5)],
                    ['Prominence (σ)', formatValue(candidateDetail.prominence_sigma, 3)],
                    [candidateDetail.period_days_source?.startsWith('BLS') ? 'Star BLS period (days)' : 'Candidate period (days)', formatValue(candidateDetail.period_days, 5)],
                    [candidateDetail.duration_hours_source?.startsWith('BLS') ? 'BLS duration (hours)' : 'Candidate duration (hours)', formatValue(candidateDetail.duration_hours, 4)],
                    ['Relative depth', formatValue(candidateDetail.depth_relative, 6)],
                    ['Event amplitude', formatValue(candidateDetail.event_amplitude, 6)]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#ECE8DF]/10 bg-[#141312] p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#ECE8DF]/45">{label}</div>
                      <div className="mt-1 font-mono text-sm text-[#ECE8DF]">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[#ECE8DF]/10 bg-[#141312] p-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">Linked features</h3>
                    {candidateDetail.features ? (
                      <p className="mt-2 text-[11px] leading-5 text-[#ECE8DF]/70">
                        {candidateDetail.features.n_valid_points ?? '—'} valid points · MAD {formatValue(candidateDetail.features.mad, 6)} · σ {formatValue(candidateDetail.features.standard_deviation, 6)}
                      </p>
                    ) : <p className="mt-2 text-[11px] text-[#ECE8DF]/50">No feature row for this TIC and sector.</p>}
                  </div>
                  <div className="rounded-lg border border-[#ECE8DF]/10 bg-[#141312] p-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">Detected events</h3>
                    <p className="mt-2 text-[11px] text-[#ECE8DF]/70">{candidateDetail.detected_events_available ? `${candidateDetail.detected_events?.length ?? 0} event rows linked by TIC and sector.` : 'Peak detection output is not available.'}</p>
                    {candidateDetail.matched_detection_event && <p className="mt-1 text-[10px] text-[#ECE8DF]/50">Time match: {formatValue(candidateDetail.matched_detection_event.event_time_btjd, 5)} BTJD</p>}
                  </div>
                  <div className="rounded-lg border border-[#ECE8DF]/10 bg-[#141312] p-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">BLS results</h3>
                    {candidateDetail.bls_candidates?.length ? candidateDetail.bls_candidates.map((bls) => (
                      <p key={`${bls.tic_id}-${bls.period_days}`} className="mt-2 text-[11px] text-[#ECE8DF]/70">
                        P {formatValue(bls.period_days, 5)} d · duration {formatValue(bls.duration_hours, 3)} h · depth {formatValue(bls.depth_relative, 6)} · S/N {formatValue(bls.depth_snr, 2)}
                      </p>
                    )) : <p className="mt-2 text-[11px] text-[#ECE8DF]/50">{candidateDetail.bls_candidates_available ? 'No BLS row for this TIC and sector.' : 'BLS output is not available.'}</p>}
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-[#ECE8DF]/10 bg-[#141312] p-4">
                  <LightCurveChart
                    data={candidateCurves[`${candidateDetail.tic_id}:${candidateDetail.sector}`] || []}
                    height={270}
                    showMarkers={false}
                    interactive
                    title={`TIC ${candidateDetail.tic_id} · Sector ${candidateDetail.sector} · processed local NPZ`}
                  />
                  {!(candidateCurves[`${candidateDetail.tic_id}:${candidateDetail.sector}`] || []).length && (
                    <p className="pt-3 text-xs text-[#ECE8DF]/50">No matching processed light curve is present. Candidate metadata remains available.</p>
                  )}
                </div>
                <div className="mt-4 text-[10px] text-[#ECE8DF]/45">
                  Linked feature and detector records are keyed by TIC ID and sector. Missing fields are shown as unavailable; candidate status: {candidateDetail.verification_status || 'not provided'}.
                </div>
                <div className="mt-5 flex justify-end border-t border-[#ECE8DF]/10 pt-4">
                  <button onClick={() => { setSelectedCandidate(null); onNavigate('missions'); }} className="chamfer-btn rounded bg-[#ECE8DF] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#141312] hover:bg-[#C5A059]">Open candidate workspace</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
