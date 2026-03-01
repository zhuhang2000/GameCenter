# 🐍 贪吃蛇游戏趣味增强方案

> 创建时间: 2026-03-01
> 对应游戏: `/snake-game/`

---

## 🎮 核心机制增强

### 1. 速度渐进系统
- **机制**: 每吃掉 N 个食物，蛇的移动速度加快
- **效果**: 游戏难度随时间自然递增
- **建议值**: 每 5 个食物提速 10%

### 2. 多样化食物系统

| 食物类型 | 外观 | 效果 | 特殊机制 |
|---------|------|------|----------|
| 🍎 普通苹果 | 红色 | +10 分 | 基础食物 |
| ⭐ 金星 | 金色 | +30 分 | 5 秒后消失，限时挑战 |
| 💀 毒蘑菇 | 紫色 | 游戏结束 | 需要躲避的陷阱 |
| 🍇 葡萄串 | 蓝色 | +10 分 + 减速 3 秒 | 策略性食物 |

---

## ⚡ 道具系统（随机生成，持续 10 秒）

| 道具 | 图标 | 效果 | 策略价值 |
|------|------|------|----------|
| 幽灵模式 | 👻 | 可穿过墙壁/自己一次 | 救命道具 |
| 加速冲刺 | ⚡ | 2 倍移动速度 | 高风险高回报 |
| 磁力吸引 | 🧲 | 自动吸附附近食物 | 快速刷分 |
| 时间冻结 | ⏱️ | 食物/障碍物停止 3 秒 | 喘息机会 |

**生成规则**: 
- 每吃掉 3 个食物有 20% 概率生成道具
- 道具出现在空地，带闪烁提示
- 10 秒未拾取自动消失

---

## 🎯 游戏模式

### 经典模式 (Classic)
- 标准贪吃蛇玩法
- 撞墙/撞自己 = 游戏结束

### 时间挑战 (Time Attack)
- 限时 60 秒
- 目标是获得尽可能高的分数
- 食物生成速度加快

### 迷宫模式 (Maze)
- 预设固定墙壁地图
- 取消自身碰撞（不会撞到自己）
- 重点在路径规划

### 禅模式 (Zen)
- 无墙壁（穿墙从对面出现）
- 取消自身碰撞
- 无分数压力，纯粹放松

### 生存模式 (Survival)
- 障碍物随时间增加
- 毒蘑菇出现频率递增
- 极限挑战

---

## 🎨 视觉与音效增强

### 粒子效果
- **吃食物**: 食物位置爆发小粒子
- **游戏结束**: 蛇身消散粒子效果
- **获得道具**: 屏幕边缘发光提示
- **高分达成**: 庆祝烟花特效

### 屏幕震动
- 撞墙/撞自己时轻微震动反馈
- 使用 CSS `transform` 实现

### 复古音效
- 吃食物: "哔" 一声
- 游戏结束: 低沉音效
- 获得道具: 欢快音效
- 暂停: 轻快提示音

### 主题切换
- 🌑 暗黑模式（默认）
- ☀️ 明亮模式
- 🟢 霓虹赛博朋克
- 🍬 糖果色

---

## 📊 成就系统

| 成就 | 图标 | 条件 | 奖励 |
|------|------|------|------|
| 初出茅庐 | 🥉 | 分数达到 50 | 解锁霓虹主题 |
| 小有所成 | 🥈 | 分数达到 100 | 解锁糖果主题 |
| 大师风范 | 🥇 | 分数达到 200 | 解锁生存模式 |
| 速度之王 | ⚡ | 时间模式 60 秒获得 150 分 | 解锁金色蛇身 |
| 完美主义者 | 💎 | 禅模式连续吃 50 个食物不死 | 解锁钻石蛇身 |
| 幸存者 | 🏆 | 生存模式坚持 3 分钟 | 解锁终极主题 |

---

## 🛠️ 技术实现建议

### 文件结构调整
```
snake-game/
├── index.html          # 主页面
├── css/
│   ├── style.css       # 基础样式
│   └── themes.css      # 主题变量
├── js/
│   ├── game.js         # 核心逻辑
│   ├── render.js       # 渲染模块
│   ├── input.js        # 输入处理
│   ├── audio.js        # 音效管理
│   ├── particles.js    # 粒子系统
│   └── achievements.js # 成就系统
├── assets/
│   ├── sounds/         # 音效文件
│   └── sprites/        # 精灵图
└── README.md
```

### 关键代码片段

#### 粒子系统
```javascript
class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    emit(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                color
            });
        }
    }
    
    update() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            return p.life > 0;
        });
    }
    
    draw(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1;
    }
}
```

#### 屏幕震动
```javascript
let shakeDuration = 0;

function triggerShake(duration = 10) {
    shakeDuration = duration;
}

function getShakeOffset() {
    if (shakeDuration <= 0) return { x: 0, y: 0 };
    shakeDuration--;
    return {
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10
    };
}

// 绘制时应用偏移
const shake = getShakeOffset();
ctx.save();
ctx.translate(shake.x, shake.y);
// ... 绘制游戏 ...
ctx.restore();
```

#### 主题切换
```css
:root {
    --bg-color: #111;
    --snake-color: #4caf50;
    --food-color: #f44336;
    --grid-color: #222;
    --text-color: #fff;
}

[data-theme="light"] {
    --bg-color: #f5f5f5;
    --snake-color: #2e7d32;
    --food-color: #c62828;
    --grid-color: #e0e0e0;
    --text-color: #333;
}

[data-theme="cyber"] {
    --bg-color: #0a0a0a;
    --snake-color: #00ff00;
    --food-color: #ff00ff;
    --grid-color: #1a1a1a;
    --text-color: #00ffff;
}
```

```javascript
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
}

// 加载时恢复主题
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);
```

---

## 📝 开发优先级建议

### 第一阶段（核心体验）
- [ ] 粒子效果（吃食物、游戏结束）
- [ ] 屏幕震动反馈
- [ ] 多种食物类型（普通、金色、毒蘑菇）

### 第二阶段（深度玩法）
- [ ] 道具系统（幽灵、加速、磁力）
- [ ] 多种游戏模式（时间挑战、迷宫、禅模式）
- [ ] 主题切换系统

### 第三阶段（完整体验）
- [ ] 音效系统
- [ ] 成就系统
- [ ] 本地排行榜
- [ ] 操作指南/教程

---

## 💡 创意扩展

### 多人模式思路
- **对战模式**: 同屏两条蛇，竞争食物，可以互相阻挡
- **合作模式**: 共同吃食物，共享分数池
- **夺旗模式**: 先吃到 5 个金色食物获胜

### Roguelike 元素
- 每局随机获得一个被动技能（如：开局+3 长度、食物+50% 分数、穿墙一次）
- 连续不吃食物会扣血（紧迫感）
- 特殊事件："食物狂潮"（10 秒内食物生成速度翻倍）

### 剧情模式
- 蛇为了救被老鹰抓走的伴侣，踏上冒险之旅
- 每关不同地图主题（森林、沙漠、冰雪、火山）
- Boss 战：巨型蜘蛛需要绕圈包围才能击败

---

*最后更新: 2026-03-01*
*对应项目: discord-games/snake-game*
