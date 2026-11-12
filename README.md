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
Para ver só o preview dos obstáculos e objetos, acesse "/obstaculos.html" no mesmo endereço.

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
| **0** | Liga/desliga o holofote da largada |
| **Enter** | Troca para a próxima variação de pista |
| **+** / **-** | Diminui/aumenta o FOV da câmera ativa |
| **P** | Alterna perspectiva/ortográfica (só para comparar o efeito da perspectiva) |
| **H** | Esconde/mostra o HUD |

Na câmera livre: botão esquerdo gira, botão direito move e a roda dá zoom.

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (BoxGeometry, CylinderGeometry, TorusGeometry, etc.) agrupadas em hierarquia. Todos usam a mesma estrutura ("Kart.js"), e as diferenças entre personagens ficam em "kartPresets.js".
- **Personagens** (Mario, Luigi, Peach e Bowser) carregados de arquivos ".gltf" baixados do Sketchfab. O loader faz um reparo nos materiais e nas meshes espelhadas que vieram quebradas.
- **Rodas** giram em função da velocidade usando "ω = v/r".
- Como os modelos vêm em T-pose, "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um clipping plane horizontal para esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em "src/objects/". Cada um é uma função que retorna um THREE.Group.
- **Texturas dos obstáculos**: cones, barris, pneus e manchas de óleo usam imagens SVG em "public/textures/", aplicadas como mapas dos materiais iluminados. As geometrias "CylinderGeometry", "LatheGeometry", "TorusGeometry", "BoxGeometry" e "CircleGeometry" geram coordenadas UV normalizadas no intervalo [0, 1]; o eixo U percorre a superfície ao redor das peças curvas, e V percorre sua altura ou seção. As peças foram ampliadas sem invadir as faixas de circulação. Use "/obstaculos.html" para observar os materiais sob luz e sombra.
- **Variações de pista** (tecla Enter): as configurações ficam em "src/track/trackConfigd.js" (Circuito Tradicional, Deserto e Neon). Cada uma define os pontos de controle da curva, a largura e as cores. Ao trocar, a pista, o grid de largada e os objetos são recriados, e os pilotos voltam às suas vagas.
- **Paisagens** em "src/scenery/": cada pista tem um tema ("scenery" no "trackConfigd.js") e uma cor de céu ("skyColor"). O campo tem montanhas com neve e pinheiros; o deserto, platôs, cactos e pedras; a cidade à noite, prédios com faixas de neon e postes. As peças ficam em "sceneryProps.js", feitas só com primitivas (cone, cilindro, caixa, esfera e dodecaedro). Geometrias e materiais são criados uma vez e compartilhados entre todas as cópias. "Scenery.js" espalha as peças de três formas (em anel no fundo, sorteadas pelo terreno ou ao longo da pista) e só aceita lugares que não encostam na pista nem em outra peça.
- **Pórtico de largada** em cima da linha de chegada: dois postes (CylinderGeometry) e uma faixa (BoxGeometry) com o letreiro "START" desenhado num canvas.
- **Grid de largada** em zigue-zague, como no Mario Kart, com uma marca branca em cada vaga ("src/track/StartingGrid.js").
- **Integração com a pista** usando pontos e tangentes da curva (getPointAt e getTangentAt) para posicionar e orientar pilotos e objetos. Deslocamentos laterais distribuem os elementos pela largura da pista. As caixas de item flutuam com "Math.sin" e giram no loop de animação. 
- **Modo demo** (tecla Espaço): cada piloto guarda a posição na curva ("userData.u") e o deslocamento lateral ("userData.side"), e a cada frame avança 14 unidades por segundo pela pista. Serve para mostrar as câmeras de perseguição e de piloto em movimento, com as rodas girando de acordo com a velocidade.

### Personagens e karts

Ordem no grid: Mario, Luigi, Peach e Bowser.

Os karts da Peach e do Bowser foram inspirados nos karts de brinquedo dos personagens. O da Peach é rosa, com uma coroa no capô e outra atrás do banco. O do Bowser é amarelo e verde, tem espinhos nas laterais, não tem encosto (o casco fica apoiado na traseira) e é 20% maior que os outros.

Arquivos em "src/characters/":

- "Kart.js": estrutura do kart, igual para todos
- "kartPresets.js": cores e opções de cada kart
- "kartEmblems.js": logos do capô, desenhados em canvas
- "kartDecorations.js": espinhos e coroa
- "kartTextures.js": texturas

O personagem é colocado no banco com o quadril afundado, e um clipping plane esconde as pernas. O capô vai até a frente do piloto e cobre a parte cortada. As mãos chegam ao volante por IK de dois ossos (lei dos cossenos).

Alguns ajustes são específicos de cada personagem. Os braços da Peach são curtos, então o volante dela fica mais perto do banco ("steeringOffsetZ"). O modelo do Bowser vem curvado para frente; a coluna dele é girada 40° para trás ("posture") e ele senta mais alto que os outros ("hipFraction").

### Texturas

As imagens ficam em "public/textures/kart/" e são carregadas em "kartTextures.js" com "TextureLoader". 

- Lataria ("TexturaLatariaCarroSuave.jpg"): carroceria e capô. A textura é multiplicada pela cor do material, então a mesma imagem clara serve para todos os karts. Essa é uma cópia clareada de "TexturaLatariaCarro.avif" (misturada 50% com branco), para o efeito ficar mais leve.
- Banco ("BancoCarro.webp"): assento e encosto.
- Pneu: o cilindro tem três grupos de faces e recebe um array de materiais. A lateral usa "PneuLateral.jpg", girada 90° e repetida 3 vezes; as tampas usam a roda da imagem "RodaCarro.jpg", recortada com "offset" e "repeat".

### Câmeras

Todo o sistema de câmeras está em "src/cameras/CameraManager.js". Cada vista tem a sua própria "PerspectiveCamera":

| Vista | FOV | Comportamento |
|-------|-----|---------------|
| Livre (teclas 1, 2 e 3) | 50° | OrbitControls, com posições pré-definidas na largada, no circuito inteiro e nos obstáculos |
| Perseguição (tecla 4) | 65° | 8 unidades atrás e 3,4 acima do Mario, com suavização (lerp) |
| Piloto (tecla 5) | 80° | Presa ao kart do Mario, na altura dos olhos |

O OrbitControls só fica ativo nas vistas livres. O HUD no canto da tela mostra a câmera ativa, a projeção e o FOV.

A matriz de projeção perspectiva é definida em "CameraManager._makeCamera()" ("new THREE.PerspectiveCamera(fov, aspect, near, far)", que chama "updateProjectionMatrix()") e recalculada em "resize()" e "changeFov()". Ela é aplicada em "renderer.render(scene, cameraManager.camera)", no loop de animação do "main.js". Com "near = 0.1" e "far = 500". A tecla **P** troca para uma "OrthographicCamera" com o mesmo enquadramento no ponto de referência, só para comparar o efeito da perspectiva.

### Iluminação

As luzes ficam em "src/lighting/LightController.js", que cria as fontes e as guarda em "lights":

| Fonte | Tipo | Detalhes |
|-------|------|----------|
| "ambient" | AmbientLight | branca, intensidade 0,3 |
| "sun" | DirectionalLight | tom quente, intensidade 1,2, em (50, 100, 50), com sombras (mapa 2048) |
| "trackSpot" | SpotLight | azul, intensidade 2,0, em (0, 20, 0) sobre a linha de largada, com sombras |

Além delas, a cena usa um mapa de ambiente ("RoomEnvironment") criado no "main.js", que ilumina as áreas sem luz direta (sem ele o Luigi ficava escuro). Ele não faz parte do "LightController" e continua ativo se as outras luzes forem desligadas.

Para isolar a contribuição de cada fonte, o controlador tem "toggleLight(nome, ligado)" e "setIntensity(nome, intensidade)". Os atalhos de teclado ficam em "setupKeyboardShortcuts()", chamado no construtor: **L** ambiente, **K** sol e **0** holofote.

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
    Kart.js                 # kart procedural (estrutura comum)
    kartPresets.js          # cores e estilo do kart de cada personagem
    kartEmblems.js          # logos do capô desenhados em canvas
    kartDecorations.js      # enfeites: espinhos (Bowser) e coroa (Peach)
    kartTextures.js         # carrega as texturas dos karts
    Character.js            # loader de personagem .gltf (Mario, Luigi, Peach, Bowser)
    Racer.js                # junta kart + personagem e coloca as mãos no volante
  objects/                  # cone, barril, pneus, caixa de item, óleo
    loadObstacleTexture.js  # carrega as texturas SVG dos obstáculos
  track/
    Track.js                # pista, grama, zebras, muros, faixa e pórtico de largada
    trackConfigd.js         # as três pistas: pontos da curva, largura, cores, céu e paisagem
    StartingGrid.js         # grid de largada em zigue-zague e marcas das vagas
  scenery/
    sceneryProps.js         # peças da paisagem (árvore, montanha, cacto, pedra, platô, prédio, poste)
    Scenery.js              # escolhe as peças de cada tema e espalha em volta da pista
  utils/
    dispose.js              # libera geometrias e materiais da GPU ao trocar de pista
public/
  textures/                 # texturas SVG dos obstáculos (cone, barril, pneu, óleo)
  textures/kart/            # imagens das texturas dos karts
  models/mario/scene.gltf
  models/luigi/scene.gltf
  models/Peach/scene.gltf
  models/Bowser/scene.gltf
```

## Observações

- O relatório do trabalho está em [RELATORIO.md](RELATORIO.md).
- Os atalhos de luz (8, 9 e 0) não funcionam por enquanto: "setupKeyboardShortcuts()" não é chamado no "main.js" e a tecla 0 aponta para "lights.spot", que não existe (a luz se chama "trackSpot").
- A câmera de sombra do sol está com o tamanho padrão do Three.js, então as sombras só aparecem perto da largada. A configuração antiga, que cobria o circuito inteiro, está comentada no "main.js".
- No modo demo todos os pilotos têm a mesma velocidade, então mantêm a formação do grid.
- Ainda não há movimento controlado pelo jogador, colisão, itens funcionais, som nem lógica de corrida. O modo demo só leva os pilotos por uma trajetória fixa.

## Créditos

Modelos 3D externos (também listados em [public/CREDITS.md](public/CREDITS.md)):

- **Mario**: "Mario Rig" (https://skfb.ly/oKECW) by plumbear106 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Luigi**: "SMG4 Luigi" (https://skfb.ly/oLxKv) by DokigerElRojito is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Peach**: "Peach Dancing from Super Mario" (https://skfb.ly/puCvG) by 3D by Renato👽 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Bowser**: "Bowser Animation 3d" (https://sketchfab.com/3d-models/bowser-animation-3d-a95381c0c9a64a24802cb7ca077c0667) by Vandacvi is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

Os karts, a pista e os objetos do cenário foram modelados pelo grupo com primitivas do Three.js. As imagens das texturas dos karts foram tiradas da internet.
