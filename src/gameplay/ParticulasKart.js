// Faíscas que saem das rodas de trás durante o drift.

import * as THREE from 'three';

// círculo branco que vai ficando transparente para as bordas
function criarTexturaPonto() {
  const tamanho = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tamanho;
  const ctx = canvas.getContext('2d');
  const centro = tamanho / 2;
  const degrade = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
  degrade.addColorStop(0, 'rgba(255,255,255,1)');
  degrade.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  degrade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, tamanho, tamanho);
  return new THREE.CanvasTexture(canvas);
}

export class ParticulasKart extends THREE.Points {
  constructor(maximo = 400) {
    // 3 números (x, y, z ou r, g, b) por partícula
    const posicoes = new Float32Array(maximo * 3);
    const cores = new Float32Array(maximo * 3);

    const geometria = new THREE.BufferGeometry();
    // DynamicDrawUsage avisa a GPU que esses dados mudam a cada frame
    geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3).setUsage(THREE.DynamicDrawUsage));
    geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3).setUsage(THREE.DynamicDrawUsage));
    // drawRange diz quantos vértices desenhar: só as partículas vivas
    geometria.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true, // faíscas longe ficam menores
      map: criarTexturaPonto(),
      vertexColors: true,    // usa a cor de cada vértice
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    super(geometria, material);
    this.name = 'ParticulasKart';

    // O Three.js não desenha objetos fora do campo de visão da câmera
    this.frustumCulled = false;

    this.maximo = maximo;
    this.quantidade = 0; // quantas partículas estão ativas
    // dados da simulação, que não vão para a GPU
    this.velocidades = new Float32Array(maximo * 3);
    this.coresBase = new Float32Array(maximo * 3); // cor no começo da vida
    this.vida = new Float32Array(maximo);          // tempo de vida restante
    this.vidaMaxima = new Float32Array(maximo);    // tempo de vida inicial
  }

  // cria uma faísca (posicao e velocidade são Vector3, cor é [r, g, b] de 0 a 1)
  emitir(posicao, velocidade, cor, vida) {
    if (this.quantidade >= this.maximo) return; // sem espaço, ignora
    const i = this.quantidade++;
    const pos = this.geometry.attributes.position.array;
    pos[i * 3] = posicao.x;
    pos[i * 3 + 1] = posicao.y;
    pos[i * 3 + 2] = posicao.z;
    this.velocidades[i * 3] = velocidade.x;
    this.velocidades[i * 3 + 1] = velocidade.y;
    this.velocidades[i * 3 + 2] = velocidade.z;
    this.coresBase[i * 3] = cor[0];
    this.coresBase[i * 3 + 1] = cor[1];
    this.coresBase[i * 3 + 2] = cor[2];
    this.vida[i] = this.vidaMaxima[i] = vida;
  }

  // move as faíscas, apaga as que morreram e manda os dados para a GPU
  atualizar(dt) {
    const pos = this.geometry.attributes.position.array;
    const cores = this.geometry.attributes.color.array;
    const gravidade = 9;

    let i = 0;
    while (i < this.quantidade) {
      this.vida[i] -= dt;

      if (this.vida[i] <= 0) {
        this._copiar(this.quantidade - 1, i);
        this.quantidade--;
        continue;
      }

      // método de Euler: primeiro a gravidade muda a velocidade
      // (v = v + g·dt), depois a velocidade muda a posição (p = p + v·dt)
      this.velocidades[i * 3 + 1] -= gravidade * dt;
      for (let k = 0; k < 3; k++) pos[i * 3 + k] += this.velocidades[i * 3 + k] * dt;

      // a cor escurece proporcionalmente ao tempo de vida que sobrou
      // (com blending aditivo, escurecer = ficar transparente)
      const brilho = this.vida[i] / this.vidaMaxima[i];
      for (let k = 0; k < 3; k++) cores[i * 3 + k] = this.coresBase[i * 3 + k] * brilho;
      i++;
    }

    this.geometry.setDrawRange(0, this.quantidade);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  // copia todos os dados da partícula "de" para a posição "para"
  _copiar(de, para) {
    if (de === para) return;
    const pos = this.geometry.attributes.position.array;
    const cores = this.geometry.attributes.color.array;
    for (let k = 0; k < 3; k++) {
      pos[para * 3 + k] = pos[de * 3 + k];
      cores[para * 3 + k] = cores[de * 3 + k];
      this.velocidades[para * 3 + k] = this.velocidades[de * 3 + k];
      this.coresBase[para * 3 + k] = this.coresBase[de * 3 + k];
    }
    this.vida[para] = this.vida[de];
    this.vidaMaxima[para] = this.vidaMaxima[de];
  }

  // apaga todas as faíscas de uma vez 
  limpar() {
    this.quantidade = 0;
    this.geometry.setDrawRange(0, 0);
  }

  // libera a memória da GPU
  descartar() {
    this.geometry.dispose();
    this.material.map.dispose();
    this.material.dispose();
  }
}
