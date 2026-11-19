import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Collision, COLLISION_RULES } from '../src/gameplay/Collision.js';

function track() {
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6;
    return new THREE.Vector3(Math.sin(a) * 40, 0, Math.cos(a) * 40);
  });
  return { path: new THREE.CatmullRomCurve3(points, true), trackWidth: 12 };
}

function place(object, pista, u = 0.1, side = 0, height = 0.01) {
  const tangent = pista.path.getTangentAt(u).normalize();
  object.position.copy(pista.path.getPointAt(u))
    .addScaledVector(new THREE.Vector3(-tangent.z, 0, tangent.x), side);
  object.position.y = height;
  object.rotation.y = Math.atan2(tangent.x, tangent.z);
}

function racer(pista, preset = 'mario', side = 0) {
  const r = new THREE.Group();
  r.kart = new THREE.Group();
  r.kart.preset = preset;
  r.kart.scale.setScalar(preset === 'bowser' ? 1.2 : 1);
  r.add(r.kart);
  r.userData = { u: 0.1, side, speed: 20, state: 'normal', isPlayer: preset === 'mario' };
  r.applyEffect = (type) => { r.userData.state = type; };
  place(r, pista, 0.1, side);
  return r;
}

function setup(type, height = 1) {
  const pista = track();
  const player = racer(pista);
  const obj = new THREE.Group();
  obj.name = type;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8));
  mesh.position.y = height / 2;
  obj.add(mesh);
  place(obj, pista);
  const events = [];
  const game = { emit(name, data) { events.push({ name, ...data }); } };
  const c = new Collision({ track: pista, racers: [player], obstacles: [obj], effects: false, game });
  return { c, pista, player, obj, events };
}

test('cone perde velocidade, sai voando e volta sem reaparecer dentro do kart', () => {
  const { c, pista, player, obj, events } = setup('Cone');
  c.update(0.016);
  assert.equal(player.userData.speed, 16);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'cone');
  assert.equal(obj.userData.collisionDisabled, true);
  for (let i = 0; i < 130; i++) c.update(0.05);
  assert(c.colliders[0].flight); // kart ainda ocupa a posição original
  player.userData.u = 0.3;
  place(player, pista, 0.3);
  c.update(0.05);
  assert.equal(c.colliders[0].flight, null);
  assert.equal(obj.visible, true);
  assert.equal(obj.userData.collisionDisabled, false);
  assert(obj.position.distanceTo(c.colliders[0].position) < 1e-9);
});

test('barril quase para o kart sem repetir o evento no contato contínuo', () => {
  const { c, player, events } = setup('Barrel');
  c.update(0.016);
  assert.equal(player.userData.speed, 20 * COLLISION_RULES.barrelSpeed);
  for (let i = 0; i < 12; i++) c.update(0.016);
  assert.equal(events.length, 1);
});

test('pneus diminuem a velocidade e empurram para trás', () => {
  const { c, player, events } = setup('TireStack');
  c.update(0.016);
  assert.equal(player.userData.speed, 5);
  const before = player.userData.u;
  c.update(0.05);
  assert(player.userData.u < before);
  assert.equal(events[0].type, 'tires');
});

test('óleo permite pular e só inicia um rodopio por contato', () => {
  const { c, player, events } = setup('OilSlick', 0.02);
  player.position.y = 0.4;
  c.update(0.016);
  assert.equal(events.length, 0);
  player.position.y = 0.01;
  c.update(0.016);
  assert.equal(player.userData.state, 'spin');
  for (let i = 0; i < 90; i++) c.update(0.016);
  assert.equal(events.length, 1);
});

test('movimento entre frames não atravessa o cone sem ser detectado', () => {
  const { c, pista, player, events } = setup('Cone');
  player.userData.u = 0.1 - 4 / c.length;
  place(player, pista, player.userData.u);
  c.update(0.016);
  player.userData.u = 0.1 + 4 / c.length;
  place(player, pista, player.userData.u);
  c.update(0.016);
  assert.equal(events.length, 1);
});

test('Bowser empurra mais e karts parados não geram penalidades', () => {
  const pista = track();
  const bowser = racer(pista, 'bowser', -0.2);
  const luigi = racer(pista, 'luigi', 0.2);
  const c = new Collision({ track: pista, racers: [bowser, luigi], effects: false });
  const events = [];
  c.on('collision', (e) => events.push(e));
  c.update(0.016);
  assert(Math.abs(bowser.userData.side + 0.2) < Math.abs(luigi.userData.side - 0.2));
  assert.equal(events.length, 2); // um evento por piloto, para a pontuação de cada um
  c.reset();
  bowser.userData.speed = luigi.userData.speed = 0;
  bowser.userData.side = luigi.userData.side = 0;
  place(bowser, pista); place(luigi, pista);
  events.length = 0;
  c.update(0.016);
  assert.equal(events.length, 0);
});

test('limite da pista e muro respeitam a física existente do jogador', () => {
  const { c, player, events } = setup('Unknown');
  c.register(player, { empurrandoMuro: true });
  player.userData.side = 30;
  c.update(0.016);
  assert(player.userData.side < 8);
  assert.equal(player.userData.speed, 20); // PlayerController já aplicou a perda
  for (let i = 0; i < 10; i++) c.update(0.016);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'wall');
});

test('reset e troca de pista limpam contatos, impulsos e cones em voo', () => {
  const { c, player, obj } = setup('Cone');
  c.update(0.016);
  c.reset();
  assert.equal(obj.userData.collisionDisabled, false);
  assert.equal(c.contacts.size, 0);
  assert.equal(c.previous.size, 0);
  assert.equal(c.impulses.size, 0);
  c.obstacles = [];
  c.setTrack(track());
  assert.equal(c.colliders.length, 0);
  assert.equal(player.userData.speed, 16);
});

test('caixas e bananas ficam sob responsabilidade do sistema de itens', () => {
  const { c, events } = setup('Banana');
  c.update(0.016);
  assert.equal(c.colliders.length, 0);
  assert.equal(events.length, 0);
});

test('pausa não causa impactos nem avança o retorno dos cones', () => {
  const { c, events } = setup('Cone');
  c.update(0.05, false);
  assert.equal(events.length, 0);
  c.update(0.05);
  const left = c.colliders[0].flight.left;
  c.update(0.05, false);
  assert.equal(c.colliders[0].flight.left, left);
});

test('acelerar contra o barril não permite atravessá-lo', () => {
  const { c, pista, player, obj } = setup('Barrel');
  player.userData.u -= 1.6 / c.length;
  place(player, pista, player.userData.u);
  let impacts = 0;
  c.on('collision', () => impacts++);
  for (let i = 0; i < 120; i++) {
    player.userData.speed += 20 * 0.016;
    player.userData.u += player.userData.speed * 0.016 / c.length;
    place(player, pista, player.userData.u);
    c.update(0.016);
  }
  assert(player.userData.u < 0.1);
  assert(impacts >= 1);
  assert(obj.position.distanceTo(c.colliders[0].position) < 1e-9);
});
