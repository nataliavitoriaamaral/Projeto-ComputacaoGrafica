// kartDecorations.js
// Enfeites opcionais do kart, feitos com primitivas. Cada função recebe o
// kart e retorna um THREE.Group. A lista usada vem de decorations no preset.

import * as THREE from 'three';

// espinhos do Bowser sobre os flancos
function buildSpikes(kart) {
  const group = new THREE.Group();
  group.name = 'spikes';

  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xF4EEDC, roughness: 0.35, metalness: 0.0,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x111111, roughness: 0.5, metalness: 0.2,
  });

  // topo dos flancos, conforme Kart._buildMainBody
  const topY = kart.wheelRadius + 0.52;

  const spikeGeo = new THREE.ConeGeometry(0.055, 0.17, 12);
  // anel preto na base do espinho
  const ringGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12);

  const addSpike = (x, z, tiltZ) => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, topY + 0.02, z);
    group.add(ring);

    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(x, topY + 0.12, z);
    spike.rotation.z = tiltZ;
    spike.castShadow = true;
    group.add(spike);
  };

  // três em cada flanco, levemente inclinados para fora
  for (const side of [-1, 1]) {
    for (const z of [-0.55, -0.25, 0.05]) {
      addSpike(side * 0.5, z, -side * 0.25);
    }
  }

  return group;
}

// coroa da Peach sobre o painel traseiro
function buildCrown(kart) {
  const group = new THREE.Group();
  group.name = 'crown';

  // DoubleSide porque o aro é aberto e a face interna fica visível
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xF2C200, roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide,
  });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xE0261B, roughness: 0.2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x4AA3E0, roughness: 0.2 });

  const radius = 0.11;

  // aro: cilindro sem tampas
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.9, 0.08, 24, 1, true),
    goldMat
  );
  band.position.y = 0.04;
  band.castShadow = true;
  group.add(band);

  // cinco pontas com uma esfera no topo de cada uma
  const pointGeo = new THREE.ConeGeometry(0.03, 0.09, 8);
  const ballGeo = new THREE.SphereGeometry(0.018, 10, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.sin(a) * radius;
    const z = Math.cos(a) * radius;

    const point = new THREE.Mesh(pointGeo, goldMat);
    point.position.set(x, 0.125, z);
    group.add(point);

    const ball = new THREE.Mesh(ballGeo, goldMat);
    ball.position.set(x, 0.175, z);
    group.add(ball);
  }

  // joias voltadas para trás, onde fica a câmera de perseguição
  const gemGeo = new THREE.SphereGeometry(0.022, 12, 10);
  const addGem = (angle, mat) => {
    const gem = new THREE.Mesh(gemGeo, mat);
    gem.position.set(Math.sin(angle) * radius, 0.04, Math.cos(angle) * radius);
    group.add(gem);
  };
  addGem(Math.PI, redMat);
  addGem(Math.PI - 0.9, blueMat);
  addGem(Math.PI + 0.9, blueMat);

  // topo do painel traseiro, conforme Kart._buildMainBody
  group.position.set(0, kart.wheelRadius + 0.52, -0.6);
  return group;
}

const BUILDERS = {
  spikes: buildSpikes,
  crown:  buildCrown,
};

// adiciona ao kart os enfeites listados no preset
export function addDecorations(kart, names = []) {
  for (const name of names) {
    const build = BUILDERS[name];
    if (!build) {
      console.warn(`Kart: enfeite "${name}" não existe`);
      continue;
    }
    kart.add(build(kart));
  }
}
