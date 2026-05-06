# image2 webui

image2 webui 是一个“后端托管前端静态资源”的图片工作流项目，目标是用一套服务完成：登录、图片生成/编辑、会话历史、账号池与配置管理。

## 你会得到什么

- 图片工作台：文本生图、参考图编辑、选区重绘
- 会话历史：新建会话、回看结果、失败重试
- 管理后台：账号池、配置管理、请求记录、同步状态
- 单服务部署：后端进程直接托管 `static/`，无需单独前端服务

## 项目结构

```text
.
├── backend/                  Go 后端
│   ├── api/                  HTTP 路由与处理器
│   ├── internal/             配置、账号、同步、中间件
│   ├── data/                 本地运行数据目录
│   └── main.go
├── web/                      Vite + React 前端
│   ├── src/
│   └── dist/                 构建产物（不入库）
├── docker-compose.yml
└── README.md
```

## 环境要求

- Go `1.25+`
- Node.js `24+`
- npm `10+`
- Docker / Docker Compose（如果使用容器部署）

## 获取与发布方式

本项目支持两种部署路径：

- **云端镜像拉取（推荐）**：通过 Docker Hub / GHCR 拉取镜像升级。
- **本地源码构建（兜底）**：上传代码目录到服务器后本地 `docker compose build`。

示例：

```bash
cd image2-webui
```

源码云端管理建议：

- 开发与协作：使用 GitHub 仓库分支 / tag
- 生产发布：优先使用 GitHub Releases 对应版本归档

## 本地开发

前后端分离开发（推荐）：

1) 启动前端开发服务（热更新）：

```bash
npm --prefix web ci
npm --prefix web run dev
```

2) 启动后端服务：

```bash
go run -C backend .
```

前后端环境构建（生产静态资源）：

macOS / Linux：

```bash
npm --prefix web ci
npm --prefix web run build
rm -rf backend/static
cp -r web/dist backend/static
go build -C backend -o ../dist/image2-webui .
```

Windows PowerShell：

```powershell
npm --prefix web ci
npm --prefix web run build
if (Test-Path "backend/static") { Remove-Item "backend/static" -Recurse -Force }
Copy-Item "web/dist" "backend/static" -Recurse
go build -C backend -o ../dist/image2-webui .
```

默认访问地址：

- `http://127.0.0.1:7000`

健康检查：

- `GET /health`

## Docker 云端镜像部署（推荐）

默认镜像仓库与标签在 `docker-compose.yml` 中可配置：

- `IMAGE_REPO`（默认 `docker.io/qq1090188816/image2-webui`）
- `IMAGE_TAG`（默认 `latest`）

### 首次启动

在服务器目录执行：

```bash
docker compose pull
docker compose up -d
```

默认行为：

- 从云端拉取镜像（不依赖本地构建）
- 挂载 `./backend/data` 到容器内 `/app/data`
- 暴露 `7000` 端口

### 升级到最新镜像

```bash
docker compose pull
docker compose up -d --remove-orphans
```

Windows PowerShell：

```powershell
docker compose pull
docker compose up -d --remove-orphans
```

### 按版本固定部署（可回滚）

```bash
IMAGE_TAG=v1.2.10 docker compose pull
IMAGE_TAG=v1.2.10 docker compose up -d
```

## 本地源码构建部署（兜底）

当你需要二次开发或无法访问镜像仓库时：

```bash
docker compose build --no-cache
docker compose up -d
```

Windows PowerShell：

```powershell
docker compose build --no-cache
docker compose up -d
```

## 配置说明

程序启动会自动确保以下文件存在：

- `backend/data/config.example.toml`
- `backend/data/config.toml`

如果 `config.toml` 不存在，会按模板自动生成。

最小配置：

```toml
[app]
auth_key = "image2webui"
```

后台默认登录密码与 `auth_key` 一致。

## 存储模式

支持按类型拆分存储：

- 账号池：`current / sqlite / redis`
- 配置：`file / redis`
- 图片会话：`browser / server`
- 图片数据：`browser / server`

无状态容器建议：

- `backend = redis`
- `config_backend = redis`
- `image_conversation_storage = browser`
- `image_data_storage = browser`

## 构建发布包

macOS / Linux：

```bash
npm --prefix web ci
npm --prefix web run build
rm -rf backend/static
cp -r web/dist backend/static
mkdir -p dist/package
go build -C backend -o ../dist/package/image2-webui .
cp -r backend/data dist/package/data
cp -r backend/static dist/package/static
```

Windows PowerShell：

```powershell
npm --prefix web ci
npm --prefix web run build
if (Test-Path "backend/static") { Remove-Item "backend/static" -Recurse -Force }
Copy-Item "web/dist" "backend/static" -Recurse
if (-not (Test-Path "dist/package")) { New-Item "dist/package" -ItemType Directory | Out-Null }
go build -C backend -o ../dist/package/image2-webui.exe .
Copy-Item "backend/data" "dist/package/data" -Recurse
Copy-Item "backend/static" "dist/package/static" -Recurse
```

发布目录示例：

```text
dist/package/
├── image2-webui.exe / image2-webui
├── data/
│   └── config.example.toml
├── static/
└── README.txt
```

## 代码检查

```bash
go test -C backend ./...
npm --prefix web ci
npx --prefix web tsc --noEmit -p web/tsconfig.json
npm --prefix web run lint
npm --prefix web run build
```


## 主要接口

应用基础：

- `POST /auth/login`
- `GET /version`
- `GET /health`

图片接口：

- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- `GET /v1/files/image/{filename}`

管理接口：

- `GET /api/accounts`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/requests`
- `GET /api/sync/status`
- `POST /api/sync/run`

## 数据与安全

请勿提交以下本地敏感内容：

- `backend/data/config.toml`
- `backend/data/auths/*.json`
- `backend/data/sync_state/*.json`
- `backend/data/tmp/`
- `backend/data/last-startup-error.txt`
- `backend/static/`
- `web/dist/`

## 许可证

MIT，详见 [LICENSE](LICENSE)。

## 免责声明

本项目仅用于个人学习与技术研究，请勿用于违法违规用途或违反相关平台条款的场景。使用风险（包括账号受限风险）由使用者自行承担。
