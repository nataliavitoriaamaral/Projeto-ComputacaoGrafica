// main.js
// Integração da pista com Mario e Luigi no grid de largada.
// localClippingEnabled precisa ser true, senão o Racer não corta

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { createMario, createLuigi } from './characters/Character.js';
import { createRacer } from './characters/Racer.js';

import { Track } from './track/Track.js';
import { createCone } from './objects/Cone.js';
import { createBarrel } from './objects/Barrel.js';
import { createTireStack } from './objects/TireStack.js';
import { createItemBox } from './objects/ItemBox.js';
import { createOilSlick } from './objects/OilSlick.js';

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
  console.error('[preview]', msg);
  errBox.style.display = 'block';
  errBox.textContent += msg + '\n';
};
window.addEventListener('error', (e) =>
  showErr(`${e.message}  @ ${e.filename}:${e.lineno}:${e.colno}`));
window.addEventListener('unhandledrejection', (e) =>
  showErr('unhandledrejection: ' + (e.reason?.stack || e.reason)));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202830);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(100, 80, 50);
dir.target.position.set(10, 0, -30);
dir.castShadow = true;
// cobre o circuito inteiro. O mapa maior ajuda nas sombras dos objetos pequenos
dir.shadow.mapSize.set(4096, 4096);
dir.shadow.camera.left = -115;
dir.shadow.camera.right = 115;
dir.shadow.camera.top = 115;
dir.shadow.camera.bottom = -115;
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 300;
dir.shadow.normalBias = 0.02;
scene.add(dir);
scene.add(dir.target);

const track = new Track();
scene.add(track);

// posiciona os objetos pela curva, com deslocamento lateral e altura
function placeObject(object, u, sideOffset, height = 0.01) {
  const point = track.path.getPointAt(u);
  const tangent = track.path.getTangentAt(u).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  object.position.copy(point).addScaledVector(normal, sideOffset);
  object.position.y += height;
  object.rotation.y = Math.atan2(tangent.x, tangent.z);
  scene.add(object);
}

// cones e barris perto das bordas, sem fechar a passagem dos karts
[0.08, 0.09].forEach((u) => {
  placeObject(createCone(), u, 4.5);
});
placeObject(createCone(), 0.72, -4.5);
placeObject(createBarrel(), 0.3, -4.5);
placeObject(createBarrel(), 0.76, 4.5);

// pneus na lateral e óleo no asfalto, longe do grid de largada
placeObject(createTireStack(), 0.38, 5);
placeObject(createTireStack(), 0.86, -5);
placeObject(createOilSlick(), 0.24, -1.8);
placeObject(createOilSlick(), 0.64, 2);

// caixas flutuando acima da pista; a animação é a mesma do preview
const itemBoxes = [];
[0.15, 0.55].forEach((u) => {
  [-3, 0, 3].forEach((sideOffset) => {
    const itemBox = createItemBox();
    placeObject(itemBox, u, sideOffset, 1);
    itemBoxes.push(itemBox);
  });
});

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 500
);

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

const controls = new OrbitControls(camera, renderer.domElement);

// usa a posição e a direção da faixa pra alinhar os pilotos na largada
const gridPoint = track.path.getPointAt(0);
const gridTangent = track.path.getTangentAt(0).normalize();
// vetor lateral da pista, igual ao usado nas zebras e nos muros
const gridNormal = new THREE.Vector3(-gridTangent.z, 0, gridTangent.x);

// desloca cada piloto pro lado e pra trás da faixa de largada
function placeRacer(racer, sideOffset, distanceBehind) {
  racer.position.copy(gridPoint)
    .addScaledVector(gridNormal, sideOffset)
    .addScaledVector(gridTangent, -distanceBehind);
  racer.position.y = 0.01; // base das rodas na altura do asfalto
  // kart olha pra +Z; gira o conjunto pra apontar no sentido da largada
  racer.rotation.y = Math.atan2(gridTangent.x, gridTangent.z);
}

// câmera atrás e ao lado dos pilotos, olhando pra região da largada
function showStartView() {
  camera.position.copy(gridPoint)
    .addScaledVector(gridTangent, -14)
    .addScaledVector(gridNormal, 7);
  camera.position.y = 10;
  controls.target.copy(gridPoint).addScaledVector(gridTangent, -3);
  controls.target.y = 0.8;
  controls.update();
}

// tecla 1 mostra a largada; tecla 2 mostra o circuito inteiro
// tecla 3 mostra o primeiro trecho com cones e caixas de item
// o mouse continua controlando a câmera pelo OrbitControls
window.addEventListener('keydown', (event) => {
  if (event.key === '1') showStartView();
  if (event.key === '2') {
    // vista de cima, com espaço pra pista inteira aparecer
    camera.position.set(10, 245, -10);
    controls.target.set(10, 0, -30);
    controls.update();
  }
  if (event.key === '3') {
    const point = track.path.getPointAt(0.09);
    const tangent = track.path.getTangentAt(0.09).normalize();
    camera.position.copy(point).addScaledVector(tangent, -32);
    camera.position.y = 36;
    controls.target.copy(point);
    controls.update();
  }
});
showStartView();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const racers = [];

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const t = clock.elapsedTime;
  racers.forEach((r) => r.update(delta));
  itemBoxes.forEach((itemBox) => {
    itemBox.rotation.y += delta * 1.5;
    itemBox.position.y = 1 + Math.sin(t * 2) * 0.1;
  });
  controls.update();
  renderer.render(scene, camera);
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
})();
