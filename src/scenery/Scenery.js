// Scenery.js
// Paisagem em volta da pista. Cada tema é uma lista de "camadas":
// qual peça usar, quantas cópias, como espalhar e o tamanho aproximado
// (raio no chão), usado para não colocar nada em cima da pista nem
// uma peça dentro da outra.
//
// Formas de espalhar:
//   'ring'    -> num círculo grande em volta do circuito (fundo do cenário)
//   'scatter' -> sorteadas pelo terreno
//   'border'  -> ao longo da pista, do lado de fora dos muros

import * as THREE from 'three';
import {
  createTree, createMountain,
  createCactus, createRock, createMesa,
  createBuilding, createStreetLamp,
} from './sceneryProps.js';

const THEMES = {
  campo: [
    { create: createMountain, count: 12, place: 'ring',    size: 30 },
    { create: createTree,     count: 90, place: 'scatter', size: 1.5 },
  ],
  deserto: [
    { create: createMesa,   count: 10, place: 'ring',    size: 24 },
    { create: createCactus, count: 45, place: 'scatter', size: 1.5 },
    { create: createRock,   count: 40, place: 'scatter', size: 1.5 },
  ],
  cidade: [
    { create: createBuilding,   count: 26, place: 'ring',    size: 9 },
    { create: createBuilding,   count: 20, place: 'scatter', size: 9 },
    { create: createStreetLamp, count: 40, place: 'border',  size: 0.5 },
  ],
};

const RING_RADIUS = 175;  // o chão vai de -200 a 200
const AREA = 185;         // metade do lado da área onde as peças são sorteadas
const TRACK_MARGIN = 4;   // folga além da borda da pista (os muros ficam a ~2)

export class Scenery extends THREE.Group {
  constructor(track, themeName) {
    super();
    this.name = 'Scenery';
    this.track = track;
    this.halfWidth = track.trackWidth / 2;

    // pontos da curva, usados para medir a distância até a pista
    this.trackPoints = track.path.getSpacedPoints(300);
    // posição e tamanho de tudo que já foi colocado
    this.placed = [];

    const layers = THEMES[themeName] || [];
    layers.forEach((layer) => {
      if (layer.place === 'ring') this._placeRing(layer);
      if (layer.place === 'scatter') this._placeScatter(layer);
      if (layer.place === 'border') this._placeBorder(layer);
    });
  }

  // distância (no plano XZ) do ponto até o meio da pista
  _distanceToTrack(x, z) {
    let min = Infinity;
    this.trackPoints.forEach((p) => {
      min = Math.min(min, Math.hypot(p.x - x, p.z - z));
    });
    return min;
  }

  // o lugar está livre se não encosta na pista nem em outra peça
  _isFree(x, z, size) {
    if (this._distanceToTrack(x, z) < this.halfWidth + TRACK_MARGIN + size) return false;
    return this.placed.every((o) => Math.hypot(o.x - x, o.z - z) > o.size + size);
  }

  // cria a peça, coloca no lugar com escala e giro aleatórios e guarda a posição
  _add(layer, x, z, angle = Math.random() * Math.PI * 2) {
    const obj = layer.create();
    obj.position.set(x, 0, z);
    obj.rotation.y = angle;
    if (layer.place !== 'border') obj.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.3));
    this.add(obj);
    this.placed.push({ x, z, size: layer.size });
  }

  _placeRing(layer) {
    for (let i = 0; i < layer.count; i++) {
      // ângulos iguais entre as peças, com um pouco de variação
      const angle = (i / layer.count) * Math.PI * 2 + THREE.MathUtils.randFloat(-0.1, 0.1);
      const r = RING_RADIUS + THREE.MathUtils.randFloat(-10, 10);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (this._isFree(x, z, layer.size)) this._add(layer, x, z);
    }
  }

  _placeScatter(layer) {
    // sorteia até achar lugares livres; o limite evita loop infinito
    let tries = 0;
    let added = 0;
    while (added < layer.count && tries < layer.count * 30) {
      tries++;
      const x = THREE.MathUtils.randFloat(-AREA, AREA);
      const z = THREE.MathUtils.randFloat(-AREA, AREA);
      if (this._isFree(x, z, layer.size)) {
        this._add(layer, x, z);
        added++;
      }
    }
  }

  _placeBorder(layer) {
    const path = this.track.path;
    const offset = this.halfWidth + 3.5; // logo depois do muro

    // começa em i = 1 para não bater no pórtico da largada (u = 0)
    for (let i = 1; i < layer.count; i++) {
      const u = i / layer.count;
      const side = i % 2 === 0 ? 1 : -1; // alterna os lados
      const tangent = path.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const pos = path.getPointAt(u).addScaledVector(normal, side * offset);
      // em curva fechada, o lado de dentro pode cair perto de outro trecho
      if (this._distanceToTrack(pos.x, pos.z) < offset - 0.5) continue;
      this._add(layer, pos.x, pos.z, Math.atan2(tangent.x, tangent.z));
    }
  }
}
