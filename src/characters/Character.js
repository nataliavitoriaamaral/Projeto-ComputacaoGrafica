// Character.js
// Carrega personagem de .gltf, redimensiona pra uma altura alvo,
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
    debug = false,
    materialMapMirrors = [],
  }) {
    super();
    this.name = name;
    this.targetHeight = targetHeight;
    this._debug = debug;
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
    await this._patchMissingMaps();
    if (this._materialMapMirrors.length) {
        this._mirrorMaterialMap(this._materialMapMirrors);
    }
    this._fixMaterialVisibility();
    this._fixMaterialVisibility();
    this._fixMirroredMeshes();

    if (this._debug) {
      this._logMeshStats();
      this._logEyeStats();
    }

    this.add(this.model);
    return this;
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
  // da pasta de texturas pros materiais que vieram sem map.
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
  // é o espelho do esquerdo, então dá pra reaproveitar a textura do par que
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
        console.warn(`[${this.name}] mirrorMaterialMap: par ${srcName}/${dstName} incompleto`,
          { srcFound: !!src, dstFound: !!dst });
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
        if (this._debug) {
          console.log(`[${this.name}] copiou textura: ${srcName} -> ${dstName}`);
        }
      }
    }
  }

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

      if (this._debug) {
        console.log(`[${this.name}] winding invertido em: ${obj.name} (det=${det.toFixed(3)})`);
      }
    });
  }

  _logMeshStats() {
    const bbox = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    console.group(`[${this.name}] meshes`);
    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      bbox.setFromObject(obj);
      bbox.getCenter(center);
      bbox.getSize(size);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const matInfo = mats.map((m) =>
        m ? `${m.name || '?'}:${m.map ? 'com_map' : 'sem_map'}` : 'null'
      ).join(' | ');
      console.log(
        `${(obj.name || '?').padEnd(12)}  ` +
        `cx=${center.x.toFixed(3)} cy=${center.y.toFixed(3)} cz=${center.z.toFixed(3)}  ` +
        `sx=${size.x.toFixed(3)} sy=${size.y.toFixed(3)} sz=${size.z.toFixed(3)}  ` +
        `mats=[${matInfo}]`
      );
    });
    console.groupEnd();
  }

  _logEyeStats() {
    const eyeRegex = /eye|olho|pupil|iris|eyeball/i;
    const bbox = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    console.group(`[${this.name}] olhos`);
    let n = 0;
    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      const matName = Array.isArray(obj.material)
        ? obj.material.map(m => m?.name || '').join(',')
        : (obj.material?.name || '');
      if (!eyeRegex.test(obj.name) && !eyeRegex.test(matName)) return;

      n++;
      obj.updateMatrixWorld(true);
      bbox.setFromObject(obj);
      bbox.getSize(size);
      bbox.getCenter(center);
      const det = obj.matrixWorld.determinant();
      const verts = obj.geometry?.attributes?.position?.count ?? 0;

      console.log({
        name: obj.name,
        mat: matName,
        visible: obj.visible,
        det: +det.toFixed(3),
        verts,
        bboxSize:   size.toArray().map(v => +v.toFixed(3)),
        bboxCenter: center.toArray().map(v => +v.toFixed(3)),
      });
    });
    if (n === 0) {
      console.warn('nenhuma mesh de olho bateu o regex. ver nomes alternativos no grupo "meshes" acima.');
    }
    console.groupEnd();
  }
}

export function createMario(overrides = {}) {
  return new Character({
    name: 'Mario',
    url: '/models/mario/scene.gltf',
    targetHeight: 1.4,
    ...overrides,
  }).ready;
}

export function createLuigi(overrides = {}) {
  return new Character({
    name: 'Luigi',
    url: '/models/luigi/scene.gltf',
    targetHeight: 1.5,
    materialMapMirrors: [['Material_51', 'Material_52']],
    ...overrides,
  }).ready;
}