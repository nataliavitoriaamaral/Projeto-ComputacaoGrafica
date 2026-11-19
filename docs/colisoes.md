# Colisões e sons - integração da parte 3

O `main.js` desta branch já conecta colisões e sons ao jogador e à IA.
Os efeitos de óleo usam a função `applyEffect()` que os dois controles já implementam.
Caixas, bananas e cascos continuam sob responsabilidade de `Items.js`, evitando duas detecções para o mesmo item.

## API para a integração final

```js
const collisions = new Collision({ scene, track, racers, obstacles, game });
const sounds = new Sounds({ racers });
sounds.connect(collisions);
sounds.connect(items); // quando o sistema de itens estiver integrado
```

As listas `racers` e `obstacles` são compartilhadas com a cena. O `game` é opcional e pode ser atribuído depois com `collisions.game = game`.
`sounds.connect()` aceita tanto `Items` quanto `Game`, usando seus métodos `on()`.
Conectar uma única origem por evento: se `Game` já recebe eventos de itens e colisões, usar `sounds.connect(game)` no lugar das duas conexões acima.

Quando cada controle for criado:

```js
collisions.register(racer, controller);
```

O registro reconhece o muro já tratado pelo `PlayerController`, evitando reduzir a velocidade duas vezes, e atualiza o alvo da câmera após um empurrão.

## Ordem no loop

Depois de movimentar jogador e rivais, verificar as colisões. Antes da renderização, atualizar a câmera e aplicar o tremor:

```js
collisions.update(delta, corridaAtiva);
// atualizações dos pilotos e itens permanecem no loop do jogo
cameraManager.update(delta);
collisions.updateCamera(cameraManager.camera);
sounds.update(cameraManager.camera, corridaAtiva);
renderer.render(scene, cameraManager.camera);
```

`corridaAtiva` é o booleano definido pelo sistema de regras. Durante menu, pausa, contagem e fim, passar `false`: não há novos impactos nem avanço das animações de colisão, e o motor fica silencioso.

Ao trocar de pista, chamar `collisions.setTrack(track)` depois de recriar os obstáculos.
Ao reiniciar a mesma corrida, chamar `collisions.reset()` e `sounds.reset()`, além dos resets de controles e itens. O reset restaura cones, remove partículas e limpa contatos e impulsos anteriores.

## Evento para a pontuação

O sistema chama `game.emit('collision', dados)` e também oferece `collisions.on('collision', fn)` para testes isolados.

| Campo | Conteúdo |
|-------|----------|
| `racer` | Piloto que sofreu a colisão |
| `obstacle` | Objeto atingido, ou `null` |
| `other` | Outro piloto, em colisão entre karts, ou `null` |
| `type` | `cone`, `barrel`, `tires`, `oil`, `kart` ou `wall` |
| `speed` | Módulo da velocidade antes da consequência aplicada por Collision |
| `speedAfter` | Velocidade após a consequência |

No muro, o jogador já passou pela resposta da própria física antes deste evento.
Uma colisão entre karts emite um evento por piloto, permitindo aplicar a penalidade individual.
Não somar novamente pontos pelo mesmo evento local se ele já foi encaminhado ao `game`.
Os valores da penalidade pertencem ao sistema de pontuação; `Collision` apenas informa o impacto.

## Testar

- `node --test tests/collision.test.js tests/sounds.test.js`: detecção, consequências, massa, intervalos, retorno dos cones, reset, pausa e buffers/eventos de áudio.
- `/tests/collision-browser.html`: botões para reproduzir cada impacto com Mario e Bowser reais, partículas, câmera e sons. A página é de teste e não altera a corrida principal.
- Na página inicial: setas/WASD controlam Mario, **M** liga os rivais e **V** controla o som.

Os sons são sintetizados em buffers e reproduzidos pelo Three.js; não há arquivos de áudio externos a copiar ou creditar.
As partes de moedas e itens só passam a emitir seus sons na corrida quando o sistema de itens for conectado, conforme o exemplo acima.
