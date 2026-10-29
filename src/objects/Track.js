// Track.js
// Monta o cenário: chão (grama + asfalto), muretas listradas e os objetos
// posicionados a partir da lista LAYOUT. Unidades em "metros" do kart.
//
// kind: 'solid' = obstáculo que bate | 'oil' = mancha (reduz velocidade) | 'item' = coletável

import * as THREE from 'three';
import { createCone } from './Cone.js';
import { createBarrel } from './Barrel.js';
import { createTireStack } from './TireStack.js';
import { createItemBox } from './ItemBox.js';
import { createOilSlick } from './OilSlick.js';

const FACTORIES = {
  cone:     { make: createCone,      kind: 'solid' },
  barrel:   { make: createBarrel,    kind: 'solid' },
  tires:    { make: createTireStack, kind: 'solid' },
  itemBox:  { make: createItemBox,   kind: 'item'  },
  oil:      { make: createOilSlick,  kind: 'oil'   },
};

// x, z = posição no chão | ry = giro em Y (rad) | s = escala
const LAYOUT = [
  // fileira de cones na esquerda
  { type: 'cone', x: -4, z: 4 },
  { type: 'cone', x: -4, z: 6 },
  { type: 'cone', x: -4, z: 8 },
  // barris na direita
  { type: 'barrel', x: 3.5, z: 6, ry: 0 },
  { type: 'barrel', x: 4.2, z: 6.6, ry: 0.5 },
  // pilhas de pneus encostadas na mureta direita
  { type: 'tires', x: 6.2, z: 3 },
  { type: 'tires', x: 6.2, z: 5, s: 1.1 },
  { type: 'tires', x: 6.2, z: 7 },
  // pneus no meio da pista
  { type: 'tires', x: 0, z: 10, s: 1.2 },
  // manchas de óleo
  { type: 'oil', x: -1,  z: 7,  ry: 0.3, s: 1.2 },
  { type: 'oil', x: 2.5, z: 11, ry: 1.2 },
  // caixas de item (linha logo à frente dos karts)
  { type: 'itemBox', x: -2, z: 3 },
  { type: 'itemBox', x: 0,  z: 3 },
  { type: 'itemBox', x: 2,  z: 3 },
];

export class Track extends THREE.Group {
  constructor() {
    super();
    this.name = 'Track';
    this.items = [];      // { object, kind }
    this.itemBoxes = [];  // pra animar no update()

    this._buildGround();
    this._buildWalls();
    this._placeObjects();
  }

  // grama (PlaneGeometry grande) + faixa de asfalto por cima
  _buildGround() {
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a7d2c, roughness: 1 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(14, 28), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, 6);
    grass.receiveShadow = true;
    this.add(grass);

    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3b3b40, roughness: 0.9 });
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(10, 28), asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.01, 6);   // 0.01 evita z-fighting com a grama
    asphalt.receiveShadow = true;
    this.add(asphalt);
  }

  // mureta feita de blocos alternando vermelho/branco
  _wall(length, x, z, ry) {
    const g = new THREE.Group();
    const segLen = 2;
    const n = Math.round(length / segLen);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 ? 0xffffff : 0xc8102e, roughness: 0.6,
      });
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.5, 0.3), mat);
      seg.position.set(-length / 2 + segLen * (i + 0.5), 0.25, 0);
      seg.castShadow = seg.receiveShadow = true;
      g.add(seg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.add(g);
    this.items.push({ object: g, kind: 'solid' });
  }

  _buildWalls() {
    this._wall(28, -7, 6, Math.PI / 2);   // esquerda
    this._wall(28,  7, 6, Math.PI / 2);   // direita
    this._wall(14,  0, 20, 0);            // fundo (frente dos karts)
    this._wall(14,  0, -8, 0);            // trás
  }

  _placeObjects() {
    for (const o of LAYOUT) {
      const f = FACTORIES[o.type];
      const obj = f.make();
      const y = o.type === 'itemBox' ? 1.0 : 0;   // caixa flutua
      obj.position.set(o.x, y, o.z);
      obj.rotation.y = o.ry ?? 0;
      obj.scale.setScalar(o.s ?? 1);
      this.add(obj);

      this.items.push({ object: obj, kind: f.kind });
      if (o.type === 'itemBox') this.itemBoxes.push(obj);
    }
  }

  // caixas de item giram e flutuam
  update(delta) {
    const t = performance.now() / 1000;
    this.itemBoxes.forEach((b, i) => {
      b.rotation.y += delta * 1.5;
      b.position.y = 1.0 + Math.sin(t * 2 + i) * 0.1;
    });
  }

  // bounding boxes pra colisão: kind = 'solid' | 'oil' | 'item'
  getBoxes(kind) {
    return this.items
      .filter((i) => i.kind === kind)
      .map((i) => new THREE.Box3().setFromObject(i.object));
  }
}