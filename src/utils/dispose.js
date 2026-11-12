// dispose.js
// Libera da GPU as geometrias e os materiais de um objeto e de todos os filhos.
// Tirar da cena com scene.remove() não basta: os buffers continuam na
// memória da placa até chamar dispose().

export function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;

    child.geometry?.dispose();
    // alguns objetos usam um array de materiais (um por grupo de faces)
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => mat?.dispose());
  });
}
