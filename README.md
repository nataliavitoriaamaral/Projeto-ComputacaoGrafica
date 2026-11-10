# Mario Kart 3D

Trabalho de computação gráfica. Versão simplificada de Mario Kart em 3D feita com Three.js.

## Como rodar

Precisa do Node.js 20.19+ ou 22.12+ instalado (exigência do Vite 8).

```bash
npm install
npm run dev
```

Abre o endereço que o Vite imprimir no terminal (geralmente "http://localhost:5173").

A página inicial mostra a pista com os pilotos e os objetos do cenário integrados.
Para ver só o preview dos obstáculos e objetos, acesse `/obstaculos.html` no mesmo endereço.

## Controles

| Tecla | Ação |
|-------|------|
| **1** / **2** / **3** | Câmera livre (OrbitControls): largada, circuito completo, trecho com obstáculos |
| **4** | Câmera de perseguição (3ª pessoa) atrás do Mario |
| **5** | Câmera do piloto (1ª pessoa) |
| **C** | Próxima câmera |
| **Espaço** | Liga/desliga o modo demo (os pilotos andam pela pista) |
| **L** | Liga/desliga a luz ambiente |
| **K** | Liga/desliga a luz direcional (sol e sombras) |
| **+** / **-** | Diminui/aumenta o FOV da câmera ativa |
| **P** | Alterna perspectiva/ortográfica (só para comparar o efeito da perspectiva) |
| **H** | Esconde/mostra o HUD |

Na câmera livre: botão esquerdo gira, botão direito move e a roda dá zoom.

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (`BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, etc.) agrupadas em hierarquia. Cores e detalhes diferentes por personagem (Mario vermelho com 3 escapamentos cilíndricos, Luigi verde com 2 escapamentos cônicos).
- **Personagens** carregados de arquivos `.gltf` baixados do Sketchfab (licença CC-BY, créditos abaixo). O loader faz um reparo nos materiais e nas meshes espelhadas que vieram quebradas.
- **Rodas** giram em função da velocidade usando `ω = v/r`.
- Como os modelos vêm em T-pose (pernas retas), "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um `clipping plane` horizontal pra esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em `src/objects/`. Cada um é uma função que retorna um `THREE.Group`.
- **Texturas dos obstáculos**: cones, barris, pneus e manchas de óleo usam imagens SVG em `public/textures/`, aplicadas como mapas dos materiais iluminados. As geometrias `CylinderGeometry`, `LatheGeometry`, `TorusGeometry`, `BoxGeometry` e `CircleGeometry` geram coordenadas UV normalizadas no intervalo [0, 1]; o eixo U percorre a superfície ao redor das peças curvas, e V percorre sua altura ou seção. As peças foram ampliadas sem invadir as faixas de circulação. Use `/obstaculos.html` para observar os materiais sob luz e sombra.

## Estrutura

```
src/
  main.js                   # integra pista, pilotos, objetos, luz e câmeras
  cameras/
    CameraManager.js        # câmeras, projeção perspectiva, HUD e teclas
  lighting/
    LightController.js      # luz ambiente, direcional (sol) e spot
  preview-obstaculos.js     # cena separada para visualizar os objetos
  characters/
    Kart.js                 # kart procedural
    Character.js            # loader de personagem .gltf
    Racer.js                # junta kart + personagem 
  objects/                  # cone, barril, pneus, caixa de item, óleo
  track/
    Track.js                # pista, grama, zebras, muros, faixa e pórtico de largada
public/
  models/mario/scene.gltf
  models/luigi/scene.gltf
```

## Observações

- O relatório do trabalho está em [RELATORIO.md](RELATORIO.md).
- As mãos dos personagens atravessam a lateral da carroceria, porque os modelos vêm em T-pose e ainda não mexemos nos ossos dos braços.
- Os atalhos de luz (8, 9 e 0) não funcionam por enquanto: `setupKeyboardShortcuts()` não é chamado no `main.js` e a tecla 0 aponta para `lights.spot`, que não existe (a luz se chama `trackSpot`).
- A câmera de sombra do sol está com o tamanho padrão do Three.js, então as sombras só aparecem perto da largada. A configuração antiga, que cobria o circuito inteiro, está comentada no `main.js`.
- Ainda não há movimento controlado pelo jogador, colisão, itens funcionais, som nem lógica de corrida. O modo demo só leva os pilotos por uma trajetória fixa.
