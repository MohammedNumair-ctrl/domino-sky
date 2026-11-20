import React from 'react';
import { SimulationMetrics } from '../types';
import { Clock, TrendingUp, Users, ShieldAlert, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatDuration } from '../utils/time';

interface ComparisonCardsProps {
  baselineMetrics: SimulationMetrics;
  disruptedMetrics: SimulationMetrics;
  recoveredMetrics: SimulationMetrics;
  isDisruptionActive: boolean;
}

export const ComparisonCards: React.FC<ComparisonCardsProps> = ({
  baselineMetrics: _baselineMetrics,
  disruptedMetrics,
  recoveredMetrics,
  isDisruptionActive
}) => {
  const delayDelta = disruptedMetrics.totalDelayMinutes - recoveredMetrics.totalDelayMinutes;
  const otpDelta = recoveredMetrics.otpPercentage - disruptedMetrics.otpPercentage;
  const paxSaved = disruptedMetrics.impactedPassengerBookings - recoveredMetrics.impactedPassengerBookings;
  const crewsRescued = disruptedMetrics.crewDutyViolationsCount - recoveredMetrics.crewDutyViolationsCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Network Delay */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider">Total Network Delay</span>
          <Clock className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-100">
            {formatDuration(recoveredMetrics.totalDelayMinutes)}
          </span>
          {isDisruptionActive && (
            <span className="text-xs font-mono text-slate-500 line-through">
              {formatDuration(disruptedMetrics.totalDelayMinutes)}
            </span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Recovery Impact:</span>
          {isDisruptionActive && delayDelta > 0 ? (
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" />
              -{delayDelta} mins saved
            </span>
          ) : (
            <span className="text-slate-400">Baseline nominal</span>
          )}
        </div>
      </div>

      {/* 2. On-Time Performance (OTP %) */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider">On-Time Performance (OTP)</span>
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono ${
              recoveredMetrics.otpPercentage >= 80
                ? 'text-emerald-400'
                : recoveredMetrics.otpPercentage >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {recoveredMetrics.otpPercentage}%
          </span>
          {isDisruptionActive && (
            <span className="text-xs font-mono text-slate-500">
              (was {disruptedMetrics.otpPercentage}%)
            </span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">15-min Threshold:</span>
          {isDisruptionActive && otpDelta > 0 ? (
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +{otpDelta}% recovered
            </span>
          ) : (
            <span className="text-slate-400">{recoveredMetrics.onTimeFlights} / {recoveredMetrics.totalFlights} flights</span>
          )}
        </div>
      </div>

      {/* 3. Disrupted Passenger Connection Bookings */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider">Broken Connections</span>
          <Users className="w-4 h-4 text-amber-400" />
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono ${
              recoveredMetrics.brokenConnectionsCount === 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {recoveredMetrics.brokenConnectionsCount}
          </span>
          <span className="text-xs font-mono text-slate-400">
            ({recoveredMetrics.impactedPassengerBookings} pax bookings)
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Protected Bookings:</span>
          {isDisruptionActive && paxSaved > 0 ? (
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              +{paxSaved} pax rescued
            </span>
          ) : (
            <span className="text-slate-400">{recoveredMetrics.totalConnectionsCount} total tracked</span>
          )}
        </div>
      </div>

      {/* 4. Crew Duty Violations */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider">Crew Duty Violations</span>
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono ${
              recoveredMetrics.crewDutyViolationsCount === 0
                ? 'text-emerald-400'
                : 'text-rose-500'
            }`}
          >
            {recoveredMetrics.crewDutyViolationsCount}
          </span>
          <span className="text-xs font-mono text-slate-400">
            / 16 total crews
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">FDP Status:</span>
          {isDisruptionActive && crewsRescued > 0 ? (
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              +{crewsRescued} crews rescued
            </span>
          ) : recoveredMetrics.crewDutyViolationsCount === 0 ? (
            <span className="text-emerald-400 font-semibold">100% Legal Compliant</span>
          ) : (
            <span className="text-rose-400 font-bold">Illegal duty timeouts</span>
          )}
        </div>
      </div>
    </div>
  );
};
