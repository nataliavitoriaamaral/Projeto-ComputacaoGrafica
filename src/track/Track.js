// Track.js
// Pista montada a partir de uma curva fechada (CatmullRomCurve3).
// Asfalto, faixa central, zebras, muros e a largada seguem a mesma curva.

import * as THREE from 'three';
import { disposeObject } from '../utils/dispose.js';

export class Track extends THREE.Group {
  constructor(config) {
    super();

    this.name = 'Track';
    this.config = config;
    this.trackWidth = config.trackWidth;
    this.path = null;

    this._createPath();
    this._buildGround();
    this._buildAsphalt();
    this._buildCenterLine();
    this._buildKerbs();
    this._buildWalls();
    this._buildStartLine();
    this._buildStartBanner();
  }

  // pontos de controle do circuito
  //puxa o config do trackConfigs.js e cria a curva fechada
  _createPath() {
    this.path = new THREE.CatmullRomCurve3(this.config.controlPoints, true, 'centripetal');
  }

  // constrói o chão do circuito
  _buildGround() {
    const geo = new THREE.PlaneGeometry(400, 400);
    const mat = new THREE.MeshStandardMaterial({
      color: this.config.groundColor,
      roughness: 0.85,
      metalness: 0.05,
    });

    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05; // um pouco abaixo da pista para evitar z-fighting
    ground.receiveShadow = true;
    this.add(ground);
  }

  // malha do asfalto: dois vértices (esquerda e direita) por ponto da curva
  _buildAsphalt() {
    const steps = 300;
    const points = this.path.getSpacedPoints(steps);
    const halfW = this.trackWidth / 2;

    const vertices = [];
    const indices = [];

    points.forEach((pt, i) => {
      const u = i / steps;

      // vetor lateral = tangente girada 90° no plano XZ
      const tangent = this.path.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const leftPt = pt.clone().addScaledVector(normal, -halfW);
      const rightPt = pt.clone().addScaledVector(normal, halfW);

      vertices.push(leftPt.x, leftPt.y, leftPt.z);
      vertices.push(rightPt.x, rightPt.y, rightPt.z);
    });

    // dois triângulos entre cada par de amostras
    for (let i = 0; i < steps; i++) {
      const v1 = i * 2;           // esquerda atual
      const v2 = i * 2 + 1;       // direita atual
      const v3 = (i + 1) * 2;     // esquerda seguinte
      const v4 = (i + 1) * 2 + 1; // direita seguinte

      indices.push(v1, v2, v3);
      indices.push(v2, v4, v3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: this.config.asphaltColor,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const asphalt = new THREE.Mesh(geo, mat);
    asphalt.position.y = 0.01;
    asphalt.receiveShadow = true;
    this.add(asphalt);
  }

  // faixa amarela tracejada no meio
  _buildCenterLine() {
    const numDashes = 120;
    const points = this.path.getSpacedPoints(numDashes);
    const dashGeo = new THREE.BoxGeometry(0.4, 0.02, 1.8);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4 });

    points.forEach((pt, i) => {
      if (i % 2 !== 0) return; // pula um sim, um não

      const tangent = this.path.getTangentAt(i / numDashes).normalize();
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.copy(pt);
      dash.position.y = 0.03;
      dash.lookAt(dash.position.clone().add(tangent));
      this.add(dash);
    });
  }

  // zebras vermelhas e brancas nas duas bordas
  _buildKerbs() {
    const numKerbs = 200;
    const points = this.path.getSpacedPoints(numKerbs);
    const kerbLength = 1.6;
    const kerbWidth = 0.8;
    const kerbHeight = 0.12;

    const kerbGeo = new THREE.BoxGeometry(kerbWidth, kerbHeight, kerbLength);
    const redMat = new THREE.MeshStandardMaterial({ color: this.config.kerbRed, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: this.config.kerbWhite, roughness: 0.5 });

    points.forEach((pt, i) => {
      const tangent = this.path.getTangentAt(i / numKerbs).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const mat = i % 2 === 0 ? redMat : whiteMat;

      [-1, 1].forEach((side) => {
        const kerb = new THREE.Mesh(kerbGeo, mat);
        kerb.position.copy(pt).addScaledVector(normal, side * (this.trackWidth / 2 + kerbWidth / 2));
        kerb.position.y = kerbHeight / 2;
        kerb.lookAt(kerb.position.clone().add(tangent));
        kerb.castShadow = true;
        kerb.receiveShadow = true;
        this.add(kerb);
      });
    });
  }

  _buildWalls() {
    const numWallSegments = 180;
    const points = this.path.getSpacedPoints(numWallSegments);
    const wallGeo = new THREE.BoxGeometry(0.5, 1.2, 2.0);
    const wallMat = new THREE.MeshStandardMaterial({ color: this.config.wallColor, roughness: 0.7 });

    points.forEach((pt, i) => {
      const tangent = this.path.getTangentAt(i / numWallSegments).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.copy(pt).addScaledVector(normal, side * (this.trackWidth / 2 + 1.8));
        wall.position.y = 0.6;
        wall.lookAt(wall.position.clone().add(tangent));
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.add(wall);
      });
    });
  }

  // faixa quadriculada no chão, em u = 0
  _buildStartLine() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const tileSize = 32;

    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    // deita o plano direto na geometria (XY -> XZ). Assim a malha só precisa
    // girar em Y, igual ao pórtico e aos karts.
    // Antes era rotation.x + rotation.z na malha, mas o Three.js aplica o Z
    // antes do X (ordem 'XYZ'), e a faixa ficava torta quando a pista
    // não começava alinhada com um eixo.
    const geo = new THREE.PlaneGeometry(this.trackWidth, 3);
    geo.rotateX(-Math.PI / 2);

    const startLine = new THREE.Mesh(geo, mat);
    const startPt = this.path.getPointAt(0);
    const tangent = this.path.getTangentAt(0).normalize();

    startLine.position.copy(startPt);
    startLine.position.y = 0.02;
    startLine.rotation.y = Math.atan2(tangent.x, tangent.z);

    this.add(startLine);
  }

  // pórtico em cima da linha de chegada: dois postes e uma faixa com o letreiro
  _buildStartBanner() {
    const banner = new THREE.Group();
    banner.name = 'StartBanner';

    const span = this.trackWidth + 6; // distância entre os postes (fora dos muros)
    const height = 6;                 // altura da faixa

    // postes
    const postMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.3 });
    const postGeo = new THREE.CylinderGeometry(0.3, 0.3, height + 1, 16);
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * span / 2, (height + 1) / 2, 0);
      post.castShadow = true;
      banner.add(post);
    });

    // faixa: uma caixa achatada com a textura desenhada no canvas
    const tex = this._makeBannerTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    // ordem das faces da BoxGeometry: +x, -x, +y, -y, +z, -z
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(span, 2.2, 0.3),
      [sideMat, sideMat, sideMat, sideMat, signMat, signMat]
    );
    sign.position.y = height;
    sign.castShadow = true;
    banner.add(sign);

    // posiciona o grupo na largada, atravessado na pista
    const startPt = this.path.getPointAt(0);
    const tangent = this.path.getTangentAt(0).normalize();
    banner.position.copy(startPt);
    banner.rotation.y = Math.atan2(tangent.x, tangent.z);

    this.add(banner);
  }

  // xadrez em cima e embaixo, texto no meio
  _makeBannerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const tile = 16;

    ctx.fillStyle = '#c8102e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // duas fileiras de xadrez no topo e duas na base
    for (let x = 0; x < canvas.width / tile; x++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (x + row) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(x * tile, row * tile, tile, tile);
        ctx.fillRect(x * tile, canvas.height - (row + 1) * tile, tile, tile);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', canvas.width / 2, canvas.height / 2 + 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // libera a memória da GPU ao remover a pista da cena
  dispose() {
    disposeObject(this);
  }
}
