// sceneryProps.js
// Peças da paisagem, feitas só com primitivas do Three.js.
// Cada função devolve um THREE.Group com a origem no chão.
//
// As geometrias e os materiais ficam fora das funções e são compartilhados
// entre todas as cópias: 80 árvores usam as mesmas 2 geometrias e os mesmos
// 2 materiais. Muda só a posição/escala/rotação de cada malha.
// Por isso a paisagem não passa pelo disposeObject quando troca de pista.
//
// flatShading deixa as faces "chapadas", no estilo low poly.

import * as THREE from 'three';

// cria uma malha que projeta e recebe sombra
function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- campo (Circuito Tradicional) ----------

const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8);
const crownGeo = new THREE.ConeGeometry(1.4, 3.2, 8);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8, flatShading: true });

// pinheiro: tronco (cilindro) + copa (cone)
export function createTree() {
  const g = new THREE.Group();
  g.name = 'Tree';

  const trunk = mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.8; // metade da altura do tronco
  g.add(trunk);

  const crown = mesh(crownGeo, crownMat);
  crown.position.y = 1.6 + 1.6; // em cima do tronco
  g.add(crown);

  return g;
}

const mountainGeo = new THREE.ConeGeometry(30, 45, 7);
const snowGeo = new THREE.ConeGeometry(8.2, 12, 7); // mesmo formato da ponta da montanha
const mountainMat = new THREE.MeshStandardMaterial({ color: 0x5f7356, roughness: 1, flatShading: true });
const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6, flatShading: true });

// montanha: cone grande + cone branco menor na ponta (neve)
export function createMountain() {
  const g = new THREE.Group();
  g.name = 'Mountain';

  const mountain = mesh(mountainGeo, mountainMat);
  mountain.position.y = 45 / 2;
  g.add(mountain);

  // a ponta do cone tem 12 de altura; raio na base dela = 30 * 12/45 = 8
  const snow = mesh(snowGeo, snowMat);
  snow.position.y = 45 - 12 / 2;
  g.add(snow);

  return g;
}

// ---------- deserto (Circuito Deserto) ----------

const cactusBodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 3.2, 8);
const cactusArmGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 8);
const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8, flatShading: true });

// um braço do cacto: um pedaço deitado saindo do corpo e outro em pé
function addCactusArm(group, side, height) {
  const out = mesh(cactusArmGeo, cactusMat);
  out.rotation.z = Math.PI / 2; // deita o cilindro
  out.position.set(side * 0.7, height, 0);
  group.add(out);

  const up = mesh(cactusArmGeo, cactusMat);
  up.scale.y = 1.2;
  up.position.set(side * 1.15, height + 0.5, 0);
  group.add(up);
}

// cacto: corpo + dois braços em alturas diferentes
export function createCactus() {
  const g = new THREE.Group();
  g.name = 'Cactus';

  const body = mesh(cactusBodyGeo, cactusMat);
  body.position.y = 1.6;
  g.add(body);

  addCactusArm(g, -1, 1.4);
  addCactusArm(g, 1, 2.0);

  return g;
}

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x9c6b4a, roughness: 1, flatShading: true });

// pedra: dodecaedro achatado
export function createRock() {
  const g = new THREE.Group();
  g.name = 'Rock';

  const rock = mesh(rockGeo, rockMat);
  rock.scale.set(1.4, 0.8, 1.1);
  rock.position.y = 0.5;
  g.add(rock);

  return g;
}

// platô (mesa): tronco de cone baixo e largo, com uma faixa mais clara
// imitando as camadas de rocha
const mesaGeo = new THREE.CylinderGeometry(18, 24, 16, 8);
const mesaBandGeo = new THREE.CylinderGeometry(19.3, 20.4, 3, 8); // um pouco maior que o platô naquela altura
const mesaMat = new THREE.MeshStandardMaterial({ color: 0xb5532c, roughness: 1, flatShading: true });
const mesaBandMat = new THREE.MeshStandardMaterial({ color: 0xd98a52, roughness: 1, flatShading: true });

export function createMesa() {
  const g = new THREE.Group();
  g.name = 'Mesa';

  const mesa = mesh(mesaGeo, mesaMat);
  mesa.position.y = 8;
  g.add(mesa);

  const band = mesh(mesaBandGeo, mesaBandMat);
  band.position.y = 11.5;
  g.add(band);

  return g;
}

// ---------- cidade (Circuito Neon / Noite) ----------

// cor emissiva: o material "brilha" sozinho, mesmo sem luz batendo nele
function neonMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
}

const NEON = [neonMaterial(0xff007f), neonMaterial(0x00f0ff)]; // rosa e ciano, as cores das zebras
const boxGeo = new THREE.BoxGeometry(1, 1, 1); // cubo unitário, esticado com scale
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1b1b2f, roughness: 0.7 });

// prédio: caixa escura com duas faixas de neon.
// Usa o mesmo cubo 1x1x1 para tudo e muda só a escala.
export function createBuilding() {
  const g = new THREE.Group();
  g.name = 'Building';

  const w = THREE.MathUtils.randFloat(6, 12);
  const h = THREE.MathUtils.randFloat(12, 40);
  const d = THREE.MathUtils.randFloat(6, 12);
  const neon = NEON[THREE.MathUtils.randInt(0, 1)];

  const body = mesh(boxGeo, buildingMat);
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  g.add(body);

  // faixas um pouco maiores que o prédio, para aparecerem por fora
  [h - 0.6, h * 0.5].forEach((y) => {
    const band = mesh(boxGeo, neon);
    band.scale.set(w + 0.3, 0.5, d + 0.3);
    band.position.y = y;
    g.add(band);
  });

  return g;
}

const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 5, 8);
const lampGeo = new THREE.SphereGeometry(0.4, 12, 8);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5, metalness: 0.6 });

// poste: cilindro fino + esfera de neon na ponta
export function createStreetLamp() {
  const g = new THREE.Group();
  g.name = 'StreetLamp';

  const pole = mesh(poleGeo, poleMat);
  pole.position.y = 2.5;
  g.add(pole);

  const lamp = mesh(lampGeo, NEON[THREE.MathUtils.randInt(0, 1)]);
  lamp.castShadow = false;
  lamp.position.y = 5.2;
  g.add(lamp);

  return g;
}
