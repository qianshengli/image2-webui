import { useCallback, useEffect, type MutableRefObject } from "react";

import type { ImageTaskView } from "@/lib/api";
import {
  normalizeConversation,
  saveImageConversation,
  updateImageConversation,
  type ImageConversation,
} from "@/store/image-conversations";
import * as workspaceRuntime from "@/app/image/workspace-runtime";

type Input = {
  mountedRef: MutableRefObject<boolean>;
  draftSelectionRef: MutableRefObject<boolean>;
  persistedTaskStatesRef: MutableRefObject<Record<string, string>>;
  displayedConversations: ImageConversation[];
  taskItems: ImageTaskView[];
  setConversations: (updater: (prev: ImageConversation[]) => ImageConversation[]) => void;
  setSelectedConversationId: (conversationId: string | null) => void;
};

export function useWorkspaceConversationSync({
  mountedRef,
  draftSelectionRef,
  persistedTaskStatesRef,
  displayedConversations,
  taskItems,
  setConversations,
  setSelectedConversationId,
}: Input) {
  const persistConversation = useCallback(
    async (conversation: ImageConversation) => {
      const normalizedConversation = normalizeConversation(conversation);
      if (mountedRef.current) {
        draftSelectionRef.current = false;
        setSelectedConversationId(normalizedConversation.id);
        setConversations((prev) => {
          const next = [
            normalizedConversation,
            ...prev.filter((item) => item.id !== normalizedConversation.id),
          ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return next;
        });
      }
      await saveImageConversation(normalizedConversation);
    },
    [draftSelectionRef, mountedRef, setConversations, setSelectedConversationId],
  );

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (current: ImageConversation | null) => ImageConversation,
    ) => {
      if (mountedRef.current) {
        setConversations((prev) => {
          const currentConversation =
            prev.find((item) => item.id === conversationId) ?? null;
          const optimisticConversation = normalizeConversation(
            updater(currentConversation),
          );
          const next = [
            optimisticConversation,
            ...prev.filter((item) => item.id !== conversationId),
          ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return next;
        });
      }

      const nextConversation = await updateImageConversation(
        conversationId,
        updater,
      );
      if (!mountedRef.current) {
        return;
      }
      setConversations((prev) => {
        const next = [
          nextConversation,
          ...prev.filter((item) => item.id !== conversationId),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return next;
      });
    },
    [mountedRef, setConversations],
  );

  useEffect(() => {
    for (const task of taskItems) {
      if (![
        "succeeded",
        "failed",
        "cancelled",
        "expired",
      ].includes(task.status)) {
        continue;
      }
      if (!task.conversationId.trim()) {
        continue;
      }
      if (!displayedConversations.some((item) => item.id === task.conversationId)) {
        continue;
      }
      if (persistedTaskStatesRef.current[task.id] === task.status) {
        continue;
      }
      persistedTaskStatesRef.current[task.id] = task.status;
      void updateConversation(task.conversationId, (current: ImageConversation | null) => {
        if (!current) {
          return normalizeConversation({
            id: task.conversationId,
            title: "",
            mode: "generate",
            prompt: "",
            model: "gpt-image-2",
            count: task.count,
            images: [],
            createdAt: task.createdAt,
            status: "error",
            turns: [],
          } as ImageConversation);
        }
        return workspaceRuntime.applyTaskViewToConversation(
          current,
          new Map([[`${task.conversationId}:${task.turnId}`, [task]]]),
        );
      });
    }
  }, [displayedConversations, persistedTaskStatesRef, taskItems, updateConversation]);

  return {
    persistConversation,
    updateConversation,
  };
}
