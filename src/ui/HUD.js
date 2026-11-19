// HUD e telas do jogo (Membro 5): volta, posição, tempo, moedas, pontos, item
// atual, minimapa, contagem regressiva, menu, pausa e tela de fim (vitória ou
// derrota, com pódio).
//
// O HUD só desenha. Quem decide as regras é o Game.js, que ele consulta com
// game.getHudData() e game.result. Os botões chamam as funções recebidas em
// "actions", que são ligadas no main.js.

import { STATES, formatTime } from '../gameplay/Game.js';

// cor de cada piloto no minimapa e no pódio
const RACER_COLORS = {
  Mario: '#e52521',
  Luigi: '#2fbf3a',
  Peach: '#ff8fc7',
  Bowser: '#f2b705',
};
const DEFAULT_COLOR = '#cccccc';

const MINIMAP_SIZE = 170;

const CSS = `
.kh-root { position: fixed; inset: 0; pointer-events: none; z-index: 6;
  font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif; color: #fff;
  user-select: none; -webkit-user-select: none; }
.kh-root * { box-sizing: border-box; }
.kh-hidden { display: none !important; }

.kh-panel { background: rgba(10, 14, 30, 0.62); border: 2px solid rgba(255,255,255,0.85);
  border-radius: 14px; backdrop-filter: blur(3px); }

.kh-stats { position: absolute; top: 12px; left: 12px; padding: 10px 16px; min-width: 190px; }
.kh-stat-label { font-size: 11px; letter-spacing: 1.5px; opacity: 0.75; text-transform: uppercase; }
.kh-lap { font-size: 22px; font-weight: 800; }
.kh-pos { font-size: 54px; font-weight: 900; line-height: 1; margin: 2px 0 6px;
  text-shadow: 0 3px 0 rgba(0,0,0,0.45); }
.kh-pos small { font-size: 22px; font-weight: 700; opacity: 0.8; }
.kh-pos.kh-first { color: #ffd23b; }
.kh-time { font: 700 18px/1.3 'Consolas', 'Courier New', monospace; }

.kh-score { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  padding: 8px 26px; text-align: center; min-width: 200px; }
.kh-score-value { font-size: 34px; font-weight: 900; line-height: 1.1; color: #ffd23b;
  text-shadow: 0 2px 0 rgba(0,0,0,0.5); }
.kh-coins { font-size: 14px; font-weight: 700; margin-top: 2px; }

.kh-toasts { position: absolute; top: 108px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px; }
.kh-toast { padding: 5px 16px; border-radius: 999px; font-weight: 800; font-size: 18px;
  background: rgba(0,0,0,0.65); border: 2px solid #fff; animation: kh-toast 1.8s forwards;
  white-space: nowrap; }
.kh-toast.kh-good { border-color: #ffd23b; color: #ffd23b; }
.kh-toast.kh-bad { border-color: #ff5a4f; color: #ff7b72; }
.kh-toast.kh-lapmsg { font-size: 24px; border-color: #7dd3fc; color: #e0f2fe; }
@keyframes kh-toast { 0% { opacity: 0; transform: translateY(-10px) scale(0.9); }
  12% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(8px); } }

.kh-wrong { position: absolute; top: 190px; left: 50%; transform: translateX(-50%);
  padding: 8px 22px; font-size: 26px; font-weight: 900; color: #fff; background: rgba(200,20,20,0.85);
  border-radius: 12px; border: 3px solid #fff; animation: kh-blink 0.6s infinite alternate; }
@keyframes kh-blink { from { opacity: 1; } to { opacity: 0.45; } }

.kh-item { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  width: 86px; height: 86px; display: flex; align-items: center; justify-content: center;
  font-size: 48px; border-radius: 18px; }
.kh-item.kh-rolling { border-color: #ffd23b; animation: kh-blink 0.3s infinite alternate; }
.kh-item-hint { position: absolute; bottom: -22px; left: 50%; transform: translateX(-50%);
  font: 700 11px/1 monospace; white-space: nowrap; padding: 3px 7px; border-radius: 5px;
  background: rgba(0,0,0,0.6); }

.kh-minimap { position: absolute; right: 12px; bottom: 12px; padding: 6px; }
.kh-minimap canvas { display: block; }

.kh-countdown { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: min(32vw, 300px); font-weight: 900; text-shadow: 0 8px 0 rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.5);
  -webkit-text-stroke: 6px rgba(0,0,0,0.4); paint-order: stroke fill; }
.kh-countdown.kh-go { color: #4ade80; }
.kh-countdown.kh-pop { animation: kh-pop 0.9s ease-out forwards; }
@keyframes kh-pop { 0% { transform: scale(2.2); opacity: 0; } 25% { transform: scale(1); opacity: 1; }
  80% { opacity: 1; } 100% { transform: scale(0.85); opacity: 0.1; } }

.kh-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(5, 8, 22, 0.72); pointer-events: auto; overflow-y: auto; padding: 16px;
  animation: kh-fade 0.35s; }
@keyframes kh-fade { from { opacity: 0; } to { opacity: 1; } }
.kh-card { width: min(640px, 100%); padding: 26px 30px; border-radius: 22px; text-align: center;
  background: linear-gradient(160deg, rgba(30,41,90,0.95), rgba(14,18,44,0.95));
  border: 3px solid #fff; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.kh-title { font-size: 46px; font-weight: 900; letter-spacing: 1px; line-height: 1.05;
  text-shadow: 0 4px 0 rgba(0,0,0,0.5); margin: 0 0 4px; }
.kh-title .kh-red { color: #ff4b3e; }
.kh-sub { opacity: 0.8; margin-bottom: 16px; }
.kh-group-label { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; margin: 14px 0 6px; }
.kh-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

.kh-btn { font: inherit; font-weight: 800; font-size: 16px; color: #fff; cursor: pointer;
  padding: 9px 18px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.08); transition: transform 0.08s, background 0.15s; }
.kh-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); transform: translateY(-1px); }
.kh-btn.kh-selected { background: #ffd23b; color: #1a1a2e; border-color: #ffd23b; }
.kh-btn:disabled { opacity: 0.5; cursor: wait; }
.kh-btn.kh-primary { font-size: 22px; padding: 12px 34px; background: #e52521; border-color: #fff; margin-top: 4px; }
.kh-btn.kh-primary:hover:not(:disabled) { background: #ff3b36; }
.kh-btn.kh-primary:disabled { background: #555; }

.kh-controls { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; text-align: left;
  font-size: 14px; margin: 4px auto 0; width: fit-content; }
.kh-key { font: 700 12px monospace; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.5);
  border-radius: 6px; padding: 1px 7px; white-space: nowrap; justify-self: end; }
.kh-record { margin-top: 12px; font-size: 14px; opacity: 0.9; }

.kh-result-title { font-size: 58px; font-weight: 900; margin: 0; text-shadow: 0 5px 0 rgba(0,0,0,0.5); }
.kh-win { color: #ffd23b; }
.kh-lose { color: #ff7b72; }
.kh-badge { display: inline-block; margin: 8px 4px 0; padding: 3px 12px; border-radius: 999px;
  background: #ffd23b; color: #1a1a2e; font-weight: 900; font-size: 14px; animation: kh-blink 0.8s infinite alternate; }

.kh-podium { display: flex; align-items: flex-end; justify-content: center; gap: 8px; margin: 18px 0 8px; height: 150px; }
.kh-podium-col { width: 118px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.kh-podium-name { font-weight: 800; font-size: 15px; margin-bottom: 4px; }
.kh-podium-name.kh-me { color: #ffd23b; }
.kh-podium-block { width: 100%; border-radius: 8px 8px 0 0; display: flex; align-items: flex-start;
  justify-content: center; padding-top: 6px; font-size: 28px; font-weight: 900; color: #1a1a2e; }
.kh-podium-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; margin-bottom: 4px; }

.kh-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 15px; text-align: left; }
.kh-table td { padding: 3px 6px; }
.kh-table td:last-child { text-align: right; font-family: Consolas, monospace; font-weight: 700; }
.kh-table tr.kh-total td { border-top: 2px solid rgba(255,255,255,0.6); font-size: 20px; font-weight: 900; color: #ffd23b; padding-top: 6px; }
.kh-table .kh-neg { color: #ff7b72; }
.kh-table tr.kh-me td { color: #ffd23b; font-weight: 800; }
.kh-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; text-align: left; }
@media (max-width: 640px) { .kh-two { grid-template-columns: 1fr; } .kh-title { font-size: 34px; } }
.kh-note { font-size: 12px; opacity: 0.6; margin-top: 10px; }
`;

// cria um elemento com classe e texto (textContent: nada de innerHTML)
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function ordinal(n) {
  return `${n}º`;
}

export class HUD {
  // game        Game.js
  // getItemInfo função que devolve { icon, label, rolling } do item do jogador
  // tracks      [{ name }]  pistas que aparecem no menu
  // difficulties [{ key, label }]
  // actions     { onStart, onRestart, onResume, onMenu, onSelectTrack, onSelectDifficulty }
  constructor({ game, getItemInfo = () => null, tracks = [], difficulties = [], actions = {} }) {
    this.game = game;
    this.getItemInfo = getItemInfo;
    this.tracks = tracks;
    this.difficulties = difficulties;
    this.actions = actions;

    this.trackIndex = 0;
    this.difficultyKey = difficulties[1]?.key ?? difficulties[0]?.key ?? null;
    this.ready = false;
    this._cache = {};
    this._minimap = null;

    this._injectStyle();
    this._build();

    game.on('state', () => this._onState());
    game.on('countdown', ({ value }) => this._onCountdown(value));
    game.on('coin', ({ racer }) => racer?.userData?.isPlayer && this.toast(`+${game.config.pointsPerCoin} 🪙`, 'good'));
    game.on('itemHit', ({ attacker }) => {
      if (attacker?.userData?.isPlayer) this.toast(`ACERTOU! +${game.config.pointsPerItemHit}`, 'good');
    });
    game.on('collision', (data) => {
      const players = [data.racer, data.other, data.a, data.b, data.target, data.attacker];
      if (players.some((r) => r?.userData?.isPlayer) && game.isRacing) {
        this.toast(`BATIDA −${game.config.penaltyPerCollision}`, 'bad');
      }
    });
    game.on('lap', ({ racer, lap, lapTime, best }) => {
      if (!racer?.userData?.isPlayer || lap >= game.config.totalLaps) return;
      this.toast(`VOLTA ${lap}/${game.config.totalLaps} · ${formatTime(lapTime)}${best ? ' ★' : ''}`, 'lapmsg');
    });

    this._onState();
  }

  // ------------------------------------------------------------ montagem

  _injectStyle() {
    if (document.getElementById('kh-style')) return;
    const style = document.createElement('style');
    style.id = 'kh-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  _build() {
    const root = this.root = el('div', 'kh-root');

    // painel de estatísticas
    const stats = this.statsPanel = el('div', 'kh-panel kh-stats');
    this.lapEl = el('div', 'kh-lap');
    this.posEl = el('div', 'kh-pos');
    this.timeEl = el('div', 'kh-time');
    this.bestEl = el('div', 'kh-time');
    stats.append(
      el('div', 'kh-stat-label', 'Volta'), this.lapEl,
      el('div', 'kh-stat-label', 'Posição'), this.posEl,
      el('div', 'kh-stat-label', 'Tempo'), this.timeEl,
      el('div', 'kh-stat-label', 'Melhor volta'), this.bestEl,
    );

    // pontos e moedas
    const score = this.scorePanel = el('div', 'kh-panel kh-score');
    this.scoreEl = el('div', 'kh-score-value');
    this.coinsEl = el('div', 'kh-coins');
    score.append(el('div', 'kh-stat-label', 'Pontos'), this.scoreEl, this.coinsEl);

    this.toastBox = el('div', 'kh-toasts');
    this.wrongEl = el('div', 'kh-wrong kh-hidden', '⚠ CONTRAMÃO');

    // item atual
    const item = this.itemPanel = el('div', 'kh-panel kh-item');
    this.itemIcon = el('span');
    item.append(this.itemIcon, el('div', 'kh-item-hint', '[E] usar item'));

    // minimapa
    const mini = this.miniPanel = el('div', 'kh-panel kh-minimap');
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = MINIMAP_SIZE * dpr;
    this.canvas.height = MINIMAP_SIZE * dpr;
    this.canvas.style.width = `${MINIMAP_SIZE}px`;
    this.canvas.style.height = `${MINIMAP_SIZE}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    mini.append(this.canvas);

    this.countdownEl = el('div', 'kh-countdown kh-hidden');

    this.menuEl = this._buildMenu();
    this.pauseEl = this._buildPause();
    this.endEl = el('div', 'kh-overlay kh-hidden');

    root.append(
      stats, score, this.toastBox, this.wrongEl, item, mini,
      this.countdownEl, this.menuEl, this.pauseEl, this.endEl,
    );
    document.body.appendChild(root);
  }

  // botão que não fica com o foco: se ficasse, o Espaço (pulo) apertaria o botão de novo
  _button(text, onClick, className = '') {
    const btn = el('button', `kh-btn ${className}`, text);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      btn.blur();
      onClick?.();
    });
    btn.addEventListener('keydown', (e) => e.preventDefault());
    return btn;
  }

  _buildMenu() {
    const overlay = el('div', 'kh-overlay');
    const card = el('div', 'kh-card');

    const title = el('h1', 'kh-title');
    title.append(el('span', 'kh-red', 'MARIO '), document.createTextNode('KART 3D'));
    card.append(title, el('div', 'kh-sub', `${this.game.config.totalLaps} voltas · 4 pilotos · seja o 1º colocado`));

    card.append(el('div', 'kh-group-label', 'Pista'));
    const trackRow = el('div', 'kh-row');
    this.trackButtons = this.tracks.map((track, index) => {
      const btn = this._button(track.name, () => this.actions.onSelectTrack?.(index));
      trackRow.append(btn);
      return btn;
    });
    card.append(trackRow);

    card.append(el('div', 'kh-group-label', 'Dificuldade dos rivais'));
    const diffRow = el('div', 'kh-row');
    this.difficultyButtons = this.difficulties.map((d) => {
      const btn = this._button(d.label, () => this.actions.onSelectDifficulty?.(d.key));
      btn.dataset.key = d.key;
      diffRow.append(btn);
      return btn;
    });
    card.append(diffRow);

    card.append(el('div', 'kh-group-label', 'Controles'));
    const controls = el('div', 'kh-controls');
    [
      ['↑  /  W', 'acelerar'],
      ['↓  /  S', 'frear (parado, dá ré)'],
      ['←  →  /  A  D', 'virar'],
      ['Espaço / Shift', 'pular · segure na curva para o drift'],
      ['E  /  X', 'usar item'],
      ['Esc', 'pausar'],
      ['R', 'reiniciar'],
      ['C  ou  1 – 5', 'trocar a câmera'],
    ].forEach(([key, action]) => {
      controls.append(el('span', 'kh-key', key), el('span', '', action));
    });
    card.append(controls);

    this.menuRecordEl = el('div', 'kh-record');
    card.append(this.menuRecordEl);

    this.startButton = this._button('Carregando…', () => this.actions.onStart?.(), 'kh-primary');
    this.startButton.disabled = true;
    const startWrap = el('div', 'kh-row');
    startWrap.style.marginTop = '16px';
    startWrap.append(this.startButton);
    card.append(startWrap);

    overlay.append(card);
    return overlay;
  }

  _buildPause() {
    const overlay = el('div', 'kh-overlay kh-hidden');
    const card = el('div', 'kh-card');
    card.style.width = 'min(420px, 100%)';
    card.append(el('h1', 'kh-title', 'PAUSA'), el('div', 'kh-sub', 'A corrida está parada'));
    const col = el('div', 'kh-row');
    col.style.flexDirection = 'column';
    col.append(
      this._button('Continuar  (Esc)', () => this.actions.onResume?.(), 'kh-primary'),
      this._button('Reiniciar  (R)', () => this.actions.onRestart?.()),
      this._button('Menu principal', () => this.actions.onMenu?.()),
    );
    card.append(col);
    overlay.append(card);
    return overlay;
  }

  // ------------------------------------------------------------- menu

  setReady(ready) {
    this.ready = ready;
    this.startButton.disabled = !ready;
    this.startButton.textContent = ready ? 'JOGAR  (Enter)' : 'Carregando…';
  }

  // marca a pista e a dificuldade escolhidas e mostra o recorde da pista
  setSelection({ trackIndex, difficultyKey }) {
    if (trackIndex != null) this.trackIndex = trackIndex;
    if (difficultyKey != null) this.difficultyKey = difficultyKey;
    this.trackButtons.forEach((b, i) => b.classList.toggle('kh-selected', i === this.trackIndex));
    this.difficultyButtons.forEach((b) => b.classList.toggle('kh-selected', b.dataset.key === this.difficultyKey));
    this._refreshMenuRecord();
  }

  _refreshMenuRecord() {
    const record = this.game.getRecord();
    this.menuRecordEl.textContent = record.score > 0
      ? `Recorde nesta pista: ${record.score} pts · melhor volta ${formatTime(record.bestLap)}`
      : 'Sem recorde nesta pista ainda. Seja o primeiro!';
  }

  // ----------------------------------------------------------- minimapa

  // guarda o desenho da pista (pontos x, z) para redesenhar a cada frame
  setTrack(track) {
    const points = track.path.getSpacedPoints(160);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const pad = 14;
    const scale = (MINIMAP_SIZE - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    // centraliza a pista no quadrado
    const offX = (MINIMAP_SIZE - (maxX - minX) * scale) / 2;
    const offZ = (MINIMAP_SIZE - (maxZ - minZ) * scale) / 2;
    // x do mundo vai para a direita; z do mundo vai para baixo na tela
    const toMap = (x, z) => [offX + (x - minX) * scale, offZ + (z - minZ) * scale];

    const start = track.path.getPointAt(0);
    const tangent = track.path.getTangentAt(0).normalize();
    this._minimap = {
      toMap,
      line: points.map((p) => toMap(p.x, p.z)),
      start: toMap(start.x, start.z),
      startDir: [tangent.x, tangent.z],
    };
    this._drawMinimap();
  }

  _drawMinimap() {
    const map = this._minimap;
    if (!map) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = () => {
      ctx.beginPath();
      map.line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 9;
    trace();
    ctx.stroke();
    ctx.strokeStyle = '#3a3f55';
    ctx.lineWidth = 6;
    trace();
    ctx.stroke();

    // linha de largada: pequena barra perpendicular à pista
    const [sx, sy] = map.start;
    const [dx, dz] = map.startDir;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - dz * 6, sy + dx * 6);
    ctx.lineTo(sx + dz * 6, sy - dx * 6);
    ctx.stroke();

    // pilotos: o jogador por último e maior, para não ficar escondido
    const racers = [...this.game.racers].sort((a, b) => (a.userData.isPlayer ? 1 : 0) - (b.userData.isPlayer ? 1 : 0));
    for (const racer of racers) {
      const [x, y] = map.toMap(racer.position.x, racer.position.z);
      const isPlayer = racer.userData.isPlayer;
      ctx.beginPath();
      ctx.arc(x, y, isPlayer ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = RACER_COLORS[racer.userData.displayName] ?? DEFAULT_COLOR;
      ctx.fill();
      ctx.lineWidth = isPlayer ? 2.5 : 1.5;
      ctx.strokeStyle = isPlayer ? '#fff' : 'rgba(0,0,0,0.7)';
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ eventos

  toast(text, kind = '') {
    const node = el('div', `kh-toast ${kind ? `kh-${kind}` : ''}`, text);
    this.toastBox.append(node);
    // no máximo 4 avisos ao mesmo tempo
    while (this.toastBox.children.length > 4) this.toastBox.firstChild.remove();
    setTimeout(() => node.remove(), 1800);
  }

  _onCountdown(value) {
    const node = this.countdownEl;
    node.classList.remove('kh-hidden', 'kh-pop');
    node.classList.toggle('kh-go', value === 0);
    node.textContent = value > 0 ? String(value) : 'JÁ!';
    void node.offsetWidth; // reinicia a animação
    node.classList.add('kh-pop');
    if (value === 0) setTimeout(() => this.countdownEl.classList.add('kh-hidden'), 900);
  }

  _onState() {
    const state = this.game.state;
    const inMenu = state === STATES.MENU;
    const playing = state === STATES.COUNTDOWN || state === STATES.RACING || state === STATES.PAUSED;
    const showHud = playing || state === STATES.FINISHED;

    this.menuEl.classList.toggle('kh-hidden', !inMenu);
    this.pauseEl.classList.toggle('kh-hidden', state !== STATES.PAUSED);
    for (const panel of [this.statsPanel, this.scorePanel, this.itemPanel, this.miniPanel]) {
      panel.classList.toggle('kh-hidden', !showHud);
    }
    if (state !== STATES.COUNTDOWN && state !== STATES.RACING) {
      this.countdownEl.classList.add('kh-hidden');
    }
    if (state === STATES.FINISHED) this._showEnd();
    else this.endEl.classList.add('kh-hidden');
    if (inMenu) this._refreshMenuRecord();
    this._cache = {}; // força atualizar todos os textos
  }

  // ----------------------------------------------------------- tela final

  _showEnd() {
    const r = this.game.result;
    if (!r) return;
    const end = this.endEl;
    end.replaceChildren();
    end.classList.remove('kh-hidden');

    const card = el('div', 'kh-card');
    card.append(el('h1', `kh-result-title ${r.victory ? 'kh-win' : 'kh-lose'}`, r.victory ? 'VITÓRIA!' : 'DERROTA'));
    card.append(el('div', 'kh-sub', r.victory
      ? 'Você cruzou a linha de chegada em 1º lugar!'
      : `Você terminou em ${ordinal(r.position)} lugar. Só o 1º vence, tente de novo!`));
    if (r.newScoreRecord) card.append(el('span', 'kh-badge', '★ NOVO RECORDE DE PONTOS'));
    if (r.newLapRecord) card.append(el('span', 'kh-badge', '★ NOVA MELHOR VOLTA'));

    // pódio: 2º, 1º, 3º (o 1º no meio e mais alto)
    const podium = el('div', 'kh-podium');
    const heights = { 1: 110, 2: 80, 3: 55 };
    const colors = { 1: '#ffd23b', 2: '#cfd8e3', 3: '#d9955a' };
    for (const place of [2, 1, 3]) {
      const entry = r.ranking[place - 1];
      if (!entry) continue;
      const col = el('div', 'kh-podium-col');
      const dot = el('div', 'kh-podium-dot');
      dot.style.background = RACER_COLORS[entry.name] ?? DEFAULT_COLOR;
      col.append(dot, el('div', `kh-podium-name ${entry.isPlayer ? 'kh-me' : ''}`, entry.name));
      const block = el('div', 'kh-podium-block', String(place));
      block.style.height = `${heights[place]}px`;
      block.style.background = colors[place];
      col.append(block);
      podium.append(col);
    }
    card.append(podium);

    // ranking completo e pontuação lado a lado
    const two = el('div', 'kh-two');

    const rank = document.createElement('table');
    rank.className = 'kh-table';
    r.ranking.forEach((entry) => {
      const tr = document.createElement('tr');
      if (entry.isPlayer) tr.className = 'kh-me';
      tr.append(
        el('td', '', `${ordinal(entry.position)}  ${entry.name}`),
        el('td', '', entry.finished ? formatTime(entry.time) : 'em prova'),
      );
      rank.append(tr);
    });
    const lapsRow = document.createElement('tr');
    lapsRow.append(el('td', '', 'Melhor volta'), el('td', '', formatTime(r.bestLap)));
    const timeRow = document.createElement('tr');
    timeRow.append(el('td', '', 'Tempo total'), el('td', '', formatTime(r.time)));
    rank.append(lapsRow, timeRow);

    const b = r.breakdown;
    const score = document.createElement('table');
    score.className = 'kh-table';
    const addRow = (label, value, cls = '') => {
      const tr = document.createElement('tr');
      if (cls) tr.className = cls;
      const v = el('td', value < 0 ? 'kh-neg' : '', `${value < 0 ? '−' : '+'}${Math.abs(value)}`);
      tr.append(el('td', '', label), v);
      score.append(tr);
    };
    addRow(`Moedas (${b.coinCount})`, b.coins);
    addRow(`Acertos com itens (${b.itemHitCount})`, b.itemHits);
    addRow(`Bônus de posição (${ordinal(r.position)})`, b.position);
    addRow('Bônus de tempo', b.time);
    addRow(`Batidas (${b.collisionCount})`, -b.penalty);
    const total = document.createElement('tr');
    total.className = 'kh-total';
    total.append(el('td', '', 'TOTAL'), el('td', '', `${r.score} pts`));
    score.append(total);

    two.append(rank, score);
    card.append(two);
    card.append(el('div', 'kh-note', `Recorde da pista: ${r.record.score} pts · melhor volta ${formatTime(r.record.bestLap)}`));

    const buttons = el('div', 'kh-row');
    buttons.style.marginTop = '16px';
    buttons.append(
      this._button('Jogar de novo  (R)', () => this.actions.onRestart?.(), 'kh-primary'),
      this._button('Menu principal', () => this.actions.onMenu?.()),
    );
    card.append(buttons);
    end.append(card);
  }

  // --------------------------------------------------------- atualização

  // só mexe no DOM quando o texto muda
  _set(key, node, value, prop = 'textContent') {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    node[prop] = value;
  }

  // chamado uma vez por frame pelo main.js
  update() {
    const state = this.game.state;
    if (state === STATES.MENU) return;

    const d = this.game.getHudData();
    this._set('lap', this.lapEl, `${d.lap} / ${d.totalLaps}`);

    const posKey = `${d.position}|${d.totalRacers}`;
    if (this._cache.pos !== posKey) {
      this._cache.pos = posKey;
      this.posEl.replaceChildren(document.createTextNode(ordinal(d.position)), el('small', '', ` / ${d.totalRacers}`));
      this.posEl.classList.toggle('kh-first', d.position === 1);
    }

    this._set('time', this.timeEl, formatTime(d.raceTime));
    this._set('best', this.bestEl, formatTime(d.bestLap));
    this._set('score', this.scoreEl, String(d.score));
    this._set('coins', this.coinsEl, `🪙 ${d.coins} / 10`);

    const wrong = d.wrongWay && state === STATES.RACING;
    if (this._cache.wrong !== wrong) {
      this._cache.wrong = wrong;
      this.wrongEl.classList.toggle('kh-hidden', !wrong);
    }

    // item atual: ícone guardado ou roleta girando
    const info = this.getItemInfo();
    const icon = info?.icon ?? '';
    this._set('item', this.itemIcon, icon);
    const rolling = !!info?.rolling;
    if (this._cache.rolling !== rolling) {
      this._cache.rolling = rolling;
      this.itemPanel.classList.toggle('kh-rolling', rolling);
    }
    this.itemPanel.title = info?.label ?? '';

    this._drawMinimap();
  }

  dispose() {
    this.root.remove();
  }
}
