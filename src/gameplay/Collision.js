// Colisões dos karts com obstáculos, outros karts e limites da pista.
// O movimento continua nos controles do jogador e da IA. Aqui entram só
// as correções de posição, as perdas de velocidade e os efeitos das batidas.

import * as THREE from 'three';
import { CollisionEffects } from './CollisionEffects.js';

export const COLLISION_RULES = {
  coneSpeed: 0.8,           // conserva 80% da velocidade ao derrubar um cone
  barrelSpeed: 0.08,        // quase para no barril
  tireSpeed: 0.25,
  coneRespawn: 6,
  spinDuration: 1,
  contactDelay: 0.8,        // uma batida não gera pontos/sons a cada frame
  wallDistance: 1.55,       // mesmo limite usado no PlayerController
  bowserMass: 1.8,
};

const TYPES = new Set(['Cone', 'Barrel', 'TireStack', 'OilSlick']);

export class Collision {
  constructor({ scene, track, racers, obstacles = [], game = null, effects = true }) {
    this.racers = racers;
    this.obstacles = obstacles;
    this.game = game;
    this.effects = effects ? new CollisionEffects(scene) : null;
    this.controllers = new Map();
    this.listeners = {};
    this.time = 0;
    this.setTrack(track);
  }

  // registra o controle para reconhecer o muro já tratado pela física do jogador
  register(racer, controller) {
    this.controllers.set(racer, controller);
  }

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
    return () => {
      this.listeners[event] = (this.listeners[event] ?? []).filter((listener) => listener !== fn);
    };
  }

  setTrack(track) {
    this.reset();
    this.track = track;
    this.length = track.path.getLength();
    // os itens tratam caixas, bananas e cascos; aqui entram só os obstáculos fixos
    this.colliders = this.obstacles.filter((obj) => TYPES.has(obj.name)).map((object) => ({
      object,
      box: new THREE.Box3().setFromObject(object),
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      flight: null,
    }));
  }

  // chamar também ao reiniciar a corrida na mesma pista
  reset() {
    this.effects?.reset();
    this.colliders?.forEach((entry) => this._restoreCone(entry));
    this.previous = new Map();
    this.cooldowns = new Map();
    this.contacts = new Set();
    this.impulses = new Map();
    this.walls = new Set();
  }

  update(delta, active = true) {
    this.active = active;
    if (!active) {
      this.effects?.restoreCamera();
      return;
    }
    const dt = Math.min(Math.max(delta, 0), 1 / 20);
    this.time += dt;
    this.effects?.update(dt);
    this._updateCones(dt);
    this._updateImpulses(dt);
    this.currentContacts = new Set();

    for (const racer of this.racers) {
      this._checkWall(racer);
      this._checkObstacles(racer);
    }
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        this._checkKarts(this.racers[i], this.racers[j]);
      }
    }
    this.contacts = this.currentContacts;
    for (const racer of this.racers) this.previous.set(racer, this._spheres(racer));
    for (const [key, until] of this.cooldowns) {
      if (until < this.time && !this.contacts.has(key)) this.cooldowns.delete(key);
    }
  }

  updateCamera(camera) {
    if (this.active !== false) this.effects?.updateCamera(camera);
  }

  // duas esferas cobrem o chassi sem incluir cabeça, braços e enfeites
  _spheres(racer) {
    racer.updateMatrixWorld(true);
    const scale = racer.kart.scale.x;
    return [-0.48, 0.48].map((z) => new THREE.Sphere(
      racer.localToWorld(new THREE.Vector3(0, 0.5 * scale, z * scale)), 0.72 * scale
    ));
  }

  // testa também o segmento percorrido entre frames para não atravessar um cone
  _sweptHit(current, previous, box) {
    if (box.intersectsSphere(current)) return true;
    if (!previous) return false;
    const movement = current.center.clone().sub(previous.center);
    const distance = movement.length();
    if (distance < 0.00001) return false;
    const expanded = box.clone().expandByScalar(current.radius);
    const ray = new THREE.Ray(previous.center, movement.divideScalar(distance));
    const hit = ray.intersectBox(expanded, new THREE.Vector3());
    return hit !== null && hit.distanceTo(previous.center) <= distance;
  }

  _newContact(key) {
    this.currentContacts.add(key);
    if (this.contacts.has(key) || (this.cooldowns.get(key) ?? 0) > this.time) return false;
    this.cooldowns.set(key, this.time + COLLISION_RULES.contactDelay);
    return true;
  }

  _checkObstacles(racer) {
    const spheres = this._spheres(racer);
    const previous = this.previous.get(racer);
    for (const entry of this.colliders) {
      const object = entry.object;
      if (!object.visible || entry.flight || (entry.readyAt ?? 0) > this.time) continue;
      // o pulo permite passar por cima do óleo, que está rente ao asfalto
      if (object.name === 'OilSlick' && racer.position.y > 0.2) continue;
      const hit = spheres.some((sphere, i) => this._sweptHit(sphere, previous?.[i], entry.box));
      if (!hit) continue;
      const speed = Math.abs(racer.userData.speed ?? 0);
      if (object.name === 'Cone' && speed <= 0.3) continue;
      const key = `${racer.uuid}:${object.uuid}`;
      const fresh = this._newContact(key);
      if (object.name === 'OilSlick') {
        if (fresh && racer.userData.state !== 'spin' && racer.userData.state !== 'stunned') {
          racer.applyEffect?.('spin', COLLISION_RULES.spinDuration);
          this._event(racer, object, 'oil', speed);
        }
      } else if (object.name === 'Cone') {
        if (fresh && speed > 0.3) {
          this._setSpeed(racer, racer.userData.speed * COLLISION_RULES.coneSpeed);
          this._launchCone(entry, racer, speed);
          this._event(racer, object, 'cone', speed);
        }
      } else {
        // barris e pneus continuam sólidos mesmo durante o intervalo entre impactos
        const away = this._separate(racer, entry.box);
        const angle = this.controllers.get(racer)?.anguloMovimento ?? racer.rotation.y;
        const velocity = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle))
          .multiplyScalar(racer.userData.speed ?? 0);
        // segurando o acelerador contra o objeto, continua bloqueado; de ré pode sair
        if (!fresh && velocity.dot(away) < 0) this._setSpeed(racer, 0);
        if (!fresh || speed < 0.3) continue;
        const tires = object.name === 'TireStack';
        this._setSpeed(racer, racer.userData.speed * (tires ? COLLISION_RULES.tireSpeed : COLLISION_RULES.barrelSpeed));
        if (tires) this.impulses.set(racer, { forward: -Math.sign(racer.userData.speed || 1) * 7, side: 0, left: 0.3 });
        this._event(racer, object, tires ? 'tires' : 'barrel', speed);
      }
    }
  }

  _separate(racer, box) {
    const center = box.getCenter(new THREE.Vector3());
    const away = racer.position.clone().sub(center);
    away.y = 0;
    if (away.lengthSq() < 0.001) away.copy(this.track.path.getTangentAt(racer.userData.u)).negate();
    away.normalize();
    const tangent = this.track.path.getTangentAt(racer.userData.u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    this._move(racer, away.dot(tangent) * 0.18, away.dot(normal) * 0.18);
    return away;
  }

  _checkKarts(a, b) {
    const spheresA = this._spheres(a);
    const spheresB = this._spheres(b);
    let overlap = 0;
    for (const one of spheresA) {
      for (const two of spheresB) {
        overlap = Math.max(overlap, one.radius + two.radius - one.center.distanceTo(two.center));
      }
    }
    if (overlap <= 0) return;
    const key = [a.uuid, b.uuid].sort().join(':');
    const fresh = this._newContact(key);
    const massA = a.kart.preset === 'bowser' ? COLLISION_RULES.bowserMass : 1;
    const massB = b.kart.preset === 'bowser' ? COLLISION_RULES.bowserMass : 1;
    const side = Math.sign(b.userData.side - a.userData.side) || 1;
    // a massa maior recebe a menor parte do empurrão
    const separation = Math.min(overlap + 0.02, 0.5);
    this._move(a, 0, -side * separation * massB / (massA + massB));
    this._move(b, 0, side * separation * massA / (massA + massB));
    const speed = Math.max(Math.abs(a.userData.speed ?? 0), Math.abs(b.userData.speed ?? 0));
    if (!fresh || speed < 0.5) return;
    this._setSpeed(a, (a.userData.speed ?? 0) * 0.9);
    this._setSpeed(b, (b.userData.speed ?? 0) * 0.9);
    this.impulses.set(a, { forward: 0, side: -side * 3 * massB / massA, left: 0.2 });
    this.impulses.set(b, { forward: 0, side: side * 3 * massA / massB, left: 0.2 });
    this._event(a, null, 'kart', speed, b);
    this._event(b, null, 'kart', speed, a);
  }

  _checkWall(racer) {
    const halfWidth = 0.74 * racer.kart.scale.x;
    const limit = this.track.trackWidth / 2 + COLLISION_RULES.wallDistance - halfWidth;
    const controller = this.controllers.get(racer);
    const outside = Math.abs(racer.userData.side) > limit;
    // o jogador já perde velocidade no PlayerController; não aplicar a perda duas vezes
    const pushing = outside || controller?.empurrandoMuro === true;
    if (!pushing) {
      this.walls.delete(racer);
      return;
    }
    const speed = Math.abs(racer.userData.speed ?? 0);
    racer.userData.side = THREE.MathUtils.clamp(racer.userData.side, -limit, limit);
    this._move(racer, 0, 0);
    if (this.walls.has(racer)) return;
    this.walls.add(racer);
    if (speed < 0.5) return;
    if (!controller?.empurrandoMuro) this._setSpeed(racer, racer.userData.speed * 0.5);
    this._event(racer, null, 'wall', speed);
  }

  _move(racer, forward, side) {
    const data = racer.userData;
    data.u = (data.u + forward / this.length + 1) % 1;
    const limit = this.track.trackWidth / 2 + COLLISION_RULES.wallDistance - 0.74 * racer.kart.scale.x;
    data.side = THREE.MathUtils.clamp(data.side + side, -limit, limit);
    const tangent = this.track.path.getTangentAt(data.u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const height = racer.position.y;
    racer.position.copy(this.track.path.getPointAt(data.u)).addScaledVector(normal, data.side);
    racer.position.y = height;
    const target = this.controllers.get(racer)?.alvoCamera;
    if (target) target.position.copy(racer.position);
  }

  _setSpeed(racer, speed) {
    racer.userData.speed = speed;
    racer.speed = speed;
  }

  _updateImpulses(dt) {
    for (const [racer, impulse] of this.impulses) {
      this._move(racer, impulse.forward * dt, impulse.side * dt);
      impulse.forward *= Math.exp(-6 * dt);
      impulse.side *= Math.exp(-6 * dt);
      impulse.left -= dt;
      if (impulse.left <= 0) this.impulses.delete(racer);
    }
  }

  _launchCone(entry, racer, speed) {
    const direction = new THREE.Vector3(Math.sin(racer.rotation.y), 0, Math.cos(racer.rotation.y));
    direction.multiplyScalar(Math.sign(racer.userData.speed || 1) * Math.min(10, 3 + speed * 0.25));
    direction.y = 5;
    entry.flight = { velocity: direction, left: COLLISION_RULES.coneRespawn };
    entry.object.userData.collisionDisabled = true;
  }

  _updateCones(dt) {
    for (const entry of this.colliders) {
      if (!entry.flight) continue;
      const flight = entry.flight;
      flight.left -= dt;
      flight.velocity.y -= 14 * dt;
      entry.object.position.addScaledVector(flight.velocity, dt);
      entry.object.rotation.x += 5 * dt;
      entry.object.rotation.z += 3 * dt;
      if (entry.object.position.y < -1) entry.object.visible = false;
      if (flight.left <= 0) {
        // não faz o cone reaparecer dentro de um kart
        const occupied = this.racers.some((racer) => racer.position.distanceTo(entry.position) < 2);
        if (!occupied) this._restoreCone(entry);
      }
    }
  }

  _restoreCone(entry) {
    entry.object.position.copy(entry.position);
    entry.object.rotation.copy(entry.rotation);
    entry.object.visible = true;
    entry.object.userData.collisionDisabled = false;
    entry.flight = null;
    entry.readyAt = this.time + 0.05;
  }

  _event(racer, obstacle, type, speed, other = null) {
    const data = { racer, obstacle, other, type, speed, speedAfter: racer.userData.speed };
    this.game?.emit?.('collision', data);
    this.listeners.collision?.forEach((fn) => fn(data));
    const strength = Math.min(1, speed / 22);
    if (type !== 'oil') this.effects?.hit(racer.position, strength, racer.userData.isPlayer);
  }

  dispose() {
    this.reset();
    this.effects?.dispose();
    this.listeners = {};
    this.controllers.clear();
  }
}
