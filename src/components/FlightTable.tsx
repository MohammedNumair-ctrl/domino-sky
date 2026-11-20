import React, { useState, useMemo } from 'react';
import { SimulatedFlight } from '../types';
import { Search, ArrowRight, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface FlightTableProps {
  flights: SimulatedFlight[];
}

export const FlightTable: React.FC<FlightTableProps> = ({ flights }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELAYED' | 'ON_TIME' | 'CANCELLED'>('ALL');
  const [sortBy, setSortBy] = useState<'DEP' | 'DELAY' | 'FLIGHT_ID' | 'PAX'>('DEP');

  const filteredFlights = useMemo(() => {
    return flights
      .filter(f => {
        // Status filter
        if (statusFilter === 'DELAYED' && (f.arrDelayMinutes <= 15 || f.isCancelled)) return false;
        if (statusFilter === 'ON_TIME' && (f.arrDelayMinutes > 15 || f.isCancelled)) return false;
        if (statusFilter === 'CANCELLED' && !f.isCancelled) return false;

        // Search term
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          f.flight_id.toLowerCase().includes(term) ||
          f.tail_id.toLowerCase().includes(term) ||
          f.effectiveTailId.toLowerCase().includes(term) ||
          f.origin.toLowerCase().includes(term) ||
          f.destination.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'DELAY') return b.arrDelayMinutes - a.arrDelayMinutes;
        if (sortBy === 'FLIGHT_ID') return a.flight_id.localeCompare(b.flight_id);
        if (sortBy === 'PAX') return b.pax - a.pax;
        // Default DEP
        return a.dep.localeCompare(b.dep);
      });
  }, [flights, searchTerm, statusFilter, sortBy]);

  return (
    <div className="bg-[#090e17] rounded-xl border border-slate-800 p-5 shadow-2xl flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100 tracking-wide font-mono uppercase">
            Operational Flight Telemetry Table
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
            {filteredFlights.length} of {flights.length} Flights
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search flight, tail, airport..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
            {(['ALL', 'DELAYED', 'ON_TIME', 'CANCELLED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  statusFilter === tab
                    ? 'bg-cyan-900/60 text-cyan-200 border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="DEP">Departure Time</option>
              <option value="DELAY">Highest Delay</option>
              <option value="PAX">Passenger Load</option>
              <option value="FLIGHT_ID">Flight ID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[560px] border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className="bg-[#0f172a] text-slate-400 uppercase text-[11px] sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Flight</th>
              <th className="py-2.5 px-3">Tail / Leg</th>
              <th className="py-2.5 px-3">Routing</th>
              <th className="py-2.5 px-3">Scheduled (IST)</th>
              <th className="py-2.5 px-3">Simulated (IST)</th>
              <th className="py-2.5 px-3">Status / Delay</th>
              <th className="py-2.5 px-3">Pax Load</th>
              <th className="py-2.5 px-3">Operational Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-[#090e17]">
            {filteredFlights.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                  No flights match the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredFlights.map(flight => {
                const isDelayed = flight.arrDelayMinutes > 15 && !flight.isCancelled;
                const isSpare = flight.isSpareSubstituted;

                return (
                  <tr
                    key={flight.flight_id}
                    className="hover:bg-slate-850/60 transition-colors group"
                  >
                    {/* Flight ID */}
                    <td className="py-2.5 px-3 font-bold text-cyan-400">
                      {flight.flight_id}
                    </td>

                    {/* Tail / Leg */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200">{flight.effectiveTailId}</span>
                        {isSpare && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-purple-950 border border-purple-600 text-purple-300 font-bold">
                            SPARE
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-sans">
                          (L{flight.leg_order})
                        </span>
                      </div>
                    </td>

                    {/* Routing */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-slate-200 font-bold">
                        <span>{flight.origin}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span>{flight.destination}</span>
                        <span className="text-[10px] font-normal text-slate-400 font-sans ml-1">
                          ({flight.block_minutes}m)
                        </span>
                      </div>
                    </td>

                    {/* Scheduled Times */}
                    <td className="py-2.5 px-3 text-slate-400">
                      <span>{flight.dep}</span> &rarr; <span>{flight.arr}</span>
                    </td>

                    {/* Simulated Times */}
                    <td className="py-2.5 px-3">
                      {flight.isCancelled ? (
                        <span className="text-rose-500 font-bold">CANCELLED</span>
                      ) : (
                        <span className={isDelayed ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                          {flight.simulatedDep} &rarr; {flight.simulatedArr}
                        </span>
                      )}
                    </td>

                    {/* Status & Delay Badge */}
                    <td className="py-2.5 px-3">
                      {flight.isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-700/60 font-bold">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          CANCELLED
                        </span>
                      ) : flight.arrDelayMinutes === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ON TIME
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            flight.arrDelayMinutes > 45
                              ? 'bg-rose-950/70 text-rose-300 border border-rose-700'
                              : 'bg-amber-950/70 text-amber-300 border border-amber-700'
                          }`}
                        >
                          <AlertCircle className="w-3 h-3" />
                          +{flight.arrDelayMinutes}m
                        </span>
                      )}
                    </td>

                    {/* Pax Load */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200">{flight.pax}</span>
                        <span className="text-[10px] text-slate-500">/ 180</span>
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden ml-1">
                          <div
                            className="bg-cyan-500 h-1.5 rounded-full"
                            style={{ width: `${(flight.pax / 180) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Operational Notes / Causes */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                      {flight.delayCauses.length > 0 ? (
                        <span
                          className="text-amber-400/90 truncate block"
                          title={flight.delayCauses.join(' | ')}
                        >
                          {flight.delayCauses[0]}
                        </span>
                      ) : (
                        <span className="text-slate-600">Nominal turnaround</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
