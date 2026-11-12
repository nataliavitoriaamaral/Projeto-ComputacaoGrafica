// kartTextures.js
// Texturas dos karts (imagens em public/textures/kart/).
//
// Equivalência com WebGL:
//   loader.load(...)   -> gl.createTexture, gl.bindTexture e gl.texImage2D
//   wrapS / wrapT      -> gl.texParameteri(gl.TEXTURE_WRAP_S / _T, gl.REPEAT)
//   material.map       -> uniform sampler2D lido com texture2D() no shader
// As coordenadas UV já vêm prontas nas geometrias do Three.js.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function carregar(arquivo) {
  const textura = loader.load(`/textures/kart/${arquivo}`);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export const texLataria = carregar('TexturaLatariaCarroSuave.jpg');
export const texBanco = carregar('BancoCarro.webp');

// Banda de rodagem. No cilindro, a coordenada u dá a volta no pneu, mas na
// imagem o desenho está em pé; por isso a textura é girada 90°.
// Com a rotação, repeat.y passa a contar as repetições em volta do pneu.
export const texPneuBanda = carregar('PneuLateral.jpg');
texPneuBanda.wrapS = THREE.RepeatWrapping;
texPneuBanda.wrapT = THREE.RepeatWrapping;
texPneuBanda.rotation = Math.PI / 2;
texPneuBanda.repeat.set(1, 3);

// Roda vista de lado. A imagem (600x600 px) tem três desenhos; repeat e
// offset fazem a tampa do cilindro usar só o quadrado da roda, que começa
// em x = 181 px e termina em y = 428 px e tem 393 px de lado.
// O offset.y é medido de baixo para cima, por isso 1 - 428/600.
export const texPneuLateral = carregar('RodaCarro.jpg');
texPneuLateral.repeat.set(393 / 600, 393 / 600);
texPneuLateral.offset.set(181 / 600, 1 - 428 / 600);
