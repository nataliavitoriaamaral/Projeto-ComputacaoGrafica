// Itens e coletáveis: moedas, caixas de item com roleta, cogumelo, casco
// verde e banana.
//
// Tudo na pista é posicionado com os mesmos dois números dos karts:
//   u    - quanto do circuito já foi percorrido (0 = largada, 1 = volta completa)
//   side - distância lateral até o centro da pista (positivo = direita)
//   posição = getPointAt(u) + N * side, com N = (-T.z, 0, T.x)
//
// A detecção é por proximidade: cada objeto tem um raio e, a cada frame,
// comparamos a distância no plano XZ entre ele e cada kart (uma esfera
// envolvente "achatada", que ignora a altura). Usamos a distância ao
// quadrado para não precisar de raiz quadrada.
//
// O que fica no userData de cada piloto:
//   coins       - moedas atuais, de 0 a 10 (o PlayerController usa para a
//                 velocidade máxima)
//   item        - item guardado: 'mushroom', 'greenShell', 'banana' ou null
//   itemRoulette - enquanto a roleta gira: { timeLeft, display }; senão null
//
// API usada pelos outros sistemas:
//   items.use(racer)       usa o item guardado (jogador e IA)
//   items.useItem(racer)   o mesmo, com o nome que o AIController chama
//   items.update(delta)    uma vez por frame, depois que os karts andaram
//   items.setTrack(track)  ao trocar de pista
//   items.reset()          ao reiniciar a corrida
//   items.getItemInfo(racer) para o HUD mostrar o item atual
//
// Eventos (game.emit), além do items.on(evento, fn) local:
//   coin      { racer, coins }                moeda coletada (vale pontos)
//   itemHit   { attacker, target, item }      item acertou um rival (vale pontos)
//   itemPickup { racer, item }                roleta terminou
//   itemUse   { racer, item }                 item usado (para sons, por exemplo)

import * as THREE from 'three';
import { createCoin } from '../objects/Coin.js';
import { createItemBox } from '../objects/ItemBox.js';
import { createGreenShell } from '../objects/GreenShell.js';
import { createBanana } from '../objects/Banana.js';
import { ParticulasKart } from './ParticulasKart.js';
import { disposeObject } from '../utils/dispose.js';

// nome e ícone de cada item, para a roleta e o HUD
export const ITEM_TYPES = {
  mushroom:   { label: 'Cogumelo',    icon: '🍄' },
  greenShell: { label: 'Casco verde', icon: '🐢' },
  banana:     { label: 'Banana',      icon: '🍌' },
};
const ITEM_NAMES = Object.keys(ITEM_TYPES);

// Distância em unidades do Three.js e tempo em segundos
export const ITEM_RULES = {
  // moedas
  maxCoins: 10,            // limite combinado com o PlayerController
  coinRadius: 1.3,         // distância para pegar a moeda
  coinHeight: 0.8,
  coinSpacing: 2.5,        // distância entre moedas de uma fileira
  coinRespawn: 10,         // segundos até a moeda voltar
  coinsLostOnHit: 1,       // moedas perdidas ao ser acertado por um item

  // caixas de item
  boxRadius: 1.4,
  boxHeight: 1,
  boxRespawn: 3,           // segundos até a caixa voltar
  rouletteTime: 1.8,       // tempo da roleta girando
  rouletteStep: 0.08,      // a roleta troca de ícone a cada 0.08 s

  // cogumelo
  mushroomBoost: 1.5,      // duração do turbo

  // casco verde
  shellSpeed: 42,          // mais rápido que qualquer kart, mesmo no turbo
  shellRadius: 1.3,
  shellLife: 7,            // segundos até sumir sozinho
  shellMaxBounces: 6,      // quicadas no muro antes de quebrar
  shellOwnerGrace: 0.5,    // segundos em que o casco não acerta quem atirou
  shellSpawnDistance: 2.2, // nasce na frente do kart
  // do fim do asfalto até onde o casco quica: o muro fica a 1.8, tem meia
  // espessura de 0.25 e o casco tem raio 0.4
  wallDistance: 1.15,

  // banana
  bananaRadius: 1.1,
  bananaDropDistance: 2.2, // fica atrás do kart
  bananaOwnerGrace: 0.8,
  bananaJumpClear: 0.2,    // kart pulando acima dessa altura passa por cima
  maxBananas: 8,           // a mais antiga some quando passar disso

  // altura máxima do kart para ser atingido (acima disso está voando)
  hitMaxHeight: 1.2,
};

// fileiras de moedas: começo (u), lado e quantidade. Ficam longe das
// caixas (u = 0.15 e 0.55) e dos obstáculos do main.js
const COIN_ROWS = [
  { u: 0.03, side: 0,    count: 5 },
  { u: 0.19, side: 2.5,  count: 4 },
  { u: 0.27, side: 1.5,  count: 4 },
  { u: 0.34, side: -2,   count: 4 },
  { u: 0.44, side: 2.5,  count: 4 },
  { u: 0.60, side: -2.5, count: 4 },
  { u: 0.69, side: 0,    count: 4 },
  { u: 0.80, side: -2,   count: 5 },
  { u: 0.92, side: 1.5,  count: 4 },
];

// fileiras de caixas: a mesma posição que já era usada no main.js
const BOX_ROWS = [0.15, 0.55];
const BOX_SIDES = [-3, 0, 3];

// vetores reaproveitados em todo frame, para não criar lixo
const _T = new THREE.Vector3();
const _N = new THREE.Vector3();
const _P = new THREE.Vector3();

// tangente T e lateral N da pista no ponto u
function frameAt(path, u, T, N) {
  path.getTangentAt(u, T);
  T.y = 0;
  T.normalize();
  N.set(-T.z, 0, T.x);
}

// distância ao quadrado no plano XZ
function distXZSq(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

// direção para onde o kart aponta. O kart olha para +Z e o Racer gira em Y
function forwardOf(racer) {
  const a = racer.rotation.y;
  return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
}

function isOutOfControl(racer) {
  const state = racer.userData.state;
  return state === 'spin' || state === 'stunned';
}

export class Items {
  constructor({ scene, track, racers, obstacles = [], game = null, showSlot = true }) {
    this.scene = scene;
    this.racers = racers;       // a mesma lista do main.js (os pilotos chegam aos poucos)
    this.obstacles = obstacles; // as bananas entram aqui para a IA desviar
    this.game = game;           // Game.js do Membro 5; pode ser passado depois

    this.coins = [];
    this.boxes = [];
    this.shells = [];
    this.bananas = [];
    this._listeners = {};
    this.time = 0;

    // reaproveita as partículas do drift para o brilho da moeda e da caixa
    this.particles = new ParticulasKart(600);
    scene.add(this.particles);

    // quadradinho do item do jogador, até o HUD do Membro 5 existir
    this.slot = showSlot ? this._createSlot() : null;
    this._slotText = '';

    this.setTrack(track);
  }

  // ---------------------------------------------------------------- API

  setTrack(track) {
    this.track = track;
    this._clearAll();
    this._buildCoins();
    this._buildBoxes();
    this._resetRacers();
  }

  // reinicia a corrida na mesma pista
  reset() {
    this.setTrack(this.track);
  }

  // usa o item guardado. Devolve true se algo foi usado
  use(racer) {
    const data = racer.userData;
    const type = data.item;
    if (!type || isOutOfControl(racer)) return false;

    data.item = null;
    if (type === 'mushroom') {
      racer.applyEffect?.('boost', ITEM_RULES.mushroomBoost);
    } else if (type === 'greenShell') {
      this._fireShell(racer);
    } else if (type === 'banana') {
      this._dropBanana(racer);
    }
    this._emit('itemUse', { racer, item: type });
    return true;
  }

  // nome usado pelo AIController
  useItem(racer) {
    return this.use(racer);
  }

  // o que o HUD deve mostrar: o item guardado ou o ícone atual da roleta
  getItemInfo(racer) {
    const data = racer.userData;
    if (data.itemRoulette) {
      return { item: null, rolling: true, ...ITEM_TYPES[data.itemRoulette.display] };
    }
    if (data.item) return { item: data.item, rolling: false, ...ITEM_TYPES[data.item] };
    return { item: null, rolling: false, label: '', icon: '' };
  }

  // eventos locais, úteis enquanto o Game.js não existe (sons, testes)
  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
  }

  update(delta) {
    const dt = Math.min(delta, 1 / 20);
    this.time += dt;

    for (const racer of this.racers) {
      const data = racer.userData;
      data.coins ??= 0;
      data.item ??= null;
      data.itemRoulette ??= null;
    }

    this._updateCoins(dt);
    this._updateBoxes(dt);
    this._updateRoulettes(dt);
    this._updateShells(dt);
    this._updateBananas(dt);
    this.particles.atualizar(dt);
    this._updateSlot();
  }

  dispose() {
    this._clearAll();
    this.scene.remove(this.particles);
    this.particles.descartar();
    this.slot?.remove();
  }

  // ------------------------------------------------------------ montagem

  // ponto do mundo a partir de u, side e altura
  _trackPoint(u, side, height, out) {
    const path = this.track.path;
    frameAt(path, u, _T, _N);
    path.getPointAt(u, out).addScaledVector(_N, side);
    out.y = height;
    return out;
  }

  // coloca um objeto na pista a partir de u e side
  _placeOnTrack(object, u, side, height) {
    this._trackPoint(u, side, height, object.position);
  }

  _buildCoins() {
    const length = this.track.path.getLength();
    // as pistas mais largas espalham as moedas na mesma proporção
    const sideScale = this.track.trackWidth / 12;

    for (const row of COIN_ROWS) {
      for (let i = 0; i < row.count; i++) {
        const u = (row.u + (i * ITEM_RULES.coinSpacing) / length) % 1;
        const mesh = createCoin();
        this._placeOnTrack(mesh, u, row.side * sideScale, ITEM_RULES.coinHeight);
        this.scene.add(mesh);
        // phase faz as moedas da fileira subirem e descerem em onda
        this.coins.push({ mesh, active: true, timer: 0, phase: i * 0.6 });
      }
    }
  }

  _buildBoxes() {
    const sideScale = this.track.trackWidth / 12;
    for (const u of BOX_ROWS) {
      for (const side of BOX_SIDES) {
        const mesh = createItemBox();
        this._placeOnTrack(mesh, u, side * sideScale, ITEM_RULES.boxHeight);
        this.scene.add(mesh);
        this.boxes.push({ mesh, active: true, timer: 0, appear: 1 });
      }
    }
  }

  _clearAll() {
    // moedas, cascos e bananas compartilham geometria e material: só saem da cena
    this.coins.forEach((c) => this.scene.remove(c.mesh));
    this.shells.forEach((s) => this.scene.remove(s.mesh));
    [...this.bananas].forEach((b) => this._removeBanana(b));
    // cada caixa tem a própria textura do "?"
    this.boxes.forEach((b) => {
      this.scene.remove(b.mesh);
      disposeObject(b.mesh);
      b.mesh.traverse((o) => o.material?.map?.dispose());
    });
    this.coins = [];
    this.boxes = [];
    this.shells = [];
    this.bananas = [];
    this.particles.limpar();
  }

  _resetRacers() {
    for (const racer of this.racers) {
      const data = racer.userData;
      data.coins = 0;
      data.item = null;
      data.itemRoulette = null;
    }
  }

  // ------------------------------------------------------------- moedas

  _updateCoins(dt) {
    const R = ITEM_RULES;
    const radiusSq = R.coinRadius * R.coinRadius;

    for (const coin of this.coins) {
      if (!coin.active) {
        coin.timer -= dt;
        if (coin.timer <= 0) {
          coin.active = true;
          coin.mesh.visible = true;
        }
        continue;
      }

      // gira no próprio eixo e flutua
      coin.mesh.rotation.y += dt * 3;
      coin.mesh.position.y = R.coinHeight + Math.sin(this.time * 3 + coin.phase) * 0.08;

      for (const racer of this.racers) {
        if (racer.position.y > R.coinHeight + 1) continue;
        if (distXZSq(racer.position, coin.mesh.position) < radiusSq) {
          this._collectCoin(racer, coin);
          break;
        }
      }
    }
  }

  _collectCoin(racer, coin) {
    coin.active = false;
    coin.mesh.visible = false;
    coin.timer = ITEM_RULES.coinRespawn;

    const data = racer.userData;
    // o evento sai sempre (cada moeda vale pontos), mas o contador, que dá
    // o bônus de velocidade, para em 10
    data.coins = Math.min(ITEM_RULES.maxCoins, data.coins + 1);
    this._burst(coin.mesh.position, [1.0, 0.8, 0.2], 14, 3);
    this._emit('coin', { racer, coins: data.coins });
  }

  // ------------------------------------------------------ caixas e roleta

  _updateBoxes(dt) {
    const R = ITEM_RULES;
    const radiusSq = R.boxRadius * R.boxRadius;

    for (const box of this.boxes) {
      if (!box.active) {
        box.timer -= dt;
        if (box.timer <= 0) {
          box.active = true;
          box.appear = 0;
          box.mesh.visible = true;
        }
        continue;
      }

      // ao voltar, a caixa cresce de 0 até o tamanho normal em 0.3 s
      box.appear = Math.min(1, box.appear + dt / 0.3);
      box.mesh.scale.setScalar(box.appear);
      box.mesh.rotation.y += dt * 1.5;
      box.mesh.position.y = R.boxHeight + Math.sin(this.time * 2) * 0.1;

      // só pega a caixa depois que ela terminou de aparecer
      if (box.appear < 1) continue;
      for (const racer of this.racers) {
        if (distXZSq(racer.position, box.mesh.position) < radiusSq) {
          this._breakBox(racer, box);
          break;
        }
      }
    }
  }

  _breakBox(racer, box) {
    box.active = false;
    box.mesh.visible = false;
    box.timer = ITEM_RULES.boxRespawn;
    this._burst(box.mesh.position, [1.0, 0.75, 0.1], 10, 4);
    this._burst(box.mesh.position, [0.4, 0.7, 1.0], 10, 4);

    // como no jogo original: quem já tem item (ou está sorteando) só quebra a caixa
    const data = racer.userData;
    if (data.item || data.itemRoulette) return;
    data.itemRoulette = {
      timeLeft: ITEM_RULES.rouletteTime,
      stepTimer: 0,
      display: ITEM_NAMES[Math.floor(Math.random() * ITEM_NAMES.length)],
    };
  }

  // a roleta passa pelos ícones em sequência e, no fim, sorteia o item
  _updateRoulettes(dt) {
    for (const racer of this.racers) {
      const data = racer.userData;
      const roulette = data.itemRoulette;
      if (!roulette) continue;

      roulette.timeLeft -= dt;
      roulette.stepTimer -= dt;
      if (roulette.stepTimer <= 0) {
        const next = (ITEM_NAMES.indexOf(roulette.display) + 1) % ITEM_NAMES.length;
        roulette.display = ITEM_NAMES[next];
        roulette.stepTimer = ITEM_RULES.rouletteStep;
      }

      if (roulette.timeLeft <= 0) {
        data.item = ITEM_NAMES[Math.floor(Math.random() * ITEM_NAMES.length)];
        data.itemRoulette = null;
        this._emit('itemPickup', { racer, item: data.item });
      }
    }
  }

  // ---------------------------------------------------------- casco verde

  _fireShell(racer) {
    const R = ITEM_RULES;
    const path = this.track.path;
    const length = path.getLength();
    const data = racer.userData;

    // O casco anda em linha reta no mundo, na direção do nariz do kart. Para
    // saber onde ele está na pista, a direção é dividida em duas partes,
    // como no PlayerController: a parte em T faz o u andar e a parte em N
    // muda o side
    const dir = forwardOf(racer);
    frameAt(path, data.u, _T, _N);
    const limit = this.track.trackWidth / 2 + R.wallDistance;
    const u = (data.u + (dir.dot(_T) * R.shellSpawnDistance) / length + 1) % 1;
    const side = THREE.MathUtils.clamp(data.side + dir.dot(_N) * R.shellSpawnDistance, -limit, limit);

    const mesh = createGreenShell();
    this._placeOnTrack(mesh, u, side, 0.02);
    this.scene.add(mesh);
    this.shells.push({ mesh, u, side, dir, owner: racer, age: 0, bounces: 0 });
  }

  _updateShells(dt) {
    const R = ITEM_RULES;
    const path = this.track.path;
    const length = path.getLength();
    const limit = this.track.trackWidth / 2 + R.wallDistance;
    const hitSq = R.shellRadius * R.shellRadius;

    // em 2 passos menores, para o casco rápido não "atravessar" um kart
    const steps = 2;
    const h = dt / steps;

    for (const shell of [...this.shells]) {
      shell.age += dt;

      for (let s = 0; s < steps; s++) {
        frameAt(path, shell.u, _T, _N);
        shell.u = (shell.u + (shell.dir.dot(_T) * R.shellSpeed * h) / length + 1) % 1;
        shell.side += shell.dir.dot(_N) * R.shellSpeed * h;

        // QUICAR NA BORDA: reflexão da direção em relação à lateral N,
        //   d' = d - 2 (d · N) N
        // só quando o casco está indo para fora (d · N com o mesmo sinal do side)
        if (Math.abs(shell.side) > limit) {
          const outward = Math.sign(shell.side);
          shell.side = outward * limit;
          const dn = shell.dir.dot(_N);
          if (dn * outward > 0) {
            shell.dir.addScaledVector(_N, -2 * dn);
            shell.bounces++;
            this._burst(this._trackPoint(shell.u, shell.side, 0.3, _P), [1, 1, 0.8], 6, 3);
          }
        }
      }

      this._placeOnTrack(shell.mesh, shell.u, shell.side, 0.02);
      shell.mesh.rotation.y += dt * 14; // o casco gira enquanto desliza

      if (shell.age > R.shellLife || shell.bounces > R.shellMaxBounces) {
        this._removeShell(shell, true);
        continue;
      }

      // acertou um kart?
      let hit = false;
      for (const racer of this.racers) {
        if (racer === shell.owner && shell.age < R.shellOwnerGrace) continue;
        if (racer.position.y > R.hitMaxHeight) continue;
        if (distXZSq(racer.position, shell.mesh.position) < hitSq) {
          this._hit(racer, shell.owner, 'greenShell', 'stunned');
          this._removeShell(shell, true);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // casco e banana se destroem
      for (const banana of this.bananas) {
        if (distXZSq(banana.mesh.position, shell.mesh.position) < 1) {
          this._removeBanana(banana, true);
          this._removeShell(shell, true);
          break;
        }
      }
    }
  }

  _removeShell(shell, withBurst = false) {
    const i = this.shells.indexOf(shell);
    if (i === -1) return;
    this.shells.splice(i, 1);
    this.scene.remove(shell.mesh);
    if (withBurst) this._burst(shell.mesh.position, [0.3, 1.0, 0.4], 12, 4);
  }

  // -------------------------------------------------------------- banana

  _dropBanana(racer) {
    const R = ITEM_RULES;
    const path = this.track.path;
    const length = path.getLength();
    const data = racer.userData;

    // mesma conta do casco, só que para trás do kart
    const back = forwardOf(racer).negate();
    frameAt(path, data.u, _T, _N);
    const limit = this.track.trackWidth / 2 + 1;
    const u = (data.u + (back.dot(_T) * R.bananaDropDistance) / length + 1) % 1;
    const side = THREE.MathUtils.clamp(data.side + back.dot(_N) * R.bananaDropDistance, -limit, limit);

    const mesh = createBanana();
    this._placeOnTrack(mesh, u, side, 0.01);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0.01);
    // u e side no userData: é o que a IA lê para desviar dos obstáculos
    mesh.userData.u = u;
    mesh.userData.side = side;
    this.scene.add(mesh);
    this.obstacles.push(mesh);

    this.bananas.push({ mesh, owner: racer, age: 0 });
    if (this.bananas.length > R.maxBananas) this._removeBanana(this.bananas[0], true);
  }

  _updateBananas(dt) {
    const R = ITEM_RULES;
    const hitSq = R.bananaRadius * R.bananaRadius;

    for (const banana of [...this.bananas]) {
      banana.age += dt;
      // cai e "estica" até o tamanho normal em 0.15 s
      banana.mesh.scale.setScalar(Math.min(1, 0.01 + banana.age / 0.15));

      for (const racer of this.racers) {
        if (racer === banana.owner && banana.age < R.bananaOwnerGrace) continue;
        // pulando (hop), o kart passa por cima da banana
        if (racer.position.y > R.bananaJumpClear) continue;
        if (distXZSq(racer.position, banana.mesh.position) < hitSq) {
          this._hit(racer, banana.owner, 'banana', 'spin');
          this._removeBanana(banana, true);
          break;
        }
      }
    }
  }

  _removeBanana(banana, withBurst = false) {
    const i = this.bananas.indexOf(banana);
    if (i !== -1) this.bananas.splice(i, 1);
    const j = this.obstacles.indexOf(banana.mesh);
    if (j !== -1) this.obstacles.splice(j, 1);
    this.scene.remove(banana.mesh);
    if (withBurst) this._burst(banana.mesh.position, [1.0, 0.9, 0.2], 10, 3);
  }

  // ------------------------------------------------------ consequências

  // item acertou um kart: efeito no alvo, perda de moeda e evento de pontos
  _hit(target, attacker, item, effect) {
    // já rodando ou atordoado: o item quebra, mas não faz efeito de novo
    if (isOutOfControl(target)) return;

    const data = target.userData;
    target.applyEffect?.(effect);
    data.coins = Math.max(0, (data.coins ?? 0) - ITEM_RULES.coinsLostOnHit);

    // só vale pontos acertar outro piloto (escorregar na própria banana não conta)
    if (attacker && attacker !== target) {
      this._emit('itemHit', { attacker, target, item });
    }
  }

  // ------------------------------------------------------------- visual

  // várias partículas saindo de um ponto em direções sorteadas
  _burst(position, color, count, speed) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.4, Math.random() - 0.5)
        .normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      this.particles.emitir(position, v, color, 0.5 + Math.random() * 0.3);
    }
  }

  _emit(event, data) {
    this.game?.emit?.(event, data);
    this._listeners[event]?.forEach((fn) => fn(data));
  }

  // ------------------------------------------- quadro do item do jogador

  _createSlot() {
    const slot = document.createElement('div');
    Object.assign(slot.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '5',
      width: '76px', height: '76px', borderRadius: '14px',
      background: 'rgba(0,0,0,0.55)', border: '3px solid #fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '44px/1 sans-serif', color: '#fff', pointerEvents: 'none',
    });
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'absolute', top: '84px', left: '50%', transform: 'translateX(-50%)',
      font: '11px/1.2 monospace', whiteSpace: 'nowrap',
      padding: '2px 6px', background: 'rgba(0,0,0,0.55)', borderRadius: '4px',
    });
    hint.textContent = '[E] usar item';
    this._slotIcon = document.createElement('span');
    slot.append(this._slotIcon, hint);
    document.body.appendChild(slot);
    return slot;
  }

  _updateSlot() {
    if (!this.slot) return;
    const player = this.racers.find((r) => r.userData.isPlayer);
    const info = player ? this.getItemInfo(player) : null;
    const text = info ? `${info.icon}|${info.rolling}` : '';
    if (text === this._slotText) return; // só mexe no DOM quando muda
    this._slotText = text;
    this._slotIcon.textContent = info?.icon ?? '';
    this.slot.style.borderColor = info?.rolling ? '#ffd23b' : '#fff';
    this.slot.title = info?.label ?? '';
  }
}
