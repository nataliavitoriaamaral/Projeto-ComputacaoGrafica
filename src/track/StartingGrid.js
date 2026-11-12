// StartingGrid.js
// Grid de largada em zigue-zague, como no Mario Kart: as vagas alternam
// entre a esquerda e a direita da pista, cada uma atrás da anterior.
// Cada vaga tem uma marca branca no asfalto à frente do kart.

import * as THREE from 'three';

export class StartingGrid extends THREE.Group {
  constructor(track, {
    slots = 4,          // número de vagas
    sideOffset = 2.5,   // distância lateral a partir do centro da pista
    firstGap = 3.5,     // distância entre a faixa e o primeiro kart
    rowGap = 2.5,       // distância entre karts consecutivos
  } = {}) {
    super();
    this.name = 'StartingGrid';
    this.track = track;
    this.sideOffset = sideOffset;
    this.firstGap = firstGap;
    this.rowGap = rowGap;

    // ponto e direção da curva na faixa de largada (u = 0)
    this.point = track.path.getPointAt(0);
    this.tangent = track.path.getTangentAt(0).normalize();
    // vetor lateral, o mesmo usado nas zebras e nos muros
    this.normal = new THREE.Vector3(-this.tangent.z, 0, this.tangent.x);

    for (let i = 0; i < slots; i++) this._buildSlotMark(i);
  }

  // vagas pares à esquerda e ímpares à direita
  getSlot(index) {
    const side = index % 2 === 0 ? -1 : 1;
    return {
      sideOffset: side * this.sideOffset,
      distanceBehind: this.firstGap + index * this.rowGap,
    };
  }

  // Posição e orientação a uma distância da faixa medida ao longo da curva.
  // Usar a curva, e não a tangente da largada, evita que as últimas vagas
  // saiam da pista, já que ela começa a curvar logo atrás da largada.
  _frameAt(distanceBehind, sideOffset) {
    const path = this.track.path;
    const u = (1 - distanceBehind / path.getLength()) % 1;
    const tangent = path.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const position = path.getPointAt(u).addScaledVector(normal, sideOffset);
    // rotação em Y para um objeto voltado para +Z seguir a pista
    const angle = Math.atan2(tangent.x, tangent.z);
    return { u, position, angle };
  }

  // posiciona o piloto na vaga indicada
  placeRacer(racer, index) {
    const { sideOffset, distanceBehind } = this.getSlot(index);
    const { u, position, angle } = this._frameAt(distanceBehind, sideOffset);

    racer.position.copy(position);
    racer.position.y = 0.01; // altura do asfalto
    racer.rotation.y = angle;

    // usados pelo modo demo
    racer.userData.u = u;
    racer.userData.side = sideOffset;
  }

  // marca da vaga: uma barra transversal e duas laterais curtas
  _buildSlotMark(index) {
    const { sideOffset, distanceBehind } = this.getSlot(index);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

    const mark = new THREE.Group();
    const width = 1.6;   // pouco mais largo que o kart
    const thick = 0.12;
    const leg = 0.5;

    const front = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, thick), mat);
    mark.add(front);

    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(thick, 0.02, leg), mat);
      // laterais voltadas para trás (-Z)
      side.position.set(s * (width - thick) / 2, 0, -leg / 2);
      mark.add(side);
    }

    // à frente do bico do kart
    const { position, angle } = this._frameAt(distanceBehind - 1.3, sideOffset);
    mark.position.copy(position);
    mark.position.y = 0.025; // acima do asfalto para evitar z-fighting
    mark.rotation.y = angle;
    mark.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

    this.add(mark);
  }
}
