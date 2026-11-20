import React from 'react';
import { CrewResult } from '../types';
import { ShieldCheck, AlertOctagon, UserCheck, Home } from 'lucide-react';
import { formatDuration } from '../utils/time';

interface CrewAnalysisProps {
  crews: CrewResult[];
}

export const CrewAnalysis: React.FC<CrewAnalysisProps> = ({ crews }) => {
  const violationsCount = crews.filter(c => c.isDutyViolated).length;

  return (
    <div className="bg-[#090e17] rounded-xl border border-slate-800 p-5 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100 tracking-wide font-mono uppercase">
            Crew Flight Duty Period (FDP) & Legal Exposure
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            16 Dedicated Crews • 600m Legal Limit
          </span>
        </div>

        {/* Status Callout */}
        <div className="flex items-center gap-2">
          {violationsCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-rose-950/80 border border-rose-600 text-rose-300 text-xs font-mono font-bold">
              <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>{violationsCount} ILLEGAL CREW DUTY TIMEOUTS</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-mono font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>All 16 Crews Within Legal Duty Limits</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Crews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-y-auto max-h-[520px]">
        {crews.map(c => {
          const isViolated = c.isDutyViolated;
          const isTight = !isViolated && c.dutySlackMinutes <= 30;
          const percentUsed = Math.min(100, Math.round((c.actualDutyDurationMinutes / c.maxDutyMinutes) * 100));

          return (
            <div
              key={c.crew.crew_id}
              className={`p-3 rounded-lg border text-xs font-mono transition-all ${
                isViolated
                  ? 'bg-rose-950/40 border-rose-600 ring-1 ring-rose-500'
                  : isTight
                  ? 'bg-amber-950/30 border-amber-600/70'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-cyan-400">{c.crew.crew_id}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-200">{c.crew.tail_id}</span>
                </div>
                <div>
                  {isViolated ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-900 text-rose-200 font-bold border border-rose-500">
                      TIMEOUT
                    </span>
                  ) : isTight ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900 text-amber-200 font-bold border border-amber-500">
                      TIGHT SLACK
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800">
                      LEGAL
                    </span>
                  )}
                </div>
              </div>

              {/* Duty Time Breakdown */}
              <div className="mt-2 space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base / Shift:</span>
                  <span className="font-semibold text-slate-200">
                    {c.crew.base} (on at {c.crew.duty_start})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Arr:</span>
                  <span className="font-mono text-slate-200">
                    {c.lastFlightArrival} IST ({c.terminationAirport})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duty / Max:</span>
                  <span className={`font-bold ${isViolated ? 'text-rose-400' : 'text-slate-200'}`}>
                    {c.actualDutyDurationMinutes}m / {c.maxDutyMinutes}m
                  </span>
                </div>
              </div>

              {/* Duty Progress Bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">FDP Consumed:</span>
                  <span className={isViolated ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {percentUsed}% ({formatDuration(c.actualDutyDurationMinutes)})
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      isViolated ? 'bg-rose-500' : isTight ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, percentUsed)}%` }}
                  />
                </div>
              </div>

              {/* Slack & Layover Footer */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <div>
                  {isViolated ? (
                    <span className="text-rose-400 font-bold">
                      Exceeded by +{Math.abs(c.dutySlackMinutes)}m
                    </span>
                  ) : (
                    <span className={isTight ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                      Slack: {c.dutySlackMinutes}m remaining
                    </span>
                  )}
                </div>

                {!c.terminatesAtBase && (
                  <span className="text-slate-500 flex items-center gap-1" title="Terminates at outstation">
                    <Home className="w-3 h-3 text-slate-600" />
                    <span>Layover {c.terminationAirport}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
