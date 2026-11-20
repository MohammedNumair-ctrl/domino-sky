import {
  FlightNetworkData,
  DisruptionScenario,
  RecoveryAction,
  SimulatedFlight,
  ConnectionResult,
  CrewResult,
  SimulationMetrics,
  SimulationResult,
} from '../types';
import { timeToMinutes, minutesToTime } from '../utils/time';

/**
 * Deterministic Simulation Engine for DOMINO SKY
 * Implements aviation operational logic without synthetic random numbers.
 */
export function runSimulation(
  networkData: FlightNetworkData,
  scenario: DisruptionScenario,
  recoveryActions: RecoveryAction[] = []
): SimulationResult {
  const minTurnaroundMinutes = networkData.meta.min_turnaround_minutes || 30;
  const isClosureActive = !!scenario.airportId && scenario.durationMinutes > 0;
  const closureStart = scenario.airportId ? timeToMinutes(scenario.startTime) : 0;
  const closureEnd = isClosureActive ? closureStart + scenario.durationMinutes : 0;

  // Index active recovery actions
  const appliedActions = recoveryActions.filter(a => a.applied);
  const cancelledFlightIds = new Set(
    appliedActions.filter(a => a.type === 'flight_cancel').map(a => a.targetId)
  );
  const spareSwaps = new Map<string, string>(); // original tail -> spare tail
  appliedActions
    .filter(a => a.type === 'spare_swap')
    .forEach(a => {
      if (a.parameters?.spareTail) {
        spareSwaps.set(a.targetId, a.parameters.spareTail);
      }
    });
  const connectionHolds = new Map<string, number>(); // flight_id -> hold duration in minutes
  appliedActions
    .filter(a => a.type === 'connection_hold')
    .forEach(a => {
      const hold = a.parameters?.holdMinutes || 15;
      connectionHolds.set(a.targetId, hold);
    });

  // Group flights by tail_id
  const flightsByTail = new Map<string, typeof networkData.flights>();
  for (const f of networkData.flights) {
    const list = flightsByTail.get(f.tail_id) || [];
    list.push(f);
    flightsByTail.set(f.tail_id, list);
  }

  const simulatedFlightsMap = new Map<string, SimulatedFlight>();
  const simulatedFlightsList: SimulatedFlight[] = [];

  // Simulate each aircraft rotation chronologically through its legs
  for (const [tailId, tailFlights] of flightsByTail.entries()) {
    const sortedLegs = [...tailFlights].sort((a, b) => a.leg_order - b.leg_order);
    let prevActualArrMinutes: number | null = null;
    let currentTailId = spareSwaps.get(tailId) || tailId;
    let isSubstituted = currentTailId !== tailId;

    for (let i = 0; i < sortedLegs.length; i++) {
      const f = sortedLegs[i];
      const schedDepM = timeToMinutes(f.dep);
      const schedArrM = timeToMinutes(f.arr);
      const blockM = f.block_minutes;
      const isCancelled = cancelledFlightIds.has(f.flight_id);
      const delayCauses: string[] = [];

      if (isCancelled) {
        const cancelledFlight: SimulatedFlight = {
          ...f,
          simulatedDep: f.dep,
          simulatedArr: f.arr,
          depDelayMinutes: 0,
          arrDelayMinutes: 0,
          effectiveTailId: currentTailId,
          isCancelled: true,
          isSpareSubstituted: isSubstituted,
          turnaroundActualMinutes: null,
          turnaroundSlackMinutes: null,
          isDelayed: false,
          delayCauses: ['Flight cancelled by recovery action']
        };
        simulatedFlightsMap.set(f.flight_id, cancelledFlight);
        simulatedFlightsList.push(cancelledFlight);
        continue;
      }

      // 1. Calculate earliest departure based on previous arrival + minimum turnaround
      let earliestDepM = schedDepM;
      let turnaroundActual: number | null = null;
      let turnaroundSlack: number | null = null;

      if (i > 0 && prevActualArrMinutes !== null) {
        const minTurnaroundReadyM = prevActualArrMinutes + minTurnaroundMinutes;
        turnaroundActual = schedDepM - prevActualArrMinutes; // Stated scheduled gap

        if (minTurnaroundReadyM > schedDepM) {
          // Late inbound propagated to departure!
          earliestDepM = minTurnaroundReadyM;
          delayCauses.push(`Reactionary delay: Previous leg arrival at ${minutesToTime(prevActualArrMinutes)} + ${minTurnaroundMinutes}m turnaround`);
        } else {
          // Turnaround buffer absorbed delay
          turnaroundSlack = schedDepM - minTurnaroundReadyM;
        }
      }

      // 2. Check for connection protection hold
      const holdMinutes = connectionHolds.get(f.flight_id);
      if (holdMinutes && holdMinutes > 0) {
        if (schedDepM + holdMinutes > earliestDepM) {
          earliestDepM = schedDepM + holdMinutes;
          delayCauses.push(`Operational connection hold: ${holdMinutes} minutes applied`);
        }
      }

      // 3. Check for airport closure at origin
      let actualDepM = earliestDepM;
      if (isClosureActive && f.origin === scenario.airportId) {
        if (actualDepM >= closureStart && actualDepM < closureEnd) {
          actualDepM = closureEnd;
          delayCauses.push(`Primary delay: Origin airport ${f.origin} closed until ${minutesToTime(closureEnd)}`);
        }
      }

      // 4. Calculate actual arrival time & check destination closure
      const tentativeArrM = actualDepM + blockM;
      let actualArrM = tentativeArrM;

      if (isClosureActive && f.destination === scenario.airportId) {
        if (tentativeArrM >= closureStart && tentativeArrM < closureEnd) {
          // Arrival cannot land during closure; airborne hold or delayed until closure end
          actualArrM = closureEnd;
          delayCauses.push(`Airborne hold/ground delay: Destination ${f.destination} closed until ${minutesToTime(closureEnd)}`);
        }
      }

      const depDelay = Math.max(0, actualDepM - schedDepM);
      const arrDelay = Math.max(0, actualArrM - schedArrM);
      const isDelayed = arrDelay > 0;

      prevActualArrMinutes = actualArrM;

      const simFlight: SimulatedFlight = {
        ...f,
        simulatedDep: minutesToTime(actualDepM),
        simulatedArr: minutesToTime(actualArrM),
        depDelayMinutes: depDelay,
        arrDelayMinutes: arrDelay,
        effectiveTailId: currentTailId,
        isCancelled: false,
        isSpareSubstituted: isSubstituted,
        turnaroundActualMinutes: turnaroundActual,
        turnaroundSlackMinutes: turnaroundSlack,
        isDelayed,
        delayCauses
      };

      simulatedFlightsMap.set(f.flight_id, simFlight);
      simulatedFlightsList.push(simFlight);
    }
  }

  // Evaluate Passenger Connections
  const connectionResults: ConnectionResult[] = networkData.connections.map(cx => {
    const fromF = simulatedFlightsMap.get(cx.from_flight);
    const toF = simulatedFlightsMap.get(cx.to_flight);

    if (!fromF || !toF) {
      throw new Error(`Invalid connection ${cx.connection_id}: referenced flight not found`);
    }

    if (fromF.isCancelled || toF.isCancelled) {
      return {
        connection: cx,
        fromFlight: fromF,
        toFlight: toF,
        actualInboundArr: fromF.simulatedArr,
        actualOutboundDep: toF.simulatedDep,
        actualConnectWindowMinutes: 0,
        minConnectMinutes: cx.min_connect_minutes,
        isBroken: true,
        lostPassengerBookings: cx.passengers,
        slackMinutes: -cx.min_connect_minutes
      };
    }

    const actualInArrM = timeToMinutes(fromF.simulatedArr);
    const actualOutDepM = timeToMinutes(toF.simulatedDep);
    const actualWindow = actualOutDepM - actualInArrM;
    const isBroken = actualWindow < cx.min_connect_minutes;
    const slack = actualWindow - cx.min_connect_minutes;

    return {
      connection: cx,
      fromFlight: fromF,
      toFlight: toF,
      actualInboundArr: fromF.simulatedArr,
      actualOutboundDep: toF.simulatedDep,
      actualConnectWindowMinutes: actualWindow,
      minConnectMinutes: cx.min_connect_minutes,
      isBroken,
      lostPassengerBookings: isBroken ? cx.passengers : 0,
      slackMinutes: slack
    };
  });

  // Evaluate Crew Duties
  const crewResults: CrewResult[] = networkData.crews.map(c => {
    const assignedSimFlights = c.flight_ids
      .map(fid => simulatedFlightsMap.get(fid))
      .filter((sf): sf is SimulatedFlight => !!sf && !sf.isCancelled);

    const schedDutyStartM = timeToMinutes(c.duty_start);

    // Stated scheduled duty end
    const lastSchedFlight = networkData.flights
      .filter(f => c.flight_ids.includes(f.flight_id))
      .sort((a, b) => timeToMinutes(b.arr) - timeToMinutes(a.arr))[0];
    const schedDutyEndM = lastSchedFlight ? timeToMinutes(lastSchedFlight.arr) : schedDutyStartM;
    const schedDutyDuration = schedDutyEndM - schedDutyStartM;

    if (assignedSimFlights.length === 0) {
      return {
        crew: c,
        actualDutyDurationMinutes: 0,
        scheduledDutyDurationMinutes: schedDutyDuration,
        maxDutyMinutes: c.max_duty_mins,
        dutySlackMinutes: c.max_duty_mins,
        isDutyViolated: false,
        assignedFlightsCount: 0,
        lastFlightArrival: c.duty_start,
        terminatesAtBase: true,
        terminationAirport: c.base
      };
    }

    // Sort by actual arrival time
    const sortedActive = [...assignedSimFlights].sort(
      (a, b) => timeToMinutes(b.simulatedArr) - timeToMinutes(a.simulatedArr)
    );
    const lastActiveFlight = sortedActive[0];
    const actualDutyEndM = timeToMinutes(lastActiveFlight.simulatedArr);
    const actualDutyDuration = actualDutyEndM - schedDutyStartM;
    const isViolated = actualDutyDuration > c.max_duty_mins;
    const slack = c.max_duty_mins - actualDutyDuration;

    return {
      crew: c,
      actualDutyDurationMinutes: actualDutyDuration,
      scheduledDutyDurationMinutes: schedDutyDuration,
      maxDutyMinutes: c.max_duty_mins,
      dutySlackMinutes: slack,
      isDutyViolated: isViolated,
      assignedFlightsCount: assignedSimFlights.length,
      lastFlightArrival: lastActiveFlight.simulatedArr,
      terminatesAtBase: lastActiveFlight.destination === c.base,
      terminationAirport: lastActiveFlight.destination
    };
  });

  // Calculate High-Level Operational Metrics
  const nonCancelledFlights = simulatedFlightsList.filter(f => !f.isCancelled);
  const totalFlights = simulatedFlightsList.length;
  const cancelledFlights = simulatedFlightsList.filter(f => f.isCancelled).length;
  const delayedFlights = nonCancelledFlights.filter(f => f.arrDelayMinutes > 15).length;
  const onTimeFlights = nonCancelledFlights.filter(f => f.arrDelayMinutes <= 15).length;
  const totalDelayMinutes = nonCancelledFlights.reduce((acc, f) => acc + f.arrDelayMinutes, 0);
  const averageDelayMinutes = nonCancelledFlights.length > 0 ? Math.round(totalDelayMinutes / nonCancelledFlights.length) : 0;
  const otpPercentage = nonCancelledFlights.length > 0 ? Math.round((onTimeFlights / nonCancelledFlights.length) * 100) : 0;

  const brokenConnectionsCount = connectionResults.filter(c => c.isBroken).length;
  const impactedPassengerBookings = connectionResults.reduce((acc, c) => acc + c.lostPassengerBookings, 0);
  const crewDutyViolationsCount = crewResults.filter(c => c.isDutyViolated).length;
  const maxIndividualDelayMinutes = nonCancelledFlights.reduce((acc, f) => Math.max(acc, f.arrDelayMinutes), 0);
  const sparesDeployedCount = spareSwaps.size;

  const metrics: SimulationMetrics = {
    totalFlights,
    onTimeFlights,
    delayedFlights,
    cancelledFlights,
    totalDelayMinutes,
    averageDelayMinutes,
    otpPercentage,
    brokenConnectionsCount,
    totalConnectionsCount: connectionResults.length,
    impactedPassengerBookings,
    crewDutyViolationsCount,
    maxIndividualDelayMinutes,
    sparesDeployedCount
  };

  return {
    scenario,
    flights: simulatedFlightsList,
    connections: connectionResults,
    crews: crewResults,
    metrics
  };
}
