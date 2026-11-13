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

Para ver o efeito das texturas com a luz, use a vista da largada (tecla 1) e alterne **L**, **K** e **0** (ver a seção "Texturas e iluminação").

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (BoxGeometry, CylinderGeometry, TorusGeometry, etc.) agrupadas em hierarquia. Todos usam a mesma estrutura ("Kart.js"), e as diferenças entre personagens ficam em "kartPresets.js".
- **Personagens** (Mario, Luigi, Peach e Bowser) carregados de arquivos ".gltf" baixados do Sketchfab. O loader faz um reparo nos materiais, nas texturas que vieram faltando e nas meshes espelhadas.
- **Rodas** giram em função da velocidade usando "ω = v/r".
- Como os modelos vêm em T-pose, "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um clipping plane horizontal para esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em "src/objects/". Cada um é uma função que retorna um THREE.Group.
- **Texturas** em karts, personagens, pista e obstáculos, com as coordenadas UV tratadas em cada caso (ver a seção "Texturas e mapeamento UV").
- **Variações de pista** (tecla Enter): as configurações ficam em "src/track/trackConfigd.js" (Circuito Tradicional, Deserto e Neon). Cada uma define os pontos de controle da curva, a largura e as cores, inclusive o filtro de cor aplicado sobre a foto do asfalto. Ao trocar, a pista, o grid de largada e os objetos são recriados, e os pilotos voltam às suas vagas.
- **Paisagens** em "src/scenery/": cada pista tem um tema ("scenery" no "trackConfigd.js") e uma cor de céu ("skyColor"). O campo tem montanhas com neve e pinheiros; o deserto, platôs, cactos e pedras; a cidade à noite, prédios com faixas de neon e postes. As peças ficam em "sceneryProps.js", feitas só com primitivas (cone, cilindro, caixa, esfera e dodecaedro) e materiais com cor, "flatShading" e, na cidade, emissivo (sem imagens). Geometrias e materiais são criados uma vez e compartilhados entre todas as cópias. "Scenery.js" espalha as peças de três formas (em anel no fundo, sorteadas pelo terreno ou ao longo da pista) e só aceita lugares que não encostam na pista nem em outra peça.
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

### Texturas e mapeamento UV

O projeto usa mais de três texturas, de origens diferentes:

| Textura | Origem | Onde é aplicada |
|---------|--------|-----------------|
| "TexturaLatariaCarroSuave.jpg" | imagem | capô, flancos e chassi dos karts |
| "BancoCarro.webp" | imagem | assento e encosto |
| "PneuLateral.jpg" e "RodaCarro.jpg" | imagem | banda de rodagem e tampas das rodas |
| "texturaAsfalto.avif" | imagem | asfalto das três pistas |
| "cone-hazard.svg" | SVG | base e corpo dos cones |
| "barrel-wood.svg" | SVG | barris |
| "tire-tread.svg" | SVG | pilhas de pneus |
| "oil-slick.svg" | SVG | manchas de óleo |
| logo do capô (letra, Bowser ou coroa) | canvas 2D | capô de cada kart |
| "?" da caixa de item | canvas 2D | caixas de item |
| xadrez e letreiro "START" | canvas 2D | faixa de largada e pórtico |
| "_diffuse.png" e "_normal.png" | arquivos dos modelos | Mario, Luigi, Peach e Bowser |

As imagens dos karts e do asfalto ficam em "public/textures/kart/" e são carregadas por "loadTexture" ("src/utils/loadTexture.js"), que já marca a textura como sRGB. Os SVGs dos obstáculos ficam em "public/textures/" e são carregados por "loadObstacleTexture" ("src/objects/loadObstacleTexture.js"), que guarda cada um num "Map" para as cópias do mesmo objeto compartilharem a textura. Os SVGs foram feitos pelo grupo.

As geometrias do Three.js já vêm com coordenadas UV normalizadas em [0, 1] (u e v dizem qual ponto da imagem cai em cada vértice). Elas aparecem de três formas:

- **UV pronta da geometria.** No barril ("LatheGeometry"), u percorre a volta e v sobe da base ao topo; as duas faixas escuras do SVG ficam perto de v = 0,22 e 0,78, na altura dos aros cinza. Na pilha de pneus ("TorusGeometry"), u corre ao longo do anel e v ao redor do tubo. A mancha de óleo e os logos usam "CircleGeometry", que mapeia o círculo inscrito no quadrado da imagem. Na caixa de item e no letreiro ("BoxGeometry"), cada face recebe a imagem inteira; no letreiro, a ordem das faces (+x, -x, +y, -y, +z, -z) põe a textura só nas duas faces grandes.
- **UV calculada à mão (asfalto).** A malha da pista é montada vértice a vértice em "Track._buildAsphalt()", e as UVs são calculadas lá: u vai de 0 até "trackWidth / 4" na largura e v conta quantas cópias da foto já couberam ao longo da curva ("u × comprimento / 4"). O tamanho fixo de 4 unidades por cópia ("ASPHALT_TILE") deixa o grão do mesmo tamanho nas três pistas. A foto repete espelhada ("MirroredRepeatWrapping"), para as bordas se encontrarem sem emenda, e usa filtragem anisotrópica (8), para não virar um borrão quando vista de longe.
- **UV ajustada com "repeat", "offset" e "rotation".** O cilindro da roda tem três grupos de faces (lateral e duas tampas) e recebe um array de materiais. A banda de rodagem é girada 90° e repetida 3 vezes ("repeat.set(1, 3)"). "RodaCarro.jpg" (600 x 600 px) tem três desenhos; a tampa usa só o quadrado da roda, que começa em x = 181 px, termina em y = 428 px e tem 393 px de lado: "repeat = 393/600" e "offset = (181/600, 1 - 428/600)" (o offset em y é medido de baixo para cima).

Nos personagens ".gltf" as UVs vêm dos próprios modelos, e "Character.js" corrige o que veio faltando:

- "_patchMissingMaps()" procura na pasta de texturas "<material>_diffuse.png", "_normal.png" e "_specularGlossiness.png" para os materiais que vieram sem mapa, com cache por URL. As texturas usam "flipY = false" (convenção do glTF) e "RepeatWrapping", porque algumas meshes do Luigi têm UV maior que 1.
- "_mirrorMaterialMap()" reaproveita a textura do lado esquerdo do Luigi no direito, invertendo u ("repeat.x = -1" e "offset.x = 1").
- "_fixMirroredMeshes()" inverte a ordem dos vértices das meshes com escala negativa, para a textura e a face visível ficarem do lado certo.

A lataria dos karts é uma cópia clareada de "TexturaLatariaCarro.avif" (misturada 50% com branco), para o desenho não competir com a cor do personagem. A textura é multiplicada pela cor do material, então a mesma imagem serve para os quatro karts. Pelo mesmo motivo, o "asphaltColor" de cada pista funciona como um filtro sobre a foto: branco no Circuito Tradicional, bege no Deserto e azul no Neon.

### Câmeras

Todo o sistema de câmeras está em "src/cameras/CameraManager.js". Cada vista tem a sua própria "PerspectiveCamera":

| Vista | FOV | Comportamento |
|-------|-----|---------------|
| Livre (teclas 1, 2 e 3) | 50° | OrbitControls, com posições pré-definidas na largada, no circuito inteiro e nos obstáculos |
| Perseguição (tecla 4) | 65° | 8 unidades atrás e 3,4 acima do Mario, com suavização (lerp) |
| Piloto (tecla 5) | 80° | Presa ao kart do Mario, na altura dos olhos |

O OrbitControls só fica ativo nas vistas livres. O HUD no canto da tela mostra a câmera ativa, a projeção e o FOV.

A matriz de projeção perspectiva é definida em "CameraManager._makeCamera()" ("new THREE.PerspectiveCamera(fov, aspect, near, far)", que chama "updateProjectionMatrix()") e recalculada em "resize()" e "changeFov()". Ela é aplicada em "renderer.render(scene, cameraManager.camera)", no loop de animação do "main.js", com "near = 0.1" e "far = 1000" (o valor alto inclui a paisagem ao fundo na vista geral). A tecla **P** troca para uma "OrthographicCamera" com o mesmo enquadramento no ponto de referência, só para comparar o efeito da perspectiva.

### Iluminação

As luzes ficam em "src/lighting/LightController.js", que cria as fontes e as guarda em "lights":

| Fonte | Tipo | Detalhes |
|-------|------|----------|
| "ambient" | AmbientLight | branca, intensidade 0,3 |
| "sun" | DirectionalLight | tom quente (0xfff5e6), intensidade 1,2, com sombras (mapa 4096) |
| "trackSpot" | SpotLight | azul (0x00aaff), intensidade 250 (compensa a queda com o quadrado da distância), alcance 60, cone de 36° e penumbra 0,5, com sombras (mapa 1024) |

A cada troca de pista, "setTrack()" reposiciona o sol e ajusta a câmera de sombra para caber a esfera que envolve o circuito (a sombra cobre a pista inteira) e põe o holofote sobre o grid, 16 unidades acima e 6 atrás da linha de largada. Além das luzes, a cena usa um mapa de ambiente ("RoomEnvironment") criado no "main.js", com intensidade 0,3, que ilumina as áreas sem luz direta (sem ele o Luigi ficava escuro). Ele não faz parte do "LightController" e continua ativo se as outras luzes forem desligadas.

Para isolar a contribuição de cada fonte, o controlador tem "toggleLight(nome, ligado)" e "setIntensity(nome, intensidade)". Os atalhos de teclado ficam em "setupKeyboardShortcuts()", chamado no construtor: **L** ambiente, **K** sol e **0** holofote.

### Texturas e iluminação

Todos os materiais texturizados são "MeshStandardMaterial", então a cor de cada pixel é a textura vezes a cor do material, iluminada pelas três luzes e pelo mapa de ambiente. O "roughness" e o "metalness" de cada material decidem quanto brilho aparece sobre a imagem:

- asfalto: "roughness 0,8", brilho fraco e espalhado; o holofote azul tinge o asfalto em volta da largada;
- lataria: "roughness 0,4", com brilho do sol sobre o desenho;
- banda do pneu: quase fosca ("roughness 0,9"); aro com "roughness 0,6" e a cor do preset;
- mancha de óleo: "roughness 0,12" e "metalness 0,4", o material mais brilhante da cena; é semitransparente, por isso usa "depthWrite = false" e "polygonOffset" para não piscar sobre o asfalto;
- cidade à noite: prédios e postes têm cor emissiva e brilham sem depender de luz, enquanto o asfalto azulado e os karts reagem ao holofote.

Com só a luz ambiente as texturas aparecem chapadas, sem volume. Com o sol aparecem os brilhos e as sombras projetadas sobre o asfalto. Com o holofote ligado, o grid ganha o círculo azul. A tecla **P** e o FOV não mudam isso, só o enquadramento.

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
    kartTextures.js         # carrega e recorta as texturas dos karts
    Character.js            # loader de personagem .gltf, com reparo de texturas e meshes
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
    loadTexture.js          # carrega imagens de public/textures/ (karts e asfalto)
public/
  textures/                 # SVGs dos obstáculos (cone-hazard, barrel-wood, tire-tread, oil-slick)
  textures/kart/            # imagens: lataria, banco, pneu, roda e asfalto
  models/mario/scene.gltf
  models/luigi/scene.gltf
  models/Peach/scene.gltf
  models/Bowser/scene.gltf
```

## Observações

- O relatório do trabalho está em [RELATORIO.md](RELATORIO.md).
- As peças da paisagem ainda não usam imagens, só cor, "flatShading" e material emissivo.
- Na pilha de pneus, o quadrado do SVG é esticado ao longo do anel (o contorno do anel é cerca de 2,6 vezes maior que o do tubo). Como o padrão é de losangos, o efeito é discreto.
- As imagens dos karts e do asfalto foram tiradas da internet e ainda não estão listadas em [public/CREDITS.md](public/CREDITS.md), que cobre só os modelos 3D.
- No modo demo todos os pilotos têm a mesma velocidade, então mantêm a formação do grid.
- Ainda não há movimento controlado pelo jogador, colisão, faróis nos karts, itens funcionais, som nem lógica de corrida. O modo demo só leva os pilotos por uma trajetória fixa.

## Créditos

Modelos 3D externos (também listados em [public/CREDITS.md](public/CREDITS.md)):

- **Mario**: "Mario Rig" (https://skfb.ly/oKECW) by plumbear106 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Luigi**: "SMG4 Luigi" (https://skfb.ly/oLxKv) by DokigerElRojito is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Peach**: "Peach Dancing from Super Mario" (https://skfb.ly/puCvG) by 3D by Renato👽 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Bowser**: "Bowser Animation 3d" (https://sketchfab.com/3d-models/bowser-animation-3d-a95381c0c9a64a24802cb7ca077c0667) by Vandacvi is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

Os karts, a pista e os objetos do cenário foram modelados pelo grupo com primitivas do Three.js, assim como os SVGs de textura dos obstáculos. As imagens das texturas dos karts e do asfalto foram tiradas da internet.
