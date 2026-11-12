// loadTexture.js
// Carrega uma imagem de public/textures/ como textura de cor.
// Usado pelos karts (kartTextures.js) e pelo asfalto da pista (Track.js).

import * as THREE from 'three';

const loader = new THREE.TextureLoader();

export function loadTexture(path) {
  const texture = loader.load(`/textures/${path}`);
  // a foto está em sRGB; o Three.js converte para linear antes da iluminação
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
