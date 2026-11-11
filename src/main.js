// main.js
// Integração da pista com Mario e Luigi no grid de largada.
// localClippingEnabled precisa ser true, senão o Racer não corta

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { createMario, createLuigi } from './characters/Character.js';
import { createRacer } from './characters/Racer.js';

import { Track } from './track/Track.js';
import { TRACK_CONFIGS } from './track/trackConfigd.js';
import { CameraManager } from './cameras/CameraManager.js';
import { createCone } from './objects/Cone.js';
import { createBarrel } from './objects/Barrel.js';
import { createTireStack } from './objects/TireStack.js';
import { createItemBox } from './objects/ItemBox.js';
import { createOilSlick } from './objects/OilSlick.js';

import { LightController } from './lighting/LightController.js';

// caixa de erro visível na tela, pq às vezes o console está fechado
const errBox = document.createElement('div');
Object.assign(errBox.style, {
  position: 'fixed', top: '8px', left: '8px',
  padding: '8px 12px', background: 'rgba(140,0,0,0.9)', color: '#fff',
  font: '12px/1.4 monospace', zIndex: '10',
  whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto',
  display: 'none', pointerEvents: 'none',
});
document.body.appendChild(errBox);
const showErr = (msg) => {
  console.error(msg);
  errBox.style.display = 'block';
  errBox.textContent += msg + '\n';
};
window.addEventListener('error', (e) =>
  showErr(`${e.message}  @ ${e.filename}:${e.lineno}:${e.colno}`));
window.addEventListener('unhandledrejection', (e) =>
  showErr('unhandledrejection: ' + (e.reason?.stack || e.reason)));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202830);

const lightController = new LightController(scene);

let currentTrackIndex = 0;
let track = null;
let trackLength = 0;

// Vetores globais do grid (usados pelos pilotos e câmeras)
let gridPoint = new THREE.Vector3();
let gridTangent = new THREE.Vector3();
let gridNormal = new THREE.Vector3();

// Listas para gerenciar descarte e atualização dos objetos cênicos da pista
const trackObjects = [];
const itemBoxes = [];
const racers = [];

// posiciona os objetos pela curva, com deslocamento lateral e altura
function placeObject(object, u, sideOffset, height = 0.01) {
  const point = track.path.getPointAt(u);
  const tangent = track.path.getTangentAt(u).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  object.position.copy(point).addScaledVector(normal, sideOffset);
  object.position.y += height;
  object.rotation.y = Math.atan2(tangent.x, tangent.z);
  scene.add(object);

  //salva o objeto para removar após trocar de pista, senão ele fica flutuando no ar
  trackObjects.push(object);
}

function populateTrackObjects() {
  // Cones e barris perto das bordas
  [0.08, 0.09].forEach((u) => {
    placeObject(createCone(), u, 4.5);
  });
  placeObject(createCone(), 0.72, -4.5);
  placeObject(createBarrel(), 0.3, -4.5);
  placeObject(createBarrel(), 0.76, 4.5);

  // Pneus na lateral e óleo no asfalto
  placeObject(createTireStack(), 0.38, 5);
  placeObject(createTireStack(), 0.86, -5);
  placeObject(createOilSlick(), 0.24, -1.8);
  placeObject(createOilSlick(), 0.64, 2);

  // Caixas de itens flutuando
  [0.15, 0.55].forEach((u) => {
    [-3, 0, 3].forEach((sideOffset) => {
      const itemBox = createItemBox();
      placeObject(itemBox, u, sideOffset, 1);
      itemBoxes.push(itemBox);
    });
  });
}

// caixas flutuando acima da pista; a animação é a mesma do preview
function clearTrackObjects() {
  trackObjects.forEach((obj) => {
    scene.remove(obj);
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  });
  trackObjects.length = 0;
  itemBoxes.length = 0;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// sem isto o clipping dos Racers é ignorado
renderer.localClippingEnabled = true;

renderer.domElement.style.display = 'block';
document.body.appendChild(renderer.domElement);

// env map pra iluminar áreas sem luz direta (sem isso o Luigi ficou muito escuro)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// mais fraco que o padrão, senão ele ilumina quase tudo sozinho e não dá
// pra ver a diferença quando a gente desliga as luzes ([L] e [K])
scene.environmentIntensity = 0.3;

// câmera e controles de câmera ficam em src/cameras/CameraManager.js
const cameraManager = new CameraManager(renderer.domElement, {
  gridPoint, gridTangent, gridNormal, path: null,
});

// desloca cada piloto pro lado e pra trás da faixa de largada
function placeRacer(racer, sideOffset, distanceBehind) {
  racer.position.copy(gridPoint)
    .addScaledVector(gridNormal, sideOffset)
    .addScaledVector(gridTangent, -distanceBehind);
  racer.position.y = 0.01; // base das rodas na altura do asfalto
  // kart olha pra +Z; gira o conjunto pra apontar no sentido da largada
  racer.rotation.y = Math.atan2(gridTangent.x, gridTangent.z);
  // posição na curva (0..1) e lado, usados pelo modo demo
  if (track) {
    racer.userData.u = (1 - distanceBehind / track.path.getLength()) % 1;
  } else {
    racer.userData.u = 0;
  }
  racer.userData.side = sideOffset;
  racer.userData.distanceBehind = distanceBehind;
}

// Entrega 3: todas as câmeras (livre, perseguição, piloto), a projeção
// perspectiva e as teclas de troca ficam em src/cameras/CameraManager.js
function loadTrack(index) {
  // 1. Limpa a pista antiga
  if (track) {
    scene.remove(track);
    if (typeof track.dispose === 'function') track.dispose();
  }

  // 2. Limpa os objetos cênicos anteriores
  clearTrackObjects();

  // 3. Instancia a nova pista a partir da configuração
  const config = TRACK_CONFIGS[index];
  track = new Track(config);
  scene.add(track);

  // 4. Recalcula os dados matemáticos do circuito
  trackLength = track.path.getLength();
  gridPoint.copy(track.path.getPointAt(0));
  gridTangent.copy(track.path.getTangentAt(0)).normalize();
  gridNormal.set(-gridTangent.z, 0, gridTangent.x);

  // 5. Repopula a nova pista com objetos
  populateTrackObjects();

  // 6. Reposiciona os pilotos no novo grid de largada
  racers.forEach((racer) => {
    placeRacer(racer, racer.userData.side, racer.userData.distanceBehind);
  });

  // 7. Atualiza as referências de curva no CameraManager
  if (cameraManager) {
    cameraManager.path = track.path;
    cameraManager.gridPoint = gridPoint;
    cameraManager.gridTangent = gridTangent;
    cameraManager.gridNormal = gridNormal;
  }
}



// "modo demo": [Espaço] faz os pilotos andarem pela pista, para mostrar
// // as câmeras de perseguição e do piloto em movimento
const DEMO_SPEED = 14; // unidades por segundo
let driving = false;

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    driving = !driving;
    racers.forEach((r) => { r.speed = driving ? DEMO_SPEED : 0; });
    event.preventDefault();
  }else if (event.key === 'p' || event.key === 'P') {
    currentTrackIndex = (currentTrackIndex + 1) % TRACK_CONFIGS.length;
    loadTrack(currentTrackIndex);
  }
});

// avança um piloto pela curva, mantendo o deslocamento lateral do grid
function driveRacer(racer, delta) {
  racer.userData.u = (racer.userData.u + (DEMO_SPEED * delta) / trackLength + 1) % 1;
  const u = racer.userData.u;
  const tangent = track.path.getTangentAt(u).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  racer.position.copy(track.path.getPointAt(u))
    .addScaledVector(normal, racer.userData.side);
  racer.position.y = 0.01;
  racer.rotation.y = Math.atan2(tangent.x, tangent.z);
}

window.addEventListener('resize', () => {
  cameraManager.resize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const t = clock.elapsedTime;
  racers.forEach((r) => {
    if (driving) driveRacer(r, delta);
    r.update(delta);
  });
  itemBoxes.forEach((itemBox) => {
    itemBox.rotation.y += delta * 1.5;
    itemBox.position.y = 1 + Math.sin(t * 2) * 0.1;
  });
  cameraManager.update(delta);
  renderer.render(scene, cameraManager.camera);
});

(async () => {
  try {
    const marioRacer = await createRacer({
      kartPreset: 'mario',
      characterFactory: createMario,
    });
    placeRacer(marioRacer, -2.5, 3.5);
    marioRacer.speed = 0;          // parado na largada
    marioRacer.idleWheelSpeed = 4; // rodas girando no lugar, esperando o start
    scene.add(marioRacer);
    racers.push(marioRacer);
    cameraManager.setFollowTarget(marioRacer); // câmeras 4 e 5 seguem o Mario
  } catch (e) {
    showErr('Mario falhou: ' + (e.stack || e.message));
  }

  try {
    const luigiRacer = await createRacer({
      kartPreset: 'luigi',
      characterFactory: () => createLuigi(),
    });
    placeRacer(luigiRacer, 2.5, 5);
    luigiRacer.speed = 0;
    luigiRacer.idleWheelSpeed = 4;
    scene.add(luigiRacer);
    racers.push(luigiRacer);
  } catch (e) {
    showErr('Luigi falhou: ' + (e.stack || e.message));
  }

  loadTrack(currentTrackIndex);
})();
