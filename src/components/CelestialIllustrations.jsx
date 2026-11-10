import React from 'react';

// Engraved Jupiter-like banded planet for bottom-left corner
export function EngravedBandedPlanet({ className = '' }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={`select-none pointer-events-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="planet-clip">
          <circle cx="100" cy="220" r="160" />
        </clipPath>
        <radialGradient id="planet-shade" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ECE8DF" />
          <stop offset="60%" stopColor="#8A857D" />
          <stop offset="100%" stopColor="#141312" />
        </radialGradient>
      </defs>

      {/* Base Sphere */}
      <circle cx="100" cy="220" r="160" fill="url(#planet-shade)" stroke="#141312" strokeWidth="2.5" />

      {/* Engraved Storm Bands with Woodcut Hatching */}
      <g clipPath="url(#planet-clip)" stroke="#141312" strokeWidth="2" opacity="0.85">
        {/* Band 1 */}
        <path d="M-60 140 Q 100 180 260 140" fill="none" strokeWidth="3" />
        <path d="M-60 150 Q 100 190 260 150" fill="none" strokeDasharray="3 3" />
        
        {/* Band 2 - Wide dark band with hatching */}
        <path d="M-60 180 Q 100 220 260 180 L 260 210 Q 100 250 -60 210 Z" fill="#141312" fillOpacity="0.15" />
        <path d="M-60 180 Q 100 220 260 180" fill="none" strokeWidth="3.5" />
        <path d="M-60 210 Q 100 250 260 210" fill="none" strokeWidth="3.5" />

        {/* Band 3 - Swirling vortex */}
        <ellipse cx="140" cy="235" rx="25" ry="12" stroke="#141312" strokeWidth="2.5" fill="#141312" fillOpacity="0.2" />
        <ellipse cx="140" cy="235" rx="15" ry="7" stroke="#141312" strokeWidth="1.5" />

        {/* Band 4 */}
        <path d="M-60 250 Q 100 290 260 250" fill="none" strokeWidth="3.5" />
        <path d="M-60 262 Q 100 302 260 262" fill="none" strokeDasharray="4 4" />
        <path d="M-60 280 Q 100 320 260 280" fill="none" strokeWidth="3" />

        {/* Crater pockmarks */}
        <circle cx="60" cy="165" r="4" fill="#141312" fillOpacity="0.4" />
        <circle cx="180" cy="160" r="3" fill="#141312" fillOpacity="0.4" />
        <circle cx="30" cy="230" r="5" fill="#141312" fillOpacity="0.3" />
      </g>
    </svg>
  );
}

// Engraved Ringed Planet & Asteroid for top-left orbit
export function EngravedRingedPlanet({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={`select-none pointer-events-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="saturn-shade" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ECE8DF" />
          <stop offset="65%" stopColor="#8A857D" />
          <stop offset="100%" stopColor="#141312" />
        </radialGradient>
      </defs>

      {/* Back Ring Half */}
      <ellipse
        cx="75"
        cy="75"
        rx="58"
        ry="18"
        stroke="#141312"
        strokeWidth="2.5"
        transform="rotate(-28 75 75)"
      />
      <ellipse
        cx="75"
        cy="75"
        rx="52"
        ry="14"
        stroke="#141312"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        transform="rotate(-28 75 75)"
      />

      {/* Planet Sphere */}
      <circle cx="75" cy="75" r="28" fill="url(#saturn-shade)" stroke="#141312" strokeWidth="2.5" />

      {/* Engraved Bands on sphere */}
      <path d="M50 72 Q 75 82 100 72" stroke="#141312" strokeWidth="2" />
      <path d="M52 79 Q 75 89 98 79" stroke="#141312" strokeWidth="2" />

      {/* Front Ring Half */}
      <path
        d="M 23 99 A 58 18 0 0 0 127 51"
        stroke="#141312"
        strokeWidth="3"
        fill="none"
        transform="rotate(-28 75 75)"
      />
      <path
        d="M 28 97 A 52 14 0 0 0 122 53"
        stroke="#141312"
        strokeWidth="1.5"
        strokeDasharray="4 2"
        fill="none"
        transform="rotate(-28 75 75)"
      />

      {/* Small floating craggy asteroid nearby */}
      <polygon
        points="135,115 142,118 145,126 138,132 130,128 128,120"
        fill="#545048"
        stroke="#141312"
        strokeWidth="1.5"
      />
      <circle cx="137" cy="122" r="1.5" fill="#141312" />
    </svg>
  );
}

// Engraved Astronaut for bottom-right corner matching Innovision
export function EngravedAstronaut({ className = '' }) {
  return (
    <svg
      viewBox="0 0 180 260"
      className={`select-none pointer-events-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="#141312" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#ECE8DF">
        {/* Backpack / Life Support Unit */}
        <rect x="35" y="60" width="30" height="90" rx="8" fill="#D5D0C5" />
        <rect x="115" y="60" width="30" height="90" rx="8" fill="#D5D0C5" />

        {/* Torso & Suit Body */}
        <path d="M50 80 Q 90 75 130 80 L 135 155 Q 90 162 45 155 Z" fill="#ECE8DF" />
        {/* Chest pack & controls */}
        <rect x="70" y="95" width="40" height="36" rx="4" fill="#141312" />
        <circle cx="80" cy="108" r="3.5" fill="#C5A059" />
        <circle cx="92" cy="108" r="3.5" fill="#6EA893" />
        <rect x="76" y="118" width="28" height="6" rx="2" fill="#ECE8DF" />

        {/* Helmet / Visor */}
        <ellipse cx="90" cy="46" rx="32" ry="34" fill="#ECE8DF" strokeWidth="2.5" />
        {/* Dark Visor with reflection */}
        <ellipse cx="90" cy="46" rx="23" ry="18" fill="#141312" />
        <path d="M78 38 Q 90 34 102 38" stroke="#ECE8DF" strokeWidth="2" fill="none" opacity="0.7" />

        {/* Arms */}
        {/* Left Arm */}
        <path d="M50 82 Q 28 110 32 145" strokeWidth="8" stroke="#ECE8DF" fill="none" />
        <path d="M50 82 Q 28 110 32 145" strokeWidth="2" stroke="#141312" fill="none" />
        {/* Left Glove */}
        <ellipse cx="33" cy="150" rx="8" ry="10" fill="#141312" />

        {/* Right Arm */}
        <path d="M130 82 Q 152 110 148 145" strokeWidth="8" stroke="#ECE8DF" fill="none" />
        <path d="M130 82 Q 152 110 148 145" strokeWidth="2" stroke="#141312" fill="none" />
        {/* Right Glove */}
        <ellipse cx="147" cy="150" rx="8" ry="10" fill="#141312" />

        {/* Legs & Boots */}
        {/* Left Leg */}
        <path d="M60 155 L 55 220" strokeWidth="11" stroke="#ECE8DF" fill="none" />
        <path d="M60 155 L 55 220" strokeWidth="2" stroke="#141312" fill="none" />
        {/* Left Boot */}
        <path d="M42 222 L 68 222 L 68 234 L 40 234 Z" fill="#141312" />

        {/* Right Leg */}
        <path d="M120 155 L 125 220" strokeWidth="11" stroke="#ECE8DF" fill="none" />
        <path d="M120 155 L 125 220" strokeWidth="2" stroke="#141312" fill="none" />
        {/* Right Boot */}
        <path d="M112 222 L 138 222 L 140 234 L 112 234 Z" fill="#141312" />

        {/* Suit Wrinkle Shading Details */}
        <path d="M54 110 Q 64 115 56 125" stroke="#141312" strokeWidth="1.5" fill="none" />
        <path d="M126 110 Q 116 115 124 125" stroke="#141312" strokeWidth="1.5" fill="none" />
        <path d="M52 175 Q 60 180 54 190" stroke="#141312" strokeWidth="1.5" fill="none" />
        <path d="M128 175 Q 120 180 126 190" stroke="#141312" strokeWidth="1.5" fill="none" />
      </g>
    </svg>
  );
}
