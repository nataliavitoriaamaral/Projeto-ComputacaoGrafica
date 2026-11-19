// Página de teste: reproduz os impactos sem precisar dirigir uma volta inteira.
// Usa os modelos, controles e obstáculos reais do projeto.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Track } from '../src/track/Track.js';
import { TRACK_CONFIGS } from '../src/track/trackConfigd.js';
import { createRacer } from '../src/characters/Racer.js';
import { createMario, createBowser } from '../src/characters/Character.js';
import { PlayerController } from '../src/gameplay/PlayerController.js';
import { AIController } from '../src/gameplay/AIController.js';
import { Collision } from '../src/gameplay/Collision.js';
import { Sounds } from '../src/gameplay/Sounds.js';
import { createCone } from '../src/objects/Cone.js';
import { createBarrel } from '../src/objects/Barrel.js';
import { createTireStack } from '../src/objects/TireStack.js';
import { createOilSlick } from '../src/objects/OilSlick.js';
import { disposeObject } from '../src/utils/dispose.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(40, 70, 30);
scene.add(sun);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
const pista = new Track(TRACK_CONFIGS[0]);
scene.add(pista);
const racers = [];
const obstacles = [];
const c = new Collision({ scene, track: pista, racers, obstacles });
const sounds = new Sounds({ racers });
sounds.connect(c);
const result = document.querySelector('#result');
const buttons = document.querySelector('#buttons');
const errors = [];
window.addEventListener('error', (e) => { errors.push(e.message); result.textContent = errors.join('\n'); });
let controller;
let rivalController;
let active = false;
let lastEvent = '-';
let hits = 0;
let selected = '-';

const player = await createRacer({ kartPreset: 'mario', characterFactory: createMario });
const rival = await createRacer({ kartPreset: 'bowser', characterFactory: createBowser });
scene.add(player, rival);
racers.push(player, rival);
player.userData.u = rival.userData.u = 0.2;
player.userData.side = rival.userData.side = 0;
const teclado = { estaSegurada: () => false, foiApertada: () => false, eixo: () => 0 };
controller = new PlayerController({ racer: player, track: pista, scene, teclado });
rivalController = new AIController({ racer: rival, track: pista, personality: 'Bowser' });
c.register(player, controller);
c.register(rival, rivalController);
c.on('collision', (e) => { hits++; lastEvent = e.type; });

function positionAt(object, u, side = 0) {
  const tangent = pista.path.getTangentAt(u);
  object.position.copy(pista.path.getPointAt(u))
    .addScaledVector(new THREE.Vector3(-tangent.z, 0, tangent.x), side);
  object.position.y = 0.01;
  object.rotation.y = Math.atan2(tangent.x, tangent.z);
}

function reset(type) {
  c.reset();
  sounds.reset();
  for (const obj of obstacles) { scene.remove(obj); disposeObject(obj); }
  obstacles.length = 0;
  lastEvent = '-'; hits = 0; selected = type;
  player.userData.u = 0.2 - 3 / pista.path.getLength();
  player.userData.side = 0;
  controller.reiniciar();
  player.userData.speed = player.speed = 14;
  rival.userData.u = 0.25;
  rival.userData.side = -3;
  rivalController.reset();
  const factories = { Cone: createCone, Barril: createBarrel, Pneus: createTireStack, Óleo: createOilSlick };
  if (factories[type]) {
    const obj = factories[type]();
    positionAt(obj, 0.2);
    obj.userData.u = 0.2; obj.userData.side = 0;
    scene.add(obj); obstacles.push(obj);
  }
  if (type === 'Karts') {
    player.userData.u = rival.userData.u = 0.2;
    player.userData.side = -0.2;
    rival.userData.side = 0.2;
    controller.reiniciar(); rivalController.reset();
    player.userData.speed = 14;
  }
  if (type === 'Muro') {
    player.userData.side = 12;
    controller.reiniciar();
    player.userData.speed = 14;
    controller.anguloMovimento -= 0.7;
    controller.anguloNariz = controller.anguloMovimento;
  }
  c.setTrack(pista);
  active = true;
  const point = pista.path.getPointAt(0.2);
  const tangent = pista.path.getTangentAt(0.2);
  camera.position.copy(point).addScaledVector(tangent, -10)
    .addScaledVector(new THREE.Vector3(-tangent.z, 0, tangent.x), 8);
  camera.position.y = 7;
  controls.target.copy(point);
  controls.update();
}

for (const type of ['Cone', 'Barril', 'Pneus', 'Óleo', 'Karts', 'Muro']) {
  const button = document.createElement('button');
  button.textContent = type;
  button.onclick = () => reset(type);
  buttons.appendChild(button);
}
for (const [label, type] of [['Som de moeda', 'coin'], ['Som de item', 'item']]) {
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = () => { sounds.unlock(); sounds.play(type); };
  buttons.appendChild(button);
}
reset('Cone');
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (active) {
    controller.atualizar(dt);
    rivalController.update(dt);
    c.update(dt);
    racers.forEach((r) => r.update(dt, racers));
  }
  controls.update();
  c.updateCamera(camera);
  sounds.update(camera);
  renderer.render(scene, camera);
  const cone = c.colliders.find((entry) => entry.object.name === 'Cone');
  result.textContent = errors.length ? errors.join('\n') :
    `Teste: ${selected} | Impactos: ${hits} | Evento: ${lastEvent} | Estado: ${player.userData.state} | ` +
    `Velocidade: ${player.userData.speed.toFixed(1)} | Cone: ${cone?.flight ? 'em voo/retorno' : 'no lugar'}`;
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
