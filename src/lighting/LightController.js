import * as THREE from 'three';

export class LightController {
    constructor(scene) {
        this.scene = scene;
        this.lights = {};
        
        this.initLights();
        this.setupKeyboardShortcuts();
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
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 300;
        sunLight.shadow.normalBias = 0.03;
        sunLight.shadow.bias = -0.00005;
        
        this.scene.add(sunLight);
        this.scene.add(sunLight.target);
        this.lights.sun = sunLight;

        // holofote azul sobre a linha de largada
        // a intensidade compensa a queda da luz com o quadrado da distância
        const trackSpotlight = new THREE.SpotLight(0x00aaff, 250, 60);
        trackSpotlight.position.set(0, 20, 0);
        trackSpotlight.angle = Math.PI / 5;
        trackSpotlight.penumbra = 0.5;
        trackSpotlight.castShadow = true;
        trackSpotlight.shadow.mapSize.set(1024, 1024);
        trackSpotlight.shadow.camera.near = 0.5;
        trackSpotlight.shadow.camera.far = 60;
        trackSpotlight.shadow.normalBias = 0.02;

        this.scene.add(trackSpotlight);
        this.scene.add(trackSpotlight.target);
        this.lights.trackSpot = trackSpotlight;
    }

    // adapta a área de sombras e o holofote à pista carregada
    setTrack(track) {
        const bounds = new THREE.Box3().setFromPoints(track.path.getSpacedPoints(300));
        bounds.expandByScalar(track.trackWidth / 2 + 5);
        bounds.max.y += 30; // inclui pilotos, pórtico e paisagem próxima
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const sun = this.lights.sun;
        sun.target.position.copy(sphere.center);
        sun.position.copy(sphere.center).add(new THREE.Vector3(100, 140, 80));

        // a esfera cabe no volume de sombra em qualquer direção da luz
        const camera = sun.shadow.camera;
        camera.left = camera.bottom = -sphere.radius;
        camera.right = camera.top = sphere.radius;
        camera.far = sun.position.distanceTo(sphere.center) + sphere.radius + 30;
        camera.updateProjectionMatrix();
        sun.shadow.needsUpdate = true;

        // ilumina o grid sem depender das coordenadas de uma pista específica
        const point = track.path.getPointAt(0);
        const tangent = track.path.getTangentAt(0).normalize();
        const spot = this.lights.trackSpot;
        spot.target.position.copy(point).addScaledVector(tangent, -6);
        spot.position.copy(spot.target.position);
        spot.position.y += 16;
        spot.shadow.needsUpdate = true;
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (event) => {
            if (event.repeat) return;
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
