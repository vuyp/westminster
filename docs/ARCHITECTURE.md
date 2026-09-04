# Westminster Station — Architecture & Module Contract

A first-person, browser-based reconstruction of Westminster Underground station
(Jubilee / District / Circle lines) built with vanilla Three.js ES modules.
No build step: `index.html` uses an import map that points at the vendored copy
of three.js in `vendor/three/`. Serve the repo root with any static server
(`npm start` → http://localhost:8080).

Read `docs/WESTMINSTER_REFERENCE.md` for the factual dossier (dimensions,
colours, announcement wording). Read this file for how the code fits together.

## Conventions

* Units are **metres**, Y is up. `+X = east`, `+Z = south`, so north is `-Z`.
* World origin `(0,0,0)` = the main Bridge Street entrance (Exit 4) in the Portcullis
  House arcade. Street level is `y = 0`. Big Ben is to the south-east (x 22, z 40).
* Station topology (from the dossier): the Jubilee **box** is 80 × 26 m, long axis
  east–west, under the south strip of Portcullis House (`layout.JUBILEE.box`); the two
  Jubilee platform tunnels are **stacked** under Bridge Street just south of the box
  (Platform 3 eastbound above Platform 4 westbound, platforms on the north/box side);
  the District & Circle platforms cross the site diagonally at `-8.5 m` (Platform 1
  westbound on the south-east side, Platform 2 eastbound) — use `layout.dcToWorld(s, t)`
  / `layout.worldToDc(x, z)` and `layout.DC_YAW` to build in their local frame
  (`s` along the line towards the north-east, `t` across towards the south-east).
* All level heights, key positions, track curves and dimensions live in
  **`src/core/layout.js`**. Never hard-code a level height or a platform position
  in a world module — import it from `layout` so that the whole station stays
  consistent when a number is tuned.
* Everything is procedural: geometry from Three.js primitives / BufferGeometry,
  textures from `<canvas>` (see `src/core/textures.js`). No binary assets, no
  network fetches.
* Materials come from the shared factory `src/core/materials.js` (`M.concrete()`,
  `M.stainless()`, …) so the palette stays coherent and materials are shared
  (fewer draw calls / state changes). Add a new material to the factory rather
  than creating one-off `MeshStandardMaterial`s for large surfaces.
* Performance target: 60 fps on an integrated GPU. Use `InstancedMesh` for
  repeated things (steps, tiles, seats, poles, PED panels, people), merge static
  geometry where sensible (`BufferGeometryUtils.mergeGeometries`), keep light
  counts low (mostly emissive fixtures + a few real lights per zone), and put
  `frustumCulled` geometry in sensible chunks.

## Runtime objects

```
index.html
  └─ src/main.js                bootstraps everything below
       ├─ src/core/engine.js    renderer, camera, clock, resize, post-processing
       ├─ src/core/layout.js    THE geometry contract (levels, positions, tracks)
       ├─ src/core/textures.js  canvas texture generators (concrete, signs, roundels, dot-matrix…)
       ├─ src/core/materials.js shared PBR material factory
       ├─ src/core/collision.js walkable surfaces + blockers, used by the player
       ├─ src/core/track.js     Track curves + helper to place things along a track
       ├─ src/systems/player.js first-person controller (pointer lock, walk, ride escalators/trains)
       ├─ src/systems/audio.js  Web Audio engine: zones/reverb, positional emitters, synths, announcements
       ├─ src/systems/trainService.js  timetable, train state machines, platform edge doors, indicators
       ├─ src/world/*.js        one module per area: street, ticketHall, jubileeBox, jubileePlatforms, districtPlatforms
       ├─ src/entities/*.js     reusable things: escalator, trains, npcs, ticketGate, signage
       └─ src/ui/hud.js         start screen, captions, prompts, location label, map
```

## The build context (`ctx`)

Every world module exports a single function:

```js
export function build(ctx) { ...; return { group, /* optional extras */ } }
```

`ctx` is created by `main.js` (see `src/core/context.js`) and contains:

| field | meaning |
|---|---|
| `THREE` | the three.js namespace (also importable from `'three'`) |
| `scene` | the root `THREE.Scene`; modules add their `group` to it |
| `layout` | the geometry contract (`src/core/layout.js`) |
| `M` | material factory (`src/core/materials.js`) |
| `T` | texture generators (`src/core/textures.js`) |
| `collision` | `addFloor(surface)`, `addBlocker(box3 | mesh)`, `addRamp(from,to,width,opts)` — see `collision.js` |
| `audio` | the audio engine — `audio.emitter({...})`, `audio.zone(...)`, `audio.announce(...)` |
| `onUpdate(fn)` | register `fn(dt, elapsed)` to be called every frame |
| `quality` | `'high'` or `'low'`; skip expensive extras when low |
| `lights` | helpers: `lights.spot(...)`, `lights.tube(...)` (emissive luminaire + optional real light) |
| `register(name, object)` | expose an object (e.g. `'escalator:box-1'`, `'train:jubilee-eb'`) to other systems via `ctx.get(name)` |

Rules for a world module:

1. Build all geometry under one `THREE.Group` positioned in **world coordinates**
   (do not offset the group by the level height; place children at absolute
   positions taken from `layout`).
2. Register every surface the player can stand on with `ctx.collision.addFloor`
   and every wall/obstacle with `ctx.collision.addBlocker`. If it isn't
   registered, the player falls through it / walks through it.
3. Register audio emitters for anything that makes sound (escalators, PA
   speakers, ticket gates, trains, traffic) with `ctx.audio.emitter`.
4. Register an animation callback with `ctx.onUpdate` for anything that moves.
5. Return `{ group }` plus anything other systems need (e.g. the ticket hall
   returns `gates`, the platforms return `platformEdgeDoors`).
6. Do **not** touch the camera, the renderer, `document`, or global state.
   HUD text goes through `ctx.hud` (`ctx.hud.caption(text)`, `ctx.hud.prompt(text)`).

## Test harness

* `test/harness.html?module=world/street&pos=0,1.7,5&look=0,1.7,-10` loads the
  core plus **one** world module and renders it from a camera you specify.
* `node test/screenshot.mjs --module world/street --pos 0,1.7,5 --look 0,1.7,-10 --out /tmp/x.png`
  does the same in headless Chromium and writes a PNG (and prints console errors).
* `node test/run.mjs` boots the whole app headlessly, walks a scripted route,
  fails on any console error / uncaught exception, and writes screenshots to
  `test/out/`.

## Cross-module contracts

These are the interfaces different modules (written by different people) rely on.
Keep to them exactly; register objects with `ctx.register(name, obj)` and look them up with `ctx.get(name)`.

### Escalators — `src/entities/escalator.js` (already written)
```js
import { createEscalator } from '../entities/escalator.js';
const esc = createEscalator(ctx, { top: {x,y,z}, bottom: {x,y,z}, dir: 'down'|'up', lanes: [-1.4, 0, 1.4], name: 'esc-A' });
// builds steps, balustrades, handrails, comb plates, lighting, sound, AND registers the moving ramp + landing floors + balustrade blockers.
```
`layout.ESCALATORS` lists the intended runs (`top`, `bottom`, `dir`, `lanes`). The Jubilee box module creates them.

### Player ⇄ Train (`src/systems/player.js` ⇄ `src/entities/trains.js`)
A train object must provide:
```js
train.group            // THREE.Group placed by the train service each frame (position + quaternion from Track.frameAt)
                       // LOCAL FRAME: -Z is FORWARD (direction of travel = increasing s along the track), +X is to the RIGHT of
                       // travel, +Y up, origin at rail-head height at the train's centre. Cars are laid out along Z with the
                       // front car at negative z. trainSpec.doorPositions() gives door centres as s-offsets (+ = towards the
                       // front), so a door at offset d sits at local z = -d. Train.placeAlong(track, s) positions the group
                       // at track.frameAt(s) and each car at its own frame (frameAt(s + carOffset)) so trains follow curves.
train.stock            // '1996' | 'S7'
train.floorY           // interior floor height in group-local coordinates (metres above the rail head)
train.interiorContains(localPos)                   // bool — point (group-local) is inside a car's saloon
train.resolveInterior(localPos, radius, height, stepUp) // push localPos out of interior walls/seats/poles (train-local);
                                                   //   returns { exited: true } if the player walked out through an OPEN door
train.doorsOpen        // bool
train.setDoors(open, { side: 'left'|'right' })     // animate doors (both sides param optional); plays door sounds itself
train.sway             // 0..1 amount of body sway for the camera (0 when stopped)
train.setDisplay(text) // in-car LED displays ("This is Westminster", "Next station Embankment")
train.exteriorBoxes()  // [Box3 in WORLD space] — car bodies (minus open doorways) for platform-side collision while STOPPED
```
The train service attaches the player (`ctx.player.attachTrain(train)`) when they walk through an open doorway into the saloon,
and the player detaches themself when `resolveInterior` reports `exited`.

The service calls `train.setDoors(true, { side })` where `side` is the platform side relative to travel
(computed from the track frame and the platform position): Jubilee Platform 3 eastbound (travelling +x, platform to
the north) → 'left'; Jubilee Platform 4 westbound → 'right'; District Platform 2 eastbound → 'left'; District
Platform 1 westbound → 'left'.

### Train service — `src/systems/trainService.js`
```js
const svc = ctx.get('trainService');
svc.on('arriving' | 'stopped' | 'doorsOpen' | 'doorsClosing' | 'departing' | 'gone', ({ train, track, platform }) => {})
svc.nextTrains(platformNumber)  // → [{ destination, minutes, line, viaText? }] sorted soonest first (for indicators)
svc.trains                      // all live trains
```
Announcement scripts live in `src/audio/announcements.js` (exports `TRAIN_ANNOUNCEMENTS[line][direction]`, `STATION_PA`) and are triggered by the train service through `ctx.audio.announce`.

### Platform edge doors (Jubilee platforms) — registered by `src/world/jubileePlatforms.js`
```js
ctx.register('peds:upper', { setOpen(bool), isOpen, doorPositionsZ: [...] })   // upper platform PEDs
ctx.register('peds:lower', { ... })
```
Door leaf positions along the platform MUST match the train door positions, so both modules compute them from
`layout.TRACKS.*.platformCentre` and the shared car/door spacing constants exported by `src/entities/trainSpec.js`.

### Next-train indicators
Platform modules create dot-matrix boards (`T.dotMatrix`) and register them:
`ctx.register('indicator:4', { set(lines) })` for platform 4 etc. The train service updates them once a second.

### Ticket gates — `src/entities/ticketGate.js` (built by the ticket hall module)
Gates are `ctx.interactive(...)` objects: the prompt reads "E — touch in with your Oyster card". On interact they beep,
open the paddles (remove their blocker for ~5 s while the player passes), and close again.

### NPCs — `src/entities/npcs.js`
Reads waypoint graphs registered by the world modules as `ctx.register('nav:<area>', { nodes: [{id, x,y,z}], edges: [[a,b]] })`
and spawn points `ctx.register('spawn:<area>', [{x,y,z}])`. Uses the collision floors like the player.
