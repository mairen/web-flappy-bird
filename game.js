const canvas = document.getElementById('gameCanvas');

// UI Elements
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State Enum
const STATE = {
    START: 0,
    PLAYING: 1,
    GAMEOVER: 2
};

// Game Variables
let currentState = STATE.START;
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('neonFlapBestScore') || 0;
let pipes = []; 
let pipeMeshes = []; 
let particles = [];

// ==========================================
// 3D Engine Setup (Three.js)
// ==========================================
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(400, 600);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87CEEB, 0.02); // Light blue sky fog

const camera = new THREE.PerspectiveCamera(60, 400 / 600, 0.1, 1000);
camera.position.set(0, 0, 15);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2); // Warm sun
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
scene.add(sunLight);

// ==========================================
// Textures & Materials
// ==========================================
const textureLoader = new THREE.TextureLoader();

const loadTex = (path, repeatX = 1, repeatY = 1) => {
    const tex = textureLoader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
};

// Replace with generated texture paths
const grassTex = loadTex('assets/grass_texture_1777703522831.png', 10, 10);
const skyTex = loadTex('assets/sky_texture_1777703536214.png');
const treeTex = loadTex('assets/tree_texture_1777703548801.png', 1, 3);
const metalTex = loadTex('assets/metal_texture_1777703561865.png', 1, 3);
const stoneTex = loadTex('assets/stone_texture_1777703573297.png', 1, 3);

// Ground
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, metalness: 0 });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = -10;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// SkyDome
const skyGeo = new THREE.SphereGeometry(100, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

// Pipe Materials
const pipeMaterials = [
    { type: 'tree', mat: new THREE.MeshStandardMaterial({ map: treeTex, roughness: 0.9, metalness: 0 }) },
    { type: 'metal', mat: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.4, metalness: 0.6 }) },
    { type: 'stone', mat: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 1.0, metalness: 0 }) }
];

// ==========================================
// The Realistic Bird
// ==========================================
const birdGroup = new THREE.Group();

// Body
const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5 });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.castShadow = true;
birdGroup.add(bodyMesh);

// Beak
const beakGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
const beakMat = new THREE.MeshStandardMaterial({ color: 0xff5500 });
const beakMesh = new THREE.Mesh(beakGeo, beakMat);
beakMesh.rotation.z = -Math.PI / 2;
beakMesh.position.x = 0.8;
beakMesh.castShadow = true;
birdGroup.add(beakMesh);

// Wings
const wingGeo = new THREE.BoxGeometry(0.8, 0.1, 1.2);
const wingMat = new THREE.MeshStandardMaterial({ color: 0xdd8800 });
const leftWing = new THREE.Mesh(wingGeo, wingMat);
leftWing.position.set(0, 0, 0.7);
leftWing.castShadow = true;
const rightWing = new THREE.Mesh(wingGeo, wingMat);
rightWing.position.set(0, 0, -0.7);
rightWing.castShadow = true;
birdGroup.add(leftWing);
birdGroup.add(rightWing);

scene.add(birdGroup);

// Coordinate Mapping (2D to 3D)
const SCALE = 0.035;
function mapX(x2d) { return (x2d - 200) * SCALE; }
function mapY(y2d) { return -(y2d - 300) * SCALE; }
function mapW(w2d) { return w2d * SCALE; }
function mapH(h2d) { return h2d * SCALE; }

// ==========================================
// 2D Physics Engine 
// ==========================================
const bird = {
    x: 100,
    y: 300,
    width: 30,
    height: 30,
    velocity: 0,
    gravity: 0.1,
    jump: -3.5,
    rotation: 0,
    
    update: function() {
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        if (this.y + this.height/2 >= 600) {
            this.y = 600 - this.height/2;
            gameOver();
        }
        
        if (this.y - this.height/2 <= 0) {
            this.y = this.height/2;
            this.velocity = 0;
        }
        
        // Sync 3D Mesh
        birdGroup.position.x = mapX(this.x);
        birdGroup.position.y = mapY(this.y);
        
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        birdGroup.rotation.z = -this.rotation;
        
        // Flap Wings Animation
        if (this.velocity < 0) {
            // Flapping down
            leftWing.rotation.x = Math.max(-Math.PI / 4, leftWing.rotation.x - 0.2);
            rightWing.rotation.x = Math.min(Math.PI / 4, rightWing.rotation.x + 0.2);
        } else {
            // Gliding / Returning
            leftWing.rotation.x = Math.min(0, leftWing.rotation.x + 0.1);
            rightWing.rotation.x = Math.max(0, rightWing.rotation.x - 0.1);
        }
    },
    
    flap: function() {
        this.velocity = this.jump;
        createParticles(this.x - 10, this.y, 5, 0xffffff); // feather particles
    },
    
    reset: function() {
        this.y = 300;
        this.velocity = 0;
        this.rotation = 0;
        birdGroup.position.x = mapX(this.x);
        birdGroup.position.y = mapY(this.y);
        birdGroup.rotation.z = 0;
    }
};

// Pipe Generator
function spawnPipe() {
    let gap = 220;
    let minHeight = 50;
    let maxHeight = 600 - gap - minHeight;
    let topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
    
    let pipeLogic = {
        x: 400,
        topHeight: topHeight,
        bottomY: topHeight + gap,
        width: 60,
        passed: false,
        id: frames
    };
    pipes.push(pipeLogic);
    
    // Pick random material type
    const randomStyle = pipeMaterials[Math.floor(Math.random() * pipeMaterials.length)];
    const pWidth = mapW(pipeLogic.width);
    
    let topGeo, botGeo;
    if (randomStyle.type === 'stone') {
        topGeo = new THREE.BoxGeometry(pWidth, mapH(pipeLogic.topHeight), pWidth);
        botGeo = new THREE.BoxGeometry(pWidth, mapH(600 - pipeLogic.bottomY), pWidth);
    } else {
        topGeo = new THREE.CylinderGeometry(pWidth/2, pWidth/2, mapH(pipeLogic.topHeight), 16);
        botGeo = new THREE.CylinderGeometry(pWidth/2, pWidth/2, mapH(600 - pipeLogic.bottomY), 16);
    }
    
    const topMesh = new THREE.Mesh(topGeo, randomStyle.mat);
    topMesh.position.y = mapY(pipeLogic.topHeight / 2);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    
    const botMesh = new THREE.Mesh(botGeo, randomStyle.mat);
    botMesh.position.y = mapY(pipeLogic.bottomY + (600 - pipeLogic.bottomY) / 2);
    botMesh.castShadow = true;
    botMesh.receiveShadow = true;
    
    scene.add(topMesh);
    scene.add(botMesh);
    
    pipeMeshes.push({ id: pipeLogic.id, top: topMesh, bot: botMesh });
}

// Particle System
function createParticles(x, y, count, colorHex) {
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    
    for (let i = 0; i < count; i++) {
        let pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(mapX(x), mapY(y), 0);
        scene.add(pMesh);
        
        particles.push({
            mesh: pMesh,
            vx: (Math.random() - 0.5) * 0.1,
            vy: (Math.random() - 0.5) * 0.1 + 0.1, // float up
            vz: (Math.random() - 0.5) * 0.1,
            life: 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life -= 0.05;
        
        p.mesh.scale.setScalar(Math.max(0, p.life));
        
        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// Update Game Elements
function update() {
    if (currentState !== STATE.PLAYING) return;
    
    bird.update();
    
    // Animate Ground
    grassTex.offset.x += 0.005;
    
    if (frames % 200 === 0) {
        spawnPipe();
    }
    
    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 1.5; // Pipe speed
        
        let meshes = pipeMeshes.find(m => m.id === p.id);
        if (meshes) {
            meshes.top.position.x = mapX(p.x + p.width/2);
            meshes.bot.position.x = mapX(p.x + p.width/2);
        }
        
        // Collision detection
        let hitTop = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y - 10 < p.topHeight;
        let hitBottom = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y + 10 > p.bottomY;
        
        if (hitTop || hitBottom) {
            createParticles(bird.x, bird.y, 30, 0xff0000); 
            gameOver();
        }
        
        if (p.x + p.width < bird.x && !p.passed) {
            score++;
            scoreDisplay.innerText = score;
            p.passed = true;
        }
        
        if (p.x + p.width < 0) {
            pipes.splice(i, 1);
            if (meshes) {
                scene.remove(meshes.top);
                scene.remove(meshes.bot);
                meshes.top.geometry.dispose();
                meshes.top.material.dispose();
                meshes.bot.geometry.dispose();
                meshes.bot.material.dispose();
                pipeMeshes = pipeMeshes.filter(m => m.id !== p.id);
            }
        }
    }
    
    frames++;
}

// Render Loop
function loop() {
    requestAnimationFrame(loop);
    
    if (currentState === STATE.PLAYING || currentState === STATE.START) {
        update();
        updateParticles();
        
        if (currentState === STATE.START) {
            // Idle animation
            birdGroup.position.y = mapY(bird.y) + Math.sin(Date.now() * 0.005) * 0.5;
            leftWing.rotation.x = Math.sin(Date.now() * 0.01) * 0.2;
            rightWing.rotation.x = -Math.sin(Date.now() * 0.01) * 0.2;
        }
    }
    
    // Rotate sky slowly
    skyMesh.rotation.y += 0.0005;
    
    renderer.render(scene, camera);
}

// Game Controls
function startGame() {
    currentState = STATE.PLAYING;
    startScreen.classList.add('hidden');
    scoreDisplay.innerText = '0';
    bird.reset();
    bird.flap();
}

function gameOver() {
    currentState = STATE.GAMEOVER;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('neonFlapBestScore', bestScore);
    }
    
    finalScoreEl.innerText = score;
    bestScoreEl.innerText = bestScore;
    
    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        scoreDisplay.style.display = 'none';
    }, 500);
}

function resetGame() {
    pipes = [];
    pipeMeshes.forEach(m => {
        scene.remove(m.top);
        scene.remove(m.bot);
        m.top.geometry.dispose();
        m.top.material.dispose();
        m.bot.geometry.dispose();
        m.bot.material.dispose();
    });
    pipeMeshes = [];
    
    particles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
    });
    particles = [];
    
    score = 0;
    frames = 0;
    bird.reset();
    currentState = STATE.START;
    
    scoreDisplay.style.display = 'block';
    scoreDisplay.innerText = '0';
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (currentState === STATE.START) startGame();
        else if (currentState === STATE.PLAYING) bird.flap();
    }
});

canvas.addEventListener('mousedown', () => {
    if (currentState === STATE.PLAYING) bird.flap();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// Init
bird.reset();
loop();
