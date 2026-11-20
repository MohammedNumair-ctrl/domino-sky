import {
  FlightNetworkData,
  DisruptionScenario,
  RecoveryAction,
  SimulationResult
} from '../types';
import { runSimulation } from './engine';

/**
 * Autonomous Recovery Dispatcher for DOMINO SKY
 * Evaluates candidate recovery interventions using deterministic operational heuristics.
 */
export function generateCandidateRecoveryActions(
  networkData: FlightNetworkData,
  disruptedResult: SimulationResult
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];
  const { flights, connections, crews, scenario } = disruptedResult;
  if (!scenario.airportId || scenario.durationMinutes <= 0) {
    return [];
  }

  // 1. Evaluate Spare Aircraft Swaps based on network spare fleet
  const spares = networkData.spare_aircraft || [];
  const blrSpare = spares.find(s => s.base === 'BLR')?.tail_id || 'VT-DS17';
  const delSpare = spares.find(s => s.base === 'DEL')?.tail_id || 'VT-DS18';

  const delayedTails = new Set<string>();
  flights.forEach(f => {
    if (f.arrDelayMinutes >= 25 && !f.isCancelled) {
      delayedTails.add(f.tail_id);
    }
  });

  // Check spare at BLR
  for (const tail of delayedTails) {
    const tailFlights = flights.filter(f => f.tail_id === tail);
    const blrLeg = tailFlights.find(f => f.destination === 'BLR' && f.arrDelayMinutes >= 30);
    if (blrLeg) {
      const nextLeg = tailFlights.find(f => f.leg_order === blrLeg.leg_order + 1);
      if (nextLeg) {
        actions.push({
          id: `spare-blr-${tail}`,
          type: 'spare_swap',
          title: `Deploy Spare ${blrSpare} at BLR for ${tail}`,
          description: `Swap delayed tail ${tail} at BLR from leg ${nextLeg.leg_order} (${nextLeg.flight_id}). Resets downstream rotation delays.`,
          targetId: tail,
          parameters: {
            spareTail: blrSpare,
            swapAirport: 'BLR',
            startLeg: nextLeg.leg_order
          },
          applied: false
        });
      }
    }
  }

  // Check spare at DEL
  for (const tail of delayedTails) {
    const tailFlights = flights.filter(f => f.tail_id === tail);
    const delLeg = tailFlights.find(f => f.destination === 'DEL' && f.arrDelayMinutes >= 30);
    if (delLeg) {
      const nextLeg = tailFlights.find(f => f.leg_order === delLeg.leg_order + 1);
      if (nextLeg) {
        actions.push({
          id: `spare-del-${tail}`,
          type: 'spare_swap',
          title: `Deploy Spare ${delSpare} at DEL for ${tail}`,
          description: `Swap delayed tail ${tail} at DEL from leg ${nextLeg.leg_order} (${nextLeg.flight_id}). Eliminates reactionary delay propagation.`,
          targetId: tail,
          parameters: {
            spareTail: delSpare,
            swapAirport: 'DEL',
            startLeg: nextLeg.leg_order
          },
          applied: false
        });
      }
    }
  }

  // 2. Evaluate Connection Protection Holds
  // For broken connections where a small hold (<= 20m) bridges the MCT gap
  const brokenConns = connections.filter(c => c.isBroken && !c.fromFlight.isCancelled && !c.toFlight.isCancelled);
  for (const c of brokenConns) {
    const deficit = c.minConnectMinutes - c.actualConnectWindowMinutes;
    if (deficit > 0 && deficit <= 20) {
      // Outbound flight can be held
      actions.push({
        id: `hold-${c.connection.connection_id}`,
        type: 'connection_hold',
        title: `Hold ${c.toFlight.flight_id} at ${c.connection.airport} (+${deficit}m)`,
        description: `Protect connection ${c.connection.connection_id} (${c.connection.passengers} connecting passenger bookings) by holding ${c.toFlight.flight_id} by ${deficit} minutes.`,
        targetId: c.toFlight.flight_id,
        parameters: {
          holdMinutes: deficit,
          connectionId: c.connection.connection_id,
          savedPax: c.connection.passengers
        },
        applied: false
      });
    }
  }

  // 3. Crew Protection: Strategic Cancellation of Delayed Out-and-Back
  // If a crew is facing illegal duty (> 600 min), consider cancelling the most delayed leg to rescue the crew
  const violatedCrews = crews.filter(c => c.isDutyViolated);
  for (const vc of violatedCrews) {
    const crewFlights = flights.filter(f => vc.crew.flight_ids.includes(f.flight_id));
    const latestDelayed = [...crewFlights].sort((a, b) => b.arrDelayMinutes - a.arrDelayMinutes)[0];
    if (latestDelayed && latestDelayed.arrDelayMinutes > 45) {
      actions.push({
        id: `cancel-${latestDelayed.flight_id}`,
        type: 'flight_cancel',
        title: `Cancel ${latestDelayed.flight_id} to Rescue Crew ${vc.crew.crew_id}`,
        description: `Cancel ${latestDelayed.flight_id} (${latestDelayed.origin}->${latestDelayed.destination}) to prevent Crew ${vc.crew.crew_id} from exceeding legal duty limit (${vc.actualDutyDurationMinutes}m > 600m).`,
        targetId: latestDelayed.flight_id,
        parameters: {
          crewId: vc.crew.crew_id
        },
        applied: false
      });
    }
  }

  return actions;
}

/**
 * Evaluates candidate recovery actions and recommends the optimal plan.
 */
export function buildOptimalRecoveryPlan(
  networkData: FlightNetworkData,
  scenario: DisruptionScenario,
  candidateActions: RecoveryAction[]
): {
  recommendedActions: RecoveryAction[];
  recoveredResult: SimulationResult;
} {
  const baselineDisrupted = runSimulation(networkData, scenario, []);

  if (candidateActions.length === 0) {
    return {
      recommendedActions: [],
      recoveredResult: baselineDisrupted
    };
  }

  // Score candidate actions
  // Heuristic score: delay reduction + saved connecting pax*2 + rescued crews*200 - cancellation penalty*150
  const evaluated = candidateActions.map(action => {
    const testResult = runSimulation(networkData, scenario, [{ ...action, applied: true }]);
    const delaySaved = baselineDisrupted.metrics.totalDelayMinutes - testResult.metrics.totalDelayMinutes;
    const paxSaved = baselineDisrupted.metrics.impactedPassengerBookings - testResult.metrics.impactedPassengerBookings;
    const crewsRescued = baselineDisrupted.metrics.crewDutyViolationsCount - testResult.metrics.crewDutyViolationsCount;
    const cancellations = testResult.metrics.cancelledFlights;

    const netScore = delaySaved + (paxSaved * 2) + (crewsRescued * 200) - (cancellations * 150);

    return {
      action,
      netScore,
      delaySaved,
      paxSaved,
      crewsRescued
    };
  });

  // Pick positive value actions that don't conflict
  // Sort by netScore descending
  evaluated.sort((a, b) => b.netScore - a.netScore);

  const selectedActions: RecoveryAction[] = [];
  const usedTails = new Set<string>();
  const usedSpares = new Set<string>();
  const heldFlights = new Set<string>();

  for (const item of evaluated) {
    if (item.netScore <= 0) continue;

    if (item.action.type === 'spare_swap') {
      const spareTail = item.action.parameters?.spareTail;
      if (usedTails.has(item.action.targetId) || usedSpares.has(spareTail)) {
        continue;
      }
      usedTails.add(item.action.targetId);
      usedSpares.add(spareTail);
      selectedActions.push({ ...item.action, applied: true });
    } else if (item.action.type === 'connection_hold') {
      if (heldFlights.has(item.action.targetId)) continue;
      heldFlights.add(item.action.targetId);
      selectedActions.push({ ...item.action, applied: true });
    } else if (item.action.type === 'flight_cancel') {
      selectedActions.push({ ...item.action, applied: true });
    }
  }

  const finalRecoveredResult = runSimulation(networkData, scenario, selectedActions);

  // Mark applied status
  const allUpdatedActions = candidateActions.map(a => {
    const isSelected = selectedActions.some(sa => sa.id === a.id);
    return { ...a, applied: isSelected };
  });

  return {
    recommendedActions: allUpdatedActions,
    recoveredResult: finalRecoveredResult
  };
}
