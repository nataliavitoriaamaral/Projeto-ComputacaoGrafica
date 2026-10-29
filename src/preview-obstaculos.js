// preview-obstaculos.js
// Preview so dos obstaculos/objetos, lado a lado (sem pista, sem kart).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCone } from './objects/Cone.js';
import { createBarrel } from './objects/Barrel.js';
import { createTireStack } from './objects/TireStack.js';
import { createItemBox } from './objects/ItemBox.js';
import { createOilSlick } from './objects/OilSlick.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202830);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dir = new THREE.DirectionalLight(0xffffff, 1.3);
dir.position.set(4, 8, 5);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.left = -8;
dir.shadow.camera.right = 8;
dir.shadow.camera.top = 8;
dir.shadow.camera.bottom = -8;
scene.add(dir);

// chao neutro so pra receber sombra + grade de referencia
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 10),
  new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(20, 20, 0x666666, 0x444444));

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 100
);
camera.position.set(0, 2.5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.update();

// objetos em fila no eixo X
const cone = createCone();
const barrel = createBarrel();
const tires = createTireStack();
const oil = createOilSlick();
const itemBox = createItemBox();

const objetos = [cone, barrel, tires, oil, itemBox];
const espacamento = 2.2;
objetos.forEach((obj, i) => {
  obj.position.x = (i - (objetos.length - 1) / 2) * espacamento;
  scene.add(obj);
});

// a caixa de item flutua e gira
const itemBaseY = 1.0;
itemBox.position.y = itemBaseY;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const t = clock.elapsedTime;
  itemBox.rotation.y += delta * 1.5;
  itemBox.position.y = itemBaseY + Math.sin(t * 2) * 0.1;
  controls.update();
  renderer.render(scene, camera);
});