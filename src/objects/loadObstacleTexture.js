import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const textures = new Map();

export function loadObstacleTexture(name) {
  if (!textures.has(name)) {
    const texture = loader.load(`/textures/${name}.svg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    textures.set(name, texture);
  }

  return textures.get(name);
}
