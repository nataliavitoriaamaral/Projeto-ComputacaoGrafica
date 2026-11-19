import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Sounds } from '../src/gameplay/Sounds.js';

test('buffers de motor, batida, moeda e item têm duração e amplitude válidas', () => {
  const context = {
    sampleRate: 48000,
    createBuffer(channels, length) {
      const data = new Float32Array(length);
      return { data, getChannelData: () => data };
    },
  };
  for (const type of ['engine', 'collision', 'coin', 'item']) {
    const buffer = Sounds.prototype._makeBuffer(context, type, 0.5);
    assert.equal(buffer.data.length, 24000);
    assert(buffer.data.some((value) => Math.abs(value) > 0.1));
    assert(buffer.data.every((value) => Number.isFinite(value) && Math.abs(value) <= 1));
  }
});

test('eventos dos itens e colisões tocam uma vez e respeitam o jogador', () => {
  const player = { position: new THREE.Vector3(), userData: { isPlayer: true } };
  const rival = { position: new THREE.Vector3(2, 0, 0), userData: { isPlayer: false } };
  const sounds = Object.create(Sounds.prototype);
  sounds.racers = [player, rival];
  sounds.sources = new Map();
  const played = [];
  sounds.play = (type) => played.push(type);
  const listeners = {};
  const source = { on(event, fn) { (listeners[event] ??= []).push(fn); } };
  const emit = (event, data) => listeners[event].forEach((fn) => fn(data));
  sounds.connect(source);
  sounds.connect(source);
  emit('coin', { racer: player });
  emit('coin', { racer: rival });
  emit('itemPickup', { racer: player });
  emit('itemUse', { racer: player });
  emit('itemHit', { target: player });
  emit('collision', { racer: player, other: rival, type: 'kart' });
  emit('collision', { racer: rival, other: player, type: 'kart' });
  emit('collision', { racer: player, type: 'oil' });
  assert.deepEqual(played, ['coin', 'item', 'item', 'collision', 'collision']);
});
