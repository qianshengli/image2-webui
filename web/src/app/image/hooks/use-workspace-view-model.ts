import { useMemo } from "react";

import type { Account } from "@/lib/api";
import * as workspaceRuntime from "@/app/image/workspace-runtime";
import type {
  ImageAspectRatio,
  ImageResolutionTier,
} from "@/app/image/workspace-runtime";

type Input = {
  imageCount: string;
  imageAspectRatio: ImageAspectRatio;
  imageResolutionTier: ImageResolutionTier;
  availableAccounts: Account[];
  allowDisabledStudioAccounts: boolean;
  configuredImageMode: "studio" | "cpa";
  configuredFreeImageRoute: string;
};

type ResolutionPreset =
  ReturnType<typeof workspaceRuntime.getImageResolutionOptions>[number];

export function useWorkspaceViewModel({
  imageCount,
  imageAspectRatio,
  imageResolutionTier,
  availableAccounts,
  allowDisabledStudioAccounts,
  configuredImageMode,
  configuredFreeImageRoute,
}: Input) {
  const parsedCount = useMemo(
    () => Math.max(1, Math.min(8, Number(imageCount) || 1)),
    [imageCount],
  );

  const hasAvailablePaidAccount = useMemo(
    () =>
      workspaceRuntime.hasAvailablePaidImageAccount(
        availableAccounts,
        allowDisabledStudioAccounts,
      ),
    [allowDisabledStudioAccounts, availableAccounts],
  );

  const hasLegacyFreeAccountInPool = useMemo(
    () =>
      workspaceRuntime.hasUsableFreeLegacyAccount(
        availableAccounts,
        allowDisabledStudioAccounts,
        configuredImageMode,
        configuredFreeImageRoute,
      ),
    [
      allowDisabledStudioAccounts,
      availableAccounts,
      configuredFreeImageRoute,
      configuredImageMode,
    ],
  );

  const currentResolutionPresets = useMemo(
    () => workspaceRuntime.getImageResolutionOptions(imageAspectRatio),
    [imageAspectRatio],
  );

  const selectedResolutionPreset = useMemo(
    () =>
      currentResolutionPresets.find(
        (item: ResolutionPreset) => item.tier === imageResolutionTier,
      ) ?? currentResolutionPresets[0],
    [currentResolutionPresets, imageResolutionTier],
  );

  const currentRequestRequiresPaidAccount =
    selectedResolutionPreset?.access === "paid";

  const isImageQualityEnabled = useMemo(
    () =>
      configuredImageMode === "cpa" ||
      !hasLegacyFreeAccountInPool ||
      (currentRequestRequiresPaidAccount && hasAvailablePaidAccount),
    [
      configuredImageMode,
      currentRequestRequiresPaidAccount,
      hasAvailablePaidAccount,
      hasLegacyFreeAccountInPool,
    ],
  );

  const imageResolutionTierOptions = useMemo(
    () =>
      currentResolutionPresets.map((item: ResolutionPreset) => ({
        label:
          imageAspectRatio === "auto"
            ? item.label
            : `${item.access === "paid" ? "Paid" : "Free"} ${workspaceRuntime.formatResolutionLabel(item.value)}${item.access === "paid" ? `（${item.label.replace("Paid ", "")}）` : ""}`,
        value: item.tier,
        disabled: item.access === "paid" && !hasAvailablePaidAccount,
      })),
    [currentResolutionPresets, hasAvailablePaidAccount, imageAspectRatio],
  );

  const imageResolutionTierLabel = useMemo(
    () =>
      imageResolutionTierOptions.find(
        (item: { value: ImageResolutionTier; disabled: boolean }) =>
          item.value === imageResolutionTier && !item.disabled,
      )?.label ??
      imageResolutionTierOptions.find(
        (item: { disabled: boolean }) => !item.disabled,
      )?.label ??
      "",
    [imageResolutionTier, imageResolutionTierOptions],
  );

  const imageSize = useMemo(
    () =>
      imageAspectRatio === "auto"
        ? ""
        :
            currentResolutionPresets.find(
              (item: ResolutionPreset) =>
                item.tier === imageResolutionTier &&
                (hasAvailablePaidAccount || item.access === "free"),
            )?.value ??
            currentResolutionPresets.find(
              (item: ResolutionPreset) =>
                hasAvailablePaidAccount || item.access === "free",
            )?.value ??
            currentResolutionPresets[0].value,
    [
      currentResolutionPresets,
      hasAvailablePaidAccount,
      imageAspectRatio,
      imageResolutionTier,
    ],
  );

  const imageResolutionAccess = useMemo<"free" | "paid">(
    () => selectedResolutionPreset?.access ?? "free",
    [selectedResolutionPreset],
  );

  return {
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
  };
}
