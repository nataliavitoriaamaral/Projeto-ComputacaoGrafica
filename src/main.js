// Integração da pista com Mario, Luigi, Peach e Bowser no grid de largada

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

// teclado e controle do kart do jogador
import { Input } from './gameplay/Input.js';
import { PlayerController } from './gameplay/PlayerController.js';
// adversários com IA
import { AIController, DIFFICULTIES } from './gameplay/AIController.js';
import { Collision } from './gameplay/Collision.js';
import { Sounds } from './gameplay/Sounds.js';

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
// copy() a cada troca de pista para a câmera continuar com as mesmas referências
const gridPoint = new THREE.Vector3();
const gridTangent = new THREE.Vector3();
const gridNormal = new THREE.Vector3();

// Listas para gerenciar descarte e atualização dos objetos da pista
const trackObjects = [];
const itemBoxes = [];
const racers = [];
// obstáculos que a IA desvia 
const obstacles = [];

// posiciona os objetos pela curva, com deslocamento lateral e altura
function placeObject(object, u, sideOffset, height = 0.01) {
  const point = track.path.getPointAt(u);
  const tangent = track.path.getTangentAt(u).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  object.position.copy(point).addScaledVector(normal, sideOffset);
  object.position.y += height;
  object.rotation.y = Math.atan2(tangent.x, tangent.z);
  // posição na pista lida pela IA para desviar
  object.userData.u = u;
  object.userData.side = sideOffset;
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

  trackObjects.forEach((obj) => {
    if (!itemBoxes.includes(obj)) obstacles.push(obj);
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
  obstacles.length = 0;
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
// intensidade menor que a padrão para
// perceber a diferença ao desligar as luzes ([L] e [K])
scene.environmentIntensity = 0.3;

// pilotos na ordem do grid
const ROSTER = [
  { name: 'Mario',  kartPreset: 'mario',  characterFactory: createMario  },
  { name: 'Luigi',  kartPreset: 'luigi',  characterFactory: createLuigi  },
  { name: 'Peach',  kartPreset: 'peach',  characterFactory: createPeach  },
  { name: 'Bowser', kartPreset: 'bowser', characterFactory: createBowser },
];

// criado depois da primeira pista, para já nascer com o grid certo
let cameraManager = null;

// Teclado e controle do jogador. O jogador é o Mario, e o controle só é
// criado quando o modelo dele termina de carregar 
const teclado = new Input();
let controleJogador = null;

// um AIController para cada rival (Luigi, Peach e Bowser)
const aiControllers = [];
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];
let difficulty = 'normal';
let collisions = null;
const sounds = new Sounds({ racers });

function loadTrack(index) {
  // Limpa a pista, o grid e a paisagem antigos
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

  // Limpa os objetos cênicos anteriores
  clearTrackObjects();

  // Instancia a nova pista a partir da configuração
  const config = TRACK_CONFIGS[index];
  track = new Track(config);
  scene.add(track);

  // paisagem e cor do céu de acordo com o tema da pista
  scenery = new Scenery(track, config.scenery);
  scene.add(scenery);
  scene.background.set(config.skyColor);

  // Novo grid de largada e dados do circuito
  grid = new StartingGrid(track, { slots: ROSTER.length });
  scene.add(grid);
  trackLength = track.path.getLength();
  gridPoint.copy(grid.point);
  gridTangent.copy(grid.tangent);
  gridNormal.copy(grid.normal);
  lightController.setTrack(track);

  // Repopula a nova pista com objetos
  populateTrackObjects();

  // Reposiciona os pilotos nas suas vagas do novo grid
  racers.forEach((racer) => grid.placeRacer(racer, racer.userData.slot));
  // o jogador volta a ficar parado na vaga dele
  if (controleJogador) controleJogador.trocarPista(track);
  // os rivais também voltam para a vaga, parados
  aiControllers.forEach((ai) => ai.setTrack(track));
  collisions?.setTrack(track);
  sounds.reset();

  // Atualiza a curva usada pelo CameraManager 
  if (cameraManager) cameraManager.setTrack(track.path, track.trackWidth);
}

loadTrack(currentTrackIndex);

cameraManager = new CameraManager(renderer.domElement, {
  gridPoint, gridTangent, gridNormal, path: track.path, trackWidth: track.trackWidth,
});
collisions = new Collision({ scene, track, racers, obstacles });
sounds.connect(collisions);

// texto no canto da tela com a dificuldade da IA
const difficultyBox = document.createElement('div');
Object.assign(difficultyBox.style, {
  position: 'fixed', bottom: '8px', right: '8px',
  padding: '6px 10px', background: 'rgba(0,0,0,0.6)', color: '#fff',
  font: '12px/1.5 monospace', zIndex: '5', pointerEvents: 'none',
  borderRadius: '4px',
});
document.body.appendChild(difficultyBox);
let aiRunning = false;
function updateDifficultyBox() {
  difficultyBox.textContent =
    `IA: ${DIFFICULTIES[difficulty].label} [N]  |  ${aiRunning ? 'correndo' : 'parada'} [M]`;
}
updateDifficultyBox();

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') {
    // [M] liga e desliga os rivais
    aiRunning = !aiRunning;
    aiControllers.forEach((ai) => { ai.enabled = aiRunning; });
    updateDifficultyBox();
  } else if (event.code === 'KeyN') {
    // [N] troca a dificuldade: fácil, normal e difícil
    const next = (DIFFICULTY_ORDER.indexOf(difficulty) + 1) % DIFFICULTY_ORDER.length;
    difficulty = DIFFICULTY_ORDER[next];
    aiControllers.forEach((ai) => ai.setDifficulty(difficulty));
    updateDifficultyBox();
  } else if (event.key === 'Enter' ) {
    currentTrackIndex = (currentTrackIndex + 1) % TRACK_CONFIGS.length;
    loadTrack(currentTrackIndex);
  }
});

window.addEventListener('resize', () => {
  cameraManager.resize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const t = clock.elapsedTime;

  if (controleJogador) controleJogador.atualizar(delta);
  aiControllers.forEach((ai) => ai.update(delta));
  // depois do movimento: obstáculos, empurrões e limites da pista
  collisions.update(delta);
  racers.forEach((r) => r.update(delta, racers));
  itemBoxes.forEach((itemBox) => {
    itemBox.rotation.y += delta * 1.5;
    itemBox.position.y = 1 + Math.sin(t * 2) * 0.1;
  });
  cameraManager.update(delta);
  collisions.updateCamera(cameraManager.camera);
  sounds.update(cameraManager.camera);
  renderer.render(scene, cameraManager.camera);
  // limpa as teclas apertadas neste frame depois que todos já leram
  teclado.fimDoFrame();
});

// carregamento em paralelo
ROSTER.forEach(async ({ name, kartPreset, characterFactory }, slot) => {
  try {
    const racer = await createRacer({ kartPreset, characterFactory });
    racer.userData.slot = slot; // usado para reposicionar ao trocar de pista
    grid.placeRacer(racer, slot);
    racer.speed = 0;          // parado na largada
    racer.idleWheelSpeed = 4; // rodas girando no lugar, esperando o start
    scene.add(racer);
    racers.push(racer);
    if (name === 'Mario') {
      // as câmeras 4 e 5 seguem o alvoCamera do jogador, que acompanha o
      // kart mas não gira junto quando ele roda
      controleJogador = new PlayerController({ racer, track, scene, teclado });
      collisions.register(racer, controleJogador);
      cameraManager.setFollowTarget(controleJogador.alvoCamera);
      cameraManager.setView('chase');
    } else {
      // os outros pilotos são controlados pela IA. items fica null até o
      // sistema de itens existir
      const ai = new AIController({
        racer, track, personality: name, difficulty, obstacles, racers, items: null,
      });
      ai.enabled = aiRunning;
      aiControllers.push(ai);
      collisions.register(racer, ai);
    }
  } catch (e) {
    showErr(`${name} falhou: ` + (e.stack || e.message));
  }
});
