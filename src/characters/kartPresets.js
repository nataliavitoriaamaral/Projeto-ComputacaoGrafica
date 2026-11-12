// kartPresets.js
// Cores e detalhes do kart de cada personagem. A geometria é a mesma para
// todos e fica em Kart.js.
//
// bodyColor: capô e flancos       accentColor: faixa lateral e placa inferior
// lowerColor: chassi
// rimColor: aro das rodas         emblem: logo do capô (kartEmblems.js)
// exhaustStyle: 'triple' ou 'twinCone'
// exhaustPipeColor / exhaustTipColor: cano e ponta do escapamento
// decorations: enfeites extras (kartDecorations.js)
// scale: escala do kart inteiro
// seatBackHeight (opcional): altura do encosto, padrão 0.58; 0 remove o encosto
// steeringOffsetZ (opcional): deslocamento do volante no eixo Z, padrão 0

export const KART_PRESETS = {
  mario: {
    bodyColor:        0xC8102E,
    accentColor:      0xFFFFFF,
    lowerColor:       0x1A3A8E,
    rimColor:         0xF0E2A0,
    emblem:           { type: 'letter', letter: 'M', color: 0xC8102E },
    exhaustStyle:     'triple',
    exhaustPipeColor: 0x9A9A9A,
    exhaustTipColor:  0xB8B8B8,
    decorations:      [],
    scale:            1,
  },

  luigi: {
    bodyColor:        0x2EB82E,
    accentColor:      0xFFFFFF,
    lowerColor:       0x3A2A8E,
    rimColor:         0xF0E2A0,
    emblem:           { type: 'letter', letter: 'L', color: 0x2EB82E },
    exhaustStyle:     'twinCone',
    exhaustPipeColor: 0x9A9A9A,
    exhaustTipColor:  0xE8D647,
    decorations:      [],
    scale:            1,
  },

  // baseado no Standard Kart do Bowser (Hot Wheels)
  bowser: {
    bodyColor:        0xF2C200,
    accentColor:      0x111111,
    lowerColor:       0x3F7A1E,
    rimColor:         0xE8E26A,
    emblem:           { type: 'bowser' },
    exhaustStyle:     'twinCone',
    exhaustPipeColor: 0x151515,
    exhaustTipColor:  0xF2C200,
    decorations:      ['spikes'],
    scale:            1.2, // o modelo do Bowser é maior que os demais
    seatBackHeight:   0,     // sem encosto: o casco fica apoiado na traseira
  },

  // baseado no Standard Kart da Peach (Carrera)
  peach: {
    bodyColor:        0xF29BC4,
    accentColor:      0xFFFFFF,
    lowerColor:       0xF2C200,
    rimColor:         0xF2C200,
    emblem:           { type: 'crown' },
    exhaustStyle:     'twinCone',
    exhaustPipeColor: 0x151515,
    exhaustTipColor:  0xF2C200,
    decorations:      ['crown'],
    scale:            1,
    steeringOffsetZ:  -0.15, // braços curtos: volante mais perto do banco
  },
};
