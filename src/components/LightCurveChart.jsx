import React, { useState, useMemo, useRef } from 'react';

export default function LightCurveChart({
  data,
  height = 220,
  showControls = false,
  showMarkers = true,
  detrendMode = 'standard',
  viewMode = 'pdcsap',
  showQualityFlags = true,
  interactive = true,
  title = null,
  xAxisLabel = 'TIME (BTJD)'
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const containerRef = useRef(null);

  // Compute processed points based on detrending and viewMode
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((pt) => ({ ...pt, displayFlux: pt.flux }));
  }, [data]);

  // Determine bounds
  const bounds = useMemo(() => {
    if (processedData.length === 0) return { minT: 0, maxT: 100, minF: 0.95, maxF: 1.05 };
    const times = processedData.map(d => d.time);
    const fluxes = processedData.map(d => d.displayFlux);
    return {
      minT: Math.min(...times),
      maxT: Math.max(...times),
      minF: Math.min(...fluxes) - 0.004,
      maxF: Math.max(...fluxes) + 0.004
    };
  }, [processedData]);

  const padding = { top: 20, right: 24, bottom: 36, left: 56 };
  const width = 800;

  const scaleX = (t) => {
    return padding.left + ((t - bounds.minT) / (bounds.maxT - bounds.minT || 1)) * (width - padding.left - padding.right);
  };

  const scaleY = (f) => {
    return padding.top + ((bounds.maxF - f) / (bounds.maxF - bounds.minF || 1)) * (height - padding.top - padding.bottom);
  };

  const pathD = useMemo(() => {
    if (processedData.length === 0) return '';
    return processedData.reduce((acc, pt, i) => {
      const x = scaleX(pt.time);
      const y = scaleY(pt.displayFlux);
      return `${acc} ${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [processedData, bounds]);

  const xTicks = useMemo(() => {
    const ticks = [];
    const step = (bounds.maxT - bounds.minT) / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(bounds.minT + i * step);
    }
    return ticks;
  }, [bounds]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const step = (bounds.maxF - bounds.minF) / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(bounds.minF + i * step);
    }
    return ticks;
  }, [bounds]);

  const handleMouseMove = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = (mouseX / rect.width) * width;

    let closest = null;
    let minDist = Infinity;
    for (const pt of processedData) {
      const px = scaleX(pt.time);
      const dist = Math.abs(px - normX);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }
    setHoveredPoint(closest);
  };

  return (
    <div className="relative w-full select-none" ref={containerRef}>
      {title && (
        <div className="text-[11px] font-sans font-bold tracking-[0.2em] uppercase text-[#ECE8DF]/70 mb-1.5 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[#C5A059] text-[10px] bg-[#141312] px-2 py-0.5 rounded border border-[#C5A059]/40">
            {viewMode.toUpperCase()}
          </span>
        </div>
      )}

      {/* Chart Canvas Box in Innovision Charcoal & Gold Border */}
      <div
        className="relative w-full rounded-xl bg-[#141312] border border-[#ECE8DF]/15 overflow-hidden shadow-inner"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          style={{ maxHeight: height }}
        >
          {/* Subtle grid lines */}
          {xTicks.map((t, idx) => {
            const x = scaleX(t);
            return (
              <line
                key={`grid-x-${idx}`}
                x1={x}
                y1={padding.top}
                x2={x}
                y2={height - padding.bottom}
                stroke="#2A2825"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            );
          })}

          {yTicks.map((f, idx) => {
            const y = scaleY(f);
            return (
              <line
                key={`grid-y-${idx}`}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#2A2825"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            );
          })}

          {/* Baseline Flux 1.0 */}
          {bounds.minF <= 1.0 && bounds.maxF >= 1.0 && (
            <line
              x1={padding.left}
              y1={scaleY(1.0)}
              x2={width - padding.right}
              y2={scaleY(1.0)}
              stroke="#C5A059"
              strokeWidth="1"
              strokeOpacity="0.4"
              strokeDasharray="4 2"
            />
          )}

          {/* Starlight Curve Path in Celestial Gold / Ivory */}
          <path
            d={pathD}
            fill="none"
            stroke="#C5A059"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Highlight markers */}
          {showMarkers && processedData.map((pt, idx) => {
            if (pt.isDip) {
              const cx = scaleX(pt.time);
              const cy = scaleY(pt.displayFlux);
              return (
                <g key={`dip-${idx}`}>
                  <circle cx={cx} cy={cy} r="4" fill="#D97757" />
                  <circle cx={cx} cy={cy} r="7" stroke="#D97757" strokeWidth="1" fill="none" opacity="0.6" />
                </g>
              );
            }
            if (pt.isFlare) {
              const cx = scaleX(pt.time);
              const cy = scaleY(pt.displayFlux);
              return (
                <g key={`flare-${idx}`}>
                  <circle cx={cx} cy={cy} r="4.5" fill="#E5BE6C" />
                  <circle cx={cx} cy={cy} r="8.5" stroke="#E5BE6C" strokeWidth="1" fill="none" opacity="0.7" />
                </g>
              );
            }
            if (showQualityFlags && pt.qualityFlag) {
              const cx = scaleX(pt.time);
              const cy = scaleY(pt.displayFlux);
              return (
                <g key={`qf-${idx}`}>
                  <circle cx={cx} cy={cy} r="3" fill="#EF4444" opacity="0.8" />
                </g>
              );
            }
            return null;
          })}

          {/* Hover Crosshairs */}
          {hoveredPoint && (
            <g>
              <line
                x1={scaleX(hoveredPoint.time)}
                y1={padding.top}
                x2={scaleX(hoveredPoint.time)}
                y2={height - padding.bottom}
                stroke="#ECE8DF"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <line
                x1={padding.left}
                y1={scaleY(hoveredPoint.displayFlux)}
                x2={width - padding.right}
                y2={scaleY(hoveredPoint.displayFlux)}
                stroke="#ECE8DF"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={scaleX(hoveredPoint.time)}
                cy={scaleY(hoveredPoint.displayFlux)}
                r="5"
                fill="#C5A059"
                stroke="#141312"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Axes labels */}
          {yTicks.map((f, idx) => (
            <text
              key={`yt-${idx}`}
              x={padding.left - 8}
              y={scaleY(f) + 4}
              textAnchor="end"
              fill="#8A857D"
              fontSize="9"
              fontFamily="monospace"
            >
              {f.toFixed(3)}
            </text>
          ))}

          {xTicks.map((t, idx) => (
            <text
              key={`xt-${idx}`}
              x={scaleX(t)}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              fill="#8A857D"
              fontSize="9"
              fontFamily="monospace"
            >
              {t.toFixed(1)}
            </text>
          ))}

          <text
            x={padding.left}
            y={14}
            fill="#C5A059"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            FLUX ({viewMode.toUpperCase()}{detrendMode === 'folded' ? ' FOLDED' : ''})
          </text>
          <text
            x={width - padding.right}
            y={height - 8}
            textAnchor="end"
            fill="#C5A059"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {xAxisLabel}
          </text>
        </svg>

        {/* Hover Tooltip in Innovision Cream / Dark Pill */}
        {hoveredPoint && (
          <div
            className="absolute top-2 right-2 pointer-events-none bg-[#1B1A18] border border-[#C5A059]/50 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-[#ECE8DF] shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#C5A059]">BTJD:</span>
              <span className="font-bold">{hoveredPoint.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#C5A059]">Flux:</span>
              <span className="text-white font-bold">{hoveredPoint.displayFlux.toFixed(5)}</span>
            </div>
            {hoveredPoint.isDip && (
              <span className="text-[#D97757] text-[10px] block font-semibold mt-0.5">● Periodic Dip Detected</span>
            )}
            {hoveredPoint.isFlare && (
              <span className="text-[#E5BE6C] text-[10px] block font-semibold mt-0.5">▲ Stellar Flare Anomaly</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
