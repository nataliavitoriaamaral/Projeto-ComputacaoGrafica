# Entrega 3 — Câmeras e projeção perspectiva (texto para o relatório)

## Evolução em relação à entrega anterior

Na entrega anterior havia uma única `PerspectiveCamera` controlada por `OrbitControls`. As teclas 1, 2 e 3 apenas
reposicionavam essa mesma câmera. Nesta entrega o código de câmera saiu do `main.js` e foi para a classe
`CameraManager` (`src/cameras/CameraManager.js`), que passou a oferecer câmeras com comportamentos diferentes:

| Tecla | Câmera | FOV | Comportamento |
|-------|--------|-----|---------------|
| 1, 2, 3 | Livre (largada, circuito, obstáculos) | 50° | Controlada pelo mouse (OrbitControls); as teclas levam a posições pré-definidas |
| 4 | Perseguição (3ª pessoa) | 65° | Fica 8 unidades atrás e 3,4 acima do kart do Mario e olha para a frente dele. Segue o kart com suavização (lerp) |
| 5 | Piloto (1ª pessoa) | 80° | Fica na altura dos olhos do Mario e acompanha a posição e a rotação do kart |

A alternância é feita pelas teclas 1 a 5 ou pela tecla **C** (próxima câmera). O HUD no canto da tela mostra a câmera
ativa, o tipo de projeção e o FOV. Para a câmera de perseguição e a do piloto terem o que mostrar, foi criado o modo
demo (tecla **Espaço**), em que os pilotos andam pela curva da pista (`track.path`), com as rodas girando.

Para demonstrar que a troca altera o ponto de vista: a câmera 1 mostra os dois karts do alto, a 4 mostra o Mario
de costas com a pista à frente e a 5 mostra a pista como o piloto a enxerga, sem o kart aparecendo.

## Projeção perspectiva

Todas as câmeras de visualização são `THREE.PerspectiveCamera`.

- **Onde a matriz é definida:** em `CameraManager._makeCamera()`, na chamada
  `new THREE.PerspectiveCamera(fov, aspect, near, far)`. O construtor chama `updateProjectionMatrix()`, que monta a
  matriz de projeção 4x4 em `camera.projectionMatrix`. Ela é recalculada em `resize()` (mudança de aspecto) e em
  `changeFov()` (teclas + e -), sempre com `updateProjectionMatrix()`.
- **Onde é aplicada:** em `renderer.render(scene, cameraManager.camera)` no `main.js`. O Three.js envia
  `projectionMatrix` e a matriz de visão à GPU e o vertex shader calcula
  `gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0)`. A divisão por `w` feita depois pela GPU é
  o que reduz o tamanho dos objetos com a distância.
- **Parâmetros:** `near = 0.1` e `far = 500` (o circuito inteiro cabe na vista de cima). O FOV varia de 50° a 80°
  conforme a câmera; o aspecto acompanha o tamanho da janela.

### Como demonstrar o efeito da perspectiva

1. Na câmera 4 com o modo demo ligado, as caixas de item e os cones aparecem pequenos ao longe e crescem ao se
   aproximar. As linhas laterais da pista convergem para o horizonte.
2. Na câmera 4, a tecla **P** troca para uma projeção ortográfica (só para comparação, com o mesmo enquadramento no
   ponto de referência). Nela o Mario e o Luigi, a distâncias diferentes da câmera, ficam com o mesmo tamanho e a pista
   deixa de convergir. Pressionando **P** de novo volta a perspectiva.
3. As teclas **+** e **-** mudam o FOV. Com FOV grande (grande angular) a perspectiva fica exagerada; com FOV pequeno
   (zoom) a cena fica mais achatada.
