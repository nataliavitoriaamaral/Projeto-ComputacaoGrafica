// Banana.js
// Casca de banana deixada na pista, feita com primitivas: três arcos de
// toro amarelos (as abas da casca caídas no chão), uma esfera esticada (o
// meio) e um cilindro marrom (o cabinho) em cima. Origem no chão, no centro.

import * as THREE from 'three';

// um quarto de toro faz uma aba curvada. Ele nasce no plano XY, indo do
// ponto (R, 0) até (0, R). Girando 180° em Z e deslocando o centro para
// (R, R), o arco vai do meio da casca, no alto, até o chão do lado de
// fora, com a curva côncava de uma casca aberta.
const R = 0.32;

// Várias bananas podem estar na pista ao mesmo tempo, então geometrias e
// materiais são compartilhados. Por isso o Items.js só tira a banana da
// cena, sem chamar dispose().
let shared = null;
function getShared() {
  if (shared) return shared;
  shared = {
    yellow: new THREE.MeshStandardMaterial({ color: 0xffd93b, roughness: 0.55 }),
    brown: new THREE.MeshStandardMaterial({ color: 0x5b3a12, roughness: 0.8 }),
    flapGeo: new THREE.TorusGeometry(R, 0.09, 8, 16, Math.PI / 2),
    coreGeo: new THREE.SphereGeometry(0.14, 12, 10),
    stemGeo: new THREE.CylinderGeometry(0.04, 0.06, 0.16, 8),
  };
  return shared;
}

export function createBanana() {
  const { yellow, brown, flapGeo, coreGeo, stemGeo } = getShared();

  const g = new THREE.Group();
  g.name = 'Banana';

  for (let i = 0; i < 3; i++) {
    // cada aba fica num "braço" que gira 120° em torno de Y
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI * 2) / 3;

    const flap = new THREE.Mesh(flapGeo, yellow);
    flap.rotation.z = Math.PI;
    flap.position.set(R, R + 0.06, 0);
    flap.scale.z = 1.4; // aba mais larga que grossa
    arm.add(flap);
    g.add(arm);
  }

  // meio da casca, onde as abas se juntam
  const core = new THREE.Mesh(coreGeo, yellow);
  core.position.y = 0.38;
  core.scale.y = 1.4;
  g.add(core);

  const stem = new THREE.Mesh(stemGeo, brown);
  stem.position.y = 0.62;
  g.add(stem);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
