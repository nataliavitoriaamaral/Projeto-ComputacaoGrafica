// Cone.js
// Cone de trânsito: base quadrada + tronco de cone laranja + faixa branca.
// Origem (0,0,0) fica no chão. Altura total ~0.76.

import * as THREE from 'three';

export function createCone() {
  const g = new THREE.Group();
  g.name = 'Cone';

  // base quadrada (BoxGeometry)
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), baseMat);
  base.position.y = 0.03;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // corpo: CylinderGeometry com topo estreito vira um cone cortado
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.22, 0.7, 24), bodyMat);
  body.position.y = 0.06 + 0.35;
  body.castShadow = true;
  g.add(body);

  // faixa branca: outro tronco, com raios calculados na altura certa do corpo
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.161, 0.15, 24), stripeMat);
  stripe.position.y = 0.06 + 0.325;
  g.add(stripe);

  return g;
}