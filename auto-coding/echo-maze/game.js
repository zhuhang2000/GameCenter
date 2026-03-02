/* Echo Maze Prototype
 * - 15x15 maze generation
 * - Runner cannot see maze (unless debug toggle)
 * - Echo sees full maze
 * - Echo messages: max 5 chars, 3s delay
 * - Runner RX cooldown 2s after each move
 * - Wall hit: stun 5s (no move, no receive)
 * - Win: reach exit within 60 moves
 */

const GRID = 15;
const MAX_STEPS = 60;
const ECHO_DELAY_MS = 3000;
const RX_COOLDOWN_MS = 2000;
const STUN_MS = 5000;

const $ = (id) => document.getElementById(id);

const ui = {
  btnNew: $('btnNew'),
  btnReset: $('btnReset'),
  chkAssist: $('chkAssist'),

  runnerCanvas: $('runnerCanvas'),
  echoCanvas: $('echoCanvas'),

  steps: $('steps'),
  stepsLeft: $('stepsLeft'),
  rxCooldown: $('rxCooldown'),
  stun: $('stun'),

  runnerStatus: $('runnerStatus'),
  echoStatus: $('echoStatus'),

  echoInput: $('echoInput'),
  btnSend: $('btnSend'),

  runnerInbox: $('runnerInbox'),
  echoOutbox: $('echoOutbox'),
  btnClearInbox: $('btnClearInbox'),
  btnClearOutbox: $('btnClearOutbox'),
};

const ctxRunner = ui.runnerCanvas.getContext('2d');
const ctxEcho = ui.echoCanvas.getContext('2d');

// Expose for debugging in console
window.__echoMaze = { ui, ctxRunner, ctxEcho };

function now() { return performance.now(); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtS(ms) { return (ms / 1000).toFixed(1) + 's'; }
function pad2(n){return String(n).padStart(2,'0');}
function stamp(){
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// Maze representation: each cell has walls bitmask N/E/S/W
const N=1, E=2, S=4, W=8;
const DX = { [N]:0, [E]:1, [S]:0, [W]:-1 };
const DY = { [N]:-1, [E]:0, [S]:1, [W]:0 };
const OPP = { [N]:S, [E]:W, [S]:N, [W]:E };

function makeMaze(w=GRID, h=GRID){
  // Initialize all walls present
  const cells = Array.from({length: h}, () => Array.from({length: w}, () => (N|E|S|W)));
  const visited = Array.from({length: h}, () => Array.from({length: w}, () => false));

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  const stack = [{x:0,y:0}];
  visited[0][0]=true;

  while(stack.length){
    const cur = stack[stack.length-1];
    const dirs = shuffle([N,E,S,W]);
    let carved = false;
    for(const dir of dirs){
      const nx = cur.x + DX[dir];
      const ny = cur.y + DY[dir];
      if(nx<0||ny<0||nx>=w||ny>=h) continue;
      if(visited[ny][nx]) continue;
      // Remove walls between cur and next
      cells[cur.y][cur.x] &= ~dir;
      cells[ny][nx] &= ~OPP[dir];
      visited[ny][nx]=true;
      stack.push({x:nx,y:ny});
      carved = true;
      break;
    }
    if(!carved) stack.pop();
  }

  return { w, h, cells };
}

function canMove(maze, x, y, dir){
  const cell = maze.cells[y][x];
  // if wall exists in that dir, cannot move
  return (cell & dir) === 0;
}

function moveDelta(dir){
  return { dx: DX[dir], dy: DY[dir] };
}

function dirFromKey(key){
  if(key==='ArrowUp'||key==='w'||key==='W') return N;
  if(key==='ArrowRight'||key==='d'||key==='D') return E;
  if(key==='ArrowDown'||key==='s'||key==='S') return S;
  if(key==='ArrowLeft'||key==='a'||key==='A') return W;
  return null;
}

// Game state
let state;

function freshState(){
  const maze = makeMaze(GRID, GRID);
  const start = {x:0,y:0};
  const exit = {x: GRID-1, y: GRID-1};

  return {
    maze,
    start,
    exit,
    runner: {
      x: start.x,
      y: start.y,
      steps: 0,
      rxCooldownUntil: 0,
      stunnedUntil: 0,
      won: false,
      lost: false,
    },
    echoQueue: [], // {id, text, createdAt, deliverAt, status}
    inbox: [],
    outbox: [],
    debugAssist: false,
    lastTickAt: now(),
  };
}

function resetGame(newMaze=false){
  const prevAssist = state?.debugAssist ?? false;
  if(!state || newMaze) state = freshState();
  else {
    const m = state.maze;
    state = freshState();
    state.maze = m;
    state.debugAssist = prevAssist;
  }
  state.debugAssist = prevAssist;
  window.__echoMaze.state = state;
  ui.chkAssist.checked = state.debugAssist;

  ui.runnerInbox.innerHTML = '';
  ui.echoOutbox.innerHTML = '';
  state.inbox = [];
  state.outbox = [];
  renderAll();
  setRunnerBadge('READY', 'neutral');
}

function setRunnerBadge(text, kind){
  ui.runnerStatus.textContent = text;
  ui.runnerStatus.className = 'badge' + (kind ? ' ' + kind : '');
}

function updateHUD(){
  const runner = state.runner;
  ui.steps.textContent = String(runner.steps);
  ui.stepsLeft.textContent = String(Math.max(0, MAX_STEPS - runner.steps));

  const t = now();
  ui.rxCooldown.textContent = fmtS(Math.max(0, runner.rxCooldownUntil - t));
  ui.stun.textContent = fmtS(Math.max(0, runner.stunnedUntil - t));

  if(runner.won){
    setRunnerBadge('WIN', '');
  } else if(runner.lost){
    setRunnerBadge('LOSE', 'danger');
  } else if(t < runner.stunnedUntil){
    setRunnerBadge('STUNNED', 'danger');
  } else if(t < runner.rxCooldownUntil){
    setRunnerBadge('DEAF', 'warn');
  } else {
    setRunnerBadge('READY', 'neutral');
  }
}

function logTo(el, itemHtml){
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = itemHtml;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function addInbox(text){
  state.inbox.push({t: now(), text});
  logTo(ui.runnerInbox, `<span class="t">[${stamp()}]</span> <span class="ok">${escapeHtml(text)}</span>`);
}

function addInboxBlocked(text, reason){
  state.inbox.push({t: now(), text, blocked:true, reason});
  logTo(ui.runnerInbox, `<span class="t">[${stamp()}]</span> <span class="bad">(丢失)</span> ${escapeHtml(text)} <span class="hold">— ${escapeHtml(reason)}</span>`);
}

function addOutbox(text, etaMs){
  const id = Math.random().toString(16).slice(2);
  const createdAt = now();
  const deliverAt = createdAt + etaMs;
  const entry = { id, text, createdAt, deliverAt, status: 'pending' };
  state.echoQueue.push(entry);
  state.outbox.push(entry);
  logTo(ui.echoOutbox, `<span class="t">[${stamp()}]</span> <span class="hold">(排队)</span> ${escapeHtml(text)} <span class="muted">ETA ${fmtS(etaMs)}</span> <span class="muted" data-qid="${id}"></span>`);
}

function updateOutboxLine(id, html){
  const node = ui.echoOutbox.querySelector(`[data-qid="${id}"]`);
  if(node) node.innerHTML = html;
}

function tryDeliver(entry){
  const r = state.runner;
  const t = now();
  const canReceive = (!r.won && !r.lost) && (t >= r.stunnedUntil) && (t >= r.rxCooldownUntil);
  if(canReceive){
    addInbox(entry.text);
    entry.status = 'delivered';
    updateOutboxLine(entry.id, `<span class="ok">DELIVERED</span>`);
  } else {
    const reason = t < r.stunnedUntil ? '探路者眩晕中' : (t < r.rxCooldownUntil ? '探路者接收冷却中' : '游戏已结束');
    addInboxBlocked(entry.text, reason);
    entry.status = 'dropped';
    updateOutboxLine(entry.id, `<span class="bad">DROPPED</span> <span class="muted">(${escapeHtml(reason)})</span>`);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function attemptMove(dir){
  const r = state.runner;
  if(r.won || r.lost) return;
  const t = now();
  if(t < r.stunnedUntil) return;

  // Count a step only if move attempt is made (even if hits wall) — matches "撞墙惩罚".
  r.steps += 1;
  r.rxCooldownUntil = t + RX_COOLDOWN_MS;

  if(!canMove(state.maze, r.x, r.y, dir)){
    r.stunnedUntil = t + STUN_MS;
    setRunnerBadge('STUNNED', 'danger');
    if(r.steps >= MAX_STEPS){
      r.lost = true;
      setRunnerBadge('LOSE', 'danger');
    }
    renderAll();
    return;
  }

  const {dx,dy} = moveDelta(dir);
  r.x = clamp(r.x + dx, 0, GRID-1);
  r.y = clamp(r.y + dy, 0, GRID-1);

  // Check win/lose
  if(r.x === state.exit.x && r.y === state.exit.y){
    r.won = true;
    setRunnerBadge('WIN', '');
  } else if(r.steps >= MAX_STEPS){
    r.lost = true;
    setRunnerBadge('LOSE', 'danger');
  }

  renderAll();
}

function drawMaze(ctx, maze, opts){
  const size = ctx.canvas.width;
  const pad = 18;
  const cell = (size - pad*2) / maze.w;

  // background
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0,0,size,size);

  // subtle grid
  ctx.save();
  ctx.translate(pad, pad);

  // walls
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;

  for(let y=0;y<maze.h;y++){
    for(let x=0;x<maze.w;x++){
      const v = maze.cells[y][x];
      const x0 = x*cell;
      const y0 = y*cell;
      ctx.beginPath();
      if(v & N){ ctx.moveTo(x0, y0); ctx.lineTo(x0+cell, y0); }
      if(v & E){ ctx.moveTo(x0+cell, y0); ctx.lineTo(x0+cell, y0+cell); }
      if(v & S){ ctx.moveTo(x0, y0+cell); ctx.lineTo(x0+cell, y0+cell); }
      if(v & W){ ctx.moveTo(x0, y0); ctx.lineTo(x0, y0+cell); }
      ctx.stroke();
    }
  }

  // start/exit markers
  const start = opts.start;
  const exit = opts.exit;

  // start
  ctx.fillStyle = 'rgba(121,255,168,0.18)';
  ctx.fillRect(start.x*cell+3, start.y*cell+3, cell-6, cell-6);

  // exit
  ctx.fillStyle = 'rgba(255,214,110,0.18)';
  ctx.fillRect(exit.x*cell+3, exit.y*cell+3, cell-6, cell-6);

  // runner dot
  const r = opts.runner;
  ctx.fillStyle = 'rgba(120,183,255,0.95)';
  ctx.beginPath();
  ctx.arc(r.x*cell + cell/2, r.y*cell + cell/2, Math.max(4, cell*0.22), 0, Math.PI*2);
  ctx.fill();

  ctx.restore();

  // overlay label
  if(opts.overlayText){
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0,0,size,32);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.fillText(opts.overlayText, 12, 20);
  }
}

function drawRunnerView(ctx){
  const size = ctx.canvas.width;
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0,0,size,size);

  const pad = 18;
  const cell = (size - pad*2)/GRID;

  // Runner doesn't see maze: draw soft fog and only their position
  ctx.save();
  ctx.translate(pad,pad);

  // draw faint grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(let i=0;i<=GRID;i++){
    ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(GRID*cell, i*cell); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, GRID*cell); ctx.stroke();
  }

  // optional assist
  if(state.debugAssist){
    // draw real walls lightly
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for(let y=0;y<GRID;y++){
      for(let x=0;x<GRID;x++){
        const v = state.maze.cells[y][x];
        const x0=x*cell, y0=y*cell;
        ctx.beginPath();
        if(v & N){ ctx.moveTo(x0, y0); ctx.lineTo(x0+cell,y0); }
        if(v & E){ ctx.moveTo(x0+cell,y0); ctx.lineTo(x0+cell,y0+cell); }
        if(v & S){ ctx.moveTo(x0, y0+cell); ctx.lineTo(x0+cell,y0+cell); }
        if(v & W){ ctx.moveTo(x0, y0); ctx.lineTo(x0, y0+cell); }
        ctx.stroke();
      }
    }
  }

  // runner dot
  const runner = state.runner;
  ctx.fillStyle = 'rgba(120,183,255,0.95)';
  ctx.beginPath();
  ctx.arc(runner.x*cell + cell/2, runner.y*cell + cell/2, Math.max(4, cell*0.24), 0, Math.PI*2);
  ctx.fill();

  // status ring
  const t = now();
  if(t < runner.stunnedUntil){
    ctx.strokeStyle = 'rgba(255,92,122,0.8)';
  } else if(t < runner.rxCooldownUntil){
    ctx.strokeStyle = 'rgba(255,214,110,0.8)';
  } else {
    ctx.strokeStyle = 'rgba(121,255,168,0.7)';
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(runner.x*cell + cell/2, runner.y*cell + cell/2, Math.max(8, cell*0.34), 0, Math.PI*2);
  ctx.stroke();

  ctx.restore();

  // top overlay
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0,0,size,32);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  const txt = runner.won ? '✅ 已到达出口！' : (runner.lost ? '❌ 60步用尽' : '你看不到迷宫。依赖回声师的指令。');
  ctx.fillText(state.debugAssist ? (txt + '  [DEBUG: 显示迷宫]') : txt, 12, 20);
}

function renderAll(){
  drawRunnerView(ctxRunner);
  drawMaze(ctxEcho, state.maze, {
    start: state.start,
    exit: state.exit,
    runner: state.runner,
    overlayText: 'Echo view: 绿色=起点, 黄色=出口, 蓝点=探路者'
  });
  updateHUD();
}

function tick(){
  const t = now();

  // update pending queue
  for(const entry of state.echoQueue){
    if(entry.status !== 'pending') continue;
    const left = entry.deliverAt - t;
    updateOutboxLine(entry.id, left > 0 ? `<span class="hold">T-${fmtS(left)}</span>` : `<span class="hold">DELIVERING...</span>`);
    if(left <= 0){
      tryDeliver(entry);
    }
  }

  renderAll();
  requestAnimationFrame(tick);
}

// UI events
ui.btnNew.addEventListener('click', () => resetGame(true));
ui.btnReset.addEventListener('click', () => resetGame(false));
ui.chkAssist.addEventListener('change', (e) => { state.debugAssist = e.target.checked; renderAll(); });

ui.btnSend.addEventListener('click', () => {
  const txt = ui.echoInput.value.trim();
  if(!txt) return;
  const sliced = txt.slice(0,5);
  ui.echoInput.value = '';
  addOutbox(sliced, ECHO_DELAY_MS);
});

// Numpad-style guide input: 8=up 2=down 4=left 6=right 5=stop
function guideKeyToText(k){
  if(k==='8') return '上';
  if(k==='2') return '下';
  if(k==='4') return '左';
  if(k==='6') return '右';
  if(k==='5') return '停';
  return null;
}

function sendGuideKey(k){
  const text = guideKeyToText(k);
  if(!text) return;
  // also reflect into input box so user sees what's being sent
  ui.echoInput.value = text;
  addOutbox(text, ECHO_DELAY_MS);
}

// Clickable keypad buttons
document.querySelectorAll('.padBtn').forEach(btn => {
  btn.addEventListener('click', () => sendGuideKey(btn.getAttribute('data-k')));
});

// Keyboard input: when echoInput is focused OR not, allow numpad digits to enqueue messages.
window.addEventListener('keydown', (e) => {
  const key = e.key;
  if(!['2','4','5','6','8'].includes(key)) return;
  // Avoid conflicting with runner movement (runner uses arrows/WASD)
  // If user is typing in the echo input, we still want it to work.
  e.preventDefault();
  sendGuideKey(key);
});

ui.echoInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') ui.btnSend.click();
});

ui.btnClearInbox.addEventListener('click', () => { ui.runnerInbox.innerHTML=''; state.inbox=[]; });
ui.btnClearOutbox.addEventListener('click', () => { ui.echoOutbox.innerHTML=''; state.outbox=[]; });

window.addEventListener('keydown', (e) => {
  // Don't hijack typing
  const tag = document.activeElement?.tagName?.toLowerCase();
  if(tag === 'input' || tag === 'textarea') return;
  const dir = dirFromKey(e.key);
  if(!dir) return;
  e.preventDefault();
  attemptMove(dir);
});

// Boot
state = freshState();
window.__echoMaze.state = state;
ui.chkAssist.checked = state.debugAssist;
renderAll();
requestAnimationFrame(tick);
