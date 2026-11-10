import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, ArrowRight } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('researcher');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const userProfile = {
      name: name || (isSignUp ? 'Dr. Alex Mercer' : 'Dr. M. Chen'),
      email: email || 'astronomer@polarix.deepsky.org',
      role: role || 'Lead Astrobiologist',
      authenticated: true,
      mode: 'student'
    };
    onLoginSuccess(userProfile);
    onClose();
  };

  const handleQuickDemo = (userRole = 'Lead Investigator') => {
    const demoUser = {
      name: 'Dr. Sarah Lin',
      email: 's.lin@kepler-tess.edu',
      role: userRole,
      authenticated: true,
      mode: 'student'
    };
    onLoginSuccess(demoUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#1B1A18] border border-[#ECE8DF]/20 rounded-2xl shadow-2xl overflow-hidden p-6 text-[#ECE8DF]"
        style={{
          boxShadow: '0 0 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(197, 160, 89, 0.15)'
        }}
      >
        {/* Top gold line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C5A059] via-[#ECE8DF] to-[#C5A059]" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#ECE8DF]/60 hover:text-white p-1 rounded-lg hover:bg-[#23211E] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#141312] border border-[#C5A059]/40 text-[#C5A059] mb-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z" />
            </svg>
          </div>
          <h3 className="text-2xl font-['Cinzel',serif] font-bold tracking-[0.14em] text-[#ECE8DF]">
            {isSignUp ? 'CREW REGISTRATION' : 'ASTRONOMER ACCESS'}
          </h3>
          <p className="text-xs text-[#ECE8DF]/70 font-sans mt-1">
            Authenticate to explore live telemetry, target maps, and scientific missions.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-lg bg-[#141312] p-1 border border-[#ECE8DF]/15 mb-5">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-1.5 text-xs font-['Cinzel',serif] tracking-wider rounded transition-all ${
              !isSignUp ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow' : 'text-[#ECE8DF]/60 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-1.5 text-xs font-['Cinzel',serif] tracking-wider rounded transition-all ${
              isSignUp ? 'bg-[#ECE8DF] text-[#141312] font-bold shadow' : 'text-[#ECE8DF]/60 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-bold tracking-widest text-[#ECE8DF]/70 uppercase mb-1">
                ASTRONOMER NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Dr. M. Kepler"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#141312] border border-[#ECE8DF]/20 focus:border-[#C5A059] focus:outline-none rounded-lg py-2 pl-9 pr-3 text-sm text-[#ECE8DF] placeholder-stone-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold tracking-widest text-[#ECE8DF]/70 uppercase mb-1">
              MISSION COMM EMAIL
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                placeholder="astronomer@polarix.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#141312] border border-[#ECE8DF]/20 focus:border-[#C5A059] focus:outline-none rounded-lg py-2 pl-9 pr-3 text-sm text-[#ECE8DF] placeholder-stone-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-widest text-[#ECE8DF]/70 uppercase mb-1">
              ACCESS KEY / CIPHER
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#141312] border border-[#ECE8DF]/20 focus:border-[#C5A059] focus:outline-none rounded-lg py-2 pl-9 pr-3 text-sm text-[#ECE8DF] placeholder-stone-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="chamfer-btn w-full mt-2 py-3 px-4 bg-[#ECE8DF] hover:bg-[#C5A059] text-[#141312] font-['Cinzel',serif] font-bold text-xs tracking-[0.18em] uppercase shadow-md flex items-center justify-center gap-2"
          >
            <span>{isSignUp ? 'COMPLETE REGISTRATION' : 'ENTER ODYSSEY'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#ECE8DF]/15" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-sans tracking-widest">
            <span className="bg-[#1B1A18] px-2 text-[#ECE8DF]/60">or one-click access</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleQuickDemo('Lead Astrobiologist')}
          className="chamfer-btn w-full py-2.5 px-3 bg-[#141312] hover:bg-[#23211E] border border-[#C5A059]/50 text-[#C5A059] text-xs font-['Cinzel',serif] tracking-wider flex items-center justify-center gap-2 transition-all"
        >
          <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
          <span>Launch as Verified Researcher (1-Click)</span>
        </button>
      </div>
    </div>
  );
}
