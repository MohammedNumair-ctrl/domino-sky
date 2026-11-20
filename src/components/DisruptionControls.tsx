import React from 'react';
import { Airport, DisruptionScenario } from '../types';
import { AlertOctagon, RotateCcw, Zap, Info } from 'lucide-react';
import { timeToMinutes, minutesToTime } from '../utils/time';

interface DisruptionControlsProps {
  airports: Airport[];
  scenario: DisruptionScenario;
  onUpdateScenario: (scenario: DisruptionScenario) => void;
  onClearDisruption: () => void;
}

const PRESETS: Array<{
  name: string;
  airportId: string;
  startTime: string;
  durationMinutes: number;
  description: string;
}> = [
  {
    name: 'BOM Runway Maintenance / Closure',
    airportId: 'BOM',
    startTime: '08:00',
    durationMinutes: 150,
    description: 'Chhatrapati Shivaji International closes main runway 09/27 (08:00 - 10:30 IST).'
  },
  {
    name: 'DEL Peak Winter Fog Ground Stop',
    airportId: 'DEL',
    startTime: '06:00',
    durationMinutes: 180,
    description: 'CAT III low visibility ground stop halting all departures (06:00 - 09:00 IST).'
  },
  {
    name: 'BLR Radar & ATC Telemetry Halts',
    airportId: 'BLR',
    startTime: '11:00',
    durationMinutes: 120,
    description: 'Area Control Center technical outage at Kempegowda (11:00 - 13:00 IST).'
  },
  {
    name: 'CCU Squall Line / Severe Weather',
    airportId: 'CCU',
    startTime: '14:30',
    durationMinutes: 150,
    description: 'Severe monsoon convective thunderstorm cell over Netaji Subhash Chandra Bose (14:30 - 17:00 IST).'
  }
];

export const DisruptionControls: React.FC<DisruptionControlsProps> = ({
  airports,
  scenario,
  onUpdateScenario,
  onClearDisruption
}) => {
  const isClosureActive = !!scenario.airportId && scenario.durationMinutes > 0;
  const startMins = timeToMinutes(scenario.startTime);
  const endMins = startMins + scenario.durationMinutes;

  return (
    <div className="bg-[#090e17] rounded-xl border border-slate-800 p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className={`w-5 h-5 ${isClosureActive ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
          <h3 className="text-base font-bold text-slate-100 tracking-wide font-mono uppercase">
            Disruption Scenario Injector
          </h3>
        </div>

        {isClosureActive && (
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-950/80 border border-rose-500/80 rounded-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-rose-300">
              ACTIVE CLOSURE: {scenario.airportId} ({scenario.startTime} - {minutesToTime(endMins)} IST)
            </span>
          </div>
        )}
      </div>

      {/* Preset Buttons */}
      <div className="mb-5">
        <label className="text-xs font-mono text-slate-400 block mb-2 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Operational Disruption Presets</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() =>
                onUpdateScenario({
                  airportId: preset.airportId,
                  startTime: preset.startTime,
                  durationMinutes: preset.durationMinutes,
                  description: preset.description
                })
              }
              className={`text-left p-2.5 rounded-lg border text-xs font-mono transition-all duration-200 ${
                scenario.airportId === preset.airportId && scenario.durationMinutes === preset.durationMinutes
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <div className="font-bold text-cyan-300 flex items-center justify-between">
                <span>{preset.airportId}</span>
                <span className="text-[10px] text-amber-400 font-semibold">{preset.durationMinutes}m</span>
              </div>
              <div className="text-[11px] text-slate-300 font-sans mt-0.5 line-clamp-1">{preset.name}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {preset.startTime} - {minutesToTime(timeToMinutes(preset.startTime) + preset.durationMinutes)} IST
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80">
        {/* Airport Select */}
        <div>
          <label className="text-xs font-mono text-slate-400 block mb-1.5 uppercase tracking-wider">
            Target Airport
          </label>
          <select
            value={scenario.airportId || ''}
            onChange={e =>
              onUpdateScenario({
                ...scenario,
                airportId: e.target.value || null
              })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            <option value="">-- No Airport Closed (Normal Ops) --</option>
            {airports.map(a => (
              <option key={a.id} value={a.id}>
                {a.id} — {a.city} ({a.tier.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        {/* Closure Start Time */}
        <div>
          <label className="text-xs font-mono text-slate-400 block mb-1.5 uppercase tracking-wider flex items-center justify-between">
            <span>Closure Start (IST)</span>
            <span className="text-cyan-400 font-bold">{scenario.startTime} IST</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={scenario.startTime}
              onChange={e =>
                onUpdateScenario({
                  ...scenario,
                  startTime: e.target.value
                })
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <input
            type="range"
            min={360} // 06:00
            max={1320} // 22:00
            step={15}
            value={timeToMinutes(scenario.startTime)}
            onChange={e =>
              onUpdateScenario({
                ...scenario,
                startTime: minutesToTime(Number(e.target.value))
              })
            }
            className="w-full mt-2 accent-cyan-500 cursor-pointer"
          />
        </div>

        {/* Closure Duration */}
        <div>
          <label className="text-xs font-mono text-slate-400 block mb-1.5 uppercase tracking-wider flex items-center justify-between">
            <span>Duration (Minutes)</span>
            <span className="text-rose-400 font-bold">{scenario.durationMinutes} mins</span>
          </label>
          <div className="flex items-center gap-1.5 mb-2">
            {[30, 60, 90, 120, 150, 180].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() =>
                  onUpdateScenario({
                    ...scenario,
                    durationMinutes: mins
                  })
                }
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                  scenario.durationMinutes === mins
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
          <input
            type="range"
            min={15}
            max={360}
            step={15}
            value={scenario.durationMinutes}
            onChange={e =>
              onUpdateScenario({
                ...scenario,
                durationMinutes: Number(e.target.value)
              })
            }
            className="w-full accent-rose-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex flex-wrap items-center justify-between mt-4 pt-3 border-t border-slate-800 gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>
            {isClosureActive
              ? `Impacts all aircraft legs originating or terminating at ${scenario.airportId} during ${scenario.startTime} - ${minutesToTime(endMins)} IST.`
              : 'All 16 airports operating under baseline schedule. Turnaround buffer absorption active.'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isClosureActive && (
            <button
              onClick={onClearDisruption}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset to Baseline</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
