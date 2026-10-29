// main.js
// Preview com Mario e Luigi lado a lado nos karts.
// localClippingEnabled precisa que ser true, senão o Racer não corta
// as pernas e os personagens voltam a ficar "em pé no banco".

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { createMario, createLuigi } from './characters/Character.js';
import { createRacer } from './characters/Racer.js';

import { Track } from './track/Track.js';

// caixa de erro visível na tela, pq às vezes o console tá fechado
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
dir.position.set(5, 10, 5);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.left = -8;
dir.shadow.camera.right = 8;
dir.shadow.camera.top = 8;
dir.shadow.camera.bottom = -8;
scene.add(dir);

scene.add(new THREE.GridHelper(10, 10));

const track = new Track();
scene.add(track);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 100
);
//visualização do circuito completo
// camera.position.set(0, 45, 75);
// camera.lookAt(0, 0, 0);

camera.position.set(5, 3, 6);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
controls.target.set(0, 1, 0);
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const racers = [];

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  racers.forEach((r) => r.update(delta));
  controls.update();
  renderer.render(scene, camera);
});

(async () => {
  try {
    const marioRacer = await createRacer({
      kartPreset: 'mario',
      characterFactory: createMario,
    });
    marioRacer.position.x = -2;
    marioRacer.speed = 6;
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
    luigiRacer.position.x = 2;
    luigiRacer.speed = 6;
    scene.add(luigiRacer);
    racers.push(luigiRacer);
  } catch (e) {
    showErr('Luigi falhou: ' + (e.stack || e.message));
  }
})();