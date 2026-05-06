import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";

type Input = {
  isStandaloneWorkspace: boolean;
  resultsViewportRef: RefObject<HTMLDivElement | null>;
  isNearBottomRef: MutableRefObject<boolean>;
  setShowScrollToBottom: (value: boolean) => void;
  selectedConversationId: string | null;
  selectedConversationTurnsLength: number;
  selectedConversationLastTurnKey: string;
  previousSelectedConversationIdRef: MutableRefObject<string | null>;
  previousTurnCountRef: MutableRefObject<number>;
  previousLastTurnKeyRef: MutableRefObject<string>;
  selectedConversationExists: boolean;
  hasActiveTasks: boolean;
};

export function useWorkspaceScrollBehavior({
  isStandaloneWorkspace,
  resultsViewportRef,
  isNearBottomRef,
  setShowScrollToBottom,
  selectedConversationId,
  selectedConversationTurnsLength,
  selectedConversationLastTurnKey,
  previousSelectedConversationIdRef,
  previousTurnCountRef,
  previousLastTurnKeyRef,
  selectedConversationExists,
  hasActiveTasks,
}: Input) {
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (isStandaloneWorkspace) {
        const scrollTarget = document.scrollingElement;
        if (!scrollTarget) return;
        window.scrollTo({ top: scrollTarget.scrollHeight, behavior });
        return;
      }
      const viewport = resultsViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    },
    [isStandaloneWorkspace, resultsViewportRef],
  );

  useEffect(() => {
    if (isStandaloneWorkspace) {
      const updateScrollState = () => {
        const scrollTarget = document.scrollingElement;
        if (!scrollTarget) return;
        const scrollTop = window.scrollY || scrollTarget.scrollTop;
        const viewportHeight = window.innerHeight;
        const hiddenHeight = scrollTarget.scrollHeight - viewportHeight - scrollTop;
        const hasOverflow = scrollTarget.scrollHeight > viewportHeight + 24;
        const nearBottom = hiddenHeight <= 96;
        isNearBottomRef.current = nearBottom;
        setShowScrollToBottom(hasOverflow && !nearBottom);
      };
      updateScrollState();
      window.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        window.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }

    const viewport = resultsViewportRef.current;
    if (!viewport) return;
    const updateScrollState = () => {
      const hiddenHeight = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      const hasOverflow = viewport.scrollHeight > viewport.clientHeight + 24;
      const nearBottom = hiddenHeight <= 96;
      isNearBottomRef.current = nearBottom;
      setShowScrollToBottom(hasOverflow && !nearBottom);
    };
    updateScrollState();
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [
    isNearBottomRef,
    isStandaloneWorkspace,
    resultsViewportRef,
    selectedConversationId,
    selectedConversationLastTurnKey,
    selectedConversationTurnsLength,
    setShowScrollToBottom,
  ]);

  useEffect(() => {
    const conversationChanged = previousSelectedConversationIdRef.current !== selectedConversationId;
    const turnCountIncreased = selectedConversationTurnsLength > previousTurnCountRef.current;
    const lastTurnChanged = previousLastTurnKeyRef.current !== selectedConversationLastTurnKey;
    previousSelectedConversationIdRef.current = selectedConversationId;
    previousTurnCountRef.current = selectedConversationTurnsLength;
    previousLastTurnKeyRef.current = selectedConversationLastTurnKey;
    if (!selectedConversationExists && !hasActiveTasks) return;
    if (!conversationChanged && !turnCountIncreased && !(lastTurnChanged && isNearBottomRef.current)) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(conversationChanged ? "auto" : "smooth");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    hasActiveTasks,
    isNearBottomRef,
    previousLastTurnKeyRef,
    previousSelectedConversationIdRef,
    previousTurnCountRef,
    scrollToBottom,
    selectedConversationExists,
    selectedConversationId,
    selectedConversationLastTurnKey,
    selectedConversationTurnsLength,
  ]);

  useEffect(() => {
    if (!isStandaloneWorkspace || !selectedConversationId) return;
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
      return () => window.cancelAnimationFrame(secondFrame);
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [isStandaloneWorkspace, scrollToBottom, selectedConversationId]);

  return { scrollToBottom };
}
