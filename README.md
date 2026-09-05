# Westminster

A first-person, browser-based reconstruction of **Westminster Underground station** (Jubilee, District and Circle lines) built with Three.js.

You start as a passenger on Bridge Street beneath Portcullis House, with the Elizabeth Tower ("Big Ben") across the road. Walk down into the ticket hall, touch in at the gates, ride the escalators into Michael Hopkins' cavernous Jubilee line box, wait behind the platform edge doors and board a 1996 Tube Stock train — or take the stairs to the sub-surface District & Circle platforms for an S7 Stock train.

Everything is procedural: geometry from primitives, textures drawn on canvases, sound synthesised live with Web Audio (reverb per zone, escalator drives, door chimes, traction whine, tunnel wind, the Westminster Quarters from the tower). No binary assets, no build step, no network access at runtime.

## Run it

```bash
npm install        # only needed for the headless tests (installs http-server + three for node)
npm start          # serves the repo at http://localhost:8080
```

Any static file server works (`python3 -m http.server 8080` too). Open the URL, click **Enter the station**, and use:

| key | action |
|---|---|
| `W A S D` / arrows | walk |
| `Shift` | run |
| mouse | look (pointer lock) |
| `E` | interact — touch in at a ticket gate, sit on a train seat |
| `C` | crouch |
| `M` | station map |
| `H` | controls help |
| `Esc` | pause / release the mouse |

Headphones recommended. URL parameters: `?quality=low` (no post-processing or shadows), `?time=14:30` (station clock), `?mute=1`, `?pos=x,y,z&yaw=deg` (spawn point), `?autostart=1` (skip the start screen, used by tests).

## Layout of the code

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module contract and [`docs/WESTMINSTER_REFERENCE.md`](docs/WESTMINSTER_REFERENCE.md) for the research dossier the reconstruction is based on.

```
index.html                 import map → vendor/three (r170), boots src/main.js
src/core/                  layout (the geometry contract), textures, materials, collision, track, engine, context
src/systems/               player (first person), audio (Web Audio engine), trainService (timetable, doors, PEDs, indicators)
src/world/                 street, ticketHall, jubileeBox, jubileePlatforms, districtPlatforms
src/entities/              escalator, trains (1996 TS, S7), trainSpec, platform furniture, ticket gates, NPCs
src/audio/                 announcements (verbatim TfL wording), Big Ben quarters, ambience/PA soundscape
src/ui/                    HUD, start screen, station map
test/                      headless Playwright harness: screenshot.mjs, run.mjs (smoke route), collision.test.mjs
```

## Tests

```bash
node test/collision.test.mjs                                   # collision maths
node test/run.mjs                                              # boots the whole station headlessly, walks a route, boards trains
node test/screenshot.mjs --module world/jubileeBox --views "a:-26,-5,-49:-26,-30,-90" --outdir /tmp/shots
```

The headless tests use the globally installed Playwright Chromium with SwiftShader; `--advance N` steps the simulation deterministically.

## Accuracy notes

The station is modelled from public descriptions, photographs and published dimensions (see the dossier). Positions are approximate and some liberties are taken so that the whole station fits in one coherent walkable world: in particular the sub-surface platforms, ticket hall and box are arranged to match how the station *feels* to walk through rather than survey drawings. Trains run on a simplified timetable and the world contains only Westminster: if you stay aboard, the train runs to the next station in the dark and brings you back.
