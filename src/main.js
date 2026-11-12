// main.js
// Integração da pista com Mario, Luigi, Peach e Bowser no grid de largada.
// localClippingEnabled precisa ser true, senão o Racer não corta

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { createMario, createLuigi, createPeach, createBowser } from './characters/Character.js';
import { createRacer } from './characters/Racer.js';

import { Track } from './track/Track.js';
import { TRACK_CONFIGS } from './track/trackConfigd.js';
import { StartingGrid } from './track/StartingGrid.js';
import { Scenery } from './scenery/Scenery.js';
import { disposeObject } from './utils/dispose.js';
import { CameraManager } from './cameras/CameraManager.js';
import { createCone } from './objects/Cone.js';
import { createBarrel } from './objects/Barrel.js';
import { createTireStack } from './objects/TireStack.js';
import { createItemBox } from './objects/ItemBox.js';
import { createOilSlick } from './objects/OilSlick.js';

import { LightController } from './lighting/LightController.js';

// caixa de erro visível na tela, para quando o console estiver fechado
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
scene.background = new THREE.Color(); // a cor vem do skyColor de cada pista

const lightController = new LightController(scene);

let currentTrackIndex = 0;
let track = null;
let grid = null; // grid de largada da pista atual (src/track/StartingGrid.js)
let scenery = null; // paisagem da pista atual (src/scenery/Scenery.js)
let trackLength = 0;

// Vetores do grid, compartilhados com o CameraManager. São atualizados com
// copy() a cada troca de pista, para a câmera continuar com as mesmas referências.
const gridPoint = new THREE.Vector3();
const gridTangent = new THREE.Vector3();
const gridNormal = new THREE.Vector3();

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

// remove os objetos da pista anterior e libera a memória deles
function clearTrackObjects() {
  trackObjects.forEach((obj) => {
    scene.remove(obj);
    disposeObject(obj);
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

// env map para iluminar áreas sem luz direta (sem ele o Luigi ficava muito escuro)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// intensidade menor que a padrão; caso contrário ele ilumina quase tudo e não é possível
// perceber a diferença ao desligar as luzes ([L] e [K])
scene.environmentIntensity = 0.3;

// pilotos na ordem do grid; cada um precisa de um preset em kartPresets.js
const ROSTER = [
  { name: 'Mario',  kartPreset: 'mario',  characterFactory: createMario  },
  { name: 'Luigi',  kartPreset: 'luigi',  characterFactory: createLuigi  },
  { name: 'Peach',  kartPreset: 'peach',  characterFactory: createPeach  },
  { name: 'Bowser', kartPreset: 'bowser', characterFactory: createBowser },
];

// criado depois da primeira pista, para já nascer com o grid certo
let cameraManager = null;

function loadTrack(index) {
  // 1. Limpa a pista, o grid e a paisagem antigos
  if (track) {
    scene.remove(track);
    track.dispose();
  }
  if (grid) {
    scene.remove(grid);
    disposeObject(grid);
  }
  // a paisagem só sai da cena: as geometrias e os materiais dela são
  // compartilhados e voltam a ser usados quando a pista aparecer de novo
  if (scenery) scene.remove(scenery);

  // 2. Limpa os objetos cênicos anteriores
  clearTrackObjects();

  // 3. Instancia a nova pista a partir da configuração
  const config = TRACK_CONFIGS[index];
  track = new Track(config);
  scene.add(track);

  // paisagem e cor do céu de acordo com o tema da pista
  scenery = new Scenery(track, config.scenery);
  scene.add(scenery);
  scene.background.set(config.skyColor);

  // 4. Novo grid de largada e dados do circuito
  grid = new StartingGrid(track, { slots: ROSTER.length });
  scene.add(grid);
  trackLength = track.path.getLength();
  gridPoint.copy(grid.point);
  gridTangent.copy(grid.tangent);
  gridNormal.copy(grid.normal);

  // 5. Repopula a nova pista com objetos
  populateTrackObjects();

  // 6. Reposiciona os pilotos nas suas vagas do novo grid
  racers.forEach((racer) => grid.placeRacer(racer, racer.userData.slot));

  // 7. Atualiza a curva usada pelo CameraManager (os vetores do grid já
  //    foram atualizados no lugar, no passo 4)
  if (cameraManager) cameraManager.path = track.path;
}

loadTrack(currentTrackIndex);

// Entrega 3: todas as câmeras (livre, perseguição, piloto), a projeção
// perspectiva e as teclas de troca ficam em src/cameras/CameraManager.js
cameraManager = new CameraManager(renderer.domElement, {
  gridPoint, gridTangent, gridNormal, path: track.path,
});

// "modo demo": [Espaço] faz os pilotos andarem pela pista, para mostrar
// // as câmeras de perseguição e do piloto em movimento
const DEMO_SPEED = 14; // unidades por segundo
let driving = false;

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    driving = !driving;
    racers.forEach((r) => { r.speed = driving ? DEMO_SPEED : 0; });
    event.preventDefault();
  }else if (event.key === 'Enter' ) {
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

// carregamento em paralelo; uma falha não interrompe os demais
ROSTER.forEach(async ({ name, kartPreset, characterFactory }, slot) => {
  try {
    const racer = await createRacer({ kartPreset, characterFactory });
    racer.userData.slot = slot; // usado para reposicionar ao trocar de pista
    grid.placeRacer(racer, slot);
    racer.speed = 0;          // parado na largada
    racer.idleWheelSpeed = 4; // rodas girando no lugar, esperando o start
    scene.add(racer);
    racers.push(racer);
    if (name === 'Mario') cameraManager.setFollowTarget(racer); // câmeras 4 e 5
  } catch (e) {
    showErr(`${name} falhou: ` + (e.stack || e.message));
  }
});
