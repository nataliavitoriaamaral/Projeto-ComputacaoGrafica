// Faíscas das batidas e um tremor curto na câmera do jogador.
// Usa as mesmas partículas que já aparecem no drift.

import * as THREE from 'three';
import { ParticulasKart } from './ParticulasKart.js';

export class CollisionEffects {
  constructor(scene) {
    this.scene = scene;
    this.particles = new ParticulasKart(400);
    scene.add(this.particles);
    this.time = 0;
    this.shakeLeft = 0;
    this.shakeStrength = 0;
    this.camera = null;
    this.offset = new THREE.Vector3();
  }

  hit(position, strength, isPlayer) {
    const origin = position.clone();
    origin.y += 0.35;
    for (let i = 0; i < 18; i++) {
      const velocity = new THREE.Vector3(
        Math.random() - 0.5, Math.random() * 0.7 + 0.3, Math.random() - 0.5
      ).normalize().multiplyScalar(2 + strength * 4);
      this.particles.emitir(origin, velocity, [1, 0.75, 0.3], 0.2 + Math.random() * 0.25);
    }
    if (isPlayer) {
      this.shakeLeft = 0.25;
      this.shakeStrength = Math.max(this.shakeStrength, 0.04 + strength * 0.12);
    }
  }

  // desfaz o deslocamento antes que o OrbitControls leia a posição da câmera
  restoreCamera() {
    if (this.camera) this.camera.position.sub(this.offset);
    this.camera = null;
    this.offset.set(0, 0, 0);
  }

  update(dt) {
    this.restoreCamera();
    this.time += dt;
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.shakeLeft === 0) this.shakeStrength = 0;
    this.particles.atualizar(dt);
  }

  // chamar depois de cameraManager.update(), antes de renderizar
  updateCamera(camera) {
    this.restoreCamera();
    if (this.shakeLeft === 0) return;
    const amount = this.shakeStrength * this.shakeLeft / 0.25;
    this.offset.set(Math.sin(this.time * 83), Math.cos(this.time * 97), 0)
      .multiplyScalar(amount).applyQuaternion(camera.quaternion);
    camera.position.add(this.offset);
    this.camera = camera;
  }

  reset() {
    this.restoreCamera();
    this.shakeLeft = this.shakeStrength = 0;
    this.particles.limpar();
  }

  dispose() {
    this.reset();
    this.scene.remove(this.particles);
    this.particles.descartar();
  }
}
