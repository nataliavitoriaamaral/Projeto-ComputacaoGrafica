// kartEmblems.js
// Logos do capô desenhados em canvas 2D e convertidos em textura.
// O tipo de logo vem de emblem.type no preset do kart.

import * as THREE from 'three';

const SIZE = 256;
const C = SIZE / 2; // centro do canvas

const toCss = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// disco de fundo
function drawDisc(ctx, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(C, C, C - 6, 0, Math.PI * 2);
  ctx.fill();
}

// letra sobre disco branco (Mario e Luigi)
function drawLetter(ctx, { letter, color }) {
  drawDisc(ctx, '#ffffff');
  ctx.fillStyle = toCss(color);
  ctx.font = `bold ${Math.floor(SIZE * 0.72)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, C, C + SIZE * 0.04);
}

// rosto do Bowser simplificado, em vermelho sobre disco preto
function drawBowser(ctx) {
  drawDisc(ctx, '#111111');
  ctx.fillStyle = '#e0261b';

  // chifres
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(C + s * 30, C - 40);
    ctx.lineTo(C + s * 78, C - 92);
    ctx.lineTo(C + s * 62, C - 22);
    ctx.fill();
  });

  // cabeça
  ctx.beginPath();
  ctx.ellipse(C, C + 4, 70, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  // cabelo
  ctx.beginPath();
  ctx.moveTo(C - 34, C - 48);
  ctx.lineTo(C - 18, C - 86);
  ctx.lineTo(C, C - 54);
  ctx.lineTo(C + 18, C - 86);
  ctx.lineTo(C + 34, C - 48);
  ctx.fill();

  // olhos e boca pintados com a cor do fundo
  ctx.fillStyle = '#111111';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(C + s * 26, C - 10, 13, 9, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(C - 40, C + 26);
  ctx.lineTo(C + 40, C + 26);
  ctx.lineTo(C, C + 52);
  ctx.closePath();
  ctx.fill();
}

// coroa da Peach sobre disco branco
function drawCrown(ctx) {
  drawDisc(ctx, '#ffffff');

  // contorno da coroa com três pontas
  ctx.fillStyle = '#f2b600';
  ctx.beginPath();
  ctx.moveTo(C - 78, C + 50);
  ctx.lineTo(C - 78, C - 50);
  ctx.lineTo(C - 40, C - 5);
  ctx.lineTo(C, C - 70);
  ctx.lineTo(C + 40, C - 5);
  ctx.lineTo(C + 78, C - 50);
  ctx.lineTo(C + 78, C + 50);
  ctx.closePath();
  ctx.fill();

  // joias
  const gem = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  gem(C, C + 18, 18, '#e0261b');
  gem(C - 48, C + 22, 12, '#4aa3e0');
  gem(C + 48, C + 22, 12, '#4aa3e0');
}

const DRAWERS = {
  letter: drawLetter,
  bowser: drawBowser,
  crown:  drawCrown,
};

export function makeEmblemTexture(emblem) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const draw = DRAWERS[emblem.type] ?? drawLetter;
  draw(ctx, emblem);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
