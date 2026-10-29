// src/track/Track.js
// Monta uma pista de corrida 3D estilo Mario Kart usando extrusão de curvas e primitivas do Three.js.

import * as THREE from 'three';

export class Track extends THREE.Group {
  constructor() {
    super();

    this.name = 'MarioKart_Track';
    this.trackWidth = 12; // Largura do asfalto
    this.path = null;

    this._build();
  }

  _build() {
    this._createPath();
    this._buildGround();
    this._buildAsphalt();
    this._buildCenterLine();
    this._buildKerbs();
    this._buildWalls();
    this._buildStartLine();
  }

  // 1. Definição do circuito 3D através de pontos de controlo
  _createPath() {
    const controlPoints = [
      new THREE.Vector3(  0, 0,   0),
      new THREE.Vector3( 50, 0,  20),
      new THREE.Vector3( 90, 0, -30),
      new THREE.Vector3( 50, 0, -90),
      new THREE.Vector3(-30, 0, -80),
      new THREE.Vector3(-70, 0, -20),
      new THREE.Vector3(-40, 0,  30),
    ];

    // Curva fechada (closed = true) e suave
    this.path = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal');
  }

  // 2. Terreno de grama estendido ao redor
  _buildGround() {
    const geo = new THREE.PlaneGeometry(300, 300);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e8b57, // Verde grama
      roughness: 0.85,
      metalness: 0.05,
    });

    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05; // Ligeiramente abaixo para evitar z-fighting com a pista
    ground.receiveShadow = true;
    this.add(ground);
  }

  // 3. Asfalto gerado por extrusão de um perfil plano ao longo da curva 3D
// 3. Asfalto perfeitamente plano utilizando BufferGeometry
  _buildAsphalt() {
    const steps = 300;
    const points = this.path.getSpacedPoints(steps);
    const halfW = this.trackWidth / 2;

    const vertices = [];
    const indices = [];

    // 1. Gera os vértices da esquerda e da direita acompanhando a curva
    points.forEach((pt, i) => {
      const u = i / steps;
      
      // Pega a direção da pista e calcula o vetor lateral (normal) no plano XZ
      const tangent = this.path.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Desloca o ponto central para a borda esquerda
      const leftPt = pt.clone().add(normal.clone().multiplyScalar(-halfW));
      
      // Desloca o ponto central para a borda direita
      const rightPt = pt.clone().add(normal.clone().multiplyScalar(halfW));

      // Salva as coordenadas na lista de vértices
      vertices.push(leftPt.x, leftPt.y, leftPt.z);
      vertices.push(rightPt.x, rightPt.y, rightPt.z);
    });

    // 2. Conecta os vértices criando os triângulos que formam o asfalto
    for (let i = 0; i < steps; i++) {
      const v1 = i * 2;           // Esquerda atual
      const v2 = i * 2 + 1;       // Direita atual
      const v3 = (i + 1) * 2;     // Esquerda próximo
      const v4 = (i + 1) * 2 + 1; // Direita próximo

      // Dois triângulos formam um "segmento retangular" do asfalto
      indices.push(v1, v2, v3);
      indices.push(v2, v4, v3);
    }

    // 3. Constrói a geometria 3D final
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b, // Cinza asfalto
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const asphalt = new THREE.Mesh(geo, mat);
    asphalt.position.y = 0.01; // Levemente acima da grama pra não dar z-fighting
    asphalt.receiveShadow = true;
    this.add(asphalt);
  }

  // 4. Faixa Central Amarela Tracejada (Estilo Rodovia)
  _buildCenterLine() {
    const numDashes = 120; // Quantidade de traços ao longo da pista
    const points = this.path.getSpacedPoints(numDashes);
    const dashGeo = new THREE.BoxGeometry(0.4, 0.02, 1.8); // Faixa fina e comprida
    const dashMat = new THREE.MeshStandardMaterial({ 
      color: 0xFFCC00, // Amarelo rodovia (ou 0xFFFFFF para branco)
      roughness: 0.4 
    });

    points.forEach((pt, i) => {
      // Pula alguns pontos para criar o efeito TRACEJADO (ex: desenha 1, pula 1)
      if (i % 2 === 0) {
        const u = i / numDashes;
        const tangent = this.path.getTangentAt(u).normalize();

        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.copy(pt);
        dash.position.y = 0.03; // Um pouco acima do asfalto para não sobrepor

        // Orienta a faixa na direção da curva
        const lookTarget = dash.position.clone().add(tangent);
        dash.lookAt(lookTarget);

        this.add(dash);
      }
    });
  }

  // 5. Zebras laterais (vermelho e branco) alternadas ao longo das bordas
  _buildKerbs() {
    const numKerbs = 200;
    const points = this.path.getSpacedPoints(numKerbs);
    const kerbLength = 1.6;
    const kerbWidth = 0.8;
    const kerbHeight = 0.12;

    const kerbGeo = new THREE.BoxGeometry(kerbWidth, kerbHeight, kerbLength);

    const redMat = new THREE.MeshStandardMaterial({ color: 0xC8102E, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 });

    points.forEach((pt, i) => {
      const u = i / numKerbs;
      const tangent = this.path.getTangentAt(u).normalize();
      
      // Vetor normal perpendicular no plano XZ
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const mat = (i % 2 === 0) ? redMat : whiteMat;

      // Coloca zebras nos dois lados da pista
      [-1, 1].forEach((side) => {
        const kerb = new THREE.Mesh(kerbGeo, mat);
        const offset = normal.clone().multiplyScalar(side * (this.trackWidth / 2 + kerbWidth / 2));
        
        kerb.position.copy(pt).add(offset);
        kerb.position.y = kerbHeight / 2;

        // Orienta a zebra para acompanhar a tangente da curva
        const lookTarget = kerb.position.clone().add(tangent);
        kerb.lookAt(lookTarget);

        kerb.castShadow = true;
        kerb.receiveShadow = true;
        this.add(kerb);
      });
    });
  }

  // 6. Muros externos de proteção (cinza claro)
  _buildWalls() {
    const numWallSegments = 180;
    const points = this.path.getSpacedPoints(numWallSegments);
    const wallGeo = new THREE.BoxGeometry(0.5, 1.2, 2.0);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });

    points.forEach((pt, i) => {
      const u = i / numWallSegments;
      const tangent = this.path.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        const offset = normal.clone().multiplyScalar(side * (this.trackWidth / 2 + 1.8));

        wall.position.copy(pt).add(offset);
        wall.position.y = 0.6;

        const lookTarget = wall.position.clone().add(tangent);
        wall.lookAt(lookTarget);

        wall.castShadow = true;
        wall.receiveShadow = true;
        this.add(wall);
      });
    });
  }

  // 7. Linha de Chegada / Largada Xadrez (Gerada via Canvas Procedural, igual aos logos)
  _buildStartLine() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const tileSize = 32;

    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#FFFFFF' : '#000000';
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

    const geo = new THREE.PlaneGeometry(this.trackWidth, 3);
    const startLine = new THREE.Mesh(geo, mat);

    // Posição inicial da curva (u = 0)
    const startPt = this.path.getPointAt(0);
    const tangent = this.path.getTangentAt(0).normalize();

    startLine.position.copy(startPt);
    startLine.position.y = 0.02; // Levemente acima do asfalto
    startLine.rotation.x = -Math.PI / 2;

    // Rotaciona a linha para alinhar perpendicularmente com a pista
    const angle = Math.atan2(tangent.x, tangent.z);
    startLine.rotation.z = -angle;

    this.add(startLine);
  }

  // Método opcional para animar algo na pista se necessário
  update(delta) {}
}