"use client";

import { useEffect, useState } from "react";
import { Ban, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchConfig, fetchForbiddenWordsPreset, updateConfig, type ConfigPayload } from "@/lib/api";

export default function ForbiddenWordsPage() {
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [preset, setPreset] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [currentConfig, presetPayload] = await Promise.all([
        fetchConfig(),
        fetchForbiddenWordsPreset(),
      ]);
      setConfig(currentConfig);
      setPreset(presetPayload.preset || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取违禁词配置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async () => {
    if (!config) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateConfig(config);
      setConfig(result.config);
      toast.success("违禁词配置已保存并立即生效");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存违禁词配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsePreset = () => {
    if (!config) {
      return;
    }
    setConfig({
      ...config,
      app: {
        ...config.app,
        forbiddenWords: preset,
      },
    });
    toast.success("已应用推荐预设，请点击保存");
  };

  return (
    <section className="admin-flat-radius h-full">
      <div className="hide-scrollbar h-full min-h-0 overflow-y-auto rounded-[30px] border border-stone-200 bg-[#fcfcfb] px-4 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] transition-colors duration-200 dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel)] sm:px-5 sm:py-6 lg:flex lg:min-h-0 lg:flex-col lg:px-6 lg:py-7">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="inline-flex size-12 items-center justify-center rounded-[18px] bg-stone-950 text-white shadow-sm">
              <Ban className="size-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
                违禁词管理
              </h1>
              <p className="text-sm text-stone-500">独立维护图片提示词黑名单，减少账号池触发风控的概率。</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-stone-200 bg-white px-4 text-stone-700 shadow-none"
              onClick={() => void loadData()}
              disabled={isLoading || isSaving}
            >
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              刷新
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-stone-950 px-4 text-white hover:bg-stone-800"
              onClick={() => void handleSave()}
              disabled={isLoading || isSaving || !config}
            >
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存
            </Button>
          </div>
        </section>

        <Card className="mt-5 rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="text-sm font-medium text-stone-700">当前违禁词（立即生效）</div>
            <Textarea
              value={config?.app.forbiddenWords || ""}
              onChange={(event) =>
                setConfig((current) =>
                  current
                    ? {
                        ...current,
                        app: {
                          ...current.app,
                          forbiddenWords: event.target.value,
                        },
                      }
                    : current,
                )
              }
              rows={8}
              className="rounded-2xl border-stone-200 bg-white text-sm leading-6"
              placeholder="多个词可用英文逗号、中文逗号、分号或换行分隔"
              disabled={!config || isLoading}
            />
            <div className="text-xs text-stone-500">匹配规则：不区分大小写，提示词只要包含任一违禁词就会被拦截。</div>
          </CardContent>
        </Card>

        <Card className="mt-4 rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-stone-700">推荐预设（基于 OpenAI 最新公开政策分类）</div>
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full border-stone-200 bg-white px-3 text-xs text-stone-700"
                onClick={handleUsePreset}
                disabled={!config || !preset || isLoading || isSaving}
              >
                一键应用预设
              </Button>
            </div>
            <Textarea
              value={preset}
              readOnly
              rows={8}
              className="rounded-2xl border-stone-200 bg-stone-50 text-xs leading-6 text-stone-600"
            />
            <div className="text-xs text-stone-500">覆盖高风险方向：未成年人性内容、非自愿亲密内容、仇恨/极端、暴力/自残、深度伪造与冒充欺诈。</div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

