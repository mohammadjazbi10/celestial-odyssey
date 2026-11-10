import React, { useState } from 'react';
import { BookmarkCheck, Search, Download, FileSpreadsheet, FolderOpen } from 'lucide-react';
import { apiPatch } from '../lib/polarixApi';

export default function MyInvestigationsPage({
  investigations = [],
  onReopenCase,
  onNavigate,
  onUpdateCase
}) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ notes: '', hypothesis: '', status: 'in_progress' });
  const [saveError, setSaveError] = useState('');

  const filtered = investigations.filter((inv) => {
    const matchesFilter = filterStatus === 'all' || String(inv.status || '').toLowerCase() === filterStatus;
    const matchesSearch =
      String(inv.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(inv.tic_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(inv.hypothesis || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(inv.candidate_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleExportAllJSON = () => {
    const blob = new Blob([JSON.stringify(investigations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polarix-saved-investigations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Investigation ID', 'Candidate ID', 'TIC ID', 'Sector', 'Hypothesis', 'Status', 'Notes', 'Scientific Tests', 'Gemma Messages', 'Mission Steps'];
    const rows = investigations.map(i => [
      i.investigation_id,
      i.candidate_id,
      i.tic_id,
      i.sector,
      `"${String(i.hypothesis || '').replaceAll('"', '""')}"`,
      i.status,
      `"${String(i.notes || '').replaceAll('"', '""')}"`,
      i.scientific_tests?.length || 0,
      i.ai_history?.length || 0,
      i.mission_progress?.completed_step_ids?.length || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polarix-investigations-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const beginEdit = (item) => {
    setEditingId(item.investigation_id);
    setDraft({ notes: item.notes || '', hypothesis: item.hypothesis || '', status: item.status || 'in_progress' });
    setSaveError('');
  };

  const saveEdit = async (item) => {
    try {
      const updated = await apiPatch(`/investigations/${item.investigation_id}`, draft);
      onUpdateCase?.(updated);
      setEditingId(null);
      setSaveError('');
    } catch (error) { setSaveError(error.message); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#ECE8DF]/15">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059] text-xs font-sans font-bold tracking-[0.28em] uppercase mb-1">
            <BookmarkCheck className="w-4 h-4" />
            <span>PERSONAL WORKBENCH // LOCAL DOSSIERS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-['Playfair_Display',serif] font-normal text-[#ECE8DF]">
            My Investigations
          </h1>
          <p className="text-xs sm:text-sm text-[#ECE8DF]/70 font-sans mt-1">
            Saved candidate investigations, notes, calculations, AI responses, and mission progress.
          </p>
        </div>

        {/* Export Formats Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportAllJSON}
            className="chamfer-btn px-4 py-2 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/20 text-[#C5A059] text-xs font-['Cinzel',serif] tracking-wider flex items-center gap-1.5"
            title="Download full database as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="chamfer-btn px-4 py-2 bg-[#1B1A18] hover:bg-[#23211E] border border-[#ECE8DF]/20 text-[#6EA893] text-xs font-['Cinzel',serif] tracking-wider flex items-center gap-1.5"
            title="Download table report as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-xl bg-[#1B1A18] border border-[#ECE8DF]/15 p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#ECE8DF]/15">
          <div>
            <h2 className="text-2xl font-['Playfair_Display',serif] font-normal text-white">
              Saved investigations
            </h2>
            <p className="text-xs font-sans text-[#ECE8DF]/60 mt-0.5">
              {investigations.length} saved investigation{investigations.length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#ECE8DF]/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search dossiers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#141312] border border-[#ECE8DF]/20 focus:border-[#C5A059] focus:outline-none rounded-lg py-1.5 pl-9 pr-3 text-xs text-white placeholder-stone-600 w-48 sm:w-56 font-sans"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#141312] p-1 rounded-lg border border-[#ECE8DF]/15 text-xs font-sans">
              {['all', 'in_progress', 'complete', 'archived'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1 rounded capitalize transition-all ${
                    filterStatus === f
                      ? 'bg-[#ECE8DF] text-[#141312] font-bold'
                      : 'text-[#ECE8DF]/60 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All Cases' : f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Saved Investigations List (from PDF Page 10) */}
        <div className="space-y-4 mt-6">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div
                key={item.investigation_id}
                className="rounded-xl bg-[#141312] border border-[#ECE8DF]/15 hover:border-[#C5A059] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-[#191816]"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-serif font-bold text-white">
                      {item.title}
                    </h3>
                    <span className="text-[10px] font-mono text-[#C5A059] bg-[#1B1A18] px-2 py-0.5 rounded border border-[#C5A059]/30">
                      TIC {item.tic_id} · Sector {item.sector}
                    </span>
                  </div>

                  <div className="text-xs font-sans text-[#ECE8DF]/80 mt-1 flex flex-wrap items-center gap-3">
                    <span>
                      Hypothesis: <strong className="text-[#C5A059]">{item.hypothesis}</strong>
                    </span>
                    <span className="text-[#ECE8DF]/30">/</span>
                    <span className="capitalize font-semibold text-[#ECE8DF]">{String(item.status || 'in_progress').replace('_', ' ')}</span>
                    <span className="text-[#ECE8DF]/30">/</span>
                    <span className="text-[#ECE8DF]/50">Updated {item.updated_at_utc ? new Date(item.updated_at_utc).toLocaleString() : 'date unavailable'}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-mono text-[#ECE8DF]/55">
                    <span>{item.scientific_tests?.length || 0} scientific tests</span>
                    <span>{item.ai_history?.length || 0} AI messages</span>
                    <span>{item.mission_progress?.completed_step_ids?.length || 0} mission steps complete</span>
                  </div>
                  {editingId === item.investigation_id && <div className="mt-3 grid gap-2">
                    <input aria-label="Investigation hypothesis" value={draft.hypothesis} onChange={(event) => setDraft({ ...draft, hypothesis: event.target.value })} placeholder="Hypothesis" className="rounded border border-[#ECE8DF]/20 bg-[#1B1A18] px-3 py-2 text-xs text-white" />
                    <textarea aria-label="Investigation notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Notes" className="min-h-16 rounded border border-[#ECE8DF]/20 bg-[#1B1A18] px-3 py-2 text-xs text-white" />
                    <select aria-label="Investigation status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="w-fit rounded border border-[#ECE8DF]/20 bg-[#1B1A18] px-3 py-2 text-xs text-white">
                      {['in_progress', 'complete', 'archived'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                    </select>
                    <button onClick={() => saveEdit(item)} className="w-fit rounded bg-[#ECE8DF] px-4 py-2 text-xs font-bold text-[#141312]">Save changes</button>
                  </div>}
                </div>

                {/* Reopen Button */}
                <div className="flex shrink-0 gap-2">
                <button onClick={() => beginEdit(item)} className="rounded border border-[#ECE8DF]/20 px-3 py-2 text-xs text-[#ECE8DF] hover:border-[#C5A059]">Continue</button>
                <button
                  onClick={() => {
                    if (onReopenCase) {
                      onReopenCase(item);
                    }
                    onNavigate('missions');
                  }}
                  className="chamfer-btn py-2 px-6 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.16em] uppercase flex items-center justify-center gap-2 flex-shrink-0"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Reopen</span>
                </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-[#ECE8DF]/50 font-sans text-xs">
              {investigations.length ? 'No saved investigations match the current filter or search criteria.' : 'No investigations saved yet. Choose a real candidate and save its hypothesis from the candidate workspace.'}
            </div>
          )}
          {saveError && <p role="alert" className="text-xs text-[#D97757]">{saveError}</p>}
        </div>
      </div>
    </div>
  );
}
