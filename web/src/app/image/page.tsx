"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "react-medium-image-zoom/dist/styles.css";
import { ChevronsDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ImageEditModal } from "@/components/image-edit-modal";
import {
  cancelImageTask,
  consumeImageTaskStream,
  fetchAccounts,
  fetchConfig,
  listImageTasks,
  type Account,
  type ImageTaskSnapshot,
  type ImageTaskView,
  type ImageQuality,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  normalizeConversation,
  saveImageConversation,
  updateImageConversation,
  type ImageConversation,
  type ImageConversationTurn,
  type ImageMode,
} from "@/store/image-conversations";
import { ConversationTurns } from "./components/conversation-turns";
import { EmptyState } from "./components/empty-state";
import { HistorySidebar } from "./components/history-sidebar";
import { PromptComposer } from "./components/prompt-composer";
import {
  buildActiveRequestState,
  buildEmptyTaskSnapshot,
  deriveTaskSnapshotFromItems,
  type ActiveRequestState,
  reduceTaskItems,
  selectConversationActiveTask,
} from "./task-runtime";
import { WorkspaceHeader } from "./components/workspace-header";
import { useImageHistory } from "./hooks/use-image-history";
import { useWorkspaceEffects } from "./hooks/use-workspace-effects";
import { useWorkspaceConversationSync } from "./hooks/use-workspace-conversation-sync";
import { useImageSourceInputs } from "./hooks/use-image-source-inputs";
import { useImageSubmit } from "./hooks/use-image-submit";
import { useWorkspaceScrollBehavior } from "./hooks/use-workspace-scroll-behavior";
import { useWorkspaceViewModel } from "./hooks/use-workspace-view-model";
import { buildConversationPreviewSource } from "./view-utils";
import * as workspaceRuntime from "./workspace-runtime";
import { inspirationExamples } from "./workspace-content";
import type {
  ImageAspectRatio,
  ImageResolutionTier,
} from "./workspace-runtime";
import {
  consumeCurrentSiteUserQuota,
  getCurrentSiteUser,
  getSiteUserRemainingQuota,
} from "@/store/site-user-auth";


export default function ImagePage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const didLoadQuotaRef = useRef(false);
  const mountedRef = useRef(true);
  const draftSelectionRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resultsViewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const previousSelectedConversationIdRef = useRef<string | null>(null);
  const previousTurnCountRef = useRef(0);
  const previousLastTurnKeyRef = useRef("");

  const [mode, setMode] = useState<ImageMode>("generate");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageCount, setImageCount] = useState("1");
  const [imageAspectRatio, setImageAspectRatio] =
    useState<ImageAspectRatio>("1:1");
  const [imageResolutionTier, setImageResolutionTier] =
    useState<ImageResolutionTier>("sd");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("high");
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );
  const [availableQuota, setAvailableQuota] = useState("加载中");
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
  const [allowDisabledStudioAccounts, setAllowDisabledStudioAccounts] =
    useState(false);
  const [configuredImageMode, setConfiguredImageMode] = useState<
    "studio" | "cpa"
  >("studio");
  const [configuredFreeImageRoute, setConfiguredFreeImageRoute] =
    useState("legacy");
  const [submitElapsedSeconds, setSubmitElapsedSeconds] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isMobileComposerCollapsed, setIsMobileComposerCollapsed] =
    useState(true);
  const [taskItems, setTaskItems] = useState<ImageTaskView[]>([]);
  const [queuePanelExpanded, setQueuePanelExpanded] = useState(false);
  const [siteUserRemainingQuota, setSiteUserRemainingQuota] = useState(0);
  const [cancellingTaskIds, setCancellingTaskIds] = useState<string[]>([]);
  const [taskSnapshot, setTaskSnapshot] = useState<ImageTaskSnapshot>(
    buildEmptyTaskSnapshot(),
  );
  const persistedTaskStatesRef = useRef<Record<string, string>>({});
  const cancellingTaskIdsRef = useRef(new Set<string>());

  const activeTasks = useMemo(
    () =>
      taskItems.filter((task) =>
        ["queued", "running", "cancel_requested"].includes(task.status),
      ),
    [taskItems],
  );
  const activeTaskByTurnKey = useMemo(() => {
    const next = new Map<string, ImageTaskView>();
    for (const task of activeTasks) {
      const key = `${task.conversationId}:${task.turnId}`;
      const current = next.get(key);
      if (!current || current.createdAt.localeCompare(task.createdAt) < 0) {
        next.set(key, task);
      }
    }
    return next;
  }, [activeTasks]);
  const activeTaskById = useMemo(() => {
    const next = new Map<string, ImageTaskView>();
    for (const task of activeTasks) {
      next.set(task.id, task);
    }
    return next;
  }, [activeTasks]);
  const displayTaskSnapshot = useMemo(
    () => deriveTaskSnapshotFromItems(taskItems, taskSnapshot),
    [taskItems, taskSnapshot],
  );
  const activeConversationIds = useMemo(
    () => new Set(activeTasks.map((task) => task.conversationId)),
    [activeTasks],
  );
  const preferredActiveConversationId = activeTasks[0]?.conversationId ?? null;
  const hasActiveTasks = activeTasks.length > 0;

  const {
    conversations,
    selectedConversationId,
    isLoadingHistory,
    setConversations,
    setSelectedConversationId,
    focusConversation,
    openDraftConversation,
    refreshHistory,
    handleCreateDraft,
    handleDeleteConversation,
    handleClearHistory,
  } = useImageHistory({
    normalizeHistory: workspaceRuntime.normalizeConversationHistory,
    mountedRef,
    draftSelectionRef,
    activeConversationIds,
    preferredActiveConversationId,
  });
  const {
    sourceImages,
    setSourceImages,
    editorTarget,
    appendFiles,
    handlePromptPaste,
    removeSourceImage,
    seedFromResult,
    openSelectionEditor,
    openSourceSelectionEditor,
    closeSelectionEditor,
  } = useImageSourceInputs({
    mode,
    selectedConversationId,
    setMode,
    focusConversation,
    textareaRef,
    makeId: workspaceRuntime.makeId,
  });
  const selectedConversationActiveTaskByTurnId = useMemo(() => {
    const next = new Map<string, ImageTaskView>();
    if (!selectedConversationId) {
      return next;
    }
    for (const [key, task] of activeTaskByTurnKey.entries()) {
      const prefix = `${selectedConversationId}:`;
      if (!key.startsWith(prefix)) {
        continue;
      }
      next.set(task.turnId, task);
    }
    return next;
  }, [activeTaskByTurnKey, selectedConversationId]);

  const displayedConversations = useMemo(() => {
    const tasksByTurnKey = new Map<string, ImageTaskView[]>();
    taskItems.forEach((task) => {
      const key = `${task.conversationId}:${task.turnId}`;
      const current = tasksByTurnKey.get(key) ?? [];
      current.push(task);
      tasksByTurnKey.set(key, current);
    });
    tasksByTurnKey.forEach((items, key) => {
      tasksByTurnKey.set(
        key,
        [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      );
    });
    return conversations.map((conversation) =>
      workspaceRuntime.applyTaskViewToConversation(conversation, tasksByTurnKey),
    );
  }, [conversations, taskItems]);
  const queuePanelTasks = useMemo(() => {
    return taskItems
      .filter((task) => ["queued", "running", "cancel_requested"].includes(task.status))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [taskItems]);
  const selectedConversation = useMemo(
    () =>
      displayedConversations.find((item) => item.id === selectedConversationId) ??
      null,
    [displayedConversations, selectedConversationId],
  );
  const currentImageView = useMemo<"history" | "workspace">(
    () => (pathname.endsWith("/workspace") ? "workspace" : "history"),
    [pathname],
  );
  const isStandaloneHistory =
    !isDesktopLayout && currentImageView === "history";
  const isStandaloneWorkspace =
    !isDesktopLayout && currentImageView === "workspace";
  const selectedConversationTurns = useMemo(
    () => selectedConversation?.turns ?? [],
    [selectedConversation],
  );
  const selectedConversationLastTurn = useMemo(
    () =>
      selectedConversationTurns[selectedConversationTurns.length - 1] ?? null,
    [selectedConversationTurns],
  );
  const selectedConversationLastTurnKey = useMemo(() => {
    if (!selectedConversationLastTurn) {
      return "";
    }
    const imageKey = selectedConversationLastTurn.images
      .map(
        (image) =>
          `${image.id}:${image.status ?? "loading"}:${image.error ?? ""}`,
      )
      .join("|");
    return `${selectedConversationLastTurn.id}:${selectedConversationLastTurn.status}:${imageKey}`;
  }, [selectedConversationLastTurn]);
  const activeRequestTask = useMemo(
    () => selectConversationActiveTask(activeTasks, selectedConversationId),
    [activeTasks, selectedConversationId],
  );
  const activeRequest = useMemo<ActiveRequestState | null>(
    () => buildActiveRequestState(activeRequestTask),
    [activeRequestTask],
  );
  const activeRequestStartedAt = useMemo(() => {
    const raw = activeRequestTask?.startedAt || activeRequestTask?.createdAt;
    if (!raw) {
      return null;
    }
    const timestamp = new Date(raw).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }, [activeRequestTask]);
  const {
    parsedCount,
    hasAvailablePaidAccount,
    hasLegacyFreeAccountInPool,
    currentResolutionPresets,
    currentRequestRequiresPaidAccount,
    isImageQualityEnabled,
    imageResolutionTierOptions,
    imageResolutionTierLabel,
    imageSize,
    imageResolutionAccess,
  } = useWorkspaceViewModel({
    imageCount,
    imageAspectRatio,
    imageResolutionTier,
    availableAccounts,
    allowDisabledStudioAccounts,
    configuredImageMode,
    configuredFreeImageRoute,
  });
  const imageQualityDisabledReason = currentRequestRequiresPaidAccount
    ? "当前输出档位会固定走 Paid 账号，质量参数应可正常生效。"
    : "当前可用号池里仍有 Free legacy 链路账号，标准分辨率请求可能落到该链路，质量参数无法稳定作为正式参数传给上游，暂时置灰。";
  const imageSizeHint = useMemo(
    () =>
      mode === "edit" ? (
        <>
          <div>
            <span className="font-semibold text-stone-800">编辑输出尺寸：</span>
            编辑模式会尽量按所选比例和分辨率输出结果，但最终尺寸仍可能受源图比例、遮罩范围和上游模型能力影响。
          </div>
          <div className="mt-2">
            <span className="font-semibold text-stone-800">质量说明：</span>
            输出质量会跟随当前质量档位；如果请求落到 Free legacy
            链路，质量参数可能不会作为正式参数生效。
          </div>
        </>
      ) : (
        <>
          <div>
            <span className="font-semibold text-stone-800">分辨率限制：</span>
            Free 账号当前按约 1.57M 像素总量控制；Paid 账号的图片最长边最高支持
            3840。
          </div>
          <div className="mt-2">
            <span className="font-semibold text-stone-800">账号要求：</span>
            2K 及以上像素档仅 Paid 账号可用，包括 Team / Plus / Pro。
          </div>
          <div className="mt-2">
            <span className="font-semibold text-stone-800">Auto 模式补充：</span>
            当比例切到 Auto 时，当前项目不会强制指定比例和分辨率，请直接在提示词里写明横竖版、画幅比例和目标输出尺寸。`Free / Paid` 只决定调度时优先使用哪类图片账号，不会把固定尺寸写进上游请求。
          </div>
        </>
      ),
    [mode],
  );
  const imageSources = useMemo(
    () => sourceImages.filter((item) => item.role === "image"),
    [sourceImages],
  );
  const maskSource = useMemo(
    () => sourceImages.find((item) => item.role === "mask") ?? null,
    [sourceImages],
  );
  const processingStatus = useMemo(
    () =>
      activeRequest
        ? workspaceRuntime.buildProcessingStatus(
            activeRequest.mode,
            submitElapsedSeconds,
            activeRequest.count,
            activeRequest.variant,
          )
        : null,
    [activeRequest, submitElapsedSeconds],
  );
  const waitingDots = useMemo(
    () => workspaceRuntime.buildWaitingDots(submitElapsedSeconds),
    [submitElapsedSeconds],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useWorkspaceEffects({
    didLoadQuotaRef,
    refreshHistory,
    setIsDesktopLayout,
    setTaskItems,
    setTaskSnapshot,
    setAllowDisabledStudioAccounts,
    setConfiguredImageMode,
    setConfiguredFreeImageRoute,
    setAvailableAccounts,
    setAvailableQuota,
    currentResolutionPresets,
    imageResolutionTier,
    hasAvailablePaidAccount,
    setImageResolutionTier,
    isImageQualityEnabled,
    imageQuality,
    setImageQuality,
    useSiteUserQuota: true,
  });

  const { scrollToBottom } = useWorkspaceScrollBehavior({
    isStandaloneWorkspace,
    resultsViewportRef,
    isNearBottomRef,
    setShowScrollToBottom,
    selectedConversationId,
    selectedConversationTurnsLength: selectedConversationTurns.length,
    selectedConversationLastTurnKey,
    previousSelectedConversationIdRef,
    previousTurnCountRef,
    previousLastTurnKeyRef,
    selectedConversationExists: Boolean(selectedConversation),
    hasActiveTasks,
  });

  useEffect(() => {
    if (activeRequestStartedAt === null) {
      setSubmitElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setSubmitElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - activeRequestStartedAt) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeRequestStartedAt]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const maxHeight = Math.min(
      480,
      Math.max(260, Math.floor(window.innerHeight * 0.42)),
    );
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [imagePrompt, mode]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("image2-webui:mobile-workspace-title", {
        detail: { title: selectedConversation?.title ?? null },
      }),
    );
  }, [selectedConversation?.title]);

  const { persistConversation, updateConversation } = useWorkspaceConversationSync({
    mountedRef,
    draftSelectionRef,
    persistedTaskStatesRef,
    displayedConversations,
    taskItems,
    setConversations,
    setSelectedConversationId,
  });

  const resetComposer = useCallback(
    (nextMode: ImageMode = mode) => {
      setMode(nextMode);
      setImagePrompt("");
      setImageCount("1");
      setSourceImages([]);
    },
    [mode, setSourceImages],
  );

  const openHistoryView = useCallback(() => {
    navigate("/image/history");
  }, [navigate]);

  const openWorkspaceView = useCallback(() => {
    navigate("/image/workspace");
  }, [navigate]);

  const handleCreateDraftAndOpenWorkspace = useCallback(() => {
    handleCreateDraft(resetComposer, textareaRef);
    openWorkspaceView();
  }, [handleCreateDraft, openWorkspaceView, resetComposer]);

  const handleFocusConversationAndOpenWorkspace = useCallback(
    (conversationId: string) => {
      focusConversation(conversationId);
      openWorkspaceView();
    },
    [focusConversation, openWorkspaceView],
  );

  const applyPromptExample = useCallback(
    (example: (typeof inspirationExamples)[number]) => {
      setMode("generate");
      setImageCount(String(example.count));
      setImagePrompt(example.prompt);
      openDraftConversation();
      setSourceImages([]);
      textareaRef.current?.focus();
    },
    [openDraftConversation, setSourceImages],
  );

  useEffect(() => {
    let disposed = false;
    const loadUserQuota = async () => {
      const user = await getCurrentSiteUser();
      if (!disposed) {
        const remaining = getSiteUserRemainingQuota(user);
        setSiteUserRemainingQuota(remaining);
        setAvailableQuota(String(remaining));
      }
    };
    void loadUserQuota();
    return () => {
      disposed = true;
    };
  }, []);

  const { handleSelectionEditSubmit, handleRetryTurn, handleSubmit: handleSubmitBase } =
    useImageSubmit({
      mode,
      imagePrompt,
      imageModel: "gpt-image-2",
      imageSources,
      maskSource,
      sourceImages,
      parsedCount,
      imageSize,
      imageResolutionAccess,
      imageQuality,
      selectedConversationId,
      editorTarget,
      makeId: workspaceRuntime.makeId,
      focusConversation,
      closeSelectionEditor,
      setImagePrompt,
      setSourceImages,
      setSubmitElapsedSeconds,
      persistConversation,
      updateConversation,
      resetComposer,
    });

  const handleSubmit = useCallback(async () => {
    if (siteUserRemainingQuota <= 0) {
      toast.error("今日额度已用完，请明天再试或联系管理员调整日额度");
      return;
    }
    const succeeded = await handleSubmitBase();
    if (!succeeded) {
      return;
    }
    const consumeCount = Math.max(1, Number(imageCount || 1));
    try {
      await consumeCurrentSiteUserQuota(consumeCount);
      const user = await getCurrentSiteUser();
      const remaining = getSiteUserRemainingQuota(user);
      setSiteUserRemainingQuota(remaining);
      setAvailableQuota(String(remaining));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "扣减额度失败");
    }
  }, [handleSubmitBase, imageCount, siteUserRemainingQuota]);

  const handleCancelTurn = useCallback(
    async (conversationId: string, turn: ImageConversationTurn) => {
      const runtimeTask =
        activeTaskByTurnKey.get(`${conversationId}:${turn.id}`) ??
        (turn.taskId ? activeTaskById.get(turn.taskId.trim()) : null) ??
        null;
      const taskId = runtimeTask?.id || "";
      if (!taskId) {
        toast.warning("任务还在创建中，请稍后再试");
        return;
      }
      if (cancellingTaskIdsRef.current.has(taskId)) {
        return;
      }

      cancellingTaskIdsRef.current.add(taskId);
      setCancellingTaskIds((prev) =>
        prev.includes(taskId) ? prev : [...prev, taskId],
      );

      try {
        const result = await cancelImageTask(taskId);
        setTaskItems((prev) =>
          reduceTaskItems(prev, {
            type: "task.upsert",
            task: result.task,
          }),
        );
        setTaskSnapshot(result.snapshot);
        toast.success(
          result.task.status === "cancel_requested"
            ? "已提交取消请求，等待当前执行结束"
            : "已取消排队任务",
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "取消任务失败");
      } finally {
        cancellingTaskIdsRef.current.delete(taskId);
        setCancellingTaskIds((prev) => prev.filter((item) => item !== taskId));
      }
    },
    [activeTaskById, activeTaskByTurnKey],
  );
  const handleCancelTaskById = useCallback(
    async (taskId: string) => {
      if (!taskId) {
        return;
      }
      if (cancellingTaskIdsRef.current.has(taskId)) {
        return;
      }
      cancellingTaskIdsRef.current.add(taskId);
      setCancellingTaskIds((prev) =>
        prev.includes(taskId) ? prev : [...prev, taskId],
      );
      try {
        const result = await cancelImageTask(taskId);
        setTaskItems((prev) =>
          reduceTaskItems(prev, {
            type: "task.upsert",
            task: result.task,
          }),
        );
        setTaskSnapshot(result.snapshot);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "取消任务失败");
      } finally {
        cancellingTaskIdsRef.current.delete(taskId);
        setCancellingTaskIds((prev) => prev.filter((item) => item !== taskId));
      }
    },
    [],
  );

  const historyPanel = (
    <HistorySidebar
      conversations={displayedConversations}
      selectedConversationId={selectedConversationId}
      isLoadingHistory={isLoadingHistory}
      hasActiveTasks={hasActiveTasks}
      activeConversationIds={activeConversationIds}
      modeLabelMap={workspaceRuntime.modeLabelMap}
      buildConversationPreviewSource={buildConversationPreviewSource}
      formatConversationTime={workspaceRuntime.formatConversationTime}
      onCreateDraft={handleCreateDraftAndOpenWorkspace}
      onClearHistory={handleClearHistory}
      onFocusConversation={handleFocusConversationAndOpenWorkspace}
      onDeleteConversation={handleDeleteConversation}
      standalone={isStandaloneHistory}
    />
  );

  const workspacePanel = (
    <div
      className={cn(
        "order-1 flex flex-col overflow-visible lg:order-none lg:min-h-0 lg:overflow-hidden",
        isStandaloneWorkspace
          ? "rounded-none border-0 bg-transparent shadow-none"
          : "studio-card rounded-xl bg-white transition-colors duration-200 dark:bg-[var(--studio-panel)]",
      )}
    >
      <WorkspaceHeader
        historyCollapsed={historyCollapsed}
        selectedConversationTitle={selectedConversation?.title}
        runningCount={displayTaskSnapshot.running}
        maxRunningCount={displayTaskSnapshot.maxRunning}
        queuedCount={displayTaskSnapshot.queued}
        workspaceActiveCount={displayTaskSnapshot.activeSources.workspace}
        compatActiveCount={displayTaskSnapshot.activeSources.compat}
        cancelledCount={displayTaskSnapshot.finalStatuses.cancelled}
        expiredCount={displayTaskSnapshot.finalStatuses.expired}
        onToggleHistory={() => setHistoryCollapsed((current) => !current)}
        showHistoryToggle={!isStandaloneWorkspace}
      />
      <div className="border-b border-stone-200 px-4 py-2 dark:border-[var(--studio-border)]">
        <button
          type="button"
          onClick={() => setQueuePanelExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)]"
        >
          批量任务队列
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-[var(--studio-panel-muted)] dark:text-[var(--studio-text-muted)]">
            {queuePanelTasks.length}
          </span>
        </button>
        {queuePanelExpanded ? (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-stone-200 bg-white p-2 dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel)]">
            {queuePanelTasks.length === 0 ? (
              <div className="px-2 py-3 text-xs text-stone-500">当前没有排队或运行中的任务</div>
            ) : (
              <div className="space-y-2">
                {queuePanelTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-2 py-2 dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel-soft)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-stone-700 dark:text-[var(--studio-text)]">
                        {workspaceRuntime.modeLabelMap[task.mode === "edit" ? "edit" : "generate"]} · {task.status}
                      </div>
                      <div className="truncate text-[11px] text-stone-500 dark:text-[var(--studio-text-muted)]">
                        #{task.id.slice(0, 8)} · 会话 {task.conversationId.slice(0, 6)}
                        {typeof task.queuePosition === "number" ? ` · 排队#${task.queuePosition}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCancelTaskById(task.id)}
                      className="shrink-0 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-50 dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)]"
                    >
                      取消
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "relative min-h-[240px] lg:min-h-0 lg:flex-1",
          isStandaloneWorkspace ? "bg-transparent" : "bg-white dark:bg-[var(--studio-panel-soft)]",
        )}
      >
        <div
          ref={resultsViewportRef}
          className={cn(
            "hide-scrollbar min-h-[240px] overflow-visible lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pb-0",
            isMobileComposerCollapsed
              ? "pb-[68px] sm:pb-[74px]"
              : "pb-[228px] sm:pb-[244px]",
          )}
        >
          {!selectedConversation ? (
            <EmptyState
              inspirationExamples={inspirationExamples}
              onApplyPromptExample={applyPromptExample}
            />
          ) : (
            <ConversationTurns
              conversationId={selectedConversation.id}
              turns={selectedConversationTurns}
              modeLabelMap={workspaceRuntime.modeLabelMap}
              activeRequest={activeRequest}
              activeTaskByTurnId={selectedConversationActiveTaskByTurnId}
              cancellingTaskIds={cancellingTaskIds}
              processingStatus={processingStatus}
              waitingDots={waitingDots}
              submitElapsedSeconds={submitElapsedSeconds}
              formatConversationTime={workspaceRuntime.formatConversationTime}
              formatProcessingDuration={workspaceRuntime.formatProcessingDuration}
              onOpenSelectionEditor={openSelectionEditor}
              onSeedFromResult={seedFromResult}
              onRetryTurn={handleRetryTurn}
              onCancelTurn={handleCancelTurn}
            />
          )}
        </div>
        {showScrollToBottom ? (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className={cn(
              "absolute right-4 z-10 inline-flex size-11 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-700 shadow-lg shadow-stone-300/30 backdrop-blur transition hover:bg-white hover:text-stone-950 dark:border-[var(--studio-border)] dark:bg-[color:var(--studio-panel-soft)] dark:text-[var(--studio-text)] dark:shadow-black/40 dark:hover:bg-[var(--studio-panel-muted)] dark:hover:text-[var(--studio-text-strong)] sm:right-5 lg:bottom-5",
              isMobileComposerCollapsed
                ? "bottom-[52px] sm:bottom-[60px]"
                : "bottom-[150px] sm:bottom-[164px]",
            )}
            aria-label="滚动到底部"
            title="滚动到底部"
          >
            <ChevronsDown className="size-5" />
          </button>
        ) : null}
      </div>

      <PromptComposer
        mode={mode}
        modeOptions={workspaceRuntime.modeOptions}
        imageCount={imageCount}
        imageAspectRatio={imageAspectRatio}
        imageAspectRatioOptions={workspaceRuntime.imageAspectRatioOptions}
        imageResolutionTier={imageResolutionTier}
        imageResolutionTierLabel={imageResolutionTierLabel}
        imageResolutionTierOptions={imageResolutionTierOptions}
        imageSizeHint={imageSizeHint}
        imageQuality={imageQuality}
        imageQualityOptions={workspaceRuntime.imageQualityOptions}
        imageQualityDisabled={!isImageQualityEnabled}
        imageQualityDisabledReason={imageQualityDisabledReason}
        availableQuota={availableQuota}
        sourceImages={sourceImages}
        imagePrompt={imagePrompt}
        textareaRef={textareaRef}
        uploadInputRef={uploadInputRef}
        onModeChange={setMode}
        onImageCountChange={setImageCount}
        onImageAspectRatioChange={(value) =>
          setImageAspectRatio(value as ImageAspectRatio)
        }
        onImageResolutionTierChange={(value) =>
          setImageResolutionTier(value as ImageResolutionTier)
        }
        onImageQualityChange={(value) => setImageQuality(value as ImageQuality)}
        onPromptChange={setImagePrompt}
        onPromptPaste={handlePromptPaste}
        onRemoveSourceImage={removeSourceImage}
        onOpenSourceSelectionEditor={openSourceSelectionEditor}
        onAppendFiles={appendFiles}
        onMobileCollapsedChange={setIsMobileComposerCollapsed}
        allowSourceUpload
        submitDisabled={!imagePrompt.trim() || siteUserRemainingQuota <= 0}
        onSubmit={handleSubmit}
      />
    </div>
  );

  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-3 lg:h-full lg:min-h-0",
        isStandaloneHistory || isStandaloneWorkspace
          ? "grid-rows-[auto]"
          : historyCollapsed
            ? "grid-rows-[auto] lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
            : "grid-rows-[auto_auto] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]",
      )}
    >
      {isStandaloneHistory ? historyPanel : null}
      {isStandaloneWorkspace ? workspacePanel : null}
      {!isStandaloneHistory && !isStandaloneWorkspace ? (
        <>
          {!historyCollapsed ? historyPanel : null}
          {workspacePanel}
        </>
      ) : null}

      <ImageEditModal
        key={editorTarget?.imageName || "image-edit-modal"}
        open={Boolean(editorTarget)}
        imageName={editorTarget?.imageName || "image.png"}
        imageSrc={editorTarget?.sourceDataUrl || ""}
        isSubmitting={false}
        allowOutputOptions={Boolean(editorTarget)}
        imageAspectRatio={imageAspectRatio}
        imageAspectRatioOptions={workspaceRuntime.imageAspectRatioOptions}
        imageResolutionTier={imageResolutionTier}
        imageResolutionTierOptions={imageResolutionTierOptions}
        imageQuality={imageQuality}
        imageQualityOptions={workspaceRuntime.imageQualityOptions}
        imageQualityDisabled={!isImageQualityEnabled}
        imageQualityDisabledReason={imageQualityDisabledReason}
        onImageAspectRatioChange={(value) =>
          setImageAspectRatio(value as ImageAspectRatio)
        }
        onImageResolutionTierChange={(value) =>
          setImageResolutionTier(value as ImageResolutionTier)
        }
        onImageQualityChange={(value) => setImageQuality(value as ImageQuality)}
        onClose={closeSelectionEditor}
        onSubmit={async (payload) => {
          await handleSelectionEditSubmit(payload);
        }}
      />
    </section>
  );
}
