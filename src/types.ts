export interface Airport {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tier: 'mega_hub' | 'regional_hub' | 'spoke';
  capacity_per_hour: number;
}

export interface Flight {
  flight_id: string;
  tail_id: string;
  leg_order: number;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
  block_minutes: number;
  pax: number;
  turnaround_before_min: number | null;
}

export interface Connection {
  connection_id: string;
  airport: string;
  from_flight: string;
  to_flight: string;
  passengers: number;
  min_connect_minutes: number;
}

export interface Crew {
  crew_id: string;
  tail_id: string;
  base: string;
  duty_start: string;
  max_duty_mins: number;
  flight_ids: string[];
}

export interface SpareAircraft {
  tail_id: string;
  base: string;
  available_from: string;
  seats: number;
}

export interface NetworkMeta {
  dataset: string;
  operating_day: string;
  min_turnaround_minutes: number;
  seats_per_aircraft: number;
  notes: string[];
}

export interface FlightNetworkData {
  meta: NetworkMeta;
  airports: Airport[];
  flights: Flight[];
  connections: Connection[];
  crews: Crew[];
  spare_aircraft: SpareAircraft[];
}

export interface DisruptionScenario {
  airportId: string | null;
  startTime: string; // HH:MM
  durationMinutes: number;
  description?: string;
}

export interface RecoveryAction {
  id: string;
  type: 'spare_swap' | 'connection_hold' | 'flight_cancel' | 'turnaround_compress';
  title: string;
  description: string;
  targetId: string; // flight_id or tail_id or connection_id
  parameters?: Record<string, any>;
  applied: boolean;
}

export interface SimulatedFlight extends Flight {
  simulatedDep: string;
  simulatedArr: string;
  depDelayMinutes: number;
  arrDelayMinutes: number;
  effectiveTailId: string;
  isCancelled: boolean;
  isSpareSubstituted: boolean;
  turnaroundActualMinutes: number | null;
  turnaroundSlackMinutes: number | null;
  isDelayed: boolean;
  delayCauses: string[];
}

export interface ConnectionResult {
  connection: Connection;
  fromFlight: SimulatedFlight;
  toFlight: SimulatedFlight;
  actualInboundArr: string;
  actualOutboundDep: string;
  actualConnectWindowMinutes: number;
  minConnectMinutes: number;
  isBroken: boolean;
  lostPassengerBookings: number;
  slackMinutes: number;
}

export interface CrewResult {
  crew: Crew;
  actualDutyDurationMinutes: number;
  scheduledDutyDurationMinutes: number;
  maxDutyMinutes: number;
  dutySlackMinutes: number;
  isDutyViolated: boolean;
  assignedFlightsCount: number;
  lastFlightArrival: string;
  terminatesAtBase: boolean;
  terminationAirport: string;
}

export interface SimulationMetrics {
  totalFlights: number;
  onTimeFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  totalDelayMinutes: number;
  averageDelayMinutes: number;
  otpPercentage: number;
  brokenConnectionsCount: number;
  totalConnectionsCount: number;
  impactedPassengerBookings: number;
  crewDutyViolationsCount: number;
  maxIndividualDelayMinutes: number;
  sparesDeployedCount: number;
}

export interface SimulationResult {
  scenario: DisruptionScenario;
  flights: SimulatedFlight[];
  connections: ConnectionResult[];
  crews: CrewResult[];
  metrics: SimulationMetrics;
}
