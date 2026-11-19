// Coin.js
// Moeda coletável feita só com primitivas: um cilindro achatado (corpo),
// um toro (aro) e uma caixa fina (o risco vertical no meio).
// Origem no centro da moeda; ela fica "em pé", com a face virada para +Z.
// Quem posiciona, gira e coleta é o src/gameplay/Items.js.

import * as THREE from 'three';

const RADIUS = 0.45;
const THICKNESS = 0.1;

// Geometrias e materiais são criados uma vez só e reaproveitados por todas
// as moedas da pista (são dezenas). Por isso o Items.js só tira as moedas
// da cena, sem chamar dispose().
let shared = null;
function getShared() {
  if (shared) return shared;

  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc928,
    metalness: 0.75,
    roughness: 0.28,
    emissive: 0x5a3a00, // brilho próprio leve, para a moeda aparecer na sombra
  });
  const darkGold = new THREE.MeshStandardMaterial({
    color: 0xc98a00,
    metalness: 0.7,
    roughness: 0.35,
    emissive: 0x3a2400,
  });

  // o cilindro nasce em pé no eixo Y; girando 90° em X a face vira para +Z
  const body = new THREE.CylinderGeometry(RADIUS, RADIUS, THICKNESS, 32);
  body.rotateX(Math.PI / 2);

  // o toro já nasce no plano XY, ou seja, com a face para +Z
  const rim = new THREE.TorusGeometry(RADIUS, 0.05, 8, 32);

  // risco vertical no meio, um pouco mais grosso que o corpo para aparecer dos dois lados
  const slot = new THREE.BoxGeometry(0.1, RADIUS * 0.95, THICKNESS + 0.03);

  shared = { gold, darkGold, body, rim, slot };
  return shared;
}

export function createCoin() {
  const { gold, darkGold, body, rim, slot } = getShared();

  const g = new THREE.Group();
  g.name = 'Coin';

  const bodyMesh = new THREE.Mesh(body, gold);
  const rimMesh = new THREE.Mesh(rim, gold);
  const slotMesh = new THREE.Mesh(slot, darkGold);

  [bodyMesh, rimMesh, slotMesh].forEach((m) => {
    m.castShadow = true;
    g.add(m);
  });

  return g;
}
