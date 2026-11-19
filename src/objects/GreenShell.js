// GreenShell.js
// Casco verde feito com primitivas: meia esfera (casco), um toro branco
// (borda) e um cilindro branco (barriga). O desenho de hexágonos do casco
// é uma textura feita em canvas, igual ao "?" da ItemBox.
// Origem no chão, no centro do casco.

import * as THREE from 'three';

const RADIUS = 0.4;

function makeHexTexture() {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1fae3c';
  ctx.fillRect(0, 0, w, h);

  // grade de hexágonos com contorno claro
  const r = 18;
  const dx = r * Math.sqrt(3);
  const dy = r * 1.5;
  ctx.strokeStyle = '#d8f5c8';
  ctx.lineWidth = 4;
  for (let row = -1; row * dy < h + r; row++) {
    for (let col = -1; col * dx < w + r; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Vários cascos podem estar na pista ao mesmo tempo, então geometrias,
// materiais e textura são criados uma vez só e compartilhados. Por isso o
// Items.js só tira o casco da cena, sem chamar dispose().
let shared = null;
function getShared() {
  if (shared) return shared;
  shared = {
    white: new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 }),
    shellMat: new THREE.MeshStandardMaterial({
      map: makeHexTexture(), roughness: 0.3, metalness: 0.05,
    }),
    bellyGeo: new THREE.CylinderGeometry(RADIUS * 0.95, RADIUS * 0.8, 0.14, 24),
    rimGeo: new THREE.TorusGeometry(RADIUS, 0.07, 10, 28),
    // meia esfera de cima: phi de 0 a 2π, theta de 0 a π/2
    domeGeo: new THREE.SphereGeometry(RADIUS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  return shared;
}

export function createGreenShell() {
  const g = new THREE.Group();
  g.name = 'GreenShell';

  const { white, shellMat, bellyGeo, rimGeo, domeGeo } = getShared();

  // barriga branca
  const belly = new THREE.Mesh(bellyGeo, white);
  belly.position.y = 0.1;
  g.add(belly);

  // borda branca entre a barriga e o casco (o toro nasce no plano XY)
  const rim = new THREE.Mesh(rimGeo, white);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.18;
  g.add(rim);

  const dome = new THREE.Mesh(domeGeo, shellMat);
  dome.position.y = 0.18;
  dome.scale.y = 0.8;
  g.add(dome);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
