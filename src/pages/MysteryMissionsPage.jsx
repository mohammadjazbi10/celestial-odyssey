import React, { useState, useMemo, useEffect } from 'react';
import { Target, ArrowRight, CheckCircle2, Download, Printer, Copy, Check, RefreshCw, MessageSquare } from 'lucide-react';
import LightCurveChart from '../components/LightCurveChart';
import { apiGet, apiPost, apiPatch, lightCurvePoints } from '../lib/polarixApi';

const displayEvent = (value = 'candidate') => String(value).replace(/_candidate$/, '').replaceAll('_', ' ');
const numeric = (value, digits = 4) => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Not available' : Number(value).toFixed(digits);
const hypothesisOptions = [
  { id: 'transit_like', label: 'Transit-like signal', note: 'Test periodicity and compare SAP with PDCSAP before interpreting.' },
  { id: 'eclipsing_binary', label: 'Eclipsing-binary hypothesis', note: 'Compare odd/even events and catalog context where measurements exist.' },
  { id: 'stellar_activity', label: 'Stellar activity', note: 'Inspect the event morphology, surrounding variability, and quality flags.' },
  { id: 'instrumental', label: 'Instrumental or data-quality effect', note: 'Check QUALITY values and raw/corrected photometry.' },
  { id: 'uncertain', label: 'Uncertain / other', note: 'Keep the interpretation open while evidence is incomplete.' }
];

export default function MysteryMissionsPage({
  selectedCandidateId,
  onSelectCandidate,
  onSaveInvestigation
}) {
  const [activeTab, setActiveTab] = useState('mission');
  const [candidateRecords, setCandidateRecords] = useState([]);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [previewCurves, setPreviewCurves] = useState({});
  const [curvePayload, setCurvePayload] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [caseRecord, setCaseRecord] = useState(null);
  const [hypothesis, setHypothesis] = useState('uncertain');
  const [notes, setNotes] = useState('');
  const [verification, setVerification] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);

  // Signal Lab State
  const [curveViewMode, setCurveViewMode] = useState('pdcsap');
  const [showEventMarkers, setShowEventMarkers] = useState(true);
  const [showQualityFlags, setShowQualityFlags] = useState(true);
  const [folded, setFolded] = useState(false);
  const [foldPeriod, setFoldPeriod] = useState('');
  const [foldEpoch, setFoldEpoch] = useState('');

  const [isInvestigating, setIsInvestigating] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [gemmaTestResult, setGemmaTestResult] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const missionCandidates = useMemo(() => {
    const perStar = new Map();
    candidateRecords.forEach((candidate) => {
      const previous = perStar.get(candidate.tic_id);
      if (!previous || Number(candidate.candidate_priority_score || 0) > Number(previous.candidate_priority_score || 0)) perStar.set(candidate.tic_id, candidate);
    });
    return [...perStar.values()].sort((a, b) => Number(b.candidate_priority_score || 0) - Number(a.candidate_priority_score || 0));
  }, [candidateRecords]);
  const currentCandidate = candidateRecords.find((candidate) => candidate.candidate_id === selectedCandidateId) || missionCandidates[0] || null;
  const currentMission = currentCandidate ? {
    id: currentCandidate.candidate_id,
    title: `TIC ${currentCandidate.tic_id} · ${displayEvent(currentCandidate.event_type)}`,
    difficulty: currentCandidate.verification_status || 'candidate',
    difficultyColor: '#C5A059',
    ticId: `TIC ${currentCandidate.tic_id}`,
    sector: `Sector ${currentCandidate.sector}`,
    whatYouNotice: `${displayEvent(currentCandidate.event_type)} record at BTJD ${numeric(currentCandidate.event_time_btjd, 5)}. Prominence: ${numeric(currentCandidate.prominence_sigma, 3)} σ. This is an ML candidate label, not a confirmed classification.`,
    hypothesisOptions
  } : { id: '', title: pageLoading ? 'Loading real candidates…' : 'No candidate records available', difficulty: 'unavailable', difficultyColor: '#C5A059', ticId: 'TIC unavailable', sector: 'Sector unavailable', whatYouNotice: 'Candidate measurements will appear when source records are available.', hypothesisOptions };
  const activeCurveData = useMemo(() => lightCurvePoints(curvePayload), [curvePayload]);
  const selectedBls = candidateDetail?.bls_candidates?.[0] || null;
  const currentCandidateId = currentCandidate?.candidate_id;
  const currentTicId = currentCandidate?.tic_id;
  const currentSector = currentCandidate?.sector;
  const currentCurveAvailable = Boolean(currentCandidate?.lightcurve_available);

  useEffect(() => {
    let cancelled = false;
    async function loadCandidates() {
      try {
        const [candidatePayload, status] = await Promise.all([apiGet('/candidates?limit=500'), apiGet('/gemma/status')]);
        if (cancelled) return;
        const rows = candidatePayload.results || [];
        setCandidateRecords(rows);
        setGeminiConfigured(Boolean(status.configured));
      } catch (error) {
        if (!cancelled) setPageError(error.message);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    loadCandidates();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!candidateRecords.length) return;
    const first = missionCandidates[0];
    if (first && !candidateRecords.some((row) => row.candidate_id === selectedCandidateId)) {
      onSelectCandidate?.(first.candidate_id);
    }
  }, [candidateRecords, missionCandidates, selectedCandidateId, onSelectCandidate]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreviews() {
      const unique = [...new Map(candidateRecords.filter((row) => row.lightcurve_available).map((row) => [row.tic_id, row])).values()];
      const curves = await Promise.all(unique.map(async (row) => {
        try {
          const curve = await apiGet(`/lightcurves/${row.tic_id}?sector=${row.sector}&max_points=110`);
          return [row.tic_id, lightCurvePoints(curve)];
        } catch { return [row.tic_id, []]; }
      }));
      if (!cancelled) setPreviewCurves(Object.fromEntries(curves));
    }
    if (candidateRecords.length) loadPreviews();
    return () => { cancelled = true; };
  }, [candidateRecords]);

  useEffect(() => {
    if (!currentCandidateId || !currentTicId || currentSector == null) return undefined;
    let cancelled = false;
    async function loadWorkspace() {
      setCandidateDetail(null);
      setCurvePayload(null);
      try {
        const [detail, saved, recorded] = await Promise.all([
          apiGet(`/candidates/${encodeURIComponent(currentCandidateId)}`),
          apiGet('/investigations'),
          apiGet(`/verification/${currentTicId}?sector=${currentSector}`)
        ]);
        if (cancelled) return;
        setCandidateDetail(detail);
        setVerification(recorded);
        const found = (saved.results || []).find((item) => item.candidate_id === currentCandidateId) || null;
        setCaseRecord(found);
        setNotes(found?.notes || '');
        setHypothesis(found?.hypothesis || 'uncertain');
        const bls = detail.bls_candidates?.[0];
        setFoldPeriod(bls?.period_days != null ? String(bls.period_days) : '');
        setFoldEpoch(bls?.transit_epoch_btjd != null ? String(bls.transit_epoch_btjd) : '');
        setPredictions([]);
        if (found) {
          setTestResults(found.scientific_tests || []);
        } else setTestResults([]);
        try {
          const ledger = await apiGet(`/predictions?tic_id=${currentTicId}`);
          if (!cancelled) setPredictions(ledger.results || []);
        } catch { if (!cancelled) setPredictions([]); }
      } catch (error) {
        if (!cancelled) setPageError(error.message);
      }
    }
    loadWorkspace();
    return () => { cancelled = true; };
  }, [currentCandidateId, currentTicId, currentSector]);

  useEffect(() => {
    if (!currentCurveAvailable || !currentTicId || currentSector == null) return undefined;
    let cancelled = false;
    async function loadCurve() {
      const params = new URLSearchParams({ sector: String(currentSector), max_points: '2200', flux_type: curveViewMode });
      if (folded && Number(foldPeriod) > 0 && Number.isFinite(Number(foldEpoch))) {
        params.set('period_days', foldPeriod);
        params.set('epoch_btjd', foldEpoch);
      }
      try {
        const curve = await apiGet(`/lightcurves/${currentTicId}?${params.toString()}`);
        if (!cancelled) setCurvePayload(curve);
      } catch (error) { if (!cancelled) setPageError(error.message); }
    }
    loadCurve();
    return () => { cancelled = true; };
  }, [currentCandidateId, currentTicId, currentSector, currentCurveAvailable, curveViewMode, folded, foldPeriod, foldEpoch]);

  const saveInvestigation = async (patch = {}) => {
    if (!currentCandidate) return null;
    const payload = { hypothesis, notes, ...patch };
    let saved;
    if (caseRecord) saved = await apiPatch(`/investigations/${caseRecord.investigation_id}`, payload);
    else {
      saved = await apiPost('/investigations', { candidate_id: currentCandidate.candidate_id, hypothesis, notes });
      const remainingPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !['hypothesis', 'notes'].includes(key)));
      if (Object.keys(remainingPatch).length) saved = await apiPatch(`/investigations/${saved.investigation_id}`, remainingPatch);
    }
    setCaseRecord(saved);
    onSaveInvestigation?.(saved);
    return saved;
  };

  const handleSubmitHypothesis = async () => {
    try {
      await saveInvestigation();
      setSubmissionFeedback('Hypothesis and notes saved to this candidate investigation.');
    } catch (error) { setSubmissionFeedback(error.message); }
  };

  const runScienceTool = async (toolName) => {
    if (!currentCandidate) return;
    try {
      const saved = caseRecord || await saveInvestigation();
      const result = await apiPost(`/investigations/${saved.investigation_id}/tests`, { arguments: { tool_name: toolName, tic_id: currentCandidate.tic_id, sector: currentCandidate.sector } });
      setTestResults((previous) => [...previous, result]);
      const updated = await apiGet('/investigations');
      setCaseRecord((updated.results || []).find((item) => item.investigation_id === saved.investigation_id) || saved);
    } catch (error) { setPageError(error.message); }
  };

  const handleRunAiInvestigation = async (message = chatInput) => {
    if (!currentCandidate || !message.trim()) return;
    setIsInvestigating(true);
    setChatError('');
    try {
      const saved = caseRecord || await saveInvestigation();
      await apiPost(`/investigations/${saved.investigation_id}/chat`, { message: message.trim() });
      const refreshed = await apiGet('/investigations');
      setCaseRecord((refreshed.results || []).find((item) => item.investigation_id === saved.investigation_id) || saved);
      setChatInput('');
    } catch (error) { setChatError(error.message); }
    finally { setIsInvestigating(false); }
  };

  const handleTestGemmaTool = async () => {
    if (!currentCandidate) return;
    setIsInvestigating(true);
    setChatError('');
    try {
      setGemmaTestResult(await apiGet(`/gemma/test-tool-call?tic_id=${currentCandidate.tic_id}&sector=${currentCandidate.sector}`));
    } catch (error) { setChatError(error.message); }
    finally { setIsInvestigating(false); }
  };

  const handleRunVerification = async () => {
    if (!currentCandidate) return;
    try {
      setVerification(await apiGet(`/verification/${currentCandidate.tic_id}?sector=${currentCandidate.sector}`));
      await runScienceTool('verify_candidate');
    } catch (error) { setPageError(error.message); }
  };

  const updateMissionStep = async (stepId) => {
    const completed = new Set(caseRecord?.mission_progress?.completed_step_ids || []);
    if (completed.has(stepId)) completed.delete(stepId); else completed.add(stepId);
    try { await saveInvestigation({ mission_progress: { step: completed.size, completed_step_ids: [...completed] } }); }
    catch (error) { setPageError(error.message); }
  };

  const reviewPrediction = async (predictionId, status) => {
    try {
      const result = await apiPatch(`/predictions/${encodeURIComponent(predictionId)}`, { status, review_note: '' });
      setPredictions((previous) => previous.map((item) => item.prediction_id === result.prediction_id ? result : item));
    } catch (error) { setPageError(error.message); }
  };

  const handleExportJSON = async () => {
    if (!caseRecord) return;
    window.open(`/api/investigations/${caseRecord.investigation_id}/casefile?format=json`, '_blank', 'noopener');
  };
  const handleExportPDF = () => {
    if (!caseRecord) return;
    window.open(`/api/investigations/${caseRecord.investigation_id}/casefile?format=pdf`, '_blank', 'noopener');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summaryText = `POLARIX INVESTIGATION\nCandidate: ${currentCandidate?.candidate_id || 'unavailable'}\nTarget: ${currentCandidate ? `TIC ${currentCandidate.tic_id} / Sector ${currentCandidate.sector}` : 'unavailable'}\nHypothesis: ${hypothesis}\nCandidate status: provisional; not a confirmed discovery\nNotes: ${notes}`;
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <Target className="w-4 h-4" />
            <span>EXOPLANETARY VETTING LAB // TESS EVIDENCE PIPELINE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            Mystery Missions & Workspace
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            Candidate missions are built from the available ML records. Measurements and classifications remain provisional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#1B1A18] border border-[#ECE8DF]/20 text-[11px] font-sans tracking-wider text-[#C5A059]">
            TESS / LOCAL ML OUTPUTS
          </div>
        </div>
      </div>

      {/* SECTION 1: MYSTERY MISSIONS GALLERY (PDF Page 5 - 4 Large Boxes) */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-['Playfair_Display',serif] font-normal text-white">
              Mystery Missions gallery
            </h2>
            <p className="text-xs font-sans text-[#ECE8DF]/60 mt-0.5">
              One highest-priority candidate per available ML star; all 104 candidate records remain available in Discover.
            </p>
          </div>
        </div>
        {pageError && <div role="alert" className="mb-4 rounded border border-[#D97757]/40 bg-[#D97757]/10 px-3 py-2 text-xs text-[#ECE8DF]">{pageError}</div>}
        {pageLoading && <p className="py-10 text-center text-xs text-[#ECE8DF]/50">Loading real candidate output…</p>}
        {!pageLoading && !missionCandidates.length && <p className="py-10 text-center text-xs text-[#ECE8DF]/50">No candidate records are available. No demo targets are substituted.</p>}

        {/* Real candidate mission cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {missionCandidates.map((mission) => {
            const isSelected = currentCandidate?.candidate_id === mission.candidate_id;
            return (
              <div
                key={mission.tic_id}
                onClick={() => onSelectCandidate?.(mission.candidate_id)}
                className={`cursor-pointer rounded-xl bg-[#1B1A18] border p-5 flex flex-col justify-between transition-all duration-300 ${
                  isSelected
                    ? 'border-[#C5A059] shadow-xl bg-[#23211E]'
                    : 'border-[#ECE8DF]/15 hover:border-[#ECE8DF]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-serif font-bold text-white">
                      TIC {mission.tic_id} · {displayEvent(mission.event_type)}
                    </h3>
                    <span
                      className="text-[10px] font-sans font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
                      style={{
                        color: '#C5A059',
                        borderColor: '#C5A05955',
                        backgroundColor: '#C5A05915'
                      }}
                    >
                      Priority {numeric(mission.candidate_priority_score, 3)}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-[#ECE8DF]/60 mb-3">
                    Sector {mission.sector} · {mission.verification_status || 'status unavailable'}
                  </div>

                  {/* Light Curve Preview */}
                  <div className="my-2">
                    <LightCurveChart
                      data={previewCurves[mission.tic_id] || []}
                      height={140}
                      showMarkers={false}
                      interactive={false}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#ECE8DF]/15 flex items-center justify-between">
                  <span className="text-xs text-[#ECE8DF]/60 font-mono">
                    {mission.lightcurve_available ? 'REAL NPZ PREVIEW' : 'NO LOCAL CURVE'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCandidate?.(mission.candidate_id);
                      const el = document.getElementById('candidate-workspace-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`chamfer-btn py-2 px-5 text-xs font-['Cinzel',serif] tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow-md'
                        : 'bg-[#141312] text-[#ECE8DF] hover:bg-[#ECE8DF] hover:text-[#141312]'
                    }`}
                  >
                    <span>{isSelected ? 'Active Mission' : 'Start mission'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CANDIDATE / MISSION WORKSPACE (PDF Pages 6, 7, 8, 9) */}
      <div
        id="candidate-workspace-section"
        className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-2xl scroll-mt-20"
      >
        {/* Workspace Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#ECE8DF]/15">
          <div>
            <div className="text-[10px] font-sans font-bold tracking-[0.28em] text-[#C5A059] uppercase mb-1">
              CANDIDATE / MISSION WORKSPACE
            </div>
            <h2 className="text-3xl font-['Playfair_Display',serif] font-normal text-white uppercase">
              {currentMission.title}
            </h2>
            <div className="text-xs font-mono text-[#ECE8DF]/60 mt-1">
              {currentCandidate ? `${displayEvent(currentCandidate.event_type)} / ${currentCandidate.verification_status || 'status unavailable'}` : 'Candidate information unavailable'}
            </div>
          </div>

          {/* Subnavigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#141312] p-1.5 rounded-lg border border-[#ECE8DF]/15">
            {[
              { id: 'mission', label: 'Mission' },
              { id: 'lab', label: 'Signal Lab' },
              { id: 'gemma', label: 'AI Investigator' },
              { id: 'casefile', label: 'Case File' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 px-4 rounded text-xs font-['Cinzel',serif] tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow-sm'
                    : 'text-[#ECE8DF]/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: MISSION WORKSPACE (PDF Page 6) */}
        {activeTab === 'mission' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: What do you notice & Light Curve */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-[#141312] p-4 rounded-lg border border-[#ECE8DF]/15">
                  <h3 className="text-sm font-serif font-bold text-white mb-1">
                    What do you notice?
                  </h3>
                  <p className="text-xs text-[#C5A059] font-sans">
                    {currentMission.whatYouNotice}
                  </p>
                </div>

                <LightCurveChart
                  data={activeCurveData}
                  height={280}
                  showMarkers={true}
                  title={`${currentMission.ticId} // ${displayEvent(currentCandidate?.event_type)} (BTJD)`}
                />
              </div>

              {/* Right Col: Your Hypothesis Form */}
              <div className="rounded-lg bg-[#141312] border border-[#ECE8DF]/15 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-['Playfair_Display',serif] font-normal text-white">
                    Your hypothesis
                  </h3>
                  <p className="text-xs text-[#ECE8DF]/60 font-sans mt-1 mb-4">
                    Select a hypothesis to investigate. This records your view and does not verify it.
                  </p>

                  <div className="space-y-3">
                    {currentMission.hypothesisOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          hypothesis === opt.id
                            ? 'bg-[#1B1A18] border-[#C5A059] text-white'
                            : 'border-[#ECE8DF]/15 text-[#ECE8DF]/80 hover:border-[#ECE8DF]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="hypothesis"
                          value={opt.id}
                          checked={hypothesis === opt.id}
                          onChange={() => setHypothesis(opt.id)}
                          className="mt-1 accent-[#C5A059]"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-[10px] text-[#ECE8DF]/50 font-sans mt-0.5">{opt.note}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#ECE8DF]/15">
                  {submissionFeedback && (
                    <div className="mb-3 p-2.5 rounded bg-[#1B1A18] border border-[#C5A059]/40 text-[#C5A059] text-xs font-sans flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#C5A059] flex-shrink-0" />
                      <span>{submissionFeedback}</span>
                    </div>
                  )}

                  <button
                    onClick={handleSubmitHypothesis}
                    className="chamfer-btn w-full py-3 px-4 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2"
                  >
                    <span>Submit interpretation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {currentCandidate && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#ECE8DF]/15 bg-[#141312] p-4">
                  <h3 className="mb-3 text-sm font-serif font-bold text-white">Stellar and catalog context</h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#ECE8DF]/70">
                    <span>RA / Dec</span><span>{numeric(candidateDetail?.target?.ra_deg, 6)} / {numeric(candidateDetail?.target?.dec_deg, 6)}</span>
                    <span>Gaia DR3 source</span><span>{candidateDetail?.target?.gaia_dr3_source_id ?? 'No matched identifier'}</span>
                    <span>Gaia G magnitude</span><span>{numeric(candidateDetail?.target?.gaia_phot_g_mean_mag, 3)}</span>
                    <span>Gaia effective temperature</span><span>{numeric(candidateDetail?.target?.gaia_teff_gspphot, 0)} K</span>
                    <span>SIMBAD identifier</span><span>{candidateDetail?.target?.simbad_main_id ?? 'No matched identifier'}</span>
                    <span>SIMBAD classification</span><span>{candidateDetail?.target?.simbad_otype ?? 'Not available'}</span>
                    <span>Gaia match status</span><span>{candidateDetail?.target?.gaia_match_status ?? 'Not available'}</span>
                    <span>Gaia separation / ambiguity</span><span>{numeric(candidateDetail?.target?.gaia_match_distance_arcsec, 3)} arcsec · {candidateDetail?.target?.gaia_match_ambiguous === true ? 'ambiguous' : candidateDetail?.target?.gaia_match_ambiguous === false ? 'not flagged ambiguous' : 'unknown'}</span>
                    <span>SIMBAD match status</span><span>{candidateDetail?.target?.simbad_match_status ?? 'Not available'}</span>
                    <span>SIMBAD separation / ambiguity</span><span>{numeric(candidateDetail?.target?.simbad_match_distance_arcsec, 3)} arcsec · {candidateDetail?.target?.simbad_match_ambiguous === true ? 'ambiguous' : candidateDetail?.target?.simbad_match_ambiguous === false ? 'not flagged ambiguous' : 'unknown'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ECE8DF]/15 bg-[#141312] p-4">
                  <h3 className="mb-3 text-sm font-serif font-bold text-white">Mission steps</h3>
                  {[
                    ['candidate', 'Read the supplied event time and ML scores'],
                    ['photometry', 'Compare SAP and PDCSAP measurements'],
                    ['quality', 'Inspect the recorded quality mask'],
                    ['catalogs', 'Review Gaia DR3 and SIMBAD matches where available']
                  ].map(([id, label]) => {
                    const done = (caseRecord?.mission_progress?.completed_step_ids || []).includes(id);
                    return <label key={id} className="mb-2 flex items-start gap-2 text-xs text-[#ECE8DF]/75">
                      <input type="checkbox" checked={done} onChange={() => updateMissionStep(id)} className="mt-0.5 accent-[#C5A059]" />
                      <span>{label}</span>
                    </label>;
                  })}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setActiveTab('lab')} className="rounded border border-[#ECE8DF]/20 px-3 py-1.5 text-[10px] text-[#ECE8DF] hover:border-[#C5A059]">Open Signal Lab</button>
                    <button onClick={() => setActiveTab('gemma')} className="rounded border border-[#ECE8DF]/20 px-3 py-1.5 text-[10px] text-[#ECE8DF] hover:border-[#C5A059]">Ask the Star</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SIGNAL LAB / INTERACTIVE VERIFICATION (PDF Page 7) */}
        {activeTab === 'lab' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Brightness Experiment Plot & Data Toggles */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-xl font-['Playfair_Display',serif] font-normal text-white">
                    Brightness experiment
                  </h3>
                  <p className="text-xs text-[#ECE8DF]/70 font-sans">
                    Plotly interactive inspection: zoom, hover cursor, event markers, and raw aperture comparison
                  </p>
                </div>

                <LightCurveChart
                  data={activeCurveData}
                  height={280}
                  detrendMode={folded ? 'folded' : 'standard'}
                  viewMode={curveViewMode}
                  showMarkers={showEventMarkers}
                  showQualityFlags={showQualityFlags}
                  xAxisLabel={curvePayload?.x_axis_label || 'TIME (BTJD)'}
                  title={`${curvePayload?.folded ? 'FOLDED PHASE' : 'TIME (BTJD)'} // ${curveViewMode.toUpperCase()} PHOTOMETRY`}
                />

                {/* Data Processing Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => setCurveViewMode('sap')}
                    className={`chamfer-btn px-4 py-2 text-xs font-sans tracking-wide transition-all ${
                      curveViewMode === 'sap'
                        ? 'bg-[#ECE8DF] text-[#141312] font-bold'
                        : 'bg-[#141312] text-[#ECE8DF]/80 border border-[#ECE8DF]/20 hover:border-[#C5A059]'
                    }`}
                  >
                    SAP
                  </button>

                  <button
                    onClick={() => setCurveViewMode('pdcsap')}
                    className={`chamfer-btn px-4 py-2 text-xs font-sans tracking-wide transition-all ${
                      curveViewMode === 'pdcsap'
                        ? 'bg-[#ECE8DF] text-[#141312] font-bold'
                        : 'bg-[#141312] text-[#ECE8DF]/80 border border-[#ECE8DF]/20 hover:border-[#C5A059]'
                    }`}
                  >
                    PDCSAP
                  </button>

                  <button
                    onClick={() => setShowQualityFlags(!showQualityFlags)}
                    className={`chamfer-btn px-4 py-2 text-xs font-sans tracking-wide transition-all ${
                      showQualityFlags
                        ? 'bg-[#D97757]/20 border border-[#D97757] text-[#D97757]'
                        : 'bg-[#141312] text-[#ECE8DF]/60 border border-[#ECE8DF]/20'
                    }`}
                  >
                    Quality flagged: {showQualityFlags ? 'VISIBLE' : 'HIDDEN'}
                  </button>

                  <button
                    onClick={() => {
                      setCurveViewMode('pdcsap');
                      setFolded(false);
                      setShowEventMarkers(true);
                      setShowQualityFlags(true);
                    }}
                    className="chamfer-btn px-4 py-2 text-xs font-sans tracking-wide bg-[#141312] hover:bg-[#23211E] text-[#ECE8DF]/60 hover:text-white border border-[#ECE8DF]/20"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Right Col: Analysis Controls & Measurements */}
              <div className="rounded-lg bg-[#141312] border border-[#ECE8DF]/15 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-['Playfair_Display',serif] font-normal text-white">
                    Analysis controls
                  </h3>
                  <p className="text-xs text-[#ECE8DF]/60 font-sans mt-0.5 mb-4">
                    The plot uses the archived normalized arrays; period folding uses only the supplied BLS period and epoch.
                  </p>

                  <div className="mb-5 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#ECE8DF]/70">Fold on recorded BLS ephemeris</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input aria-label="BLS period in days" inputMode="decimal" value={foldPeriod} onChange={(event) => setFoldPeriod(event.target.value)} placeholder="Period (days)" className="min-w-0 rounded border border-[#ECE8DF]/20 bg-[#1B1A18] px-2 py-1.5 text-xs text-white" />
                      <input aria-label="BLS epoch in BTJD" inputMode="decimal" value={foldEpoch} onChange={(event) => setFoldEpoch(event.target.value)} placeholder="Epoch (BTJD)" className="min-w-0 rounded border border-[#ECE8DF]/20 bg-[#1B1A18] px-2 py-1.5 text-xs text-white" />
                    </div>
                    <button disabled={!selectedBls || !(Number(foldPeriod) > 0) || !Number.isFinite(Number(foldEpoch))} onClick={() => setFolded((value) => !value)} className="w-full rounded border border-[#C5A059]/50 px-3 py-2 text-xs text-[#C5A059] disabled:opacity-40">
                      {folded ? 'Show time series' : 'Fold measured light curve'}
                    </button>
                    {!selectedBls && <p className="text-[10px] text-[#ECE8DF]/45">No BLS period/epoch is available for this TIC and sector.</p>}
                  </div>

                  <div className="space-y-2 mb-6 font-sans text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded bg-[#1B1A18] border border-[#ECE8DF]/15">
                      <span className="text-[#ECE8DF]/80">Detected event markers</span>
                      <button
                        onClick={() => setShowEventMarkers(!showEventMarkers)}
                        className={`px-3 py-0.5 rounded text-[11px] font-bold ${
                          showEventMarkers ? 'bg-[#C5A059] text-[#141312]' : 'bg-[#141312] text-[#ECE8DF]/50'
                        }`}
                      >
                        {showEventMarkers ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded bg-[#1B1A18] border border-[#ECE8DF]/15">
                      <span className="text-[#ECE8DF]/80">Quality-flagged points</span>
                      <button
                        onClick={() => setShowQualityFlags(!showQualityFlags)}
                        className={`px-3 py-0.5 rounded text-[11px] font-bold ${
                          !showQualityFlags ? 'bg-[#C5A059] text-[#141312]' : 'bg-[#141312] text-[#ECE8DF]/50'
                        }`}
                      >
                        {!showQualityFlags ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  {/* Measurements Box */}
                  <div className="bg-[#1B1A18] p-4 rounded-lg border border-[#ECE8DF]/15 space-y-2 font-mono text-xs">
                    <div className="text-[10px] text-[#C5A059] uppercase tracking-widest font-bold mb-2">
                      MEASUREMENTS
                    </div>
                    <div className="flex items-center justify-between"><span className="text-[#ECE8DF]/60">BLS period:</span><span className="text-white font-bold">{selectedBls ? `${numeric(selectedBls.period_days, 6)} d` : 'Unavailable'}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#ECE8DF]/60">BLS epoch:</span><span className="text-white font-bold">{selectedBls ? `${numeric(selectedBls.transit_epoch_btjd, 5)} BTJD` : 'Unavailable'}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#ECE8DF]/60">Depth / SNR:</span><span className="text-white font-bold">{numeric(selectedBls?.depth_relative, 6)} / {numeric(selectedBls?.depth_snr, 2)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#ECE8DF]/60">Valid plotted points:</span><span className="text-white font-bold">{curvePayload?.point_count ?? 'Unavailable'}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#ECE8DF]/60">Flagged plotted points:</span><span className="text-white font-bold">{curvePayload?.quality_good ? curvePayload.quality_good.filter((good) => !good).length : 'Unavailable'}</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => runScienceTool('compare_sap_pdcsap')} className="rounded border border-[#ECE8DF]/20 px-2 py-2 text-[10px] text-[#ECE8DF] hover:border-[#C5A059]">Calculate SAP / PDCSAP</button>
                    <button onClick={() => runScienceTool('summarize_quality_flags')} className="rounded border border-[#ECE8DF]/20 px-2 py-2 text-[10px] text-[#ECE8DF] hover:border-[#C5A059]">Summarize QUALITY</button>
                    <button onClick={handleRunVerification} className="col-span-2 rounded border border-[#6EA893]/50 px-2 py-2 text-[10px] text-[#6EA893] hover:border-[#6EA893]">Load recorded verification and calculate evidence</button>
                  </div>
                  {(verification || testResults.length > 0) && <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[#1B1A18] p-2 text-[9px] text-[#ECE8DF]/60">{JSON.stringify(verification || testResults.at(-1)?.result, null, 2)}</pre>}
                </div>

                <button
                  onClick={() => setActiveTab('gemma')}
                  className="chamfer-btn mt-6 w-full py-2.5 px-4 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2"
                >
                  <span>Pass to AI Investigator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GEMMA 4 / EVIDENCE-BASED INVESTIGATOR (PDF Page 8) */}
        {activeTab === 'gemma' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg bg-[#141312] border border-[#ECE8DF]/15 p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-['Playfair_Display',serif] font-normal text-white">Candidate evidence</h3>
                  <span className="rounded border border-[#C5A059]/40 bg-[#1B1A18] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#C5A059]">Candidate ≠ discovery</span>
                </div>
                <p className="mb-3 text-xs text-[#ECE8DF]/60">TIC {currentCandidate?.tic_id} / Sector {currentCandidate?.sector} · {displayEvent(currentCandidate?.event_type)}</p>
                <LightCurveChart data={activeCurveData} height={180} title={`${curvePayload?.x_axis_label || 'TIME (BTJD)'} // ${curveViewMode.toUpperCase()}`} />
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[#ECE8DF]/15 bg-[#1B1A18] p-3 text-[10px] font-mono text-[#ECE8DF]/70">
                  <span>Candidate priority</span><span>{numeric(currentCandidate?.candidate_priority_score, 5)}</span>
                  <span>Star anomaly score</span><span>{numeric(currentCandidate?.star_anomaly_score, 5)}</span>
                  <span>Event time BTJD</span><span>{numeric(currentCandidate?.event_time_btjd, 5)}</span>
                  <span>User hypothesis</span><span>{hypothesis}</span>
                  <span>Gaia DR3</span><span>{candidateDetail?.target?.gaia_dr3_source_id ?? 'Unavailable'}</span>
                  <span>SIMBAD</span><span>{candidateDetail?.target?.simbad_main_id ?? 'Unavailable'}</span>
                </div>
                <button onClick={handleRunVerification} className="mt-4 w-full rounded border border-[#6EA893]/50 px-3 py-2 text-xs text-[#6EA893] hover:border-[#6EA893]">Review recorded verification and measured photometry</button>
              </div>

              <div className="rounded-lg bg-[#141312] border border-[#ECE8DF]/15 p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-['Playfair_Display',serif] font-normal text-white">Ask the Star</h3>
                  <span className="rounded border border-[#C5A059]/40 px-2 py-1 text-[9px] font-mono text-[#C5A059]">gemma-4-26b-a4b-it · {geminiConfigured ? 'READY' : 'KEY NOT CONFIGURED'}</span>
                </div>
                <p className="mb-4 text-[10px] text-[#ECE8DF]/50">Gemma can request a bounded set of Python calculations. Tool results and responses are saved to this investigation.</p>
                <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                  {(caseRecord?.ai_history || []).map((turn, index) => (
                    <div key={`${turn.created_at_utc || index}-${turn.role}`} className={`rounded-lg border p-3 ${turn.role === 'assistant' ? 'border-[#6B8EAE]/30 bg-[#1B1A18]' : 'border-[#ECE8DF]/10 bg-[#141312]'}`}>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#C5A059]">{turn.role === 'assistant' ? 'Gemma' : 'You'}</div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#ECE8DF]/85">{turn.content}</p>
                      {turn.tool_calls?.map((call, callIndex) => <details key={`${call.name}-${callIndex}`} className="mt-2 text-[10px] text-[#ECE8DF]/55"><summary className="cursor-pointer font-mono">Python tool: {call.name}</summary><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">{JSON.stringify(call.result, null, 2)}</pre></details>)}
                    </div>
                  ))}
                  {!caseRecord?.ai_history?.length && <p className="py-6 text-center text-xs text-[#ECE8DF]/45">No investigator messages have been saved for this case.</p>}
                </div>
                <textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about the measured candidate evidence…" className="mt-4 min-h-20 w-full rounded-lg border border-[#ECE8DF]/20 bg-[#1B1A18] p-3 text-xs text-white placeholder:text-[#ECE8DF]/35" />
                {chatError && <p role="alert" className="mt-2 text-xs text-[#D97757]">{chatError}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => handleRunAiInvestigation()} disabled={isInvestigating || !geminiConfigured || !chatInput.trim()} className="chamfer-btn flex-1 rounded bg-[#ECE8DF] px-3 py-2 text-xs font-bold text-[#141312] disabled:opacity-40">
                    {isInvestigating ? <><RefreshCw className="mr-1 inline h-3 w-3 animate-spin" /> Waiting for Gemma…</> : <><MessageSquare className="mr-1 inline h-3 w-3" /> Ask Gemma</>}
                  </button>
                  <button onClick={handleTestGemmaTool} disabled={isInvestigating || !geminiConfigured} className="rounded border border-[#C5A059]/50 px-3 py-2 text-xs text-[#C5A059] disabled:opacity-40">Live tool-call test</button>
                  <button onClick={() => setActiveTab('casefile')} className="rounded border border-[#ECE8DF]/25 px-3 py-2 text-xs text-[#ECE8DF]">Case file</button>
                </div>
                {gemmaTestResult && <details className="mt-3 rounded bg-[#1B1A18] p-2 text-[10px] text-[#ECE8DF]/70"><summary>Live tool-call result: {gemmaTestResult.tool_call_count} call(s)</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{JSON.stringify(gemmaTestResult, null, 2)}</pre></details>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCIENTIFIC CASE FILE / EXPORT (PDF Page 9) */}
        {activeTab === 'casefile' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg bg-[#141312] border border-[#ECE8DF]/15 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ECE8DF]/15 gap-2">
                <div>
                  <h3 className="text-2xl font-['Playfair_Display',serif] font-normal text-white">
                    CASE FILE / {currentMission.ticId} / {currentMission.sector}
                  </h3>
                  <div className="text-xs font-mono text-[#C5A059] mt-0.5">
                    STATUS: candidate / not a confirmed discovery · investigation {caseRecord?.status || 'not saved'}
                  </div>
                </div>
                <span className="text-[10px] font-sans font-bold tracking-widest text-[#ECE8DF]/70 bg-[#1B1A18] px-3 py-1.5 rounded border border-[#ECE8DF]/15 uppercase">
                  GENERATED FROM LOCAL SOURCE FILES
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#1B1A18] p-4 rounded-lg border border-[#ECE8DF]/15">
                  <div className="text-xs font-sans font-bold tracking-wider text-[#C5A059] uppercase mb-2">
                    OBSERVATION
                  </div>
                  <div className="space-y-1.5 text-xs font-mono text-[#ECE8DF]/80">
                    <div>{candidateDetail?.target?.provenance || 'Provenance not present in target metadata'}</div>
                    <div>{currentMission.ticId}, {currentMission.sector}</div>
                    <div>Observation count: {candidateDetail?.target?.observation_count ?? 'Unavailable'}</div>
                    <div>BTJD range: {numeric(candidateDetail?.target?.tstart_btjd, 4)} – {numeric(candidateDetail?.target?.tstop_btjd, 4)}</div>
                    <div className="break-all text-[#ECE8DF]/50 text-[10px]">FITS: {candidateDetail?.target?.fits_path || 'Unavailable'}</div>
                  </div>
                </div>

                <div className="bg-[#1B1A18] p-4 rounded-lg border border-[#ECE8DF]/15">
                  <div className="text-xs font-sans font-bold tracking-wider text-[#6B8EAE] uppercase mb-2">
                    MEASUREMENTS
                  </div>
                  <div className="space-y-1.5 text-xs font-mono text-[#ECE8DF]/80">
                    <div>Output event type: {displayEvent(currentCandidate?.event_type)}</div>
                    <div>Event time (BTJD): {numeric(currentCandidate?.event_time_btjd, 6)}</div>
                    <div>BLS period (days): {numeric(selectedBls?.period_days, 7)}</div>
                    <div>BLS epoch (BTJD): {numeric(selectedBls?.transit_epoch_btjd, 6)}</div>
                    <div>Depth / SNR: {numeric(selectedBls?.depth_relative, 7)} / {numeric(selectedBls?.depth_snr, 3)}</div>
                    <div>Priority / anomaly scores: {numeric(currentCandidate?.candidate_priority_score, 5)} / {numeric(currentCandidate?.star_anomaly_score, 5)}</div>
                  </div>
                </div>

                <div className="bg-[#1B1A18] p-4 rounded-lg border border-[#ECE8DF]/15">
                  <div className="text-xs font-sans font-bold tracking-wider text-[#6EA893] uppercase mb-2">
                    EVIDENCE
                  </div>
                  <div className="space-y-1.5 text-xs font-mono text-[#ECE8DF]/80">
                    <div>Recorded BLS verification: {verification?.recorded_verification?.bls?.rows?.[0]?.verification_status || 'No matching verification row'}</div>
                    <div>Recorded event verification: {verification?.recorded_verification?.events?.rows?.length ?? 'Unavailable'} rows</div>
                    <div>Gaia: {candidateDetail?.target?.gaia_match_status ?? 'No match status available'} · SIMBAD: {candidateDetail?.target?.simbad_match_status ?? 'No match status available'}</div>
                    <div>Saved Python tests: {caseRecord?.scientific_tests?.length ?? 0} · Gemma messages: {caseRecord?.ai_history?.length ?? 0}</div>
                  </div>
                </div>

                <div className="bg-[#1B1A18] p-4 rounded-lg border border-[#ECE8DF]/15">
                  <div className="text-xs font-sans font-bold tracking-wider text-[#9D78A8] uppercase mb-2">
                    NEXT STEPS
                  </div>
                  <div className="space-y-1.5 text-xs font-mono text-[#ECE8DF]/80">
                    <div>Saved hypothesis: {hypothesis}</div>
                    <div>Mission steps complete: {caseRecord?.mission_progress?.completed_step_ids?.length ?? 0}</div>
                    <div>Data path: {candidateDetail?.target?.processed_path || 'Processed NPZ unavailable'}</div>
                    <div>Catalog provenance: {candidateDetail?.target?.gaia_catalog_provenance || candidateDetail?.target?.catalog_provenance || 'Not recorded'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#ECE8DF]/15 bg-[#1B1A18] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-serif font-bold text-white">Prediction ledger</h4>
                  <span className="text-[10px] text-[#ECE8DF]/50">BTJD = BJD_TDB − 2457000</span>
                </div>
                {predictions.length ? <div className="space-y-2">{predictions.map((prediction) => (
                  <div key={prediction.prediction_id} className="grid grid-cols-1 gap-2 border-b border-[#ECE8DF]/10 pb-2 text-[10px] text-[#ECE8DF]/75 md:grid-cols-[1fr_auto] md:items-center">
                    <div>{prediction.predicted_midtime_utc} · {numeric(prediction.duration_hours, 2)} h · P {numeric(prediction.period_days, 6)} d · uncertainty {prediction.uncertainty_available ? `${numeric(prediction.time_uncertainty_hours, 2)} h` : 'unavailable'}
                      {prediction.followup_prediction_eligible === false && <span className="ml-2 text-[#D97757]">source eligibility report: not eligible for follow-up</span>}
                    </div>
                    <select value={prediction.status} onChange={(event) => reviewPrediction(prediction.prediction_id, event.target.value)} className="rounded border border-[#ECE8DF]/20 bg-[#141312] px-2 py-1 text-[10px] text-white">
                      {['awaiting', 'supported', 'contradicted'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                ))}</div> : <p className="text-xs text-[#ECE8DF]/50">No valid BLS period and epoch are available; no event is predicted.</p>}
              </div>

              <div className="rounded-lg border border-[#ECE8DF]/15 bg-[#1B1A18] p-4">
                <label htmlFor="investigation-notes" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#C5A059]">Investigation notes</label>
                <textarea id="investigation-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded border border-[#ECE8DF]/20 bg-[#141312] p-3 text-xs text-white" placeholder="Record your observations and questions." />
                <button onClick={handleSubmitHypothesis} className="mt-2 rounded bg-[#ECE8DF] px-4 py-2 text-xs font-bold text-[#141312]">Save hypothesis and notes</button>
              </div>

              <div className="pt-4 border-t border-[#ECE8DF]/15 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExportJSON}
                  className="chamfer-btn py-2.5 px-4 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export JSON</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={!caseRecord}
                  className="chamfer-btn py-2.5 px-4 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/25 text-[#ECE8DF] disabled:opacity-40 font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
                >
                  <Download className="h-4 w-4 text-[#C5A059]" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="chamfer-btn py-2.5 px-4 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/25 text-[#ECE8DF] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-[#C5A059]" />
                  <span>Print / Save PDF</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="chamfer-btn py-2.5 px-4 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/25 text-[#ECE8DF] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center gap-2"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-4 h-4 text-[#6EA893]" />
                      <span className="text-[#6EA893]">Summary Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#C5A059]" />
                      <span>Copy summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
