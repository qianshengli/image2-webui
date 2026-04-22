# ChatGpt Image Studio

ChatGpt Image Studio 是一个单仓库交付的图片工作流项目：

- `backend/`：Go 后端，负责 API 与静态资源托管
- `web/`：Next.js 前端，构建后静态导出到 `web/out`
- `scripts/`：统一的构建、开发、检查脚本

项目的交付方式是“一个服务统一承载前后端”：前端构建产物输出到 `web/out`，后端直接托管它，不需要把前端和后端拆成两个独立产品部署。

> [!WARNING]
> 免责声明：
>
> 本项目涉及对 ChatGPT 官网相关图片能力的研究与封装，仅供个人学习、技术研究与非商业性技术交流使用。
>
> - 严禁将本项目用于任何商业用途、盈利性使用、批量操作、自动化滥用或规模化调用。
> - 严禁将本项目用于生成、传播或协助生成违法、暴力、色情、未成年人相关内容，或用于诈骗、欺诈、骚扰等非法或不当用途。
> - 严禁将本项目用于任何违反 OpenAI 服务条款、当地法律法规或平台规则的行为。
> - 使用者应自行承担全部风险，包括但不限于账号被限制、临时封禁、永久封禁以及因违规使用等导致的法律责任。
> - 使用本项目即视为你已充分理解并同意本免责声明全部内容；如因滥用、违规或违法使用造成任何后果，均由使用者自行承担。

> [!IMPORTANT]
> 本项目基于对 ChatGPT 官网相关能力的研究实现，存在账号受限、临时封禁或永久封禁的风险。请勿使用自己的重要账号、常用账号或高价值账号进行测试。

## 核心功能

- 基于 `gpt-image-2` 的文本生图
- 参考图生成与连续编辑
- 选区涂抹式局部重绘
- 图片放大与增强
- 本地认证文件导入与账号池管理
- 额度查询与刷新
- 与 CLIProxyAPI 兼容的 CPA 双向同步

## 仓库结构

```text
.
├── backend/                  Go 后端
│   ├── api/                  HTTP 路由与处理器
│   ├── internal/             配置、账号、同步、中间件
│   ├── data/                 运行时数据目录（默认不入库）
│   ├── data/config.defaults.toml  默认配置（复制为 config.toml 后生效）
│   └── main.go
├── web/                      Next.js 前端
├── scripts/                  build / dev / check 脚本
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 环境要求

- Go `1.26+`
- Node.js `24+`
- npm `10+`

## 获取项目

```bash
git clone https://github.com/peiyizhi0724/ChatGpt-Image-Studio.git
cd ChatGpt-Image-Studio
```

## 快速开始

### 1. 准备本地配置

先复制默认配置为本地配置：

```powershell
Copy-Item backend/data/config.defaults.toml backend/data/config.toml
```

```bash
cp backend/data/config.defaults.toml backend/data/config.toml
```

最小本地配置：

```toml
[app]
auth_key = "chatgpt2api"
```

如果需要接入 CPA 同步：

```toml
[sync]
enabled = true
base_url = "http://127.0.0.1:8317"
management_key = "your-cliproxy-management-key"
provider_type = "codex"
```

如果需要通过固定代理访问 ChatGPT，可追加：

```toml
[proxy]
enabled = true
url = "socks5h://127.0.0.1:10808"
mode = "fixed"
sync_enabled = false
```

说明：

- 当前仅支持固定代理模式 `fixed`
- `url` 支持 `socks5`、`socks5h`、`http`、`https`
- `sync_enabled = true` 时，CPA 同步请求也会复用同一代理

### 2. 启动开发环境

Windows：

```powershell
./scripts/dev.ps1
```

macOS / Linux：

```bash
chmod +x ./scripts/*.sh
./scripts/dev.sh
```

默认地址：

- `http://127.0.0.1:7000`

健康检查：

- `GET /health`

## 构建

Windows：

```powershell
./scripts/build.ps1
```

macOS / Linux：

```bash
./scripts/build.sh
```

构建产物：

- 前端静态文件：`web/out`
- 后端二进制：`dist/`

## 验证

Windows：

```powershell
./scripts/check.ps1
```

macOS / Linux：

```bash
./scripts/check.sh
```

当前检查项：

- `go test ./...`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Docker 部署

一键构建并启动：

```bash
docker compose up --build
```

说明：

- 服务默认监听 `7000`
- `./backend/data` 会挂载到容器内 `/app/backend/data`
- `docker-compose.yml` 默认设置 `TZ=${TZ:-Asia/Shanghai}`，如需其他时区可在启动前覆盖 `TZ`
- 本地认证文件、同步状态、本地配置都保存在宿主机，不会丢失

## 主要接口

### 应用基础

- `POST /auth/login`
- `GET /version`
- `GET /health`

### 账号管理

- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/import`
- `DELETE /api/accounts`
- `POST /api/accounts/refresh`
- `POST /api/accounts/update`
- `GET /api/accounts/{id}/quota`

### 同步

- `GET /api/sync/status`
- `POST /api/sync/run`

`/api/sync/run` 支持两个方向：

- `pull`：从 CPA 拉取本地缺失账号与不一致状态
- `push`：把本地缺失账号与不一致状态同步到 CPA

### 图片接口

- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/images/upscale`
- `GET /v1/models`
- `GET /v1/files/image/{filename}`

## 本地数据与敏感信息

以下内容默认不会提交到 Git：

- `backend/data/config.toml`
- `backend/data/accounts_state.json`
- `backend/data/auths/*.json`
- `backend/data/sync_state/*.json`
- `backend/data/tmp/`
- 构建产物、日志、临时文件、本地二进制

不要提交认证文件、管理密钥、运行状态或日志中的敏感内容。

## 认证文件导入规则

导入认证文件时，系统按 `账号身份 + 账号类型` 判重，而不是只按 token 判重。

身份优先级：

- `account_id`
- `chatgpt_account_id`
- `user_id`
- `email`

时间优先级：

- `last_refresh`
- `last_refreshed_at`
- `updated_at`
- `modified_at`
- `created_at`

如果账号身份和类型相同，则保留更新的一份。

## 发布与交付

- GitHub CI：`.github/workflows/ci.yml`
- Docker 交付：`Dockerfile` 与 `docker-compose.yml`
- 安全反馈说明：`SECURITY.md`

## 社区支持

- Linux.do 社区：<https://linux.do/>

## 许可证

本仓库使用 MIT 许可证，详见 [LICENSE](LICENSE)。
