"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCcw, RefreshCw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchConfig, fetchDefaultConfig, updateConfig, type ConfigPayload, type ImageMode } from "@/lib/api";

const imageModeOptions: Array<{ label: string; value: ImageMode; hint: string }> = [
  { label: "Studio", value: "studio", hint: "Free 走当前项目官方链路，Plus/Pro/Team 走官方 responses" },
  { label: "CPA", value: "cpa", hint: "所有图片请求优先走 CPA；Free 账号无图片权限" },
  { label: "MIX", value: "mix", hint: "Free 走当前项目官方链路，Plus/Pro/Team 走 CPA" },
];

const imageRouteOptions = [
  { label: "legacy", value: "legacy" },
  { label: "responses", value: "responses" },
];

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-stone-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
      <CardContent className="space-y-5 p-6">
        <div>
          <div className="text-base font-semibold tracking-tight text-stone-900">{title}</div>
          <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
  fullWidth = false,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <div className="text-sm font-medium text-stone-700">{label}</div>
      <div>{children}</div>
      <div className="text-xs leading-5 text-stone-400">{hint}</div>
    </label>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:col-span-2">
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-stone-700">{label}</div>
          <div className="mt-1 text-xs leading-5 text-stone-400">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function joinDisplayPath(root: string, relativePath: string) {
  const normalizedRoot = String(root || "").trim().replace(/[\\/]+$/, "");
  const normalizedRelative = String(relativePath || "").trim().replace(/^[\\/]+/, "");
  if (!normalizedRoot) {
    return normalizedRelative;
  }
  if (!normalizedRelative) {
    return normalizedRoot;
  }
  const separator = normalizedRoot.includes("\\") ? "\\" : "/";
  return `${normalizedRoot}${separator}${normalizedRelative.replace(/[\\/]+/g, separator)}`;
}

function firstNonEmptyValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function defaultConfigPayload(): ConfigPayload {
  return {
    app: {
      name: "",
      version: "",
      apiKey: "",
      authKey: "",
      imageFormat: "url",
      maxUploadSizeMB: 50,
    },
    server: {
      host: "",
      port: 7000,
      staticDir: "",
    },
    chatgpt: {
      model: "gpt-image-2",
      sseTimeout: 300,
      pollInterval: 3,
      pollMaxWait: 180,
      requestTimeout: 30,
      imageMode: "studio",
      freeImageRoute: "legacy",
      freeImageModel: "auto",
      paidImageRoute: "responses",
      paidImageModel: "gpt-5.4-mini",
    },
    accounts: {
      defaultQuota: 5,
      preferRemoteRefresh: true,
      refreshWorkers: 6,
    },
    storage: {
      authDir: "",
      stateFile: "",
      syncStateDir: "",
      imageDir: "",
    },
    sync: {
      enabled: false,
      baseUrl: "",
      managementKey: "",
      requestTimeout: 20,
      concurrency: 4,
      providerType: "codex",
    },
    proxy: {
      enabled: false,
      url: "socks5h://127.0.0.1:10808",
      mode: "fixed",
      syncEnabled: false,
    },
    cpa: {
      baseUrl: "",
      apiKey: "",
      requestTimeout: 60,
    },
    log: {
      logAllRequests: false,
    },
    paths: {
      root: "",
      defaults: "",
      override: "",
    },
  };
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigPayload>(defaultConfigPayload);
  const [defaultConfig, setDefaultConfig] = useState<ConfigPayload>(defaultConfigPayload);
  const [savedConfig, setSavedConfig] = useState<ConfigPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => {
    if (!savedConfig) {
      return false;
    }
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  const resolvedStaticDir = useMemo(() => {
    const staticDir = String(config.server.staticDir || "").trim();
    if (!staticDir) {
      return "";
    }
    if (/^[A-Za-z]:[\\/]/.test(staticDir) || staticDir.startsWith("/") || staticDir.startsWith("\\\\")) {
      return staticDir;
    }
    return joinDisplayPath(config.paths.root, staticDir);
  }, [config.paths.root, config.server.staticDir]);

  const startupErrorPath = useMemo(
    () => joinDisplayPath(config.paths.root, "data/last-startup-error.txt"),
    [config.paths.root],
  );
  const effectiveCPAImageBaseUrl = useMemo(
    () => firstNonEmptyValue(config.cpa.baseUrl, config.sync.baseUrl),
    [config.cpa.baseUrl, config.sync.baseUrl],
  );
  const syncManagementKeyStatus = useMemo(
    () => (String(config.sync.managementKey || "").trim() ? "已配置" : "未配置"),
    [config.sync.managementKey],
  );

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const [currentConfig, defaults] = await Promise.all([fetchConfig(), fetchDefaultConfig()]);
      setConfig(currentConfig);
      setSavedConfig(currentConfig);
      setDefaultConfig(defaults);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取配置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const setSection = <K extends keyof ConfigPayload>(
    section: K,
    nextValue: ConfigPayload[K],
  ) => {
    setConfig((current) => ({
      ...current,
      [section]: nextValue,
    }));
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const result = await updateConfig(config);
      setConfig(result.config);
      setSavedConfig(result.config);
      toast.success("配置已保存并立即生效");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefaults = () => {
    setConfig(defaultConfig);
    toast.success("已恢复为默认配置草稿，点击“保存配置”后才会真正生效");
  };

  return (
    <section className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-1 py-1">
      <div className="rounded-[30px] border border-stone-200 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-stone-950 text-white shadow-sm">
                <Settings2 className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-950">配置管理</h1>
                <p className="mt-2 max-w-[820px] text-sm leading-7 text-stone-500">
                  所有字段都先在页面本地编辑，只有点击“保存配置”后才会写入
                  <span className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-stone-700">data/config.toml</span>
                  并立即在后端生效。发布版默认以
                  <span className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-stone-700">可执行文件所在目录</span>
                  作为配置根目录。
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-stone-200 bg-white px-3 text-[13px] text-stone-700 shadow-none"
              onClick={() => void loadConfig()}
              disabled={isLoading || isSaving}
            >
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              重新读取
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-stone-200 bg-white px-3 text-[13px] text-stone-700 shadow-none"
              onClick={restoreDefaults}
              disabled={isLoading || isSaving}
            >
              <RefreshCcw className="size-4" />
              恢复默认
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-stone-950 px-3 text-[13px] text-white hover:bg-stone-800"
              onClick={() => void saveConfig()}
              disabled={!isDirty || isLoading || isSaving}
            >
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存配置
            </Button>
          </div>
        </div>
      </div>

      <ConfigSection title="图片模式" description="控制图片请求到底走当前项目官方链路，还是走 CPA 的 OpenAI 图片接口。">
        <Field label="图片模式" hint={imageModeOptions.find((item) => item.value === config.chatgpt.imageMode)?.hint || ""}>
          <Select
            value={config.chatgpt.imageMode}
            onValueChange={(value) =>
              setSection("chatgpt", {
                ...config.chatgpt,
                imageMode: value as ImageMode,
              })
            }
          >
            <SelectTrigger className="h-11 rounded-2xl border-stone-200 bg-white shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {imageModeOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="默认图片模型" hint="当前项目图片请求默认使用的模型名。">
          <Input
            value={config.chatgpt.model}
            onChange={(event) => setSection("chatgpt", { ...config.chatgpt, model: event.target.value })}
            className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
          />
        </Field>
          <Field label="Free 官方路由" hint="Studio 模式下 Free 账号走 legacy 还是 responses。">
            <Select
              value={config.chatgpt.freeImageRoute}
              onValueChange={(value) => setSection("chatgpt", { ...config.chatgpt, freeImageRoute: value })}
            >
              <SelectTrigger className="h-11 rounded-2xl border-stone-200 bg-white shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageRouteOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Free 官方模型" hint="Studio 模式下 Free 账号真正发给官方的模型。">
            <Input
              value={config.chatgpt.freeImageModel}
              onChange={(event) => setSection("chatgpt", { ...config.chatgpt, freeImageModel: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="Paid 官方路由" hint="Studio 模式下 Plus / Pro / Team 账号走 legacy 还是 responses。">
            <Select
              value={config.chatgpt.paidImageRoute}
              onValueChange={(value) => setSection("chatgpt", { ...config.chatgpt, paidImageRoute: value })}
            >
              <SelectTrigger className="h-11 rounded-2xl border-stone-200 bg-white shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageRouteOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Paid 官方模型" hint="Studio 模式下 Paid 账号真正发给官方的模型，例如 gpt-5.4-mini 或 gpt-5.4。">
            <Input
              value={config.chatgpt.paidImageModel}
              onChange={(event) => setSection("chatgpt", { ...config.chatgpt, paidImageModel: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
        </ConfigSection>

        <ConfigSection
          title="CPA 配置"
          description="图片请求读取 [cpa].base_url / [cpa].api_key；CPA 管理同步读取 [sync].base_url / [sync].management_key。若 [cpa].base_url 留空，会自动回退使用 [sync].base_url。"
        >
          <Field
            label="当前生效 CPA 图片地址"
            hint="运行时优先读取 [cpa].base_url；为空时回退 [sync].base_url。这里只是回显当前生效值，不会改写配置文件。"
            fullWidth
          >
            <Input
              value={effectiveCPAImageBaseUrl || "未配置"}
              readOnly
              className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none"
            />
          </Field>
          <Field
            label="CPA 管理 Key 状态"
            hint="对应 [sync].management_key，仅用于账号同步管理接口，不参与图片生成请求。"
            fullWidth
          >
            <Input
              value={syncManagementKeyStatus}
              readOnly
              className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none"
            />
          </Field>
          <Field label="CPA 图片 Base URL" hint="对应 [cpa].base_url，例如 http://127.0.0.1:8317。留空时会回退复用 [sync].base_url。">
            <Input
              value={config.cpa.baseUrl}
              onChange={(event) => setSection("cpa", { ...config.cpa, baseUrl: event.target.value })}
              placeholder={config.sync.baseUrl || "http://127.0.0.1:8317"}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="CPA 图片 API Key" hint="对应 [cpa].api_key，用于调用 CPA OpenAI 图片接口的 Bearer key。">
            <Input
              type="password"
              value={config.cpa.apiKey}
              onChange={(event) => setSection("cpa", { ...config.cpa, apiKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="CPA 图片请求超时（秒）" hint="对应 [cpa].request_timeout，当前项目调用 CPA 图片接口时使用的 HTTP 超时。">
            <Input
              type="number"
              value={String(config.cpa.requestTimeout)}
              onChange={(event) =>
                setSection("cpa", {
                  ...config.cpa,
                  requestTimeout: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="CPA 管理 Base URL" hint="对应 [sync].base_url，用于账号同步管理接口，与上面的 CPA 图片地址可相同也可不同。">
            <Input
              value={config.sync.baseUrl}
              onChange={(event) => setSection("sync", { ...config.sync, baseUrl: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="CPA 管理 Key" hint="对应 [sync].management_key，只用于 CPA 管理接口同步，不用于图片生成。">
            <Input
              type="password"
              value={config.sync.managementKey}
              onChange={(event) => setSection("sync", { ...config.sync, managementKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <ToggleField
            label="启用 CPA 同步"
            hint="开启后才允许账号管理页执行本地号池与 CPA 之间的双向同步。"
            checked={config.sync.enabled}
            onCheckedChange={(checked) => setSection("sync", { ...config.sync, enabled: checked })}
          />
        </ConfigSection>

        <ConfigSection title="基础运行配置" description="后端服务监听地址、端口、上传大小、超时和账号刷新等常用配置。修改监听地址或端口后，需要重启程序才会生效。">
          <Field label="当前版本" hint="只读：当前后端返回的版本号。发布版会由构建流程注入。" fullWidth>
            <Input value={config.app.version} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field label="监听地址" hint="默认 0.0.0.0。只想本机访问时可改成 127.0.0.1。">
            <Input
              value={config.server.host}
              onChange={(event) => setSection("server", { ...config.server, host: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="监听端口" hint="程序启动失败提示端口占用时，通常先改这里。保存后会写入 data/config.toml，但要重启程序才会真正切到新端口。">
            <Input
              type="number"
              value={String(config.server.port)}
              onChange={(event) =>
                setSection("server", {
                  ...config.server,
                  port: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="UI 登录密钥" hint="账号管理、配置管理、调用请求页面使用的 Bearer 密钥。">
            <Input
              type="password"
              value={config.app.authKey}
              onChange={(event) => setSection("app", { ...config.app, authKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="图片 API Key 列表" hint="用于调用当前项目图片接口的 Bearer key，多个可逗号分隔。">
            <Input
              value={config.app.apiKey}
              onChange={(event) => setSection("app", { ...config.app, apiKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="图片返回格式" hint="当前项目自身图片接口默认返回格式。">
            <Input
              value={config.app.imageFormat}
              onChange={(event) => setSection("app", { ...config.app, imageFormat: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="最大上传大小（MB）" hint="当前项目图片上传的最大体积限制。">
            <Input
              type="number"
              value={String(config.app.maxUploadSizeMB)}
              onChange={(event) =>
                setSection("app", {
                  ...config.app,
                  maxUploadSizeMB: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="图片请求超时（秒）" hint="当前项目请求官方图片接口时的超时。">
            <Input
              type="number"
              value={String(config.chatgpt.requestTimeout)}
              onChange={(event) =>
                setSection("chatgpt", {
                  ...config.chatgpt,
                  requestTimeout: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="SSE 超时（秒）" hint="官方 SSE 图像链路的整体等待超时。">
            <Input
              type="number"
              value={String(config.chatgpt.sseTimeout)}
              onChange={(event) =>
                setSection("chatgpt", {
                  ...config.chatgpt,
                  sseTimeout: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="轮询间隔（秒）" hint="legacy 图像链路轮询间隔。">
            <Input
              type="number"
              value={String(config.chatgpt.pollInterval)}
              onChange={(event) =>
                setSection("chatgpt", {
                  ...config.chatgpt,
                  pollInterval: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="轮询最大等待（秒）" hint="legacy 图像链路最长等待时间。">
            <Input
              type="number"
              value={String(config.chatgpt.pollMaxWait)}
              onChange={(event) =>
                setSection("chatgpt", {
                  ...config.chatgpt,
                  pollMaxWait: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="默认额度" hint="本地未刷新到真实额度时的默认 quota。">
            <Input
              type="number"
              value={String(config.accounts.defaultQuota)}
              onChange={(event) =>
                setSection("accounts", {
                  ...config.accounts,
                  defaultQuota: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="刷新并发" hint="账号刷新信息时的 worker 数量。">
            <Input
              type="number"
              value={String(config.accounts.refreshWorkers)}
              onChange={(event) =>
                setSection("accounts", {
                  ...config.accounts,
                  refreshWorkers: Number(event.target.value || 0),
                })
              }
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <ToggleField
            label="优先远端刷新额度"
            hint="开启后，后端会优先尝试刷新真实额度状态，而不是只依赖本地扣减。"
            checked={config.accounts.preferRemoteRefresh}
            onCheckedChange={(checked) => setSection("accounts", { ...config.accounts, preferRemoteRefresh: checked })}
          />
          <ToggleField
            label="记录所有请求日志"
            hint="开启后后端会输出更详细的请求日志，排障更方便，但噪音也会更大。"
            checked={config.log.logAllRequests}
            onCheckedChange={(checked) => setSection("log", { ...config.log, logAllRequests: checked })}
          />
        </ConfigSection>

      <ConfigSection title="服务与路径" description="发布版默认从可执行文件同级的 data/ 和 static/ 读写配置与静态资源，路径通常不建议频繁修改。">
          <Field label="静态资源目录" hint="发布包默认是 static。开发脚本会把 web/dist 同步到 backend/static。">
            <Input
              value={config.server.staticDir}
              onChange={(event) => setSection("server", { ...config.server, staticDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="解析后的静态目录" hint="只读：当前后端实际读取静态页面的路径。">
            <Input value={resolvedStaticDir} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <ToggleField
            label="启用固定代理"
            hint="用于访问官方图片链路。当前只支持 fixed 模式。"
            checked={config.proxy.enabled}
            onCheckedChange={(checked) => setSection("proxy", { ...config.proxy, enabled: checked })}
          />
          <Field label="代理 URL" hint="支持 socks5 / socks5h / http / https。默认示例是 socks5h://127.0.0.1:10808。">
            <Input
              value={config.proxy.url}
              onChange={(event) => setSection("proxy", { ...config.proxy, url: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="代理模式" hint="当前仅支持 fixed。">
            <Input
              value={config.proxy.mode}
              onChange={(event) => setSection("proxy", { ...config.proxy, mode: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <ToggleField
            label="同步复用代理"
            hint="开启后 CPA 同步请求也会复用同一代理。"
            checked={config.proxy.syncEnabled}
            onCheckedChange={(checked) => setSection("proxy", { ...config.proxy, syncEnabled: checked })}
          />
          <Field label="Auth 目录" hint="本地认证文件目录。通常保持默认即可。" fullWidth>
            <Input
              value={config.storage.authDir}
              onChange={(event) => setSection("storage", { ...config.storage, authDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="账号状态文件" hint="本地号池状态与额度落盘文件。" fullWidth>
            <Input
              value={config.storage.stateFile}
              onChange={(event) => setSection("storage", { ...config.storage, stateFile: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="同步状态目录" hint="记录 CPA 同步状态的目录。" fullWidth>
            <Input
              value={config.storage.syncStateDir}
              onChange={(event) => setSection("storage", { ...config.storage, syncStateDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="图片缓存目录" hint="当前项目缓存返回图片的目录。" fullWidth>
            <Input
              value={config.storage.imageDir}
              onChange={(event) => setSection("storage", { ...config.storage, imageDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field label="配置根目录" hint="只读：当前后端自动识别到的配置根目录。" fullWidth>
            <Input value={config.paths.root} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field label="示例配置文件" hint="只读：程序启动时自动写出的示例配置路径。" fullWidth>
            <Input value={config.paths.defaults} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field label="覆盖配置文件" hint="只读：点击保存后实际写入的配置文件。" fullWidth>
            <Input value={config.paths.override} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field label="启动错误日志" hint="只读：程序启动失败时会将中文错误详情写到这里。" fullWidth>
            <Input value={startupErrorPath} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
        </ConfigSection>
      </div>
    </section>
  );
}
