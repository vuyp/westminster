// ---------------------------------------------------------------------------
// street/sky.js — the London sky: Preetham sky dome (three/addons Sky), the sun (a shadow-casting
// DirectionalLight whose shadow frustum follows the player), a HemisphereLight for the overcast
// bounce, and fog matching the horizon. Dossier §11.12: bright, slightly hazy early-autumn afternoon,
// sun from the south-west so the Portcullis House colonnade and Big Ben's west face are side-lit.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DEG, cloudTexture } from './kit.js';

export function buildSky(ctx, group) {
  const { scene, quality } = ctx;
  const azimuth = 226 * DEG, altitude = 33 * DEG;     // SW, mid-afternoon
  const sunDir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), -Math.cos(azimuth) * Math.cos(altitude)).normalize();

  // ---- sky dome (inside the camera's far plane; the shader only uses the direction)
  let sky = null;
  try {
    sky = new Sky(); sky.scale.setScalar(1500); sky.name = 'sky'; sky.frustumCulled = false;
    const u = sky.material.uniforms; u.turbidity.value = 8; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.008; u.mieDirectionalG.value = 0.72; u.sunPosition.value.copy(sunDir);
    // the Preetham model comes out far too bright for ACES at exposure 1: scale it down before tone mapping
    sky.material.onBeforeCompile = (shader) => { shader.uniforms.skyGain = { value: 0.32 }; shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;').replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );'); sky.userData.shader = shader; };
    sky.material.needsUpdate = true;
    group.add(sky);
  } catch (e) { console.warn('[street] Sky addon failed, falling back to a flat background', e); scene.background = new THREE.Color(0xdde1e4); }

  // ---- the sun
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.1); sun.name = 'sun';
  sun.castShadow = quality !== 'low';
  const ms = quality === 'low' ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms);
  const cam = sun.shadow.camera; cam.left = -110; cam.right = 110; cam.bottom = -110; cam.top = 110; cam.near = 1; cam.far = 560; cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.08; sun.shadow.radius = 2;
  const focus = new THREE.Vector3(10, 0, 8);
  const placeSun = () => { sun.target.position.copy(focus); sun.position.copy(sunDir).multiplyScalar(240).add(focus); };
  placeSun(); group.add(sun); group.add(sun.target);

  // ---- overcast bounce: pale blue-grey sky, warm stone/asphalt ground
  const hemi = new THREE.HemisphereLight(0xd0dae4, 0x5a544b, 0.85); hemi.name = 'hemisphere'; group.add(hemi);

  // ---- haze
  scene.fog = new THREE.Fog(0xcfd6dd, 320, 1550);

  // ---- a broken layer of stratocumulus at 700 m, drifting slowly from the south-west (bright London afternoon, not a clear sky)
  let clouds = null;
  try {
    const tex = cloudTexture(ctx.T); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2.2, 2.2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, opacity: 0.92 });
    clouds = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), mat); clouds.rotation.x = Math.PI / 2; clouds.position.set(0, 700, 0); clouds.frustumCulled = false; clouds.name = 'clouds'; clouds.renderOrder = -1;
    group.add(clouds);
    ctx.onUpdate((dt) => { tex.offset.x += dt * 0.0011; tex.offset.y -= dt * 0.0007; });
  } catch (e) { console.warn('[street] cloud layer failed', e); }

  // keep the shadow frustum centred on the player (snapped to 4 m so the shadow texels don't crawl)
  ctx.onUpdate(() => {
    const p = ctx.player && ctx.player.pos; if (!p) return;
    const tx = Math.round(p.x / 4) * 4, tz = Math.round(p.z / 4) * 4;
    if (tx !== focus.x || tz !== focus.z) { focus.set(tx, 0, tz); placeSun(); }
  });

  return { sun, hemi, sky, clouds, sunDir, azimuth, altitude };
}
