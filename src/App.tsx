import { useState, useMemo, useEffect } from 'react';
import rawNetworkData from '../flight_network.json';
import { FlightNetworkData, DisruptionScenario, RecoveryAction } from './types';
import { runSimulation } from './simulation/engine';
import { generateCandidateRecoveryActions, buildOptimalRecoveryPlan } from './simulation/recovery';
import { Header } from './components/Header';
import { ComparisonCards } from './components/ComparisonCards';
import { NetworkMap } from './components/NetworkMap';
import { DisruptionControls } from './components/DisruptionControls';
import { FlightTable } from './components/FlightTable';
import { ConnectionAnalysis } from './components/ConnectionAnalysis';
import { CrewAnalysis } from './components/CrewAnalysis';
import { RecoveryDispatcher } from './components/RecoveryDispatcher';
import { RefreshCw } from 'lucide-react';

const networkData = rawNetworkData as unknown as FlightNetworkData;

export function App() {
  const [activeTab, setActiveTab] = useState<'MAP' | 'FLIGHTS' | 'CONNECTIONS' | 'CREW' | 'RECOVERY'>('MAP');
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null);

  // Disruption Scenario State
  const [scenario, setScenario] = useState<DisruptionScenario>({
    airportId: null,
    startTime: '08:00',
    durationMinutes: 0
  });

  // Candidate and Applied Recovery Actions
  const [candidateActions, setCandidateActions] = useState<RecoveryAction[]>([]);

  // 1. Baseline Simulation (Zero Disruption)
  const baselineResult = useMemo(() => {
    return runSimulation(
      networkData,
      { airportId: null, startTime: '06:00', durationMinutes: 0 },
      []
    );
  }, []);

  // 2. Disrupted Simulation (With Scenario, No Recovery)
  const disruptedResult = useMemo(() => {
    return runSimulation(networkData, scenario, []);
  }, [scenario]);

  // Generate candidate recovery actions whenever disruption scenario changes
  useEffect(() => {
    if (scenario.airportId && scenario.durationMinutes > 0) {
      const candidates = generateCandidateRecoveryActions(networkData, disruptedResult);
      setCandidateActions(candidates);
    } else {
      setCandidateActions([]);
    }
  }, [scenario, disruptedResult]);

  // 3. Recovered Simulation (With Scenario + Active Recovery Actions)
  const recoveredResult = useMemo(() => {
    return runSimulation(networkData, scenario, candidateActions);
  }, [scenario, candidateActions]);

  // Handlers
  const handleSelectAirport = (airportId: string) => {
    setSelectedAirportId(airportId);
    if (!scenario.airportId) {
      setScenario(prev => ({
        ...prev,
        airportId
      }));
    }
  };

  const handleUpdateScenario = (newScenario: DisruptionScenario) => {
    setScenario(newScenario);
    if (newScenario.airportId) {
      setSelectedAirportId(newScenario.airportId);
    }
  };

  const handleClearDisruption = () => {
    setScenario({
      airportId: null,
      startTime: '08:00',
      durationMinutes: 0
    });
    setCandidateActions([]);
    setSelectedAirportId(null);
  };

  const handleToggleAction = (actionId: string) => {
    setCandidateActions(prev =>
      prev.map(a => (a.id === actionId ? { ...a, applied: !a.applied } : a))
    );
  };

  const handleApplyOptimalPlan = () => {
    const { recommendedActions } = buildOptimalRecoveryPlan(networkData, scenario, candidateActions);
    setCandidateActions(recommendedActions);
  };

  const handleResetActions = () => {
    setCandidateActions(prev => prev.map(a => ({ ...a, applied: false })));
  };

  const isDisruptionActive = !!scenario.airportId && scenario.durationMinutes > 0;

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans">
      {/* Top Telemetry Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDisruptionActive={isDisruptionActive}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-time Before/After KPI Cards */}
        <ComparisonCards
          baselineMetrics={baselineResult.metrics}
          disruptedMetrics={disruptedResult.metrics}
          recoveredMetrics={recoveredResult.metrics}
          isDisruptionActive={isDisruptionActive}
        />

        {/* Tab View: MAP */}
        {activeTab === 'MAP' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Tactical Radar Map (8 cols) */}
              <div className="lg:col-span-8">
                <NetworkMap
                  airports={networkData.airports}
                  flights={recoveredResult.flights}
                  spareAircraft={networkData.spare_aircraft}
                  closedAirportId={scenario.airportId}
                  onSelectAirport={handleSelectAirport}
                  selectedAirportId={selectedAirportId}
                />
              </div>

              {/* Disruption Control Panel (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <DisruptionControls
                  airports={networkData.airports}
                  scenario={scenario}
                  onUpdateScenario={handleUpdateScenario}
                  onClearDisruption={handleClearDisruption}
                />

                {/* Quick Recovery Snapshot if disrupted */}
                {isDisruptionActive && (
                  <div className="bg-[#090e17] rounded-xl border border-purple-900/60 p-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
                      <span className="text-xs font-mono font-bold text-purple-300 uppercase">
                        IOC Autonomous Recovery
                      </span>
                      <button
                        onClick={() => setActiveTab('RECOVERY')}
                        className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        Open Console &rarr;
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-2">
                      {candidateActions.length} recovery actions available to mitigate reactionary delay on downstream flight legs.
                    </p>
                    <button
                      onClick={handleApplyOptimalPlan}
                      className="w-full mt-3 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold shadow-md shadow-purple-900/40 transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>One-Click Auto Recovery</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Flight Overview Strip under Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#090e17] rounded-xl border border-slate-800 p-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
                    Top Impacted Flights ({recoveredResult.flights.filter(f => f.arrDelayMinutes > 0).length} Delayed)
                  </h4>
                  <button
                    onClick={() => setActiveTab('FLIGHTS')}
                    className="text-xs font-mono text-cyan-400 hover:underline"
                  >
                    View All 70 Flights &rarr;
                  </button>
                </div>
                <div className="space-y-1.5 overflow-y-auto max-h-48 font-mono text-xs">
                  {recoveredResult.flights
                    .filter(f => f.arrDelayMinutes > 0)
                    .sort((a, b) => b.arrDelayMinutes - a.arrDelayMinutes)
                    .slice(0, 5)
                    .map(f => (
                      <div
                        key={f.flight_id}
                        className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400">{f.flight_id}</span>
                          <span className="text-slate-400 text-[11px]">
                            {f.origin} &rarr; {f.destination} ({f.effectiveTailId})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">{f.simulatedArr} IST</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                            +{f.arrDelayMinutes}m
                          </span>
                        </div>
                      </div>
                    ))}
                  {recoveredResult.flights.filter(f => f.arrDelayMinutes > 0).length === 0 && (
                    <div className="text-center py-6 text-slate-500">
                      All 70 flights are operating on-time with 0 delays.
                    </div>
                  )}
                </div>
              </div>

              {/* Connections / Crew Quick Glance */}
              <div className="bg-[#090e17] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                    <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
                      Operational Network Status
                    </h4>
                    <span className="text-xs font-mono text-slate-400">Deterministic Engine</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block">Transfer Reliability</span>
                      <span
                        className={`text-base font-bold ${
                          recoveredResult.metrics.brokenConnectionsCount === 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {recoveredResult.metrics.totalConnectionsCount - recoveredResult.metrics.brokenConnectionsCount} / {recoveredResult.metrics.totalConnectionsCount} OK
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {recoveredResult.metrics.impactedPassengerBookings} broken bookings
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block">Crew Duty Compliance</span>
                      <span
                        className={`text-base font-bold ${
                          recoveredResult.metrics.crewDutyViolationsCount === 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {16 - recoveredResult.metrics.crewDutyViolationsCount} / 16 Legal
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {recoveredResult.metrics.crewDutyViolationsCount} illegal timeouts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Standby Fleet:</span>
                  <span className="text-purple-300 font-semibold">
                    VT-DS17 (BLR) & VT-DS18 (DEL) Standby
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab View: FLIGHTS */}
        {activeTab === 'FLIGHTS' && (
          <FlightTable flights={recoveredResult.flights} />
        )}

        {/* Tab View: CONNECTIONS */}
        {activeTab === 'CONNECTIONS' && (
          <ConnectionAnalysis connections={recoveredResult.connections} />
        )}

        {/* Tab View: CREW */}
        {activeTab === 'CREW' && (
          <CrewAnalysis crews={recoveredResult.crews} />
        )}

        {/* Tab View: RECOVERY */}
        {activeTab === 'RECOVERY' && (
          <RecoveryDispatcher
            spareAircraft={networkData.spare_aircraft}
            candidateActions={candidateActions}
            onToggleAction={handleToggleAction}
            onApplyOptimalPlan={handleApplyOptimalPlan}
            onResetActions={handleResetActions}
            disruptedResult={disruptedResult}
            recoveredResult={recoveredResult}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 mt-8 bg-[#070b12] text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>DOMINO SKY • Airline Disruption & Reactionary Recovery Simulator</span>
          <span>16 Airports • 70 Flights • 16 Aircraft • 21 Connections • 2 Spares • All IST</span>
          <span>Ready for Vercel Deployment</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
