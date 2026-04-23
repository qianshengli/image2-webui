"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, LoaderCircle, RefreshCcw, RefreshCw, Save, Settings2 } from "lucide-react";
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
import { clearCachedSyncStatus } from "@/store/sync-status-cache";

const imageModeOptions: Array<{ label: string; value: ImageMode; hint: string }> = [
  { label: "Studio", value: "studio", hint: "Free 走当前项目官方链路，Plus/Pro/Team 走官方 responses" },
  { label: "CPA", value: "cpa", hint: "所有图片请求都直接走 CPA；本地号池不参与 CPA 实际选路，Free 号大概率无权限" },
  { label: "MIX", value: "mix", hint: "Free 走当前项目官方链路，Plus/Pro/Team 走 CPA" },
];

const imageRouteOptions = [
  { label: "legacy", value: "legacy" },
  { label: "responses", value: "responses" },
];

function HintTooltip({ content }: { content: React.ReactNode }) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <span
        tabIndex={0}
        className="inline-flex size-4 cursor-help items-center justify-center rounded-full text-stone-400 transition-colors hover:text-stone-700 focus-visible:text-stone-700 focus-visible:outline-none"
        aria-label="查看配置说明"
      >
        <CircleHelp className="size-4" />
      </span>
      <span className="pointer-events-none absolute top-full left-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-normal leading-6 text-stone-600 opacity-0 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)] transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        {content}
      </span>
    </span>
  );
}

function LabelWithHint({
  label,
  tooltip,
}: {
  label: React.ReactNode;
  tooltip?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {tooltip ? <HintTooltip content={tooltip} /> : null}
    </span>
  );
}

type TooltipDetail = {
  title: string;
  body: React.ReactNode;
};

function TooltipDetails({ items }: { items: TooltipDetail[] }) {
  return (
    <>
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className={index === 0 ? "" : "mt-2"}>
          <span className="font-semibold text-stone-800">{item.title}：</span>
          {item.body}
        </div>
      ))}
    </>
  );
}

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
  tooltip,
  children,
  fullWidth = false,
}: {
  label: React.ReactNode;
  hint: string;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <div className="text-sm font-medium text-stone-700">
        <LabelWithHint label={label} tooltip={tooltip ?? hint} />
      </div>
      <div>{children}</div>
      <div className="text-xs leading-5 text-stone-400">{hint}</div>
    </label>
  );
}

function ToggleField({
  label,
  hint,
  tooltip,
  checked,
  onCheckedChange,
}: {
  label: React.ReactNode;
  hint: string;
  tooltip?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:col-span-2">
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-stone-700">
            <LabelWithHint label={label} tooltip={tooltip ?? hint} />
          </div>
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
  const isStudioMode = config.chatgpt.imageMode === "studio";
  const isCPAMode = config.chatgpt.imageMode === "cpa";
  const isMixMode = config.chatgpt.imageMode === "mix";

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
      clearCachedSyncStatus();
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
        <Field
          label="图片模式"
          hint={imageModeOptions.find((item) => item.value === config.chatgpt.imageMode)?.hint || ""}
          tooltip={
            <TooltipDetails
              items={[
                {
                  title: "Studio",
                  body: (
                    <>
                      Free 账号走当前项目官方链路，Plus / Pro / Team 账号走官方 <code>responses</code> 链路。
                    </>
                  ),
                },
                {
                  title: "CPA",
                  body: <>所有图片请求都直接走 CPA 图片接口；本地号池不参与 CPA 实际选路。Free 账号大概率没有图片权限，但是否成功由 CPA 上游自己决定。</>,
                },
                {
                  title: "MIX",
                  body: <>Free 账号走当前项目官方链路，Plus / Pro / Team 账号走 CPA 图片接口。</>,
                },
              ]}
            />
          }
        >
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
        {!isCPAMode ? (
          <Field
            label="默认图片模型"
            hint="当前项目官方图片请求默认使用的模型名。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>作为当前项目官方图片生成、编辑、放大请求的默认模型名；未单独覆盖时会优先用这里。</>,
                  },
                  {
                    title: "常见值",
                    body: (
                      <>
                        <code>gpt-image-2</code>、<code>gpt-image-1</code>。
                      </>
                    ),
                  },
                  {
                    title: "建议",
                    body: <>大多数场景保持默认 `gpt-image-2` 即可；只有确认上游支持时再改其他模型。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.chatgpt.model}
              onChange={(event) => setSection("chatgpt", { ...config.chatgpt, model: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
        ) : (
          <Field
            label="CPA 固定模型"
            hint="CPA 模式下图片请求固定使用 gpt-image-2；CPA 内部会再自行转换主模型。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "当前实现",
                    body: <>当前项目发往 CPA 图片接口时固定传 `gpt-image-2`，不会再读取下面的 Free / Paid 模型配置。</>,
                  },
                  {
                    title: "CPA 内部",
                    body: <>CPA 自己会把图片工具模型和主模型拆开处理，不需要你在这里再手动切到 `gpt-5.4-mini`。</>,
                  },
                  {
                    title: "作用",
                    body: <>这里做成只读，是为了避免页面上出现“能改但实际不会生效”的模型项。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value="gpt-image-2"
              readOnly
              className="h-11 rounded-2xl border-stone-200 bg-stone-50 text-stone-500 shadow-none"
            />
          </Field>
        )}
          {isStudioMode || isMixMode ? (
            <Field
              label="Free 账号路由"
              hint={isMixMode ? "MIX 模式下 Free 账号走官方链路时使用的路由。" : "Studio 模式下 Free 账号走 legacy 还是 responses。"}
              tooltip={
                <TooltipDetails
                  items={[
                    {
                      title: "legacy",
                      body: <>走当前项目原有的官方链路，兼容性更高，Free 账号通常建议保留这个值。</>,
                    },
                    {
                      title: "responses",
                      body: <>走官方新的 `responses` 链路，但 Free 账号经常没有对应工具权限，可能直接失败。</>,
                    },
                    {
                      title: "建议",
                      body: <>除非你确认 Free 账号在上游具备图片工具权限，否则保持 `legacy` 更稳。</>,
                    },
                  ]}
                />
              }
            >
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
          ) : null}
          {isStudioMode || isMixMode ? (
            <Field
              label="Free 模型"
              hint={isMixMode ? "MIX 模式下 Free 账号走官方链路时使用的模型。" : "Studio 模式下 Free 账号真正发给官方的模型。"}
              tooltip={
                <TooltipDetails
                  items={[
                    {
                      title: "可选值",
                      body: (
                        <>
                          <code>auto</code>、<code>gpt-image-2</code>、<code>gpt-image-1</code>。
                        </>
                      ),
                    },
                    {
                      title: "auto",
                      body: <>保留旧行为，让上游自己选兼容模型，通常最稳。</>,
                    },
                    {
                      title: "建议",
                      body: <>如果 Free 号经常报模型不支持，优先退回 `auto`。</>,
                    },
                  ]}
                />
              }
            >
              <Input
                value={config.chatgpt.freeImageModel}
                onChange={(event) => setSection("chatgpt", { ...config.chatgpt, freeImageModel: event.target.value })}
                className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
              />
            </Field>
          ) : null}
          {isStudioMode ? (
          <Field
            label="Paid 账号路由"
            hint="Studio 模式下 Plus / Pro / Team 账号走 legacy 还是 responses。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "responses",
                    body: <>走官方新的付费账号图像链路，功能更完整，当前默认就是这个值。</>,
                  },
                  {
                    title: "legacy",
                    body: <>回退到旧链路；如果新链路临时异常，可用它做兼容兜底。</>,
                  },
                  {
                    title: "建议",
                    body: <>Paid 账号一般优先保留 `responses`，只有排障时再切到 `legacy`。</>,
                  },
                ]}
              />
            }
          >
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
          ) : null}
          {isStudioMode ? (
          <Field
            label="Paid 模型"
            hint="Studio 模式下 Paid 账号真正发给官方的模型，例如 gpt-5.4-mini 或 gpt-5.4。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "常见值",
                    body: (
                      <>
                        <code>gpt-5.4-mini</code>、<code>gpt-5.4</code>。
                      </>
                    ),
                  },
                  {
                    title: "区别",
                    body: <>`mini` 通常更轻更稳，完整版模型能力更强但上游限制也可能更多。</>,
                  },
                  {
                    title: "排障建议",
                    body: <>如果 Paid 路线报模型不可用，先改回 `gpt-5.4-mini` 再试。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.chatgpt.paidImageModel}
              onChange={(event) => setSection("chatgpt", { ...config.chatgpt, paidImageModel: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          ) : null}
          {isMixMode ? (
            <Field
              label="Paid 走 CPA 固定模型"
              hint="MIX 模式下 Paid 账号统一走 CPA，当前项目发往 CPA 的工具模型固定为 gpt-image-2。"
              tooltip={
                <TooltipDetails
                  items={[
                    {
                      title: "当前实现",
                      body: <>MIX 模式下，Paid 账号会走 CPA 图片接口，不再读取 `Paid 模型` 这个官方链路配置。</>,
                    },
                    {
                      title: "固定值",
                      body: <>当前项目发往 CPA 的模型固定是 `gpt-image-2`，CPA 内部会再做自己的主模型转换。</>,
                    },
                  ]}
                />
              }
              fullWidth
            >
              <Input
                value="gpt-image-2"
                readOnly
                className="h-11 rounded-2xl border-stone-200 bg-stone-50 text-stone-500 shadow-none"
              />
            </Field>
          ) : null}
        </ConfigSection>

        <ConfigSection
          title="CPA 配置"
          description="图片请求读取 [cpa].base_url / [cpa].api_key；CPA 管理同步读取 [sync].base_url / [sync].management_key。若 [cpa].base_url 留空，会自动回退使用 [sync].base_url。"
        >
          <Field
            label="当前生效 CPA 图片地址"
            hint="运行时优先读取 [cpa].base_url；为空时回退 [sync].base_url。这里只是回显当前生效值，不会改写配置文件。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "读取顺序",
                    body: (
                      <>
                        先看 <code>cpa.base_url</code>，如果为空再回退到 <code>sync.base_url</code>。
                      </>
                    ),
                  },
                  {
                    title: "用途",
                    body: <>这里只是只读回显，方便你确认运行时真正会打到哪个 CPA 地址。</>,
                  },
                  {
                    title: "排查",
                    body: <>这里显示“未配置”时，CPA 模式或 MIX 的 Paid 路线都会直接报未配置。</>,
                  },
                ]}
              />
            }
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
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>只显示当前是否已经填写管理 Key，本身不会把 Key 明文展示出来。</>,
                  },
                  {
                    title: "用于哪里",
                    body: <>只用于账号同步管理接口，不用于图片生成、不等于 CPA 图片 API Key。</>,
                  },
                  {
                    title: "排查",
                    body: <>如果这里未配置，账号管理页的同步状态和推拉同步通常会报 401 或未配置。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value={syncManagementKeyStatus}
              readOnly
              className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none"
            />
          </Field>
          <Field
            label="CPA 图片 Base URL"
            hint="对应 [cpa].base_url，例如 http://127.0.0.1:8317。留空时会回退复用 [sync].base_url。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>http://127.0.0.1:8317</code>、<code>https://your-cpa.example.com</code>。
                      </>
                    ),
                  },
                  {
                    title: "怎么填",
                    body: <>填服务根地址即可，通常不需要手动加 `/v1/images` 之类的具体路径。</>,
                  },
                  {
                    title: "留空效果",
                    body: <>留空后会自动复用下面的 CPA 管理 Base URL。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.cpa.baseUrl}
              onChange={(event) => setSection("cpa", { ...config.cpa, baseUrl: event.target.value })}
              placeholder={config.sync.baseUrl || "http://127.0.0.1:8317"}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="CPA 图片 API Key"
            hint="对应 [cpa].api_key，用于调用 CPA OpenAI 图片接口的 Bearer key。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        例如 <code>sk-xxxx</code> 或你在 CPA 服务端配置的 Bearer Key。
                      </>
                    ),
                  },
                  {
                    title: "用途",
                    body: <>只在 CPA 图片接口调用时带上，不参与账号同步管理。</>,
                  },
                  {
                    title: "未填写影响",
                    body: <>CPA 模式和 MIX 的 Paid 账号路线会报“CPA 图片接口未配置”或鉴权失败。</>,
                  },
                ]}
              />
            }
          >
            <Input
              type="password"
              value={config.cpa.apiKey}
              onChange={(event) => setSection("cpa", { ...config.cpa, apiKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="CPA 图片请求超时（秒）"
            hint="对应 [cpa].request_timeout，当前项目调用 CPA 图片接口时使用的 HTTP 超时。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>控制当前项目请求 CPA 图片接口时，单次 HTTP 请求最多等待多久。</>,
                  },
                  {
                    title: "建议值",
                    body: <>通常填 `60` 到 `120`；CPA 服务排队慢时可以适当加大。</>,
                  },
                  {
                    title: "太小的表现",
                    body: <>会更容易出现请求超时，但并不代表 CPA 端一定真的失败了。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="CPA 管理 Base URL"
            hint="对应 [sync].base_url，用于账号同步管理接口，与上面的 CPA 图片地址可相同也可不同。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>http://127.0.0.1:8317</code>，如果图片接口和管理接口在同一服务上也可以填同一个地址。
                      </>
                    ),
                  },
                  {
                    title: "用途",
                    body: <>账号管理页的同步状态、从 CPA 同步、同步至 CPA 都会使用这里。</>,
                  },
                  {
                    title: "注意",
                    body: <>这里是管理接口地址，不等于上面的图片 API Key 鉴权地址。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.sync.baseUrl}
              onChange={(event) => setSection("sync", { ...config.sync, baseUrl: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="CPA 管理 Key"
            hint="对应 [sync].management_key，只用于 CPA 管理接口同步，不用于图片生成。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "来源",
                    body: <>填 CPA 服务端用于管理接口的 Key，不是图片 API Key，也不是账号 access token。</>,
                  },
                  {
                    title: "错误现象",
                    body: <>填错时，账号管理页通常会看到 `invalid management key` 或 401。</>,
                  },
                  {
                    title: "用途",
                    body: <>只影响号池同步、状态拉取和远端管理，不影响图片生成链路。</>,
                  },
                ]}
              />
            }
          >
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
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "开启后",
                    body: <>账号管理页可以读取远端同步状态，也可以执行“从 CPA 同步 / 同步至 CPA”。</>,
                  },
                  {
                    title: "关闭后",
                    body: <>同步相关能力会被禁用，但纯图片生成模式本身不受这个开关直接控制。</>,
                  },
                  {
                    title: "适用场景",
                    body: <>只有你确实需要本地号池和 CPA 远端号池双向同步时才建议开启。</>,
                  },
                ]}
              />
            }
            checked={config.sync.enabled}
            onCheckedChange={(checked) => setSection("sync", { ...config.sync, enabled: checked })}
          />
        </ConfigSection>

        <ConfigSection title="基础运行配置" description="后端服务监听地址、端口、上传大小、超时和账号刷新等常用配置。修改监听地址或端口后，需要重启程序才会生效。">
          <Field
            label="当前版本"
            hint="只读：当前后端返回的版本号。发布版会由构建流程注入。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "来源",
                    body: <>由后端运行时返回；发布版会在构建时写入版本号、提交号和构建时间。</>,
                  },
                  {
                    title: "用途",
                    body: <>排查“用户下载的到底是哪一版”时，优先看这里，不要只看前端角落的展示版本。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input value={config.app.version} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field
            label="监听地址"
            hint="默认 0.0.0.0。只想本机访问时可改成 127.0.0.1。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "常用值",
                    body: (
                      <>
                        <code>0.0.0.0</code> 表示局域网可访问，<code>127.0.0.1</code> 表示只允许本机访问。
                      </>
                    ),
                  },
                  {
                    title: "建议",
                    body: <>只是自己本机使用时填 `127.0.0.1` 更收敛；需要局域网访问再用 `0.0.0.0`。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.server.host}
              onChange={(event) => setSection("server", { ...config.server, host: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="监听端口"
            hint="程序启动失败提示端口占用时，通常先改这里。保存后会写入 data/config.toml，但要重启程序才会真正切到新端口。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>7000</code>、<code>8080</code>、<code>9000</code>。
                      </>
                    ),
                  },
                  {
                    title: "改完后",
                    body: <>配置会立即写入文件，但服务需要重启后才会真正切到新端口。</>,
                  },
                  {
                    title: "排查",
                    body: <>如果启动时报端口占用，最直接的处理就是改成一个空闲端口再重启。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="UI 登录密钥"
            hint="账号管理、配置管理、调用请求页面使用的 Bearer 密钥。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: <>建议填一个你自己定义的长随机串，不要继续使用默认弱口令。</>,
                  },
                  {
                    title: "作用",
                    body: <>进入管理页面时会校验这个 Bearer 密钥；它保护的是后台管理，不是图片 API。</>,
                  },
                  {
                    title: "改完影响",
                    body: <>保存后新请求就会按新密钥校验，旧页面可能需要重新登录。</>,
                  },
                ]}
              />
            }
          >
            <Input
              type="password"
              value={config.app.authKey}
              onChange={(event) => setSection("app", { ...config.app, authKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="图片 API Key 列表"
            hint="用于调用当前项目图片接口的 Bearer key，多个可逗号分隔。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "格式",
                    body: <>支持多个 key，用英文逗号分隔，例如 `key-a,key-b,key-c`。</>,
                  },
                  {
                    title: "作用",
                    body: <>调用当前项目对外暴露的图片 API 时，会校验请求头里的 Bearer token 是否命中这里。</>,
                  },
                  {
                    title: "留空效果",
                    body: <>留空时图片 API 不做鉴权，任何人都能调，公网环境下不建议这么配。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.app.apiKey}
              onChange={(event) => setSection("app", { ...config.app, apiKey: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="图片返回格式"
            hint="当前项目自身图片接口默认返回格式。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "可选值",
                    body: (
                      <>
                        <code>url</code> 或 <code>b64_json</code>。
                      </>
                    ),
                  },
                  {
                    title: "url",
                    body: <>返回图片访问地址，响应体更小，适合网页或普通 API 转发。</>,
                  },
                  {
                    title: "b64_json",
                    body: <>直接返回 Base64 图片数据，方便一次性拿到完整内容，但响应会更大。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.app.imageFormat}
              onChange={(event) => setSection("app", { ...config.app, imageFormat: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="最大上传大小（MB）"
            hint="当前项目图片上传的最大体积限制。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>限制单张上传图片的最大体积，超出后会在进入模型前就被后端拦掉。</>,
                  },
                  {
                    title: "建议值",
                    body: <>通常 `20` 到 `100` MB 足够；上传原图较大时可适当调高。</>,
                  },
                  {
                    title: "太小的表现",
                    body: <>编辑、放大或参考图上传会直接失败，即使图片本身格式没问题也会被拒绝。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="图片请求超时（秒）"
            hint="当前项目请求官方图片接口时的超时。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>控制普通官方 HTTP 请求的超时，例如非流式接口和常规下载请求。</>,
                  },
                  {
                    title: "建议值",
                    body: <>一般填 `30` 到 `60` 秒；网络较差时可以适当加大。</>,
                  },
                  {
                    title: "不要混淆",
                    body: <>这个值不是长时间图片生成等待的总超时，长等待主要看下面的 SSE 超时。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="SSE 超时（秒）"
            hint="官方 SSE 图像链路的整体等待超时。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>控制长时间流式图像任务能等多久，生成慢图时主要看这个值。</>,
                  },
                  {
                    title: "建议值",
                    body: <>通常应明显大于普通请求超时，常见设置是 `180` 到 `300` 秒。</>,
                  },
                  {
                    title: "太小的表现",
                    body: <>长图或高峰期排队时更容易出现“timed out waiting for async image generation”。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="轮询间隔（秒）"
            hint="legacy 图像链路轮询间隔。"
            tooltip={
              <TooltipDetails
              items={[
                  {
                    title: "作用",
                    body: <>只影响 `legacy` 图像链路，控制后端多久去问一次任务是否完成。</>,
                  },
                  {
                    title: "调小后",
                    body: <>结果会更快被发现，但请求次数会更多，更容易增加噪音和上游压力。</>,
                  },
                  {
                    title: "建议值",
                    body: <>`2` 到 `5` 秒比较常见，默认 `3` 秒通常够用。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="轮询最大等待（秒）"
            hint="legacy 图像链路最长等待时间。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>给 `legacy` 轮询链路设一个总等待上限，超过后本次请求会被判定超时。</>,
                  },
                  {
                    title: "建议值",
                    body: <>通常应明显大于轮询间隔，例如 `120` 到 `300` 秒。</>,
                  },
                  {
                    title: "太小的表现",
                    body: <>任务其实还在上游处理中，但本地会先报超时，看起来像“图还没回来就失败”。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="默认额度"
            hint="本地未刷新到真实额度时的默认 quota。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>当后端暂时拿不到真实图片额度时，会先用这个数值做本地初始显示和兜底。</>,
                  },
                  {
                    title: "建议值",
                    body: <>小号测试可以填 `5` 或 `10`；它不是官方真实额度，只是本地兜底值。</>,
                  },
                  {
                    title: "注意",
                    body: <>填得再大也不会真的让账号有更多图片额度，只会影响本地展示与初始判断。</>,
                  },
                ]}
              />
            }
          >
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
          <Field
            label="刷新并发"
            hint="账号刷新信息时的 worker 数量。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>控制批量刷新账号信息时同时开多少个 worker 去请求上游。</>,
                  },
                  {
                    title: "建议值",
                    body: <>一般 `4` 到 `8` 比较稳；账号很多时可适当加大，但不建议无限拉高。</>,
                  },
                  {
                    title: "太高的影响",
                    body: <>可能更快触发限流、网络抖动或让刷新结果看起来更不稳定。</>,
                  },
                ]}
              />
            }
          >
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
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "开启后",
                    body: <>会优先尝试去远端拿真实额度与状态，显示更准，但刷新耗时通常更长。</>,
                  },
                  {
                    title: "关闭后",
                    body: <>更依赖本地缓存和扣减，速度更快，但显示可能比真实情况更滞后。</>,
                  },
                  {
                    title: "建议",
                    body: <>如果你更在意额度展示准确性，建议保持开启。</>,
                  },
                ]}
              />
            }
            checked={config.accounts.preferRemoteRefresh}
            onCheckedChange={(checked) => setSection("accounts", { ...config.accounts, preferRemoteRefresh: checked })}
          />
          <ToggleField
            label="记录所有请求日志"
            hint="开启后后端会输出更详细的请求日志，排障更方便，但噪音也会更大。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "开启后",
                    body: <>控制台和日志里会输出更细的请求方向、路由、账号类型等信息，排障更方便。</>,
                  },
                  {
                    title: "关闭后",
                    body: <>日志更干净，适合日常稳定运行，但定位复杂问题时信息会少一些。</>,
                  },
                  {
                    title: "注意",
                    body: <>日志量会明显增加，长期运行时要注意不要把本地日志刷得太大。</>,
                  },
                ]}
              />
            }
            checked={config.log.logAllRequests}
            onCheckedChange={(checked) => setSection("log", { ...config.log, logAllRequests: checked })}
          />
        </ConfigSection>

      <ConfigSection title="服务与路径" description="发布版默认从可执行文件同级的 data/ 和 static/ 读写配置与静态资源，路径通常不建议频繁修改。">
          <Field
            label="静态资源目录"
            hint="发布包默认是 static。开发脚本会把 web/dist 同步到 backend/static。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "常见值",
                    body: (
                      <>
                        <code>static</code>，或者绝对路径如 <code>D:\\ChatGpt-Image-Studio\\static</code>。
                      </>
                    ),
                  },
                  {
                    title: "相对路径规则",
                    body: <>如果填写相对路径，会相对于下面显示的“配置根目录”去解析。</>,
                  },
                  {
                    title: "配错表现",
                    body: <>页面可能打开后空白、404，或者一直还是旧前端资源。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.server.staticDir}
              onChange={(event) => setSection("server", { ...config.server, staticDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="解析后的静态目录"
            hint="只读：当前后端实际读取静态页面的路径。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>展示静态资源目录最终解析出来的真实路径，方便确认当前服务到底在读哪里。</>,
                  },
                  {
                    title: "怎么用",
                    body: <>如果你怀疑前端改了但页面没更新，先看这里是不是仍然指向旧目录。</>,
                  },
                ]}
              />
            }
          >
            <Input value={resolvedStaticDir} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <ToggleField
            label="启用固定代理"
            hint="用于访问官方图片链路。当前只支持 fixed 模式。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "开启后",
                    body: <>官方图片链路会走下面填写的代理 URL 发请求。</>,
                  },
                  {
                    title: "关闭后",
                    body: <>官方链路直接本机出网，不经过代理；CPA 链路是否走代理还要看下面的同步复用设置。</>,
                  },
                  {
                    title: "适用场景",
                    body: <>本机直连官方不稳定、需要代理出海时才建议开启。</>,
                  },
                ]}
              />
            }
            checked={config.proxy.enabled}
            onCheckedChange={(checked) => setSection("proxy", { ...config.proxy, enabled: checked })}
          />
          <Field
            label="代理 URL"
            hint="支持 socks5 / socks5h / http / https。默认示例是 socks5h://127.0.0.1:10808。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>socks5h://127.0.0.1:10808</code>、<code>http://127.0.0.1:7890</code>。
                      </>
                    ),
                  },
                  {
                    title: "socks5h",
                    body: <>DNS 解析也走代理，通常比纯 `socks5` 更适合需要代理域名解析的场景。</>,
                  },
                  {
                    title: "注意",
                    body: <>只有在“启用固定代理”打开时，这个地址才会实际生效。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.proxy.url}
              onChange={(event) => setSection("proxy", { ...config.proxy, url: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="代理模式"
            hint="当前仅支持 fixed。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "当前可选值",
                    body: <>目前只有 <code>fixed</code> 真正有实现，表示始终使用固定一条代理。</>,
                  },
                  {
                    title: "建议",
                    body: <>除非后端以后新增其他模式，否则这里保持 `fixed` 不要改。</>,
                  },
                ]}
              />
            }
          >
            <Input
              value={config.proxy.mode}
              onChange={(event) => setSection("proxy", { ...config.proxy, mode: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <ToggleField
            label="同步复用代理"
            hint="开启后 CPA 同步请求也会复用同一代理。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "开启后",
                    body: <>CPA 同步相关请求也会复用同一条代理，适合管理接口也需要代理出网的情况。</>,
                  },
                  {
                    title: "关闭后",
                    body: <>只有官方图片链路走代理，CPA 同步管理请求仍直接走本机网络。</>,
                  },
                  {
                    title: "注意",
                    body: <>这个开关影响的是同步管理请求，不直接影响 CPA 图片接口本身。</>,
                  },
                ]}
              />
            }
            checked={config.proxy.syncEnabled}
            onCheckedChange={(checked) => setSection("proxy", { ...config.proxy, syncEnabled: checked })}
          />
          <Field
            label="Auth 目录"
            hint="本地认证文件目录。通常保持默认即可。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>data/auths</code>，或者一个你自己维护的绝对目录。
                      </>
                    ),
                  },
                  {
                    title: "作用",
                    body: <>账号管理页导入的 auth 文件会主要落在这里，后端读取号池时也会从这里扫描。</>,
                  },
                  {
                    title: "改动风险",
                    body: <>改到新目录后，如果旧文件没迁过去，账号列表会像“突然空了”一样。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value={config.storage.authDir}
              onChange={(event) => setSection("storage", { ...config.storage, authDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="账号状态文件"
            hint="本地号池状态与额度落盘文件。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>data/accounts_state.json</code>。
                      </>
                    ),
                  },
                  {
                    title: "作用",
                    body: <>本地账号的状态、额度、刷新结果等缓存信息会保存在这里。</>,
                  },
                  {
                    title: "改动风险",
                    body: <>如果指向一个全新文件，页面上的部分本地状态会看起来像被重置。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value={config.storage.stateFile}
              onChange={(event) => setSection("storage", { ...config.storage, stateFile: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="同步状态目录"
            hint="记录 CPA 同步状态的目录。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>data/sync_state</code>。
                      </>
                    ),
                  },
                  {
                    title: "作用",
                    body: <>本地与 CPA 远端的同步记录、差异状态和中间状态会写到这里。</>,
                  },
                  {
                    title: "删除或改路径后",
                    body: <>系统会把它当成新的同步状态目录，可能重新出现大批“待同步/远端独有”提示。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value={config.storage.syncStateDir}
              onChange={(event) => setSection("storage", { ...config.storage, syncStateDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="图片缓存目录"
            hint="当前项目缓存返回图片的目录。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "填写示例",
                    body: (
                      <>
                        <code>data/tmp/image</code>。
                      </>
                    ),
                  },
                  {
                    title: "作用",
                    body: <>后端生成的图片文件、临时下载内容和网关返回地址对应的文件通常会落到这里。</>,
                  },
                  {
                    title: "注意",
                    body: <>这个目录如果不可写，图片保存和 `url` 返回格式都可能出问题。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input
              value={config.storage.imageDir}
              onChange={(event) => setSection("storage", { ...config.storage, imageDir: event.target.value })}
              className="h-11 rounded-2xl border-stone-200 bg-white shadow-none"
            />
          </Field>
          <Field
            label="配置根目录"
            hint="只读：当前后端自动识别到的配置根目录。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>所有相对路径都会以这里为基准解析，发布版通常就是可执行文件所在目录。</>,
                  },
                  {
                    title: "怎么用",
                    body: <>判断某个相对路径最终落在哪时，先看这里再看对应配置值。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input value={config.paths.root} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field
            label="示例配置文件"
            hint="只读：程序启动时自动写出的示例配置路径。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>程序首次启动时会尝试在这个位置生成示例配置，供用户对照查看。</>,
                  },
                  {
                    title: "注意",
                    body: <>它只是示例文件，不是你点击“保存配置”时真正写入的那份配置。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input value={config.paths.defaults} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field
            label="覆盖配置文件"
            hint="只读：点击保存后实际写入的配置文件。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "作用",
                    body: <>配置管理页点击“保存配置”后，真正会改写的是这里显示的文件。</>,
                  },
                  {
                    title: "怎么用",
                    body: <>如果你怀疑页面保存了但程序没读到，先打开这个文件确认内容是否真的改了。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input value={config.paths.override} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
          <Field
            label="启动错误日志"
            hint="只读：程序启动失败时会将中文错误详情写到这里。"
            tooltip={
              <TooltipDetails
                items={[
                  {
                    title: "用途",
                    body: <>二进制包或本地服务启动失败时，最直接的中文错误信息会落在这里。</>,
                  },
                  {
                    title: "常见场景",
                    body: <>端口占用、配置损坏、静态资源缺失、首次生成配置失败时都优先看这个文件。</>,
                  },
                ]}
              />
            }
            fullWidth
          >
            <Input value={startupErrorPath} readOnly className="h-11 rounded-2xl border-stone-200 bg-stone-50 shadow-none" />
          </Field>
        </ConfigSection>
      </div>
    </section>
  );
}
