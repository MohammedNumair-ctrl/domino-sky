import React, { useState, useEffect } from 'react';
import { Plane, Radio, Clock } from 'lucide-react';

interface HeaderProps {
  activeTab: 'MAP' | 'FLIGHTS' | 'CONNECTIONS' | 'CREW' | 'RECOVERY';
  onTabChange: (tab: 'MAP' | 'FLIGHTS' | 'CONNECTIONS' | 'CREW' | 'RECOVERY') => void;
  isDisruptionActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isDisruptionActive
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as IST (UTC+5:30)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setCurrentTime(new Intl.DateTimeFormat('en-GB', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-[#070b12]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-slate-100 font-mono">
                  DOMINO<span className="text-cyan-400">SKY</span>
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase tracking-wider">
                  IOC Simulator
                </span>
                {isDisruptionActive ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-600 text-rose-300 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    DISRUPTED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    NOMINAL
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                Airline Disruption & Recovery Engine • Single-Day IST Schedule
              </p>
            </div>
          </div>

          {/* Telemetry Clock */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400 border-x border-slate-800 px-4 h-10">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>LIVE CLOCK:</span>
              <span className="text-slate-100 font-bold">{currentTime || '12:30:00'} IST</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>DETERMINISTIC SIMULATION ACTIVE</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg">
            {[
              { id: 'MAP', label: 'Radar Map' },
              { id: 'FLIGHTS', label: 'Flights (70)' },
              { id: 'CONNECTIONS', label: 'Transfers (21)' },
              { id: 'CREW', label: 'Crews (16)' },
              { id: 'RECOVERY', label: 'Recovery Console' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};
