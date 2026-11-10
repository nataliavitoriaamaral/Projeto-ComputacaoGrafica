// Cone.js
// Cone de trânsito: base quadrada + tronco de cone laranja + faixa branca.
// Origem (0,0,0) fica no chão. Altura total ~0.89.

import * as THREE from 'three';
import { loadObstacleTexture } from './loadObstacleTexture.js';

export function createCone() {
  const g = new THREE.Group();
  g.name = 'Cone';

  // Base quadrada com textura de sinalização.
  const hazardTexture = loadObstacleTexture('cone-hazard');
  const baseMat = new THREE.MeshStandardMaterial({
    map: hazardTexture, roughness: 0.8,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.72), baseMat);
  base.position.y = 0.035;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // corpo: CylinderGeometry com topo estreito vira um cone cortado
  const bodyMat = new THREE.MeshStandardMaterial({
    map: hazardTexture, roughness: 0.5,
  });
  const bodyHeight = 0.82;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, bodyHeight, 32), bodyMat);
  body.position.y = 0.07 + bodyHeight / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // faixa branca: outro tronco, com raios calculados na altura certa do corpo
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.167, 0.17, 32), stripeMat);
  stripe.position.y = 0.07 + bodyHeight / 2;
  stripe.castShadow = stripe.receiveShadow = true;
  g.add(stripe);

  return g;
}