# DOMINO SKY — Dataset Audit & Specification Verification

**Target File:** `flight_network.json`  
**Audit Executed:** Standard Library Python Validator (`scripts/validate_dataset.py`)  
**Operating Reference Time:** Single Day, Indian Standard Time (IST / UTC+05:30)  
**Audit Status:** **READY FOR SIMULATION DEVELOPMENT** (Subject to documented operational boundary assumptions)

---

## 1. Executive Summary

A comprehensive relational integrity and operational rule audit of `flight_network.json` was conducted. The dataset provides a clean, well-formed, single-day domestic flight network representing an Indian commercial carrier operating a single-type fleet of 180-seat narrowbody aircraft.

### Primary Audit Verdict
- **Structural & Relational Errors:** **0 (Zero)**
- **Passed Integrity Checks:** **25 / 25**
- **Operational Warnings:** **4** (highlighting cascading delay risks, tight crew buffers, and base layovers)
- **Missing Operational Dimensions:** **9** (operational parameters not supplied by the dataset that must be defined via explicit model assumptions in the simulation engine)

The dataset is **fully ready for simulation development**.

---

## 2. Record Counts & Baseline Verification

Every primary entity was verified against the competition specification:

| Entity | Required Count | Audited Count | Status | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Airports** | 16 | 16 | **PASS** | 4 Mega Hubs (DEL, BOM, BLR, HYD), 4 Regional Hubs (MAA, CCU, AMD, COK), 8 Spokes (GOI, PNQ, JAI, GAU, LKO, IXC, BBI, TRV) |
| **Flights** | 70 | 70 | **PASS** | Scheduled across 16 tails; 4 to 5 legs per aircraft; earliest departure 06:00 IST, latest arrival 21:45 IST |
| **Active Aircraft** | 16 | 16 | **PASS** | Tails `VT-DS01` through `VT-DS16` (distinct active airframes) |
| **Passenger Connections** | 21 | 21 | **PASS** | `CX01` through `CX21` across 6 interchange hubs (DEL, BOM, BLR, HYD, MAA, CCU) |
| **Crew Assignments** | 16 | 16 | **PASS** | `CR01` through `CR16`; 1:1 dedicated assignment to tails `VT-DS01` through `VT-DS16` |
| **Spare Aircraft** | 2 | 2 | **PASS** | `VT-DS17` (based at BLR) and `VT-DS18` (based at DEL), both available from 05:00 IST with 180 seats |

---

## 3. Relational Integrity & Topology Validation

The audit checked all cross-entity dependencies and relational constraints:

### 3.1 Network Topology & Airport Validity
- **Check:** Every flight origin and destination must exist in the airport registry.
- **Result:** **PASS**. All 140 endpoints across the 70 flights map to one of the 16 declared airport IDs. No orphan airport references exist.

### 3.2 Aircraft Fleet Binding & Isolation
- **Check:** Every flight references an active aircraft; active and spare fleets do not overlap.
- **Result:** **PASS**. All 70 flights reference `VT-DS01` through `VT-DS16`. Spare aircraft `VT-DS17` and `VT-DS18` are strictly isolated from the baseline published schedule.

### 3.3 Flight Sequence & Spatial Continuity
- **Check:** Flight leg orders must be sequential ($1, 2, \dots, N$) per aircraft, and the destination of leg $i$ must match the origin of leg $i+1$.
- **Result:** **PASS**.
  - All 16 aircraft have consecutive leg orders without gaps or duplicates (10 aircraft fly 4 legs, 6 aircraft fly 5 legs).
  - Spatial continuity holds 100%: no aircraft magically teleports between airports.
  - Initial origins and final arrival airports per tail:
    - `VT-DS01`: DEL $\rightarrow$ IXC (5 legs)
    - `VT-DS02`: DEL $\rightarrow$ GOI (4 legs)
    - `VT-DS03`: DEL $\rightarrow$ CCU (4 legs)
    - `VT-DS04`: BOM $\rightarrow$ AMD (5 legs)
    - `VT-DS05`: BOM $\rightarrow$ MAA (4 legs)
    - `VT-DS06`: BLR $\rightarrow$ TRV (5 legs)
    - `VT-DS07`: HYD $\rightarrow$ HYD (4 legs — round-trip loop)
    - `VT-DS08`: HYD $\rightarrow$ BBI (5 legs)
    - `VT-DS09`: DEL $\rightarrow$ DEL (4 legs — round-trip loop)
    - `VT-DS10`: CCU $\rightarrow$ LKO (5 legs)
    - `VT-DS11`: CCU $\rightarrow$ GAU (4 legs)
    - `VT-DS12`: AMD $\rightarrow$ AMD (4 legs — round-trip loop)
    - `VT-DS13`: COK $\rightarrow$ BLR (5 legs)
    - `VT-DS14`: TRV $\rightarrow$ TRV (4 legs — round-trip loop)
    - `VT-DS15`: PNQ $\rightarrow$ DEL (4 legs)
    - `VT-DS16`: GOI $\rightarrow$ GOI (4 legs — round-trip loop)

### 3.4 Flight Block Times & Duration
- **Check:** Stated `block_minutes` must equal $\text{arr} - \text{dep}$ in scheduled minutes.
- **Result:** **PASS**. All 70 flights have positive flight durations, and every stated `block_minutes` perfectly matches the scheduled difference. No flight crosses midnight.

### 3.5 Passenger Loads vs. Aircraft Capacity
- **Check:** No flight passenger load (`pax`) may exceed the stated aircraft capacity of 180 seats.
- **Result:** **PASS**.
  - Minimum flight load: 113 passengers (flight `DS0902` IXC $\rightarrow$ DEL, load factor 62.8%).
  - Maximum flight load: 173 passengers (flight `DS0701` HYD $\rightarrow$ BOM, load factor 96.1%).
  - Average load across all 70 flights: 149.8 passengers (average load factor 83.2%).
  - Total passenger-legs booked: 10,486.

### 3.6 Passenger Connection Validity & Endpoints
- **Check:** Every connection references existing flights, and the connection airport matches `from_flight.destination` and `to_flight.origin`.
- **Result:** **PASS**. All 21 connections reference valid flights and physically match the transfer airport.
- **Connection Passenger Volume vs. Flight Capacity:**
  - On every flight, total inbound connecting passengers $\le \text{flight pax}$.
  - On every flight, total outbound connecting passengers $\le \text{flight pax}$.
  - Peak inbound transfer: `DS0504` receives 76 connecting passengers (31 from `DS0703` via `CX11`, 45 from `DS0801` via `CX12`) out of 165 total passengers.
  - Peak outbound transfer: `DS0701` transfers 88 connecting passengers (42 to `DS1502` via `CX03`, 46 to `DS0202` via `CX04`) out of 173 total passengers.

### 3.7 Crew Assignment Validity & Aircraft Binding
- **Check:** Every crew references valid flights, and assigned flights strictly match the crew's assigned aircraft.
- **Result:** **PASS**.
  - All 16 crew records map 1:1 to `VT-DS01` through `VT-DS16`.
  - Exactly 70 out of 70 flights are covered. No flight is uncrewed; no flight is crewed by more than one crew.
  - No crew is scheduled to switch aircraft mid-day.

---

## 4. Operational Rules & Critical Buffer Analysis

### 4.1 Scheduled Turnaround vs. Minimum Required Turnaround
A core operational distinction must be observed between:
1. **Scheduled Turnaround Time:** The timetable difference between an aircraft's scheduled departure and its preceding arrival at the same station ($\text{dep}_{i+1} - \text{arr}_i$).
2. **Minimum Required Turnaround Time (`min_turnaround_minutes` = 30):** The hard physical constraint required for deplaning, cabin servicing, refueling, catering, baggage unloading/loading, and boarding.
3. **Turnaround Buffer / Operational Slack:**
   $$\text{Buffer} = \text{Scheduled Turnaround} - \text{Minimum Required Turnaround}$$

#### Audit Findings:
- Every scheduled turnaround satisfies $\ge 30$ minutes.
- **Zero-Buffer High-Risk Flights:** Exactly **7 legs** have a scheduled turnaround of **exactly 30 minutes (0 minutes buffer)**:
  1. `VT-DS04`, Leg 2 (`DS0402` at GOI): Arr 08:50, Dep 09:20 (30 min)
  2. `VT-DS05`, Leg 4 (`DS0504` at BLR): Arr 14:15, Dep 14:45 (30 min)
  3. `VT-DS06`, Leg 4 (`DS0604` at BLR): Arr 10:35, Dep 11:05 (30 min)
  4. `VT-DS07`, Leg 4 (`DS0704` at BLR): Arr 12:55, Dep 13:25 (30 min)
  5. `VT-DS12`, Leg 2 (`DS1202` at BOM): Arr 07:40, Dep 08:10 (30 min)
  6. `VT-DS13`, Leg 4 (`DS1304` at COK): Arr 11:10, Dep 11:40 (30 min)
  7. `VT-DS14`, Leg 3 (`DS1403` at HYD): Arr 17:05, Dep 17:35 (30 min)

> [!WARNING]
> **Cascading Delay Propagation:** Any primary delay on the inbound leg of these 7 flights translates minute-for-minute into a secondary reactionary delay on the subsequent departure because there is zero operational buffer to absorb delays.

---

### 4.2 Passenger Connection Windows & Misconnection Risk

#### Regulatory & Dataset Constraint:
A connection is valid if:
$$\text{Scheduled Connection Window} = \text{to\_flight.dep} - \text{from\_flight.arr} \ge \text{min\_connect\_minutes}$$

All 21 connections satisfy this rule. However, several connections possess very thin operational buffers:

| Connection ID | Hub | Inbound Flight | Outbound Flight | Scheduled Window | Stated MCT | Buffer | Passenger Count |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CX14** | **DEL** | DS1101 (arr 14:25) | DS0105 (dep 15:15) | 50 min | 45 min | **5 min** | 20 pax |
| **CX03** | **BOM** | DS0701 (arr 07:55) | DS1502 (dep 08:50) | 55 min | 45 min | **10 min** | 42 pax |
| **CX13** | **DEL** | DS0104 (arr 14:10) | DS1102 (dep 15:05) | 55 min | 45 min | **10 min** | 37 pax |
| **CX20** | **HYD** | DS1402 (arr 17:05) | DS1603 (dep 18:00) | 55 min | 45 min | **10 min** | 19 pax |
| **CX05** | **BOM** | DS0201 (arr 08:10) | DS0702 (dep 09:10) | 60 min | 45 min | **15 min** | 30 pax |

> [!IMPORTANT]
> **Passenger Identification Nuance:**  
> The dataset provides passenger volumes for each connection record (totaling 679 connecting passenger bookings across 21 connections). **Do not claim unique passenger counts**, as individual Passenger Name Records (PNRs) or unique passenger IDs are not supplied. A connecting passenger occupies seats on two flight legs; therefore, these counts represent booked itinerary legs.

---

### 4.3 Crew Duty Limits & Rostering Vulnerabilities

#### Operational Rule:
According to `meta.notes`:
$$\text{Crew Duty Duration} = \text{Last Flight Scheduled Arrival} - \text{duty\_start} \le \text{max\_duty\_mins}\ (600\text{ min} = 10\text{ hours})$$

All 16 crews report on duty **exactly 45 minutes** prior to their first flight departure.

#### Duty Slack Analysis:
All 16 crews comply with the 600-minute maximum duty limit in the published schedule. However, 3 crews have dangerously small duty buffers:

| Crew ID | Assigned Tail | Base Station | Duty Start | Last Leg Arrival | Scheduled Duty | Max Duty | Duty Slack | High-Risk Flight |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CR03** | VT-DS03 | DEL | 11:30 | 21:20 (DS0304) | 590 min | 600 min | **10 min** | `DS0304` (DEL $\rightarrow$ CCU) |
| **CR08** | VT-DS08 | HYD | 11:45 | 21:25 (DS0805) | 580 min | 600 min | **20 min** | `DS0805` (HYD $\rightarrow$ BBI) |
| **CR10** | VT-DS10 | CCU | 12:15 | 21:45 (DS1005) | 570 min | 600 min | **30 min** | `DS1005` (CCU $\rightarrow$ LKO) |

> [!CAUTION]
> **Crew Duty Timeout (FDP Exceeded):** For `CR03`, an accumulated delay of just **11 minutes** across legs `DS0301`, `DS0302`, `DS0303`, or `DS0304` makes the flight legally unoperable without a crew replacement.

#### Overnight Layover & Base Asymmetry:
- **Only 5 crews** end their duty at their home base (`CR07` at HYD, `CR09` at DEL, `CR12` at AMD, `CR14` at TRV, `CR16` at GOI).
- **11 of 16 crews** finish their final leg at an outstation away from their home base.
- Similarly, 11 of 16 aircraft terminate the day away from their initial departure airport.

---

## 5. Missing Operational Information

The validator identified 9 operational parameters that are **absent** from `flight_network.json`. Simulation developers must not invent ad-hoc rules without documenting these assumptions:

1. **No Spare / Standby Crew Rosters:**
   - The dataset provides 2 spare aircraft (`VT-DS17` at BLR, `VT-DS18` at DEL) but **zero** spare crew pairings or standby crews.
   - If an aircraft is substituted or a crew times out on duty, the mechanism to crew the spare aircraft is undefined.
2. **No Crew Breakdown or Crew Composition:**
   - Crews are defined as monolithic entities (`crew_id`); there is no breakdown into Captain, First Officer, and Cabin Crew headcount.
3. **No Pilot Qualifications or Type Ratings:**
   - No license or currency restrictions are provided (fleet is implicitly assumed homogeneous A320/B737-family single type).
4. **No Mandatory Rest / Layover Accommodation Rules:**
   - No minimum crew rest period (e.g., 10 or 12 hours) between duty periods or outstation hotel logistics are specified.
5. **No Unique Passenger Identifiers (PNRs):**
   - Individual itineraries, multi-segment trips beyond 1 stop, and non-connecting passenger origins/destinations are not tracked.
6. **No Financial Cost Functions or Compensation Regulations:**
   - No delay cost curves, passenger care/meal expenses, hotel costs, or statutory passenger cancellation compensation formulas (e.g., DGCA CAR Section 3 Series M Part IV) are provided.
7. **No Runway Slot / Gate Assignment Granularity:**
   - Airport capacity is given as a single coarse integer (`capacity_per_hour`). No separation between arrival vs. departure slots, gate availability, or ground handler capacities is specified.
8. **Single-Day Scope Without Next-Day Positioning Requirements:**
   - The dataset ends at 21:45 IST on Day 1. There are no penalty terms for aircraft ending out of position for Day 2 schedule commitments.
9. **No Disruption Probability Distributions:**
   - Weather delays, unscheduled mechanical failures (AOG), and ATC flow management programs are not parameterized; scenario generators must supply these.

---

## 6. Validator Execution Output

The Python standard-library validator script was executed directly against `flight_network.json`. The verbatim output is recorded below:

```text
================================================================================
DOMINO SKY - FLIGHT NETWORK DATASET AUDIT REPORT
================================================================================

1. RECORD COUNTS:
----------------------------------------
  - Airports                 : 16
  - Flights                  : 70
  - Active Aircraft          : 16
  - Connections              : 21
  - Crews                    : 16
  - Spare Aircraft           : 2

2. PASSED CHECKS (25):
----------------------------------------
  [PASS] Record count verified: airports = 16 (expected 16)
  [PASS] Record count verified: flights = 70 (expected 70)
  [PASS] Record count verified: active_aircraft = 16 (expected 16)
  [PASS] Record count verified: connections = 21 (expected 21)
  [PASS] Record count verified: crews = 16 (expected 16)
  [PASS] Record count verified: spare_aircraft = 2 (expected 2)
  [PASS] Operational rule verified: All times use IST (UTC+05:30).
  [PASS] Operational rule verified: Minimum turnaround is 30 minutes.
  [PASS] Operational rule verified: Aircraft capacity is 180 seats.
  [PASS] Operational rule verified: Crew duty limits (max_duty_mins) supplied for all crews.
  [PASS] Operational rule verified: Passenger minimum connection times supplied for all connections.
  [PASS] Aircraft fleet isolation verified: No overlap between active and spare fleet.
  [PASS] Flight network topology verified: Every flight origin and destination exists in airport master.
  [PASS] Flight timing verified: All block_minutes exactly match scheduled arr - dep.
  [PASS] Payload compliance verified: No flight passenger load exceeds stated aircraft capacity (180).
  [PASS] Aircraft routing verified: Flight leg orders are sequential (1 to N) for all aircraft.
  [PASS] Aircraft routing verified: Destination of each leg strictly matches origin of subsequent leg.
  [PASS] Turnaround calculation verified: All stated turnaround_before_min match scheduled departure - arrival differences.
  [PASS] Turnaround compliance verified: All scheduled turnarounds satisfy minimum required turnaround (30 mins).
  [PASS] Passenger connection integrity verified: All 21 connections reference valid flights and matching airports.
  [PASS] Passenger connection timing verified: All connections satisfy stated min_connect_minutes.
  [PASS] Crew flight assignment verified: All crew records reference valid flight IDs.
  [PASS] Crew aircraft consistency verified: Every crew's flight roster strictly matches its assigned aircraft.
  [PASS] Crew duty limits verified: All scheduled crew duties are within max_duty_mins (600 mins).
  [PASS] Crew coverage verified: All 70 flights are covered by exactly one crew assignment.

3. WARNINGS (4):
----------------------------------------
  [WARN] 7 flight legs operate with ZERO buffer above minimum turnaround (30 min): VT-DS04 leg 2 (DS0402 at GOI): scheduled turnaround 30 min (0 min operational buffer); VT-DS05 leg 4 (DS0504 at BLR): scheduled turnaround 30 min (0 min operational buffer); VT-DS06 leg 4 (DS0604 at MAA): scheduled turnaround 30 min (0 min operational buffer); VT-DS07 leg 4 (DS0704 at BLR): scheduled turnaround 30 min (0 min operational buffer); VT-DS12 leg 2 (DS1202 at BOM): scheduled turnaround 30 min (0 min operational buffer) ... and 2 more
  [WARN] 5 passenger connections have critically low operational buffer (<= 15 min): CX03 (BOM: DS0701->DS1502, scheduled 55m, MCT 45m, buffer 10m, 42 pax); CX05 (BOM: DS0201->DS0702, scheduled 60m, MCT 45m, buffer 15m, 30 pax); CX13 (DEL: DS0104->DS1102, scheduled 55m, MCT 45m, buffer 10m, 37 pax); CX14 (DEL: DS1101->DS0105, scheduled 50m, MCT 45m, buffer 5m, 20 pax); CX20 (HYD: DS1402->DS1603, scheduled 55m, MCT 45m, buffer 10m, 19 pax)
  [WARN] 3 crews have <= 30 minutes of duty slack before reaching maximum legal duty limits: CR03 (Tail VT-DS03, Base DEL): scheduled duty 590 min / 600 min max (slack: 10 min); CR08 (Tail VT-DS08, Base HYD): scheduled duty 580 min / 600 min max (slack: 20 min); CR10 (Tail VT-DS10, Base CCU): scheduled duty 570 min / 600 min max (slack: 30 min)
  [WARN] 11 of 16 crews end their duty day away from their home base: CR01 (Base DEL -> terminates at IXC after DS0105); CR02 (Base DEL -> terminates at GOI after DS0204); CR03 (Base DEL -> terminates at CCU after DS0304); CR04 (Base BOM -> terminates at AMD after DS0405); CR05 (Base BOM -> terminates at MAA after DS0504); CR06 (Base BLR -> terminates at TRV after DS0605); CR08 (Base HYD -> terminates at BBI after DS0805); CR10 (Base CCU -> terminates at LKO after DS1005); CR11 (Base CCU -> terminates at GAU after DS1104); CR13 (Base COK -> terminates at BLR after DS1305); CR15 (Base PNQ -> terminates at DEL after DS1504)

4. ERRORS (0):
----------------------------------------
  [NONE] Zero structural or relational errors detected.

5. MISSING OPERATIONAL INFORMATION (9):
----------------------------------------
  [INFO] No Spare Crew Roster: Dataset provides 2 spare aircraft (VT-DS17 at BLR, VT-DS18 at DEL) but zero spare/standby crew rosters. In a swap or delay exceeding max_duty_mins, replacement crew availability is undefined.
  [INFO] No Crew Composition / Roles: Crew records contain aggregate 'crew_id' without breakdown by Captain, First Officer, or Cabin Crew headcount.
  [INFO] No Crew Qualifications / Type Ratings: No aircraft type ratings or pilot currency data supplied (fleet is assumed homogeneous single-type 180-seat aircraft).
  [INFO] No Mandatory Crew Rest / Accommodation Rules: 11 of 16 crews terminate away from base; dataset specifies no minimum overnight rest, layover hotel rules, or deadheading policies.
  [INFO] No Unique Passenger Identifiers (PNRs): Connections supply passenger counts (679 total connecting passenger bookings), but no unique passenger IDs or itinerary graphs beyond 1-stop connections are modeled.
  [INFO] No Financial / Passenger Compensation Cost Model: No cancellation costs, delay delay-cost curves, or passenger care/rebooking cost models (e.g., DGCA CAR Section 3 Series M Part IV) are included.
  [INFO] No Airport Slot / Movement Windows: Airport capacities are stated as coarse hourly caps (capacity_per_hour); no arrival/departure runway splits, gate assignments, or ground-handling turnaround capacities are specified.
  [INFO] Single-Day Horizon Without Positioning State: Dataset is a single-day static schedule (all IST 06:00 - 21:45). No multi-day continuity or aircraft/crew morning positioning requirements for Day+1 are provided.
  [INFO] Deterministic Parameters: No stochastic disruption distributions (e.g. weather probability, unscheduled maintenance MTBF, ATC ground stop probabilities) are defined in the dataset.

================================================================================
AUDIT STATUS: READY FOR SIMULATION DEVELOPMENT (WITH KNOWN OPERATIONAL CONSTRAINTS)
================================================================================
```

---

## 7. Recommendations for Simulation Engine Architecture

When implementing the recovery and disruption simulation core, the following model policies are recommended:

1. **Decouple Scheduled vs. Minimum Turnaround:**
   - The engine must advance flight departure to $\max(\text{scheduled\_dep}, \text{actual\_arr} + 30\text{ min})$. The 30-minute parameter represents a hard physical lower bound, whereas any scheduled gap above 30 minutes acts as an operational buffer that can absorb inbound delays without propagating them downstream.
2. **Connection Protection Logic:**
   - The engine should check connection feasibility: $\text{to\_flight.actual\_dep} - \text{from\_flight.actual\_arr} \ge \text{min\_connect\_minutes}$. If violated, the simulator can either hold the departure flight (up to a configurable maximum hold time) or break the connection and mark passengers as misconnected.
3. **Crew Timeout & Aircraft Swapping:**
   - If `actual_arrival` of a crew's final leg would exceed $\text{duty\_start} + \text{max\_duty\_mins}$, flag a hard crew timeout violation.
   - For spare aircraft (`VT-DS17` at BLR and `VT-DS18` at DEL), define a clear rule for crew assignment (e.g., original crew transitions to spare aircraft, provided their remaining duty window is sufficient).
4. **Preserve Raw Dataset Integrity:**
   - Keep `flight_network.json` immutable. All simulation runs, state transitions, and recovery interventions should operate on in-memory representations or versioned simulation state snapshots.
