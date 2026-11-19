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
| **↑** / **W** | Acelera o kart do Mario |
| **↓** / **S** | Freia (com o kart parado, segurar dá ré) |
| **←** / **A** e **→** / **D** | Vira o kart |
| **Espaço** / **Shift** | Pula; segurando na curva vira drift |
| **E** / **X** | Usa o item guardado (cogumelo, casco verde ou banana) |
| **F** | Mostra/esconde o painel com os valores da física |
| **Esc** | Pausa e continua a corrida (trocar de aba também pausa) |
| **R** | Reinicia a corrida (vai direto para a contagem regressiva) |
| **1** / **2** / **3** | Câmera livre (OrbitControls): largada, circuito completo, trecho com obstáculos |
| **4** | Câmera de perseguição (3ª pessoa) atrás do Mario |
| **5** | Câmera do piloto (1ª pessoa) |
| **C** | Próxima câmera |
| **L** | Liga/desliga a luz ambiente |
| **K** | Liga/desliga a luz direcional (sol e sombras) |
| **0** | Liga/desliga o holofote da largada |
| **Enter** | Começa a corrida no menu e joga de novo na tela final |
| **+** / **-** | Diminui/aumenta o FOV da câmera ativa |
| **P** | Alterna perspectiva/ortográfica (só para comparar o efeito da perspectiva) |
| **H** | Esconde/mostra o painel de ajuda das câmeras (canto superior direito) |

Na câmera livre: botão esquerdo gira, botão direito move e a roda dá zoom.

Para ver o efeito das texturas com a luz, use a vista da largada (tecla 1) e alterne **L**, **K** e **0** (ver a seção "Texturas e iluminação").

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (BoxGeometry, CylinderGeometry, TorusGeometry, etc.) agrupadas em hierarquia. Todos usam a mesma estrutura ("Kart.js"), e as diferenças entre personagens ficam em "kartPresets.js".
- **Personagens** (Mario, Luigi, Peach e Bowser) carregados de arquivos ".gltf" baixados do Sketchfab. O loader faz um reparo nos materiais, nas texturas que vieram faltando e nas meshes espelhadas.
- **Rodas** giram em função da velocidade usando "ω = v/r".
- Como os modelos vêm em T-pose, "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um clipping plane horizontal para esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em "src/objects/". Cada um é uma função que retorna um THREE.Group.
- **Texturas** em karts, personagens, pista e obstáculos, com as coordenadas UV tratadas em cada caso (ver a seção "Texturas e mapeamento UV").
- **Variações de pista** (escolhidas no menu inicial): as configurações ficam em "src/track/trackConfigd.js" (Circuito Tradicional, Deserto e Neon). Cada uma define os pontos de controle da curva, a largura e as cores, inclusive o filtro de cor aplicado sobre a foto do asfalto. Ao trocar, a pista, o grid de largada e os objetos são recriados, e os pilotos voltam às suas vagas.
- **Paisagens** em "src/scenery/": cada pista tem um tema ("scenery" no "trackConfigd.js") e uma cor de céu ("skyColor"). O campo tem montanhas com neve e pinheiros; o deserto, platôs, cactos e pedras; a cidade à noite, prédios com faixas de neon e postes. As peças ficam em "sceneryProps.js", feitas só com primitivas (cone, cilindro, caixa, esfera e dodecaedro) e materiais com cor, "flatShading" e, na cidade, emissivo (sem imagens). Geometrias e materiais são criados uma vez e compartilhados entre todas as cópias. "Scenery.js" espalha as peças de três formas (em anel no fundo, sorteadas pelo terreno ou ao longo da pista) e só aceita lugares que não encostam na pista nem em outra peça.
- **Pórtico de largada** em cima da linha de chegada: dois postes (CylinderGeometry) e uma faixa (BoxGeometry) com o letreiro "START" desenhado num canvas.
- **Grid de largada** em zigue-zague, como no Mario Kart, com uma marca branca em cada vaga ("src/track/StartingGrid.js").
- **Integração com a pista** usando pontos e tangentes da curva (getPointAt e getTangentAt) para posicionar e orientar pilotos e objetos. Deslocamentos laterais distribuem os elementos pela largura da pista. Cada piloto guarda a posição na curva ("userData.u") e o deslocamento lateral ("userData.side").
- **Controle do jogador** ("src/gameplay/PlayerController.js" e "Input.js"): aceleração, freio, ré, curva, pulo e drift do kart do Mario, com partículas no drift ("ParticulasKart.js").
- **Rivais com IA** ("src/gameplay/AIController.js"): Luigi, Peach e Bowser seguem a pista, desviam dos obstáculos e das bananas e usam itens. Têm três dificuldades (tecla N).
- **Itens e coletáveis** ("src/gameplay/Items.js"; ver a seção "Itens e coletáveis").

### Itens e coletáveis

Tudo é controlado por "src/gameplay/Items.js", recriado a cada troca de pista com "items.setTrack(track)". Os modelos ficam em "src/objects/" e são feitos só com primitivas:

- "Coin.js": cilindro achatado, toro (aro) e caixa fina, com material dourado metálico e um pouco emissivo;
- "GreenShell.js": meia esfera com textura de hexágonos desenhada em canvas, toro e cilindro brancos;
- "Banana.js": três arcos de toro (as abas da casca), uma esfera esticada e um cilindro (o cabinho).

Moedas e bananas compartilham geometrias e materiais entre todas as cópias.

Funcionamento:

- **Moedas**: ficam em fileiras pela pista e voltam 10 s depois de pegas. Cada moeda aumenta 2% a velocidade máxima, até 10 moedas. Ser atingido por um item faz perder 1 moeda.
- **Caixas de item**: duas fileiras de três caixas (u = 0,15 e 0,55). Ao quebrar uma, a roleta gira por 1,8 s e sorteia cogumelo, casco verde ou banana. Quem já tem item só quebra a caixa. A caixa volta depois de 3 s.
- **Cogumelo**: turbo de 1,5 s.
- **Casco verde**: sai em linha reta na direção do nariz do kart, quica nos muros (até 6 vezes) e some depois de 7 s. Quem é atingido fica atordoado.
- **Banana**: fica atrás do kart. Quem passa por cima roda, a não ser que esteja pulando. As bananas entram na lista de obstáculos que a IA desvia, e no máximo 8 ficam na pista ao mesmo tempo.

A colisão é por proximidade: cada objeto tem um raio, e a cada frame a distância ao quadrado no plano XZ é comparada com cada kart (sem raiz quadrada). Os objetos usam o mesmo par "u"/"side" dos karts para se posicionar na pista ("getPointAt(u) + N × side"). O casco faz duas verificações por frame para não atravessar um kart por estar rápido demais. Um quadro no canto superior direito mostra o item do jogador; durante a roleta os ícones vão trocando e a borda fica amarela.

### Regras da corrida, pontuação e telas

Arquivos: "src/gameplay/Game.js" (regras, sem DOM), "src/ui/HUD.js" (telas) e a integração no "main.js".

**Estados.** O jogo passa por "menu" → "countdown" → "racing" → "finished", com "paused" em qualquer momento da corrida. No menu o jogador escolhe a pista e a dificuldade dos rivais e vê o recorde. A contagem é 3, 2, 1, JÁ!, com os karts parados; só no JÁ! o jogador e a IA são liberados. Ao trocar de aba ou de janela a corrida pausa sozinha.

**Voltas e checkpoints.** A corrida tem 3 voltas. A pista é dividida em 8 trechos (checkpoints, o último é a linha de chegada) e cada piloto precisa passar por todos em ordem para a volta contar. Como os karts largam atrás da linha, a primeira passagem por ela não conta volta. Andar de ré não adianta nada, porque o progresso diminui junto, e o HUD avisa "CONTRAMÃO". Um salto repentino de "u" (teleporte, troca de pista) é ignorado em vez de virar volta.

**Posição.** Calculada a cada frame pelo progresso contínuo na pista (voltas + fração). Quem já terminou fica à frente, na ordem de chegada. A corrida do jogador acaba quando ele termina as 3 voltas: a posição dele é a ordem em que cruzou a linha.

**Pontuação.**

| Origem | Pontos |
|--------|--------|
| Moeda coletada | +10 |
| Item que acertou um rival (evento "itemHit") | +100 |
| Batida em que o jogador participa (evento "collision") | −25, com intervalo de 0,8 s entre batidas |
| Bônus pela posição final | 1º: 1000, 2º: 600, 3º: 300, 4º: 100 |
| Bônus de tempo | +10 por segundo abaixo do tempo de referência (3 voltas a 16 u/s) |

A pontuação na tela nunca fica negativa. Só pontuam eventos que acontecem com a corrida valendo (nada na contagem, na pausa ou depois do fim), e só os do jogador.

**Vitória e derrota.** Terminar em 1º mostra "VITÓRIA!"; em qualquer outra posição, "DERROTA". Nos dois casos a tela mostra o pódio, o ranking com os tempos, o detalhe da pontuação e se bateu o recorde. Os botões e as teclas **R** e **Enter** reiniciam.

**Recorde.** A maior pontuação e a melhor volta de cada pista ficam no "localStorage" do navegador (chave "mariokart3d:recordes"). Se o navegador bloquear o armazenamento, o jogo continua normalmente, só sem salvar.

**HUD.** Volta, posição, tempo, melhor volta, pontos, moedas (de 0 a 10, as que dão bônus de velocidade), item atual (ou a roleta girando) e um minimapa com a pista e os 4 pilotos. Avisos rápidos aparecem no topo ("+10", "ACERTOU!", "BATIDA", tempo de cada volta).

**Contrato com os outros sistemas** (combinado no grupo):

- "racer.userData": "u", "side", "speed", "isPlayer" e "state" são escritos pelos controllers. O "Game.js" escreve "lap" (voltas completas, de 0 a 3) e "position" (1 a 4).
- "game.emit(evento, dados)" e "game.on(evento, fn)". Eventos que o jogo escuta: "coin { racer }", "itemHit { attacker, target, item }" e "collision { racer, other }". O "collision" vale para qualquer batida em que o jogador seja "racer", "other", "a", "b", "target" ou "attacker". Eventos que o jogo emite: "lap", "finish", "state", "countdown", "start", "wrongWay" e "record".
- O "main.js" carrega "src/gameplay/Collision.js" sozinho quando o arquivo existir e exportar uma classe "Collision" (ver o comentário no "main.js" para o que ela recebe). Sem ele o jogo roda normalmente, só sem batidas.

**Testes.** A lógica do "Game.js" tem testes automáticos em "tests/Game.test.mjs" (contagem, voltas, ré, cortar caminho, posição, pontuação, recorde, reinício). Rodar com "npm test".

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
| hexágonos do casco | canvas 2D | casco verde |
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
  gameplay/
    Input.js                # leitura do teclado (segurada, apertada, solta)
    PlayerController.js     # controle e física do kart do jogador
    ParticulasKart.js       # partículas do drift (também usadas pelos itens)
    AIController.js         # IA dos rivais, com três dificuldades
    Items.js                # moedas, caixas, roleta, cogumelo, casco verde e banana
    Game.js                 # estados, eventos, contagem, voltas, posição, pontuação e recorde
  ui/
    HUD.js                  # HUD, minimapa, menu, pausa e telas de vitória e derrota
  objects/                  # cone, barril, pneus, caixa de item, óleo, moeda, casco verde, banana
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
tests/
  Game.test.mjs             # testes da lógica da corrida (npm test)
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
- Os itens emitem eventos ("coin", "itemHit", "itemPickup" e "itemUse"). O "Game.js" usa "coin" e "itemHit" na pontuação; os outros ficam disponíveis por "items.on(evento, fn)", por exemplo para sons.
- As moedas voltam depois de 10 s, então dá para juntar mais de 10 numa corrida. O limite de 10 vale para o bônus de velocidade, não para os pontos.
- Colisões entre karts e com obstáculos, e os sons, dependem do Membro 3 ("Collision.js").

## Créditos

Modelos 3D externos (também listados em [public/CREDITS.md](public/CREDITS.md)):

- **Mario**: "Mario Rig" (https://skfb.ly/oKECW) by plumbear106 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Luigi**: "SMG4 Luigi" (https://skfb.ly/oLxKv) by DokigerElRojito is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Peach**: "Peach Dancing from Super Mario" (https://skfb.ly/puCvG) by 3D by Renato👽 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
- **Bowser**: "Bowser Animation 3d" (https://sketchfab.com/3d-models/bowser-animation-3d-a95381c0c9a64a24802cb7ca077c0667) by Vandacvi is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

Os karts, a pista e os objetos do cenário foram modelados pelo grupo com primitivas do Three.js, assim como os SVGs de textura dos obstáculos. As imagens das texturas dos karts e do asfalto foram tiradas da internet.
