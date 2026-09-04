# Westminster Underground Station — Reference Dossier for the Three.js Reconstruction

**Purpose.** This is the single document the 3D builders read instead of the internet. It merges five research angles (architecture, rolling stock, audio, street level, signage) into one organised reference. Every concrete number, every exact announcement wording, every colour hex and every sign wording from the raw research is retained here. Where researchers disagreed, both versions are recorded and a preferred version is stated with the reason.

**Confidence tags.** Every fact carries one of: `[verified]` (checked against an online source during research — Wikipedia, ICE/ISSMGE papers, Hopkins Architects, TfL Unified API, OpenStreetMap/Overpass, Wikimedia Commons photographs, TfL graphics standards, YouTube recordings/descriptions), `[memory]` (a researcher's recollection, with high/medium noted where given), or `[estimate]` (derived, inferred or approximated). Treat `[estimate]` numbers as starting values to be tuned against reference photographs.

**Compiled:** 4 September 2026. Research sources are cited inline in abbreviated form (describe-online = Terry Robinson's 2005/2008 accessibility survey of the station, mirrored at mindspace.fi; ISSMGE 1996 = Carter, Bailey & Dawson, *Jubilee Line extension, Westminster Station design*, Balkema 1996; TfL API = api.tfl.gov.uk StopPoint 940GZZLUWSM; OSM = OpenStreetMap via Overpass).

**Scene coordinate convention (recommended by the street researcher).** Origin = the main Bridge Street station entrance in the base of Portcullis House at 51.50106 N, 0.12489 W (OSM subway_entrance node 10671686470, wheelchair=yes). Three.js axes: +X = east, +Z = south, Y up; true north is therefore −Z. All metre offsets in this document were computed from OSM coordinates using 1° lat = 111,200 m and 1° lon = 69,300 m at 51.5° N. `[verified]` for the coordinates, `[estimate]` ±3 m for the derived offsets.

---

## 1. Overview & history

### 1.1 Timeline

| Date | Event | Confidence |
|---|---|---|
| 24 Dec 1868 | Opened as **'Westminster Bridge'** by the steam-worked (Metropolitan) District Railway, eastern terminus of its first section from South Kensington. Built cut-and-cover, with a temporary street building and individual platform awnings rather than a glazed overall roof. Bridge Street and Parliament Square were laid out in the same year to open up the Palace surroundings. | [verified] |
| 1907 | Renamed **'Westminster'**. | [verified] |
| 1920s | Holden-era green/blue/black/white platform tiling installed (now entirely gone after the 1999 rebuild). | [verified] existence; [memory] colours |
| 1922 | New Bridge Street entrance canopy. | [verified] |
| 1962–64 | Platforms lengthened for 8-car trains, extended at their EAST ends under the old New Scotland Yard. | [verified] |
| 1993 | JLE Contract 102 let (Green Park–Waterloo running tunnels plus Westminster and Waterloo stations, c. £100m) to a Balfour Beatty / AMEC joint venture. O&K win the whole-JLE escalator contract (£54m). Portcullis House design published; demolition of the previous buildings 1994. | [verified] |
| Nov 1994 – Nov 1997 | Box excavation and tunnelling. Compensation grouting under the Elizabeth Tower on 22 occasions, Jan 1996 – Sep 1997. | [verified] |
| 1998 | Portcullis House above-ground construction begins. | [verified] |
| Nov 1999 | Jubilee trains run through Westminster non-stop. | [verified] |
| **22 Dec 1999** | Jubilee platforms open — the last JLE station to open, 131 years after the original. First platform-edge doors on a commercial railway in Great Britain. | [verified] |
| Feb 2001 | Portcullis House opens (Hopkins list completion 2000). Cost rose to c. £235m. | [verified] |
| 2005 | Seventh car added to 1996 Stock; PED signage and software modified for it. | [verified] |
| 2011 | Jubilee line converted to ATO (Thales SelTrac S40). | [verified] |
| 2015 | TfL ticket offices closed (Westminster's ticket windows now blank/converted). | [verified] |
| 2017–19 | 1996 Stock interior refresh (off-white panels, silver-grey poles, dark grooved floors). | [verified] |
| 22 Mar 2017 | Westminster attack; permanent hostile-vehicle barriers subsequently installed on Westminster Bridge and around the Palace. | [verified] event; [memory] barrier design |
| 2017–22 | Elizabeth Tower restoration; regular chiming resumed 11 Nov 2022. | [verified] |
| 2024 | Larry Achiampong roundel artwork installed (Mark Wallinger's *Labyrinth* also present). | [verified] |

### 1.2 Design and engineering credits `[verified]`

- **Architect** (station and Portcullis House): Michael Hopkins & Partners (now Hopkins Architects). JLE Architect-in-Charge: Roland Paoletti. Hopkins' project architect quoted: Andy Barnett — *'Weaving the structure of this heavyweight building above us … with this structure beneath, it was an amazing challenge.'*
- **Station box structural/geotechnical engineer:** G. Maunsell & Partners (Carter, Bailey, Dawson 1996; Bailey, Harris, Jenkins ICE 1999). Prof John Burland (Imperial College) advised on Big Ben.
- **Portcullis House structural engineer:** Ove Arup & Partners.
- **Main contractor:** Balfour Beatty / AMEC JV (JLE Contract 102).
- **Lighting designer:** George Sexton.
- **Escalators:** O&K (Orenstein & Koppel), now maintained by Kone.
- **Platform edge doors:** Westinghouse Brakes / Westinghouse Platform Screen Doors (industrial design DCA Design), now maintained 24/7 by Knorr-Bremse; 40-year design life.
- **Stainless-steel Suregrip flooring:** Wincro — 60 t of laser-cut, electropolished panels.
- **Awards:** RIBA Award 2001; Stirling Prize shortlist 2001 (jointly with Portcullis House); Civic Trust 2000 and 2002; RFAC Millennium Building of the Year 2000; Concrete Society Award; British Construction Industry Award.

### 1.3 Official facility counts (TfL Unified API, StopPoint 940GZZLUWSM) `[verified]`

Westminster Underground Station, Bridge Street, London SW1A 2JR, Zone 1. Lines: Circle, District, Jubilee. Station centroid 51.50132 N, 0.124861 W. **17 escalators, 5 lifts, 1 ticket hall, 15 ticket gates, 4 payphones, 4 cash machines (Euro-capable), WiFi yes, toilets no (inside the gateline — public toilets exist in the Whitehall subway, see §2.5), waiting room no, photo booths 0, boarding ramps 'yes — Circle and District lines only', help points listed as 0 (a data quirk; help points exist, see §12.9), 'subway to street, routeways platform to ticket hall'.** API platform points: Platform 1 Circle/District at 51.501284, −0.124877; Platform 2 Circle/District at 51.501185, −0.124838; Platform 3 Jubilee (the API omits Platform 4). Passenger numbers c. 20 million a year `[estimate]`.

### 1.4 Big Ben protection (why the structure looks the way it does) `[verified]`

The Elizabeth Tower's 3 m thick foundation is only **34 m (112 ft)** from the edge of the 39 m deep box — 'at a distance approximately equal to the excavation depth'. Uncontrolled ground movement was predicted at up to **120 mm**; compensation grouting through **50 m long horizontal steel tubes-à-manchette at c. 16 m depth** beneath the foundation (grout injected on **22 occasions, Jan 1996 – Sep 1997**; over 38 km of tubes were installed in the Waterloo/Westminster areas) limited tower movement to **35 mm**; differential settlement across the foundation was c. **5 mm**. Cross-wall tunnelled struts (c. 2 m diameter hand-dug tunnels filled with concrete, jack-equipped) were installed below base-slab level to limit wall deflection towards the tower. The stacked Jubilee platform arrangement (§3) was itself chosen to keep the tunnels as far as possible from the tower and minimise footprint/vibration under the Palace; the original concept (side-by-side tunnels reached by inclined shafts and a tunnelled concourse) was abandoned in favour of the box.

### 1.5 Construction sequence (what is visible and why) `[verified]`

Top-down construction (contractor's choice): reinforced-concrete diaphragm walls cast in slurry trenches and 3 m diameter bored piles installed from a piling platform at c. +101 PD; an **underpinning slab spanned beneath the live District/Circle tracks** so a low-headroom rig could finish the wall beneath them — **130 m of the line was carried on this temporary bridge/slab** while the box was dug beneath. The box was then excavated with temporary props, the buttress/waling grillage cast progressively, and the 660 mm forged-steel permanent struts fixed. The **base slab is designed for c. 300 kPa heave** with a gravel/geotextile drainage layer. The 2 m column encasements were cast bottom-up around steel cores. Jubilee platform tunnels were driven as **4.4 m pilots and enlarged to 7.0 m** in spheroidal-graphite-iron (SGI) lining; spoil left by river. The District/Circle **tracks were lowered 300 mm 'a few millimetres at a time'** during nightly closures so that the ticket hall and platforms could form 'two full storeys between platform level and street level' and give ground-level access into Portcullis House.

### 1.6 The design-grid rule `[verified]`

Hopkins: *'All elements such as walls, escalators and ticket barriers follow either the diagonal grid of the railway, which cuts across the site at an angle of 45 degrees, or the orthogonal grid of the new building above.'* Consequence for the model: the District & Circle platforms, their stairs and the gateline (NW–SE) sit on the 45° railway grid; the box, its columns, struts and Jubilee escalator banks sit on the Portcullis House E–W / N–S grid; the concourse is an irregular polygon where the two meet.

---

## 2. Site plan & orientation

### 2.1 Where things are `[verified]` (offsets `[estimate]` ±3 m)

The station sits under Portcullis House at the **north-west corner of the junction of Bridge Street (runs E–W: Parliament Square at the west end, Westminster Bridge at the east end) and Victoria Embankment (runs N–S along the Thames)**. Bridge Street runs **155 m** from the Parliament Street / Parliament Square corner (lon −0.12598) east to the Westminster Bridge west abutment (lon −0.12374) at a **bearing of 93°**, i.e. almost exactly east–west. The Thames flows roughly south-to-north here (upstream = Lambeth Bridge to the south, downstream = Hungerford Bridge to the NE); Westminster Bridge crosses it heading ESE (bearing c. 95°).

Offsets from the scene origin (main Bridge Street entrance), given as (dx east, dy north) in metres:

| Feature | dx east | dy north | Distance / bearing from entrance |
|---|---|---|---|
| Elizabeth Tower (Big Ben) centre (51.50070 N, 0.12457 W; signage researcher gives 51.50072, −0.12462) | +22 | −40 | 46 m at 151° (SSE) |
| Portcullis House SE corner | +39 | +3 | — |
| Portcullis House SW corner | −38 | +7 | — |
| Embankment / Boadicea corner stair exits (Exits 1 & 2) | +79 | +10 | 80 m due east |
| South-side subway stair at the Big Ben corner (Exit 3) | +46 | −31 | 26 m ENE of the tower centre |
| Parliament Street east-side subway stair (Exit 5) | −75 | +18 | — |
| Parliament Street west-side subway stair (Exit 6) | −107 | +20 | 31 m west of Exit 5 |
| Churchill statue (NE corner of Parliament Square) | −107 | −25 | c. 110 m WSW; 53 m SW of Exit 5 |
| Bus stop H (north kerb of Bridge Street) | −24 | −5 | 24 m west of the entrance |
| Boadicea statue (estimate 51.50098 N, 0.12360 W) | c. +80 | c. −9 | c. 20 m south of the Exit 1/2 stairs |
| Westminster Pier (51.50174 N, 0.12314 W) | +121 | +75 | c. 120 m ENE; 77 m NNE of the riverside stairs; c. 90 m downstream of the bridge |
| London Eye hub (approx 51.5033, −0.1196) | +366 | +249 | c. 443 m at 56° (NE) |
| County Hall centre (approx 51.50197, −0.11874) | +426 | +101 | straight across the river |
| JLE vent grates (riverside pavement, lon −0.12375, lat 51.50140–51.50163) | c. +79 | c. +38 to +63 | c. 40 m north of the Exit 1/2 stairs, c. 40 m east of Portcullis House's east face |
| LU vent shaft inside New Palace Yard (51.50077, −0.12575) | −60 | −32 | near the Parliament Square corner of the yard |
| Cromwell statue (51.49985, −0.12582) | −64 | −135 | in front of Westminster Hall |
| PC Keith Palmer memorial (51.50073, −0.12592) | −71 | −37 | by the Carriage Gates |

**Standing in the Bridge Street entrance facing out (south):** the Bridge Street carriageway is directly in front; the Palace of Westminster railings and New Palace Yard are across the road (c. 30 m to the railing line, bearing 154°); **Big Ben is diagonally to the FRONT-LEFT**, rising behind the railings c. 46 m away, showing its north and west faces, base partly hidden by the railings and the trees of New Palace Yard, dials at roughly 50° elevation; **Westminster Bridge and the Thames are to the LEFT (east)**, c. 80 m to the bridge's west abutment; **Parliament Square, Whitehall and the Churchill statue are to the RIGHT (west)**, 80–110 m; the London Eye is behind-left over the roofline of the Embankment corner (bearing c. 56°) — visible from the bridge corner, not from inside the colonnade. Note the entrance faces SOUTH, so the colonnade is deep in shadow in the morning and side-lit in the afternoon.

**Big Ben from each exit:** from the riverside/Boadicea stairs, 76 m at bearing 229° (SW) with the full tower visible above the bridge corner; from the south-side Exit 3 stair, only 26 m at bearing 250° (WSW) — the tourist photo spot where the tower fills the frame; from Portcullis House's SE corner, 47 m at 201°.

### 2.2 The station footprint under Portcullis House `[verified]`

Portcullis House's OSM footprint is **77 m along Bridge Street (E–W) × 50 m along Victoria Embankment / Cannon Row (N–S)**, a near-rectangle with chamfered corners. The **Jubilee station box (80 m × 26 m, long axis E–W) lies under the southern strip of the building, immediately north of and parallel to Bridge Street**; the ISSMGE paper's views are 'from the W corner, i.e. Cannon Row / Bridge St junction' and 'from the SE corner, i.e. junction of Bridge St and Victoria Embankment'. The **two Jubilee platform tunnels lie 'one above the other to the side of this box' — under Bridge Street, along the box's south wall.** The **District & Circle line 'lies diagonally across the site just below ground level' at 45° to the building grid, crossing the box from SW (Parliament Square) to NE (Embankment)**. Whitehall/Parliament Street runs north from Parliament Square along the west side of Portcullis House; Cannon Row (a c. 5 m wide gated lane) is behind (NW of) Portcullis House; 1 Parliament Street (Victorian, c. 27 m Bridge Street frontage) is west of Cannon Row; the Norman Shaw Buildings are immediately north across a narrow gap. The whole 77 × 50 m Portcullis House footprint therefore sits over the station and the Bridge Street entrance descends directly into the box.

### 2.3 ASCII plan sketch (north up; not to scale; ≈ 1 character ≈ 2 m horizontally)

```
                                   N  (−Z in Three.js)
                                   ^
   Cannon Row (gated lane)         |                 Norman Shaw South (red brick / Portland bands)
  ─┬────────────────────────────────────────────────────────────────┬─
   │                                                                │   V
   │        P O R T C U L L I S   H O U S E   77 m × 50 m           │   i
   │          (glazed courtyard; six courtyard columns              │   c
   │           continue down through the station box)              │   t   ┌──┐ JLE vent
   │  ┌──────────────────────────────────────────────────────┐      │   o   │  │ grates
   │  │  JUBILEE STATION BOX  80 × 26 m  (long axis E–W)     │      │   r   │  │ (4 × ~3.5×2 m)
   │  │  concourse −3 m / D&C −8 m / interchange / void /    │      │   i   └──┘
   │  │  2 m columns on centreline at 11.8 m c/c             │      │   a
   │  │             D&C tracks cross box SW→NE at 45°  ↗     │      │
   │  └──────────────────────────────────────────────────────┘      │   E
   │  Tesco ─┐  [ EXIT 4 : 12 m opening in colonnade ]  ┌─ Caffè Nero   m
  ─┴─────────┴──────────────╥──────────────────────────┴────────────┴─  b.
  Exit 6  Exit 5   Bus H    ║ ORIGIN (0,0)  roundel totem at kerb          Exit 2 stair ▒ Boadicea ●
  ▒ 31 m ▒       (−24 m)    ║                                              Exit 1 ramp   (+80, −9)
 ═══════════════════ B R I D G E   S T R E E T  (bearing 93°, 155 m; ~30 m wall-to-railing) ═══════════════►
   ≈≈≈≈≈≈≈≈≈≈≈≈ Jubilee P3 (eastbound, upper) over P4 (westbound, lower), 7 m i.d., under Bridge St ≈≈≈≈≈≈≈≈
  ─────────────────────── New Palace Yard railings 2.1 m (Barry, 1868) ──────────────┐   Exit 3 stair ▒
   Carriage Gates    lime avenue / catalpas / Jubilee Fountain        ┌──────────┐    │   (+46, −31)
   (Parliament Sq)   MPs' car park (5 levels, 450 spaces) below       │ ELIZABETH│    │
                                                                      │  TOWER   │    │  WESTMINSTER
   ● Churchill (−107, −25)                                            │12.2 m sq │    │  BRIDGE ──► ESE
                                                                      │ (+22,−40)│    │  250 × 26 m
                     P A L A C E   O F   W E S T M I N S T E R        └──────────┘    │  7 green iron
                     (Anston limestone; Westminster Hall to the S)     Speaker's House │  arches
                                                                                        ▼
                                                    T H A M E S  (flows N; ~240 m wide; County Hall & Eye opposite)
```

### 2.4 Entrances and exits — two numbering systems, reconciled

There are **six public exits plus a pass-holders-only Houses of Parliament door**. The TfL station-sign numbering (photographed) and the TfL NaPTAN 'entrance' numbering are **different systems**; do not mix them.

**A. As signed inside the station** `[verified]` — the architecture researcher photographed an interior direction sign on the white-glazed-brick subway walls reading **'← Exit 1 Westminster Pier / ← Exit 2 Victoria Embankment / Exit 3 → Houses of Parliament'**, and OSM tags refs 1 and 2 on the two Embankment-corner stairs. Combined with the describe-online survey:

| Sign no. | Sign wording | Where it comes out | Steps |
|---|---|---|---|
| **Exit 1** | 'Westminster Pier' — signed '↑ Westminster Pier (boat icon) River Bus / River Tours' and 'London Eye / London Dungeon / London Aquarium Exit 1' | Low-level ramped passage from the east end of the concourse, coming out on the Embankment river wall facing east | 4 steps or ramp |
| **Exit 2** | 'Victoria Embankment' | Steps just before Exit 1, emerging at the NW corner of Westminster Bridge next to the Boudicca statue, under a black cast-iron arch 'Westminster Station / Public Subway / Toilets' with roundel | 17 + 7 steps (OSM: a 30-step flight, surface concrete plates, and a 15-step flight, paving stones) |
| **Exit 3** | 'Houses of Parliament' | Via the old pedestrian subway under Bridge Street, emerging on the SOUTH side of Bridge Street just west of the Embankment at the foot of Big Ben; the pass-holders' Parliament door is on the left of this passage | 11 + 15 + 14 + 14 steps |
| **Exit 4** | 'Bridge Street' | The main entrance in the Portcullis House arcade, north side of Bridge Street directly opposite Big Ben | Lift or 16 steps |
| **Exit 5** | 'Whitehall' (east side of Parliament Street) | Stair on the east footway of Parliament Street just north of the Bridge Street corner | 11 + 11 steps then 12 steps up into the passage |
| **Exit 6** | 'Parliament Street / Whitehall' (west side) | Stair on the west footway of Parliament Street in front of HM Treasury; passage under Whitehall with 4 steps; **public toilets (50p / £1) and a parent room in this passage** | 12 + 12 steps |

Exits 2, 5 and 6 are under Victorian-style cast-iron railings and canopies signed **'City of Westminster – Westminster Station – Public Subway – Toilets'**.

**B. Alternative memory-based numberings (recorded, NOT preferred).** The street researcher `[memory-medium]` recalled: Exit 1 Westminster Pier / London Eye; Exit 2 Westminster Bridge; Exit 3 Houses of Parliament / Big Ben; Exit 4 Whitehall / Parliament Square; Exit 5 (step-free) Portcullis House / Bridge Street. The signage researcher `[estimate]` proposed: Exit 1 'Victoria Embankment, Westminster Pier, River boats, London Eye'; Exit 2 'Bridge Street, Westminster Bridge, Portcullis House'; Exit 3 'Westminster Bridge, Big Ben, London Eye, County Hall'; Exit 4 'Houses of Parliament, Parliament Square, Westminster Abbey, St Margaret's Church' (possibly closed at times for Parliament security works); Exit 5 'Whitehall, Parliament Street, Downing Street, Churchill War Rooms, Horse Guards'; step-free 'Lift to street – Portcullis House / Bridge Street'. **Verdict:** list A is preferred because it rests on a photographed sign, a 2008 walking survey and the OSM ref tags; lists B are memory reconstructions. Make all sign strings data-driven so they can be corrected from a photo.

**C. TfL NaPTAN entrance points (a separate numbering)** `[verified]`: Entrance 1 at 51.50125, −0.12377 (NE corner, Embankment side); Entrance 2 at 51.50095, −0.12495 (south pavement of Bridge Street, c. 25 m west of the tower centreline — this is probably the south-side exit OSM flags as possibly closed, way 136105035 'fixme: is this exit closed?', and/or the Parliament pass-holders' door); Entrance 3 at 51.50086, −0.12383 (south pavement, east end by the Westminster Bridge approach); Entrance 4 at 51.50125, −0.12607 (north pavement at the Bridge Street / Parliament Street corner, SW corner of Portcullis House); Entrance 5 at 51.50126, −0.12651 (c. 30 m further west across Parliament Street, Whitehall side); Entrance 6 at 51.50115, −0.12386 (NE corner, Bridge Street pavement side).

**D. OSM subway_entrance nodes** `[verified]`: 587959213 (51.5011521, −0.1237400) ref=1, wheelchair=yes; 12793161797 (51.5011543, −0.1237871) ref=2 — 3 m apart at the NE corner; 1587633281 (51.5012268, −0.1259759) and 1587633283 (51.5012427, −0.1264302) 'Steps down and in subway' on Parliament Street (31 m apart); 2621668682 (51.5007807, −0.1242229) south side east, steps; 10671686470 (51.5010615, −0.1248863) wheelchair=yes, the main ticket-hall/lift entrance. Net: five street staircases plus one step-free route.

### 2.5 The public subway `[verified]`

The pedestrian subway under Bridge Street (OSM ways 145345174, 261398893, 46115102: highway=footway, tunnel=yes, level −1, lit=yes, bicycle=dismount) runs the full length of the block from Parliament Street to Victoria Embankment (c. 200 m) and doubles as the station's unpaid concourse; the gateline opens off it under Portcullis House. West-end staircases (OSM ways 145556582, 145556584): surface=paving_stones, handrail=yes, lit=24/7, tactile_paving=no, ramp=no. East-end staircases: way 231879497 step_count=30, surface=concrete:plates (the long Embankment stair) and way 231879498 step_count=15 (paving stones). With c. 160 mm risers, 30 steps ≈ 4.8 m descent; 15 steps ≈ 2.4 m. These are the surviving pre-1999 subways: blank concrete walls with billboards, sloping floors, **white glazed brick** (with blue/white tiled sections around help points), ramps and short stair flights; the Whitehall passage 'shifts north by veering left then right'. They connect to the concourse via 4 steps up on the east side and a passage entering on the west side. A geograph photo 'Tiled entrance underneath Westminster tube station' (51.50097, −0.12508) shows cream/white tiles.

---

## 3. Vertical section

### 3.1 Datum and geology `[verified]`

All project levels in the Maunsell papers are in Project Datum **PD = OD + 100 m**. Piling platform c. +101 PD (≈ street). Terrace Gravels to 93.0 PD, London Clay below, Woolwich & Reading Beds near the base; box base around 64–70 PD. Pile toes at +49 PD (20.6 m below the box bottom). Bridge Street pavement ≈ +101 to +102 PD.

### 3.2 The five public levels

| Level | What | Depth below Bridge Street pavement | Evidence |
|---|---|---|---|
| 0 | Portcullis House arcade / Bridge Street | 0 | — |
| 1 | **Concourse / ticket hall** | **c. −3 m** (16 steps or lift down from the arcade) | [verified] step count; [estimate] depth |
| 2 | **District & Circle side platforms** (Platform 1 westbound, Platform 2 eastbound) | **c. −7.5 to −8 m** (two flights of 14 steps = 28 steps, or lift, below the concourse). 'Two full storeys between platform level and street level' made possible by lowering the tracks 300 mm | [verified] |
| 3 | **Jubilee 'interchange level'** in the top of the box, in two parts: EAST section (under/south of the D&C tracks, reached by 3 escalators from the concourse) and WEST section (directly under the D&C platforms, reached by 2 escalators + stairs from Platform 2 and 2 escalators from Platform 1) | **c. −8 to −14 m** (east section higher than west) | [estimate] |
| 4 | **Jubilee eastbound Platform 3** (upper tunnel) | **c. −22 to −24 m** | [estimate] |
| 5 | **Jubilee westbound Platform 4** (lower tunnel) | **c. −31 to −33 m**. TfL FOI dataset (FOI-0493-2223): Jubilee platforms **31.4 m below street / 26 m below sea level**; CityMonitor: westbound platform **25.4 m below sea level**; rolling-stock researcher: c. 30 m below street; Hopkins quote a '30 m deep escalator box' / c. 30 m escalator descent from ticket hall to Jubilee platforms | [verified] figures, [estimate] reconciliation |
| — | **Box base slab** | **c. −39 to −40 m**. Station plaque (HMS Westminster plaque, photographed Aug 2023): *'at its lowest point the station is 32 m below mean sea level, deeper than any other location on the Tube network'* | [verified] |

**Conflict — box depth and plan:** Maunsell 1996: 'a rectangular box, **80 m long, 26 m wide**, and extending **40 m below street level**'. Hopkins/RIBA: **75 m × 27 m** with a diaphragm wall to 40 m. Wikipedia/ICE: **39 m (128 ft) deep, 'the deepest ever excavation in central London'**. Audio researcher estimated 75 m × 25–30 m. **Verdict:** use 80 × 26 m internal plan and 39 m to base-slab top (40 m to the underside of the slab/diaphragm-wall design depth) — Maunsell were the engineers of record and their figure is the engineered box; Hopkins' 75 m is likely the architectural clear length.

### 3.3 The stacked Jubilee tunnels `[verified]`

Eastbound Platform 3 is directly above westbound Platform 4. Each platform tunnel is **7.0 m internal diameter SGI-lined, enlarged from a 4.4 m pilot, 'approximately 165 m long, horizontal with 1000 m radius'** — gently curved (Knorr-Bremse: Westminster is unique on the JLE in having 'platforms on different levels and these are also curved'). Vertical separation is **estimated at c. 10–11 m axis-to-axis** (7 m tunnels with c. 3 m of clay between) `[estimate]`. Both tunnels run E–W (ENE–WSW) parallel to Bridge Street, beside the box's south wall; eastbound trains head towards the river and then under it to Waterloo.

### 3.4 The 17 escalators — bank by bank `[verified]` (rises `[estimate]`)

Reconstructed from the describe-online survey; OSM independently models the void as conveying=yes steps with lanes=3 between levels −1 and −3 (way 1381815564), lanes=3 between −3 and −4 (1381815574, 1381815591), lanes=2 between −2 and −3 (1381815553, 1381815559), lanes=2 between −4 and −5 (1381815585, 1381815589), with fixed stairs (conveying=no) parallel to each flight (1381815575, 1381815586, 1384660794, 1381815572).

| Bank | From → To | Units | Notes | Rise (est.) |
|---|---|---|---|---|
| (a) | Concourse (far east end of paid side) → interchange EAST section | 3 | descend westward/downward into the east section | c. 5 m |
| (b) | Interchange EAST section → Platform-3 level **WEST well** | 3 | 'the long flight'; descends **westward** | c. 13–15 m |
| (c) | D&C Platform 2 (eastbound) → interchange WEST section | 2 + staircase alongside | descends westward from the second recess | c. 5 m |
| (d) | D&C Platform 1 (westbound) → interchange WEST section | 2 (no stairs) | from the wide west end of Platform 1; short passage with a 180° turn | c. 5 m |
| (e) | Interchange WEST section → Platform-3 level **EAST well** | 3 | descends **eastward** | c. 9–10 m |
| (f) | Platform-3 WEST well → Platform-4 WEST well | 2 + stairs | | c. 9–10 m |
| (g) | Platform-3 EAST well → Platform-4 EAST well | 2 + stairs (two flights) | | c. 9–10 m |

3 + 3 + 2 + 2 + 3 + 2 + 2 = **17**. The deliberate **criss-cross**: escalators from the EAST section descend westward to the WEST well; those from the WEST section descend eastward to the EAST well — so entering/exiting passengers are segregated from D&C↔Jubilee interchange passengers, and from most points several banks are visible crossing at different angles. There are **no stairs** between concourse and interchange or between interchange and Platform 3 (emergency stairs only, running down the west side of the box and connecting all levels). The audio researcher's summary 'stacked flights of c. 15–20 m rise' is a rounding of the (b) figure. Typical LU arrangement in each 3-bank: outer pair up/down, centre reversible `[memory]`.

### 3.5 Lifts `[verified]`

Four public lifts per the 2005/2008 survey (Wikipedia/TfL say five; the fifth is probably a staff/parliamentary lift):
1. Bridge Street arcade ↔ concourse, immediately west of the entrance passage.
2. Concourse ↔ Platform 1 (westbound D&C), in a recess off the south side of the paid concourse, door opening north onto the platform.
3. Concourse ↔ Platform 2 (eastbound D&C), on the north side of the paid concourse.
4. The **deep lift** from the widened west end of Platform 1 down to both Jubilee levels, buttons **'DC / JE / JW'**; it lands in the **EAST well** of each Jubilee level, where you 'turn immediately right' into a short passage to the platform.

Lifts have clear spoken announcements. The station is fully step-free street-to-train on the Jubilee (mini ramps) and street-to-platform on the D&C (step/gap to train; boarding ramps available).

### 3.6 ASCII section sketch (looking north; E–W along the box; not to scale)

```
 W (Parliament Sq / Cannon Row)                                                     E (Embankment / Thames)
 ┌────────────────────────── PORTCULLIS HOUSE (6–7 storeys, bronze roof, 14 chimneys) ──────────────────────────┐
 │  ground-floor colonnade / arcade                 ▼ Exit 4: 16 steps or lift                                │
 0 m ═══ Bridge St pavement ════════════════════════╪════════════════════════════════════ thick transfer slab ═══
 −3 m  │ CONCOURSE (irregular polygon, coffered concrete grid, saucer lights)  gateline 15 gates NW–SE          │
       │  ← Whitehall passage        ticket windows (blank)       ▼▼▼ (a) 3 esc     → Embankment subway (4 steps)│
 −8 m  │ D&C P2 (EB) ═══ tracks (lowered 300 mm) ═══ P1 (WB)   crossing the box SW→NE at 45°                   │
       │   (c) 2 esc+stair ▼   (d) 2 esc ▼         ┌────────────────────────────┐                             │
 −8..  │ INTERCHANGE WEST section (under D&C)      │ INTERCHANGE EAST section   │                             │
 −14 m │   (e) 3 esc ▼ descend EASTWARD ──────────►│◄────── (b) 3 esc descend WESTWARD (the long flight)      │
       │                                                                                                      │
       │        ┃ 2 m column ┃      ┃ 2 m column ┃      ┃ 2 m column ┃     ← centreline columns at 11.8 m c/c │
       │ ═══════╋═══ 660 mm solid steel strut ═══╋═══════════════════╋═══════  through cast collars            │
       │   ╱  ╲ ┃   diagonal tubular braces      ┃  ╱ ╲              ┃    OPEN VOID: 35 m long × 20 m high     │
       │ ═══════╋════════════════════════════════╋═══════════════════╋═══════  no slabs, no walls               │
 −22.. │ [WEST WELL] ─passage─ P3 EASTBOUND platform (north of track) ─passage─ [EAST WELL + lift 'JE']        │
 −24 m │   (f) 2 esc+stair ▼      ○ P3 tunnel 7.0 m i.d., 1000 m radius, 165 m long      (g) 2 esc+stair ▼    │
 −31.. │ [WEST WELL] ─passage─ P4 WESTBOUND platform (north of track) ─passage─ [EAST WELL + lift 'JW']        │
 −33 m │                          ○ P4 tunnel 7.0 m i.d.   (~10–11 m below P3 axis)                            │
 −39 m ╞════════════════════ BASE SLAB (300 kPa heave, gravel drainage) ═══════════════════════════════════════╡
       │ 3 m bored piles under 2 m columns, toes 20.6 m below slab (+49 PD); tunnelled cross-struts below slab │
       └── diaphragm walls 40 m deep (2.5 m wide buttress/waler grillage on the inside face) ─────────────────┘
                              Big Ben foundation 34 m to the SE of the box edge →
```

---

## 4. Ticket hall (concourse)

### 4.1 Form and finishes

- **Plan:** an irregular polygon at c. −3 m under the Portcullis House ground slab, where the 45° railway grid meets the orthogonal building grid `[verified]`.
- **Height:** architecture researcher estimates **3.0–3.5 m clear (beams lower)**; audio researcher estimates **4–4.5 m** `[estimate — conflict]`. **Verdict:** the lower figure is more likely — Beauty of Transport describes the coffered ceiling as giving 'the impression of more headroom than there actually is' and calls the ticket hall the least satisfactory element; the whole concourse has to fit between −3 m and the D&C platforms at −8 m together with the platform slab and beams.
- **Ceiling:** a fair-faced concrete coffered/beamed grid (the same 'diagrid' language as the box) `[verified]`. **'A thick slab of concrete separates Portcullis House from the station'** — the atrium/ground floor is part of the transfer structure `[verified]`; nothing from the building above is heard.
- **Lighting:** large circular flat 'saucer' luminaires (**estimate 1.2–1.5 m diameter**) hung a few hundred mm below the concrete ceiling, plus spot/flood heads on the stalks `[verified] type, [estimate] size`.
- **Floor:** light speckled-grey terrazzo/granite tiles c. 600 mm `[verified]`.
- **Walls:** fair-faced concrete; the former ticket-office windows are on the NW wall behind Tensa barriers (now blank/converted since 2015) `[verified]`.

### 4.2 Layout `[verified]` (describe-online 2005/2008; gate count updated from TfL API)

- Entrances arrive from the **east** (Embankment/Pier subway: 4 steps or ramp up into the concourse), the **south** (Bridge Street: 16 steps down or lift, arriving between the ticket windows and the gateline) and the **west** (Whitehall passage).
- The **gateline runs NW–SE across the middle of the hall**. The 2008 survey counted **16 automatic gates** with a manual/wide gate at each end; the TfL API now reports **15 ticket gates**; the architecture researcher estimated 18–20 including wide-aisle gates. **Verdict:** model **15 gates** (current official figure) with one wide-aisle gate and a glazed staff booth, and make the count a parameter.
- **Paid side (NE of the gateline):** steps down to Platform 2 from its SW corner; lift to Platform 2 on the north side; steps and lift to Platform 1 on the south side; the **three Jubilee escalators (bank a) leave from the east end of the south side**.
- **Unpaid side:** cash machines (4, Euro-capable) on the west side between the Whitehall passage and the ticket windows; ticket machines — estimate 4–6 — flush in the wall near the gateline `[estimate]`; 4 payphones `[verified]`.
- **Route from the street:** from the pavement opposite Big Ben pass under the Portcullis House arcade, between Tesco Express (west) and Caffè Nero (east), into a short north-going passage (lift on the left/west), down 16 steps into the concourse; turn slightly left (11 o'clock), the former ticket windows on your left; the gateline is in front, running NW–SE.

### 4.3 Gateline hardware `[memory-high]` (count `[verified]`)

Cubic pneumatic paddle gates: brushed stainless-steel cabinet c. 1.9 m long × 0.30 m wide, top c. 1.0 m high with a black top plate; standard aisle c. 550 mm with two grey/black composite paddles (glass leaves on newer units) that fold back into the cabinet, opening c. 1 s after a valid touch; wide-aisle gate c. 900 mm with taller paddles at one end; a manual staff gate and a glazed staff booth ('Gateline assistance'). Entry end: yellow Oyster/contactless reader disc c. 105–120 mm on a raised black sloped housing at c. 950 mm, a small colour LCD (c. 90 mm) showing 'Enter' / fare / 'Seek assistance', and a magnetic ticket slot returning the ticket on top. End-face indicators: green arrow (enter) / red cross or bar (no entry) LED signs c. 150 mm. Reader finishes: 2003-era plain yellow disc with red/green LED ring, and post-2014 units with a small screen; reader range c. 80 mm; pink route validators are NOT present at Westminster. Sounds: see §10.7.

### 4.4 Ticket machines `[memory-medium]`

TfL ticket machines: Corporate Blue #0019A8 front fascia with white Johnston header 'Tickets' plus roundel, touchscreen (c. 15 inch) at 1.2–1.4 m with a yellow Oyster reader pad beside it, card/coin/note slots on the right, ticket and change trays at c. 0.9 m, brushed-stainless lower skirt; overall c. 0.75 m wide × 1.9–2.0 m tall, flush in the wall.

### 4.5 Acoustics `[estimate]`

RT60 c. 1.5–2 s. Dominant sounds: crowd hubbub (one of the busiest tourist stations), gate beeps and paddle thumps (loudest single source, c. 75 dB(A) at 1 m), ticket-machine touch-screen beeps and coin/receipt noises, staff at the gateline ('Have your cards ready please'), the top-of-escalator drone, and street noise plus Big Ben spilling down the open stairs (see §10.10).

---

## 5. The Jubilee box (structure, columns, struts, escalators, walkways, lighting)

Hopkins' own word for it is **'Piranesian'**; Beauty of Transport: no applied decoration anywhere, 'just the drama of the engineering'. This is the hero space.

### 5.1 Diaphragm walls and the concrete grillage ('diagrid') `[verified]`

- Walls are reinforced-concrete **diaphragm walls cast in slurry trenches to 40 m**. Because the permanent struts are widely spaced, **'a 2.5 m wide grillage of reinforced concrete buttresses and walings was introduced to span between the props'** — the rectangular concrete grid of fat vertical buttresses and horizontal walers on the long walls, built progressively as excavation went down. Hopkins: 'a massive diagrid of beams and buttresses, which also form the foundations of Portcullis House'.
- **The recessed cell backs are the raw diaphragm-wall face 'poured against the side of the hole'** — rough, pock-marked, with the marks of the earth (approx **#7f7c76**, browner). The grillage is smoother (approx **#9c9b96**, pale warm grey, with mottling and darker water-stain streaks on the columns).
- Concrete specification: fair-faced, specified to be 'glittery' — **Blackmore sand from the West Country with mica content, micro-silica additives, 50–60 N/mm²**.
- Hopkins/RIBA: 'solid steel struts spanning **21 m** between buttresses' (i.e. the clear span between the buttress faces within the 26 m box).

### 5.2 Giant round columns `[verified]`

ISSMGE 1996 §4: **'On the centreline of the escalator box a row of 2 m diameter columns at 11.8 m centres supports the permanent struts and slabs within the box, as well as the station and the New Parliamentary Building above. Within the open section of the box there are secondary columns of 1 m diameter, halfway between adjacent large columns, which support permanent struts only.'** The 2 m columns are fair-faced concrete encasements around fabricated steel cores, standing on **3 m diameter bored piles** (some of the largest in London, **36 MN working load**, toe at +49 PD, 20.6 m below the box bottom); a jacking facility is built into the pile-columns. **Six of these columns are the Portcullis House courtyard columns continuing to the bottom** (the outer walls of Portcullis House sit on the box's diaphragm walls, but the inner courtyard walls could only be supported at six points, so six massive columns tied by concrete transfer arches carry them).

**Visual recipe:** smooth pale-grey concrete cylinders with cast collars where struts pass through; a **dark-blue mosaic-tile band c. 300 mm high about 1.1–1.3 m above each floor** (the same blue appears as a striped band on glass balustrades near D&C level, on the glazed lift enclosures and on the litter/salt bins); the 660 mm struts pass straight through. Ring-mounted spot/uplighter pairs are clamped around the columns on circular collar brackets.

### 5.3 Struts and 'flying' diagonal braces `[verified]` (brace diameters `[estimate]`)

- Permanent wall propping across the void: **'solid 660 mm diameter forged steel struts'** (B1M: 'solid steel beams measuring two feet in diameter'), **horizontal, running across the 26 m width from buttress to buttress through the central columns, at several levels within the 20 m high open void**.
- **Slimmer round tubular diagonal braces (estimate 250–400 mm diameter) with forked pin/clevis ends**, running from the columns and struts up to the walings/buttresses and to the escalator support structures — the 'flying struts' that make the criss-cross composition.
- **Thin stainless tie-rods** bracing the escalator trusses.
- **All steelwork painted a satin mid-grey, approx #8a8d8f, slightly bluer than the concrete.** A geograph caption calls it a 'huge oppressive volume, subdivided by supporting pillars and cross-tie tubes'.

### 5.4 The open escalator void `[verified]`

**'The escalator box is sufficiently wide to allow triple escalators to pass either side of a central row of 2 m diameter columns. Over the 35 m length and 20 m height taken by the escalators, the box is entirely without either slab or walls, thereby creating a large open space through which the escalators pass on discrete steel supporting structures'** — design intent 'as open an environment as possible and a change from the traditional rabbit warren'. Escalator trusses are carried on steel beams hung between the columns and the wall grillage. **Undersides and sides of the escalators are clad in light-grey aluminium panels (approx #b9bbb9) between exposed ribs**; the sides carry **perforated stainless-steel balustrade screens**. From most points several banks are visible at once, crossing at different angles; a 2025 Commons photo taken looking down the void (B&W) shows three or four banks stacked.

### 5.5 Escalator hardware

- O&K heavy-duty JLE escalators, standard LU geometry: **30° incline, 1,000 mm step width, 0.75 m/s** (some LU units run at 0.65 m/s), **tread depth 400 mm, rise c. 210 mm** `[verified]` speed/geometry.
- Steps: die-cast aluminium with c. 9 mm pitch cleats; **painted yellow demarcation lines c. 25 mm wide along the front nose and both side edges (paint #F2C300, wearing off toward the centre)**; yellow comb plates at both landings; **black rubber handrails c. 80 mm wide** on stainless newel ends `[memory-high]`.
- Balustrades: the architecture researcher (from Commons photos 'EscalatorLights at Westminster', 'Escalators at Westminster tube station') describes **stainless-steel balustrades with round white lamps set into the balustrade skirting at intervals — the JLE signature 'escalator lights' — stainless combplates/newels, brushed-stainless deck panels**. The signage researcher describes **solid brushed stainless-steel balustrades and skirts (no glass) with continuous linear luminaires in the balustrade decking under the handrail**. **Verdict:** both agree on solid stainless (no glass); the 'EscalatorLights' photo supports the discrete round lamps in the skirting on the JLE flights — model round lamps, with a linear under-handrail glow as an optional LED-retrofit look.
- Escalator signage at every newel: see §12.7.
- No advertising panels on the free-standing flights in the void; panels appear only on walled flights and at ticket-hall level `[memory-medium]`.

### 5.6 The interchange level and the wells `[verified]`

- **EAST section:** 'underneath and south of the D&C line', reached by bank (a) and, emergency only, by the deep lift; from here bank (b) descends westward to the WEST well of Platform 3. As you walk between the two escalator banks, the wall on your left 'curves to your right'.
- **WEST section:** 'under the tracks and platforms of the D&C', reached by bank (c) from Platform 2 and bank (d) from Platform 1 (a 'short passage' with a 180° turn); from here bank (e) descends eastward to the EAST well of Platform 3.
- Each Jubilee platform has an **EAST well and a WEST well**, entered through short passages northward into the box: the **east well holds the lift (both levels) plus escalators/stairs (g) between levels 3 and 4; the west well holds the foot of the long escalators (b) and escalator/stair pair (f)**. Emergency stairs leave the west end of each platform.
- **Floors:** stainless-steel **Suregrip** chequer/perforated plate on the main concourse and walkway/bridge areas of the box (60 t supplied by Wincro; a Commons photo shows the stainless chequer floor at an escalator landing), light-grey terrazzo elsewhere.
- **Balustrades:** walkway/bridge edges use **perforated stainless-steel sheet panels (round-hole perforation) topped by round stainless rails (c. 42 mm)**; stairs between levels are in-situ concrete flights with stainless nosings, glass balustrades with round stainless handrails and a second lower rail, walls of fair-faced concrete; some panels near D&C level are glass with the dark-blue striped band at rail height. **Litter/salt bins are grey stainless cylinders with domed tops and the same blue band.**

### 5.7 Lighting design (George Sexton) `[verified]` fixtures; colour temperature `[estimate]`

1. Linear fluorescent battens fixed to the undersides of the grey steel beams and escalator support frames throughout the void — cool white, est. **4000 K** general light.
2. Ring-mounted spot/uplighter pairs clamped around the 2 m columns on circular collar brackets, wash-lighting the column shafts and the concrete grillage.
3. Round lamps in the escalator balustrade skirts.
4. Big circular saucer luminaires below the ticket-hall ceiling grid.
5. Continuous linear troughs on the Jubilee platform ceilings and twin-tube battens under the D&C beams.
6. Small floodlights on stalks over posters.

Overall impression: even, slightly cool grey-white light with the concrete catching highlights, **darker in the upper reaches of the void**; recent LED retrofits read whiter. Keep c. 4000 K in the box, slightly warmer on the old D&C level.

### 5.8 Acoustics of the box `[estimate]`

Bare concrete diaphragm walls, exposed beams, stainless-clad escalators, steel and glass balustrades — no absorptive finishes. **Mid-band RT60 estimate 3.5–5 s at 500 Hz–1 kHz**, pronounced flutter echoes between the parallel long walls, boomy build-up below 200 Hz from escalator drone and train rumble. PA speakers are small line arrays on the escalator balustrades and at the platform openings; speech intelligibility is poor and each announcement appears to come from several directions with 100–300 ms echoes. Footsteps ring on the steel-plate and concrete floors; a dropped coin is audible across the box. Ventilation fans add a constant broadband hiss. See §10.9 for the escalator drone figures.

---

## 6. Jubilee platforms & platform edge doors

### 6.1 Geometry `[verified]`

- **Platform 3 = eastbound (upper), Platform 4 = westbound (lower).** Photographed signs: 'Jubilee line ↑ Eastbound platform 3', 'Jubilee line ↓ Westbound platform 4'; live boards list 'Platform 4' for Stanmore trains; Beauty of Transport confirms eastbound above westbound. (The audio researcher's '3 westbound upper, 4 eastbound lower' was explicitly a guess and is superseded.)
- **Both platforms lie on the NORTH side of their track (the box side)**; facing the front of the train, eastbound doors open on the LEFT, westbound on the RIGHT.
- **Platform length 126 m for 7-car 1996 Stock; 28 platform-edge doors per platform.** Tunnel 7.0 m i.d., 165 m long, 1000 m radius. The rolling-stock researcher estimates the PED screen at c. 128–130 m long and the platform slab at c. 135–140 m including end margins (JLE PEDs were installed 'with allowance for the additional carriage') `[estimate]`.
- Each platform has short passages northward into the EAST and WEST wells (§5.6). Emergency stairs at the west end.

### 6.2 Finishes `[verified]`

- **Curved tunnel walls lined with light-grey perforated aluminium panels (approx #b8bbbe) set in a darker grey rib/frame grid (approx #6e7174) following the tunnel ring joints, panels c. 1 m × 0.5 m**; poster frames and dark-blue-and-red roundels ('WESTMINSTER' in white Johnston on a blue bar, stainless frame) mounted on the panels; **white name friezes with 'WESTMINSTER' in dark blue and a coloured line-band** (note: the signage researcher believes no continuous tiled frieze exists here — treat the frieze as short name panels, not a continuous band; see §14).
- **Ceiling:** grey panels with continuous linear fluorescent troughs along the crown and a lighting/cable spine above the PED line.
- **Tunnel wall behind the track (seen through the glass):** dark grey bolted panels with the roundel and name; alternate 'WESTMINSTER' roundels with cross-track advertisement panels (Jubilee cross-track poster/LED frames c. 3.5 × 1.5 m). A photographer describes these as curved metal panels.
- **Cross-passages/short passages** between platform and wells: the JLE standard **'iron ribs with enamel infill panels' (silver-grey ribs, pale grey panels)**, signed e.g. 'Jubilee line ↓ Westbound platform 4' / 'Emergency exit'.
- **Floor:** light-grey speckled terrazzo (approx **#c8c8c3**) with a darker tactile band; stainless perforated benches (3-seat units c. 1.5 m long, seat c. 450 mm high); white round Help Points (see §12.9); orange LED dot-matrix indicators (photographed examples: '1 STRATFORD 1 min / 3 STRATFORD 4 mins', 'CANONS PARK 1 min').
- **Tactile/yellow line behind the PEDs — conflict:** the signage researcher gives a yellow line c. 600 mm back from the doors and a dark-grey/graphite blister strip 400 mm deep between the line and the PED threshold `[estimate]`; the rolling-stock researcher says the edge is fully screened so there is no visible yellow line beyond the PED threshold strip; the architecture researcher notes the yellow band on the door leaves themselves (§6.3). **Verdict:** model a dark tactile band and a faint/worn yellow line inboard of the screen — harmless if slightly wrong — plus the yellow band on the leaves.

### 6.3 Platform edge doors — hardware

- **Westinghouse Platform Screen Doors, 1999 — the first PEDs on a UK railway.** 28 door units per platform (56 at Westminster); **476 sliding doors across the 17 JLE platforms at 8 stations** (Westminster, Waterloo, Southwark, London Bridge, Bermondsey, Canada Water, Canary Wharf, North Greenwich) `[verified]`.
- **Screen:** stainless-steel-framed toughened-glass, **cantilevered off the platform slab with an open gap above to the ceiling for airflow** (tunnel ventilation/piston relief passes over it) `[verified]`.
- **Heights — three estimates:** architecture: screen c. **2.5 m** high; rolling-stock: glass leaves c. **2.1–2.2 m** (railway-technology.com suggests c. 2.1 m door height) with a dark header/drive housing to **c. 2.5 m** total, header c. 350 mm; signage: screen to a stainless header **2.6–2.8 m** up `[estimate]`. **Verdict:** glass leaves 2.1–2.2 m, header top at c. 2.5 m, open above — the two independent estimates that agree.
- **Openings:** bi-parting sliding doors matched to the 1996 Stock doorways. Rolling-stock: 28 units = 26 passenger doorways (14 double + 12 single per train side) + 2 end emergency-egress doors `[estimate]`; signage: c. 1.8 m clear opening at double-door positions and c. 1.0 m at single-door positions `[estimate]`; audio: leaves 1.66 m clear (matching the estimated 1.66 m train double-door opening). **Verdict:** 14 double (c. 1.66–1.8 m) + 12 single (c. 0.8–1.0 m) openings, plus 2 end doors. Two door pairs per platform are level-boarding positions (mini ramps) `[verified]` step-free.
- **Fixed panels** between doors c. 1.2–1.5 m wide; **stainless mullions c. 200 mm wide** between doors; small fixed glass panels with door-edge indicator lamps; **amber/green status lamp above each door in the header**; emergency release handles; **grey 'Emergency door release' boxes with red flap / red 'emergency door release – break glass' plates on every fixed panel** `[memory/estimate]`.
- **Leaf graphics** `[verified]` band; rest `[estimate]`: **each door pair has a yellow band (approx #f5c400) c. 100 mm high at c. 1.0–1.1 m with black chevrons at the leaf edges** (architecture, from photos); a slim mid-height stainless rail / horizontal safety manifestation band at c. 1.4 m; a band of small grey dots/lines at eye height; per-door labels in the top corner (white on black, e.g. 'E 12'); black-and-yellow 'Danger – do not obstruct the doors' and 'Stand clear of the doors' stickers c. 150 mm on the leaf edges; a small pictogram 'Do not lean on the doors'; the header band is dark grey/black and carries the door drives.
- Interlocked with the signalling: *'the train reports its presence to the signalling system, which is communicated with the platform edge doors. They cannot open without the correct signals.'* Software modified in 2005 for the 7th car `[verified]`.

### 6.4 Platform edge doors — behaviour and sound `[estimate]` unless noted

- ATO (Thales SelTrac S40 since 2011 `[verified]`) stops the train within roughly ±0.3–0.5 m of the PED datum.
- PEDs open in unison with the train doors, **c. 0.3–0.5 s after the train stops** (audio) / 'a fraction of a second later' (rolling-stock); the signage researcher recalls PEDs opening a fraction *before* the train doors and closing first — **verdict: model near-simultaneous, PED leading by ≤ 0.3 s on open and on close**.
- Open in **c. 1.5–2 s** with a low electric-motor/belt whirr and a soft metallic 'clack' / rubber-stop thud at end of travel; close in **c. 2.5–3 s** with the same whirr then a rubber-seal 'thump'.
- **There is NO dedicated PED chime or voice** (audio, rolling-stock agree); the train's own hustle alarm and 'Please stand clear of the doors' are heard through the gap. (The signage researcher's mention of 'PED chimes before the train doors' is contradicted by the two specialist researchers and is not preferred.)
- With no train present the glass damps tunnel noise so the platform is unusually quiet (c. 50 dB(A)) and noticeably calmer and warmer than an open tube platform; between trains the glass reflects the platform; arriving-train headlights flare through the glass.
- Approach cue: piston wind vents through the gap/grilles above the PED header as a strong low 'whoosh' **10–15 s** (audio) / **5–8 s** (rolling-stock) before the train appears, **2–4 m/s** at platform level — hair and loose paper move, signage does not — then a rising rumble, the descending GTO whine and flange squeal.
- Occasional failure-to-open events produce staff manual releases and a re-dispatch.

### 6.5 Jubilee platform acoustics `[estimate]`

Curved single-track tunnel lined with metal panels plus the PED glass wall: RT60 c. **1.5–2 s**, strongly directional along the tunnel axis; lower box rumble (20–80 Hz) transmitted through the structure when trains move.

---

## 7. District & Circle platforms

### 7.1 Platform numbering — the main conflict in the research

- **Architecture researcher** `[verified]` (describe-online survey and a photographed sign 'District and Circle lines → Westbound platform 1'): **Platform 1 = westbound** (towards St James's Park / Victoria), lying on the SOUTH-EAST / river-and-Bridge-Street side; **Platform 2 = eastbound** (towards Embankment / Tower Hill), lying NORTH-WEST.
- **Audio researcher** `[memory/estimate]`: Platform 1 = eastbound, Platform 2 = westbound.
- **Signage researcher** `[inferred]`: Platform 1 = eastbound on the north track, Platform 2 = westbound on the south track, inferred from the TfL API platform coordinates (Platform 1 at 51.501284, −0.124877 is c. 11 m north of Platform 2 at 51.501185, −0.124838) plus left-hand running.
- **Rolling-stock researcher:** explicitly an estimate.

**Verdict: Platform 1 = WESTBOUND, Platform 2 = EASTBOUND.** Reasons: (1) it is the only version backed by a photographed sign and a walking survey; (2) left-hand running on a SW→NE alignment puts westbound trains on the SE track (the Bridge Street side), which is exactly where the survey places Platform 1 (the wide west end with the deep lift and the two escalators adjoins the Jubilee wells under Bridge Street); (3) the TfL API platform coordinates are approximate points and are not reliable enough to override a photograph. The alternative is recorded in §14.

### 7.2 Geometry `[verified]`

- Two **side platforms (no island)**, aligned roughly WSW–ENE / SW–NE, **on a visible curve** (both Commons photos show the platforms curving) — hence **'MIND THE GAP' painted in white on the dark tactile band**.
- **Platform length c. 130 m** (8-car D-stock length after the 1962–64 extension; 7-car S7 = 117.4 m, leaving c. 15–20 m of empty platform, mostly at the east end) `[estimate]`; rolling-stock estimate 130–140 m usable.
- Facing the front of the train, doors open on the **LEFT on both platforms**.
- **Platform 1 (westbound) widens abruptly at its west (front-of-westbound-train) end** into a large open area containing the foot of the concourse steps (north side), the deep Jubilee lift (SW corner) and the pair of escalators (bank d) down to the interchange level (SW side).
- **Platform 2 (eastbound) has recesses towards its west end**: the concourse steps leave NE from one recess, the Jubilee escalators (bank c, with a stair alongside) descend westward from the next, and the concourse lift is a few metres NE. Multiple openings on the north side lead into the escalator hall.
- **No columns between the tracks** — the opposite platform is fully visible across the pair of tracks.
- Platform height c. 0.91 m above rail with raised humps for level S7 boarding (floor 1,005 mm above rail) `[estimate]`.
- Both ends open into the old brick tunnels toward St James's Park (west, 0.6 km) and Embankment (east, 0.8 km).

### 7.3 Structure and finishes `[verified]` (hexes are photo-derived approximations)

- **Roof:** the concourse floor slab expressed as **deep fair-faced concrete downstand beams running across the platforms** (ceiling c. 5 m over the platform `[estimate]`), with lines of **linear fluorescent fittings (twin-tube battens c. 1.5 m) hung beneath the beams** and a continuous strip/eave along the track side; some ceiling infill of grey perforated metal panels; recessed linear luminaires in the flat canopy areas.
- **Columns on the platforms:** large round grey columns (some are the 2 m box columns, clad in light-grey painted metal with the **dark blue/purple mosaic band about 1.2 m up**) and square/rectangular fair-faced concrete piers c. 0.8–1 m.
- **Back walls:** fair-faced concrete (board-marked/smooth, pale grey approx **#a3a29c**) carrying poster frames (4-sheet 1016 × 1524 mm), digital ad screens, line diagrams and roundels, plus lengths of grey perforated aluminium / vitreous-enamel wall panels; 48-sheet (6096 × 3048 mm) cross-track posters on the opposite wall `[memory]`.
- **Floor:** light grey speckled terrazzo/granite tiles c. 450–600 mm (approx **#c9c7c0**); the signage researcher recalls a darker grey granite/terrazzo with a cream coping band — treat the lighter photo-derived value as primary; a **dark grey studded tactile strip along the edge (approx #5a5a58) with white 'MIND THE GAP'** (white sans-serif caps c. 200 mm high, repeated opposite each door position, i.e. every c. 4–5 m, two per car); a **yellow line (approx #f2c500 / #F2C300) c. 100 mm wide with its outer edge c. 500–600 mm from the platform edge**, worn and scuffed; coping a paler concrete band c. 600 mm wide with a dark anti-slip nosing.
- **Furniture:** stainless perforated-steel benches with tubular legs (grey powder-coated steel benches c. 1.8 m long with perforated seats and backs also recalled); help points; dot-matrix indicators hung from the ceiling (photographed: '1 RICHMOND 1 min / 2 EALING BROADWAY 3 mins'; '1 Upminster / 2 Tower Hill 2 mins'); white/grey horn and cone PA speakers under the canopy.
- **Tracks:** **4-rail (positive and negative conductor rails on yellow-capped insulators) on concrete track slab, dark brown/black.**

### 7.4 Acoustics `[estimate]`

Wide rectangular concrete box, flat concrete-beam ceiling, hard surfaces: **RT60 c. 2–2.5 s** mid-band, with a distinct 'open at both ends' character — train noise leaks in from the adjacent tunnels and PA from the opposite platform is clearly audible across the tracks. With an S7 stood at the platform the reverb collapses to c. 1 s and the air-conditioning hiss dominates. Approach is announced by rail 'singing' (a rising 400–800 Hz hum in the running rails 5–8 s ahead) and a mild 1–2 m/s draught at the platform ends.

---

## 8. Rolling stock

### 8.1 1996 Tube Stock (Jubilee line)

**Dimensions and formation** `[verified]`
- 7-car trains, **total length 126.49 m (126.492 m; 414 ft 6 in)**. Current Wikipedia: driving motor (DM) **18.196 m**, trailer/UNDM **18.02 m**; older sources quote 17.77 m per car — **use c. 18.0–18.2 m for DMs and c. 17.8–18.0 m for intermediates**. **Width 2.629 m, height 2.875 m (rail to roof).**
- Formation **DM–T–UNDM + UNDM–ST–T–DM** (two 3-car units plus the 2005 'Special Trailer' 7th car, a ballasted unpowered trailer). Weights: DM 30.0 t, UNDM 27.1 t, T 20.9 t; train 176.9 t. 63 trains (441 cars), built 1996–98 by GEC Alsthom/Alstom (Barcelona), 7-car since Dec 2005. **234 seats, c. 875 total capacity.**
- **Doors per car side** (from the TfL Jubilee line train graphics standard Issue 4, April 2024, label counts): DM cars **two double-leaf doorways + one single-leaf door at the inner (non-cab) end = 5 leaves/side**; trailers/UNDMs **two double + a single at each end = 6 leaves/side**. So a 7-car train has **14 double + 12 single = 26 doorways per side**. (The audio researcher's '4 doorways per side per car' applies to intermediate cars only.) Estimated opening widths: double c. 1.66 m, single c. 0.8 m `[estimate]`. Externally-hung, air-operated sliding doors; passenger door-open buttons were plated over in the 2017–19 refresh, so all doors are crew-released.
- Door labels `[verified]`: 70 × 606 mm yellow/black 'shark-teeth' hazard strip on each leading edge reading **'Caution – Obstructing the doors is dangerous and causes delays'**; 130 × 52 mm yellow/black **'Caution – Sliding doors'** on each leaf; door reference letters (A–Z, skipping I) in white 17 mm caps, 20 mm down from the top of the door and 20 mm in from the edge.

**Exterior livery** (positions/colours `[verified]` from the TfL standard; front-face colours `[memory-medium]`)
- Body: **unpainted aluminium alloy, satin silver-grey approx #B8BCC0** under station lighting, visible panel/rivet lines, slightly darker lower body. Roof unpainted/light grey `[estimate]`. **No blue skirt band** (unlike S stock).
- Doors: **corporate red Pantone 485 = #DC241F**.
- Body-side roundel **440 mm wide**, red ring/blue bar (#DC241F / #0019A8). Car number in blue 80 mm caps on the body side (e.g. 96077).
- Front end: two-piece windscreen with black surrounds; centre **'M' door (bottom-hinged, folds outward to form detrainment stairs) painted red**; the panels flanking the M door below the windscreens are **corporate blue** ('blue face with red door' distinguishes 1996 from the red-faced Northern 1995 stock); a **grey lower valance/skirt carries the train number in white 120 mm caps on the LEFT-hand grey panel plus a 90 mm white de-icing circle** ('centred on left-hand side grey panel at foot of train' — verified). **Destination display: orange LED text (replaced LCD from 2014) above the M door between the windscreens.** Cab side windows and a small cab door on each side of the DM behind the windscreen.
- Lights `[memory-medium]`: two lamp clusters at the lower outer corners of the cab front, each with white headlight(s) and red tail light(s); a departing train shows two red tail lamps low on the rear DM. Originally filament bulbs (body-side indicator lights also filament); headlight colour est. warm-white 3000–4000 K, tail red #FF1A1A.

**Interior (post 2017–19 refresh, as seen today)** `[verified]` unless noted
- Panels **off-white/white approx #EDEDE8** (originally 'aquamarine greeny-blue' mouldings). Grab rails/poles **silver-grey approx #B5B7B9** (originally yellow). **Dark flooring approx #3C3C3C with lighter #7A7A7A contrasting grooves** for RVAR; door vestibule floors black in newer cars.
- Seats in **Barman moquette (blue ground) since April 2012**; armrests blue (repainted from purple in 2005).
- Layout `[memory-medium]`: predominantly longitudinal seating with a central bay of transverse facing seats (2+2) between the two double doorways in each car; 'perch' seats on the standbacks by the centre doors; c. 33 seats per car average, DMs fewer. Continuous fluorescent lighting strip along the ceiling centreline; car-end windows so you can see into the next car (no gangways).
- **Scrolling LED matrix passenger displays at car ends above the end windows** (red LED on 1996 stock per one photographer; 'amber' per other sources) showing e.g. 'Next station: Westminster' / 'Change for Circle and District lines'.
- Notices (sizes `[verified]`): car line diagram **1295 × 138 mm** above the windows (Stanmore–Stratford; Westminster shown with Circle/District interchange and the Westminster Pier boat symbol); Central London Tube map **723 × 265 mm** on the centre ad panel; car number inside in blue 30 mm caps; door letters blue 17 mm; **'Priority seat' 100 × 140 mm in safety blue Pantone 300**; **£50 penalty-fare / obstructing-doors notice 500 × 50 mm** above door windows (blue/yellow); **'Items trapped in the doors cause delays' 74 × 265 mm yellow strip** on the opening edge of the door leaves; **'This door is alarmed' 225 × 164 mm red label** at the cab-end door; wheelchair backboards in trailer cars.

**Traction, performance, sound** `[verified]` unless noted
- Four **GEC Alsthom LT200 3-phase induction motors per motor car (360 kW / 480 hp per motor car)**, **GTO-thyristor VVVF inverters** (Alstom 'Onix'), 630 V DC fourth rail, max 100 km/h. Acceleration software-limited to roughly 1.0 m/s² (LU limits 1.0 and 1.14 m/s²; the 1996 stock is the more sluggish, c. 45 s to 80 km/h). Service braking c. 1.0–1.15 m/s², emergency c. 1.4 m/s² `[estimate]`.
- **Sound signature — 'the Jubilee noise':** the GTO drive produces the classic **'gear-changing' whine** — a coarse, buzzing, 'spooling-up' tone that rises in pitch, then jumps down and rises again in **discrete steps (roughly 3–4 audible steps between 0 and 40 km/h)** as the inverter changes pulse mode (asynchronous PWM at start, c. 300–500 Hz carrier, then synchronous modes with fewer pulses per cycle, each 'gear change' a clear pitch drop, finally a single-pulse/six-step mode where the whine tracks motor frequency up to c. 1 kHz+ — engineering inference). Under braking the sequence reverses as a **descending stepped whine ending in a low growl c. 2 s before the friction brakes take over**, then brake squeal and a loud pneumatic release hiss after stopping. Described as 'sci-fi', 'like something mechanical spooling up', 'the sound of London'; **unique to the Jubilee** (the Northern 1995 stock was re-tractioned with IGBTs and does NOT make this noise). Add: compressor thump/hiss (a rattling reciprocating compressor cutting in every few minutes), a constant static-converter whine (c. 1 kHz) inside, a sharp air release ('pssht') when brakes release just before departure, pneumatic hiss with door opening, **wheel/rail flange squeal at c. 2–4 kHz on the curved platform tunnel**, and a loud rumble/roar reflected by the PED glass. Recorded run times: Waterloo→Westminster 1:31, Westminster→Green Park 2:37.

### 8.2 S7 Stock (District and Circle lines)

**Dimensions and formation** `[verified]`
- 7-car walk-through train **DM–M1–M2–MS–M2–M1–DM**. **Total length 117.448 m. DM 18.139 m; intermediate M cars 16.234 m. Width 2.92 m, height c. 3.68 m, floor 1,005 mm above rail** (level boarding at raised platform sections).
- **Three double-leaf doorways per car side on every car** (12 'Caution – Sliding doors' labels per car elevation = 6 leaves/side); **21 doorways per side per train**; door opening c. 1.6 m `[estimate]`. Electrically driven doors. Fully open articulated gangways between all cars — you can see end-to-end down the whole 117 m interior.
- Capacity c. 1,209 (S7); all-longitudinal seating (c. 256 seats `[memory]`); two wheelchair bays in the MS car (glass-partition 'Priority area – double wheelchair bay' notice).

**Exterior livery** `[verified]` positions/colours; overall distribution `[memory-high]`
- Body sides: **unpainted aluminium with a pale satin finish reading near-white/silver approx #D9DCDF**; **continuous dark window band (black window surrounds approx #1C1C1C)**; **red doors Pantone 485 #DC241F**; **corporate-blue band #0019A8 along the lower body/skirt below the doors** ('top of blue band' is a positioning datum in the TfL standard: roundel and car numbers are centred between window bottom and blue-band top, between two windows).
- **Cab front: predominantly red below a black windscreen mask, blue band continuing across the bottom, orange LED destination indicator in the black band at the top, white 45 mm train number 'centred between door and destination indicator'**; the front has an offset emergency detrainment door with fold-out steps. **LED light clusters at the lower corners: white headlights forward, red tail lights rear.** Roof light grey with air-conditioning packs (two per car).
- Exterior labels: 440 mm roundel; 80 mm blue car numbers (e.g. 21xxx); **80 × 304 mm yellow/black 'Mind the gap / Caution – Obstructing the doors is dangerous'** on the leading door edge, top aligned with the car-body window tops; 130 × 52 mm 'Caution – Sliding doors' on the outer door panel; **130 × 150 mm safety-blue wheelchair symbol** by the MS car doors; white door letters 17 mm.

**Interior** `[verified]` notice sizes; pole/floor colours `[memory-medium]`
- Light, air-conditioned saloon: **off-white/light-grey wall and ceiling panels approx #E9E9E6**, continuous fluorescent lighting in ceiling troughs, **all-longitudinal Barman-moquette seats (blue)**, **blue-painted vertical grab poles and horizontal rails plus hanging straps (mid/light blue, RAL 5012-ish #3B83BD)**, **mid-grey non-slip floor approx #5B5F63** with contrasting door thresholds, wide open gangways with flexible grey bellows.
- **Orange LED dot-matrix passenger information displays hang from the ceiling at intervals** showing e.g. 'This is Westminster' / 'Next station: Embankment' / 'Change here for the Jubilee line' / 'This train terminates at Upminster' / safety messages; CCTV in every car.
- Notices: car line diagram **1470 × 200 mm** (District) or 980 × 200 mm small, Circle/H&C diagram 1470 × 200 mm; Central London Tube map **750 × 200 mm**; 'Priority seat' 100 × 140 mm safety blue; **'Mind the gap / items trapped in doors' 80 × 419 mm yellow strip** on door edges; **133 × 133 mm red/green 'Emergency door release'**; blue 30 mm car numbers; blue 16 mm door letters; **250 × 200 mm selective-door-opening notices ('These doors will not open at some stations')** — relevant on the Circle for short platforms, not at Westminster.

**Traction, performance, sound** `[verified]` figures
- **Bombardier MITRAC IGBT-VVVF**, 3-phase induction motors, 630–750 V DC fourth rail; **acceleration 1.3 m/s²; service deceleration 1.15 m/s²; emergency 1.4 m/s²; max 100 km/h; regenerative braking (c. 20% energy returned); Mitsubishi air-conditioning.**
- Sound: a **smooth, fast-rising IGBT whine (glissando rather than stepped)** — from standstill a soft rising tone c. 200 Hz → c. 1.2 kHz over c. 15 s, 'like a washing machine on its spin cycle', clean and fairly quiet — with a **distinctive rising multi-tone 'chirp' in the first seconds of acceleration**; a constant air-conditioning/compressor hum when stationary (roof A/C fan hiss c. 60–65 dB(A) on the platform beside the train, dominating the D&C platform ambience when a train is stood); a soft air release on brake release; a periodic compressor. Through Westminster, speed is limited by the curve and close station spacing to roughly 40–50 km/h on entry, so the whine is short.

### 8.3 Barman moquette (both stocks) `[verified]` dates; hexes `[estimate]`

Designed by Wallace Sewell, introduced 2010, fitted to 1996 stock from April 2012 and to S stock from new. **Blue ground approx #1E3F8A to #2A4B9B** with a repeating pattern of London landmark silhouettes (London Eye, Big Ben/Elizabeth Tower, Tower Bridge, St Paul's) in **red #C8102E, teal/green #2A8C8C, light grey #B7BEC6 and dark navy/black #0B1A3F**. Reads as a mid-blue textured seat from a distance with small red/green/grey flecks.

### 8.4 TfL corporate/safety palette used on both trains and signage `[verified]` Pantones; hexes are TfL colour-standard values `[memory]`

Corporate Blue Pantone 072 = **#0019A8**; Corporate/Safety Red Pantone 485 = **#DC241F**; Safety Yellow Pantone 116 = **#FFCD00**; Safety Blue Pantone 300 = **#005EB8**; Safety Green Pantone 356 = **#007A33**; Jubilee grey Pantone 430 = **#A0A5A9**; District green **#00782A**; Circle yellow **#FFD300**; amber LED indicator text approx **#FFB300** on black; typeface Johnston100 / NJ Font Medium for all train labels (train number 120 mm caps on the 1996 stock front, 45 mm on the S7 front, 80 mm car numbers on both).

### 8.5 What is visible from the platform `[memory-high]`

Jubilee: 7 cars, 126.5 m, filling the PED screen end-to-end; from mid-platform the whole train is visible through the glass, the front DM cab stopping at the far end of the screen. District/Circle: 7 cars, 117.4 m, entire train visible on the curved platform with the DM cab c. 10–20 m short of the east-end platform ramp. Both stop with all doorways aligned; no selective door opening at Westminster.

---

## 9. Operations

### 9.1 Jubilee line frequency and service pattern `[verified]`

- **Peak 30 tph on the core (Stratford–West Hampstead) = a train every 2 min; off-peak 24 tph = every 2.5 min**; TfL's station page says 'every 2–5 min'; a 100-second (36 tph) capability is cited from the signalling upgrade.
- **Peak pattern: 18 tph Stratford–Stanmore, 4 tph each to Wembley Park, Willesden Green and West Hampstead. Off-peak: 12 tph Stanmore + 4 tph each to the three short-turn points.** So westbound (Platform 4) destinations rotate Stanmore / Wembley Park / Willesden Green / West Hampstead (late evening also Neasden / Canons Park — a photographed indicator reads 'CANONS PARK 1 min'); eastbound (Platform 3) is almost always **Stratford**, occasionally **North Greenwich** (common), West Ham (peak/depot), Waterloo / London Bridge (disruption).
- **Dwell at Westminster: c. 30–45 s peak, 25–35 s off-peak** (rolling-stock) / 30–40 s peak, 20–25 s off-peak (audio) `[estimate]`. Run time to Green Park c. 2 min (recorded 2:37 westbound), to Waterloo c. 1.5–2 min (recorded 1:31).
- Since 2011 ATO under Thales SelTrac S40; stops are automatic and consistent.

### 9.2 District/Circle frequency `[verified]`

- **District: 21 tph peak, 18 tph off-peak** through the Victoria–Westminster–Embankment section (GLA Mayor's answer). **Circle: c. 6 tph (every c. 10 min; Wikipedia gives 8–12 min at Westminster).** Combined c. **27 tph peak (average 2.2 min), c. 24 tph off-peak (2.5 min)**; Wikipedia lists District every 2–6 min. The audio researcher's summary: District 18–24 tph + Circle 6 tph, roughly a train every 2–3 min per direction.
- Destinations — eastbound: **Upminster (most), Barking, Dagenham East, Tower Hill (frequent short-turn), Plaistow (rare)**, and Circle trains to Hammersmith via Tower Hill / Liverpool Street / King's Cross. Westbound: **Wimbledon, Richmond, Ealing Broadway, Edgware Road (via High Street Kensington)**, occasional Kensington (Olympia) and Earl's Court / Parsons Green short-turns, and Circle trains to Edgware Road via Victoria / High Street Kensington.
- Central-area sub-surface signalling is CBTC (Thales SelTrac) with ATO east of Barons Court, so S7 stops at Westminster are automatic. **Dwell c. 30–40 s** (rolling-stock) / 25–35 s (audio).

### 9.3 Approach, stop and departure profiles `[estimate]` (S7 figures `[verified]`)

- **Jubilee (ATO):** the Green Park–Westminster (c. 1.1 km) and Westminster–Waterloo (c. 1.0 km) hops peak at roughly 60–70 km/h. Arrival: steady ATO service braking c. 0.8–1.0 m/s² from c. 60 km/h over c. 180–220 m, easing (jerk-limited) to a precise stop at the PED datum in c. 15–20 s from tunnel mouth; the train enters the platform at c. 35–40 km/h. Departure: c. 0.9–1.0 m/s² with the stepped GTO whine, exiting the platform at c. 35–40 km/h.
- **District/Circle (S7, ATO):** braking 1.15 m/s² service, entering at c. 35–45 km/h, stopping in c. 12–15 s; departure at 1.3 m/s² (feels brisker than the Jubilee train), leaving the platform end at c. 45 km/h.
- Both stop with a slight brake-release lurch.

### 9.4 Door sequences and timings

- **LU network standard: 1.75 ± 0.25 s between the start of the door-closure warning and the doors starting to move** (LU rejected the 3 s RVAR value after trials showed a 'hustle' effect; S stock received RVAR exemptions) `[verified]`.
- **1996 Stock at Westminster:** train stops → 1–2 s → operator/ATO opens doors (train doors and PEDs together; leaves take c. 1.5–2.5 s to open) → dwell → door-close initiated: DVA 'Please stand clear of the doors' + pulsed hustle alarm (see §10.3) → 1.75 s → doors close (c. 2.5–3 s) → 'thunk' → c. 2–3 s door-interlock proving → ATO departure. `[verified]` framework, `[estimate]` durations.
- **S7 at Westminster:** stop → 'pshh' → doors open c. 1.5 s later → dwell → pulsed alarm c. 2.5–3 s → all doors slam in unison → repeated 'pshh-pshh-pshh' under the train → departure. `[memory-medium]`

### 9.5 Next-train indicators (all four platforms)

- Standard LU **3-line amber LED dot-matrix** (Trueform/Infotec type): **1066 × 393 × 178 mm single-sided, 32 characters per line, amber LEDs approx #FFB300 (signage researcher: #FF9E1B with a dim glow halo) on a black face, laminated safety-glass front**, ceiling-suspended (JLE units are slim black housings roughly one-third and two-thirds along the platform, double-sided) or fascia-mounted; signage researcher: c. 1.2 m wide × 0.4 m high, 3 rows of c. 50 mm characters (7 × 5 dot font, dot pitch c. 7 mm) plus a scrolling bottom line, underside c. 2.6 m above the platform `[verified]` dimensions; format `[memory-medium]`.
- Format: rank, destination, minutes right-aligned — Jubilee: **'1 Stratford        2 min' / '2 Stratford        4 min' / '3 North Greenwich  7 min'**; the third line alternates with a clock **'21:14:37'** (HH:MM:SS) or '16:07' and scrolling messages such as **'*** Please stand behind the yellow line ***'** and **'Mind the gap between the train and the platform'**. Times count down in whole minutes with 'min' (singular; photographed boards at Westminster also show 'mins'); as a train arrives the time field shows '-', asterisks or blanks, or the row drops off.
- District/Circle examples: **'1 Upminster  3 min', '2 Circle via Tower Hill  5 min'**; westbound **'1 Wimbledon  2 min', '2 Edgware Rd via Victoria  6 min', '3 Ealing Bdy  9 min'**; Circle trains are labelled 'via …' (or simply 'Circle line'); photographed: '1 RICHMOND 1 min / 2 EALING BROADWAY 3 mins', '1 Upminster / 2 Tower Hill 2 mins'. A 2011 Westminster recording describes the indicator/PA content as **'The next train to Stratford will arrive in 2 mins — next station Waterloo'**.

### 9.6 Wind (piston effect) `[estimate]`

Measured metro data show c. 6 m/s at a tunnel portal/platform end decaying to c. 2 m/s within 10 s of the train braking; design criteria cap platform gusts at c. 5 m/s. Jubilee platforms: the PED screen blocks most of it, but the open gap above the c. 2.5 m screen still passes a **2–4 m/s gust 5–15 s before the train appears**. District/Circle: the large cut-and-cover cross-section gives a milder **1–2 m/s draught**, most noticeable at the platform ends.

---

## 10. Audio

### 10.1 Who says what (canonical, 2026) `[verified]` names; assignment at Westminster `[memory-high]`

| Where | Voice | Notes |
|---|---|---|
| Jubilee 1996 Stock on-train DVA | **Celia Drummond** (RP female, 'sing-song' intonation; set recorded c. 2005 — an unused Charing Cross file is dated 2005; she died 2021) | Since 2022–23 a few Jubilee station files (Canary Wharf, Canning Town, North Greenwich, Stratford) were re-recorded by Sarah Parnell for Elizabeth-line interchanges; **the Westminster files remain Celia Drummond**. The 'This train terminates at…' fragment uses the original 1990s-era recording while 'next station'/'this station' were re-recorded, so the voice timbre changes mid-announcement. Special alerts on the Jubilee use a **male** announcer (unique on LU). |
| District & Circle S7 Stock on-train DVA | **Sarah Parnell** (brighter, clipped female RP; recorded 2009–10) | |
| Station platform PA (TfL 'Connect' / PAVA long-line) | **Elinor Hamilton** (female; 'next train', service-status and safety messages) with **Phil Sayer** (male) for the short **'Mind the gap please'** and **'Stand clear of the doors please'** inserts | Emma Clarke is NOT heard at Westminster (Bakerloo/Central/W&C); Julie Berry is Piccadilly only; Louisa Gummer only new Northern files. Phil Sayer's Jubilee 'Please mind the gap between the train and the platform' recording was in use 2005–2016. |

### 10.2 Jubilee line on-train script (Celia Drummond)

**Eastbound (towards Stratford), Green Park → Westminster → Waterloo** `[memory-high]`; format corroborated by the ilyabirman.net catalogue:
1. Leaving Green Park: **'This train terminates at Stratford.'** then **'The next station is Westminster. Change for the District and Circle lines.'**
2. Braking into Westminster / doors opening — two recorded variants:
   - Audio researcher `[memory-high]`: **'This is Westminster. Change for the District and Circle lines. Exit for the Houses of Parliament and Westminster Abbey.'**
   - Rolling-stock researcher `[memory-high]`, matching the ilyabirman-verified format 'This station is Canary Wharf. Change here for the DLR. This train terminates at Stratford': **'This station is Westminster. Change here for the Circle and District lines. This train terminates at Stratford.'**
   - Architecture researcher `[memory-medium]`: 'This is Westminster. Change here for the Circle and District lines.' with some versions adding 'Exit here for the Houses of Parliament and Westminster Abbey'.
   - **Verdict:** use **'This station is Westminster. Change here for the District and Circle lines. Exit here for the Houses of Parliament and Westminster Abbey.'** — 'This station is' / 'Change here for' is the verified Jubilee arrival format; 'District and Circle' ordering is the audio specialist's high-confidence recollection for the Drummond set (the alphabetical 'Circle and District' is the S7/Parnell convention); keep the exit clause. Ship all three as switchable strings.
3. Door close: [1996-stock door alarm] + **'Please stand clear of the doors.'** (a YouTube commenter: 'I love the Please stand clear of the doors announcement'). The rolling-stock researcher instead gives a male **'This train is now ready to depart. Please stand clear of the closing doors.'** — recorded as an alternative; the Drummond line is preferred because it is corroborated.
4. Departing: **'This train terminates at Stratford.'** → **'The next station is Waterloo. Change for the Bakerloo, Northern and Waterloo & City lines, and National Rail services.'**

**Westbound (towards Stanmore), Waterloo → Westminster → Green Park** `[memory-medium]`:
1. Leaving Waterloo: **'This train terminates at Stanmore.'** (alternatives: 'Wembley Park', 'Willesden Green', 'West Hampstead'; 'Neasden' / 'Canons Park' late evening.) **'The next station is Westminster. Change for the District and Circle lines.'**
2. Arrival: as eastbound.
3. Doors: alarm + 'Please stand clear of the doors.'
4. Departing: **'This train terminates at Stanmore.'** → **'The next station is Green Park. Change for the Piccadilly and Victoria lines.'**
5. At a terminus: **'All change please. This train terminates here. All change please.'**

**Rules:** the Jubilee is the only line whose DVA never says its own name — it uses 'This train terminates at X', never 'This is a Jubilee line train to X' (the architecture researcher's 'This is a Jubilee line train to Stanmore' is therefore wrong and not to be used). Some 2016-era files added **'Doors will open on the left-hand side' / 'right-hand side'** at each station (YouTube, July 2016) — optional flavour, not consistently heard today.

### 10.3 1996 Stock door sounds `[memory-medium]`; timing standard `[verified]`

- Opening: no chime — a brief air/relay click, then the twin-leaf doors run open with a soft rubber-edge slap; c. 1.5 s.
- Closing: 'Please stand clear of the doors.' while a **pulsed electronic alarm sounds from every door pillar: a shrill, slightly harsh 'bee-bee-bee-bee', c. 2.5–3 kHz fundamental with strong harmonics, c. 5–6 pulses per second (≈ 90 ms on / 90 ms off; rolling-stock: 4–6 pulses/s), continuing c. 3–4 s until the doors are proven closed, then a 'thunk' as the leaves meet.** Not a musical chime. Warning-to-movement 1.75 ± 0.25 s.

### 10.4 District line on-train script (S7, Sarah Parnell) `[verified]` wording from fan transcripts of 2022 recordings

Structure: arrival = station name + interchange; departure = destination + next station + interchanges + exits.
- **Eastbound, leaving St James's Park:** **'This is a District line train to Upminster. The next station is Westminster. Change for the Jubilee line. Exit for Westminster Abbey, the Houses of Parliament and riverboat services from Westminster Pier.'**
- **Arriving:** **'This is Westminster. Change for the Jubilee line.'** (fan transcript: 'Westminster – Change for the Jubilee Line. Exit for Westminster Abbey, The Houses of Parliament and Riverboat Services from Westminster Pier.') followed, where flagged, by **'Please mind the gap between the train and the platform.'** (updated 2015; model it as played at Westminster because of the curve `[memory-medium]`).
- **Departing eastbound:** **'This is a District line train to Upminster. The next station is Embankment. Change for the Bakerloo and Northern lines, and National Rail services from Charing Cross. Exit for riverboat services from Embankment Pier.'**
- **Westbound, leaving Embankment:** **'This is a District line train to Wimbledon. The next station is Westminster. Change for the Jubilee line. Exit for Westminster Abbey, the Houses of Parliament and riverboat services from Westminster Pier.'** Arrival as above. **Departing westbound:** **'This is a District line train to Wimbledon. The next station is St James's Park.'** (the St James's Park file is plain — no interchange, no standard exit clause).
- Westbound destination variants: 'This is a District line train to Richmond / Ealing Broadway / Edgware Road / Kensington (Olympia) / Earl's Court / Parsons Green'. Other files: **'The front doors will not open at the next station.'**; **'The destination of this train has now changed. This train is now a District line train to Wimbledon. Please change where necessary.'**; **'Customers are reminded that smoking and drinking alcohol is not permitted on TfL services.'**; **'Please keep your belongings with you at all times.'** Rule: the S7 destination line is 'This is a District line train to X' — never 'terminates at'. 'This train is now ready to depart. Please stand clear of the doors.' is NOT an S7 file. A 2013 D-stock script snippet reads 'The next station is Westminster. Change for the Jubilee Line.'

### 10.5 Circle line on-train script (S7, Sarah Parnell) `[memory-medium]`; 'via' phrasing `[verified]`

- **Eastbound at Westminster** (from Victoria, heading Embankment → Tower Hill → Liverpool St → King's Cross → Baker St → Edgware Road → Paddington → Hammersmith): **'This is a Circle line train to Hammersmith via Liverpool Street and King's Cross St. Pancras.'** (the same via-phrases appear on District files: 'Change here for the Circle line via Liverpool Street and King's Cross St. Pancras' at Tower Hill; 'Circle line via High Street Kensington and Paddington' at South Kensington).
- **Westbound at Westminster:** **'This is a Circle line train to Edgware Road via Victoria and Paddington.'** (rolling-stock variant: 'via Victoria and High Street Kensington').
- Station files are shared with the District ('The next station is Westminster. Change for the Jubilee line. Exit for Westminster Abbey, the Houses of Parliament and riverboat services from Westminster Pier.' / 'This is Westminster. Change for the Jubilee line.'), plus 'Please mind the gap between the train and the platform.' at flagged stations, spoken right after 'This is X'.

### 10.6 S7 door sounds — conflict recorded

- **Rolling-stock researcher** `[verified]` sources: LU's two-tone 'door alarm' (Londonist: the same two notes as the opening of the *Home Alone* theme) followed by rapid high-pitched beeps during closure; Classic FM's transcription of District line doors: a short 6/8 motif on opening, then a 'cheerfully chirruping semiquaver passage' (fast beeps, c. 6–8 per second, c. 2.8 kHz) accompanying the closing doors; doors close in c. 2.5 s.
- **Audio researcher** `[memory-medium]`: opening is a single soft release — an air 'pshh' then the leaves glide open (c. 1.5 s), no chime; closing is a rapid pulsed alarm from each doorway (c. 2.7–3 kHz, c. 7–8 pulses/s, c. 2.5–3 s), then **all doors 'slam' in unison with a solid house-door-like 'clunk'** ('when they fully shut it sounds like a normal door from a house', 'they all close at the exact same time', 'sounds like a gun shot'); a repeated air 'pshh-pshh-pshh' is audible under the train after closing; optional spoken **'Please mind the doors'** (low confidence; many riders describe the close as beeps-only).
- **Verdict:** both are partly right — model a short two-note motif at the moment of opening (two sourced articles), the fast semiquaver beeps on closing, and the unison slam; leave the spoken line off by default.

### 10.7 Platform PA at Westminster

**District/Circle platforms (Elinor Hamilton, current form)** `[verified]` — verbatim example recorded at Westminster in 2021:
> **'The next train will be a Circle line service calling at all stations to High Street Kensington. Please stand behind the yellow line as the train approaches, use the full length of the platform, and let customers off the train first.'**

Template: 'The next train will be a [District/Circle] line service calling at all stations to [Upminster / Tower Hill / Wimbledon / Richmond / Ealing Broadway / Edgware Road / Hammersmith]. Please stand behind the yellow line as the train approaches, use the full length of the platform, and let customers off the train first.' Elinor is noticeably upbeat on 'Circle line'. Older (pre-S7, c. 2010–2016) form at the same platforms: 'Platform 1: the train now approaching is to Upminster.' / 'The train now approaching is a Circle line train via [Liverpool Street / Victoria] to …' (a commenter notes the wording changed when S7 arrived). Phil Sayer insert as trains arrive: **'Mind the gap please.'** Generic: **'The next train is now approaching. Please stand behind the yellow line.'**; **'Please mind the gap between the train and the platform.'**

**Jubilee platforms** `[memory-medium]`: same template — **'The next train will be a Jubilee line service calling at all stations to Stratford.'** (or North Greenwich / Stanmore / Wembley Park / Willesden Green / West Hampstead). As the train prepares to leave, a male **'Stand clear of the doors please'** (Phil Sayer) can be played from the platform speakers, overlapping the train's own line. No yellow-line message is needed; instead occasional **'Please stand clear of the platform edge doors'** / **'Please let customers off the train first'**.

**Safety/security files (all levels)** `[verified]` security text: **'This is a security message. If you see something that doesn't look right, speak to staff or text the British Transport Police on 61016. We'll sort it. See it. Say it. Sorted.'** (station version, male voice); **'Please keep your belongings with you at all times and report anything suspicious to a member of staff.'**; **'For your safety, please hold the handrail on the escalators.'**; staff in the peaks: 'Please keep moving / hold the handrail'.

**Service status (Elinor Hamilton)** `[verified]` templates: **'This is a London Underground service update. There is a good service on all London Underground lines.'** / **'There are severe delays on the Bakerloo line between Harrow & Wealdstone and Queen's Park, due to an earlier points failure at Willesden Junction. Tickets will be accepted on London Buses.'** / **'The District line is part suspended in both directions between Wimbledon and Earl's Court … due to a signal system failure. Tickets are being accepted on South Western Railway and London Buses.'**

**Emergency** `[verified]`: coded fire pre-alarm **'Would Inspector Sands please report to the operations room immediately.'** (variants '…please go to the operations room immediately' / '…report to Platform 2'), repeated until cancelled; if escalated, **'Attention please. This is an emergency. Please leave the station immediately.'** A 2019 clip documents a fire-alarm test at Westminster (tests are out of hours / early morning).

**Ticket gates** `[memory-medium]`: valid touch = single short high beep (c. 2 kHz, c. 100 ms) + green light + display 'ENTER' with fare/balance; paddles snap open with a pneumatic 'thump-hiss' (c. 0.4 s) and close c. 1 s after you pass with a softer 'clack'; rejected touch = longer double 'beep-beep' at the same or slightly lower pitch + red light + display **'SEEK ASSISTANCE'** (no voice); rapid re-beep if touched too quickly. Evening peaks: a continuous cascade of beeps at c. 1–2 per second across c. 14–15 gates, echoing off the concrete ceiling.

### 10.8 On-train sequence template for scripting `[memory-medium]` (synthesis)

**Jubilee (1996 Stock, ATO) at Westminster:** T−15 s wind through the PED gap; T−6 s descending GTO whine + flange squeal; T0 stop, brake hiss; T+0.5 s PEDs + train doors open (whir/clunk), DVA arrival line (≈ 6 s); dwell 30–40 s peak / 20–25 s off-peak; door alarm + 'Please stand clear of the doors.' (≈ 3.5 s); doors/PEDs close, clunk; 1–2 s pause; departure GTO spool-up with 3–4 pitch steps over c. 20 s; after c. 3 s 'This train terminates at Stratford.' then 'The next station is Waterloo. …'. Platform PA fires 'The next train will be a … service calling at all stations to …' about 60–90 s before each arrival.

**District/Circle (S7) at Westminster:** T−8 s rail singing + whoosh; T−4 s smooth descending whine + squeal; T0 stop, pshh; doors open c. 1.5 s later; 'This is Westminster. Change for the Jubilee line. [Please mind the gap between the train and the platform.]' (≈ 5–7 s); dwell 25–35 s; pulsed alarm ≈ 3 s, unison slam; departure line spoken while the IGBT whine rises; 'Mind the gap please' (Phil Sayer) from the platform as the train enters.

### 10.9 Escalators, box drone and ambience `[estimate]` figures; hardware `[verified]`

17 O&K escalators (Kone-maintained) at 0.75 m/s with 400 mm steps. Per escalator: a continuous step-chain rumble centred c. 60–120 Hz, a higher handrail-drive whine (c. 400–600 Hz), and a rhythmic 'tick-tick' as steps flatten through the comb plates (≈ 2.5 steps/s). The combined drone from 6+ machines is the dominant steady background in the box (c. 58–62 dB(A)), with the PA arriving smeared and echoing; occasional beeps from escalator emergency stop/restart. Jubilee platforms: the train pistons air ahead of it — broadband rushing noise (c. 40–60 dB(A) rising) 10–15 s before the headlights, then the box fills with low rumble (20–80 Hz). Jubilee headway at peak is 2 min, so on the JLE platforms there is almost always a train arriving, dwelling or leaving.

### 10.10 Big Ben — the Westminster Quarters `[verified]`

- Four quarter bells: **G♯4, F♯4, E4, B3** (John Warner & Sons, 1857–58; weights ≈ 1.1 t, 1.3 t, 1.7 t, 4 t). Equal-temperament reference pitches: **B3 246.9 Hz, E4 329.6 Hz, F♯4 370.0 Hz, G♯4 415.3 Hz** (the real bells sit a few cents off).
- Five changes, each = 3 crotchets + 1 minim:
  - **Change 1: G♯4 F♯4 E4 B3**
  - **Change 2: E4 G♯4 F♯4 B3**
  - **Change 3: E4 F♯4 G♯4 E4**
  - **Change 4: G♯4 E4 F♯4 B3**
  - **Change 5: B3 F♯4 G♯4 E4**
- **Quarter past = change 1. Half past = changes 2, 3. Quarter to = changes 4, 5, 1. On the hour = changes 2, 3, 4, 5** — i.e. notes 5–20 of the once-repeating 20-note sequence; the quarter-past phrase (change 1) is never heard in the hour version. Strike counts: each change is 4 bell strikes, so quarter = 4, half = 8, three-quarter = 12, hour = 16 strikes; the audio researcher's text gave '5 / 10 / 15 / 20 notes' for the four phrases (counting each change as 5) — an internal inconsistency with the 20-note total, resolved here as 4 strikes per change `[verified]` against the Wikipedia change tables. The E bell needs two hammers because change 3 strikes it twice in quick succession.
- **Tempo:** crotchet ≈ 1 s, minim ≈ 2 s with a short rest, so ≈ 5 s per change (quarter ≈ 5 s, half ≈ 10 s, three-quarter ≈ 15 s, hour ≈ 20 s). **The hour chime starts about 25 s before the hour so that the FIRST stroke of Big Ben lands on the hour. Hour strokes are spaced ≈ 4.5 s apart** ('drops a hammer on the bell every 4.5 seconds'): 12 strokes ≈ 50 s. Bells chime every quarter, 24 h a day. Clock-room plaque: *'All through this hour / Lord be my guide / And by Thy power / No foot shall slide.'*
- **Great Bell:** 13.7 t, 2.29 m tall, 2.74 m diameter; cracked in 1859 and never repaired — turned an eighth-turn with a lighter hammer, giving its slightly off, buzzy, non-harmonic tone. Measured **nominal partial ≈ 335 Hz (E4 + 27 cents), 'doubletted'** (split into two close frequencies c. 1–2 Hz apart, producing the slow warble after each strike). **Perceived strike note E3 (≈ 167 Hz).** A strong **secondary strike at ≈ 440 Hz (A4) generated by a partial at ≈ 883 Hz** — why many listeners hear an 'A'. Synthesis partials `[estimate]` from bell-tuning ratios: hum ≈ 80–85 Hz, prime ≈ 165–170 Hz, tierce ≈ 200 Hz, quint ≈ 250 Hz, nominal 335 Hz (×2 doublet), superquint ≈ 500 Hz, octave nominal ≈ 670 Hz, plus the prominent ≈ 883 Hz; decay of hum/prime ≈ 15–25 s, upper partials ≈ 3–6 s. Inside the belfry the strike measures 110–115 dB.
- **Audibility** `[estimate]`: belfry c. 55 m above street; at the Bridge Street / Westminster Bridge entrances and on Parliament Square the bells are loud and clear (70–80 dB(A), well above traffic), sounding from high up and slightly SW of the Bridge Street entrance. In the ticket hall faintly audible only near the stair openings and through vent grilles (40–50 dB(A), mostly the 80–170 Hz hum/prime and the 440 Hz secondary strike); **not audible on the D&C platforms or anywhere in the Jubilee box**. Model as an exterior emitter with heavy low-pass filtering and c. 0.2 s extra reverb when heard from inside.

### 10.11 Reverb summary per space `[estimate]`

| Space | RT60 (mid-band) | Character |
|---|---|---|
| Jubilee box / void | 3.5–5 s | boomy, flutter echoes between parallel walls, escalator drone bed, multi-directional PA with 100–300 ms echoes |
| Jubilee platforms (behind PEDs) | 1.5–2 s | directional along the tunnel axis; quiet (~50 dB(A)) with no train |
| District/Circle platforms | 2–2.5 s (≈ 1 s with an S7 stood) | open-ended box, cross-platform PA leakage, rail singing on approach |
| Ticket hall | 1.5–2 s | gate beeps dominate; street noise and Big Ben down the stairs |
| Subways | (not estimated) | white glazed brick, hard; similar to ticket hall |

---

## 11. Street level

### 11.1 Bridge Street geometry `[verified]` alignment; widths `[estimate]`

Bridge Street: 155 m long, bearing 93°, two-way (eastbound onto the bridge, westbound into Parliament Square), 20 mph. **Building-face to Palace-railing distance opposite Portcullis House c. 30 m**: north footway (under/along the colonnade) c. 6 m, carriageway c. 17–18 m (2 lanes each way plus bus stop and cycle provision), south footway in front of the Palace railings c. 7 m (heavily used by tourists photographing Big Ben). **Frontage sequence, NORTH side, west to east:** 1 Parliament Street (Victorian, c. 27 m frontage), Cannon Row (c. 5 m gated lane), **Portcullis House (77 m frontage)**, then the Victoria Embankment junction (c. 40 m of junction/pavement), then the bridge. **SOUTH side, west to east:** the Carriage Gates and the 2.1 m Barry railings of New Palace Yard with lime and catalpa trees behind, then the **Elizabeth Tower base (12.2 m square, standing c. 8–10 m back from the kerb behind railings)**, then the Palace's NE corner (Speaker's House), which abuts the bridge. Victoria Embankment meets Bridge Street at a signalised T-junction immediately west of the bridge abutment.

### 11.2 Portcullis House `[verified]` unless noted

- **Size:** 77 × 50 m footprint; OSM building:levels=7 (Hopkins: six storeys above ground around a central atrium); floor area 20,000 m² (also quoted 20,000–25,000 m²); offices for 210 MPs (about one third of the Commons); £235m. Heights `[estimate]`: eaves/parapet c. 27–30 m, ridge of the steep bronze roofs c. 36 m, chimney tops c. 43–45 m — deliberately the same height order as the adjacent Norman Shaw buildings.
- **Facade:** Hopkins: 'Perimeter walls are formed in sandstone piers flanked by bronze clad ducts.' Base of **granite from Devon**; columns of **post-tensioned Birchover Gritstone** (a Derbyshire pinkish-buff sandstone); **aluminium bronze** for exposed metal on roof and walls (120-year design life). Visual recipe `[estimate]`: a regular grid of tall slender vertical sandstone piers (c. 1.2 m wide, bays c. 3.5–4 m centre to centre, roughly 20 bays on Bridge Street) with dark bronze vertical duct strips either side of each pier and deep-set dark tinted windows between. Colours: **sandstone warm pinkish-buff c. #C4A48A (shadows c. #8E7560); bronze ducts/roof dark chocolate-bronze c. #4A3A2C weathering toward olive-brown c. #5B5548; granite plinth grey-pink c. #8C8481; glazing very dark blue-grey c. #25313A.**
- **Roof and chimneys:** steeply pitched, mansard-like aluminium-bronze (black-bronze) roofs around all four sides; an 'array of **14 distinctive chimneys**' — terminals of an unpowered natural-convection ventilation system, NOT flues, intended to recall the Victorian Gothic of the Palace; tall rectangular-section tapering stacks (c. 1.5 × 2 m plan, rising c. 6–8 m above the ridge, dark bronze/near-black c. #2C2A26 with louvred/flared heads) in two rows along the long sides (roughly 5 per long side and 2 per short side) `[memory-high]` arrangement. 'Bronze and steel box girders form roof frames.' The central courtyard is covered at 2nd-floor level by a frameless glass skin on an oak-and-stainless-steel diagrid; fig trees and two shallow water pools (interior only).
- **Ground floor / entrance:** an open arcade/colonnade of massive stone piers along the Bridge Street and Embankment frontages. Hopkins: 'The station is entered from the colonnade of Portcullis House.' The entrance is a **c. 12 m wide by c. 2 m deep recess in the centre of the 77 m frontage (between lon −0.12497 and −0.12480; 39 m from the SE corner, 38 m from the SW corner)**, a dark, tall opening between piers with stairs (16 steps) and lifts descending to the ticket hall; **flanked by a Tesco Express (west) and a Caffè Nero (east), with a glass canopy and a blue 'WESTMINSTER STATION' sign and roundel** `[verified]`. A large freestanding illuminated roundel totem stands at the kerb (c. 1 m diameter on a c. 3.5 m grey pole) and a roundel with 'UNDERGROUND' plus a blue 'Westminster' name panel is fixed to the stone at the opening `[memory-medium]`; taxi drop-off and black steel bollards along the kerb `[memory-medium]`. Colonnade floor honed grey granite `[estimate]`.

### 11.3 Elizabeth Tower (Big Ben) `[verified]` unless noted

**Height 96 m (316 ft); square base 12.2 m (40 ft) per side; 334 steps to the belfry; four clock dials each 6.9 m (22.5 ft) diameter made of 324 pieces of opalescent glass; hour hand 2.7 m, minute hand 4.3 m.** Below each dial the gilded Latin inscription **'DOMINE SALVAM FAC REGINAM NOSTRAM VICTORIAM PRIMAM'**. Clad in sand-coloured Anston magnesian limestone (later Clipsham repairs); pyramidal cast-iron-tiled roof (OSM roof:height 35 m, so the stone shaft is c. 61 m and the belfry + spire c. 35 m); Ayrton Light lantern above the belfry, lit whenever the Commons sits after dark. The 2017–22 restoration reinstated **Prussian blue (c. #003153) dial frames and hands, regilded ornament (c. #C9A227), and repainted the St George's cross shields red and white**. Suggested stone colours post-cleaning: **pale honey-cream c. #D9CBA8 with soot-darkened recesses c. #8F8672** `[estimate]`. The tower leans c. **0.26° to the NW** `[memory-high]`. Dial centres roughly 55 m above street `[estimate]`. Centre approx 51.50070 N, 0.12457 W. Belfry c. 55 m above street. Night: dials lit warm white, Ayrton Light on.

### 11.4 Palace of Westminster and New Palace Yard `[verified]`

Anston sand-coloured magnesian limestone; long axis parallel to the Thames; **Victoria Tower 98.5 m** at the SW corner, **Central Tower 91 m**, Elizabeth Tower 96 m at the north end; floor area 112,476 m². **New Palace Yard** occupies the NW corner: Bridge Street to the north, the Palace north front and Big Ben to the east, Westminster Hall to the south, Parliament Square to the west; accessed through the Carriage Gates from Parliament Square; enclosed by **Edward Barry's railings, 2.1 m (7 ft) high, completed 1868** (black-painted cast iron with gilded finials `[memory]`); contains a formal avenue of lime trees, old catalpa trees, the **1977 Silver Jubilee Fountain by Walenty Pytel** (welded steel animals topped by a gilded crown) and a **five-level 450-space underground MPs' car park**; now a closed secure area. Cromwell statue (Hamo Thornycroft, 1899) in front of Westminster Hall; PC Keith Palmer memorial by the Carriage Gates. Security `[memory-medium]`: rows of black/dark-grey PAS68 bollards c. 1 m high at c. 1.2–1.5 m spacing along the Bridge Street south footway and St Margaret Street, rising bollards and a police/security booth at the Carriage Gates, armed police officers, steel security fencing/planters; the New Palace Yard gate checkpoint (radios, vehicle barriers).

### 11.5 Westminster Bridge `[verified]` unless noted

**Length 250 m (820 ft), width 26 m (85 ft), seven cast-iron arches** with Gothic detailing by Charles Barry, designed by Thomas Page, **opened 24 May 1862**; Grade II* (1981); painted predominantly **green, 'the same colour as the leather seats in the House of Commons'** (Lambeth Bridge is red for the Lords); refurbished 2005–07. Suggested paint `[estimate]`: **mid-dark leaf green c. #2F5F3F** (flat overcast c. #3E6B4A, shadow c. #1F3F2B). Parapets: pierced Gothic cast-iron panels (trefoil/quatrefoil tracery) c. 1.2 m high on a stone plinth; arch spandrels carry gilded and coloured shields/coats of arms of Victoria and Albert; deck: two traffic lanes each way with painted cycle lanes and c. 4 m footways each side `[memory-high]`. Runs ESE (bearing c. 95°) from the west abutment at 51.5009, −0.1237. **Lamp standards** `[memory-high]`: original 1862 ornate Gothic cast-iron standards on the parapet line, c. 4.5–5 m tall, green with gilt highlights, each with a single tall octagonal lantern with a pointed crown; over each pier and at mid-span, spacing c. 18–20 m (c. 13 per side); solid granite piers with a lamp each at the west abutment; warm-white lamps at night (c. 2700–3000 K). **Post-2017 barriers** `[memory-medium]`: continuous vehicle barriers between carriageway and both footways along the full length — initially concrete-and-steel temporary units, later a permanent line of dark-grey steel hostile-vehicle-mitigation barriers roughly 1 m high at the kerb edge. A lone bagpiper busks on the bridge (documented every year 2009–2023).

### 11.6 Boadicea and Her Daughters `[verified]` text; size/position `[estimate]`

Bronze group by Thomas Thornycroft (modelled 1856–1885, completed by Mary and W. Hamo Thornycroft), erected June 1902 by the LCC; Grade II. At the north side of the western end of Westminster Bridge where the parapet meets Victoria Embankment, 'facing Big Ben and the Palace of Westminster' (horses rear toward the SW/W). A scythed chariot drawn by two rearing horses; Boudica upright with a spear in her right hand, left hand raised; two crouching daughters. Granite plinth by Thomas Graham Jackson. Inscriptions — front: **'BOADICEA / (BOUDICCA) / QUEEN OF THE ICENI / WHO DIED A.D. 61 / AFTER LEADING HER PEOPLE / AGAINST THE ROMAN INVADER'**; right side: **'REGIONS CAESAR NEVER KNEW / THY POSTERITY SHALL SWAY'**; left side: **'THIS STATUE BY THOMAS THORNYCROFT / WAS PRESENTED TO LONDON BY HIS SON / SIR JOHN ISAAC THORNYCROFT C.E. / AND PLACED HERE BY THE LONDON COUNTY COUNCIL / A.D. 1902'**. Size: plinth c. 4.5 m high × c. 6 m long, bronze group c. 4.5 m high, total c. 9 m. Position estimate 51.50098 N, 0.12360 W. **Bronze dark green-brown patina c. #3E4A3A; grey granite c. #7D7A76.** The Exit 2 stair emerges beside it under the black cast-iron 'Westminster Station / Public Subway / Toilets' arch.

### 11.7 Victoria Embankment `[verified]` unless noted

Bazalgette, 1860s–70: 'faced with granite', a tree-lined roadway and walkways 'surfaced with York paving stone', with decorative lamp posts on top of the wall. **'Dolphin' lamp standards** by George John Vulliamy (modeller Charles Henry Mabey), published March 1870, inspired by the Fontana del Nettuno dolphins: cast iron; two stylised dolphins/sturgeons writhe around the base supporting a fluted column bearing an opaque white globe topped by a metal crown; many on granite plinths; first lit with Yablochkov electric candles (Dec 1878), gas by 1884, electric again 1900; extra copies 1977; many Grade II. Model `[estimate]`: overall c. 4 m tall, **painted black c. #1A1A1A, globe c. 0.5 m diameter #F0F0EA** (warm white at night), spaced c. every 25–30 m along the parapet. River wall parapet grey granite c. 1.1 m high with a rounded coping; cast-iron lion-head mooring rings on the river face `[memory-high]`; **tide range c. 7 m**, so at low water a mud/shingle foreshore shows. **JLE vent grates:** four flush steel grate panels each c. 3.5 × 2 m in an N–S row at lon −0.12375, lat 51.50140–51.50163, plus a c. 12 × 0.5 m strip, on the wide riverside footway between the carriageway and the river wall — **dark grey steel c. #4A4C4E**, warm air and rumble rising when Jubilee trains pass. Taller modern lamp columns on the road side. Cycle Superhighway CS3 (East–West): kerb-segregated two-way track on the RIVER side of the Embankment past the pier, crossing at the Bridge Street junction and continuing along the north side of Bridge Street / Parliament Square toward Great George Street — green-surfaced at junctions, otherwise black asphalt with white lining `[memory-medium]`.

### 11.8 Westminster Pier `[verified]`

Westminster Millennium Pier, opened 2000 (Millennium Commission), 51.50174 N, 0.12314 W, on the north bank c. 90 m downstream of the bridge. Operated by Uber Boat by Thames Clippers (RB1/RB2/RB6), also City Cruises, Thames River Services and Thames River Boats (Greenwich, Tower, Kew/Hampton Court); OSM amenity=ferry_terminal, network=London River Services, Oyster/contactless, wheelchair=yes. Form `[memory-high]`: a floating pontoon with a covered waiting area reached by an articulated gangway ('brow') from a gap in the parapet; ticket kiosks/booths on the pavement (City Cruises red-and-white, Thames Clippers/Uber Boat black-and-white), trinket and ice-cream stands, railings, a 'Westminster Pier' totem — a busy, cluttered tourist zone. A predecessor floating pier sank on 7 Feb 1955.

### 11.9 Across the river `[verified]`

- **County Hall** (Ralph Knott, 1911–1922, later blocks 1936–39): six-storey Portland-stone Edwardian Baroque with a long curved colonnaded river front facing Westminster; OSM bbox lat 51.5009–51.5031, lon −0.1197 to −0.1178 (c. 230 m of frontage from the bridge's east end northward; centre c. 51.50197, −0.11874); **pale grey-cream stone c. #D6D2C4, green copper roofs**.
- **London Eye:** 135 m tall, 120 m diameter, 32 capsules (numbered 1–33 skipping 13, each 10 t, 25 people, c. 30 min rotation), cantilevered from an A-frame on one side only, rim held by tensioned cables like a bicycle wheel; between Westminster Bridge and Hungerford Bridge beside County Hall; hub c. 51.5033, −0.1196 — c. 443 m from the entrance at bearing 56°, appearing NE beyond County Hall's north end; **white-painted steel c. #E6E6E4**, lit at night (currently pink/red by sponsor; historically blue).
- **South Bank Lion:** Coade stone, 3.7 m tall × 4.0 m long, cast 24 May 1837, on a granite plinth at the east end of the bridge, north side; **pale cream c. #D9D3BF**.
- **River:** tidal; c. 230–250 m between walls; flows south-to-north; **opaque grey-green-brown c. #6B6E62, reflections c. #9AA0A0** under overcast sky; constant traffic of Thames Clippers (black hulls/white superstructure), City Cruises (red/white) and RIB tours.

### 11.10 Parliament Square and the Parliament Street corner `[verified]`

Laid out 1868; post-war redesign by George Grey Wornum (Parliament Square (Improvements) Act 1949); a large central lawn with trees on its west side, bounded by St Margaret Street (E), Great George Street / Broad Sanctuary (S/W) and Parliament Street (NE). Surroundings: Palace to the east; **Government Offices Great George Street / HM Treasury** (John Brydon, Portland stone Edwardian Baroque, 1908 east / 1917 west, Grade II*, curved corner onto the square) to the north; Middlesex Guildhall / Supreme Court to the west; Westminster Abbey and St Margaret's to the south. **Twelve statues** anti-clockwise from the NE: **Churchill** (Ivor Roberts-Jones, 1973; bronze 3.7 m on a 2.4 m plinth inscribed 'CHURCHILL', NE corner, 51.50084, −0.12643), Lloyd George (Glynn Williams 2007, 2.4 m, 51.50085, −0.12666), Jan Smuts (Epstein 1956, 51.50087, −0.12688), Palmerston, Earl of Derby, Disraeli, Peel, Canning, Lincoln (Saint-Gaudens copy, in front of Middlesex Guildhall), Mandela (Ian Walters 2007, SW), Gandhi (Philip Jackson 2015, W), Millicent Fawcett (Gillian Wearing 2018, NW). Paving `[memory-medium]`: York stone flags and grey granite, black bollards, heritage lamp columns. Traffic `[memory-medium]`: the roads on the north, west and south sides form a one-way **clockwise gyratory** (north side in front of the Treasury flows east toward Bridge Street; south side flows west; west side flows north) while St Margaret Street on the east is two-way for the Millbank bus corridor.

East side of Parliament Street from Bridge Street northward: 1 Parliament Street, 1 Derby Gate, 53 Parliament Street (5-storey brick, dark grey roof), **The Red Lion** (48 Parliament Street, Fuller's, 5 storeys, white stone front, dark grey roof; 51.5020, −0.1258), Richmond House (79 Whitehall, 4 storeys). Behind Portcullis House to the north on the Embankment: the **Norman Shaw Buildings** (Richard Norman Shaw and J. Dixon Butler, 1887–1906), 'banded red brick and white Portland stone on a granite base in the Victorian Romanesque style' with corner turrets — Norman Shaw South (51.5016–51.5019, −0.1242 to −0.1249) immediately north of Portcullis House across a narrow gap, then Norman Shaw North, then New Scotland Yard. **Red brick c. #8E3B2E banded with Portland c. #D8D4C6.**

### 11.11 Bus stops, traffic and street furniture

- **Bus stops (OSM NaPTAN)** `[verified]`: **Stop H 'Westminster Station / Westminster Pier' at 51.50102, −0.12524 — north kerb of Bridge Street directly in front of Portcullis House, 24 m WEST of the entrance** (eastbound toward the bridge/Waterloo), no shelter, flag on a pole; Stop G 'Westminster Station / Parliament Square' at 51.50153, −0.12598 (east footway of Parliament Street, 50 m north of the corner, southbound, shelter + bench); Stop A (51.50182, −0.12631, shelter + bench) and Stop C (51.50156, −0.12635, no shelter) on the west footway of Parliament Street (northbound toward Trafalgar Square); Stop F (51.50247, −0.12590) further north on the east side; Stop P 'Parliament Square / Westminster Abbey' at 51.50018, −0.12681; 'Westminster Pier' stop at 51.50162, −0.12390 on the river side of the Embankment (northbound, shelter + bench). Bus flag: white flag with red roundel and black stop letter on a grey pole; shelters standard TfL grey steel-and-glass with red roundel. Routes `[memory-medium]`: 3, 11, 12, 24, 53, 87, 88, 148, 159, 211, 453 plus night routes; **12, 53, 148, 159, 211, 453 cross Westminster Bridge**; Whitehall routes 3, 11, 24, 87, 88, 159, 453.
- **Traffic** `[memory-medium]`: UK left-hand; red double-deckers (New Routemasters, **red c. #DA291C**) and black cabs (**c. #0B0B0B**) queued at the Bridge Street lights, pedicabs, tourist coaches; westbound bus lane on Bridge Street (red surface) `[estimate]`; double red lines (TfL red route) along Bridge Street and the Embankment kerbs; yellow box junction at Embankment/Bridge Street; zebra/pelican crossings with black-and-white Belisha poles at the Parliament Street corner and the bridge end; 'LOOK RIGHT'/'LOOK LEFT' painted at crossings; pedestrian-crossing signals mostly rotating tactile cones with limited audible beepers (c. 2.5 kHz pulsed) at the Parliament Square crossings.
- **Paving** `[estimate]`: Bridge Street footways and the Palace side **York stone flags (buff-grey, c. 600 × 900 mm, c. #A89F87, wet c. #6E675A) with grey granite kerbs (c. #7F7F7A, 150 mm upstand)**; Parliament Square York stone and granite; Embankment riverside walk York stone with granite kerbs and setts near the pier; bridge footways asphalt/mastic with granite kerbs; **carriageways black asphalt c. #3B3B3B, worn c. #5A5A58**, white/yellow markings; drainage gullies, manholes.
- **Furniture** `[memory-medium]`: Westminster City Council heritage lamp columns — black cast-iron fluted columns c. 8–9 m tall with a large 'Windsor'-type lantern and gilt ladder bars; black cast-iron litter bins (Westminster crest); white enamel street nameplates with black text and red 'CITY OF WESTMINSTER' header (SW1); TfL Legible London wayfinding monoliths (dark blue/black, c. 2.2 m) including one at the top of each stair; traffic signal heads on grey poles; CCTV masts; police vehicles; red pillar box; souvenir stands; hot-dog carts near the Big Ben corner; Union flags on the Palace and Embankment flagpoles; tourist crowds concentrated at the Big Ben corner stair and around Boadicea.
- **Street entrance signage** `[memory-medium]`: each subway staircase has low granite parapet walls with stainless handrails and a pole-mounted, internally illuminated 3D box roundel (ring c. 0.9 m, bar c. 1.15 m) reading 'UNDERGROUND' in white Johnston caps, c. 3.5 m to the top, plus a blue panel on the parapet: roundel + 'Westminster' and the exit number; blue-and-white directional panels reading e.g. 'Subway to Westminster Station / Houses of Parliament / Westminster Abbey / Whitehall / Westminster Pier'; open-air stairs with dark-painted steel railings and cream/white tiled walls. Commons category 'Roundels at Westminster tube station' (61 files) includes 'Outside Westminster Underground Station, Bridge Street SW1', 'Underground and public subway sign' and 'London, Westminster – Underground Sign and Big Ben Clock Tower'.

### 11.12 Recommended time of day, weather and lighting `[estimate]`

- **Safest recognisable look:** bright overcast late-morning/early-afternoon in spring or autumn (10:30–14:00) — soft high-luminance sky (**c. #DDE1E4 zenith to c. #EEF0F0 horizon**), no hard shadows, so the buff Anston stone, pinkish sandstone/bronze, green bridge and red buses read as flat true colours; add wet, freshly-rained York stone and asphalt for reflections.
- **Hero look:** summer golden hour c. 19:30 BST, sun azimuth c. 290° (WNW), altitude c. 10–15°, warm 3000–3500 K key light raking across the Portcullis House south facade and lighting Big Ben's west and NW faces gold against a pale blue-lilac eastern sky over the Eye; long shadows east along Bridge Street. Avoid midday summer sun (harsh; Big Ben's north face in shade).
- **Night:** dials lit warm white, Ayrton Light on, dolphin globes and bridge lanterns warm, Eye lit pink/red, Portcullis House windows amber, bus interiors bright.

### 11.13 Street ambience `[memory-medium]`

Heavy but slow traffic; modern buses (low diesel/hybrid idle 80–120 Hz plus door-chime 'beep' and 'bus stopping' bells) idling and hissing at Stop H; black-cab diesel rattle; frequent sirens (Metropolitan Police from the Embankment, ambulances to St Thomas' Hospital across the bridge); cycle bells on CS3; the Westminster Bridge bagpiper heard 200–400 m away as a thin drone; pigeons cooing/flapping in the tower's shadow, black-headed gulls over the Thames; multilingual tourist chatter and tour-guide megaphones; boat engines and PA from the pier with occasional horn blasts; wind noise on the bridge; the rumble and warm air-blast from the JLE vent grates; and every 15 minutes the Westminster Quarters cutting through everything.

---

## 12. Signage & materials palette

### 12.1 Typeface — Johnston `[verified]` characteristics; substitutes `[memory-high]`

Johnston (Edward Johnston, 1916; New Johnston by Eiichi Kono 1979 with c. 7% larger x-height; **Johnston100** by Monotype 2016 adding Hairline and Thin weights and restoring the diagonal-bowl lowercase g). Features to reproduce: near-perfect circular O, C, G; straight-sided M with the vertex reaching the baseline; two-storey g; wide lowercase l; **diamond (rotated square) tittles on i and j and diamond full stops**; numeral 1 without base serif and open 4 (since 2008); uniform monoline stroke. Since 2016 all new TfL signs use Johnston100 Medium; the 1999 enamel signs at Westminster are New Johnston Medium, visually near-identical.

**Canvas font stack, in order:** 'Johnston100', 'Johnston ITC Std', 'P22 Underground', 'Hammersmith One' (Google Fonts; Johnston-derived, bold only — good for roundels and 'UNDERGROUND'), 'Cabin' (Google Fonts; weights 400–700 — good for directional signs), 'Railway Sans', 'Paddington', 'Gill Sans', 'Gill Sans MT', 'Gill Sans Nova', 'Helvetica Neue', sans-serif. Weight Medium (c. 500–600). **Case: roundel and frieze names in CAPS; all directional text in sentence case** ('Way out', 'Jubilee line', 'Circle and District lines', 'Eastbound'). Tracking: sentence-case sign text c. +0.01 to +0.02 em; roundel caps c. +0.03 to +0.05 em; numerals tabular. Metrics: cap height c. 0.70 em, x-height c. 0.50 em; line spacing on multi-line signs 1.25–1.35 × cap height. Draw diamond tittles by replacing i/j dots with a 45°-rotated square if the substitute font lacks them.

### 12.2 The roundel — geometry and colour

Measured from Commons 'Underground.svg' `[verified]`: ring outer radius 17.191, inner radius 11.094; bar 42.32 wide × 6.9531 high, vertically centred. **Normalised to outer diameter D = 1.000: ring thickness 0.177 D, hole diameter 0.645 D, bar height 0.202 D, bar length 1.231 D (the bar overhangs the ring by 0.116 D each side, ends square).** These match the official TfL standard to within c. 2%. Lettering on the bar: white Johnston caps, cap height c. 0.60–0.65 of bar height, centred, side margins at least one cap height. Build it procedurally. Street researcher's memory: bar height c. 0.22 D, 'UNDERGROUND' on the bar. Colours: **Corporate Red Pantone 485 = RGB 220/36/31 = #DC241F; Corporate Blue Pantone 072 = RGB 0/25/168 = #0019A8**; the Commons SVG itself uses #EE2622 / #263D96 (a common screen approximation, not the standard); for physical enamel/vinyl under station lighting render the ring c. **#D42A25** and bar c. **#1C2E8C** with slight gloss; bar text pure white.

**Three scales:** platform name roundel (ring outer c. 0.90 m, bar c. 1.15 × 0.18 m, 'WESTMINSTER' in white caps c. 110 mm, thin white/wall-coloured surround, bar centreline 1.6–1.7 m above platform, at least one visible from every train door, spacing c. 12–20 m; on the D&C platforms on the grey wall panels between poster frames — Commons 'Westminster station Circle roundel.JPG' 2008; on the Jubilee on the trackside tunnel wall behind the PEDs — Commons 'Westminster stn Jubilee roundel.JPG'); street totem (illuminated 3D box, 'UNDERGROUND', c. 3.5 m to top); small sign tabs `[memory-medium]`.

### 12.3 Line colours — two sets `[verified]` Pantone set; `[memory-high]` TfL screen set

| Line | TfL screen/diagram hex | Pantone-derived (Wikipedia module) | Text on tab |
|---|---|---|---|
| Jubilee | **#A0A5A9** (Pantone 430) | #7C878E | white |
| District | **#00782A** | #007A33 (356) | white |
| Circle | **#FFD300** | #FFCD00 (116) | blue #0019A8 / #10069F or black |
| Bakerloo | #B36305 | #A45A2A (470) | white |
| Central | #E32017 | #DA291C (485) | white |
| Hammersmith & City | #F3A9BB | #E89CAE (197) | dark blue |
| Metropolitan | #9B0056 | #840B55 (235) | white |
| Northern | #000000 | #000000 | white |
| Piccadilly | #003688 | #10069F (072) | white |
| Victoria | #0098D4 | #00A3E0 (299) | white |
| Waterloo & City | #95CDBA | #6ECEB2 (338) | dark blue |
| Elizabeth line | #6950A1 (older #60399E) | — | white (purple roundel, blue bar) |
| DLR | #00A4A7 | — | white |
| Overground (legacy) | #EE7C0E | — | white |
| Tramlink | #84B817 | — | white |

Use the TfL screen set for signage (matches TfL's own artwork); the Pantone set gives a slightly darker print-like look. Jubilee grey rationale: originally battleship grey after the 'Fleet' naval name, later lightened to represent the silver of the Silver Jubilee.

### 12.4 Sign types `[memory-high]` unless noted

- **Directional (blue):** white Johnston Medium text and white arrows on Corporate Blue #0019A8, no border, rectangular; sentence case; suspended sign boxes c. 400–450 mm high, 100–120 mm deep, widths in c. 300 mm modules; text x-height c. 45–60 mm (cap c. 65–85 mm) on main signs, c. 30–38 mm on secondary; arrows solid white, head c. 1.3 × cap height, at the leading edge on the side the arrow points; up-arrow = straight ahead, down-arrow = down the stairs/escalator ahead; suspension by two stainless rods or a bracket; **underside 2.3–2.5 m above floor**. Line-name tabs: 'Jubilee line' white on grey #A0A5A9; 'Circle and District lines' yellow and green tabs; 'Way out' yellow tab; 'Lifts'; 'Tickets'; 'No entry' (red disc with white bar); 'Keep left'. Note: the architecture researcher's photographs show white panels with black text and the line name in small caps plus a full line diagram beneath and a line-colour band at the top (e.g. 'District and Circle lines → Westbound platform 1') — both styles exist at Westminster; use the photographed white style at platform entrances and the blue style for suspended wayfinding.
- **Way out (yellow):** always black Johnston Medium on Corporate Yellow (#FFD300 / Pantone 116) with a black arrow, as a full yellow panel or a yellow tab inset in a blue sign; lower-case 'out'. At numbered-exit stations each exit has a **number badge: a black square with a white numeral (side c. 1.2 × cap height) immediately after 'Way out'**, then the destination list in smaller black text, e.g. **'Way out [1] Westminster Pier, Victoria Embankment'**. Street-level stair heads carry blue panels with roundel + exit number. Memory variant: 'Way out – Houses of Parliament, Westminster Abbey, Whitehall' and 'Way out – Westminster Pier, London Eye' with white text on blue and yellow arrows.
- **Platform numbers (black):** white Johnston numerals on a black rectangle or black tab, e.g. 'Platform 3'.
- **Line diagram panels** on each platform (c. 1.6 × 0.5 m): the whole line as a coloured stripe with station names, a 'You are here' marker, interchange double circles and the roundel. Above platform entrances: 'Eastbound' / 'Westbound' plus destinations — Jubilee eastbound **'Waterloo, London Bridge, Canary Wharf, Stratford'**; westbound **'Green Park, Bond Street, Baker Street, Wembley Park, Stanmore'**; District/Circle eastbound **'Embankment, Tower Hill, Upminster, Circle line'**; westbound **'St James's Park, Victoria, Earl's Court, Wimbledon, Richmond, Ealing Broadway, Edgware Road'** `[memory-medium]`.
- **Name frieze:** the standard tube-platform continuous frieze (band c. 200–250 mm high at c. 2.1 m, name repeated in c. 120 mm caps every 5–8 m, white on blue or blue on white) is NOT authentic to the 1999 platforms per the signage researcher; the architecture researcher saw white 'WESTMINSTER' name panels with a coloured line band on the Jubilee platforms. Treat as discrete name panels, not a continuous band.

### 12.5 Sign wordings actually photographed at Westminster `[verified]`

'Way out' (yellow on black panels with arrow); 'Jubilee line ↑ Eastbound platform 3'; 'Jubilee line ↓ Westbound platform 4'; 'District and Circle lines → Westbound platform 1' (full line diagram beneath, green/yellow band at the top); '↑ Lift' with wheelchair icon; green 'Emergency exit' running-man signs; '↑ Westminster Pier' blue river-services panel; '← Exit 1 Westminster Pier / ← Exit 2 Victoria Embankment / Exit 3 → Houses of Parliament'; '↑ Westminster Pier (boat icon) River Bus / River Tours'; 'London Eye / London Dungeon / London Aquarium Exit 1'; blue 'WESTMINSTER STATION' fascia; 'Public subway'; 'City of Westminster – Westminster Station – Public Subway – Toilets' (cast-iron arches at Exits 2, 5, 6); 'HMS Westminster is proud to be associated with London Underground' plaque (with the 32 m below mean sea level text); 'Emergency exit' in the ribbed passages; 'MIND THE GAP' on the D&C platform edge; lift buttons 'DC / JE / JW'.

### 12.6 Platform-edge kit `[verified]` standards; Westminster application `[estimate]`

- Yellow line c. 100 mm wide, outer edge 500–600 mm from the edge (#F2C300 / #f2c500, worn); coping c. 600 mm paler concrete with dark anti-slip nosing; 'MIND THE GAP' white caps c. 200 mm at door spacing (Wikipedia: markings 'usually line up with the doors on the cars').
- **Tactile paving (UK standards):** platform-edge 'offset blister' with domes on a **66.5 mm pitch, laid 400 mm deep parallel to the edge and set back 500 mm** (lozenge type is on-street only); **corduroy hazard strip of rounded bars 20 mm wide, 6 ± 0.5 mm high at 50 mm centres, 400 mm deep** at the top and bottom of stairs/ramps, standard colour buff (any colour except red permitted). At Westminster: Jubilee — dark-grey/graphite blister strip 400 mm deep between yellow line and PED threshold; D&C — the photographed dark studded strip (#5a5a58) with white text (the signage researcher's guess of cream/buff blisters is superseded by the photo); JLE stair heads — dark-grey corduroy inserts; street subway stairs — none (OSM tactile_paving=no).
- **Stairs:** precast concrete or grey granite treads c. 300 mm going, c. 150–165 mm rise, contrasting light-grey or yellow-cream anti-slip nosings c. 55 mm deep; stainless tubular handrails Ø 40–45 mm both sides and a central rail on wide flights, ending in a 300 mm horizontal return.

### 12.7 Escalator signage `[memory-medium]`

At the top and bottom newel of every escalator: **blue square/rectangle sign c. 250 × 350 mm, white Johnston 'Stand on the right'** with a white pictogram of a figure standing on the right; companions **'Please hold the handrail', 'Dogs must be carried', 'Keep hold of children', 'Take extra care in wet weather'**, and a yellow/black **'Keep feet away from the sides'** on the skirt; a red mushroom emergency-stop button in a black surround on each newel with an 'Emergency stop' label; 'Stand on the right' at 1.1–1.3 m on the newel. Advert panels: classic paper escalator panels c. 610 × 305 mm landscape; modern digital escalator panels portrait c. 0.30 × 0.53 m (24-inch) at c. 1.5 m intervals, on walled flights only.

### 12.8 Advertising formats `[memory-medium]`

4-sheet **1016 × 1524 mm** portrait (platform and corridor frames, c. 150 mm border, bottom edge 0.9 m off the floor); 6-sheet 1200 × 1800 mm (street shelters); 12-sheet 3048 × 1524; 16-sheet 2032 × 3048 portrait; **48-sheet 6096 × 3048 mm** (20 × 10 ft landscape, cross-track on the D&C platforms); 96-sheet 12192 × 3048. Cross-track digital projection screens c. 4 × 3 m on deep-level platforms; Jubilee cross-track frames c. 3.5 × 1.5 m between roundels behind the PEDs; corridor 'digital 6-sheets' (portrait c. 1.1 × 1.9 m LCD in black frames) since c. 2015. Subway walls carry billboards.

### 12.9 Small repeated details `[memory-high]` unless noted

- **Help points:** rectangular c. 350 × 450 mm at c. 1.2 m, Corporate Blue face with white 'Help point' header, two large push buttons — **green 'Information' and red 'Emergency'** — speaker grille and induction-loop symbol; JLE units set into stainless wall panels (the architecture researcher describes white round help points on the Jubilee platforms — Commons 'Help point (12249006035).jpg' — so both forms exist); at least two per platform and one in the ticket hall.
- **Fire kit:** red extinguishers (water + CO2 pair, c. 600 mm) on stainless brackets or in stainless-fronted recessed cabinets at c. 50 m intervals, handle c. 1.1 m; hose reels behind stainless doors on JLE levels; 'Fire exit' signs to BS 5499/ISO 7010 — **green #009639 panels with white running man and arrow, c. 300 × 150 mm**; illuminated white-on-green exit boxes over cross-passages; blue 'Fire action' notices; red break-glass call points 87 mm square at exits.
- **CCTV:** white or black hemispherical domes c. 150 mm on ceilings and beams at 2.8–3.5 m, fixed box cameras on the street stairs; signs 'CCTV in operation' / 'Cameras are in operation on this station for your safety and security'.
- **No smoking:** statutory sign, symbol ≥ 70 mm, 'No smoking. It is against the law to smoke in these premises' (c. 200 × 150 mm) near entrances.
- **PA speakers:** JLE levels — cylindrical or slim rectangular stainless enclosures (c. 300 mm) on beams and columns at c. 5 m spacing; D&C — white/grey horn and cone speakers under the canopy.
- **Litter bins:** none on platforms or in passages (1990s bomb-security legacy) — clear-bag bins on black ring stands only near the gateline `[estimate]`; but the box's landings do have the grey stainless domed cylinders with the blue band (photographed) — treat those as salt/grit or litter bins per photo.
- **Benches:** stainless perforated 3-seat units c. 1.5 m, seat c. 450 mm; D&C grey powder-coated c. 1.8 m; stainless waiting rails at PED positions; a stainless clock c. 300 mm with black Johnston numerals over the platform entrance `[estimate]`.
- **Sign mounting summary:** suspended signs 2.3–2.5 m underside; wall signs and line diagrams centre 1.5–1.6 m; roundel bar centre 1.6–1.7 m; DMIs 2.6 m underside; help points 1.2 m; gate readers c. 0.95 m; extinguisher handle c. 1.1 m; yellow line 0.5–0.6 m from the edge; CCTV 2.8–3.5 m; street totem c. 3.5 m top.
- **Art:** Mark Wallinger *Labyrinth* enamel panel; Larry Achiampong roundel (2024) `[verified]`.

### 12.10 Materials and colour palette

| Element | Colour / material | Hex | Confidence |
|---|---|---|---|
| Box concrete — smooth grillage, columns | fair-faced, glittery (Blackmore mica sand, micro-silica, 50–60 N/mm²), pale warm grey, mottled, water-stain streaks | #9c9b96 | [verified] spec, [estimate] hex |
| Box concrete — recessed diaphragm-wall cells | earth-cast, rough, pitted, browner | #7f7c76 | [estimate] |
| All box steelwork (struts, braces, beams) | satin mid-grey paint, slightly bluer than the concrete | #8a8d8f | [estimate] |
| Escalator soffit/side cladding | light-grey aluminium panels between exposed ribs | #b9bbb9 | [estimate] |
| Column mosaic band, balustrade stripe, bin band | dark blue tile / paint, c. 300 mm band at 1.1–1.3 m | (dark blue; use ~#1C2E8C) | [verified] presence |
| Jubilee platform wall panels | light-grey perforated aluminium, c. 1 × 0.5 m | #b8bbbe | [estimate] |
| Jubilee panel rib/frame grid | darker grey | #6e7174 | [estimate] |
| Jubilee platform floor | light-grey speckled terrazzo | #c8c8c3 | [estimate] |
| D&C platform floor | light-grey speckled terrazzo/granite tiles 450–600 mm | #c9c7c0 | [estimate] |
| D&C back wall concrete | pale grey fair-faced | #a3a29c | [estimate] |
| D&C tactile strip | dark grey studded, white 'MIND THE GAP' | #5a5a58 | [estimate] |
| Yellow platform line / escalator step lines | worn safety yellow | #f2c500 / #F2C300 | [estimate] |
| PED yellow band with black chevrons | | #f5c400 | [estimate] |
| Corporate Red (roundel ring, doors, bus) | Pantone 485 | #DC241F (enamel look #D42A25) | [verified] |
| Corporate Blue (roundel bar, signs) | Pantone 072 | #0019A8 (enamel look #1C2E8C) | [verified] |
| Corporate Yellow ('Way out', Circle) | Pantone 116 | #FFCE00 / #FFCD00 / #FFD300 | [verified] Pantone |
| Corporate Grey | Pantone 430 | #868F98 (signage) / #A0A5A9 (Jubilee line) | [memory] |
| Safety Blue | Pantone 300 | #005EB8 | [verified] |
| Safety Green | Pantone 356 | #007A33 | [verified] |
| Fire-exit green | BS 5499 | #009639 | [memory] |
| Amber LED dot-matrix | on black | #FFB300 (alt #FF9E1B with halo) | [estimate] |
| Oyster reader | satin yellow plastic | #FFD300–#FFD200 | [memory] |
| 1996 Stock body | unpainted aluminium, satin silver-grey | #B8BCC0 | [estimate] |
| 1996 Stock interior panels / poles / floor | off-white / silver-grey / dark with grooves | #EDEDE8 / #B5B7B9 / #3C3C3C + #7A7A7A | [estimate] |
| S7 body / window band / poles / floor / interior | near-white silver / black / blue / mid-grey / off-white | #D9DCDF / #1C1C1C / #3B83BD / #5B5F63 / #E9E9E6 | [estimate] |
| Barman moquette | blue ground with landmark silhouettes | #1E3F8A–#2A4B9B; red #C8102E, teal #2A8C8C, grey #B7BEC6, navy #0B1A3F | [estimate] |
| Tail lights | red | #FF1A1A | [estimate] |
| Portcullis House sandstone / shadows | Birchover gritstone | #C4A48A / #8E7560 | [estimate] |
| Portcullis House bronze | aluminium bronze, weathering | #4A3A2C → #5B5548 | [estimate] |
| Portcullis House granite plinth / glazing / chimneys | | #8C8481 / #25313A / #2C2A26 | [estimate] |
| Elizabeth Tower stone / recesses | Anston limestone | #D9CBA8 / #8F8672 | [estimate] |
| Elizabeth Tower dial frames / gilding | Prussian blue / gold leaf | #003153 / #C9A227 | [verified] colours, [estimate] hex |
| Westminster Bridge ironwork | Commons green | #2F5F3F (overcast #3E6B4A, shadow #1F3F2B) | [estimate] |
| Boadicea bronze / plinth | patina / granite | #3E4A3A / #7D7A76 | [estimate] |
| Dolphin lamp standards / globes | black cast iron / opal glass | #1A1A1A / #F0F0EA | [estimate] |
| JLE vent grates | dark grey steel | #4A4C4E | [estimate] |
| County Hall / South Bank Lion / London Eye | Portland stone / Coade stone / white steel | #D6D2C4 / #D9D3BF / #E6E6E4 | [estimate] |
| Norman Shaw brick / Portland bands | | #8E3B2E / #D8D4C6 | [estimate] |
| York stone paving (dry / wet) / granite kerbs | | #A89F87 / #6E675A / #7F7F7A | [estimate] |
| Asphalt (fresh / worn) | | #3B3B3B / #5A5A58 | [estimate] |
| New Routemaster / black cab | | #DA291C / #0B0B0B | [estimate] |
| Thames water / reflections | | #6B6E62 / #9AA0A0 | [estimate] |
| Overcast sky zenith / horizon | | #DDE1E4 / #EEF0F0 | [estimate] |
| Subway walls | white glazed brick; blue/white tiles around help points; cream tiles at stair heads | (white) | [verified] |
| Suregrip floor | electropolished laser-cut stainless chequer/perforated plate | (stainless) | [verified] |

---

## 13. Modelling priorities — what makes a viewer say 'that IS Westminster'

Merged and ranked across all five researchers.

1. **Get the section and plan right before anything else.** One 80 × 26 m box, long axis E–W just north of Bridge Street, 39–40 m from pavement to base slab; levels at 0 / −3 / −8 / −8 to −14 / −22 to −24 / −31 to −33 / −39 m; two 7 m tunnels stacked c. 10–11 m apart along the south wall under Bridge Street with platforms on the north side; D&C tracks crossing the box SW→NE at 45° near ground level; Big Ben 34 m SE of the box edge (46 m at 151° from the entrance); Portcullis House 77 × 50 m on top with the 12 m entrance opening in the middle of its south face.
2. **The void is the hero.** 35 m long × 20 m high open section; 2 m columns at 11.8 m centres with 1 m secondaries between; 660 mm solid struts through cast collars at several heights; 250–400 mm tubular diagonals with forked ends; thin tie rods; 2.5 m wide buttress/waler grillage with rough recessed cells; satin mid-grey steel; blue mosaic band on every column c. 1.2 m up; domed stainless bins with the same band. Light it with cool-white battens under the steel and column uplighters so the grillage glows and the top of the void falls into shadow (c. 4000 K).
3. **Escalator choreography — 17 units in seven banks with the criss-cross** (concourse east end → 3 down to the east section; east section → 3 long westward to the WEST well; west section, fed by 2 + stair from P2 and 2 from P1 → 3 eastward to the EAST well; 2 + stair in each well between P3 and P4). Light-grey aluminium soffits with exposed ribs, perforated stainless side screens, solid stainless balustrades with round lamps in the skirting, black-cleated steps with yellow edge lines, black handrails, 'Stand on the right' on every newel, stainless chequer-plate landings with perforated balustrades and round rails. Ensure sightlines show three or four banks crossing at once.
4. **The two train silhouettes and the PED screen.** 1996 Stock: 2.63 × 2.875 m, 7 cars 126.5 m, unpainted silver-grey, red doors, blue face with red centre M door, white train number bottom-left on a grey valance, orange LED destination above the M door, 14 double + 12 single doorways per side. S7: 2.92 m wide, c. 3.68 m tall, 117.4 m, near-white silver sides, black window band, red doors, blue skirt band, red cab with orange LED destination and LED corner lamps, 3 wide doorways per car, see-through gangways. On the Jubilee platforms the stainless/glass PED screen dominates: leaves c. 2.1–2.2 m, header to c. 2.5 m, open above to the curved panelled tunnel wall, 28 units per platform with the yellow chevron band, opening in unison with the train doors (c. 2 s open, 2.5–3 s close).
5. **Platforms.** D&C: two curved side platforms c. 130 m, no columns between tracks, deep concrete downstand beams with twin-tube battens, round grey-clad columns with the blue band and square concrete piers, 600 mm terrazzo, dark studded tactile strip with white MIND THE GAP, yellow line, 4-rail track with yellow insulators, amber dot-matrix boards, roundels and 4-sheet/48-sheet ad frames on concrete. Jubilee: 126 m gently curved (1000 m radius) tunnels in light-grey perforated aluminium panels on a darker rib grid, roundels/name panels, crown light troughs, ribbed enamel-panel passages north into the wells.
6. **Concourse and street.** Irregular polygon, low coffered concrete ceiling with big saucer luminaires, NW–SE gateline of 15 stainless Cubic gates with a wide gate and staff booth, blank former ticket windows on the NW wall, 4-step/ramp to the Embankment subway east, Whitehall passage west, Bridge Street stair (16 steps) and lift south. Street: Portcullis House colonnade (gritstone piers, bronze ducts, glass canopy, blue WESTMINSTER STATION sign, roundel totem at the kerb, Tesco/Caffè Nero, bus stop H 24 m west); Elizabeth Tower to 96 m with 6.9 m Prussian-blue dials, gold ornament, Latin band and a 0.26° NW lean; six exits with Victorian cast-iron railings and 'Westminster Station / Public Subway / Toilets' arches at Exits 2, 5, 6; white-glazed-brick subways with billboards; Westminster Bridge (250 × 26 m, seven Commons-green arches, Gothic parapets and lamps, dark-grey barriers); Boadicea (c. 9 m) at the bridge corner; granite Embankment wall with dolphin lamps every 25–30 m and flush JLE vent grates; County Hall and the 135 m Eye as impostors across a c. 240 m river; Parliament Square gyratory with Churchill at the NE corner.
7. **Signage and lighting as the realism glue.** Johnston-class font, procedural roundel from the SVG ratios, exactly three sign colours (blue direction, yellow 'Way out' with black exit-number badges, black platform numbers) plus line tabs; the photographed wordings of §12.5; platform numbers 1 W D&C, 2 E D&C, 3 E Jubilee upper, 4 W Jubilee lower; Exit 1 Westminster Pier, 2 Victoria Embankment, 3 Houses of Parliament, 4 Bridge Street, 5/6 Whitehall/Parliament Street. Amber DMIs with the 3-row 'n Destination  m min' layout and HH:MM:SS clock. Small repeated details: blue help points with green/red buttons, red extinguisher pairs, green running-man signs, dome CCTV, no platform bins, stainless benches and speakers, scuffed yellow paint and grime gradients at hand height.
8. **Audio, in priority order.** (i) Voices and scripts exactly as §10 — never 'Jubilee line train' on the Jubilee, never 'terminates at' on the District. (ii) The 1996 Stock GTO 'spool-up' with 3–4 discrete pitch steps and its mirror on braking, plus the shrill pulsed door alarm — this single sound identifies the Jubilee platform; synthesise as a PWM-carrier whine that jumps modes rather than sweeping. S7: smooth IGBT sweep with a chirp, loud A/C hiss, unison door slam. (iii) Space-dependent reverb per §10.11 with escalator drone as the box's bed and cross-platform PA leakage on the D&C. (iv) PEDs: no chime — motor whir + clunk synced to the train doors, with the pre-arrival piston wind through the header gap as the main approach cue. (v) Big Ben: correct change subset per quarter, hour chime starting 25 s before the hour, N strokes at 4.5 s, inharmonic E3 Great Bell (335 Hz doublet, hum c. 80 Hz, 440/883 Hz partials, slow warble) — audible outside and faintly down the stairs, inaudible below. (vi) Gate beeps single/green vs double/'SEEK ASSISTANCE' red, paddle thump, dense overlapping beeps in peaks. (vii) Street layer: slow traffic and buses, sirens, the bagpiper as a distant drone, pigeons/gulls, tourist chatter, boat engines from the pier, JLE vent rumble. (viii) Occasional security ('See it. Say it. Sorted.' with 61016), service-status and handrail messages, and — very rarely — 'Would Inspector Sands please report to the operations room immediately.'
9. **Timing loop.** Jubilee train every 120 s peak / 150 s off-peak, dwell 30–45 s; D&C combined every c. 135–150 s; both with the 1.75 s warning-to-door-movement standard; a 2–4 m/s gust with rising rumble 5–15 s before a Jubilee train (weaker on the D&C), slight brake-release lurch at departure, entry at c. 35–40 km/h decelerating at 0.8–1.15 m/s² to a precise stop.
10. **Lighting recipe.** Bright overcast with wet paving outside (safest), golden hour from the WNW for the hero shot; c. 4000 K cool white in the box, slightly warmer on the D&C level; DMIs and the orange LED destination displays as the most eye-catching platform light sources; headlight flare through the PED glass on arrival; two red tail lamps receding.

---

## 14. Open questions and conflicting facts

| # | Topic | Conflict | Preferred / action |
|---|---|---|---|
| 1 | **D&C platform numbering** | Architecture (survey + photographed sign): P1 = westbound (SE side), P2 = eastbound. Audio (guess) and signage (inferred from API coordinates): P1 = eastbound (north track), P2 = westbound. | **P1 westbound / P2 eastbound.** Photograph + survey + left-hand-running geometry outweigh approximate API points. Verify against any current platform photo. |
| 2 | Jubilee platform numbering | Audio researcher guessed 3 = westbound upper, 4 = eastbound lower. All others: 3 = eastbound upper, 4 = westbound lower (photographed signs, live boards). | **3 eastbound (upper), 4 westbound (lower).** |
| 3 | **Exit numbering** | Three lists (§2.4 A/B/C) plus the separate NaPTAN entrance numbering. | **Use list A** (photographed sign 'Exit 1 Westminster Pier / Exit 2 Victoria Embankment / Exit 3 Houses of Parliament', OSM refs 1–2 at the Embankment corner, describe-online for 4–6). Keep strings data-driven; confirm 4–6 from a current TfL station map. |
| 4 | Box plan and depth | 80 × 26 × 40 m (Maunsell) vs 75 × 27 m / 39 m (Hopkins, Wikipedia) vs 75 × 25–30 m (audio estimate). | 80 × 26 m, 39 m to slab / 40 m wall depth. |
| 5 | Jubilee platform depth | 31.4 m below street / 26 m below sea level (FOI); 25.4 m below sea level (CityMonitor); 32 m below MSL at lowest point (plaque); c. 30 m (Hopkins, rolling-stock); −31 to −33 m (architecture estimate). | Westbound P4 at c. −31.5 m below Bridge Street; P3 c. 10 m above it; base slab −39 m. |
| 6 | Concourse clear height | 3.0–3.5 m (architecture) vs 4–4.5 m (audio). | Lower value; check against a photo with a person for scale. |
| 7 | Gate count | 15 (TfL API 2026) vs 16 + 2 manual (2008 survey) vs 18–20 (estimate). | 15, parameterised. |
| 8 | Lift count | 4 public (survey) vs 5 (Wikipedia/API). | Model 4 public; fifth assumed staff/parliamentary. |
| 9 | 1996 Stock car length | 18.196 / 18.02 m (current) vs 17.77 m (older sources). | Current figures; total 126.49 m fixed. |
| 10 | Doorways vs PED units | 26 passenger doorways per side (verified label counts) vs 28 PED units per platform (verified). Audio/signage assumed 4 doorways per car (28). | 26 doorways + 2 end/emergency PED units; confirm from a platform photo. |
| 11 | PED height | 2.5 m (architecture) vs 2.1–2.2 m leaves + header to 2.5 m (rolling-stock) vs 2.6–2.8 m header (signage). | Leaves 2.1–2.2 m, header top c. 2.5 m. |
| 12 | PED opening width | 1.66 m (audio, rolling-stock estimate) vs c. 1.8 m (signage estimate). | 1.66–1.8 m double; 0.8–1.0 m single. |
| 13 | PED open/close order vs train doors | PED 0.3–0.5 s after train doors (audio) / fraction after (rolling-stock) vs PED fraction before, closing first (signage). | Near-simultaneous; PED leads by ≤ 0.3 s. |
| 14 | PED chime | None (audio, rolling-stock) vs 'PED chimes before the train doors' (signage note). | None. |
| 15 | Yellow line behind PEDs | Present c. 600 mm back (signage) vs none visible (rolling-stock). | Faint/worn line + dark tactile band. |
| 16 | **Jubilee arrival wording** | 'This is Westminster. Change for the District and Circle lines. Exit for…' (audio) vs 'This station is Westminster. Change here for the Circle and District lines. This train terminates at Stratford' (rolling-stock, ilyabirman format) vs 'This is Westminster. Change here for the Circle and District lines' (architecture). | 'This station is Westminster. Change here for the District and Circle lines. Exit here for the Houses of Parliament and Westminster Abbey.' — all variants shipped as switchable strings; confirm from a recording. |
| 17 | Jubilee door-close voice | 'Please stand clear of the doors' (Celia Drummond; corroborated by a YouTube comment) vs male 'This train is now ready to depart. Please stand clear of the closing doors' (rolling-stock). | Drummond line. |
| 18 | 'District and Circle' vs 'Circle and District' on the Jubilee | Audio memory-high (District first) vs rolling-stock (alphabetical). | District first on the Jubilee; Circle first is the S7 convention. |
| 19 | S7 door-opening chime | Two-note motif on opening (Londonist / Classic FM via rolling-stock) vs no chime (audio). | Include the short motif; beeps + unison slam on closing; no spoken 'Please mind the doors' by default. |
| 20 | Circle westbound wording | 'to Edgware Road via Victoria and Paddington' (audio) vs 'via Victoria and High Street Kensington' (rolling-stock). | Audio version; verify from a recording. |
| 21 | Platform PA at Westminster | Current Elinor Hamilton 'The next train will be a … service calling at all stations to …' (verified 2021) vs older 'The train now approaching is …' and generic 'The next train is now approaching. Please stand behind the yellow line.' | Current form; older forms as rare alternates. |
| 22 | Escalator balustrade lights | Discrete round lamps in the skirting (architecture, photo) vs continuous under-handrail linear luminaires (signage). | Round lamps; linear glow optional (LED retrofit). |
| 23 | Help point form | Blue rectangular with green/red buttons (signage) vs white round (architecture, photo). | Both exist; photo form on the Jubilee platforms. |
| 24 | D&C floor tone | Light speckled grey #c9c7c0 (photo) vs darker granite with cream coping (signage memory). | Photo value. |
| 25 | Name frieze on Jubilee platforms | White 'WESTMINSTER' panels with a line band (architecture) vs no frieze (signage). | Discrete panels, not a continuous frieze. |
| 26 | Westminster Quarters strike counts | '5/10/15/20 notes' (audio text) vs 4 strikes per change. | 4/8/12/16 strikes; changes as listed. |
| 27 | Dwell times | 30–45 s peak / 25–35 s off-peak (rolling-stock) vs 30–40 / 20–25 s (audio). | Use 35 s peak / 27 s off-peak as defaults. |
| 28 | Approach-wind lead time | 5–8 s (rolling-stock) vs 10–15 s (audio). | Start the whoosh at T−12 s, peak at T−6 s. |
| 29 | Bus routes | Route lists are memory-medium. | Verify against TfL bus stop H/G/A/C data. |
| 30 | Bridge Street cycle track side, final bridge-barrier design, exact bridge green, Portcullis House bay count / pier width, Portcullis House heights, whether the south-side exit west of the tower (NaPTAN Entrance 2 / OSM way 136105035) is open | All flagged by the street researcher as unverified. | Check from street photos before final texturing. |
| 31 | Ticket hall ceiling luminaire size, saucer diameter 1.2–1.5 m | Estimate only. | Tune from photo. |
| 32 | Whether 'Please mind the gap between the train and the platform' plays on S7 arrival at Westminster | Medium confidence (curve + painted MIND THE GAP). | Play it. |
| 33 | 1996 Stock end-display LED colour | Red (one photographer) vs amber (other sources). | Red-orange; low importance. |
| 34 | Vertical separation of the Jubilee tunnels | c. 10–11 m axis-to-axis is an estimate from the 7 m i.d. and c. 3 m clay. | Derive from the chosen platform depths (P3 c. −23 m, P4 c. −32 m). |

### Reference photographs for texturing `[verified]`

Wikimedia Commons category 'Westminster tube station' (110 files) and subcategory 'Escalators at Westminster tube station' (33 files); 'Roundels at Westminster tube station' (61 files). Key files: 'Jubilee Line escalator hall … geograph 4816727' and 'Lowest level, Jubilee Line escalator hall … 4816741' (2015); 'Internal Permanent Ground Supports in Westminster Underground Station … 8092189' (2025, column/strut/brace close-up); 'Westminster station escalators 2024-03-21'; 'Westminster tube station 2025-06-05' (B&W, looking down the void); 'Westminster station Circle look clockwise/anticlockwise' (D&C platforms); 'Westminster stn Jubilee eastbound look west' / 'westbound look east'; 'Westminster stn Jubilee roundel.JPG'; 'Westminster station Circle roundel.JPG' (2008); 'Mind the gap Westminster tube station.jpg'; 'Help point (12249006035).jpg'; 'EscalatorLights at Westminster.jpg'; 'Escalators at Westminster tube station'; 'Stairs up from platform level'; 'Westminster Underground Ticket Barrier' (2010); 'Westminster Underground Station (August 2023) 01-07' (signage, interchange passage, plaque); 'Westminster tube station, Jubilee Line (5)' (stainless chequer floor); 'Westminster station entrance Portcullis House.JPG'; 'Westminster tube station entrance, Victoria Embankment.jpg' (2008); 'Entrance to Westminster tube station on Parliament Street 2026-05-04'; 'Westminster station entrance Whitehall'; 'Entrance, Westminster Station, Bridge Street SW1 – geograph 3857991' (Exit 2 by Boadicea); 'Public subway Parliament Street'; geograph 3859747, 5640106, 2807547 (Parliament Street subway stairs), 4758429 (Portcullis House entrance). Fetch via `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>?width=2000`. Useful recordings: 'Jubilee Line announcements (Celia Drummond)'; 'Westminster & Victoria Underground Announcements — Elinor Hamilton' (Tom's Rail Announcements, Sep 2021); 'Circle line announcements by Sarah Parnell' (30 Jan 2019); 'District Line S7 Stock 21397 From St. James's Park to Aldgate East' (5 Mar 2022); 'Jubilee Line 1996TS 96272 Departing Westminster (With Platform Announcements)' (Nov 2011); Jago Hazzard 'Why do Jubilee Line trains make that noise?' (Oct 2023); '[AUDIO] 1996 Stock Motor Sound'; '[Video] S Stock's Doors Closing'; 'O&K Kone Escalator at Westminster station'; 'Westminster station fire alarm test' (Sep 2019); 'Bagpiper on Westminster Bridge' (2009–2023).

*End of dossier.*
