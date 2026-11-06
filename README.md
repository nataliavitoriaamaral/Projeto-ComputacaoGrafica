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
| **+** / **-** | Diminui/aumenta o FOV da câmera ativa |
| **P** | Alterna perspectiva/ortográfica (só para comparar o efeito da perspectiva) |
| **H** | Esconde/mostra o HUD |

Na câmera livre: botão esquerdo gira, botão direito move e a roda dá zoom.

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (BoxGeometry, CylinderGeometry, TorusGeometry, etc.) agrupadas em hierarquia. Cores e detalhes diferentes por personagem (Mario vermelho com 3 escapamentos cilíndricos, Luigi verde com 2 escapamentos cônicos).
- **Personagens** carregados de arquivos ".gltf" baixados do Sketchfab. O loader faz um reparo nos materiais e nas meshes espelhadas que vieram quebradas.
- **Rodas** giram em função da velocidade usando 'ω = v/r'.
- Como os modelos vêm em T-pose , "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um clipping plane horizontal pra esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em "src/objects/". Cada um é uma função que retorna um THREE.Group.
- **Integração com a pista** usando pontos e tangentes da curva (getPointAt e getTangentAt) para posicionar e orientar pilotos e objetos. Deslocamentos laterais distribuem os elementos pela largura da pista. As caixas de item flutuam com "Math.sin" e giram no loop de animação. 
- **Modo demo** (tecla Espaço): cada piloto guarda a posição na curva (`userData.u`) e o deslocamento lateral (`userData.side`), e a cada frame avança 14 unidades por segundo pela pista. Serve para mostrar as câmeras de perseguição e de piloto em movimento, com as rodas girando de acordo com a velocidade.

### Câmeras

Todo o sistema de câmeras está em `src/cameras/CameraManager.js`. Cada vista tem a sua própria `PerspectiveCamera`:

| Vista | FOV | Comportamento |
|-------|-----|---------------|
| Livre (teclas 1, 2 e 3) | 50° | OrbitControls, com posições pré-definidas na largada, no circuito inteiro e nos obstáculos |
| Perseguição (tecla 4) | 65° | 8 unidades atrás e 3,4 acima do Mario, com suavização (lerp) |
| Piloto (tecla 5) | 80° | Presa ao kart do Mario, na altura dos olhos |

O OrbitControls só fica ativo nas vistas livres. O HUD no canto da tela mostra a câmera ativa, a projeção e o FOV.

A matriz de projeção perspectiva é definida em `CameraManager._makeCamera()` (`new THREE.PerspectiveCamera(fov, aspect, near, far)`, que chama `updateProjectionMatrix()`) e recalculada em `resize()` e `changeFov()`. Ela é aplicada em `renderer.render(scene, cameraManager.camera)`, no loop de animação do `main.js`. Com `near = 0.1` e `far = 500`. A tecla **P** troca para uma `OrthographicCamera` com o mesmo enquadramento no ponto de referência, só para comparar o efeito da perspectiva.

### Iluminação

As luzes ficam em `src/lighting/LightController.js`, que cria as fontes e as guarda em `lights`:

| Fonte | Tipo | Detalhes |
|-------|------|----------|
| `ambient` | AmbientLight | branca, intensidade 0,3 |
| `sun` | DirectionalLight | tom quente, intensidade 1,2, em (50, 100, 50), com sombras (mapa 2048) |
| `trackSpot` | SpotLight | azul, intensidade 2,0, em (0, 20, 0) sobre a linha de largada, com sombras |

Além delas, a cena usa um mapa de ambiente (`RoomEnvironment`) criado no `main.js`, que ilumina as áreas sem luz direta (sem ele o Luigi ficava escuro). Ele não faz parte do `LightController` e continua ativo se as outras luzes forem desligadas.

Para isolar a contribuição de cada fonte, o controlador tem `toggleLight(nome, ligado)` e `setIntensity(nome, intensidade)`. Existem também atalhos de teclado em `setupKeyboardShortcuts()` (**8** ambiente, **9** sol, **0** holofote), mas ainda não estão ligados no `main.js`.

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
    Track.js                # pista, grama, zebras, muros e faixa de largada
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
