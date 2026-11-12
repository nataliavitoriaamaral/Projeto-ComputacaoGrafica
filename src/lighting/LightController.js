import * as THREE from 'three';

export class LightController {
    constructor(scene) {
        this.scene = scene;
        this.lights = {};
        
        this.initLights();
        this.setupKeyboardShortcuts();
        //this.scene.environment = null;
    }

    initLights() {
        // luz ambiente: evita que as áreas de sombra fiquem totalmente pretas
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // sol: luz direcional com sombras
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2); // tom levemente quente
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        
        // mapa de sombra
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 300;
        
        this.scene.add(sunLight);
        this.lights.sun = sunLight;

        // holofote azul sobre a linha de largada
        const trackSpotlight = new THREE.SpotLight(0x00aaff, 2.0);
        trackSpotlight.position.set(0, 20, 0);
        trackSpotlight.angle = Math.PI / 4;
        trackSpotlight.penumbra = 0.5;
        trackSpotlight.castShadow = true;

        this.scene.add(trackSpotlight);
        this.lights.trackSpot = trackSpotlight;
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (event) => {
            // L: luz ambiente
            if (event.key === 'L' || event.key === 'l') {
                this.lights.ambient.visible = !this.lights.ambient.visible;
                console.log('Luz Ambiente:', this.lights.ambient.visible ? 'ON' : 'OFF');
            }
            // K: sol
            if (event.key === 'K' || event.key === 'k') {
                this.lights.sun.visible = !this.lights.sun.visible;
                console.log('Luz Direcional:', this.lights.sun.visible ? 'ON' : 'OFF');
            }
            // 0: holofote
            if (event.key === '0') {
                this.lights.trackSpot.visible = !this.lights.trackSpot.visible;
                console.log('Spotlight:', this.lights.trackSpot.visible ? 'ON' : 'OFF');
            }
        });
    }    

    // liga ou desliga uma luz, para isolar a contribuição de cada fonte
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

    // reposiciona luzes que acompanham o kart (ainda não há nenhuma)
    update(kartPosition) {
        if (this.lights.kartHeadlight && kartPosition) {
            this.lights.kartHeadlight.position.copy(kartPosition);
        }
    }
}
