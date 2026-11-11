// CameraManager.js
// Câmeras do jogo (entrega 3). O main.js chama update(delta) a cada frame
// e renderiza com manager.camera, que é a câmera ativa.
//
// Matriz de projeção:
// - definida em _makeCamera(): o construtor da PerspectiveCamera chama
//   updateProjectionMatrix(), que monta camera.projectionMatrix a partir de
//   fov, aspect, near e far. Ela é recalculada em resize() e changeFov().
// - aplicada no renderer.render(scene, camera) do main.js: o Three.js manda a
//   projectionMatrix pro vertex shader, que faz
//   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//   e a divisão por w depois disso é o que deixa o que está longe menor.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const NEAR = 0.1;
const FAR = 500;

export class CameraManager {
  constructor(domElement, { gridPoint, gridTangent, gridNormal, path }) {
    this.aspect = window.innerWidth / window.innerHeight;
    this.grid = { point: gridPoint, tangent: gridTangent, normal: gridNormal };
    this.path = path;

    // o piloto que as câmeras de perseguição/primeira pessoa acompanham
    this.followTarget = null;

    // câmera livre (mouse)
    this.orbitCamera = this._makeCamera(50);
    this.controls = new OrbitControls(this.orbitCamera, domElement);

    // perseguição: 3ª pessoa, atrás do kart
    this.chaseCamera = this._makeCamera(65);
    this._chaseOffset = new THREE.Vector3(0, 3.4, -8);   // atrás e acima do kart
    this._chaseLookAhead = new THREE.Vector3(0, 1.2, 6); // olha um pouco à frente
    this._chaseReady = false;

    // piloto: 1ª pessoa, na altura dos olhos
    this.driverCamera = this._makeCamera(80);
    this._driverEye = new THREE.Vector3(0, 1.75, 0.15);
    this._driverLookAt = new THREE.Vector3(0, 1.5, 10);

    // vistas disponíveis; a tecla de cada uma e a lista usada no HUD
    this.views = [
      { id: 'largada',   key: '1', name: 'Largada (livre)',          camera: this.orbitCamera,  orbit: true },
      { id: 'circuito',  key: '2', name: 'Circuito completo (livre)', camera: this.orbitCamera,  orbit: true },
      { id: 'obstaculos', key: '3', name: 'Obstáculos (livre)',       camera: this.orbitCamera,  orbit: true },
      { id: 'chase',     key: '4', name: 'Perseguição (3ª pessoa)',  camera: this.chaseCamera,  orbit: false },
      { id: 'driver',    key: '5', name: 'Piloto (1ª pessoa)',       camera: this.driverCamera, orbit: false },
    ];

    // câmera ortográfica, só para comparar com a perspectiva (tecla P)
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
    this.orthoMode = false;

    this._tmpPos = new THREE.Vector3();
    this._tmpLook = new THREE.Vector3();

    this.activeIndex = 0;
    this._createHud();
    this._bindKeys();
    this.setView('largada');
  }

  // aqui a matriz de projeção perspectiva é criada (ver comentário no topo)
  _makeCamera(fov) {
    return new THREE.PerspectiveCamera(fov, this.aspect, NEAR, FAR);
  }

  // câmera que o renderer deve usar neste frame
  get camera() {
    return this.orthoMode ? this.orthoCamera : this.view.camera;
  }

  get view() {
    return this.views[this.activeIndex];
  }

  setFollowTarget(racer) {
    this.followTarget = racer;
    this._chaseReady = false;
  }

  // troca de vista
  setView(id) {
    const index = this.views.findIndex((v) => v.id === id);
    if (index < 0) return;
    this.activeIndex = index;
    if (id === 'driver') this.orthoMode = false;
    const { orbit } = this.views[index];
    this.controls.enabled = orbit;

    if (id === 'largada') this._presetStart();
    if (id === 'circuito') this._presetOverview();
    if (id === 'obstaculos') this._presetObstacles();
    if (id === 'chase') this._chaseReady = false; // posiciona direto, sem "voar" até lá

    this._refreshHud();
  }

  nextView() {
    this.setView(this.views[(this.activeIndex + 1) % this.views.length].id);
  }

  // posições da câmera livre (as mesmas teclas 1, 2 e 3 da entrega anterior)
  _presetStart() {
    const { point, tangent, normal } = this.grid;
    this.orbitCamera.position.copy(point)
      .addScaledVector(tangent, -14)
      .addScaledVector(normal, 7);
    this.orbitCamera.position.y = 10;
    this.controls.target.copy(point).addScaledVector(tangent, -3);
    this.controls.target.y = 0.8;
    this.controls.update();
  }

  _presetOverview() {
    this.orbitCamera.position.set(10, 245, -10);
    this.controls.target.set(10, 0, -30);
    this.controls.update();
  }

  _presetObstacles() {
    const point = this.path.getPointAt(0.09);
    const tangent = this.path.getTangentAt(0.09).normalize();
    this.orbitCamera.position.copy(point).addScaledVector(tangent, -32);
    this.orbitCamera.position.y = 36;
    this.controls.target.copy(point);
    this.controls.update();
  }

  // atualização por frame
  update(delta) {
    const id = this.view.id;

    if (id === 'chase') this._updateChase(delta);
    else if (id === 'driver') this._updateDriver();
    else this.controls.update();

    if (this.orthoMode) this._syncOrtho();
  }

  // 3ª pessoa: a câmera vai atrás do kart com suavização (lerp) para não
  // "tremer" quando o kart faz curva
  _updateChase(delta) {
    const target = this.followTarget;
    if (!target) return;
    target.updateMatrixWorld(true);

    const wantedPos = target.localToWorld(this._tmpPos.copy(this._chaseOffset));
    const lookAt = target.localToWorld(this._tmpLook.copy(this._chaseLookAhead));

    if (!this._chaseReady) {
      this.chaseCamera.position.copy(wantedPos);
      this._chaseReady = true;
    } else {
      // 1 - e^(-k*dt) deixa a suavização independente do FPS
      const t = 1 - Math.exp(-6 * delta);
      this.chaseCamera.position.lerp(wantedPos, t);
    }
    this.chaseCamera.lookAt(lookAt);
  }

  // 1ª pessoa: câmera presa ao kart, na posição dos olhos do piloto
  _updateDriver() {
    const target = this.followTarget;
    if (!target) return;
    target.updateMatrixWorld(true);

    this.driverCamera.position.copy(
      target.localToWorld(this._tmpPos.copy(this._driverEye))
    );
    this.driverCamera.lookAt(
      target.localToWorld(this._tmpLook.copy(this._driverLookAt))
    );
  }

  // comparação perspectiva x ortográfica (tecla P)
  _syncOrtho() {
    const src = this.view.camera;

    // ponto de referência: o que a câmera está olhando
    const ref = this.view.orbit ? this.controls.target
      : (this.followTarget ? this.followTarget.position : this.grid.point);

    // usa a mesma altura que a perspectiva enxerga na distância do ponto de
    // referência, pra que ele apareça do mesmo tamanho nas duas projeções
    const d = src.position.distanceTo(ref);
    const h = d * Math.tan(THREE.MathUtils.degToRad(src.fov / 2));
    const w = h * this.aspect;
    Object.assign(this.orthoCamera, { left: -w, right: w, top: h, bottom: -h });
    this.orthoCamera.position.copy(src.position);
    this.orthoCamera.quaternion.copy(src.quaternion);
    this.orthoCamera.updateProjectionMatrix();
  }

  toggleOrtho() {
    // na vista do piloto o chão fica rente ao horizonte: não serve de comparação
    if (this.view.id === 'driver') return;
    this.orthoMode = !this.orthoMode;
    this._refreshHud();
  }

  // FOV maior = mais "grande angular", mais distorção nas bordas;
  // FOV menor = "zoom", perspectiva mais achatada
  changeFov(step) {
    const cam = this.view.camera;
    cam.fov = THREE.MathUtils.clamp(cam.fov + step, 20, 120);
    cam.updateProjectionMatrix(); // recalcula a matriz de projeção
    this._refreshHud();
  }

  resize(width, height) {
    this.aspect = width / height;
    [this.orbitCamera, this.chaseCamera, this.driverCamera].forEach((cam) => {
      cam.aspect = this.aspect;
      cam.updateProjectionMatrix();
    });
  }

  // teclado
  _bindKeys() {
    window.addEventListener('keydown', (event) => {
      const view = this.views.find((v) => v.key === event.key);
      if (view) return this.setView(view.id);

      const k = event.key.toLowerCase();
      if (k === 'c') this.nextView();            // C alterna entre as vistas
      if (k === 'p') this.toggleOrtho();         // P compara com ortográfica
      if (k === 'h') this.hud.style.display = this.hud.style.display === 'none' ? 'block' : 'none';
      if (event.key === '+' || event.key === '=') this.changeFov(-5);
      if (event.key === '-' || event.key === '_') this.changeFov(5);
    });
  }

  // HUD (canto superior direito)
  _createHud() {
    this.hud = document.createElement('div');
    Object.assign(this.hud.style, {
      position: 'fixed', top: '8px', right: '8px',
      padding: '8px 12px', background: 'rgba(0,0,0,0.6)', color: '#fff',
      font: '12px/1.5 monospace', zIndex: '5', pointerEvents: 'none',
      whiteSpace: 'pre', borderRadius: '4px',
    });
    document.body.appendChild(this.hud);
  }

  _refreshHud() {
    const cam = this.view.camera;
    const projection = this.orthoMode
      ? 'ORTOGRÁFICA (comparação)'
      : `PERSPECTIVA  FOV ${cam.fov.toFixed(0)}°  near ${cam.near}  far ${cam.far}`;
    const lines = [
      `Câmera: ${this.view.name}`,
      `Projeção: ${projection}`,
      '',
      ...this.views.map((v, i) => `${i === this.activeIndex ? '>' : ' '} [${v.key}] ${v.name}`),
      '',
      '[C] próxima câmera   [P] perspectiva/ortográfica',
      '[+/-] FOV   [Espaço] pilotos andam   [H] esconde HUD',
      '[L] luz ambiente   [K] luz direcional',
      '[Enter] Alterna Pista',
    ];
    this.hud.textContent = lines.join('\n');
  }
}
