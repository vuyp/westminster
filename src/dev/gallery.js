// Dev-only: a gallery of every material + sign generator on a floor, to eyeball the procedural textures.
import * as THREE from 'three';
export function build(ctx) {
  const { M, T, box, floorPlane, signPlane, scene, collision } = ctx;
  const g = new THREE.Group(); g.name = 'gallery';
  const mats = [['concrete', M.concrete()], ['precast', M.precast()], ['granite', M.granite()], ['tactile', M.tactile('blister')], ['corduroy', M.tactile('corduroy')], ['stainless', M.stainless()], ['tiles', M.tiles()], ['paving', M.paving()], ['tarmac', M.tarmac()], ['portland', M.portland()], ['sandstone', M.sandstone()], ['bronze', M.bronze()], ['moquette', M.moquette()], ['perforated', M.perforated()], ['glass', M.glass()], ['aluminium', M.aluminium()]];
  mats.forEach(([name, m], i) => { const b = box(2, 2, 2, m, { x: (i % 8) * 3 - 10.5, y: 1, z: -Math.floor(i / 8) * 4 - 4 }); b.name = name; g.add(b); });
  g.add(floorPlane(40, 20, M.granite(), { y: 0, z: -6 }));
  collision.addFloor({ xMin: -20, xMax: 20, zMin: -16, zMax: 4, y: 0 });
  // signs
  g.add(signPlane(T.directionSign({ text: 'Jubilee line', arrow: 'left', pills: [] }), 4, 1, { x: -8, y: 3.5, z: -13, facing: 'south' }));
  g.add(signPlane(T.wayOutSign({ arrow: 'right', extra: 'Exit 1 Houses of Parliament' }), 4, 1, { x: -3, y: 3.5, z: -13, facing: 'south' }));
  g.add(signPlane(T.stationNameBoard({ name: 'WESTMINSTER' }), 3, 1.5, { x: 2, y: 3.5, z: -13, facing: 'south' }));
  g.add(signPlane(T.roundel({ text: 'UNDERGROUND' }), 1.5, 1.5, { x: 5.5, y: 3.5, z: -13, facing: 'south', transparent: true }));
  const dm = T.dotMatrix({ cols: 40, rows: 3 }); dm.set([{ left: '1 Stratford', right: '2 min' }, { left: '2 Stratford', right: '5 min' }, 'Please stand behind the yellow line']);
  const dmMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4 / dm.aspect), M.screen(dm.texture)); dmMesh.position.set(9, 3.5, -13); g.add(dmMesh);
  g.add(signPlane(T.lineDiagram({ stations: ['Green Park', 'Westminster', 'Waterloo', 'Southwark', 'London Bridge'], color: '#a0a5a9', line: 'Jubilee' }), 6, 0.75, { x: -8, y: 5, z: -13 }));
  g.add(signPlane(T.poster({ headline: 'Mind the gap', sub: 'Please stand behind the yellow line', seed: 3 }), 1.5, 2.25, { x: 12, y: 3.5, z: -13 }));
  scene.add(g);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(10, 20, 10); sun.castShadow = true; scene.add(sun); scene.add(new THREE.HemisphereLight(0xdde6ff, 0x444444, 1.0));
  return { group: g };
}
