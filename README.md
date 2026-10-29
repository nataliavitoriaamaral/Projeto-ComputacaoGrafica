# Mario Kart 3D — módulo de personagens

Trabalho de computação gráfica. Versão simplificada de Mario Kart em 3D feita com Three.js. 

## Como rodar

Precisa do Node.js instalado.

```bash
npm install
npm run dev
```

Abre o endereço que o Vite imprimir no terminal (geralmente `http://localhost:5173`).

## O que tem neste repositório

- **Karts** modelados proceduralmente com primitivas do Three.js (`BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, etc.) agrupadas em hierarquia. Cores e detalhes diferentes por personagem (Mario vermelho com 3 escapamentos cilíndricos, Luigi verde com 2 escapamentos cônicos).
- **Personagens** carregados de arquivos `.gltf` baixados do Sketchfab (licença CC-BY, créditos abaixo). O loader faz um reparo nos materiais e nas meshes espelhadas que vieram quebradas.
- **Rodas** giram em função da velocidade usando `ω = v/r`.
- Como os modelos vêm em T-pose (pernas retas), "sentar" o personagem é simulado afundando o quadril até o nível do assento e usando um `clipping plane` horizontal pra esconder tudo que fica abaixo.

## Estrutura

```
src/
  main.js                   # cena de preview com os dois pilotos
  characters/
    Kart.js                 # kart procedural
    Character.js            # loader de personagem .gltf
    Racer.js                # junta kart + personagem 
public/
  models/mario/scene.gltf
  models/luigi/scene.gltf
```

## Observações

- Ainda não conseguimos arrumar o olho direito do Luigi. 

