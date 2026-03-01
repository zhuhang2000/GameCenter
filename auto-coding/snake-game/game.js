// 游戏常量
const GRID_SIZE = 20;
const TILE_COUNT = 20; // 400x400 canvas / 20px grid
const GAME_SPEED = 100; // ms per update

// 游戏状态
let gameLoop;
let isPaused = false;
let isGameOver = false;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;

// 视觉效果状态
let particles = [];
let shakeDuration = 0;
let shakeIntensity = 0;

// 蛇的状态
let snake = [
    {x: 10, y: 10}, // 头部
    {x: 9, y: 10},
    {x: 8, y: 10}
];
let velocity = {x: 1, y: 0}; // 初始向右移动
let nextVelocity = {x: 1, y: 0}; // 缓冲下一帧的方向

// 食物位置与类型
let food = {
    x: 15, 
    y: 15, 
    type: 'normal', // normal, gold, poison
    spawnTime: 0
};

// DOM 元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// 初始化
function init() {
    highScoreEl.textContent = highScore;
    document.addEventListener('keydown', handleInput);
    restartBtn.addEventListener('click', resetGame);
    spawnFood();
    startGame();
}

// 游戏循环
function startGame() {
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, GAME_SPEED);
}

function update() {
    if (isPaused || isGameOver) return;

    moveSnake();
    checkCollisions();
    updateParticles();
    updateFood();
    draw();
}

// 粒子系统
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// 屏幕震动
function triggerShake(duration, intensity) {
    shakeDuration = duration;
    shakeIntensity = intensity;
}

function getShakeOffset() {
    if (shakeDuration > 0) {
        shakeDuration--;
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        return {x: dx, y: dy};
    }
    return {x: 0, y: 0};
}

// 移动蛇
function moveSnake() {
    velocity = {...nextVelocity}; // 应用缓冲的方向

    const head = {x: snake[0].x + velocity.x, y: snake[0].y + velocity.y};
    
    snake.unshift(head); // 添加新头部

    // 检查是否吃到食物
    if (head.x === food.x && head.y === food.y) {
        handleEatFood();
    } else {
        snake.pop(); // 移除尾部，保持长度
    }
}

function handleEatFood() {
    // 播放音效 (暂略)
    
    // 粒子效果
    const pixelX = food.x * GRID_SIZE + GRID_SIZE / 2;
    const pixelY = food.y * GRID_SIZE + GRID_SIZE / 2;
    let particleColor = '#e74c3c'; // 默认红色
    
    if (food.type === 'gold') particleColor = '#f1c40f';
    else if (food.type === 'poison') particleColor = '#9b59b6';
    
    createExplosion(pixelX, pixelY, particleColor, 15);

    // 分数处理
    if (food.type === 'normal') {
        score += 10;
    } else if (food.type === 'gold') {
        score += 30;
    } else if (food.type === 'poison') {
        // 毒蘑菇吃到直接结束游戏
        endGame();
        return;
    }

    scoreEl.textContent = score;
    spawnFood();
}

function updateFood() {
    // 检查金色食物是否过期
    if (food.type === 'gold') {
        const currentTime = Date.now();
        if (currentTime - food.spawnTime > 5000) { // 5秒消失
            spawnFood();
        }
    }
}

// 生成食物
function spawnFood() {
    let validPosition = false;
    while (!validPosition) {
        food.x = Math.floor(Math.random() * TILE_COUNT);
        food.y = Math.floor(Math.random() * TILE_COUNT);
        
        // 确保食物不在蛇身上
        validPosition = !snake.some(segment => segment.x === food.x && segment.y === food.y);
    }
    
    // 随机食物类型
    const rand = Math.random();
    if (rand < 0.1) {
        food.type = 'gold'; // 10% 概率
    } else if (rand < 0.2) {
        food.type = 'poison'; // 10% 概率 (0.1 - 0.2)
    } else {
        food.type = 'normal'; // 80% 概率
    }
    
    food.spawnTime = Date.now();
}

// 碰撞检测
function checkCollisions() {
    const head = snake[0];

    // 撞墙检测
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        triggerShake(10, 10);
        endGame();
        return;
    }

    // 撞自己检测 (从第4节开始检查，前3节不可能撞到头)
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            triggerShake(10, 10);
            endGame();
            return;
        }
    }
}

// 游戏结束
function endGame() {
    isGameOver = true;
    clearInterval(gameLoop);
    
    // 蛇身爆炸效果
    snake.forEach(segment => {
         createExplosion(
            segment.x * GRID_SIZE + GRID_SIZE / 2, 
            segment.y * GRID_SIZE + GRID_SIZE / 2, 
            '#2ecc71', 
            5
        );
    });
    // 重绘一次以显示爆炸
    draw();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreEl.textContent = highScore;
    }

    // 延迟显示模态框，让玩家看到爆炸
    setTimeout(() => {
        finalScoreEl.textContent = score;
        gameOverModal.classList.remove('hidden');
    }, 500);
}

// 重置游戏
function resetGame() {
    isGameOver = false;
    isPaused = false;
    score = 0;
    scoreEl.textContent = 0;
    snake = [
        {x: 10, y: 10},
        {x: 9, y: 10},
        {x: 8, y: 10}
    ];
    velocity = {x: 1, y: 0};
    nextVelocity = {x: 1, y: 0};
    particles = [];
    shakeDuration = 0;
    
    gameOverModal.classList.add('hidden');
    spawnFood();
    startGame();
}

// 输入处理
function handleInput(e) {
    if (isGameOver) {
        if (e.key === 'r' || e.key === 'R') {
            resetGame();
        }
        return;
    }

    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (velocity.y === 0) nextVelocity = {x: 0, y: -1};
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (velocity.y === 0) nextVelocity = {x: 0, y: 1};
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (velocity.x === 0) nextVelocity = {x: -1, y: 0};
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (velocity.x === 0) nextVelocity = {x: 1, y: 0};
            break;
        case ' ':
            e.preventDefault(); // 防止空格键滚动页面
            togglePause();
            break;
        case 'r':
        case 'R':
            resetGame();
            break;
    }
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        // 可选：显示暂停文字
        draw(); // 重绘以显示暂停文字
    } else {
        // 恢复时立即重绘以清除暂停文字
        draw();
    }
}

// 绘制画面
function draw() {
    // 应用震动
    const offset = getShakeOffset();
    ctx.save();
    ctx.translate(offset.x, offset.y);

    // 清空画布
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制食物
    let foodColor = '#e74c3c'; // 默认红色 (Normal)
    
    if (food.type === 'gold') {
        foodColor = '#f1c40f'; // 金色
        // 闪烁效果
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            foodColor = '#fff';
        }
    } else if (food.type === 'poison') {
        foodColor = '#9b59b6'; // 紫色
    }

    ctx.fillStyle = foodColor;
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE/2, 
        food.y * GRID_SIZE + GRID_SIZE/2, 
        GRID_SIZE/2 - 2, 
        0, Math.PI * 2
    );
    ctx.fill();
    
    // 绘制蛇
    snake.forEach((segment, index) => {
        // 蛇头颜色不同
        ctx.fillStyle = index === 0 ? '#2ecc71' : '#27ae60'; 
        ctx.fillRect(
            segment.x * GRID_SIZE + 1, 
            segment.y * GRID_SIZE + 1, 
            GRID_SIZE - 2, 
            GRID_SIZE - 2
        );
        
        // 可选：给蛇身加一点高光效果
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(
            segment.x * GRID_SIZE + 4, 
            segment.y * GRID_SIZE + 4, 
            GRID_SIZE/2, 
            GRID_SIZE/2
        );
    });

    // 绘制粒子
    particles.forEach(p => p.draw(ctx));

    if (isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("暂停", canvas.width/2, canvas.height/2);
        ctx.font = '16px Arial';
        ctx.fillText("按空格键继续", canvas.width/2, canvas.height/2 + 30);
    }
    
    ctx.restore(); // 恢复震动前的状态
}

// 启动
init();