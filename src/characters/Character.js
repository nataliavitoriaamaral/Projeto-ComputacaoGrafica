// Character.js
// Carrega personagem de .gltf, redimensiona para uma altura alvo,
// encosta no chão e tenta consertar texturas e meshes espelhadas
// que o loader não trata direito nos modelos do Sketchfab.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Character extends THREE.Group {
  constructor({
    url,
    targetHeight = 1.4,
    texturesDir,
    name = 'Character',
    materialMapMirrors = [],
    arms = [],
    hipFraction,
    posture = [],
  }) {
    super();
    this.name = name;
    this.targetHeight = targetHeight;
    // nomes dos ossos de cada braço: [ombro, cotovelo, pulso]
    this.arms = arms;
    // altura do quadril em relação à altura total (padrão no Racer: 0.45)
    this.hipFraction = hipFraction;
    // correções de pose: [{ bone, pitch }], pitch em graus no eixo X
    this._posture = posture;
    this._materialMapMirrors = materialMapMirrors;

    this._url = url;
    this._texturesDir = texturesDir ?? Character._guessTexturesDir(url);

    this.model = null;
    this.ready = this._load();
  }

  static _guessTexturesDir(url) {
    const idx = url.lastIndexOf('/');
    const base = idx >= 0 ? url.slice(0, idx) : '.';
    return `${base}/textures/`;
  }

  async _load() {
    const loader = new GLTFLoader();

    const gltf = await new Promise((resolve, reject) => {
      loader.load(this._url, resolve, undefined, reject);
    });

    this.model = gltf.scene;

    this.model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    this._fitToHeight(this.targetHeight);
    this._groundFeet();

    await this._patchMissingMaps();
    if (this._materialMapMirrors.length) {
      this._mirrorMaterialMap(this._materialMapMirrors);
    }
    this._fixMaterialVisibility();
    this._fixMirroredMeshes();
    this._applyPosture();

    this.add(this.model);
    return this;
  }

  // Gira cada osso da lista em torno do eixo X do personagem. Pitch negativo
  // inclina para trás. Os ossos filhos acompanham a rotação.
  // Usado no Bowser, cujo modelo vem curvado para frente.
  _applyPosture() {
    if (!this._posture.length) return;
    const xAxis = new THREE.Vector3(1, 0, 0);

    for (const { bone: name, pitch } of this._posture) {
      const bone = this.model.getObjectByName(name);
      if (!bone) {
        console.warn(`${this.name}: osso ${name} não encontrado`);
        continue;
      }
      this.model.updateMatrixWorld(true);

      // aplica o giro no espaço do mundo e converte para o espaço do pai
      const turn = new THREE.Quaternion()
        .setFromAxisAngle(xAxis, THREE.MathUtils.degToRad(pitch));
      const world = turn.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
      const parentInv = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      bone.quaternion.copy(parentInv.multiply(world));
    }
    this.model.updateMatrixWorld(true);
  }

  _fitToHeight(targetHeight) {
    const bbox = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    if (size.y <= 0) return;
    const scale = targetHeight / size.y;
    this.model.scale.setScalar(scale);
  }

  _groundFeet() {
    const bbox = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= bbox.min.y;
  }

  // tenta carregar <nome>_diffuse.png, _normal.png e _specularGlossiness.png
  // da pasta de texturas para os materiais que vieram sem map.
  async _patchMissingMaps() {
    const texLoader = new THREE.TextureLoader();
    const cache = new Map();

    const tryLoad = (url, { srgb }) => {
      if (cache.has(url)) return cache.get(url);
      const promise = new Promise((resolve) => {
        texLoader.load(
          url,
          (tex) => {
            tex.flipY = false;
            // algumas meshes do Luigi (o branco do olho direito) têm UV > 1 e
            // contam com a textura se repetindo. no modo clamp, que é o padrão
            // do TextureLoader, elas só pegavam a borda transparente e sumiam.
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
            resolve(tex);
          },
          undefined,
          () => resolve(null)
        );
      });
      cache.set(url, promise);
      return promise;
    };

    const standardMats = new Set();
    this.model.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.isMeshStandardMaterial && (m.name || '').trim()) {
          standardMats.add(m);
        }
      });
    });

    const pass1 = [];
    standardMats.forEach((mat) => {
      if (mat.map) return;
      const url = `${this._texturesDir}${mat.name.trim()}_diffuse.png`;
      pass1.push(tryLoad(url, { srgb: true }).then((tex) => {
        if (!tex) return;
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      }));
    });
    await Promise.all(pass1);

    const pass2 = [];
    standardMats.forEach((mat) => {
      if (mat.normalMap) return;
      const url = `${this._texturesDir}${mat.name.trim()}_normal.png`;
      pass2.push(tryLoad(url, { srgb: false }).then((tex) => {
        if (!tex) return;
        mat.normalMap = tex;
        mat.needsUpdate = true;
      }));
    });
    await Promise.all(pass2);

    const pass3 = [];
    standardMats.forEach((mat) => {
      if (mat.map) return;
      const url = `${this._texturesDir}${mat.name.trim()}_specularGlossiness.png`;
      pass3.push(tryLoad(url, { srgb: true }).then((tex) => {
        if (!tex) return;
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      }));
    });
    await Promise.all(pass3);
  }

  // o Luigi veio sem o PNG de alguns materiais do lado direito. o lado direito
  // é o espelho do esquerdo, então é possível reaproveitar a textura do par que
  // existe invertendo o eixo U: repeat.x = -1 e offset.x = 1 fazem u virar 1-u.
  _mirrorMaterialMap(pairs) {
    const materials = new Map();
    this.model.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => { if (m?.name) materials.set(m.name, m); });
    });

    for (const [srcName, dstName] of pairs) {
      const src = materials.get(srcName);
      const dst = materials.get(dstName);
      if (!src || !dst) {
        console.warn(`${this.name}: material ${srcName} ou ${dstName} não encontrado`);
        continue;
      }
      if (src.map && !dst.map) {
        const mirrored = src.map.clone();
        mirrored.repeat.x = -1;
        mirrored.offset.x = 1;
        mirrored.needsUpdate = true;

        dst.map = mirrored;
        dst.color.setHex(0xffffff);
        if (src.normalMap) dst.normalMap = src.normalMap;
        dst.needsUpdate = true;
      }
    }
  }

  // alguns materiais vinham transparentes ou só com uma face; força todos a
  // aparecerem dos dois lados e sem transparência
  _fixMaterialVisibility() {
    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.visible = true;
      obj.frustumCulled = false;

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        m.side = THREE.DoubleSide;
        m.opacity = 1;
        m.visible = true;
        m.depthWrite = true;
        m.depthTest = true;
        m.alphaTest = 0.5;
        m.transparent = false;
        m.needsUpdate = true;
      });
    });
  }

  // meshes com escala negativa (determinante < 0) ficam com os triângulos
  // virados para o lado errado; a ordem dos vértices é invertida para corrigir
  _fixMirroredMeshes() {
    this.model.updateMatrixWorld(true);

    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      const det = obj.matrixWorld.determinant();
      if (det >= 0) return;

      const g0 = obj.geometry;
      if (!g0 || !g0.attributes.position) return;

      const g = g0.clone();
      obj.geometry = g;

      if (g.index) {
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp;
        }
        g.index.needsUpdate = true;
      } else {
        const pos = g.attributes.position.array;
        for (let i = 0; i < pos.length; i += 9) {
          for (let j = 0; j < 3; j++) {
            const tmp = pos[i + 3 + j];
            pos[i + 3 + j] = pos[i + 6 + j];
            pos[i + 6 + j] = tmp;
          }
        }
        g.attributes.position.needsUpdate = true;
      }

      g.computeVertexNormals();
    });
  }
}

export function createMario(overrides = {}) {
  return new Character({
    name: 'Mario',
    url: '/models/mario/scene.gltf',
    targetHeight: 1.4,
    // o GLTFLoader tira o ':' dos nomes ("mixamorig:LeftArm" vira "mixamorigLeftArm")
    arms: [
      ['mixamorigLeftArm_09', 'mixamorigLeftForeArm_010', 'mixamorigLeftHand_011'],
      ['mixamorigRightArm_017', 'mixamorigRightForeArm_018', 'mixamorigRightHand_019'],
    ],
    ...overrides,
  }).ready;
}

export function createLuigi(overrides = {}) {
  return new Character({
    name: 'Luigi',
    url: '/models/luigi/scene.gltf',
    targetHeight: 1.5,
    materialMapMirrors: [['Material_51', 'Material_52']],
    arms: [
      ['L_upperarm_024', 'L_forearm_025', 'L_hand_026'],
      ['R_upperarm_041', 'R_forearm_042', 'R_hand_043'],
    ],
    ...overrides,
  }).ready;
}

// Os arquivos da Peach e do Bowser incluem animação, que não é utilizada.

export function createPeach(overrides = {}) {
  return new Character({
    name: 'Peach',
    url: '/models/Peach/scene.gltf',
    targetHeight: 1.6,
    // esqueleto do Mixamo, com nomes no mesmo padrão do Mario
    arms: [
      ['mixamorigLeftArm_08', 'mixamorigLeftForeArm_09', 'mixamorigLeftHand_010'],
      ['mixamorigRightArm_028', 'mixamorigRightForeArm_029', 'mixamorigRightHand_030'],
    ],
    ...overrides,
  }).ready;
}

export function createBowser(overrides = {}) {
  return new Character({
    name: 'Bowser',
    url: '/models/Bowser/scene.gltf',
    targetHeight: 1.7,
    // endireita a coluna, que vem curvada para frente
    posture: [
      { bone: 'Spine_016', pitch: -40 },
    ],
    // quadril mais baixo que o padrão, para o tronco ficar acima das laterais
    hipFraction: 0.4,
    arms: [
      ['LeftArm_020', 'LeftForeArm_021', 'LeftHandRoll_022'],
      ['RightArm_037', 'RightForeArm_038', 'RightHandRoll_039'],
    ],
    ...overrides,
  }).ready;
}
