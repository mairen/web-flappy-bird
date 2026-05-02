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
let pipes = []; // Logic pipes
let pipeMeshes = []; // Three.js meshes
let particles = [];

// ==========================================
// 3D Engine Setup (Three.js)
// ==========================================
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(400, 600);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0d0e15, 0.05);

const camera = new THREE.PerspectiveCamera(60, 400 / 600, 0.1, 1000);
camera.position.set(0, 0, 15);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 10);
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x00ffa2, 1, 20);
scene.add(pointLight);

// Background Grid
const gridHelper = new THREE.GridHelper(100, 100, 0x00b8ff, 0x111122);
gridHelper.position.y = -10;
gridHelper.position.z = -10;
scene.add(gridHelper);

// Materials
const birdMat = new THREE.MeshStandardMaterial({ 
    color: 0x00ffa2, 
    emissive: 0x00ffa2,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8
});

const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x6f00ff,
    emissive: 0x3a0088,
    emissiveIntensity: 0.2,
    roughness: 0.1,
    metalness: 0.5
});

// Bird Mesh (Spaceship/Cone)
const birdGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
const birdMesh = new THREE.Mesh(birdGeo, birdMat);
// Rotate so it points right
birdMesh.geometry.rotateZ(-Math.PI / 2);
scene.add(birdMesh);

// Helper function to map 2D coordinates (400x600) to 3D space
// 400 width maps to roughly -7 to 7
// 600 height maps to roughly 10 to -10
const SCALE = 0.035;
function mapX(x2d) { return (x2d - 200) * SCALE; }
function mapY(y2d) { return -(y2d - 300) * SCALE; }
function mapW(w2d) { return w2d * SCALE; }
function mapH(h2d) { return h2d * SCALE; }

// ==========================================
// 2D Physics Engine (Retained for feel)
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
        
        // Floor collision
        if (this.y + this.height/2 >= 600) {
            this.y = 600 - this.height/2;
            gameOver();
        }
        
        // Ceiling collision
        if (this.y - this.height/2 <= 0) {
            this.y = this.height/2;
            this.velocity = 0;
        }
        
        // Update 3D Mesh
        birdMesh.position.x = mapX(this.x);
        birdMesh.position.y = mapY(this.y);
        
        // Tilt based on velocity
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        birdMesh.rotation.z = -this.rotation;
        
        // Light follows bird
        pointLight.position.copy(birdMesh.position);
        pointLight.position.z += 2;
    },
    
    flap: function() {
        this.velocity = this.jump;
        createParticles(this.x - 10, this.y, 5, 0x00b8ff);
    },
    
    reset: function() {
        this.y = 300;
        this.velocity = 0;
        this.rotation = 0;
        birdMesh.position.x = mapX(this.x);
        birdMesh.position.y = mapY(this.y);
        birdMesh.rotation.z = 0;
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
    
    // Create 3D Meshes for top and bottom pipes
    const pWidth = mapW(pipeLogic.width);
    
    // Top Pipe
    const tHeight = mapH(pipeLogic.topHeight);
    const topGeo = new THREE.BoxGeometry(pWidth, tHeight, pWidth);
    const topMesh = new THREE.Mesh(topGeo, pipeMat);
    topMesh.position.y = mapY(pipeLogic.topHeight / 2);
    
    // Bottom Pipe
    const bHeight = mapH(600 - pipeLogic.bottomY);
    const botGeo = new THREE.BoxGeometry(pWidth, bHeight, pWidth);
    const botMesh = new THREE.Mesh(botGeo, pipeMat);
    botMesh.position.y = mapY(pipeLogic.bottomY + (600 - pipeLogic.bottomY) / 2);
    
    scene.add(topMesh);
    scene.add(botMesh);
    
    pipeMeshes.push({
        id: pipeLogic.id,
        top: topMesh,
        bot: botMesh
    });
}

// Particle System
function createParticles(x, y, count, colorHex) {
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const pGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    
    for (let i = 0; i < count; i++) {
        let pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(mapX(x), mapY(y), 0);
        scene.add(pMesh);
        
        particles.push({
            mesh: pMesh,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            vz: (Math.random() - 0.5) * 0.2,
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
        p.mesh.rotation.x += 0.1;
        p.mesh.rotation.y += 0.1;
        p.life -= 0.02;
        
        // Scale down
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
    
    // Animate Background
    gridHelper.position.z += 0.05;
    if(gridHelper.position.z > 0) gridHelper.position.z = -10;
    
    // Add slow rotation to bird for 3D effect
    birdMesh.rotation.x += 0.05;
    
    // Pipe logic
    if (frames % 200 === 0) {
        spawnPipe();
    }
    
    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 1.5; // Pipe speed
        
        // Sync 3D Meshes
        let meshes = pipeMeshes.find(m => m.id === p.id);
        if (meshes) {
            meshes.top.position.x = mapX(p.x + p.width/2);
            meshes.bot.position.x = mapX(p.x + p.width/2);
        }
        
        // Collision detection
        let hitTop = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y - 10 < p.topHeight;
        let hitBottom = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y + 10 > p.bottomY;
        
        if (hitTop || hitBottom) {
            createParticles(bird.x, bird.y, 20, 0xff3366); // explosion
            gameOver();
        }
        
        // Score update
        if (p.x + p.width < bird.x && !p.passed) {
            score++;
            scoreDisplay.innerText = score;
            p.passed = true;
        }
        
        // Remove off-screen pipes
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
            birdMesh.position.y = mapY(bird.y) + Math.sin(Date.now() * 0.005) * 0.5;
            birdMesh.rotation.x += 0.02;
            birdMesh.rotation.y += 0.02;
        }
    }
    
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
    // Clear pipes
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
    
    // Clear particles
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

// Input Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (currentState === STATE.START) {
            startGame();
        } else if (currentState === STATE.PLAYING) {
            bird.flap();
        }
    }
});

canvas.addEventListener('mousedown', () => {
    if (currentState === STATE.PLAYING) {
        bird.flap();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// Init
bird.reset();
loop();
