import React, { useEffect, useMemo, useState } from 'react';
import { Compass, ArrowRight, Activity, AlertCircle, FileCheck, Layers } from 'lucide-react';
import LightCurveChart from '../components/LightCurveChart';
import { apiGet, lightCurvePoints } from '../lib/polarixApi';

const distributionDefinitions = [
  { key: 'hidden_shadows', name: 'Periodic dips', color: '#32D8F6', description: 'Periodic dip candidates in the current output.' },
  { key: 'sudden_flashes', name: 'Flares', color: '#FFB020', description: 'Flare candidates in the current output.' },
  { key: 'strange_patterns', name: 'Other events', color: '#9D78A8', description: 'Other detected event types in the current output.' },
  { key: 'single_mysteries', name: 'Isolated dips', color: '#6EA893', description: 'Isolated dip candidates in the current output.' }
];

const eventCategory = (eventType = '') => {
  if (eventType.includes('flare')) return 'sudden_flashes';
  if (eventType.includes('periodic')) return 'hidden_shadows';
  if (eventType.includes('isolated')) return 'single_mysteries';
  return 'strange_patterns';
};

export default function OverviewPage({ onNavigate, onSelectCandidate }) {
  const [summary, setSummary] = useState({ targets: null, analyzed: null, isolationForestFlags: null, lofFlags: null, candidates: null, loading: true, error: '' });
  const [featuredCurve, setFeaturedCurve] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      try {
        const [targets, analyzed, candidates] = await Promise.all([
          apiGet('/targets?limit=1'),
          apiGet('/targets?ml_analyzed=true&limit=500'),
          apiGet('/candidates?limit=500')
        ]);
        if (cancelled) return;
        const rows = candidates.results || [];
        const analyzedRows = analyzed.results || [];
        const countFlags = (statusField, predictionField) => analyzedRows.filter((row) => {
          const scores = row.anomaly_scores || {};
          return String(scores[statusField] || '').toLowerCase() === 'anomaly' || Number(scores[predictionField]) === -1;
        }).length;
        setSummary({
          targets: targets.total || 0,
          analyzed: analyzed.total || 0,
          isolationForestFlags: countFlags('if_status', 'if_prediction'),
          lofFlags: countFlags('lof_status', 'lof_prediction'),
          candidates: rows,
          loading: false,
          error: ''
        });
        const featured = [...rows].sort((a, b) => Number(b.candidate_priority_score || 0) - Number(a.candidate_priority_score || 0))[0];
        if (featured) {
          try {
            const curve = await apiGet(`/lightcurves/${featured.tic_id}?sector=${featured.sector}&max_points=220`);
            if (!cancelled) setFeaturedCurve(lightCurvePoints(curve));
          } catch {
            if (!cancelled) setFeaturedCurve([]);
          }
        }
      } catch (error) {
        if (!cancelled) setSummary((current) => ({ ...current, loading: false, error: error.message }));
      }
    }
    loadOverview();
    return () => { cancelled = true; };
  }, []);

  const eventDistribution = useMemo(() => {
    const counts = Object.fromEntries(distributionDefinitions.map(({ key }) => [key, 0]));
    (summary.candidates || []).forEach((candidate) => { counts[eventCategory(candidate.event_type)] += 1; });
    const total = (summary.candidates || []).length;
    return distributionDefinitions.map((definition) => ({
      ...definition,
      count: counts[definition.key],
      percent: total ? Math.round((counts[definition.key] / total) * 100) : 0
    }));
  }, [summary.candidates]);

  const featuredCandidate = useMemo(() => [...(summary.candidates || [])]
    .sort((a, b) => Number(b.candidate_priority_score || 0) - Number(a.candidate_priority_score || 0))[0], [summary.candidates]);

  const handleOpenMission = () => {
    if (featuredCandidate && onSelectCandidate) onSelectCandidate(featuredCandidate.candidate_id);
    onNavigate('discover');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <Compass className="w-4 h-4" />
            <span>COMMAND CENTER // SECTOR TELEMETRY</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            Overview dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            Real acquisition coverage, ML flags, and ranked event candidates from the available TESS outputs.
          </p>
        </div>

        {/* Provenance Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[11px] font-sans tracking-wider text-[#C5A059] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
            <span>TESS / LOCAL OUTPUTS</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (from PDF page 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* KPI 1 */}
        <div
          onClick={() => onNavigate('sky')}
          className="group cursor-pointer rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 hover:border-[#C5A059] p-5 transition-all hover:-translate-y-1 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-sans font-bold tracking-wider text-[#ECE8DF]/60 uppercase">Acquired targets</span>
            <Activity className="w-4 h-4 text-[#C5A059] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-['Cinzel',serif] font-bold text-[#ECE8DF]">
            {summary.loading || summary.error ? '—' : summary.targets}
          </div>
          <div className="text-[10px] font-sans tracking-wider text-[#6EA893] mt-2 flex items-center gap-1">
            <span>● Acquisition manifest targets</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div
          onClick={() => onNavigate('discover')}
          className="group cursor-pointer rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 hover:border-[#6B8EAE] p-5 transition-all hover:-translate-y-1 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-sans font-bold tracking-wider text-[#ECE8DF]/60 uppercase">Isolation Forest flags</span>
            <AlertCircle className="w-4 h-4 text-[#6B8EAE] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-['Cinzel',serif] font-bold text-[#6B8EAE]">
            {summary.loading || summary.error || summary.isolationForestFlags == null ? '—' : summary.isolationForestFlags}
          </div>
          <div className="text-[10px] font-sans tracking-wider text-[#ECE8DF]/70 mt-2 flex items-center gap-1">
            <span>● LOF flags: {summary.loading || summary.error || summary.lofFlags == null ? '—' : summary.lofFlags}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div
          onClick={() => onNavigate('investigations')}
          className="group cursor-pointer rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 hover:border-[#9D78A8] p-5 transition-all hover:-translate-y-1 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-sans font-bold tracking-wider text-[#ECE8DF]/60 uppercase">Ranked event candidates</span>
            <FileCheck className="w-4 h-4 text-[#9D78A8] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-['Cinzel',serif] font-bold text-[#9D78A8]">
            {summary.loading || summary.error ? '—' : summary.candidates.length}
          </div>
          <div className="text-[10px] font-sans tracking-wider text-[#9D78A8] mt-2 flex items-center gap-1">
            <span>● Candidate records; not confirmed anomalies</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div
          onClick={() => onNavigate('discover')}
          className="group cursor-pointer rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 hover:border-[#D97757] p-5 transition-all hover:-translate-y-1 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-sans font-bold tracking-wider text-[#ECE8DF]/60 uppercase">Needs review</span>
            <Layers className="w-4 h-4 text-[#D97757] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-['Cinzel',serif] font-bold text-[#D97757]">
            {summary.loading || summary.error ? '—' : summary.candidates.filter((candidate) => candidate.verification_status === 'pending').length}
          </div>
          <div className="text-[10px] font-sans tracking-wider text-[#D97757] mt-2 flex items-center gap-1">
            <span>● Records marked pending in source</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Featured Mystery + Event Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Featured Mystery Card */}
        <div className="lg:col-span-2 rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-sans font-bold tracking-[0.26em] text-[#C5A059] bg-[#141312] border border-[#C5A059]/30 px-2.5 py-0.5 rounded uppercase">
                  {featuredCandidate ? `TOP PRIORITY // TIC ${featuredCandidate.tic_id}` : 'FEATURED CANDIDATE'}
                </span>
                <h3 className="text-2xl font-['Playfair_Display',serif] font-normal text-white mt-2">
                  {featuredCandidate ? String(featuredCandidate.event_type).replace(/_candidate$/, '').replaceAll('_', ' ') : 'Candidate overview'}
                </h3>
                <p className="text-xs text-[#ECE8DF]/70 font-sans mt-0.5">
                  {featuredCandidate ? `${featuredCandidate.candidate_id} · Sector ${featuredCandidate.sector}` : summary.error ? 'Candidate records are unavailable from the data API.' : summary.loading ? 'Loading candidate output…' : 'No candidate rows are present in the available ML output.'}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#ECE8DF]/70 bg-[#141312] px-3 py-1.5 rounded border border-[#ECE8DF]/15">
                {featuredCandidate?.period_days != null && <span>PERIOD: {Number(featuredCandidate.period_days).toFixed(4)} DAYS</span>}
                {featuredCandidate?.depth_relative != null && <span className="text-[#C5A059]">DEPTH: {Number(featuredCandidate.depth_relative).toFixed(6)}</span>}
              </div>
            </div>

            {/* Interactive Light Curve */}
            <div className="my-4">
              <LightCurveChart
                data={featuredCurve}
                height={260}
                showMarkers={true}
                viewMode="pdcsap"
                title={featuredCandidate ? `TESS SECTOR ${featuredCandidate.sector} // PROCESSED FLUX (BTJD)` : 'TESS PROCESSED FLUX (BTJD)'}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#ECE8DF]/15">
            <div className="text-xs text-[#ECE8DF]/70 font-mono">
              {featuredCandidate ? `Priority score: ${Number(featuredCandidate.candidate_priority_score || 0).toFixed(4)} · Verification status: ${featuredCandidate.verification_status || 'not provided'}` : 'Candidate output is not available.'}
            </div>

            <button
              onClick={handleOpenMission}
              className="chamfer-btn px-6 py-2.5 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2"
            >
              <span>Explore candidates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Event Distribution */}
        <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-sans font-bold tracking-[0.24em] text-[#C5A059] uppercase">
              CLASSIFICATION BREAKDOWN
            </span>
            <h3 className="text-2xl font-['Playfair_Display',serif] font-normal text-white mt-1">
              Event distribution
            </h3>
            <p className="text-xs text-[#ECE8DF]/70 font-sans mt-0.5 mb-6">
              Counts from the available candidate records
            </p>

            {/* Distribution Bars */}
            <div className="space-y-5">
              {summary.loading || summary.error ? (
                <p className="py-4 text-xs text-[#ECE8DF]/50">{summary.error ? 'Candidate distribution unavailable from the data API.' : 'Loading available event counts…'}</p>
              ) : eventDistribution.map((event) => (
                <div key={event.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="font-semibold text-[#ECE8DF]">{event.name}</span>
                    <span className="font-mono text-[#ECE8DF]/70">
                      {event.count} ({event.percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#141312] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${event.percent}%`,
                        backgroundColor: event.color
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[#ECE8DF]/50 leading-tight font-sans">
                    {event.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#ECE8DF]/15 text-[11px] font-sans tracking-wider text-[#C5A059] flex items-center justify-between">
            <span>{summary.loading ? 'LOADING OUTPUT COUNTS' : summary.error ? 'OUTPUT COUNTS UNAVAILABLE' : `${summary.analyzed} ML-ANALYZED / ${summary.targets} TARGETS`}</span>
            <button
              onClick={() => onNavigate('discover')}
              className="text-xs hover:text-white underline underline-offset-2 flex items-center gap-1 font-['Cinzel',serif]"
            >
              <span>Explore all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
