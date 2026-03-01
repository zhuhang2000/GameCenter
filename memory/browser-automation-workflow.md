# 浏览器自动化工作流指南

> 创建时间：2026-03-01
> 用途：游戏开发中的浏览器自动化截图与验证

---

## 问题背景

在游戏开发过程中，需要验证游戏在浏览器中的实际运行效果，包括：
- 界面布局是否正确
- 游戏功能是否正常工作
- 视觉效果（粒子、动画等）是否正常
- 截图留存用于文档或展示

---

## 遇到的问题与解决方案

### 问题 1：无法直接打开本地文件
**错误：** `Navigation blocked: unsupported protocol "file:"`

**原因：** 浏览器的安全策略限制，无法直接通过 `file://` 协议访问本地文件。

**解决方案：**
```python
# 启动本地 HTTP 服务器
python -m http.server 8080

# 然后通过 http://localhost:8080 访问
```

---

### 问题 2：Chrome 扩展未连接
**错误：** `Chrome extension relay is running, but no tab is connected`

**原因：** 使用 `profile=chrome` 时需要手动点击浏览器扩展图标连接标签页。

**解决方案：**
使用 `profile=openclaw` 代替，这是一个独立的浏览器实例，无需手动连接：
```json
{
  "action": "open",
  "targetUrl": "http://localhost:8080",
  "profile": "openclaw"
}
```

---

### 问题 3：浏览器控制服务超时
**错误：** `Can't reach the OpenClaw browser control service (timed out after 20000ms)`

**原因：** 浏览器实例可能崩溃或连接断开。

**解决方案：**
1. 重启 OpenClaw gateway：
   ```bash
   openclaw gateway restart
   ```
2. 或者重启浏览器实例：
   ```json
   {"action": "stop", "profile": "openclaw"}
   {"action": "start", "profile": "openclaw"}
   ```

---

## 标准工作流程

### 步骤 1：启动本地服务器
```powershell
# 在游戏目录下启动 HTTP 服务器
python -m http.server 8080
```

### 步骤 2：启动浏览器并打开游戏
```json
{
  "action": "start",
  "profile": "openclaw"
}
```

```json
{
  "action": "open",
  "targetUrl": "http://localhost:8080",
  "profile": "openclaw"
}
```

### 步骤 3：捕获截图
```json
{
  "action": "screenshot",
  "profile": "openclaw",
  "type": "png",
  "fullPage": true
}
```

### 步骤 4：模拟用户操作（可选）
```json
{
  "action": "act",
  "profile": "openclaw",
  "request": {
    "kind": "press",
    "key": "ArrowRight"
  }
}
```

### 步骤 5：保存截图到项目目录
```powershell
Copy-Item "browser-screenshot.png" "project/screenshot/"
```

---

## 自动化验证清单

在截图后，检查以下内容：

### 界面验证
- [ ] 游戏画布正确显示
- [ ] 分数/最高分显示正确
- [ ] 控制说明可见
- [ ] 无布局错乱

### 功能验证
- [ ] 蛇可以移动（通过键盘操作测试）
- [ ] 食物正确显示
- [ ] 碰撞检测正常
- [ ] 游戏结束界面正确显示

### 视觉效果验证
- [ ] 粒子效果正常（吃食物时）
- [ ] 屏幕震动效果（碰撞时）
- [ ] 颜色、渐变正确
- [ ] 动画流畅无卡顿

---

## 故障排除速查表

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 无法打开本地文件 | 浏览器安全限制 | 使用 HTTP 服务器 |
| Chrome 扩展未连接 | 需要手动连接标签页 | 使用 openclaw profile |
| 服务超时 | 浏览器实例崩溃 | 重启 gateway 或浏览器 |
| 截图空白 | 页面未加载完成 | 添加延迟后重试 |
| 游戏无法交互 | 键盘焦点不在画布 | 点击画布后再操作 |

---

## 相关文件位置

- 截图保存目录：`workspace/screenshot/`
- 游戏项目目录：`auto-coding/snake-game/`
- 本工作流文档：`memory/browser-automation-workflow.md`

---

*最后更新：2026-03-01*
*下次更新时机：遇到新的浏览器自动化问题或发现更优解决方案时*
