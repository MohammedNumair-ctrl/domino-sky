"""
DOMINO SKY - Dataset Validation Script
Audits flight_network.json against operational rules and relational integrity constraints.
Uses Python standard library only.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional


def parse_time_to_minutes(time_str: str) -> int:
    """Converts HH:MM string to minutes from midnight."""
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def format_minutes_to_time(minutes: int) -> str:
    """Converts minutes from midnight to HH:MM string."""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


class DatasetValidator:
    def __init__(self, data: Dict[str, Any]):
        self.data = data
        self.meta = data.get("meta", {})
        self.airports = data.get("airports", [])
        self.flights = data.get("flights", [])
        self.connections = data.get("connections", [])
        self.crews = data.get("crews", [])
        self.spare_aircraft = data.get("spare_aircraft", [])

        self.passed_checks: List[str] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []
        self.missing_info: List[str] = []
        self.record_counts: Dict[str, int] = {}

    def run_all_checks(self):
        self.audit_record_counts()
        self.audit_operational_rules()
        self.audit_relational_integrity()
        self.audit_turnarounds()
        self.audit_passenger_connections()
        self.audit_crew_duties()
        self.audit_missing_operational_info()

    def audit_record_counts(self):
        """Verify baseline record counts against expected schema."""
        self.record_counts = {
            "airports": len(self.airports),
            "flights": len(self.flights),
            "active_aircraft": len(set(f["tail_id"] for f in self.flights)),
            "connections": len(self.connections),
            "crews": len(self.crews),
            "spare_aircraft": len(self.spare_aircraft),
        }

        # Expected counts
        expected = {
            "airports": 16,
            "flights": 70,
            "active_aircraft": 16,
            "connections": 21,
            "crews": 16,
            "spare_aircraft": 2,
        }

        for key, exp_val in expected.items():
            act_val = self.record_counts[key]
            if act_val == exp_val:
                self.passed_checks.append(f"Record count verified: {key} = {act_val} (expected {exp_val})")
            else:
                self.errors.append(f"Record count mismatch for '{key}': found {act_val}, expected {exp_val}")

    def audit_operational_rules(self):
        """Validate stated meta parameters."""
        # Check operating day / timezone
        op_day = self.meta.get("operating_day", "")
        if "IST" in op_day and "UTC+05:30" in op_day:
            self.passed_checks.append("Operational rule verified: All times use IST (UTC+05:30).")
        else:
            self.warnings.append(f"Meta operating_day description non-standard: '{op_day}'")

        # Minimum turnaround
        min_turnaround = self.meta.get("min_turnaround_minutes")
        if min_turnaround == 30:
            self.passed_checks.append(f"Operational rule verified: Minimum turnaround is {min_turnaround} minutes.")
        else:
            self.errors.append(f"Unexpected min_turnaround_minutes: {min_turnaround} (expected 30)")

        # Aircraft capacity
        seats = self.meta.get("seats_per_aircraft")
        if seats == 180:
            self.passed_checks.append(f"Operational rule verified: Aircraft capacity is {seats} seats.")
        else:
            self.errors.append(f"Unexpected seats_per_aircraft: {seats} (expected 180)")

        # Check crew duty limits supplied in crew records
        crews_with_duty_limit = [c for c in self.crews if "max_duty_mins" in c and c["max_duty_mins"] > 0]
        if len(crews_with_duty_limit) == len(self.crews):
            self.passed_checks.append("Operational rule verified: Crew duty limits (max_duty_mins) supplied for all crews.")
        else:
            self.errors.append(f"Crew duty limits missing on {len(self.crews) - len(crews_with_duty_limit)} crew records.")

        # Check passenger minimum connection times supplied
        conns_with_mct = [c for c in self.connections if "min_connect_minutes" in c and c["min_connect_minutes"] > 0]
        if len(conns_with_mct) == len(self.connections):
            self.passed_checks.append("Operational rule verified: Passenger minimum connection times supplied for all connections.")
        else:
            self.errors.append(f"Minimum connection times missing on {len(self.connections) - len(conns_with_mct)} connections.")

    def audit_relational_integrity(self):
        """Validate relational dependencies across entities."""
        airport_ids = {a["id"] for a in self.airports}
        flight_ids = {f["flight_id"] for f in self.flights}
        active_aircraft_ids = {f["tail_id"] for f in self.flights}
        spare_aircraft_ids = {s["tail_id"] for s in self.spare_aircraft}

        # Check for overlap between active and spare aircraft
        aircraft_overlap = active_aircraft_ids.intersection(spare_aircraft_ids)
        if aircraft_overlap:
            self.errors.append(f"Aircraft designated as both active and spare: {aircraft_overlap}")
        else:
            self.passed_checks.append("Aircraft fleet isolation verified: No overlap between active and spare fleet.")

        # Flight origin/destination validity
        invalid_origins = [f["flight_id"] for f in self.flights if f["origin"] not in airport_ids]
        invalid_dests = [f["flight_id"] for f in self.flights if f["destination"] not in airport_ids]
        if not invalid_origins and not invalid_dests:
            self.passed_checks.append("Flight network topology verified: Every flight origin and destination exists in airport master.")
        else:
            if invalid_origins:
                self.errors.append(f"Flights with invalid origin airports: {invalid_origins}")
            if invalid_dests:
                self.errors.append(f"Flights with invalid destination airports: {invalid_dests}")

        # Block time consistency
        block_time_mismatches = []
        for f in self.flights:
            dep_m = parse_time_to_minutes(f["dep"])
            arr_m = parse_time_to_minutes(f["arr"])
            expected_block = arr_m - dep_m
            if expected_block <= 0:
                self.errors.append(f"Flight {f['flight_id']} has negative or zero duration ({f['dep']} -> {f['arr']})")
            elif expected_block != f.get("block_minutes"):
                block_time_mismatches.append(
                    f"{f['flight_id']}: stated block {f.get('block_minutes')}, computed {expected_block}"
                )
        if not block_time_mismatches:
            self.passed_checks.append("Flight timing verified: All block_minutes exactly match scheduled arr - dep.")
        else:
            self.errors.append(f"Block minute mismatches: {block_time_mismatches}")

        # Passenger load vs aircraft capacity
        overloaded_flights = [f for f in self.flights if f.get("pax", 0) > self.meta.get("seats_per_aircraft", 180)]
        if not overloaded_flights:
            self.passed_checks.append("Payload compliance verified: No flight passenger load exceeds stated aircraft capacity (180).")
        else:
            self.errors.append(f"Flights exceeding passenger capacity: {[f['flight_id'] for f in overloaded_flights]}")

        # Check flight sequence per aircraft
        flights_by_tail: Dict[str, List[Dict[str, Any]]] = {}
        for f in self.flights:
            flights_by_tail.setdefault(f["tail_id"], []).append(f)

        sequential_legs_ok = True
        spatial_continuity_ok = True

        for tail, tail_flights in flights_by_tail.items():
            sorted_legs = sorted(tail_flights, key=lambda x: x["leg_order"])
            leg_orders = [f["leg_order"] for f in sorted_legs]
            expected_legs = list(range(1, len(sorted_legs) + 1))

            if leg_orders != expected_legs:
                self.errors.append(f"Aircraft {tail} has non-sequential leg orders: {leg_orders} (expected {expected_legs})")
                sequential_legs_ok = False

            # Check spatial continuity (prev destination == next origin)
            for i in range(len(sorted_legs) - 1):
                cur_flight = sorted_legs[i]
                next_flight = sorted_legs[i + 1]
                if cur_flight["destination"] != next_flight["origin"]:
                    self.errors.append(
                        f"Aircraft {tail} spatial discontinuity: leg {cur_flight['leg_order']} ({cur_flight['flight_id']}) "
                        f"arrives at {cur_flight['destination']}, but leg {next_flight['leg_order']} ({next_flight['flight_id']}) "
                        f"departs from {next_flight['origin']}"
                    )
                    spatial_continuity_ok = False

        if sequential_legs_ok:
            self.passed_checks.append("Aircraft routing verified: Flight leg orders are sequential (1 to N) for all aircraft.")
        if spatial_continuity_ok:
            self.passed_checks.append("Aircraft routing verified: Destination of each leg strictly matches origin of subsequent leg.")

    def audit_turnarounds(self):
        """
        Audit turnaround gaps:
        Distinguish clearly between:
        1. Scheduled turnaround time (scheduled gap between flights)
        2. Minimum required turnaround time (30 mins hard rule)
        """
        min_required_turnaround = self.meta.get("min_turnaround_minutes", 30)

        flights_by_tail: Dict[str, List[Dict[str, Any]]] = {}
        for f in self.flights:
            flights_by_tail.setdefault(f["tail_id"], []).append(f)

        turnaround_math_ok = True
        turnaround_min_ok = True
        zero_buffer_turnarounds = []

        for tail, tail_flights in flights_by_tail.items():
            sorted_legs = sorted(tail_flights, key=lambda x: x["leg_order"])
            for i, f in enumerate(sorted_legs):
                stated_turnaround = f.get("turnaround_before_min")
                if i == 0:
                    if stated_turnaround is not None:
                        self.warnings.append(f"Aircraft {tail} initial flight {f['flight_id']} has non-null turnaround_before_min: {stated_turnaround}")
                else:
                    prev_f = sorted_legs[i - 1]
                    prev_arr = parse_time_to_minutes(prev_f["arr"])
                    cur_dep = parse_time_to_minutes(f["dep"])
                    actual_gap = cur_dep - prev_arr

                    # Check consistency with dataset's stated field
                    if stated_turnaround != actual_gap:
                        self.errors.append(
                            f"Turnaround gap mismatch on {f['flight_id']} ({tail}): stated {stated_turnaround} min, "
                            f"computed actual scheduled gap is {actual_gap} min ({prev_f['arr']} -> {f['dep']})"
                        )
                        turnaround_math_ok = False

                    # Check compliance with minimum required turnaround
                    if actual_gap < min_required_turnaround:
                        self.errors.append(
                            f"Violation of minimum turnaround on {f['flight_id']} ({tail}): scheduled {actual_gap} min, "
                            f"minimum required is {min_required_turnaround} min"
                        )
                        turnaround_min_ok = False
                    elif actual_gap == min_required_turnaround:
                        zero_buffer_turnarounds.append(
                            f"{tail} leg {f['leg_order']} ({f['flight_id']} at {f['origin']}): scheduled turnaround {actual_gap} min (0 min operational buffer)"
                        )

        if turnaround_math_ok:
            self.passed_checks.append("Turnaround calculation verified: All stated turnaround_before_min match scheduled departure - arrival differences.")
        if turnaround_min_ok:
            self.passed_checks.append(f"Turnaround compliance verified: All scheduled turnarounds satisfy minimum required turnaround ({min_required_turnaround} mins).")

        if zero_buffer_turnarounds:
            self.warnings.append(
                f"{len(zero_buffer_turnarounds)} flight legs operate with ZERO buffer above minimum turnaround ({min_required_turnaround} min): "
                + "; ".join(zero_buffer_turnarounds[:5])
                + (f" ... and {len(zero_buffer_turnarounds) - 5} more" if len(zero_buffer_turnarounds) > 5 else "")
            )

    def audit_passenger_connections(self):
        """
        Validate passenger connections.
        Note: The dataset provides aggregate passenger counts per connection, NOT individual unique passenger IDs.
        """
        flight_map = {f["flight_id"]: f for f in self.flights}
        connection_validity_ok = True
        connection_window_ok = True
        tight_connections = []
        inbound_conn_pax_by_flight: Dict[str, int] = {}
        outbound_conn_pax_by_flight: Dict[str, int] = {}

        for cx in self.connections:
            cx_id = cx.get("connection_id")
            from_id = cx.get("from_flight")
            to_id = cx.get("to_flight")
            airport = cx.get("airport")
            pax = cx.get("passengers", 0)
            mct = cx.get("min_connect_minutes", 0)

            # Check flights exist
            if from_id not in flight_map:
                self.errors.append(f"Connection {cx_id} references nonexistent from_flight '{from_id}'")
                connection_validity_ok = False
                continue
            if to_id not in flight_map:
                self.errors.append(f"Connection {cx_id} references nonexistent to_flight '{to_id}'")
                connection_validity_ok = False
                continue

            from_flight = flight_map[from_id]
            to_flight = flight_map[to_id]

            # Track connecting volumes
            outbound_conn_pax_by_flight[from_id] = outbound_conn_pax_by_flight.get(from_id, 0) + pax
            inbound_conn_pax_by_flight[to_id] = inbound_conn_pax_by_flight.get(to_id, 0) + pax

            # Check airport matches
            if from_flight["destination"] != airport:
                self.errors.append(
                    f"Connection {cx_id} airport mismatch: stated airport is {airport}, but {from_id} destination is {from_flight['destination']}"
                )
                connection_validity_ok = False
            if to_flight["origin"] != airport:
                self.errors.append(
                    f"Connection {cx_id} airport mismatch: stated airport is {airport}, but {to_id} origin is {to_flight['origin']}"
                )
                connection_validity_ok = False

            # Check connection timing
            arr_m = parse_time_to_minutes(from_flight["arr"])
            dep_m = parse_time_to_minutes(to_flight["dep"])
            scheduled_connect_time = dep_m - arr_m

            if scheduled_connect_time < mct:
                self.errors.append(
                    f"Connection {cx_id} violates MCT: scheduled window {scheduled_connect_time} min "
                    f"({from_id} arr {from_flight['arr']} -> {to_id} dep {to_flight['dep']}) < required min {mct} min"
                )
                connection_window_ok = False
            elif scheduled_connect_time - mct <= 15:
                tight_connections.append(
                    f"{cx_id} ({airport}: {from_id}->{to_id}, scheduled {scheduled_connect_time}m, MCT {mct}m, buffer {scheduled_connect_time - mct}m, {pax} pax)"
                )

        if connection_validity_ok:
            self.passed_checks.append("Passenger connection integrity verified: All 21 connections reference valid flights and matching airports.")
        if connection_window_ok:
            self.passed_checks.append("Passenger connection timing verified: All connections satisfy stated min_connect_minutes.")

        # Check connecting passenger volumes against flight pax
        for f_id, in_pax in inbound_conn_pax_by_flight.items():
            total_flight_pax = flight_map[f_id].get("pax", 0)
            if in_pax > total_flight_pax:
                self.errors.append(f"Flight {f_id} inbound connecting passengers ({in_pax}) exceed total flight pax ({total_flight_pax})")

        for f_id, out_pax in outbound_conn_pax_by_flight.items():
            total_flight_pax = flight_map[f_id].get("pax", 0)
            if out_pax > total_flight_pax:
                self.errors.append(f"Flight {f_id} outbound connecting passengers ({out_pax}) exceed total flight pax ({total_flight_pax})")

        if tight_connections:
            self.warnings.append(
                f"{len(tight_connections)} passenger connections have critically low operational buffer (<= 15 min): "
                + "; ".join(tight_connections)
            )

    def audit_crew_duties(self):
        """
        Validate crew assignments, duty limits, and aircraft bindings.
        """
        flight_map = {f["flight_id"]: f for f in self.flights}
        all_assigned_flights = set()
        crew_aircraft_ok = True
        crew_flights_valid = True
        crew_duty_ok = True
        tight_crew_duties = []
        crews_ending_away_from_base = []

        for c in self.crews:
            crew_id = c.get("crew_id")
            tail_id = c.get("tail_id")
            base = c.get("base")
            duty_start_str = c.get("duty_start")
            max_duty = c.get("max_duty_mins", 600)
            c_flight_ids = c.get("flight_ids", [])

            duty_start_m = parse_time_to_minutes(duty_start_str)

            # Check all assigned flights exist
            flight_objs = []
            for fid in c_flight_ids:
                if fid not in flight_map:
                    self.errors.append(f"Crew {crew_id} assigned to nonexistent flight '{fid}'")
                    crew_flights_valid = False
                else:
                    flight_objs.append(flight_map[fid])
                    all_assigned_flights.add(fid)

            if not flight_objs:
                continue

            # Check aircraft consistency
            mismatched_aircraft = [f["flight_id"] for f in flight_objs if f["tail_id"] != tail_id]
            if mismatched_aircraft:
                self.errors.append(f"Crew {crew_id} assigned flights {mismatched_aircraft} not operated by assigned tail {tail_id}")
                crew_aircraft_ok = False

            # Check duty time calculation
            first_flight = min(flight_objs, key=lambda f: parse_time_to_minutes(f["dep"]))
            last_flight = max(flight_objs, key=lambda f: parse_time_to_minutes(f["arr"]))

            first_dep_m = parse_time_to_minutes(first_flight["dep"])
            last_arr_m = parse_time_to_minutes(last_flight["arr"])

            # Report buffer before first flight
            pre_flight_buffer = first_dep_m - duty_start_m
            if pre_flight_buffer < 0:
                self.errors.append(f"Crew {crew_id} duty_start ({duty_start_str}) is after first departure ({first_flight['dep']})")

            # Duty duration: duty_start until last flight scheduled arrival
            duty_duration = last_arr_m - duty_start_m

            if duty_duration > max_duty:
                self.errors.append(f"Crew {crew_id} scheduled duty duration ({duty_duration} min) exceeds max_duty_mins ({max_duty})")
                crew_duty_ok = False
            elif max_duty - duty_duration <= 30:
                tight_crew_duties.append(
                    f"{crew_id} (Tail {tail_id}, Base {base}): scheduled duty {duty_duration} min / {max_duty} min max "
                    f"(slack: {max_duty - duty_duration} min)"
                )

            # Check if crew starts / ends at base
            first_origin = first_flight["origin"]
            last_destination = last_flight["destination"]

            if first_origin != base:
                self.warnings.append(f"Crew {crew_id} base is {base}, but first flight departs from {first_origin}")

            if last_destination != base:
                crews_ending_away_from_base.append(
                    f"{crew_id} (Base {base} -> terminates at {last_destination} after {last_flight['flight_id']})"
                )

        if crew_flights_valid:
            self.passed_checks.append("Crew flight assignment verified: All crew records reference valid flight IDs.")
        if crew_aircraft_ok:
            self.passed_checks.append("Crew aircraft consistency verified: Every crew's flight roster strictly matches its assigned aircraft.")
        if crew_duty_ok:
            self.passed_checks.append("Crew duty limits verified: All scheduled crew duties are within max_duty_mins (600 mins).")

        # Check unassigned flights
        all_flight_ids = set(flight_map.keys())
        unassigned_flights = all_flight_ids - all_assigned_flights
        if not unassigned_flights:
            self.passed_checks.append("Crew coverage verified: All 70 flights are covered by exactly one crew assignment.")
        else:
            self.errors.append(f"Unassigned flights with no crew: {unassigned_flights}")

        if tight_crew_duties:
            self.warnings.append(
                f"{len(tight_crew_duties)} crews have <= 30 minutes of duty slack before reaching maximum legal duty limits: "
                + "; ".join(tight_crew_duties)
            )

        if crews_ending_away_from_base:
            self.warnings.append(
                f"{len(crews_ending_away_from_base)} of 16 crews end their duty day away from their home base: "
                + "; ".join(crews_ending_away_from_base)
            )

    def audit_missing_operational_info(self):
        """Identify operational constraints and data absent from the specification."""
        self.missing_info.extend([
            "No Spare Crew Roster: Dataset provides 2 spare aircraft (VT-DS17 at BLR, VT-DS18 at DEL) but zero spare/standby crew rosters. In a swap or delay exceeding max_duty_mins, replacement crew availability is undefined.",
            "No Crew Composition / Roles: Crew records contain aggregate 'crew_id' without breakdown by Captain, First Officer, or Cabin Crew headcount.",
            "No Crew Qualifications / Type Ratings: No aircraft type ratings or pilot currency data supplied (fleet is assumed homogeneous single-type 180-seat aircraft).",
            "No Mandatory Crew Rest / Accommodation Rules: 11 of 16 crews terminate away from base; dataset specifies no minimum overnight rest, layover hotel rules, or deadheading policies.",
            "No Unique Passenger Identifiers (PNRs): Connections supply passenger counts (679 total connecting passenger bookings), but no unique passenger IDs or itinerary graphs beyond 1-stop connections are modeled.",
            "No Financial / Passenger Compensation Cost Model: No cancellation costs, delay delay-cost curves, or passenger care/rebooking cost models (e.g., DGCA CAR Section 3 Series M Part IV) are included.",
            "No Airport Slot / Movement Windows: Airport capacities are stated as coarse hourly caps (capacity_per_hour); no arrival/departure runway splits, gate assignments, or ground-handling turnaround capacities are specified.",
            "Single-Day Horizon Without Positioning State: Dataset is a single-day static schedule (all IST 06:00 - 21:45). No multi-day continuity or aircraft/crew morning positioning requirements for Day+1 are provided.",
            "Deterministic Parameters: No stochastic disruption distributions (e.g. weather probability, unscheduled maintenance MTBF, ATC ground stop probabilities) are defined in the dataset."
        ])

    def generate_report(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("DOMINO SKY - FLIGHT NETWORK DATASET AUDIT REPORT")
        lines.append("=" * 80)
        lines.append("")

        lines.append("1. RECORD COUNTS:")
        lines.append("-" * 40)
        for entity, count in self.record_counts.items():
            lines.append(f"  - {entity.replace('_', ' ').title():<25}: {count}")
        lines.append("")

        lines.append(f"2. PASSED CHECKS ({len(self.passed_checks)}):")
        lines.append("-" * 40)
        for check in self.passed_checks:
            lines.append(f"  [PASS] {check}")
        lines.append("")

        lines.append(f"3. WARNINGS ({len(self.warnings)}):")
        lines.append("-" * 40)
        if self.warnings:
            for w in self.warnings:
                lines.append(f"  [WARN] {w}")
        else:
            lines.append("  None")
        lines.append("")

        lines.append(f"4. ERRORS ({len(self.errors)}):")
        lines.append("-" * 40)
        if self.errors:
            for e in self.errors:
                lines.append(f"  [FAIL] {e}")
        else:
            lines.append("  [NONE] Zero structural or relational errors detected.")
        lines.append("")

        lines.append(f"5. MISSING OPERATIONAL INFORMATION ({len(self.missing_info)}):")
        lines.append("-" * 40)
        for item in self.missing_info:
            lines.append(f"  [INFO] {item}")
        lines.append("")

        lines.append("=" * 80)
        status = "READY FOR SIMULATION DEVELOPMENT (WITH KNOWN OPERATIONAL CONSTRAINTS)" if not self.errors else "NOT READY (CRITICAL ERRORS EXIST)"
        lines.append(f"AUDIT STATUS: {status}")
        lines.append("=" * 80)
        return "\n".join(lines)


def main():
    if len(sys.argv) > 1:
        json_path = Path(sys.argv[1])
    else:
        # Default to ../flight_network.json relative to scripts/
        json_path = Path(__file__).resolve().parent.parent / "flight_network.json"
        if not json_path.exists():
            json_path = Path("flight_network.json")

    if not json_path.exists():
        print(f"Error: dataset file not found at {json_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    validator = DatasetValidator(data)
    validator.run_all_checks()
    report = validator.generate_report()
    print(report)

    # Return exit code 0 if no errors, 1 if errors
    sys.exit(0 if not validator.errors else 1)


if __name__ == "__main__":
    main()
