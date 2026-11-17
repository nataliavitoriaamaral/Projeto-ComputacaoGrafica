// Junta kart + personagem. Como o personagem está em T-pose (pernas retas,
// sem como dobrar o joelho), o quadril é afundado até o assento e um
// clipping plane horizontal esconde tudo que fica abaixo do banco.
// Os braços são dobrados girando os ossos até as mãos chegarem no volante.

import * as THREE from 'three';
import { Kart } from './Kart.js';

// altura do quadril em relação à altura total, quando o personagem não define
const HIP_FRACTION = 0.45;

// distância do centro do volante até onde cada pulso fica 
const GRIP_X = 0.12;

// giro máximo da cabeça para cada lado
const ANGULO_PESCOCO = THREE.MathUtils.degToRad(45);
// quanto a cabeça vira para cada radiano por segundo que o kart gira na curva
const CURVA_PESCOCO = 0.6;
// adversário mais perto que isso faz o piloto olhar para ele
const DISTANCIA_ADVERSARIO = 5;
// quão rápido a cabeça chega no ângulo desejado
const SUAVIDADE_PESCOCO = 4;

// gira o osso para que a próxima junta aponte para o ponto, em coordenadas de mundo
function aimBone(bone, child, point) {
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const from = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to = point.clone().sub(origin).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(from, to);

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
    this._prepararPescoco();
    this._updateClipPlane();
  }

  // Guarda a rotação inicial do osso do pescoço e o eixo vertical do
  // personagem. Assim o giro é sempre em
  // torno do eixo vertical, mesmo com cada esqueleto tendo eixos diferentes
  _prepararPescoco() {
    this.ossoPescoco = this.character.pescoco
      ? this.character.getObjectByName(this.character.pescoco)
      : null;
    if (!this.ossoPescoco) return;

    this.updateMatrixWorld(true);
    this.rotacaoInicialPescoco = this.ossoPescoco.quaternion.clone();
    const paiInverso = this.ossoPescoco.parent
      .getWorldQuaternion(new THREE.Quaternion()).invert();
    this.eixoPescoco = new THREE.Vector3(0, 1, 0).applyQuaternion(paiInverso);
    this.anguloPescoco = 0;
    // direção do kart no frame anterior, para medir o quanto ele está virando
    this.direcaoAnterior = this.rotation.y;
  }

  // ângulo para saber para onde o personagem deve olhar:para o adversário mais perto ou para dentro da curva
  _alvoPescoco(delta, adversarios) {
    let maisPerto = null;
    let menorDistancia = DISTANCIA_ADVERSARIO;
    for (const outro of adversarios) {
      // adversário parado não funciona essa lógica
      if (outro === this || outro.speed === 0) continue;
      const distancia = outro.position.distanceTo(this.position);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        maisPerto = outro;
      }
    }
    if (maisPerto) {
      // posição do adversário no espaço do Racer
      const local = this.worldToLocal(maisPerto.position.clone());
      return Math.atan2(local.x, local.z);
    }

    // quanto o kart girou desde o frame anterior 
    let giro = this.rotation.y - this.direcaoAnterior;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro));
    return delta > 0 ? (giro / delta) * CURVA_PESCOCO : 0;
  }

  _placeCharacterOnSeat() {
    const hipFraction = this.character.hipFraction ?? HIP_FRACTION;
    const hipHeight = this.character.targetHeight * hipFraction;


    this.kart.updateMatrix();
    const seat = this.kart.seatAnchor.clone().applyMatrix4(this.kart.matrix);

    this.character.position.copy(seat);
    this.character.position.y -= hipHeight;
    this.character.position.y -= this.seatOffset;
  }

  // Dado o ombro e o ponto do volante, a lei dos cossenos
  // dá onde o cotovelo deve ficar
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

    this._clipPlane.normal.set(0, 1, 0);
    this._clipPlane.constant = -seatWorld.y;
  }

  // lista de todos os Racers para o piloto olhar quem passar perto
  update(delta, adversarios = []) {
    this.kart.update(delta);

    // a cabeça vai aos poucos até o alvo, sem passar do giro máximo
    if (this.ossoPescoco) {
      const alvo = THREE.MathUtils.clamp(
        this._alvoPescoco(delta, adversarios), -ANGULO_PESCOCO, ANGULO_PESCOCO);
      this.anguloPescoco += (alvo - this.anguloPescoco) * Math.min(1, delta * SUAVIDADE_PESCOCO);
      this.direcaoAnterior = this.rotation.y;
      this.ossoPescoco.quaternion
        .setFromAxisAngle(this.eixoPescoco, this.anguloPescoco)
        .multiply(this.rotacaoInicialPescoco);
    }

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