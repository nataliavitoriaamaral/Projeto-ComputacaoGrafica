// ItemBox.js
// Caixa de item com "?" (textura desenhada em canvas, igual ao logo do Kart).
// Origem no centro da caixa (ela flutua e gira, ver Track.update).

import * as THREE from 'three';

function makeQuestionTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5b800';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#a86b00';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#7a4a00';
  ctx.lineWidth = 8;
  ctx.font = `bold ${Math.floor(size * 0.72)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('?', size / 2, size / 2 + size * 0.04);
  ctx.fillText('?', size / 2, size / 2 + size * 0.04);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createItemBox() {
  const g = new THREE.Group();
  g.name = 'ItemBox';

  const mat = new THREE.MeshStandardMaterial({
    map: makeQuestionTexture(), roughness: 0.35, metalness: 0.1,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
  box.castShadow = true;
  g.add(box);

  return g;
}