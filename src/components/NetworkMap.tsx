import React, { useState } from 'react';
import { Airport, SimulatedFlight, SpareAircraft } from '../types';
import { MapPin } from 'lucide-react';

interface NetworkMapProps {
  airports: Airport[];
  flights: SimulatedFlight[];
  spareAircraft: SpareAircraft[];
  closedAirportId: string | null;
  onSelectAirport: (airportId: string) => void;
  selectedAirportId: string | null;
}

// Bounding box for Indian flight network
const MIN_LAT = 7.0;
const MAX_LAT = 32.5;
const MIN_LNG = 71.0;
const MAX_LNG = 93.0;

const SVG_WIDTH = 800;
const SVG_HEIGHT = 720;
const PAD_X = 60;
const PAD_Y = 50;

function projectCoords(lat: number, lng: number): [number, number] {
  const usableW = SVG_WIDTH - 2 * PAD_X;
  const usableH = SVG_HEIGHT - 2 * PAD_Y;
  const x = PAD_X + ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * usableW;
  const y = PAD_Y + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * usableH;
  return [x, y];
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
  airports,
  flights,
  spareAircraft,
  closedAirportId,
  onSelectAirport,
  selectedAirportId
}) => {
  const [hoveredAirport, setHoveredAirport] = useState<Airport | null>(null);

  const airportMap = new Map<string, Airport>();
  airports.forEach(a => airportMap.set(a.id, a));

  // Compute flight routes
  const routeMap = new Map<string, { from: Airport; to: Airport; flights: SimulatedFlight[]; maxDelay: number }>();

  flights.forEach(f => {
    const from = airportMap.get(f.origin);
    const to = airportMap.get(f.destination);
    if (!from || !to) return;

    // Normalize route key (bidirectional grouping or directional)
    const key = `${f.origin}->${f.destination}`;
    const existing = routeMap.get(key) || { from, to, flights: [], maxDelay: 0 };
    existing.flights.push(f);
    existing.maxDelay = Math.max(existing.maxDelay, f.arrDelayMinutes);
    routeMap.set(key, existing);
  });

  return (
    <div className="relative w-full bg-[#090e17] rounded-xl border border-slate-800 p-4 shadow-2xl overflow-hidden">
      {/* Map Control Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-2 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-sm font-semibold tracking-wider text-slate-200 uppercase font-mono">
            Tactical Flight Radar & Network Topology
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            16 Airports • 70 Flights
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
            <span>Mega Hub</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Regional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Spoke</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/50 animate-ping" />
            <span className="text-rose-400 font-bold">Closed Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900/60 border border-purple-500 text-purple-300 font-bold">
              SPARE
            </span>
            <span>Standby Fleet</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full aspect-[800/720] max-h-[640px] flex items-center justify-center">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full select-none"
        >
          <defs>
            {/* Gradients and Filters */}
            <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="closedGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="routeGradientNormal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="routeGradientDelayed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Subdued Radar Background Grid */}
          <g opacity="0.12">
            {[100, 200, 300, 400, 500, 600, 700].map(x => (
              <line key={`grid-x-${x}`} x1={x} y1="0" x2={x} y2={SVG_HEIGHT} stroke="#38bdf8" strokeDasharray="4 8" />
            ))}
            {[100, 200, 300, 400, 500, 600].map(y => (
              <line key={`grid-y-${y}`} x1="0" y1={y} x2={SVG_WIDTH} y2={y} stroke="#38bdf8" strokeDasharray="4 8" />
            ))}
            <circle cx={SVG_WIDTH / 2} cy={SVG_HEIGHT / 2} r="180" fill="none" stroke="#38bdf8" strokeDasharray="6 12" />
            <circle cx={SVG_WIDTH / 2} cy={SVG_HEIGHT / 2} r="320" fill="none" stroke="#38bdf8" strokeDasharray="6 12" />
          </g>

          {/* Render Route Flight Arcs */}
          {Array.from(routeMap.entries()).map(([key, route]) => {
            const [x1, y1] = projectCoords(route.from.lat, route.from.lng);
            const [x2, y2] = projectCoords(route.to.lat, route.to.lng);

            // Compute curved control point
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            // Curvature offset
            const curvature = 0.12;
            const cx = midX - dy * curvature;
            const cy = midY + dx * curvature;

            const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

            const isRouteDelayed = route.maxDelay > 15;
            const hasSevereDelay = route.maxDelay >= 60;
            const hasCancelled = route.flights.some(f => f.isCancelled);

            let strokeColor = 'rgba(6, 182, 212, 0.25)';
            let strokeWidth = 1.5;
            let strokeDasharray = 'none';

            if (hasCancelled) {
              strokeColor = 'rgba(239, 68, 68, 0.7)';
              strokeDasharray = '4 4';
              strokeWidth = 2;
            } else if (hasSevereDelay) {
              strokeColor = 'rgba(239, 68, 68, 0.8)';
              strokeWidth = 2.5;
            } else if (isRouteDelayed) {
              strokeColor = 'rgba(245, 158, 11, 0.7)';
              strokeWidth = 2;
            }

            return (
              <g key={`route-${key}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  className="transition-all duration-300 hover:stroke-cyan-300 hover:stroke-[3px]"
                />
              </g>
            );
          })}

          {/* Render Airport Nodes */}
          {airports.map(airport => {
            const [cx, cy] = projectCoords(airport.lat, airport.lng);
            const isClosed = airport.id === closedAirportId;
            const isSelected = airport.id === selectedAirportId;
            const isMega = airport.tier === 'mega_hub';
            const isRegional = airport.tier === 'regional_hub';

            // Find spare aircraft at this base
            const sparesAtBase = spareAircraft.filter(s => s.base === airport.id);

            // Calculate airport delay state
            const arrivingHere = flights.filter(f => f.destination === airport.id);
            const departingHere = flights.filter(f => f.origin === airport.id);
            const maxDelayHere = Math.max(
              0,
              ...arrivingHere.map(f => f.arrDelayMinutes),
              ...departingHere.map(f => f.depDelayMinutes)
            );
            const hasDelays = maxDelayHere > 15;

            const baseRadius = isMega ? 9 : isRegional ? 7 : 5;

            return (
              <g
                key={`airport-${airport.id}`}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => onSelectAirport(airport.id)}
                onMouseEnter={() => setHoveredAirport(airport)}
                onMouseLeave={() => setHoveredAirport(null)}
              >
                {/* Closure Pulse Animation */}
                {isClosed && (
                  <>
                    <circle cx={cx} cy={cy} r={baseRadius * 3.5} fill="url(#closedGlow)" opacity="0.8" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={baseRadius * 2.8}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                      className="animate-ping"
                      opacity="0.75"
                    />
                  </>
                )}

                {/* Selection Halo */}
                {isSelected && !isClosed && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={baseRadius + 6}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="animate-spin"
                  />
                )}

                {/* Base Outer Ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={baseRadius + 3}
                  fill="none"
                  stroke={
                    isClosed
                      ? '#f43f5e'
                      : hasDelays
                      ? '#f59e0b'
                      : isMega
                      ? 'rgba(6, 182, 212, 0.5)'
                      : 'rgba(16, 185, 129, 0.4)'
                  }
                  strokeWidth="1.5"
                />

                {/* Core Airport Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={baseRadius}
                  fill={
                    isClosed
                      ? '#ef4444'
                      : hasDelays
                      ? '#f59e0b'
                      : isMega
                      ? '#06b6d4'
                      : isRegional
                      ? '#10b981'
                      : '#94a3b8'
                  }
                  filter={isClosed || isMega ? 'url(#glow)' : undefined}
                />

                {/* Airport Code Label */}
                <text
                  x={cx + (airport.lng > 80 ? -12 : 12)}
                  y={cy + 4}
                  textAnchor={airport.lng > 80 ? 'end' : 'start'}
                  className={`text-[11px] font-mono font-bold tracking-wider ${
                    isClosed
                      ? 'fill-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                      : hasDelays
                      ? 'fill-amber-300'
                      : isMega
                      ? 'fill-cyan-300'
                      : 'fill-slate-300'
                  }`}
                >
                  {airport.id}
                </text>

                {/* Spare Aircraft Badge Marker */}
                {sparesAtBase.length > 0 && (
                  <g transform={`translate(${cx - 18}, ${cy - 20})`}>
                    <rect
                      x="0"
                      y="0"
                      width="36"
                      height="14"
                      rx="3"
                      fill="#3b0764"
                      stroke="#a855f7"
                      strokeWidth="1"
                    />
                    <text
                      x="18"
                      y="10"
                      textAnchor="middle"
                      className="fill-purple-200 text-[8px] font-mono font-bold"
                    >
                      {sparesAtBase[0].tail_id}
                    </text>
                  </g>
                )}

                {/* Closed Alert Badge */}
                {isClosed && (
                  <g transform={`translate(${cx - 24}, ${cy + 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="48"
                      height="16"
                      rx="4"
                      fill="#881337"
                      stroke="#f43f5e"
                      strokeWidth="1"
                    />
                    <text
                      x="24"
                      y="11"
                      textAnchor="middle"
                      className="fill-rose-100 text-[9px] font-mono font-extrabold uppercase tracking-wider"
                    >
                      CLOSED
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredAirport && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 border border-cyan-500/50 rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs font-mono w-64"
            style={{
              left: Math.min(
                Math.max(20, projectCoords(hoveredAirport.lat, hoveredAirport.lng)[0] - 128),
                SVG_WIDTH - 280
              ),
              top: Math.max(10, projectCoords(hoveredAirport.lat, hoveredAirport.lng)[1] - 110)
            }}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-cyan-400 text-sm">{hoveredAirport.id}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                  hoveredAirport.tier === 'mega_hub'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : hoveredAirport.tier === 'regional_hub'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {hoveredAirport.tier.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-1.5 text-slate-200 font-sans font-medium text-xs">{hoveredAirport.name}</div>
            <div className="text-slate-400 text-[11px] mb-2">{hoveredAirport.city}, India</div>

            <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-950/60 p-2 rounded border border-slate-800">
              <div>
                <span className="text-slate-500 block">Capacity:</span>
                <span className="text-slate-200 font-semibold">{hoveredAirport.capacity_per_hour} mvmt/hr</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <span
                  className={`font-bold ${
                    hoveredAirport.id === closedAirportId ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {hoveredAirport.id === closedAirportId ? 'CLOSED' : 'OPERATIONAL'}
                </span>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-cyan-400/80 text-center">
              Click airport to configure closure / inspection
            </div>
          </div>
        )}
      </div>

      {/* Map Footer Operational Note */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>Coordinates: WGS84 Geodetic • All 16 Certified Indian Stations</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-purple-400">Standby Fleet: VT-DS17 (BLR) & VT-DS18 (DEL)</span>
        </div>
      </div>
    </div>
  );
};
