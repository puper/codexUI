# codexapp

### 在浏览器中运行 Codex App UI，支持 Linux、Windows、Termux 和远程主机

[![npm](https://img.shields.io/npm/v/codexapp?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/codexapp)
[![platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20Android-blue?style=for-the-badge)](#快速开始)
[![node](https://img.shields.io/badge/Node-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![license](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

`codexapp` 是一个轻量 Web UI bridge。它启动本地 Web 服务，并通过 Codex `app-server` 把 Codex 工作流暴露到浏览器中。

---

<img width="1366" height="900" alt="image" src="https://github.com/user-attachments/assets/1a3578ba-add8-49a2-88b4-08195a7f0140" />

## 这是什么

`codexapp` 提供一个浏览器可访问的 Codex UI：

- 后端启动 Codex `app-server`
- 前端通过同源 `/codex-api/*` 与后端通信
- 实时通知通过 WebSocket `/codex-api/ws`
- API、本地文件资源和 WebSocket 都需要 bearer token 鉴权
- 可以本机使用，也可以绑定到指定 LAN/Tailscale 地址远程访问

## 快速开始

```bash
npx codexapp
```

启动后打开：

```text
http://localhost:5900
```

服务启动时会打印 auth token。浏览器登录页需要输入这个 token。也可以自己指定：

```bash
npx codexapp --host 0.0.0.0 --port 5900 --auth-token your-token
```

只绑定指定网卡地址时，`--host` 支持逗号分隔：

```bash
npx codexapp --host 127.0.0.1,100.88.100.196 --port 5901 --auth-token your-token
```

这会只监听：

```text
http://localhost:5901
http://100.88.100.196:5901
```

不会再同时绑定其他 LAN、虚拟机或 Docker bridge 地址。

如果 Codex 已经通过自定义 provider、AI 网关或已有登录状态可用，不希望启动时提示 `codex login`：

```bash
npx codexapp --no-login
```

如果 Codex 不在 `PATH` 中，指定用于运行 `codex app-server` 的可执行文件：

```bash
npx codexapp --codex-command /absolute/path/to/codex
```

该路径会保存到：

```text
~/.codex/webui-runtime.json
```

也可以用环境变量指定，环境变量优先级更高：

```bash
CODEXUI_CODEX_COMMAND=/absolute/path/to/codex npx codexapp
```

## 完整运行命令

从源码运行，并指定 Codex.app 内置的 Codex 可执行文件：

```bash
pnpm install

CODEXUI_CODEX_COMMAND=/Applications/Codex.app/Contents/Resources/codex \
CODEXUI_AUTH_TOKEN=your-token \
pnpm run dev -- --host 0.0.0.0 --port 5900
```

从当前 checkout 构建后运行 CLI：

```bash
pnpm run build

CODEXUI_CODEX_COMMAND=/Applications/Codex.app/Contents/Resources/codex \
node dist-cli/index.js \
  --host 0.0.0.0 \
  --port 5900 \
  --auth-token your-token \
  --no-open \
  --no-login
```

使用 CLI 参数指定 Codex 路径：

```bash
node dist-cli/index.js \
  --host 0.0.0.0 \
  --port 5900 \
  --auth-token your-token \
  --codex-command /Applications/Codex.app/Contents/Resources/codex \
  --no-open \
  --no-login
```

通过已发布 npm 包运行：

```bash
CODEXUI_CODEX_COMMAND=/Applications/Codex.app/Contents/Resources/codex \
CODEXUI_AUTH_TOKEN=your-token \
npx codexapp@latest \
  --host 0.0.0.0 \
  --port 5900 \
  --no-open \
  --no-login
```

仅使用 CLI 参数的等价命令：

```bash
npx codexapp@latest \
  --host 0.0.0.0 \
  --port 5900 \
  --auth-token your-token \
  --codex-command /Applications/Codex.app/Contents/Resources/codex \
  --no-open \
  --no-login
```

只暴露 localhost 和 Tailscale IP：

```bash
CODEXUI_AUTH_TOKEN=your-token \
npx codexapp@latest \
  --host 127.0.0.1,100.88.100.196 \
  --port 5901 \
  --no-open \
  --no-login
```

## 参数说明

- `--no-open`：服务启动后不自动打开浏览器；服务仍会正常启动并打印 URL。
- `--no-login`：跳过 Codex CLI 登录引导。它不会关闭 codexUI bearer-token 鉴权，也不会退出 Codex 账号。
- `--auth-token`：设置浏览器登录和 API 请求使用的静态 bearer token。API 请求需要 `Authorization: Bearer <token>`。
- `--host`：监听地址，支持单个地址或逗号分隔地址。`0.0.0.0` 表示所有网卡；`127.0.0.1` 表示仅本机；`127.0.0.1,100.88.100.196` 表示只监听 localhost 和指定 Tailscale IP。
- `--port`：监听端口。
- `--codex-command`：指定用于运行 `codex app-server` 的 Codex CLI 路径。
- `--sandbox-mode`：传给 Codex 的 sandbox 模式，可用值包括 `read-only`、`workspace-write`、`danger-full-access`。
- `--approval-policy`：传给 Codex 的 approval policy，可用值包括 `untrusted`、`on-failure`、`on-request`、`never`。

## Docker 隔离运行

Docker 可以减少宿主机文件暴露面：容器内运行 `codexapp` 和 Linux 版 Codex CLI，只挂载你明确指定的目录。

注意：macOS 的 `/Applications/Codex.app/Contents/Resources/codex` 不能在默认 Linux Docker 容器里执行。Docker 镜像会安装并使用容器内的 Linux `codex` CLI。

构建镜像：

```bash
docker build -t codexui:local .
```

创建单独的 Codex home，不要直接挂载宿主机真实 `~/.codex`：

```bash
mkdir -p "$HOME/.codex-docker"
```

如果容器内 Codex CLI 需要登录状态：

```bash
docker run --rm -it \
  -v "$HOME/.codex-docker:/home/node/.codex" \
  --entrypoint codex \
  codexui:local login
```

只挂载需要操作的 workspace：

```bash
docker run --rm -it \
  --name codexui \
  -p 127.0.0.1:5900:5900 \
  -e CODEXUI_AUTH_TOKEN=your-token \
  -v "$HOME/.codex-docker:/home/node/.codex" \
  -v "$PWD:/workspace" \
  codexui:local
```

尽量挂载更窄的目录，例如：

```bash
-v "/Users/puper/Documents/projects/my-project:/workspace"
```

不要挂载整个宿主机 home，除非你明确希望 Codex 能访问这些文件。

更严格的容器限制示例：

```bash
docker run --rm -it \
  --name codexui \
  --cap-drop=ALL \
  --security-opt no-new-privileges \
  --pids-limit=512 \
  --memory=4g \
  --cpus=2 \
  --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=512m \
  --tmpfs /home/node/.cache:rw,nosuid,nodev,size=256m \
  -p 127.0.0.1:5900:5900 \
  -e CODEXUI_AUTH_TOKEN=your-token \
  -v "$HOME/.codex-docker:/home/node/.codex" \
  -v "$PWD:/workspace" \
  codexui:local
```

安全边界说明：

- Docker 会限制容器只能访问挂载进去的路径，但它不是完整安全沙箱。
- 镜像默认设置 `CODEXUI_SANDBOX_MODE=workspace-write` 和 `CODEXUI_APPROVAL_POLICY=on-request`。
- 默认仍允许出网，因为 Codex/provider API 需要访问网络。
- 挂载 `~/.ssh`、云厂商凭证、浏览器配置或真实 `~/.codex` 会让容器内进程访问这些敏感数据。
- 更推荐使用独立的 `.codex-docker` 和项目级 workspace 挂载。

## 发布

发布前验证：

```bash
git status --short
pnpm install
pnpm run build
pnpm run test:unit
```

升级版本并发布到 npm：

```bash
pnpm version patch
npm login
npm publish --access public
```

验证已发布包：

```bash
npx codexapp@latest --help

CODEXUI_CODEX_COMMAND=/Applications/Codex.app/Contents/Resources/codex \
CODEXUI_AUTH_TOKEN=your-token \
npx codexapp@latest --host 0.0.0.0 --port 5900 --no-open --no-login
```

如果 npm 打印下面这类警告：

```text
Unknown project config "side-effects-cache"
Unknown project config "package-import-method"
```

说明项目级 `.npmrc` 里可能有 pnpm 专用配置。删除这些旧配置后再运行 npm 命令。

## 平台说明

### Linux

```bash
node -v   # 需要 18+
npx codexapp
```

### Windows PowerShell

```powershell
node -v   # 需要 18+
npx codexapp
```

### Termux Android

```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
npx codexapp
```

Android 后台运行注意事项：

1. 保持当前 Termux session 运行，不要关闭。
2. 在 Android 设置里关闭 Termux 的电池优化。
3. 保持 Termux 常驻通知开启，减少被系统杀掉的概率。
4. 可选但推荐：

```bash
termux-wake-lock
```

5. 在 Android 浏览器打开服务打印的 URL。如果服务被系统杀掉，回到 Termux 重新运行 `npx codexapp`。

## iPhone / iPad 通过 HTTPS 反向代理访问

如果要从 iPhone 或 iPad Safari 使用 codexUI，建议通过 HTTPS 提供访问。

一个实用的私有部署方式：

```powershell
npx codexapp --port 5900
```

然后放到你自己控制的 HTTPS 反向代理后面。

这个方式适合：

- iPhone Safari 访问
- 添加到主屏幕
- 使用内置语音输入 / 转写
- 从 Windows 主机外的设备查看同一批项目和会话

注意：

- iOS 上语音输入通常需要 HTTPS / secure context。
- 反向代理访问仍需要 codexUI bearer token。
- 如果 Web UI 创建的会话没有立刻出现在 Windows Codex App 中，重启 Windows App 可能会刷新列表。

## 功能

- 一条 `npx codexapp` 命令启动
- Linux、Windows、Termux Android 支持
- 浏览器优先的 Codex UI
- 支持指定监听地址、端口、多 host 绑定
- 支持 LAN、Tailscale、反向代理访问
- bearer token 鉴权
- WebSocket 实时通知
- Codex `app-server` bridge
- 自定义 provider 入口
- 内置终端面板
- 本地文件浏览和文本编辑
- 语音输入转写到 composer draft
- Skills / Plugins / Apps 管理视图
- 项目选择、创建、排序和 pin 状态

## 最近的产品功能

- 新建 thread 流程中的可搜索项目选择器
- `Select folder` 旁的 `Create Project` 按钮
- 新项目自动 pin 到顶部
- 服务器侧空目录扫描生成默认项目名，例如 `New Project (N)`
- 项目排序持久化到 workspace roots state
- 刷新 / 轮询期间保留进行中的 thread
- 移动端 drawer sidebar
- Skills Hub 移动端布局优化
- Skill detail modal 移动端 sheet 行为优化
- Composer 语音输入流程：按住说话、转写、追加到输入框
- Codex 和自定义 provider 模式
- bearer token 鉴权和登录失败 IP 限速
- Docker 隔离运行

## 典型使用场景

| 场景 | 作用 |
|---|---|
| Linux 工作站 | 不依赖桌面壳，直接在浏览器中使用 Codex UI |
| Windows 主机 | 快速启动 Web UI 并通过 Chrome/Edge 访问 |
| Android Termux | 在 Termux 里启动服务，用移动浏览器控制 |
| 远程开发机 | Codex 进程留在服务器，本地浏览器访问 UI |
| 局域网访问 | 同一网络内其他设备打开 UI |
| Tailscale 访问 | 只绑定 localhost 和 Tailscale IP |
| Headless 工作流 | 终端和浏览器分离使用 |
| 私有反向代理 | 按需接入 HTTPS 和访问控制 |

## 截图

### Skills Hub

![Skills Hub](docs/screenshots/skills-hub.png)

### Chat

![Chat](docs/screenshots/chat.png)

### Mobile UI

![Skills Hub Mobile](docs/screenshots/skills-hub-mobile.png)
![Chat Mobile](docs/screenshots/chat-mobile.png)

## 架构

```text
┌─────────────────────────────┐
│  浏览器（桌面 / 移动端）      │
└──────────────┬──────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────┐
│         codexapp            │
│  Express + Vue UI bridge    │
└──────────────┬──────────────┘
               │ JSON-RPC bridge
┌──────────────▼──────────────┐
│      Codex App Server       │
└─────────────────────────────┘
```

## 要求

- Node.js `18+`
- 可运行的 Codex CLI / Codex app-server
- 浏览器可以访问绑定的 host/port
- 麦克风权限，仅语音输入需要

## 故障排查

| 问题 | 处理方式 |
|---|---|
| 端口已占用 | 换端口，或停止旧进程 |
| `npx` 失败 | 更新 npm/node 后重试 |
| 找不到 Codex binary | 使用 `--codex-command /absolute/path/to/codex` 或设置 `CODEXUI_CODEX_COMMAND` |
| 只能本机访问 | 检查 `--host`，`127.0.0.1` 只允许本机访问 |
| 暴露了太多网卡地址 | 不要用 `--host 0.0.0.0`，改用 `--host 127.0.0.1,<指定IP>` |
| Tailscale 不能访问 | 确认绑定的是 Tailscale IP，并从另一台 Tailscale 设备验证 |
| Web 终端打不开 | 检查 `/codex-api/thread-terminal/status`，确认 `node-pty` 可用 |
| API 401 | 确认浏览器输入的 token 与启动时 `--auth-token` / `CODEXUI_AUTH_TOKEN` 一致 |
| Termux 安装失败 | 先执行 `pkg update && pkg upgrade`，再重新安装 `nodejs` |
| iOS 语音输入不可用 | 使用 HTTPS / secure context |

## 参与贡献

欢迎提交 issue 和 PR。适合反馈的问题包括：

- 平台兼容性
- 安装和运行问题
- 安全边界和默认配置
- 文档不一致
- Web UI 交互问题

## 维护信息

项目维护地址：[puper/codexUI](https://github.com/puper/codexUI)

许可证：[MIT](./LICENSE)
