const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
let particles = [];

// Bird Object
const bird = {
    x: 100,
    y: 300,
    width: 30,
    height: 30,
    velocity: 0,
    gravity: 0.2,
    jump: -4.5,
    rotation: 0,
    
    draw: function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotate bird based on velocity
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(this.rotation);
        
        // Draw modern neon bird (a glowing triangle/spaceship shape)
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffa2';
        ctx.fillStyle = '#00ffa2';
        
        ctx.beginPath();
        ctx.moveTo(15, 0); // Nose
        ctx.lineTo(-15, 12); // Bottom left
        ctx.lineTo(-10, 0); // Back indent
        ctx.lineTo(-15, -12); // Top left
        ctx.closePath();
        ctx.fill();
        
        // Engine glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00b8ff';
        ctx.fillStyle = '#00b8ff';
        ctx.beginPath();
        ctx.arc(-12, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },
    
    update: function() {
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        // Floor collision
        if (this.y + this.height/2 >= canvas.height) {
            this.y = canvas.height - this.height/2;
            gameOver();
        }
        
        // Ceiling collision
        if (this.y - this.height/2 <= 0) {
            this.y = this.height/2;
            this.velocity = 0;
        }
    },
    
    flap: function() {
        this.velocity = this.jump;
        createParticles(this.x - 10, this.y, 5, '#00b8ff'); // thrust particles
    },
    
    reset: function() {
        this.y = 300;
        this.velocity = 0;
        this.rotation = 0;
    }
};

// Pipe Generator
function spawnPipe() {
    let gap = 180;
    let minHeight = 50;
    let maxHeight = canvas.height - gap - minHeight;
    let topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        bottomY: topHeight + gap,
        width: 60,
        passed: false
    });
}

// Particle System
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1,
            color: color
        });
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Update Game Elements
function update() {
    if (currentState !== STATE.PLAYING) return;
    
    bird.update();
    
    // Pipe logic
    if (frames % 150 === 0) {
        spawnPipe();
    }
    
    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 2; // Pipe speed
        
        // Collision detection (AABB vs point approximation)
        let hitTop = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y - 10 < p.topHeight;
        let hitBottom = bird.x + 10 > p.x && bird.x - 10 < p.x + p.width && bird.y + 10 > p.bottomY;
        
        if (hitTop || hitBottom) {
            createParticles(bird.x, bird.y, 20, '#ff3366'); // explosion
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
        }
    }
    
    frames++;
}

// Render Game Elements
function draw() {
    // Clear canvas with deep space background
    ctx.fillStyle = '#0d0e15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid background for cyber effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    let offset = (frames * 0.5) % 40;
    for(let i = -40; i < canvas.width; i+=40) {
        ctx.beginPath();
        ctx.moveTo(i - offset, 0);
        ctx.lineTo(i - offset, canvas.height);
        ctx.stroke();
    }
    
    // Draw pipes
    for (let i = 0; i < pipes.length; i++) {
        let p = pipes[i];
        
        // Pipe styling (Neon glow)
        ctx.fillStyle = 'rgba(20, 25, 40, 0.9)';
        ctx.strokeStyle = '#6f00ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(111, 0, 255, 0.5)';
        
        // Top Pipe
        ctx.fillRect(p.x, 0, p.width, p.topHeight);
        ctx.strokeRect(p.x, 0, p.width, p.topHeight);
        
        // Top Pipe Cap
        ctx.fillStyle = '#6f00ff';
        ctx.fillRect(p.x - 4, p.topHeight - 20, p.width + 8, 20);
        
        // Bottom Pipe
        ctx.fillStyle = 'rgba(20, 25, 40, 0.9)';
        ctx.fillRect(p.x, p.bottomY, p.width, canvas.height - p.bottomY);
        ctx.strokeRect(p.x, p.bottomY, p.width, canvas.height - p.bottomY);
        
        // Bottom Pipe Cap
        ctx.fillStyle = '#6f00ff';
        ctx.fillRect(p.x - 4, p.bottomY, p.width + 8, 20);
        
        ctx.shadowBlur = 0; // Reset shadow for other drawings
    }
    
    // Draw Bird
    if (currentState === STATE.PLAYING || currentState === STATE.START) {
        bird.draw();
    }
    
    // Particles
    updateAndDrawParticles();
}

// Main Game Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
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
    }, 500); // slight delay for dramatic effect
}

function resetGame() {
    pipes = [];
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
loop();
