// Barrel.js
// Barril vermelho abaulado: corpo (LatheGeometry), 2 aros cinza que acompanham
// a curva, rebites (SphereGeometry) e tampa clara com borda (TorusGeometry).
// Origem no chão. Altura 0.9, raio máximo 0.38.

import * as THREE from 'three';

const H = 0.9;        // altura
const R_END = 0.29;   // raio nas pontas (topo e base)
const R_MID = 0.38;   // raio no meio (barriga)

// raio do barril numa altura y (parábola: R_MID no centro, R_END nas pontas)
function radiusAt(y) {
  const t = (2 * y) / H - 1;           // -1 .. 1
  return R_END + (R_MID - R_END) * (1 - t * t);
}

export function createBarrel() {
  const g = new THREE.Group();
  g.name = 'Barrel';

  // corpo: LatheGeometry gira o perfil (raio x altura) em volta do eixo Y
  const profile = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * H;
    profile.push(new THREE.Vector2(radiusAt(y), y));
  }
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xc0392b, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), bodyMat);
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // aros cinza: mini LatheGeometry com o mesmo perfil, um pouco maior
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a8a, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide,
  });
  const rivetMat = new THREE.MeshStandardMaterial({
    color: 0xb0b0b0, roughness: 0.6, metalness: 0.3,
  });

  for (const yc of [0.2, 0.7]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const y = yc - 0.06 + (i / 6) * 0.12;
      pts.push(new THREE.Vector2(radiusAt(y) + 0.012, y));
    }
    const band = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), bandMat);
    band.castShadow = true;
    g.add(band);

    // rebites ao redor do aro
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = radiusAt(yc) + 0.016;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), rivetMat);
      rivet.position.set(Math.cos(a) * r, yc, Math.sin(a) * r);
      g.add(rivet);
    }
  }

  // tampa clara (mesma cor de antes)
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0xd9d9d9, roughness: 0.7, metalness: 0.1,
  });
  const lid = new THREE.Mesh(new THREE.CircleGeometry(R_END - 0.005, 32), lidMat);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = H - 0.03;
  lid.receiveShadow = true;
  g.add(lid);

  // borda da tampa, na cor do aro
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R_END, 0.03, 10, 36), bandMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H - 0.01;
  g.add(rim);

  // fundo (nao aparece, mas fecha o corpo)
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(R_END, 32),
    new THREE.MeshStandardMaterial({ color: 0x8c2a20 })
  );
  bottom.rotation.x = Math.PI / 2;
  g.add(bottom);

  return g;
}