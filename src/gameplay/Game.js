// Regras da corrida (Membro 5): estados do jogo, eventos, contagem
// regressiva, voltas com checkpoints, posição, pontuação e recorde.
//
// Este arquivo não mexe no DOM nem no Three.js, só lê o userData dos pilotos.
// O desenho na tela fica em src/ui/HUD.js e a ligação com o resto, no main.js.
//
// ESTADOS
//   menu       tela inicial, karts parados
//   countdown  3, 2, 1, JÁ! com os karts parados
//   racing     corrida valendo
//   paused     Esc: tudo congelado (o main.js para de atualizar os sistemas)
//   finished   o jogador terminou as voltas: tela de vitória ou derrota
//
// CONTRATO COMBINADO COM O GRUPO
//   racer.userData: u, side, speed, lap, isPlayer, state
//     Quem escreve u, side, speed e state são os controllers. Este arquivo
//     escreve lap (voltas COMPLETAS, de 0 a totalLaps) e position (1 a 4).
//   game.emit(evento, dados) e game.on(evento, fn). Eventos:
//     coin      { racer, coins }                (Items.js)      + pontos
//     itemHit   { attacker, target, item }      (Items.js)      + pontos
//     collision { racer, other?, kind? }        (Collision.js)  - pontos
//     lap       { racer, lap, lapTime, best }   (Game.js)
//     finish    { racer, position, time }       (Game.js)
//   Eventos extras do Game: state, countdown, start, record, wrongWay.

export const STATES = {
  MENU: 'menu',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

// Tempo em segundos, pontos em pontos
export const GAME_CONFIG = {
  totalLaps: 3,
  checkpoints: 8,          // a pista é dividida em 8 trechos; o último é a linha de chegada
  countdownSteps: 3,       // 3, 2, 1
  countdownStepTime: 1,
  goDisplayTime: 1,        // quanto tempo o "JÁ!" fica na tela depois da largada

  // pontuação
  pointsPerCoin: 10,
  pointsPerItemHit: 100,
  penaltyPerCollision: 25,
  collisionCooldown: 0.8,  // várias colisões seguidas na mesma batida contam uma vez
  positionBonus: [1000, 600, 300, 100], // 1º, 2º, 3º e 4º lugar
  timeBonusPerSecond: 10,  // por segundo abaixo do tempo de referência
  parSpeed: 16,            // velocidade média de referência (u/s) para o tempo de referência

  // detecção de erros de percurso
  maxJumpPerFrame: 0.25,   // salto de u maior que isso (de 0 a 1) não é movimento: ignorado
  wrongWayTime: 0.7,       // segundos andando no sentido contrário para avisar

  storageKey: 'mariokart3d:recordes',
};

// localStorage pode não existir (testes) ou estar bloqueado (navegação privada)
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// diferença de u entre dois frames, entre -0.5 e 0.5 (a pista é um circuito fechado)
function deltaU(current, previous) {
  return ((current - previous + 1.5) % 1) - 0.5;
}

export function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--.--';
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
}

export class Game {
  constructor({ storage = defaultStorage(), config = {} } = {}) {
    this.config = { ...GAME_CONFIG, ...config };
    this.storage = storage;

    this.state = STATES.MENU;
    this._listeners = {};

    // lista viva de pilotos: o main.js adiciona aos poucos, conforme os modelos carregam
    this.racers = [];
    this._records = new Map(); // racer -> dados da corrida de cada piloto

    this.trackId = 'default';
    this.trackLength = 400;

    this._loadRecords();
    this._resetRaceData();

    // pontuação reage aos eventos de quem for emitindo (Items.js, Collision.js)
    this.on('coin', (data) => this._onCoin(data));
    this.on('itemHit', (data) => this._onItemHit(data));
    this.on('collision', (data) => this._onCollision(data));
  }

  // ------------------------------------------------------------ eventos

  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return;
    const index = list.indexOf(fn);
    if (index >= 0) list.splice(index, 1);
  }

  emit(event, data = {}) {
    // copia a lista: um listener pode se remover durante a chamada
    for (const fn of [...(this._listeners[event] ?? [])]) {
      try {
        fn(data);
      } catch (error) {
        // um listener com erro não pode derrubar o loop do jogo
        console.error(`erro no listener de "${event}":`, error);
      }
    }
  }

  // lista viva de pilotos: o main.js passa o mesmo array que ele vai enchendo
  setRacers(racers) {
    this.racers = racers;
    this._resetRaceData();
  }

  // ------------------------------------------------------------- pista

  // chamado pelo main.js a cada troca de pista
  setTrack(trackId, trackLength) {
    this.trackId = trackId;
    this.trackLength = trackLength;
  }

  // tempo de referência: quanto um piloto razoável leva para as voltas inteiras
  get parTime() {
    return (this.config.totalLaps * this.trackLength) / this.config.parSpeed;
  }

  // ------------------------------------------------- mudança de estado

  _setState(next) {
    if (this.state === next) return;
    const previous = this.state;
    this.state = next;
    this.emit('state', { state: next, previous });
  }

  openMenu() {
    this._resetRaceData();
    this._setState(STATES.MENU);
  }

  // começa (ou recomeça) a corrida: zera tudo e inicia a contagem regressiva.
  // O main.js recoloca os karts no grid antes de chamar.
  startCountdown() {
    this._resetRaceData();
    this.countdownValue = this.config.countdownSteps;
    this._countdownTimer = this.config.countdownStepTime;
    this._setState(STATES.COUNTDOWN);
    this.emit('countdown', { value: this.countdownValue });
  }

  pause() {
    if (this.state === STATES.RACING) this._setState(STATES.PAUSED);
  }

  resume() {
    if (this.state === STATES.PAUSED) this._setState(STATES.RACING);
  }

  togglePause() {
    if (this.state === STATES.RACING) this.pause();
    else if (this.state === STATES.PAUSED) this.resume();
  }

  get isRacing() {
    return this.state === STATES.RACING;
  }

  // ------------------------------------------------------------ dados

  _resetRaceData() {
    this.raceTime = 0;
    this.goTimer = 0;
    this.countdownValue = 0;
    this._countdownTimer = 0;
    this._finishCount = 0;

    // pontuação do jogador
    this.coinsCollected = 0;
    this.itemHits = 0;
    this.collisions = 0;
    this._collisionCooldown = 0;
    this.positionBonus = 0;
    this.timeBonus = 0;

    this.wrongWay = false;
    this._wrongWayTimer = 0;
    this.result = null;

    this._records.clear();
    for (const racer of this.racers) this._initRacer(racer);
  }

  // dados de corrida de um piloto. Ficam aqui, e não no userData, para não
  // misturar com o que os controllers escrevem
  _initRacer(racer) {
    const data = racer.userData;
    const u = data.u ?? 0;
    const record = {
      prevU: u,
      // progresso contínuo em voltas. Os karts largam atrás da linha (u perto
      // de 1), então o progresso começa um pouco abaixo de zero e a primeira
      // passagem pela linha NÃO conta como volta
      total: u - 1,
      lap: 0,                // voltas completas
      nextCheckpoint: 1,     // 1..checkpoints; o último é a linha de chegada
      lapStart: 0,
      lapTimes: [],
      bestLap: null,
      finished: false,
      finishTime: null,
      finishOrder: null,
    };
    this._records.set(racer, record);
    data.lap = 0;
    data.position = 1;
    return record;
  }

  _recordOf(racer) {
    return this._records.get(racer) ?? this._initRacer(racer);
  }

  get player() {
    return this.racers.find((r) => r.userData.isPlayer) ?? null;
  }

  // ----------------------------------------------------- atualização

  // chamado uma vez por frame pelo main.js, com o delta real (sem limite)
  update(delta) {
    switch (this.state) {
      case STATES.COUNTDOWN:
        this._updateCountdown(delta);
        break;
      case STATES.RACING:
        this._updateRace(Math.min(delta, 1 / 20));
        break;
      case STATES.FINISHED:
        // o "JÁ!" some sozinho mesmo se o jogador terminar rápido demais
        this.goTimer = Math.max(0, this.goTimer - delta);
        break;
      default:
        break; // menu e pausa: nada anda
    }
  }

  _updateCountdown(delta) {
    this._countdownTimer -= delta;
    if (this._countdownTimer > 0) return;

    this.countdownValue -= 1;
    if (this.countdownValue > 0) {
      this._countdownTimer += this.config.countdownStepTime;
      this.emit('countdown', { value: this.countdownValue });
      return;
    }

    // JÁ!: libera os karts
    this.countdownValue = 0;
    this.goTimer = this.config.goDisplayTime;
    for (const racer of this.racers) {
      const record = this._recordOf(racer);
      record.prevU = racer.userData.u ?? 0;
    }
    this._setState(STATES.RACING);
    this.emit('countdown', { value: 0 });
    this.emit('start', {});
  }

  _updateRace(dt) {
    this.raceTime += dt;
    this.goTimer = Math.max(0, this.goTimer - dt);
    this._collisionCooldown = Math.max(0, this._collisionCooldown - dt);

    for (const racer of this.racers) this._trackProgress(racer, dt);

    this._updatePositions();
  }

  // progresso, checkpoints e voltas de um piloto
  _trackProgress(racer, dt) {
    const record = this._recordOf(racer);
    if (record.finished) return;

    const cfg = this.config;
    const data = racer.userData;
    const du = deltaU(data.u ?? record.prevU, record.prevU);
    record.prevU = data.u ?? record.prevU;

    // um salto grande de u não é movimento (troca de pista, teleporte): ignora
    if (Math.abs(du) < cfg.maxJumpPerFrame) record.total += du;

    // sentido contrário: só avisa o jogador. O progresso diminui junto, então
    // andar de ré nunca adianta a volta
    if (data.isPlayer) this._updateWrongWay(du, data, dt);

    // CHECKPOINTS. O checkpoint k fica em lap + k/N. Só passa para o próximo
    // quando o anterior já foi passado, então cortar caminho ou ir e voltar
    // na linha de chegada não conta volta. Com vários checkpoints no mesmo
    // frame (lag), o while passa por todos em ordem
    while (record.total >= record.lap + record.nextCheckpoint / cfg.checkpoints) {
      if (record.nextCheckpoint < cfg.checkpoints) {
        record.nextCheckpoint += 1;
        continue;
      }
      this._completeLap(racer, record);
      if (record.finished) break;
    }
  }

  _completeLap(racer, record) {
    const lapTime = this.raceTime - record.lapStart;
    record.lapStart = this.raceTime;
    record.lap += 1;
    record.nextCheckpoint = 1;
    record.lapTimes.push(lapTime);

    const best = record.bestLap === null || lapTime < record.bestLap;
    if (best) record.bestLap = lapTime;
    racer.userData.lap = record.lap;

    this.emit('lap', { racer, lap: record.lap, lapTime, best });

    if (record.lap >= this.config.totalLaps) this._finishRacer(racer, record);
  }

  _finishRacer(racer, record) {
    record.finished = true;
    record.finishTime = this.raceTime;
    this._finishCount += 1;
    record.finishOrder = this._finishCount;
    racer.userData.position = record.finishOrder;

    this.emit('finish', { racer, position: record.finishOrder, time: record.finishTime });

    // a corrida do jogador acaba quando ELE termina: quem ainda não terminou
    // está atrás dele, então a posição dele é a ordem de chegada
    if (racer.userData.isPlayer) this._finishRace(racer, record);
  }

  _updateWrongWay(du, data, dt) {
    // negativo = u diminuindo = indo para trás na pista
    const goingBack = du < -1e-5 || (data.speed ?? 0) < -0.5;
    if (goingBack) this._wrongWayTimer = Math.min(this._wrongWayTimer + dt, this.config.wrongWayTime * 2);
    else this._wrongWayTimer = Math.max(0, this._wrongWayTimer - dt * 2);

    const now = this._wrongWayTimer > this.config.wrongWayTime;
    if (now !== this.wrongWay) {
      this.wrongWay = now;
      this.emit('wrongWay', { active: now });
    }
  }

  // ---------------------------------------------------------- posição

  // quem já terminou vem primeiro (pela ordem de chegada); os outros, pelo
  // progresso na pista
  getStandings() {
    return [...this.racers].sort((a, b) => {
      const ra = this._recordOf(a);
      const rb = this._recordOf(b);
      if (ra.finished && rb.finished) return ra.finishOrder - rb.finishOrder;
      if (ra.finished) return -1;
      if (rb.finished) return 1;
      return rb.total - ra.total;
    });
  }

  _updatePositions() {
    this.getStandings().forEach((racer, index) => {
      racer.userData.position = index + 1;
    });
  }

  // ------------------------------------------------------ pontuação

  _isPlayer(racer) {
    return !!racer?.userData?.isPlayer;
  }

  _scoringActive() {
    return this.state === STATES.RACING;
  }

  _onCoin({ racer }) {
    if (!this._scoringActive() || !this._isPlayer(racer)) return;
    this.coinsCollected += 1;
  }

  _onItemHit({ attacker }) {
    if (!this._scoringActive() || !this._isPlayer(attacker)) return;
    this.itemHits += 1;
  }

  // O Collision.js pode mandar o jogador em racer, other, a, b, target ou
  // attacker. Qualquer batida em que o jogador participa custa pontos
  _onCollision(data = {}) {
    if (!this._scoringActive()) return;
    const involved = [data.racer, data.other, data.a, data.b, data.target, data.attacker];
    if (!involved.some((r) => this._isPlayer(r))) return;
    if (this._collisionCooldown > 0) return;
    this._collisionCooldown = this.config.collisionCooldown;
    this.collisions += 1;
  }

  // pontuação em tempo real (os bônus de posição e de tempo só entram no fim)
  get score() {
    return Math.max(0, this.getScoreBreakdown().total);
  }

  getScoreBreakdown() {
    const cfg = this.config;
    const coins = this.coinsCollected * cfg.pointsPerCoin;
    const hits = this.itemHits * cfg.pointsPerItemHit;
    const penalty = this.collisions * cfg.penaltyPerCollision;
    return {
      coinCount: this.coinsCollected,
      itemHitCount: this.itemHits,
      collisionCount: this.collisions,
      coins,
      itemHits: hits,
      position: this.positionBonus,
      time: this.timeBonus,
      penalty,
      total: coins + hits + this.positionBonus + this.timeBonus - penalty,
    };
  }

  // ------------------------------------------------------- fim e recorde

  _finishRace(player, record) {
    const cfg = this.config;
    const position = record.finishOrder;

    this.positionBonus = cfg.positionBonus[position - 1] ?? 0;
    const secondsUnderPar = Math.max(0, this.parTime - record.finishTime);
    this.timeBonus = Math.round(secondsUnderPar) * cfg.timeBonusPerSecond;

    const breakdown = this.getScoreBreakdown();
    const finalScore = Math.max(0, breakdown.total);

    // ranking final: quem já terminou, depois os outros por progresso
    const ranking = this.getStandings().map((racer, index) => {
      const r = this._recordOf(racer);
      return {
        name: racer.userData.displayName ?? racer.name ?? `Piloto ${index + 1}`,
        isPlayer: this._isPlayer(racer),
        position: index + 1,
        finished: r.finished,
        time: r.finishTime,
      };
    });

    const records = this._saveRecord(finalScore, record);

    this.result = {
      victory: position === 1,
      position,
      time: record.finishTime,
      bestLap: record.bestLap,
      lapTimes: [...record.lapTimes],
      score: finalScore,
      breakdown,
      ranking,
      newScoreRecord: records.newScoreRecord,
      newLapRecord: records.newLapRecord,
      record: records.current,
    };

    this._setState(STATES.FINISHED);
    if (records.newScoreRecord || records.newLapRecord) this.emit('record', this.result);
  }

  // ------------------------------------------------------------ recordes

  _loadRecords() {
    this._allRecords = {};
    try {
      const text = this.storage?.getItem(this.config.storageKey);
      if (text) this._allRecords = JSON.parse(text) ?? {};
    } catch {
      this._allRecords = {}; // JSON quebrado ou storage bloqueado: começa do zero
    }
  }

  _saveRecord(score, record) {
    const previous = this._allRecords[this.trackId] ?? { score: 0, bestLap: null };
    const newScoreRecord = score > previous.score;
    const newLapRecord = record.bestLap !== null
      && (previous.bestLap === null || record.bestLap < previous.bestLap);

    const current = {
      score: newScoreRecord ? score : previous.score,
      bestLap: newLapRecord ? record.bestLap : previous.bestLap,
    };
    this._allRecords[this.trackId] = current;
    try {
      this.storage?.setItem(this.config.storageKey, JSON.stringify(this._allRecords));
    } catch {
      // sem espaço ou bloqueado: o recorde vale só até fechar a página
    }
    return { newScoreRecord, newLapRecord, current };
  }

  // recorde da pista atual (ou da pista indicada)
  getRecord(trackId = this.trackId) {
    return this._allRecords[trackId] ?? { score: 0, bestLap: null };
  }

  // ------------------------------------------------- dados para o HUD

  // tudo que o HUD mostra durante a corrida, num objeto só
  getHudData() {
    const player = this.player;
    const record = player ? this._recordOf(player) : null;
    const cfg = this.config;
    return {
      state: this.state,
      lap: record ? Math.min(record.lap + 1, cfg.totalLaps) : 1,
      totalLaps: cfg.totalLaps,
      position: player?.userData.position ?? 1,
      totalRacers: this.racers.length,
      raceTime: this.raceTime,
      lapTime: record ? this.raceTime - record.lapStart : 0,
      bestLap: record?.bestLap ?? null,
      score: this.score,
      coins: Math.min(player?.userData.coins ?? 0, 10), // moedas ativas (bônus de velocidade)
      coinsCollected: this.coinsCollected,
      countdownValue: this.countdownValue,
      goVisible: this.goTimer > 0,
      wrongWay: this.wrongWay,
    };
  }
}
