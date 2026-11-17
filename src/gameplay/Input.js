// Leitura do teclado para entender o que o jogador quer fazer.
// A cada frame, vemos se uma tecla está sendo segurada, se acabou de ser
// apertada ou se acabou de ser solta.

export const MAPA_TECLAS = {
  acelerar:     ['ArrowUp', 'KeyW'],
  frear:        ['ArrowDown', 'KeyS'], // com o kart parado, segurar dá ré
  esquerda:     ['ArrowLeft', 'KeyA'],
  direita:      ['ArrowRight', 'KeyD'],
  pular:        ['Space', 'ShiftLeft', 'ShiftRight'], // segurando na curva vira drift
  painelFisica: ['KeyF'], // mostra/esconde o painel com os valores da física
};

export class Input {
  constructor(mapa = MAPA_TECLAS) {
    this.mapa = mapa;

    // Guardamos códigos de teclas em conjuntos
    this._seguradas = new Set(); // teclas que estão apertadas agora
    this._apertadas = new Set(); // teclas que foram apertadas neste frame
    this._soltas = new Set();    // teclas que foram soltas neste frame

    // todas as teclas usadas pelo jogo. Nelas cancelamos a ação padrão do
    // navegador, senão as setas e o espaço ficariam rolando a página
    this._teclasDoJogo = new Set(Object.values(mapa).flat());

    this._aoApertar = (evento) => {
      if (this._teclasDoJogo.has(evento.code)) evento.preventDefault();
      // quando a tecla fica segurada, o sistema repete o evento 
      if (evento.repeat) return;
      this._seguradas.add(evento.code);
      this._apertadas.add(evento.code);
    };

    this._aoSoltar = (evento) => {
      this._seguradas.delete(evento.code);
      this._soltas.add(evento.code);
    };

    // se a janela perde o foco com uma tecla apertada, o kart continuaria acelerando sozinho
    this._aoPerderFoco = () => this._seguradas.clear();

    window.addEventListener('keydown', this._aoApertar);
    window.addEventListener('keyup', this._aoSoltar);
    window.addEventListener('blur', this._aoPerderFoco);
  }

  // verifica se a tecla apertada corresponde a uma ação do jogo, como acelerar ou pular
  estaSegurada(acao) {
    return this.mapa[acao].some((codigo) => this._seguradas.has(codigo));
  }

  // verifica se a tecla foi apertada para pular, por exemplo
  foiApertada(acao) {
    return this.mapa[acao].some((codigo) => this._apertadas.has(codigo));
  }

  // verifica se a tecla foi solta, por exemplo para parar de acelerar
  foiSolta(acao) {
    return this.mapa[acao].some((codigo) => this._soltas.has(codigo));
  }

  // junta duas ações opostas num número: -1, 1 ou 0 
  eixo(acaoNegativa, acaoPositiva) {
    return (this.estaSegurada(acaoPositiva) ? 1 : 0) - (this.estaSegurada(acaoNegativa) ? 1 : 0);
  }

  // chamar no fim de cada frame, depois que todo mundo leu o teclado,
  // para "apertada" e "solta" valerem só por um frame
  fimDoFrame() {
    this._apertadas.clear();
    this._soltas.clear();
  }

  // remove os eventos do navegador 
  descartar() {
    window.removeEventListener('keydown', this._aoApertar);
    window.removeEventListener('keyup', this._aoSoltar);
    window.removeEventListener('blur', this._aoPerderFoco);
  }
}
