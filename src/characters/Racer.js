// Racer.js
// Junta kart + personagem. Como o personagem está em T-pose (pernas retas,
// não dá pra dobrar o joelho), afundei o quadril até o assento e usei um
// clipping plane horizontal pra esconder tudo que fica abaixo do banco.

import * as THREE from 'three';
import { Kart } from './Kart.js';

// altura do quadril como fração da altura total 
const HIP_FRACTION = 0.45;

export class Racer extends THREE.Group {
  /**
   * @param {Object} options
   * @param {Kart} options.kart
   * @param {Character} options.character   
   * @param {number} [options.seatOffset]   
   */
  constructor({ kart, character, seatOffset = 0 }) {
    super();

    this.kart = kart;
    this.character = character;
    this.seatOffset = seatOffset;
    this.name = `Racer(${character.name})`;

    this.add(this.kart);
    this.add(this.character);

    // começa em y=0; _updateClipPlane() ajusta pra altura do assento
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._applyClippingToCharacter();

    this._placeCharacterOnSeat();
    this._updateClipPlane();
  }

  _placeCharacterOnSeat() {
    const hipHeight = this.character.targetHeight * HIP_FRACTION;

    this.character.position.copy(this.kart.seatAnchor);
    this.character.position.y -= hipHeight;
    this.character.position.y -= this.seatOffset;

    // kart e character ambos olham pra +Z, então não precisa rotacionar.
    // se algum gltf futuro vier virado:
    //   this.character.rotation.y = Math.PI;
  }

  // mesmo plano em todos os materiais. clipShadows pra sombra sumir junto.
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

  // precisa rodar depois que a world matrix do Racer tá atualizada
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