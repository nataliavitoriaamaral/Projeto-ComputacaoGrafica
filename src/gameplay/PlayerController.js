// Controle e física do kart do jogador

// A posição do kart é guardada em dois números:
//   userData.u    - quanto do circuito já foi percorrido (0 = largada, 1 = volta completa)
//   userData.side - distância lateral até o centro da pista (positivo = direita)
// Para achar a posição no mundo, usamos a curva da pista:
//   T = getTangentAt(u) é o vetor que aponta a direção da pista 
//   e girando T em 90° no plano XZ temos N = (-T.z, 0, T.x), que aponta para o lado;
//   posição = getPointAt(u) + N * side.

// O ângulo para onde o kart aponta é guardado no mundo (rotação em
// torno do eixo Y). A cada frame, o vetor da direção do movimento é dividido
// em duas partes usando produto escalar:
//   a parte na direção de T faz o u avançar
//   a parte na direção de N muda o side

import * as THREE from 'three';
import { ParticulasKart } from './ParticulasKart.js';

// Distância em unidades do Three.js (o kart tem uns 2 de
// comprimento), tempo em segundos e ângulos em radianos
export const FISICA = {
  // motor e freio
  velocidadeMaxima: 22,
  aceleracao: 20,
  frenagem: 28,             // desaceleração ao frear
  aceleracaoRe: 10,
  velocidadeMaximaRe: 7,
  atritoSemAcelerar: 5,     // desaceleração quando o jogador solta todas as teclas

  // fora do asfalto
  toleranciaZebra: 0.4,     
  fatorGrama: 0.45,         // na grama a velocidade máxima cai para 45%
  atritoGrama: 12,          // atrito extra na grama

  // direção 
  anguloMaximoRodas: 0.5,   // quanto as rodas da frente viram com o kart parado
  quedaDirecao: 4,          // quanto maior, mais devagar o ângulo das rodas diminui com a velocidade
  velocidadeVolante: 6,     // quão rápido o volante chega na posição pedida
  aderencia: 10,            // quão rápido o movimento segue o kart

  // pulo e drift
  gravidade: 30,
  velocidadePulo: 4.5,      // velocidade para cima no começo do pulo
  velocidadeMinimaDrift: 8,
  aderenciaDrift: 3,        // no drift a aderência é menor e o kart escorrega
  giroDrift: 1.25,          // quanto o kart gira por segundo 
  controleDrift: 0.55,      // quanto o direcional abre ou fecha a curva no drift
  tempoNivel1: 0.9,         // segundos de drift para a faísca ficar azul
  tempoNivel2: 2.0,         // segundos de drift para a faísca ficar laranja
  turboNivel1: 0.6,         
  turboNivel2: 1.2,         

  // turbo 
  fatorTurbo: 1.4,          // a velocidade máxima aumenta 40%
  aceleracaoTurbo: 35,

  // muro 
  distanciaMuro: 1.55,
  perdaBatida: 0.7,         // numa batida de frente o kart perde 70% da velocidade
  atritoMuro: 1.5,          // perda de velocidade enquanto raspa no muro

  // efeitos causados por colisões e itens
  duracaoRodopio: 1.0,
  duracaoAtordoado: 1.3,
  puloAtordoado: 6,         // o casco joga o kart para cima

  // cada moeda aumenta 2% a velocidade máxima, até 10 moedas
  bonusMoeda: 0.02,
  maximoMoedas: 10,
};

// valores só da parte visual
const ANGULO_RODAS_DIANTEIRAS = 0.45; // giro máximo das rodas da frente na tela
const ANGULO_VOLANTE = 0.6;           // giro máximo do volante
const INCLINACAO_MAXIMA = 0.09;       // inclinação máxima do kart na curva


function diferencaAngulo(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function fatorSuavizacao(k, dt) {
  return 1 - Math.exp(-k * dt);
}

export class PlayerController {
  constructor({ racer, track, scene, teclado }) {
    this.racer = racer;
    this.kart = racer.kart;
    this.teclado = teclado;
    this.pista = track;


    this.habilitado = true;

    // medidas do kart multiplicadas pela escala
    const escala = this.kart.scale.x;
    this.entreEixos = (0.60 + 0.55) * escala; // distância entre o eixo da frente e o de trás
    this.meiaLargura = (0.60 + 0.14) * escala; // do centro do kart até o lado de fora da roda

    // Com 'YXZ', a roda primeiro rola no próprio
    // eixo e depois o conjunto vira
    this.rodasDianteiras = this.kart.wheels.slice(0, 2); 
    this.rodasDianteiras.forEach((roda) => { roda.rotation.order = 'YXZ'; });


    this.faiscas = new ParticulasKart();
    scene.add(this.faiscas);

    // Objeto invisível que as câmeras 4 e 5 seguem no lugar do kart
    // Sem isso a câmera giraria junto quando o kart roda no óleo
    this.alvoCamera = new THREE.Object3D();


    const dados = racer.userData;
    dados.isPlayer = true;
    dados.lap ??= 0;
    racer.applyEffect = (tipo, duracao) => this.aplicarEfeito(tipo, duracao);

    this._criarPainel();
    this.reiniciar();
  }

  // Chamado quando a pista muda. O grid de largada já gravou o u e o side
  // da vaga do kart no userData
  trocarPista(track) {
    this.pista = track;
    this.reiniciar();
  }

  // deixa o kart parado, apontando para a frente da pista, no u e side atuais
  reiniciar() {
    const dados = this.racer.userData;
    dados.speed = 0;
    dados.state = 'normal';

    const tangente = this.pista.path.getTangentAt(dados.u).normalize();
    // atan2(x, z) dá o ângulo em torno de Y de um vetor no plano XZ
    this.anguloNariz = Math.atan2(tangente.x, tangente.z);  // para onde o kart aponta
    this.anguloMovimento = this.anguloNariz;                 // para onde o kart está indo
    this.anguloCamera = this.anguloNariz;

    this.volante = 0;            // de -1 (toda à direita) a 1 (toda à esquerda)
    this.anguloRodas = 0;        // ângulo atual das rodas da frente 
    this.velocidadeGiro = 0;     // quanto o kart gira por segundo 
    this.alturaPulo = 0;
    this.velocidadeVertical = 0;
    this.drift = null;           
    this.naGrama = false;
    this.encostadoNoMuro = false;
    this.empurrandoMuro = false;
    this.inclinacao = 0;

    // tempo que falta para cada efeito acabar (0 = desligado)
    this.efeitos = { rodopio: 0, atordoado: 0, turbo: 0 };
    this.duracaoGiro = 0;        

    this.faiscas.limpar();
    this._posicionarKart();
  }

  aplicarEfeito(tipo, duracao) {
    const efeitos = this.efeitos;

    if (tipo === 'spin') {
      // óleo ou banana: o kart dá uma volta em torno de si mesmo
      efeitos.rodopio = this.duracaoGiro = duracao ?? FISICA.duracaoRodopio;
      efeitos.turbo = 0;
      this.drift = null;
    } else if (tipo === 'stunned') {
      // casco: o kart é jogado para cima
      efeitos.atordoado = this.duracaoGiro = duracao ?? FISICA.duracaoAtordoado;
      efeitos.turbo = 0;
      this.drift = null;
      this.velocidadeVertical = FISICA.puloAtordoado;
    } else if (tipo === 'boost') {
      // cogumelo ou mini-turbo: se já estiver no turbo, fica com o maior tempo
      efeitos.turbo = Math.max(efeitos.turbo, duracao ?? 1.0);
    } else {
      console.warn(`aplicarEfeito: efeito desconhecido "${tipo}"`);
    }
  }

  // chamado uma vez por frame pelo main.js
  atualizar(delta) {
    const dt = Math.min(delta, 1 / 20);
    const F = FISICA;
    const dados = this.racer.userData;
    const efeitos = this.efeitos;

    // desconta o tempo dos efeitos ativos
    for (const nome in efeitos) efeitos[nome] = Math.max(0, efeitos[nome] - dt);

    // TECLADO
    // Rodando ou atordoado, o jogador perde o controle.
    const podeControlar = this.habilitado && efeitos.rodopio === 0 && efeitos.atordoado === 0;
    const teclado = this.teclado;
    const acelerando = podeControlar && teclado.estaSegurada('acelerar');
    const freando = podeControlar && teclado.estaSegurada('frear');
    const direcional = podeControlar ? teclado.eixo('direita', 'esquerda') : 0; // 1 = esquerda
    const segurandoPulo = podeControlar && teclado.estaSegurada('pular');

    // VELOCIDADE MÁXIMA DO MOMENTO
    // Depende do chão, do turbo e das moedas
    const metadePista = this.pista.trackWidth / 2;
    this.naGrama = Math.abs(dados.side) > metadePista + F.toleranciaZebra;
    const moedas = Math.min(dados.coins ?? 0, F.maximoMoedas);
    let velocidadeMaxima = F.velocidadeMaxima * (1 + F.bonusMoeda * moedas);
    if (efeitos.turbo > 0) velocidadeMaxima *= F.fatorTurbo;
    else if (this.naGrama) velocidadeMaxima *= F.fatorGrama; // com turbo a grama não atrapalha
    this.velocidadeMaximaAtual = velocidadeMaxima;

    // VELOCIDADE 
    let v = dados.speed;
    if (efeitos.atordoado > 0) {
      v *= Math.exp(-6 * dt);   // freia 
    } else if (efeitos.rodopio > 0) {
      v *= Math.exp(-1.5 * dt); // perdendo velocidade aos poucos
    } else if (efeitos.turbo > 0) {
      // o turbo empurra o kart sozinho, mesmo sem acelerar
      v = Math.max(v, Math.min(v + F.aceleracaoTurbo * dt, velocidadeMaxima));
    } else if (acelerando) {
      if (v < 0) {
        v = Math.min(0, v + F.frenagem * dt); // estava de ré: primeiro freia
      } else {
        // A aceleração vai diminuindo conforme chega na velocidade máxima
        v += F.aceleracao * (1 - v / velocidadeMaxima) * dt;
      }
    } else if (freando) {
      if (v > 0.5) v = Math.max(0, v - F.frenagem * dt);            // freando
      else v = Math.max(-F.velocidadeMaximaRe, v - F.aceleracaoRe * dt); // quase parado: dá ré
    } else {
      // sem acelerar nem frear: o atrito leva a velocidade até 0
      const atrito = F.atritoSemAcelerar + (this.naGrama ? F.atritoGrama : 0);
      v = Math.sign(v) * Math.max(0, Math.abs(v) - atrito * dt);
    }
    dados.speed = v;

    // VOLANTE
    // Não vai direto para a posição pedida: anda no máximo
    // velocidadeVolante * dt por frame, para a curva ser suave
    const passoVolante = F.velocidadeVolante * dt;
    this.volante += THREE.MathUtils.clamp(direcional - this.volante, -passoVolante, passoVolante);

    // PULO E DRIFT
    this._atualizarPuloEDrift(dt, segurandoPulo, direcional, v);

    // GIRO DO KART 
    if (this.drift) {
      // No drift o kart sempre gira para o lado do drift. O direcional só
      // deixa a curva mais fechada (virando para o mesmo lado) ou mais
      // aberta (virando para o lado contrário)
      const lado = this.drift.lado;
      this.velocidadeGiro = lado * (F.giroDrift + F.controleDrift * this.volante * lado);
    } else {
      this.anguloRodas = this.volante * F.anguloMaximoRodas / (1 + Math.abs(v) / F.quedaDirecao);
      this.velocidadeGiro = v * Math.tan(this.anguloRodas) / this.entreEixos;
    }
    this.anguloNariz += this.velocidadeGiro * dt;

    // ADERÊNCIA
    //  A direção do movimento vai se aproximando da direção do nariz. Com aderência alta
    // isso é quase imediato. 
    const aderencia = this.drift ? F.aderenciaDrift : F.aderencia;
    this.anguloMovimento += diferencaAngulo(this.anguloNariz, this.anguloMovimento) * fatorSuavizacao(aderencia, dt);

    // MOVIMENTO NA PISTA E MURO
    this._moverNaPista(v, dt, metadePista);

    // VISUAL
    this._posicionarKart(dt);
    this._atualizarAlvoCamera(dt);
    this._soltarFaiscas();
    this.faiscas.atualizar(dt);
    this.racer.speed = dados.speed;

    // estado lido pelos outros sistemas 
    if (efeitos.atordoado > 0) dados.state = 'stunned';
    else if (efeitos.rodopio > 0) dados.state = 'spin';
    else if (efeitos.turbo > 0) dados.state = 'boost';
    else dados.state = 'normal';

    if (teclado.foiApertada('painelFisica')) this._alternarPainel();
    this._atualizarPainel(dt);
  }

  _atualizarPuloEDrift(dt, segurandoPulo, direcional, v) {
    const F = FISICA;
    const noChao = this.alturaPulo === 0 && this.velocidadeVertical === 0;
    const podeControlar = this.habilitado && this.efeitos.rodopio === 0 && this.efeitos.atordoado === 0;

    // apertou o pulo com o kart no chão: começa a subir
    if (noChao && podeControlar && this.teclado.foiApertada('pular')) {
      this.velocidadeVertical = F.velocidadePulo;
    }

    // No ar: lançamento vertical. A gravidade diminui a velocidade vertical
    // e a velocidade vertical muda a altura, até o kart voltar ao chão.
    if (this.velocidadeVertical !== 0 || this.alturaPulo > 0) {
      this.velocidadeVertical -= F.gravidade * dt;
      this.alturaPulo += this.velocidadeVertical * dt;

      if (this.alturaPulo <= 0) {
        this.alturaPulo = 0;
        this.velocidadeVertical = 0;
        // caiu ainda segurando o pulo, virando: drift
        if (segurandoPulo && direcional !== 0 && v > F.velocidadeMinimaDrift) {
          this.drift = { lado: Math.sign(direcional), carga: 0 };
        }
      }
    }

    if (!this.drift) return;

    if (!segurandoPulo) {
      // soltou o botão: ganha um mini-turbo, maior quanto mais tempo ficou no drift
      const nivel = this.nivelDrift;
      this.drift = null;
      if (nivel === 2) this.aplicarEfeito('boost', F.turboNivel2);
      if (nivel === 1) this.aplicarEfeito('boost', F.turboNivel1);
    } else if (v < F.velocidadeMinimaDrift * 0.7) {
      this.drift = null; // ficou devagar demais e o drift acaba sem turbo
    } else {
      this.drift.carga += dt;
    }
  }

  // 0 = faísca branca, 1 = azul, 2 = laranja
  get nivelDrift() {
    if (!this.drift) return 0;
    if (this.drift.carga >= FISICA.tempoNivel2) return 2;
    if (this.drift.carga >= FISICA.tempoNivel1) return 1;
    return 0;
  }

  _moverNaPista(v, dt, metadePista) {
    const F = FISICA;
    const dados = this.racer.userData;
    const curva = this.pista.path;

    // T e N no ponto atual da pista
    const tangente = curva.getTangentAt(dados.u).normalize();
    const lateral = new THREE.Vector3(-tangente.z, 0, tangente.x);

    const direcao = new THREE.Vector3(Math.sin(this.anguloMovimento), 0, Math.cos(this.anguloMovimento));
    const partePista = direcao.dot(tangente);
    const parteLado = direcao.dot(lateral);

    dados.u = (dados.u + (partePista * v * dt) / curva.getLength() + 1) % 1;
    dados.side += parteLado * v * dt;

    // MURO
    // O side não pode passar do muro. O limite é a borda do asfalto, mais
    // a distância até o muro, menos a metade da largura do kart.
    const limite = metadePista + F.distanciaMuro - this.meiaLargura;
    this.encostadoNoMuro = Math.abs(dados.side) > limite;
    if (!this.encostadoNoMuro) {
      this.empurrandoMuro = false;
      return;
    }
    dados.side = Math.sign(dados.side) * limite;

    // Quanto o kart está indo contra o muro: 1 = de frente, 0 = paralelo,
    // negativo = já está se afastando 
    const contraMuro = parteLado * Math.sign(dados.side) * Math.sign(v);
    if (contraMuro <= 0) {
      this.empurrandoMuro = false;
      return;
    }

    // Perde mais velocidade quanto mais de frente bater
    if (!this.empurrandoMuro) {
      dados.speed *= 1 - F.perdaBatida * contraMuro;
      this.drift = null;
    }
    // enquanto continua raspando na borda
    dados.speed *= Math.exp(-F.atritoMuro * contraMuro * dt);
    this.empurrandoMuro = true;

    // O muro desvia a direção do movimento para ficar paralela a ele
    const anguloMuro = Math.atan2(tangente.x, tangente.z) + (partePista < 0 ? Math.PI : 0);
    this.anguloMovimento += diferencaAngulo(anguloMuro, this.anguloMovimento) * fatorSuavizacao(10, dt);
  }

  // coloca o modelo do kart na posição e rotação calculadas e anima as peças
  _posicionarKart(dt = 0) {
    const dados = this.racer.userData;
    const curva = this.pista.path;
    const tangente = curva.getTangentAt(dados.u).normalize();
    const lateral = new THREE.Vector3(-tangente.z, 0, tangente.x);

    // posição = ponto da curva + N * side, mais a altura do pulo
    this.racer.position.copy(curva.getPointAt(dados.u)).addScaledVector(lateral, dados.side);
    this.racer.position.y = 0.01 + this.alturaPulo; // 0.01 = altura do asfalto

    const inclinacaoAlvo = THREE.MathUtils.clamp(
      dados.speed * this.velocidadeGiro * 0.004, -INCLINACAO_MAXIMA, INCLINACAO_MAXIMA);
    this.inclinacao += (inclinacaoAlvo - this.inclinacao) * fatorSuavizacao(8, dt);

    // Óleo e do casco: uma volta completa, rápida no começo e
    // devagar no fim (curva 1 - (1 - p)²). 
    let giroExtra = 0;
    const tempoRestante = Math.max(this.efeitos.rodopio, this.efeitos.atordoado);
    if (tempoRestante > 0) {
      const progresso = 1 - tempoRestante / this.duracaoGiro; // vai de 0 a 1
      giroExtra = (1 - (1 - progresso) * (1 - progresso)) * Math.PI * 2;
    }

    // Rotação em Y = para onde o kart aponta 
    // Rotação em Z = inclinação
    // Com rotation.x = 0, a ordem padrão aplica primeiro a inclinação
    // (no eixo do próprio kart) e depois o giro em Y
    this.racer.rotation.set(0, this.anguloNariz + giroExtra, this.inclinacao);

    // rodas da frente viram junto com o volante
    for (const roda of this.rodasDianteiras) roda.rotation.y = this.volante * ANGULO_RODAS_DIANTEIRAS;

    // O aro do volante é um TorusGeometry, cujo eixo é o Z local
    this.kart.steeringWheel.rotation.z = -this.volante * ANGULO_VOLANTE;
    this.kart.raioVolante.rotation.z = -this.volante * ANGULO_VOLANTE;
  }

  // a câmera acompanha a direção do movimento
  _atualizarAlvoCamera(dt) {
    this.anguloCamera += diferencaAngulo(this.anguloMovimento, this.anguloCamera) * fatorSuavizacao(6, dt);
    this.alvoCamera.position.copy(this.racer.position);
    this.alvoCamera.rotation.set(0, this.anguloCamera, 0);
  }

  // durante o drift, solta faíscas das rodas de trás
  _soltarFaiscas() {
    if (!this.drift || this.alturaPulo > 0) return;

    const nivel = this.nivelDrift;
    let cor = [1.0, 1.0, 0.8];                 // branca: ainda sem turbo
    if (nivel === 1) cor = [0.3, 0.6, 1.0];    // azul
    if (nivel === 2) cor = [1.0, 0.55, 0.1];   // laranja

    // converte um ponto do espaço do kart para o espaço do
    // mundo usando a matriz do objeto
    this.racer.updateMatrixWorld(true);
    for (const x of [-0.6, 0.6]) { // roda de trás esquerda e direita
      const origem = this.kart.localToWorld(new THREE.Vector3(x, 0.05, -0.6));
      // ponto para onde a faísca vai: para trás, para cima e um pouco para
      // fora
      const destino = this.kart.localToWorld(new THREE.Vector3(x * 3 + Math.random() - 0.5, 3, -4));
      const velocidade = destino.sub(origem);
      this.faiscas.emitir(origem, velocidade, cor, 0.3);
    }
  }

  // Painel da tecla F mostra os valores calculados em tempo real

  _criarPainel() {
    this.painel = document.createElement('div');
    Object.assign(this.painel.style, {
      position: 'fixed', bottom: '8px', left: '8px',
      padding: '8px 12px', background: 'rgba(0,0,0,0.6)', color: '#fff',
      font: '12px/1.5 monospace', zIndex: '5', pointerEvents: 'none',
      whiteSpace: 'pre', borderRadius: '4px', display: 'none',
    });
    document.body.appendChild(this.painel);
    this.tempoPainel = 0;
  }

  _alternarPainel() {
    const estilo = this.painel.style;
    estilo.display = estilo.display === 'none' ? 'block' : 'none';
  }

  _atualizarPainel(dt) {
    if (this.painel.style.display === 'none') return;
    // atualiza 10 vezes por segundo, senão os números mudam rápido demais para ler
    this.tempoPainel -= dt;
    if (this.tempoPainel > 0) return;
    this.tempoPainel = 0.1;

    const dados = this.racer.userData;
    const graus = THREE.MathUtils.radToDeg;
    const raioRoda = this.kart.wheelRadius * this.kart.scale.y;
    const escorregamento = graus(diferencaAngulo(this.anguloNariz, this.anguloMovimento));
    const textoDrift = this.drift
      ? `carga ${this.drift.carga.toFixed(2)} s (nível ${this.nivelDrift})`
      : '-';

    this.painel.textContent = [
      'FÍSICA DO KART  [F] esconde',
      `v (velocidade)       ${dados.speed.toFixed(2)} / ${this.velocidadeMaximaAtual.toFixed(1)} u/s`,
      `ω rodas = v/r        ${(dados.speed / raioRoda).toFixed(2)} rad/s`,
      `δ (ângulo das rodas) ${this.drift ? '- (drift)' : graus(this.anguloRodas).toFixed(1) + '°'}`,
      `ω giro = v·tanδ/L    ${this.velocidadeGiro.toFixed(2)} rad/s`,
      `escorregamento       ${escorregamento.toFixed(1)}°`,
      `u / side             ${dados.u.toFixed(4)} / ${dados.side.toFixed(2)}`,
      `chão                 ${this.naGrama ? 'grama/areia' : 'asfalto'}${this.encostadoNoMuro ? ' + muro' : ''}`,
      `altura do pulo       ${this.alturaPulo.toFixed(2)}`,
      `drift                ${textoDrift}`,
      `estado               ${dados.state}`,
    ].join('\n');
  }
}
