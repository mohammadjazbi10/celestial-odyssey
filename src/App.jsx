import React, { useState, useEffect } from 'react';
import ThreeSpaceBackground from './components/ThreeSpaceBackground';
import TopNavbar from './components/TopNavbar';
import WarpTransition from './components/WarpTransition';
import AuthModal from './components/AuthModal';

import LandingPage from './pages/LandingPage';
import OverviewPage from './pages/OverviewPage';
import SkyExplorerPage from './pages/SkyExplorerPage';
import DiscoverPage from './pages/DiscoverPage';
import MysteryMissionsPage from './pages/MysteryMissionsPage';
import MyInvestigationsPage from './pages/MyInvestigationsPage';
import AboutSciencePage from './pages/AboutSciencePage';

import { apiGet } from './lib/polarixApi';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isWarping, setIsWarping] = useState(false);
  const [warpTargetTitle, setWarpTargetTitle] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [scienceMode, setScienceMode] = useState('student'); // 'beginner' | 'student' | 'researcher'

  // User auth state persisted in localStorage
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('polarix_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [investigations, setInvestigations] = useState([]);
  useEffect(() => {
    let cancelled = false;
    apiGet('/investigations').then((payload) => {
      if (!cancelled) setInvestigations(payload.results || []);
    }).catch(() => {
      if (!cancelled) setInvestigations([]);
    });
    return () => { cancelled = true; };
  }, []);

  // Active selected candidate ID across pages
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  // Page titles map for warp animation
  const pageTitles = {
    home: 'Deep Space Telescope',
    overview: 'Overview Dashboard',
    sky: 'Sky Explorer Survey',
    discover: 'Discover Anomalies',
    missions: 'Mystery Missions & Lab',
    investigations: 'My Investigations',
    science: 'About the Science'
  };

  const handleNavigate = (pageId) => {
    // If navigating to home, immediate transition
    if (pageId === currentPage) return;

    if (pageId === 'home') {
      setCurrentPage('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Space warp transition animation
    const title = pageTitles[pageId] || pageId;
    setWarpTargetTitle(title);
    setIsWarping(true);

    setTimeout(() => {
      setCurrentPage(pageId);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setTimeout(() => {
        setIsWarping(false);
      }, 400);
    }, 450);
  };

  const handleLoginSuccess = (userProfile) => {
    setUser(userProfile);
    try {
      localStorage.setItem('polarix_user', JSON.stringify(userProfile));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('polarix_user');
    } catch (e) {
      console.error(e);
    }
    handleNavigate('home');
  };

  const handleSaveInvestigation = (newInv) => {
    if (!newInv) return;
    setInvestigations((prev) => {
      const exists = prev.some((item) => item.investigation_id === newInv.investigation_id);
      const updated = exists
        ? prev.map((item) => item.investigation_id === newInv.investigation_id ? newInv : item)
        : [newInv, ...prev];
      return updated;
    });
  };

  return (
    <div className="relative min-h-screen bg-[#141312] text-[#ECE8DF] flex flex-col font-sans selection:bg-[#C5A059] selection:text-[#141312]">
      {/* 3D Three.js Interactive Space Background */}
      <ThreeSpaceBackground intensity={currentPage === 'home' ? 1.0 : 0.65} />

      {/* Warp Transition Overlay */}
      <WarpTransition targetTitle={warpTargetTitle} isWarping={isWarping} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Top Navigation Bar (Always on top) */}
      <TopNavbar
        activePage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        scienceMode={scienceMode}
        onModeChange={setScienceMode}
      />

      {/* Main View Area */}
      <main className="relative z-10 flex-1">
        {currentPage === 'home' && (
          <LandingPage
            onNavigate={handleNavigate}
            onOpenAuth={() => setIsAuthOpen(true)}
            user={user}
          />
        )}

        {currentPage === 'overview' && (
          <OverviewPage
            onNavigate={handleNavigate}
            onSelectCandidate={setSelectedCandidateId}
          />
        )}

        {currentPage === 'sky' && (
          <SkyExplorerPage
            onNavigate={handleNavigate}
            onSelectCandidate={setSelectedCandidateId}
          />
        )}

        {currentPage === 'discover' && (
          <DiscoverPage
            onNavigate={handleNavigate}
            onSelectCandidate={setSelectedCandidateId}
          />
        )}

        {currentPage === 'missions' && (
          <MysteryMissionsPage
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={setSelectedCandidateId}
            onSaveInvestigation={handleSaveInvestigation}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'investigations' && (
          <MyInvestigationsPage
            investigations={investigations}
            onReopenCase={(item) => setSelectedCandidateId(item.candidate_id)}
            onUpdateCase={handleSaveInvestigation}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'science' && (
          <AboutSciencePage
            scienceMode={scienceMode}
            onModeChange={setScienceMode}
          />
        )}
      </main>
    </div>
  );
}
