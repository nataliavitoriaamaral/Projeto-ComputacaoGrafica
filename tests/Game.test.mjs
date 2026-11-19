// Testes da lógica da corrida (Game.js). Rodar com: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STATES, formatTime } from '../src/gameplay/Game.js';

// storage falso, igual ao localStorage
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    raw: map,
  };
}

function makeRacer(name, u, isPlayer = false) {
  return { name, userData: { u, side: 0, speed: 0, isPlayer, displayName: name, state: 'normal' } };
}

// 4 pilotos nas vagas do grid (atrás da linha, u perto de 1), jogador na frente
function setup(storage = fakeStorage()) {
  const game = new Game({ storage });
  game.setTrack('t1', 480);
  const racers = [
    makeRacer('Mario', 0.99, true),
    makeRacer('Luigi', 0.985),
    makeRacer('Peach', 0.98),
    makeRacer('Bowser', 0.975),
  ];
  game.racers.push(...racers);
  return { game, racers, storage, player: racers[0] };
}

function startRace(game) {
  game.startCountdown();
  for (let i = 0; i < 4; i++) game.update(1.01);
  assert.equal(game.state, STATES.RACING);
}

// anda `distance` em voltas (1 = pista inteira) em passos pequenos
function drive(game, racer, distance, step = 0.002) {
  const sign = Math.sign(distance);
  let left = Math.abs(distance);
  while (left > 1e-9) {
    const d = Math.min(step, left);
    racer.userData.u = (racer.userData.u + sign * d + 1) % 1;
    left -= d;
    game.update(0.05);
  }
}

test('contagem 3-2-1-JÁ libera a corrida e emite eventos', () => {
  const { game } = setup();
  const values = [];
  game.on('countdown', (e) => values.push(e.value));
  let started = false;
  game.on('start', () => { started = true; });

  game.startCountdown();
  assert.equal(game.state, STATES.COUNTDOWN);
  game.update(0.5);
  assert.equal(game.state, STATES.COUNTDOWN);
  game.update(0.6);
  game.update(1.0);
  game.update(1.0);
  assert.equal(game.state, STATES.RACING);
  assert.deepEqual(values, [3, 2, 1, 0]);
  assert.ok(started);
  assert.ok(game.getHudData().goVisible);
});

test('cruzar a linha de largada pela primeira vez não conta volta', () => {
  const { game, player } = setup();
  startRace(game);
  drive(game, player, 0.05); // passa da linha (0.99 -> 0.04)
  assert.equal(player.userData.lap, 0);
  assert.equal(game.getHudData().lap, 1);
});

test('3 voltas completas terminam a corrida e geram vitória em 1º', () => {
  const { game, player } = setup();
  const laps = [];
  game.on('lap', (e) => laps.push(e.lap));
  let finishEvent = null;
  game.on('finish', (e) => { if (e.racer === player) finishEvent = e; });

  startRace(game);
  drive(game, player, 3.02); // da vaga (u=0.99) até completar 3 voltas
  assert.deepEqual(laps, [1, 2, 3]);
  assert.equal(game.state, STATES.FINISHED);
  assert.equal(finishEvent.position, 1);
  assert.ok(game.result.victory);
  assert.equal(game.result.position, 1);
  assert.equal(game.result.lapTimes.length, 3);
  assert.equal(game.result.breakdown.position, 1000);
});

test('terminar fora do 1º é derrota', () => {
  const { game, racers, player } = setup();
  startRace(game);
  const luigi = racers[1];
  drive(game, luigi, 3.02); // Luigi termina primeiro
  assert.equal(luigi.userData.position, 1);
  assert.equal(game.state, STATES.RACING); // a corrida só acaba quando o jogador termina
  drive(game, player, 3.02);
  assert.equal(game.state, STATES.FINISHED);
  assert.equal(game.result.victory, false);
  assert.equal(game.result.position, 2);
  assert.equal(game.result.ranking[0].name, 'Luigi');
  assert.equal(game.result.breakdown.position, 600);
});

test('andar de ré não adianta volta e dispara aviso de contramão', () => {
  const { game, player } = setup();
  const warnings = [];
  game.on('wrongWay', (e) => warnings.push(e.active));
  startRace(game);
  drive(game, player, -0.2); // vai para trás
  assert.ok(game.wrongWay);
  assert.deepEqual(warnings, [true]);
  drive(game, player, 0.3); // volta ao normal
  assert.equal(game.wrongWay, false);
  assert.equal(player.userData.lap, 0);
});

test('ir e voltar sobre a linha de chegada conta a volta uma vez só', () => {
  const { game, player } = setup();
  startRace(game);
  drive(game, player, 1.0); // de u=0.99 até u=0.99: ainda falta 0.01 para a linha
  assert.equal(player.userData.lap, 0);
  // vai e volta várias vezes em cima da linha
  for (let i = 0; i < 5; i++) {
    drive(game, player, 0.02);
    drive(game, player, -0.02);
  }
  assert.equal(player.userData.lap, 1);
});

test('cortar caminho (salto grande de u) é ignorado', () => {
  const { game, player } = setup();
  startRace(game);
  drive(game, player, 0.1);
  const lapBefore = player.userData.lap;
  player.userData.u = (player.userData.u + 0.6) % 1; // teleporte
  game.update(0.05);
  drive(game, player, 0.1);
  assert.equal(player.userData.lap, lapBefore);
  assert.ok(game.getStandings().indexOf(player) >= 0);
});

test('posição em tempo real segue o progresso', () => {
  const { game, racers, player } = setup();
  startRace(game);
  const [, luigi, peach, bowser] = racers;
  assert.equal(player.userData.position, 1);
  drive(game, bowser, 0.3);
  assert.equal(bowser.userData.position, 1);
  assert.equal(player.userData.position, 2);
  drive(game, peach, 0.5);
  assert.equal(peach.userData.position, 1);
  assert.equal(bowser.userData.position, 2);
  assert.equal(player.userData.position, 3);
  assert.equal(luigi.userData.position, 4);
});

test('pontuação: moedas, acertos, batidas e bônus; pontos só durante a corrida', () => {
  const { game, racers, player } = setup();
  // fora da corrida nada pontua
  game.emit('coin', { racer: player, coins: 1 });
  assert.equal(game.score, 0);

  startRace(game);
  game.emit('coin', { racer: player, coins: 1 });
  game.emit('coin', { racer: player, coins: 2 });
  game.emit('coin', { racer: racers[1], coins: 1 }); // moeda de rival não conta
  game.emit('itemHit', { attacker: player, target: racers[2], item: 'greenShell' });
  game.emit('itemHit', { attacker: racers[1], target: player, item: 'banana' }); // sofrer não pontua
  assert.equal(game.score, 2 * 10 + 100);

  game.emit('collision', { racer: player, other: racers[3] });
  game.emit('collision', { racer: player, other: racers[3] }); // mesma batida: cooldown
  assert.equal(game.collisions, 1);
  assert.equal(game.score, 120 - 25);

  game.emit('collision', { racer: racers[1], other: racers[2] }); // sem o jogador
  assert.equal(game.collisions, 1);

  for (let i = 0; i < 20; i++) game.update(0.05); // passa o cooldown (1 s)
  game.emit('collision', { a: racers[2], b: player });
  assert.equal(game.collisions, 2);

  drive(game, player, 3.02);
  const b = game.result.breakdown;
  assert.equal(b.coinCount, 2);
  assert.equal(b.itemHitCount, 1);
  assert.equal(b.penalty, 50);
  assert.equal(b.position, 1000);
  assert.equal(b.total, b.coins + b.itemHits + b.position + b.time - b.penalty);
  assert.equal(game.result.score, b.total);
});

test('pontuação nunca fica negativa', () => {
  const { game, player } = setup();
  startRace(game);
  game.emit('collision', { racer: player });
  assert.equal(game.getScoreBreakdown().total, -25);
  assert.equal(game.score, 0);
});

test('bônus de tempo: zero quando acima do tempo de referência', () => {
  const { game, player } = setup();
  startRace(game);
  game.raceTime = game.parTime + 100; // corrida lentíssima
  drive(game, player, 3.02, 0.002);
  assert.equal(game.result.breakdown.time, 0);
});

test('pausa congela o relógio e a contagem de voltas', () => {
  const { game, player } = setup();
  startRace(game);
  drive(game, player, 0.05);
  game.pause();
  assert.equal(game.state, STATES.PAUSED);
  const t = game.raceTime;
  player.userData.u = (player.userData.u + 0.01) % 1;
  game.update(1);
  assert.equal(game.raceTime, t);
  game.resume();
  assert.equal(game.state, STATES.RACING);
});

test('pausa só vale durante a corrida', () => {
  const { game } = setup();
  game.pause();
  assert.equal(game.state, STATES.MENU);
  game.startCountdown();
  game.pause();
  assert.equal(game.state, STATES.COUNTDOWN);
});

test('recorde é salvo, lido de novo e só sobe quando supera', () => {
  const storage = fakeStorage();
  let { game, player } = setup(storage);
  startRace(game);
  game.emit('coin', { racer: player, coins: 1 });
  drive(game, player, 3.02);
  assert.ok(game.result.newScoreRecord);
  assert.ok(game.result.newLapRecord);
  const saved = JSON.parse(storage.getItem('mariokart3d:recordes'));
  assert.equal(saved.t1.score, game.result.score);

  // nova sessão (recarregou a página): lê o recorde do storage
  const second = setup(storage);
  assert.equal(second.game.getRecord().score, saved.t1.score);
  startRace(second.game);
  drive(second.game, second.player, 3.02); // pontua menos: sem moeda
  assert.equal(second.game.result.newScoreRecord, false);
  assert.equal(second.game.getRecord().score, saved.t1.score);
});

test('recordes são separados por pista', () => {
  const { game, player } = setup();
  startRace(game);
  drive(game, player, 3.02);
  assert.ok(game.getRecord('t1').score > 0);
  assert.equal(game.getRecord('outra').score, 0);
});

test('storage quebrado ou bloqueado não derruba o jogo', () => {
  const broken = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('cheio'); },
  };
  const { game, player } = setup(broken);
  startRace(game);
  drive(game, player, 3.02);
  assert.equal(game.state, STATES.FINISHED);

  const garbage = { getItem: () => '{json quebrado', setItem() {} };
  const again = new Game({ storage: garbage });
  assert.equal(again.getRecord().score, 0);
});

test('reiniciar zera voltas, pontos e tempo', () => {
  const { game, racers, player } = setup();
  startRace(game);
  game.emit('coin', { racer: player, coins: 1 });
  drive(game, player, 1.5);
  racers.forEach((r, i) => { r.userData.u = 0.99 - i * 0.005; });
  game.startCountdown();
  assert.equal(game.score, 0);
  assert.equal(game.raceTime, 0);
  assert.equal(player.userData.lap, 0);
  assert.equal(game.result, null);
  for (let i = 0; i < 4; i++) game.update(1.01);
  drive(game, player, 3.02);
  assert.equal(game.state, STATES.FINISHED);
});

test('listener com erro não derruba os outros', () => {
  const { game } = setup();
  const original = console.error;
  console.error = () => {};
  let called = false;
  game.on('x', () => { throw new Error('boom'); });
  game.on('x', () => { called = true; });
  game.emit('x');
  console.error = original;
  assert.ok(called);
});

test('on devolve função para remover o listener', () => {
  const { game } = setup();
  let n = 0;
  const off = game.on('y', () => n++);
  game.emit('y');
  off();
  game.emit('y');
  assert.equal(n, 1);
});

test('formatTime', () => {
  assert.equal(formatTime(0), '00:00.00');
  assert.equal(formatTime(75.256), '01:15.26');
  assert.equal(formatTime(null), '--:--.--');
});
