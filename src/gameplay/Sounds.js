// Sons do jogo com Audio do Three.js. Os buffers são gerados aqui,
// então não dependem de downloads nem de arquivos de áudio externos.

import * as THREE from 'three';

export class Sounds {
  constructor({ racers, game = null, inputTarget = window }) {
    this.racers = racers;
    this.enabled = true;
    this.focused = true;
    this.listener = null;
    this.voices = [];
    this.engine = null;
    this.sources = new Map();
    this.game = game;
    this.inputTarget = inputTarget;
    this._unlock = () => this.unlock();
    this._key = (event) => {
      if (event.code === 'KeyV' && !event.repeat) this.setEnabled(!this.enabled);
    };
    this._blur = () => { this.focused = false; this.engine?.setVolume(0); };
    this._focus = () => { this.focused = true; };
    // navegadores só liberam áudio depois de uma interação do usuário
    inputTarget.addEventListener('pointerdown', this._unlock);
    inputTarget.addEventListener('keydown', this._unlock);
    inputTarget.addEventListener('keydown', this._key);
    inputTarget.addEventListener('blur', this._blur);
    inputTarget.addEventListener('focus', this._focus);
    this._createLabel();
    if (game) this.connect(game);
  }

  unlock() {
    if (this.failed) return;
    try {
      if (!this.listener) {
        this.listener = new THREE.AudioListener();
        const context = this.listener.context;
        this.buffers = {
          collision: this._makeBuffer(context, 'collision', 0.22),
          coin: this._makeBuffer(context, 'coin', 0.24),
          item: this._makeBuffer(context, 'item', 0.32),
          engine: this._makeBuffer(context, 'engine', 0.5),
        };
        this.engine = new THREE.Audio(this.listener);
        this.engine.setBuffer(this.buffers.engine).setLoop(true).setVolume(0);
        this.listener.add(this.engine);
        this.engine.play();
      }
      this.listener.context.resume().then(() => this._updateLabel()).catch(() => {
        this.label.textContent = 'Som indisponível';
      });
      this.listener.setMasterVolume(this.enabled ? 0.6 : 0);
      this._updateLabel();
    } catch (error) {
      // uma falha de áudio não interrompe a corrida
      this.failed = true;
      this.label.textContent = 'Som indisponível';
      console.warn('Não foi possível iniciar o áudio:', error.message);
    }
  }

  // motor periódico, batida com ruído e dois sons curtos de notas crescentes
  _makeBuffer(context, type, duration) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      const progress = t / duration;
      let sample;
      if (type === 'engine') {
        sample = 0.4 * Math.sin(2 * Math.PI * 80 * t) + 0.15 * Math.sin(2 * Math.PI * 160 * t);
      } else if (type === 'collision') {
        sample = ((Math.random() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * 90 * t) * 0.4)
          * Math.exp(-progress * 7);
      } else {
        const frequency = type === 'coin'
          ? (progress < 0.4 ? 988 : 1319)
          : [523, 659, 784][Math.min(2, Math.floor(progress * 3))];
        sample = Math.sin(2 * Math.PI * frequency * t) * Math.sin(Math.PI * progress) * 0.45;
      }
      data[i] = sample;
    }
    return buffer;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.listener?.setMasterVolume(enabled ? 0.6 : 0);
    this._updateLabel();
  }

  play(type, volume = 0.4) {
    if (!this.enabled || !this.listener || !this.buffers?.[type] || this.failed) return;
    // limita os sons simultâneos quando vários rivais batem juntos
    this.voices = this.voices.filter((voice) => {
      if (voice.isPlaying) return true;
      voice.disconnect();
      this.listener.remove(voice);
      return false;
    });
    if (this.voices.length >= 8) return;
    const voice = new THREE.Audio(this.listener);
    voice.setBuffer(this.buffers[type]).setVolume(volume);
    this.listener.add(voice);
    voice.play();
    this.voices.push(voice);
  }

  // aceita tanto os eventos locais de Collision/Items quanto os do Game.js
  // ligar cada origem uma única vez evita duplicar sons
  connect(source) {
    if (!source?.on || this.sources.has(source)) return;
    const handles = [];
    const on = (event, fn) => handles.push(source.on(event, fn));
    on('collision', (data) => {
      const player = this.racers.find((racer) => racer.userData.isPlayer);
      if (!player || !data.racer || data.type === 'oil') return;
      // a colisão entre karts emite um evento para cada piloto; toca só uma vez
      if (data.other?.userData.isPlayer && !data.racer.userData.isPlayer) return;
      const distance = player.position.distanceTo(data.racer.position);
      if (distance < 25) this.play('collision', 0.35 * (1 - distance / 25));
    });
    on('coin', ({ racer }) => { if (racer?.userData.isPlayer) this.play('coin'); });
    on('itemPickup', ({ racer }) => { if (racer?.userData.isPlayer) this.play('item'); });
    on('itemUse', ({ racer }) => { if (racer?.userData.isPlayer) this.play('item', 0.3); });
    on('itemHit', ({ target }) => { if (target?.userData.isPlayer) this.play('collision'); });
    this.sources.set(source, handles);
  }

  update(camera, active = true) {
    if (!this.listener || !this.engine || this.failed) return;
    if (this.listener.parent !== camera) camera.add(this.listener);
    const player = this.racers.find((racer) => racer.userData.isPlayer);
    const speed = Math.abs(player?.userData.speed ?? 0);
    this.engine.setPlaybackRate(0.7 + Math.min(speed, 32) * 0.055);
    this.engine.setVolume(active && this.focused ? Math.min(0.12, speed * 0.006) : 0);
  }

  reset() {
    this.voices.forEach((voice) => {
      if (voice.isPlaying) voice.stop();
      voice.disconnect();
      this.listener?.remove(voice);
    });
    this.voices = [];
    this.engine?.setVolume(0);
  }

  _createLabel() {
    this.label = document.createElement('div');
    Object.assign(this.label.style, {
      position: 'fixed', top: '8px', left: '8px', padding: '5px 8px',
      background: 'rgba(0,0,0,0.6)', color: '#fff',
      font: '12px/1.5 monospace', borderRadius: '4px', pointerEvents: 'none', zIndex: '4',
    });
    document.body.appendChild(this.label);
    this._updateLabel();
  }

  _updateLabel() {
    if (this.failed) { this.label.textContent = 'Som indisponível'; return; }
    this.label.textContent = !this.enabled ? 'Som desligado [V]'
      : !this.listener || this.listener.context.state !== 'running'
        ? 'Clique para ativar o som [V]' : 'Som ligado [V]';
  }

  dispose() {
    this.reset();
    if (this.engine?.isPlaying) this.engine.stop();
    this.engine?.disconnect();
    this.listener?.removeFromParent();
    this.inputTarget.removeEventListener('pointerdown', this._unlock);
    this.inputTarget.removeEventListener('keydown', this._unlock);
    this.inputTarget.removeEventListener('keydown', this._key);
    this.inputTarget.removeEventListener('blur', this._blur);
    this.inputTarget.removeEventListener('focus', this._focus);
    for (const handles of this.sources.values()) handles.forEach((off) => { if (typeof off === 'function') off(); });
    this.sources.clear();
    this.label.remove();
  }
}
