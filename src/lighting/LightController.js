import * as THREE from 'three';

export class LightController {
    constructor(scene) {
        this.scene = scene;
        this.lights = {};
        
        this.initLights();
        //this.scene.environment = null;
    }

    initLights() {
        // --- 1. Luz Ambiente (Iluminação de base geral da cena) ---
        // Garante que nenhum objeto fique completamente preto nas sombras
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // --- 2. Fonte de Luz 1: Luz Direcional (Simula o Sol/Dia ou iluminação principal) ---
        // Luz direcional com sombras ativadas para dar volume ao circuito e karts
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2); // tom levemente quente
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        
        // Configurações da sombra da luz direcional
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 300;
        
        this.scene.add(sunLight);
        this.lights.sun = sunLight;

        // --- 3. Fonte de Luz 2: PointLight / SpotLight (Coerente com a proposta do jogo) ---
        // Exemplo A: Iluminação de poste/largada ou iluminação decorativa da pista
        const trackSpotlight = new THREE.SpotLight(0x00aaff, 2.0); // Luz azulada estilo neon/pista
        trackSpotlight.position.set(0, 20, 0);
        trackSpotlight.angle = Math.PI / 4;
        trackSpotlight.penumbra = 0.5;
        trackSpotlight.castShadow = true;

        this.scene.add(trackSpotlight);
        this.lights.trackSpot = trackSpotlight;

        // Exemplo B (Opcional): Luz dos faróis do Kart (PointLight móvel)
        // Pode ser anexada ao objeto do Kart em outro momento.
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (event) => {
            // Tecla 1: Alterna Luz Ambiente
            if (event.key === '8') {
                this.lights.ambient.visible = !this.lights.ambient.visible;
                console.log('Luz Ambiente:', this.lights.ambient.visible ? 'ON' : 'OFF');
            }
            // Tecla 2: Alterna Luz Direcional (Sol)
            if (event.key === '9') {
                this.lights.sun.visible = !this.lights.sun.visible;
                console.log('Luz Direcional:', this.lights.sun.visible ? 'ON' : 'OFF');
            }
            // Tecla 3: Alterna Spotlight
            if (event.key === '0') {
                this.lights.spot.visible = !this.lights.spot.visible;
                console.log('Spotlight:', this.lights.spot.visible ? 'ON' : 'OFF');
            }
        });
    }    

    /**
     * Permite identificar/isolar a contribuição de cada fonte de luz na cena.
     * Pode ser ligado a controles (GUI/Teclado) para demonstração na apresentação.
     */
    toggleLight(lightName, enabled) {
        if (this.lights[lightName]) {
            this.lights[lightName].visible = enabled;
        }
    }

    setIntensity(lightName, intensity) {
        if (this.lights[lightName]) {
            this.lights[lightName].intensity = intensity;
        }
    }

    // Método para atualizar posições de luzes dinâmicas (ex: luz seguindo o kart)
    update(kartPosition) {
        if (this.lights.kartHeadlight && kartPosition) {
            this.lights.kartHeadlight.position.copy(kartPosition);
        }
    }
}