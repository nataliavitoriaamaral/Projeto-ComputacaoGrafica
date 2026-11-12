// trackConfigs.js
import * as THREE from 'three';

export const TRACK_CONFIGS = [
  {
    id: 'standard',
    name: 'Circuito Tradicional',
    trackWidth: 12,
    groundColor: 0x2e8b57,  // Grama verde
    asphaltColor: 0x2b2b2b, // Asfalto escuro
    kerbRed: 0xc8102e,
    kerbWhite: 0xffffff,
    wallColor: 0x888888,
    skyColor: 0x87ceeb,     // céu azul
    scenery: 'campo',       // tema da paisagem (src/scenery/Scenery.js)
    controlPoints: [
      new THREE.Vector3(  0, 0,   0),
      new THREE.Vector3( 50, 0,  20),
      new THREE.Vector3( 90, 0, -30),
      new THREE.Vector3( 50, 0, -90),
      new THREE.Vector3(-30, 0, -80),
      new THREE.Vector3(-70, 0, -20),
      new THREE.Vector3(-40, 0,  30),
    ]
  },
  {
    id: 'desert',
    name: 'Circuito Deserto',
    trackWidth: 14,
    groundColor: 0xedc9af,  // Areia
    asphaltColor: 0x3a3532, // Asfalto poeirento
    kerbRed: 0xd97706,     // Zebra Laranja
    kerbWhite: 0xfef3c7,   // Zebra Bege
    wallColor: 0x9a3412,   // Muros tom terracota
    skyColor: 0xf3c98b,    // céu alaranjado, fim de tarde
    scenery: 'deserto',
    controlPoints: [
      new THREE.Vector3(  0, 0,   0),
      new THREE.Vector3( 80, 0,   0),
      new THREE.Vector3(120, 0, -30),
      new THREE.Vector3(100, 0, -90),
      new THREE.Vector3( 30, 0, -110),
      new THREE.Vector3(-50, 0, -60),
    ]
  },
  {
    id: 'cyberpunk',
    name: 'Circuito Neon / Noite',
    trackWidth: 12,
    groundColor: 0x050515,  // Chão quase preto
    asphaltColor: 0x111827, // Asfalto azulado escuro
    kerbRed: 0xff007f,     // Neon Rosa
    kerbWhite: 0x00f0ff,   // Neon Cyan
    wallColor: 0x4c1d95,   // Muro Roxo
    skyColor: 0x0b0b1e,    // noite
    scenery: 'cidade',
    controlPoints: [
      new THREE.Vector3(  0, 0,   0),
      new THREE.Vector3( 60, 0,  40),
      new THREE.Vector3( 100, 0,   0),
      new THREE.Vector3( 60, 0, -60),
      new THREE.Vector3(  0, 0, -40),
      new THREE.Vector3(-60, 0, -80),
      new THREE.Vector3(-60, 0,  10),
    ]
  }
];