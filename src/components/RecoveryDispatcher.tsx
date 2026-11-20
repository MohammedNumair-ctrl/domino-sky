import React from 'react';
import { SpareAircraft, RecoveryAction, SimulationResult } from '../types';
import { Plane, Wrench, Check, Play, RotateCcw } from 'lucide-react';

interface RecoveryDispatcherProps {
  spareAircraft: SpareAircraft[];
  candidateActions: RecoveryAction[];
  onToggleAction: (actionId: string) => void;
  onApplyOptimalPlan: () => void;
  onResetActions: () => void;
  disruptedResult: SimulationResult;
  recoveredResult: SimulationResult;
}

export const RecoveryDispatcher: React.FC<RecoveryDispatcherProps> = ({
  spareAircraft,
  candidateActions,
  onToggleAction,
  onApplyOptimalPlan,
  onResetActions,
  disruptedResult,
  recoveredResult
}) => {
  const appliedCount = candidateActions.filter(a => a.applied).length;
  const isDisrupted = (disruptedResult.scenario.durationMinutes || 0) > 0;

  // Calculate net impact
  const delayDiff = disruptedResult.metrics.totalDelayMinutes - recoveredResult.metrics.totalDelayMinutes;
  const paxSaved = disruptedResult.metrics.impactedPassengerBookings - recoveredResult.metrics.impactedPassengerBookings;
  const crewsRescued = disruptedResult.metrics.crewDutyViolationsCount - recoveredResult.metrics.crewDutyViolationsCount;

  return (
    <div className="bg-[#090e17] rounded-xl border border-slate-800 p-5 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold text-slate-100 tracking-wide font-mono uppercase">
            IOC Recovery Dispatcher & Standby Management
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
            {appliedCount} Active Interventions
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {candidateActions.length > 0 && (
            <button
              onClick={onApplyOptimalPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-mono font-bold shadow-lg shadow-purple-900/30 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Auto-Optimize Recovery Plan</span>
            </button>
          )}

          {appliedCount > 0 && (
            <button
              onClick={onResetActions}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Clear Interventions</span>
            </button>
          )}
        </div>
      </div>

      {/* Standby Aircraft Fleet Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {spareAircraft.map(spare => {
          // Check if this spare is currently substituted for any flight
          const isDeployed = recoveredResult.flights.some(
            f => f.effectiveTailId === spare.tail_id && f.isSpareSubstituted
          );

          return (
            <div
              key={spare.tail_id}
              className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                isDeployed
                  ? 'bg-purple-950/40 border-purple-600 text-purple-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg ${
                    isDeployed ? 'bg-purple-900/80 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{spare.tail_id}</span>
                    <span className="text-[10px] text-slate-400 font-sans">
                      ({spare.seats} Seats)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Station: <strong className="text-cyan-300">{spare.base}</strong> • Available {spare.available_from} IST
                  </div>
                </div>
              </div>

              <div>
                {isDeployed ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900 text-purple-200 border border-purple-500 animate-pulse">
                    DEPLOYED IN RECOVERY
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    STANDBY READY
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Actions Dispatcher */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
            Candidate Recovery Interventions ({candidateActions.length} Identified)
          </label>
          {appliedCount > 0 && (
            <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-3">
              <span>Saved Delay: -{delayDiff}m</span>
              <span>Saved Pax Bookings: +{paxSaved}</span>
              <span>Rescued Crews: +{crewsRescued}</span>
            </div>
          )}
        </div>

        {candidateActions.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs font-mono text-slate-500">
            {isDisrupted
              ? 'No additional interventions feasible for this scenario.'
              : 'Network is operating under baseline conditions. Inject an airport closure above to generate candidate recovery interventions.'}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
            {candidateActions.map(action => (
              <div
                key={action.id}
                onClick={() => onToggleAction(action.id)}
                className={`p-3 rounded-lg border cursor-pointer text-xs font-mono transition-all flex items-start justify-between gap-3 ${
                  action.applied
                    ? 'bg-purple-950/30 border-purple-500 text-slate-100 ring-1 ring-purple-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                      action.applied
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'border-slate-700 bg-slate-850'
                    }`}
                  >
                    {action.applied && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-2">
                      <span>{action.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 uppercase">
                        {action.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                      {action.description}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      action.applied
                        ? 'bg-purple-900 text-purple-200 border border-purple-600'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {action.applied ? 'APPLIED' : 'TEST ACTION'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
