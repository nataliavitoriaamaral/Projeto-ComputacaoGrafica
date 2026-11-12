// Kart.js
// Monta um kart estilo Mario Kart com primitivas do Three.js.
// Rodas giram em update() usando omega = v/r.
// As diferenças entre personagens ficam em kartPresets.js.

import * as THREE from 'three';
import { KART_PRESETS } from './kartPresets.js';
import { makeEmblemTexture } from './kartEmblems.js';
import { addDecorations } from './kartDecorations.js';
import { texLataria, texBanco, texPneuBanda, texPneuLateral } from './kartTextures.js';

export class Kart extends THREE.Group {
  constructor(preset = 'mario') {
    super();

    this.name   = `Kart_${preset}`;
    this.config = KART_PRESETS[preset] ?? KART_PRESETS.mario;

    // a origem fica no chão, então a escala não tira as rodas do asfalto
    this.scale.setScalar(this.config.scale ?? 1);

    this.speed = 0;
    // giro em ponto morto: as rodas giram sem o kart sair do lugar,
    // dando a ideia de que o piloto está acelerando esperando a largada
    this.idleWheelSpeed = 0;

    this.wheelRadius = 0.32;
    this.wheelWidth  = 0.28;

    // capô: guardado para reutilizar no posicionamento do logo
    this.hoodTilt   = -0.60;
    this.hoodCenter = new THREE.Vector3(0, this.wheelRadius + 0.42, 0.68);
    this.hoodDepth  = 0.14;

    this.wheels = [];
    this.steeringWheel = null;
    this.seatAnchor    = new THREE.Vector3();

    this._build();
  }

  _build() {
    this._buildLowerHull();
    this._buildSideSkirt();
    this._buildMainBody();
    this._buildFrontHood();
    this._buildLogoBadge();
    this._buildSeat();
    this._buildCockpit();
    this._buildSteering();
    this._buildExhausts();
    this._buildWheels();
    addDecorations(this, this.config.decorations);
  }

  // cria a carroceria inferior, que cobre o chassi e as suspensões
  _buildLowerHull() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.config.lowerColor,
      map: texLataria,
      roughness: 0.55,
      metalness: 0.05,
    });

    const bodyGeo = new THREE.BoxGeometry(1.05, 0.28, 1.70);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = this.wheelRadius + 0.05;
    body.castShadow = true;
    body.receiveShadow = true;
    this.add(body);

    // bico curto: termina logo depois das rodas da frente (z = 0.60 + raio)
    const noseGeo = new THREE.BoxGeometry(0.88, 0.22, 0.18);
    const nose = new THREE.Mesh(noseGeo, mat);
    nose.position.set(0, this.wheelRadius + 0.03, 0.86);
    nose.castShadow = true;
    this.add(nose);

    const tailGeo = new THREE.BoxGeometry(0.95, 0.24, 0.32);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(0, this.wheelRadius + 0.03, -0.9);
    tail.castShadow = true;
    this.add(tail);
  }

  // faixa branca nas laterais e embaixo
  _buildSideSkirt() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.config.accentColor,
      roughness: 0.6,
      metalness: 0.0,
    });

    const sideGeo = new THREE.BoxGeometry(0.08, 0.16, 1.60);

    const left  = new THREE.Mesh(sideGeo, mat);
    left.position.set(-0.55, this.wheelRadius + 0.08, 0);
    left.castShadow = true;
    this.add(left);

    const right = new THREE.Mesh(sideGeo, mat);
    right.position.set( 0.55, this.wheelRadius + 0.08, 0);
    right.castShadow = true;
    this.add(right);

    const underGeo = new THREE.BoxGeometry(0.9, 0.08, 1.55);
    const under = new THREE.Mesh(underGeo, mat);
    under.position.set(0, this.wheelRadius - 0.11, 0);
    under.castShadow = true;
    this.add(under);
  }

  // flancos altos atrás do piloto + painel traseiro
  _buildMainBody() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      map: texLataria,
      roughness: 0.4,
      metalness: 0.05,
    });

    const sideGeo = new THREE.BoxGeometry(0.14, 0.38, 0.85);

    const sideL = new THREE.Mesh(sideGeo, mat);
    sideL.position.set(-0.5, this.wheelRadius + 0.33, -0.25);
    sideL.castShadow = true;
    this.add(sideL);

    const sideR = new THREE.Mesh(sideGeo, mat);
    sideR.position.set( 0.5, this.wheelRadius + 0.33, -0.25);
    sideR.castShadow = true;
    this.add(sideR);

    const backGeo = new THREE.BoxGeometry(0.95, 0.38, 0.14);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, this.wheelRadius + 0.33, -0.6);
    back.castShadow = true;
    this.add(back);
  }

  // rampa inclinada na frente, com o topo voltado para trás
  _buildFrontHood() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      map: texLataria,
      roughness: 0.4,
      metalness: 0.05,
    });

    const geo = new THREE.BoxGeometry(0.90, 0.58, this.hoodDepth);
    const hood = new THREE.Mesh(geo, mat);
    hood.position.copy(this.hoodCenter);
    hood.rotation.x = this.hoodTilt;
    hood.castShadow = true;
    this.add(hood);
  }

  // disco com a letra, grudado na face inclinada do capô
  _buildLogoBadge() {
    const tex = makeEmblemTexture(this.config.emblem);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.5,
      metalness: 0.0,
    });

    const geo = new THREE.CircleGeometry(0.21, 48);
    const badge = new THREE.Mesh(geo, mat);

    const sin = Math.sin(this.hoodTilt);
    const cos = Math.cos(this.hoodTilt);
    const normal = new THREE.Vector3(0, -sin, cos);

    badge.position
      .copy(this.hoodCenter)
      .addScaledVector(normal, this.hoodDepth / 2 + 0.01);
    badge.rotation.x = this.hoodTilt;
    this.add(badge);
  }

  _buildSeat() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // branco: o couro aparece com a cor da própria imagem
      map: texBanco,
      roughness: 0.75,
      metalness: 0.0,
    });

    const seatGeo = new THREE.BoxGeometry(0.55, 0.08, 0.5);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.set(0, this.wheelRadius + 0.28, -0.15);
    seat.castShadow = true;
    this.add(seat);

    // seatBackHeight = 0 remove o encosto (no Bowser, o casco faz esse papel)
    const backHeight = this.config.seatBackHeight ?? 0.58;
    if (backHeight > 0) {
      const backGeo = new THREE.BoxGeometry(0.55, backHeight, 0.10);
      const back = new THREE.Mesh(backGeo, mat);
      back.position.set(0, this.wheelRadius + 0.27 + backHeight / 2, -0.42);
      back.castShadow = true;
      this.add(back);
    }

    // ponto sobre o assento, usado pelo Racer para posicionar o personagem
    this.seatAnchor.set(0, this.wheelRadius + 0.32, -0.15);
  }

  // Fecha o cockpit, como num kart de corrida: paredes laterais entre os
  // flancos e o capô, e o capô estendido para trás até a frente do piloto.
  // Essa parte do capô cobre as pernas (que foram cortadas pelo clipping plane).
  _buildCockpit() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor, map: texLataria,
      roughness: 0.4, metalness: 0.05,
    });

    // paredes laterais, continuando os flancos até o capô
    const wallGeo = new THREE.BoxGeometry(0.14, 0.38, 0.45);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeo, bodyMat);
      wall.position.set(side * 0.5, this.wheelRadius + 0.33, 0.39);
      wall.castShadow = true;
      this.add(wall);
    }

    // capô sobre as pernas: da frente do banco até o capô inclinado
    const back = 0.0;
    const front = 0.62;
    const legCoverGeo = new THREE.BoxGeometry(0.86, 0.04, front - back);
    const legCover = new THREE.Mesh(legCoverGeo, bodyMat);
    legCover.position.set(0, this.wheelRadius + 0.44, (back + front) / 2);
    legCover.castShadow = true;
    legCover.receiveShadow = true;
    this.add(legCover);
  }

  _buildSteering() {
    const columnMat = new THREE.MeshStandardMaterial({
      color: 0x202020, roughness: 0.45, metalness: 0.35,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x3a2410, roughness: 0.55, metalness: 0.10,
    });

    const group = new THREE.Group();
    group.name = 'steering';
    // steeringOffsetZ aproxima o volante do piloto (negativo = para trás)
    group.position.z = this.config.steeringOffsetZ ?? 0;

    const tilt = -0.5;

    // coluna e aro recuados, mais perto do banco, para que o volante fique
    // na frente do piloto e não dentro da carroceria dianteira
    const colGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12);
    const col = new THREE.Mesh(colGeo, columnMat);
    col.position.set(0, this.wheelRadius + 0.42, 0.17);
    col.rotation.x = tilt;
    group.add(col);

    const ringGeo = new THREE.TorusGeometry(0.13, 0.025, 10, 32);
    const ring = new THREE.Mesh(ringGeo, wheelMat);
    ring.position.set(0, this.wheelRadius + 0.60, 0.34);
    ring.rotation.x = Math.PI / 2 + tilt;
    group.add(ring);
    this.steeringWheel = ring;

    const spokeGeo = new THREE.BoxGeometry(0.22, 0.02, 0.03);
    const spoke = new THREE.Mesh(spokeGeo, wheelMat);
    spoke.position.copy(ring.position);
    spoke.rotation.copy(ring.rotation);
    group.add(spoke);

    this.add(group);
  }

  // canos inclinados a 45°
  // 'triple': 3 cilindros. 'twinCone': 2 canos cônicos.
  _buildExhausts() {
    const pipeMat = new THREE.MeshStandardMaterial({
      color: this.config.exhaustPipeColor, roughness: 0.25, metalness: 0.9,
    });
    const tipMat = new THREE.MeshStandardMaterial({
      color: this.config.exhaustTipColor, roughness: 0.35, metalness: 0.6,
    });

    const group = new THREE.Group();
    group.name = 'exhausts';

    const tilt = -Math.PI / 4;
    const cos45 = Math.cos(tilt);
    const sin45 = Math.sin(tilt);
    // eixo do cano depois da rotação
    const axis = new THREE.Vector3(0, cos45, sin45);

    if (this.config.exhaustStyle === 'twinCone') {
      const positions = [-0.28, 0.28];
      const L = 0.55;
      const tipLen = 0.09;

      for (const x of positions) {
        const base = new THREE.Vector3(x, this.wheelRadius + 0.30, -0.78);

        const center = base.clone().addScaledVector(axis, L / 2);

        // topo mais estreito que a base = formato cônico
        const pipeGeo = new THREE.CylinderGeometry(0.075, 0.12, L, 20);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.copy(center);
        pipe.rotation.x = tilt;
        pipe.castShadow = true;
        group.add(pipe);

        const tipCenter = base.clone().addScaledVector(axis, L + tipLen / 2);
        const tipGeo = new THREE.CylinderGeometry(0.082, 0.075, tipLen, 20);
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.copy(tipCenter);
        tip.rotation.x = tilt;
        tip.castShadow = true;
        group.add(tip);
      }
    } else {
      const n = 3;
      const spacing = 0.15;
      const totalWidth = (n - 1) * spacing;
      const L = 0.42;
      const tipLen = 0.06;

      for (let i = 0; i < n; i++) {
        const x = -totalWidth / 2 + i * spacing;
        const base = new THREE.Vector3(x, this.wheelRadius + 0.42, -0.72);

        const center = base.clone().addScaledVector(axis, L / 2);

        const pipeGeo = new THREE.CylinderGeometry(0.065, 0.065, L, 16);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.copy(center);
        pipe.rotation.x = tilt;
        pipe.castShadow = true;
        group.add(pipe);

        const tipCenter = base.clone().addScaledVector(axis, L + tipLen / 2);
        const tipGeo = new THREE.CylinderGeometry(0.085, 0.065, tipLen, 16);
        const tip = new THREE.Mesh(tipGeo, pipeMat);
        tip.position.copy(tipCenter);
        tip.rotation.x = tilt;
        group.add(tip);
      }
    }

    this.add(group);
  }

  // cada roda em um Group, para ter pivô próprio
  _buildWheels() {
    const positions = [
      { name: 'FL', x: -0.60, z:  0.60 },
      { name: 'FR', x:  0.60, z:  0.60 },
      { name: 'RL', x: -0.60, z: -0.55 },
      { name: 'RR', x:  0.60, z: -0.55 },
    ];

    for (const p of positions) {
      const wheel = this._makeWheel();
      wheel.position.set(p.x, this.wheelRadius, p.z);
      wheel.name = `wheel_${p.name}`;
      this.add(wheel);
      this.wheels.push(wheel);
    }
  }

  _makeWheel() {
    const group = new THREE.Group();

    // A CylinderGeometry tem 3 grupos de faces: lateral, tampa de cima e
    // tampa de baixo. Com um array de materiais, cada grupo usa o seu:
    // a banda de rodagem na lateral e o desenho da roda nas tampas.
    const treadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: texPneuBanda, roughness: 0.9,
    });
    // a cor multiplica a textura: o pneu preto continua preto e o aro
    // prateado fica com a cor do preset (amarelo na Peach e no Bowser)
    const sideMat = new THREE.MeshStandardMaterial({
      color: this.config.rimColor, map: texPneuLateral, roughness: 0.6,
    });
    const tireGeo = new THREE.CylinderGeometry(
      this.wheelRadius, this.wheelRadius, this.wheelWidth, 28
    );
    const tire = new THREE.Mesh(tireGeo, [treadMat, sideMat, sideMat]);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    group.add(tire);

    return group;
  }

  // v = omega * r  =>  omega = v / r
  // com o kart parado usa idleWheelSpeed, senão as rodas ficariam travadas
  update(delta) {
    const v = this.speed !== 0 ? this.speed : this.idleWheelSpeed;
    // raio efetivo, considerando a escala do kart
    const omega = v / (this.wheelRadius * this.scale.y);
    for (const wheel of this.wheels) {
      wheel.rotation.x += omega * delta;
    }
  }
}