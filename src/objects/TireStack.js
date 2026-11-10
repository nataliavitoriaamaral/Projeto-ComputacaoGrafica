// TireStack.js
// Pilha de pneus: TorusGeometry deitado, empilhado com giros diferentes.
// Origem no chão. Cada pneu tem ~0.28 de altura.

import * as THREE from 'three';
import { loadObstacleTexture } from './loadObstacleTexture.js';

export function createTireStack(count = 3) {
  const g = new THREE.Group();
  g.name = 'TireStack';

  const R = 0.36;    // raio do anel
  const tube = 0.14; // espessura do pneu
  const tireTexture = loadObstacleTexture('tire-tread');

  for (let i = 0; i < count; i++) {
    // o do meio é branco, estilo pneu de pista
    const color = i === 1 ? 0xffffff : 0x888888;
    const mat = new THREE.MeshStandardMaterial({
      map: tireTexture, color, roughness: 0.9,
    });
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 12, 28), mat);
    tire.rotation.x = Math.PI / 2;
    tire.rotation.z = i * 0.7;          // gira cada pneu pra não ficarem idênticos
    tire.position.y = tube + i * tube * 2;
    tire.castShadow = tire.receiveShadow = true;
    g.add(tire);
  }

  return g;
}