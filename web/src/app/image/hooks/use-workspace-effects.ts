import { useEffect, type MutableRefObject } from "react";

import {
  consumeImageTaskStream,
  fetchAccounts,
  fetchConfig,
  listImageTasks,
  type ImageTaskSnapshot,
  type ImageTaskView,
} from "@/lib/api";
import { getStoredAuthKey } from "@/store/auth";
import { buildEmptyTaskSnapshot, reduceTaskItems } from "@/app/image/task-runtime";
import * as workspaceRuntime from "@/app/image/workspace-runtime";

type Input = {
  didLoadQuotaRef: MutableRefObject<boolean>;
  refreshHistory: (options: { normalize: boolean; withLoading: boolean; silent?: boolean }) => Promise<void>;
  setIsDesktopLayout: (value: boolean) => void;
  setTaskItems: (updater: ImageTaskView[] | ((prev: ImageTaskView[]) => ImageTaskView[])) => void;
  setTaskSnapshot: (updater: ImageTaskSnapshot) => void;
  setAllowDisabledStudioAccounts: (value: boolean) => void;
  setConfiguredImageMode: (value: "studio" | "cpa") => void;
  setConfiguredFreeImageRoute: (value: string) => void;
  setAvailableAccounts: (items: any[]) => void;
  setAvailableQuota: (updater: string | ((prev: string) => string)) => void;
  currentResolutionPresets: Array<{ tier: string; access: "free" | "paid" }>;
  imageResolutionTier: string;
  hasAvailablePaidAccount: boolean;
  setImageResolutionTier: (value: any) => void;
  isImageQualityEnabled: boolean;
  imageQuality: string;
  setImageQuality: (value: any) => void;
  useSiteUserQuota?: boolean;
};

export function useWorkspaceEffects({
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
  useSiteUserQuota = false,
}: Input) {
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateLayout = (matches: boolean) => {
      setIsDesktopLayout(matches);
    };
    updateLayout(media.matches);
    const handleChange = (event: MediaQueryListEvent) => updateLayout(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [setIsDesktopLayout]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshHistory({ normalize: true, withLoading: true, silent: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refreshHistory]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;
    let pollingTimer: number | null = null;
    let streamAbort: AbortController | null = null;
    const applyTaskPayload = (items: ImageTaskView[], snapshot: ImageTaskSnapshot) => {
      if (disposed) return;
      setTaskItems(items);
      setTaskSnapshot(snapshot);
    };
    const loadTasks = async () => {
      try {
        const payload = await listImageTasks();
        applyTaskPayload(payload.items, payload.snapshot);
      } catch {
        if (!disposed) {
          setTaskItems([]);
          setTaskSnapshot(buildEmptyTaskSnapshot());
        }
      }
    };
    const startPolling = () => {
      if (pollingTimer !== null) return;
      void loadTasks();
      pollingTimer = window.setInterval(() => {
        void loadTasks();
      }, 2000);
    };
    const stopPolling = () => {
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
    const startStream = () => {
      streamAbort = new AbortController();
      void consumeImageTaskStream(
        {
          onInit: ({ items, snapshot }) => {
            stopPolling();
            applyTaskPayload(items, snapshot);
          },
          onEvent: (event) => {
            setTaskItems((prev) => reduceTaskItems(prev, event));
            if (event.snapshot) setTaskSnapshot(event.snapshot);
          },
        },
        streamAbort.signal,
      ).catch(() => {
        if (disposed) return;
        startPolling();
        reconnectTimer = window.setTimeout(() => {
          if (!disposed) startStream();
        }, 3000);
      });
    };
    const bootstrap = async () => {
      const authKey = await getStoredAuthKey();
      if (disposed || !authKey) {
        return;
      }
      startPolling();
      startStream();
    };
    void bootstrap();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      stopPolling();
      streamAbort?.abort();
    };
  }, [setTaskItems, setTaskSnapshot]);

  useEffect(() => {
    const loadQuota = async () => {
      try {
        const [accountsData, configData] = await Promise.all([fetchAccounts(), fetchConfig()]);
        const allowDisabled = configData.chatgpt.imageMode === "studio" && configData.chatgpt.studioAllowDisabledImageAccounts;
        setAllowDisabledStudioAccounts(allowDisabled);
        setConfiguredImageMode(configData.chatgpt.imageMode);
        setConfiguredFreeImageRoute(configData.chatgpt.freeImageRoute);
        setAvailableAccounts(accountsData.items);
        if (!useSiteUserQuota) {
          setAvailableQuota(workspaceRuntime.formatAvailableQuota(accountsData.items, allowDisabled));
        }
      } catch {
        setAvailableAccounts([]);
        setAllowDisabledStudioAccounts(false);
        setConfiguredImageMode("studio");
        setConfiguredFreeImageRoute("legacy");
        if (!useSiteUserQuota) {
          setAvailableQuota((prev) => (prev === "加载中" ? "—" : prev));
        }
      }
    };
    if (didLoadQuotaRef.current) return;
    didLoadQuotaRef.current = true;
    void loadQuota();
  }, [didLoadQuotaRef, setAllowDisabledStudioAccounts, setAvailableAccounts, setAvailableQuota, setConfiguredFreeImageRoute, setConfiguredImageMode, useSiteUserQuota]);

  useEffect(() => {
    const selectedPreset = currentResolutionPresets.find((item) => item.tier === imageResolutionTier);
    if (selectedPreset && (hasAvailablePaidAccount || selectedPreset.access === "free")) return;
    const nextPreset = currentResolutionPresets.find((item) => hasAvailablePaidAccount || item.access === "free");
    if (nextPreset && nextPreset.tier !== imageResolutionTier) {
      setImageResolutionTier(nextPreset.tier);
    }
  }, [currentResolutionPresets, hasAvailablePaidAccount, imageResolutionTier, setImageResolutionTier]);

  useEffect(() => {
    if (!isImageQualityEnabled && imageQuality !== "high") {
      setImageQuality("high");
    }
  }, [imageQuality, isImageQualityEnabled, setImageQuality]);
}
