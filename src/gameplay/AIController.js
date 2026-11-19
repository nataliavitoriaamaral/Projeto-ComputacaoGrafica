// Controle dos adversários com IA (Luigi, Peach e Bowser)

// A posição usa os mesmos dois números do PlayerController:
//   userData.u    - quanto do circuito já foi percorrido (0 = largada, 1 = volta completa)
//   userData.side - distância lateral até o centro da pista (positivo = direita)
//   posição = getPointAt(u) + N * side, com N = (-T.z, 0, T.x)

// A IA não tem volante nem aderência como o jogador: a cada frame ela escolhe
// uma velocidade alvo (menor nas curvas) e um side alvo, e vai se aproximando
// dos dois aos poucos. O side alvo é escolhido nesta ordem:
//   1. desviar de um obstáculo à frente
//   2. ultrapassar um piloto mais lento à frente
//   3. fechar o jogador que vem logo atrás (só em algumas dificuldades)
//   4. seguir a faixa preferida, puxando para o lado de dentro nas curvas

// Itens: o sistema de itens guarda o item do piloto em userData.item e
// recebe o pedido de uso em items.useItem(racer). Enquanto ele não for
// passado no construtor, a IA só não usa itens.

import * as THREE from 'three';

// Distância em unidades do Three.js, tempo em segundos e ângulos em radianos
export const AI_PHYSICS = {
  braking: 25,              // desaceleração quando chega numa curva rápido demais
  stopFriction: 8,          // desaceleração quando a IA está desligada

  // curvas
  cornerLookAhead: [6, 12, 18], // distâncias à frente usadas para medir a curva
  cornerEnter: 0.5,         // curva mais fechada que isso conta como "dentro da curva"
  cornerExit: 0.2,          // abaixo disso a curva acabou (e vem o mini-turbo)

  // movimento lateral
  steerSpeed: 5,            // quanto o side muda por segundo, no máximo
  edgeMargin: 1.2,          // distância mínima até a borda do asfalto
  obstacleWidth: 2.4,       // distância lateral para passar ao lado de um obstáculo
  laneChangeMin: 2,         // tempo mínimo até trocar de faixa sozinho
  laneChangeMax: 5,         // tempo máximo até trocar de faixa sozinho
  laneSpread: 0.6,          // as faixas sorteadas ficam em até 60% da meia largura

  // disputa com os outros pilotos
  overtakeDistance: 9,      // piloto à frente mais perto que isso pode ser ultrapassado
  overtakeWidth: 2.8,       // distância lateral para passar ao lado dele
  blockDistance: 10,        // jogador atrás mais perto que isso pode ser fechado

  // rubber banding
  rubberStart: 15,          // atrás do líder mais que isso, começa a acelerar mais
  rubberRange: 40,          // distância até chegar no bônus máximo

  // efeitos causados por colisões e itens (os mesmos tempos do jogador)
  spinDuration: 1.0,
  stunnedDuration: 1.3,
  stunnedJump: 6,           // o casco joga o kart para cima
  gravity: 30,
  boostFactor: 1.4,         // no turbo a velocidade máxima aumenta 40%
  boostAcceleration: 35,
};

// Personalidade de cada piloto. O jogador tem velocidade máxima 22 e aceleração 20
export const PERSONALITIES = {
  Luigi:  { maxSpeed: 21.5, acceleration: 15, racingLine: 0.6 }, // equilibrado
  Peach:  { maxSpeed: 20.5, acceleration: 24, racingLine: 0.8 }, // acelera rápido e fecha bem as curvas
  Bowser: { maxSpeed: 23.5, acceleration: 8,  racingLine: 0.3 }, // pesado: demora a acelerar, mas chega mais longe
};

// speedFactor      multiplica a velocidade máxima
// cornerSlowdown   quanto a velocidade cai na curva mais fechada
// obstacleDistance distância em que a IA enxerga um obstáculo
// rubberBonus      bônus máximo de velocidade de quem está muito atrás
// cornerBoost      duração do mini-turbo na saída da curva (0 = sem)
// blocking         se fecha o jogador que vem atrás
// itemDelay        quanto tempo ela segura o item antes de usar
export const DIFFICULTIES = {
  easy: {
    label: 'fácil', speedFactor: 0.85, cornerSlowdown: 0.5, obstacleDistance: 8,
    rubberBonus: 0.08, cornerBoost: 0, blocking: false, itemDelay: 4,
  },
  normal: {
    label: 'normal', speedFactor: 0.97, cornerSlowdown: 0.38, obstacleDistance: 12,
    rubberBonus: 0.15, cornerBoost: 0.5, blocking: false, itemDelay: 2,
  },
  hard: {
    label: 'difícil', speedFactor: 1.06, cornerSlowdown: 0.3, obstacleDistance: 16,
    rubberBonus: 0.2, cornerBoost: 0.9, blocking: true, itemDelay: 0.8,
  },
};

// valores só da parte visual
const FRONT_WHEEL_ANGLE = 0.45;
const STEERING_WHEEL_ANGLE = 0.6;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export class AIController {
  constructor({ racer, track, personality, difficulty = 'normal', obstacles = [], racers = [], items = null }) {
    this.racer = racer;
    this.kart = racer.kart;
    this.track = track;
    this.personality = PERSONALITIES[personality] ?? PERSONALITIES.Luigi;
    this.difficulty = difficulty;
    this.obstacles = obstacles; // lista de objetos com userData.u e userData.side
    this.racers = racers;       // todos os pilotos, para ultrapassar e para o rubber banding
    this.items = items;

    // começa parada; o main.js liga a corrida
    this.enabled = false;

    // Com 'YXZ', a roda primeiro rola no próprio eixo e depois vira
    this.frontWheels = this.kart.wheels.slice(0, 2);
    this.frontWheels.forEach((wheel) => { wheel.rotation.order = 'YXZ'; });

    racer.applyEffect = (type, duration) => this.applyEffect(type, duration);

    this.reset();
  }

  // Chamado quando a pista muda. O grid de largada já gravou o u e o side
  // da vaga do kart no userData
  setTrack(track) {
    this.track = track;
    this.reset();
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
  }

  // deixa o kart parado na vaga atual
  reset() {
    const data = this.racer.userData;
    data.speed = 0;
    data.state = 'normal';

    // a primeira faixa preferida é o side da vaga do grid
    this.preferredSide = data.side;
    this.targetSide = data.side;
    this.laneTimer = randomBetween(AI_PHYSICS.laneChangeMin, AI_PHYSICS.laneChangeMax);
    this.sideSpeed = 0;      // quanto o side está mudando por segundo

    this.sharpness = 0;      // quão fechada é a curva à frente (0 a 1)
    this.cornerSide = 0;     // lado de dentro da curva: 1 = direita, -1 = esquerda
    this.inCorner = false;

    this.overtaking = null;  // piloto que está sendo ultrapassado
    this.overtakeDirection = 0;

    this.jumpHeight = 0;
    this.verticalSpeed = 0;
    this.itemTimer = 0;

    // tempo que falta para cada efeito acabar (0 = desligado)
    this.effects = { spin: 0, stunned: 0, boost: 0 };
    this.spinDuration = 0;

    this._placeKart();
  }

  // mesma API do jogador: chamada por colisões com obstáculos e por itens
  applyEffect(type, duration) {
    const effects = this.effects;

    if (type === 'spin') {
      // óleo ou banana: o kart dá uma volta em torno de si mesmo
      effects.spin = this.spinDuration = duration ?? AI_PHYSICS.spinDuration;
      effects.boost = 0;
    } else if (type === 'stunned') {
      // casco: o kart é jogado para cima
      effects.stunned = this.spinDuration = duration ?? AI_PHYSICS.stunnedDuration;
      effects.boost = 0;
      this.verticalSpeed = AI_PHYSICS.stunnedJump;
    } else if (type === 'boost') {
      // cogumelo ou mini-turbo: se já estiver no turbo, fica com o maior tempo
      effects.boost = Math.max(effects.boost, duration ?? 1.0);
    } else {
      console.warn(`applyEffect: efeito desconhecido "${type}"`);
    }
  }

  // chamado uma vez por frame pelo main.js
  update(delta) {
    const dt = Math.min(delta, 1 / 20);
    const P = AI_PHYSICS;
    const data = this.racer.userData;
    const effects = this.effects;
    const difficulty = DIFFICULTIES[this.difficulty];

    // desconta o tempo dos efeitos ativos
    for (const name in effects) effects[name] = Math.max(0, effects[name] - dt);
    const lostControl = effects.spin > 0 || effects.stunned > 0;

    // CURVA À FRENTE E MINI-TURBO
    this._measureCorner();
    if (this.sharpness > P.cornerEnter) {
      this.inCorner = true;
    } else if (this.inCorner && this.sharpness < P.cornerExit) {
      // saiu da curva: ganha um mini-turbo, como o jogador depois do drift
      this.inCorner = false;
      if (this.enabled && !lostControl && difficulty.cornerBoost > 0) {
        this.applyEffect('boost', difficulty.cornerBoost);
      }
    }

    // VELOCIDADE MÁXIMA DO MOMENTO
    // personalidade x dificuldade x curva x rubber banding
    let maxSpeed = this.personality.maxSpeed * difficulty.speedFactor;
    maxSpeed *= 1 + this._rubberBandBonus(difficulty.rubberBonus);
    if (effects.boost > 0) maxSpeed *= P.boostFactor;
    const targetSpeed = maxSpeed * (1 - difficulty.cornerSlowdown * this.sharpness);

    // VELOCIDADE
    let v = data.speed;
    if (effects.stunned > 0) {
      v *= Math.exp(-6 * dt);   // freia
    } else if (effects.spin > 0) {
      v *= Math.exp(-1.5 * dt); // perdendo velocidade aos poucos
    } else if (!this.enabled) {
      v = Math.max(0, v - P.stopFriction * dt);
    } else if (effects.boost > 0) {
      // o turbo empurra o kart sozinho
      v = Math.min(v + P.boostAcceleration * dt, maxSpeed);
    } else if (v < targetSpeed) {
      // reta: acelera, cada vez menos conforme chega na velocidade máxima
      v += this.personality.acceleration * (1 - v / maxSpeed) * dt;
    } else {
      // curva fechada chegando: freia até a velocidade alvo
      v = Math.max(targetSpeed, v - P.braking * dt);
    }
    data.speed = v;

    // TROCA DE FAIXA
    // de tempos em tempos sorteia uma nova faixa preferida
    const limit = this.track.trackWidth / 2 - P.edgeMargin;
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      const spread = limit * P.laneSpread;
      this.preferredSide = randomBetween(-spread, spread);
      this.laneTimer = randomBetween(P.laneChangeMin, P.laneChangeMax);
    }
    if (this.enabled && !lostControl) this.targetSide = this._chooseSide(difficulty, limit);

    // O side vai até o alvo, mudando no máximo steerSpeed por segundo.
    // Parado, o kart não anda de lado
    const step = P.steerSpeed * Math.min(1, v / 5) * dt;
    const oldSide = data.side;
    data.side += THREE.MathUtils.clamp(this.targetSide - data.side, -step, step);
    this.sideSpeed = dt > 0 ? (data.side - oldSide) / dt : 0;

    // AVANÇA NA PISTA
    const length = this.track.path.getLength();
    data.u = (data.u + (v * dt) / length + 1) % 1;

    // PULO DO CASCO: lançamento vertical, igual ao do jogador
    if (this.verticalSpeed !== 0 || this.jumpHeight > 0) {
      this.verticalSpeed -= P.gravity * dt;
      this.jumpHeight += this.verticalSpeed * dt;
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0;
        this.verticalSpeed = 0;
      }
    }

    // ITENS
    if (this.enabled && !lostControl) this._useItem(dt, difficulty.itemDelay);

    // VISUAL
    this._placeKart();
    this.racer.speed = v;

    // estado lido pelos outros sistemas
    if (effects.stunned > 0) data.state = 'stunned';
    else if (effects.spin > 0) data.state = 'spin';
    else if (effects.boost > 0) data.state = 'boost';
    else data.state = 'normal';
  }

  // Distância ao longo da pista até outro ponto u. Como a pista é fechada,
  // o resultado fica entre -meia pista e +meia pista (negativo = atrás)
  _distanceTo(otherU) {
    const length = this.track.path.getLength();
    const diff = (otherU - this.racer.userData.u + 1.5) % 1 - 0.5;
    return diff * length;
  }

  // Mede quão fechada é a curva à frente, de 0 (reta) a 1 (curva de 90° ou
  // mais), e para que lado ela vira.
  // O ângulo entre a tangente atual e a tangente mais à frente sai do produto
  // escalar: cos(ângulo) = T1 · T2. E T2 · N diz o lado: positivo = direita
  _measureCorner() {
    const path = this.track.path;
    const length = path.getLength();
    const u = this.racer.userData.u;
    const tangent = path.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    this.sharpness = 0;
    for (const distance of AI_PHYSICS.cornerLookAhead) {
      const ahead = path.getTangentAt((u + distance / length) % 1).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(tangent.dot(ahead), -1, 1));
      const sharpness = Math.min(1, angle / (Math.PI / 2));
      if (sharpness > this.sharpness) {
        this.sharpness = sharpness;
        this.cornerSide = Math.sign(ahead.dot(normal));
      }
    }
  }

  // Quem está muito atrás do líder ganha um pouco de velocidade máxima
  _rubberBandBonus(maxBonus) {
    const P = AI_PHYSICS;
    let gapToLeader = 0;
    for (const other of this.racers) {
      if (other === this.racer) continue;
      gapToLeader = Math.max(gapToLeader, this._distanceTo(other.userData.u));
    }
    const amount = THREE.MathUtils.clamp((gapToLeader - P.rubberStart) / P.rubberRange, 0, 1);
    return maxBonus * amount;
  }

  // escolhe o side alvo na ordem descrita no começo do arquivo
  _chooseSide(difficulty, limit) {
    const P = AI_PHYSICS;
    const data = this.racer.userData;
    const clampSide = (side) => THREE.MathUtils.clamp(side, -limit, limit);

    // 1. OBSTÁCULO mais perto à frente que esteja na faixa do kart.
    // Compara com a faixa preferida, e não com o side alvo, senão o kart
    // ficaria trocando de lado a cada frame
    let obstacle = null;
    let obstacleDistance = difficulty.obstacleDistance;
    for (const other of this.obstacles) {
      if (!other.visible || other.userData.collisionDisabled) continue;
      const ahead = this._distanceTo(other.userData.u);
      const otherSide = other.userData.side;
      const sameLane = Math.abs(otherSide - this.preferredSide) < P.obstacleWidth
        || Math.abs(otherSide - data.side) < P.obstacleWidth;
      if (ahead > 0 && ahead < obstacleDistance && sameLane) {
        obstacleDistance = ahead;
        obstacle = other;
      }
    }
    if (obstacle) {
      // obstáculo à direita (side positivo): passa pela esquerda, e vice-versa
      const direction = obstacle.userData.side > 0 ? -1 : 1;
      return clampSide(obstacle.userData.side + direction * P.obstacleWidth);
    }

    // 2. ULTRAPASSAGEM. Enquanto o piloto ultrapassado estiver ao lado ou
    // logo à frente, a IA continua pelo mesmo lado
    if (this.overtaking) {
      const gap = this._distanceTo(this.overtaking.userData.u);
      if (gap < -3 || gap > P.overtakeDistance) this.overtaking = null;
    }
    if (!this.overtaking) {
      for (const other of this.racers) {
        if (other === this.racer) continue;
        const gap = this._distanceTo(other.userData.u);
        const sameLane = Math.abs(other.userData.side - data.side) < P.overtakeWidth;
        // só tenta passar quem não está mais rápido que ela
        const slower = (other.userData.speed ?? 0) <= data.speed + 1;
        if (gap > 0 && gap < P.overtakeDistance && sameLane && slower) {
          this.overtaking = other;
          // passa pelo lado com mais espaço
          this.overtakeDirection = other.userData.side > 0 ? -1 : 1;
          break;
        }
      }
    }
    if (this.overtaking) {
      return clampSide(this.overtaking.userData.side + this.overtakeDirection * P.overtakeWidth);
    }

    // 3. FECHAR O JOGADOR: se ele vem logo atrás, a IA entra na frente dele
    if (difficulty.blocking) {
      for (const other of this.racers) {
        if (!other.userData.isPlayer) continue;
        const gap = this._distanceTo(other.userData.u);
        if (gap < 0 && gap > -P.blockDistance) return clampSide(other.userData.side);
      }
    }

    // 4. FAIXA PREFERIDA. Na curva puxa para o lado de dentro, que é o
    // caminho mais curto. racingLine diz o quanto cada piloto faz isso
    const inside = this.cornerSide * limit;
    const amount = this.sharpness * this.personality.racingLine;
    return clampSide(THREE.MathUtils.lerp(this.preferredSide, inside, amount));
  }

  // usa o item depois de segurar por um tempo, que depende da dificuldade
  _useItem(dt, itemDelay) {
    const data = this.racer.userData;
    if (!this.items || !data.item) {
      this.itemTimer = itemDelay;
      return;
    }
    this.itemTimer -= dt;
    if (this.itemTimer <= 0) {
      this.items.useItem(this.racer);
      this.itemTimer = itemDelay;
    }
  }

  // coloca o modelo do kart na posição e rotação calculadas e anima as peças
  _placeKart() {
    const data = this.racer.userData;
    const path = this.track.path;
    const tangent = path.getTangentAt(data.u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    this.racer.position.copy(path.getPointAt(data.u)).addScaledVector(normal, data.side);
    this.racer.position.y = 0.01 + this.jumpHeight; // 0.01 = altura do asfalto

    // direção do movimento = T * velocidade + N * velocidade lateral
    // atan2(x, z) dá o ângulo em torno de Y de um vetor no plano XZ
    const direction = tangent.clone().multiplyScalar(Math.max(data.speed, 1))
      .addScaledVector(normal, this.sideSpeed);
    let angle = Math.atan2(direction.x, direction.z);

    // Óleo e casco: uma volta completa, rápida no começo e
    // devagar no fim (curva 1 - (1 - p)²)
    const timeLeft = Math.max(this.effects.spin, this.effects.stunned);
    if (timeLeft > 0) {
      const progress = 1 - timeLeft / this.spinDuration; // vai de 0 a 1
      angle += (1 - (1 - progress) * (1 - progress)) * Math.PI * 2;
    }
    this.racer.rotation.set(0, angle, 0);

    // rodas da frente e volante viram para o lado em que o kart está indo.
    // side positivo é a direita, e o volante positivo vira para a esquerda
    const steer = THREE.MathUtils.clamp(-this.sideSpeed / AI_PHYSICS.steerSpeed, -1, 1);
    for (const wheel of this.frontWheels) wheel.rotation.y = steer * FRONT_WHEEL_ANGLE;
    this.kart.steeringWheel.rotation.z = -steer * STEERING_WHEEL_ANGLE;
    if (this.kart.raioVolante) this.kart.raioVolante.rotation.z = -steer * STEERING_WHEEL_ANGLE;
  }
}
