// OilSlick.js
// Mancha de óleo: 3 discos achatados sobrepostos (CircleGeometry) com escalas
// diferentes, material escuro e brilhante. Fica rente ao chão.

import * as THREE from 'three';

export function createOilSlick() {
  const g = new THREE.Group();
  g.name = 'OilSlick';

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0b0b12, roughness: 0.12, metalness: 0.4,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });

  // [x, z, escala em X, escala em Z]
  const blobs = [
    [0, 0, 1.0, 0.8],
    [0.45, 0.2, 0.6, 0.55],
    [-0.4, -0.25, 0.5, 0.65],
  ];

  blobs.forEach(([x, z, sx, sz], i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), mat);
    disc.rotation.x = -Math.PI / 2;           // deita o disco no chão
    disc.scale.set(sx, sz, 1);
    disc.position.set(x, 0.02 + i * 0.002, z);
    disc.receiveShadow = true;
    g.add(disc);
  });

  return g;
}