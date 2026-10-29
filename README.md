# Mario Kart 3D

Trabalho de computação gráfica. Versão simplificada de Mario Kart em 3D feita com Three.js. 

## Como rodar

Precisa do Node.js 20.19+ ou 22.12+ instalado (exigência do Vite 8).

```bash
npm install
npm run dev
```

Abre o endereço que o Vite imprimir no terminal (geralmente `http://localhost:5173`).

A página inicial mostra a pista com os pilotos e os objetos do cenário integrados.
Para ver só o preview dos obstáculos e objetos, acesse `/obstaculos.html` no mesmo endereço.

Controle da câmera com `OrbitControls`: arrastar com o botão esquerdo para rotação,
com o botão direito para translação e utilizar a roda de rolagem para zoom.
As teclas **1**, **2** e **3** selecionam, respectivamente, as vistas da largada,
do circuito completo e do trecho inicial com obstáculos.

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (`BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, etc.) agrupadas em hierarquia. Cores e detalhes diferentes por personagem (Mario vermelho com 3 escapamentos cilíndricos, Luigi verde com 2 escapamentos cônicos).
- **Personagens** carregados de arquivos `.gltf` baixados do Sketchfab (licença CC-BY, créditos abaixo). O loader faz um reparo nos materiais e nas meshes espelhadas que vieram quebradas.
- **Rodas** giram em função da velocidade usando `ω = v/r`.
- Como os modelos vêm em T-pose (pernas retas), "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um `clipping plane` horizontal pra esconder tudo que fica abaixo.
- **Obstáculos e objetos do cenário** feitos só com primitivas (cone, barril, pilha de pneus, caixa de item e mancha de óleo), em `src/objects/`. Cada um é uma função que retorna um `THREE.Group`.
- **Integração com a pista** usando pontos e tangentes da curva (`getPointAt` e `getTangentAt`) para posicionar e orientar pilotos e objetos. Deslocamentos laterais distribuem os elementos pela largura da pista. As caixas de item flutuam com `Math.sin` e giram no loop de animação. Câmera controlada por `OrbitControls` e sombras com `DirectionalLight`.

## Estrutura

```
src/
  main.js                   # integra pista, pilotos, objetos, luz e câmeras
  preview-obstaculos.js      # cena separada para visualizar os objetos
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

- Ainda não conseguimos arrumar o olho direito do Luigi.
