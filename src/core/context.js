// ---------------------------------------------------------------------------
// context.js — the `ctx` object handed to every world module (see docs/ARCHITECTURE.md).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as layout from './layout.js';
import * as T from './textures.js';
import { M, box, floorPlane, signPlane } from './materials.js';

export function createContext({ scene, collision, audio, hud, quality = 'high' }) {
  const updatables = [];
  const registry = new Map();
  const interactables = [];
  let realLights = 0;
  const LIGHT_BUDGET = 40;

  const lights = {
    /** Count of real (non-emissive) lights created through the helpers. */
    get count() { return realLights; },
    /** A point light with distance falloff. Returns the light (already added to `parent`). Respects a global budget: beyond it, returns null. */
    point(parent, { x = 0, y = 0, z = 0, color = 0xffffff, intensity = 8, distance = 12, decay = 2, castShadow = false } = {}) {
      if (realLights >= LIGHT_BUDGET) { console.warn('[lights] budget exhausted; use emissive fixtures instead'); return null; }
      const l = new THREE.PointLight(color, intensity, distance, decay); l.position.set(x, y, z); l.castShadow = castShadow;
      if (castShadow) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; }
      parent.add(l); realLights++; return l;
    },
    /** A spot light. */
    spot(parent, { x = 0, y = 0, z = 0, tx = 0, ty = -1, tz = 0, color = 0xffffff, intensity = 30, distance = 20, angle = 0.6, penumbra = 0.5, castShadow = false } = {}) {
      if (realLights >= LIGHT_BUDGET) return null;
      const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, 2); l.position.set(x, y, z); l.target.position.set(tx, ty, tz); l.castShadow = castShadow;
      parent.add(l); parent.add(l.target); realLights++; return l;
    },
    /**
     * A linear luminaire: an emissive tube/box (always) plus an optional real point light at its centre.
     * axis 'x' or 'z' (horizontal), length in metres. Returns the fixture group.
     */
    tube(parent, { x = 0, y = 0, z = 0, axis = 'x', length = 1.5, color = 0xf4f1e8, emissive = 2.4, real = false, realIntensity = 10, realDistance = 10, radius = 0.035, housing = true } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), M.luminaire(color, emissive));
      tube.rotation.z = Math.PI / 2; if (axis === 'z') tube.rotation.y = Math.PI / 2;
      g.add(tube);
      if (housing) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? length + 0.1 : radius * 4, radius * 2, axis === 'z' ? length + 0.1 : radius * 4), M.paint(0xdedede, { roughness: 0.6 }));
        h.position.y = radius * 1.2; g.add(h);
      }
      if (real) lights.point(g, { x: 0, y: -0.05, z: 0, color, intensity: realIntensity, distance: realDistance });
      parent.add(g); return g;
    },
    /** A downlight can (recessed) — emissive disc + optional real light. */
    downlight(parent, { x = 0, y = 0, z = 0, color = 0xfff2e0, emissive = 3, real = false, realIntensity = 6, realDistance = 7, radius = 0.09 } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), M.luminaire(color, emissive)); disc.rotation.x = Math.PI / 2; g.add(disc);
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius * 1.4, 16), M.paint(0xffffff, { roughness: 0.5 })); ring.rotation.x = Math.PI / 2; g.add(ring);
      if (real) lights.point(g, { y: -0.05, color, intensity: realIntensity, distance: realDistance });
      parent.add(g); return g;
    },
  };

  const ctx = {
    THREE, scene, layout, T, M, box, floorPlane, signPlane,
    collision, audio, hud, quality, lights, interactables,
    onUpdate(fn) { updatables.push(fn); return () => { const i = updatables.indexOf(fn); if (i >= 0) updatables.splice(i, 1); }; },
    register(name, obj) { registry.set(name, obj); return obj; },
    get(name) { return registry.get(name); },
    /** Make an object interactive: shows `prompt` when looked at within `distance`, calls onInteract() on E. */
    interactive(object, { prompt, distance = 2.5, onInteract, onLook }) { object.userData.interactive = { prompt, distance, onInteract, onLook }; interactables.push(object); return object; },
    _update(dt, t) { for (const fn of updatables) { try { fn(dt, t); } catch (e) { if (!fn._errored) { fn._errored = true; console.error('[update]', e); } } } },
    _registry: registry,
  };
  return ctx;
}
