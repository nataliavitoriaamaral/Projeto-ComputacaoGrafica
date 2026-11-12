// Racer.js
// Junta kart + personagem. Como o personagem está em T-pose (pernas retas,
// sem como dobrar o joelho), o quadril é afundado até o assento e um
// clipping plane horizontal esconde tudo que fica abaixo do banco.
// Os braços são dobrados girando os ossos até as mãos chegarem no volante.

import * as THREE from 'three';
import { Kart } from './Kart.js';

// altura do quadril em relação à altura total, quando o personagem não define
const HIP_FRACTION = 0.45;

// distância do centro do volante até onde cada pulso fica (o aro tem raio 0.13)
const GRIP_X = 0.12;

// gira o osso para que o filho (próxima junta) aponte para o ponto, em coordenadas de mundo
function aimBone(bone, child, point) {
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const from = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to = point.clone().sub(origin).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(from, to);

  // rotação nova no mundo = turn * rotação atual; depois volta para o espaço do pai
  const world = turn.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parentInv = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parentInv.multiply(world));
  bone.updateMatrixWorld(true);
}

export class Racer extends THREE.Group {
  constructor({ kart, character, seatOffset = 0 }) {
    super();

    this.kart = kart;
    this.character = character;
    this.seatOffset = seatOffset;
    this.name = `Racer(${character.name})`;

    this.add(this.kart);
    this.add(this.character);

    // começa em y=0; _updateClipPlane() ajusta para a altura do assento
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._applyClippingToCharacter();

    this._placeCharacterOnSeat();
    this._holdSteeringWheel();
    this._updateClipPlane();
  }

  _placeCharacterOnSeat() {
    const hipFraction = this.character.hipFraction ?? HIP_FRACTION;
    const hipHeight = this.character.targetHeight * hipFraction;

    // seatAnchor está no espaço do kart; a matriz do kart inclui a escala
    this.kart.updateMatrix();
    const seat = this.kart.seatAnchor.clone().applyMatrix4(this.kart.matrix);

    this.character.position.copy(seat);
    this.character.position.y -= hipHeight;
    this.character.position.y -= this.seatOffset;

    // kart e personagem olham para +Z, então não é preciso rotacionar.
    // se algum gltf futuro vier virado:
    //   this.character.rotation.y = Math.PI;
  }

  // IK de dois ossos: dado o ombro e o ponto do volante, a lei dos cossenos
  // dá onde o cotovelo deve ficar. Depois cada osso é girado para apontar
  // para o ponto seguinte (braço -> cotovelo, antebraço -> pulso).
  // Roda uma vez só, com o Racer ainda na origem (mundo = local do Racer).
  _holdSteeringWheel() {
    this.updateMatrixWorld(true);
    const ring = this.kart.steeringWheel;

    for (const names of this.character.arms) {
      const [upper, lower, hand] = names.map((n) => this.character.getObjectByName(n));
      if (!upper || !lower || !hand) {
        console.warn(`${this.character.name}: osso do braço não encontrado`, names);
        continue;
      }

      const shoulder = upper.getWorldPosition(new THREE.Vector3());
      const a = shoulder.distanceTo(lower.getWorldPosition(new THREE.Vector3())); // braço
      const b = lower.getWorldPosition(new THREE.Vector3())
        .distanceTo(hand.getWorldPosition(new THREE.Vector3()));               // antebraço

      // lado do volante que essa mão segura (o x do ombro diz se é esquerda ou direita)
      const side = Math.sign(shoulder.x);
      const target = ring.localToWorld(new THREE.Vector3(side * GRIP_X, 0, 0));

      const toTarget = target.clone().sub(shoulder);
      // se o volante estiver longe demais, o braço fica esticado apontando para ele
      const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
      const dir = toTarget.normalize();

      // o cotovelo dobra para baixo e um pouco para fora
      const bend = new THREE.Vector3(side * 0.5, -1, 0);
      bend.addScaledVector(dir, -bend.dot(dir)).normalize();

      const cosA = (a * a + d * d - b * b) / (2 * a * d);
      const sinA = Math.sqrt(1 - cosA * cosA);
      const elbow = shoulder.clone()
        .addScaledVector(dir, a * cosA)
        .addScaledVector(bend, a * sinA);
      const wrist = shoulder.clone().addScaledVector(dir, d);

      aimBone(upper, lower, elbow);
      aimBone(lower, hand, wrist);
    }
  }

  // mesmo plano em todos os materiais; clipShadows corta a sombra também.
  _applyClippingToCharacter() {
    this.character.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        m.clippingPlanes = [this._clipPlane];
        m.clipShadows = true;
        m.needsUpdate = true;
      });
    });
  }

  // deve rodar depois que a world matrix do Racer estiver atualizada
  _updateClipPlane() {
    this.updateMatrixWorld(true);
    const seatWorld = this.kart.localToWorld(this.kart.seatAnchor.clone());

    // plano horizontal em y = seatWorld.y; constante = -y (ny*y + d = 0)
    this._clipPlane.normal.set(0, 1, 0);
    this._clipPlane.constant = -seatWorld.y;
  }

  update(delta) {
    this.kart.update(delta);
    // se o racer subir/descer o plano em world tem que acompanhar
    this._updateClipPlane();
  }

  set speed(v) { this.kart.speed = v; }
  get speed()  { return this.kart.speed; }

  set idleWheelSpeed(v) { this.kart.idleWheelSpeed = v; }
  get idleWheelSpeed()  { return this.kart.idleWheelSpeed; }

  get steeringWheel() { return this.kart.steeringWheel; }
}

export async function createRacer({
  kartPreset,
  characterFactory,
  seatOffset = 0,
}) {
  const kart = new Kart(kartPreset);
  const character = await characterFactory();
  return new Racer({ kart, character, seatOffset });
}