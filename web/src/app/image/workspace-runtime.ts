import type { Account, ImageQuality, ImageTaskView } from "@/lib/api";
import {
  normalizeConversation,
  type ImageConversation,
  type ImageConversationStatus,
  type ImageConversationTurn,
  type ImageMode,
  type StoredImage,
} from "@/store/image-conversations";

export type ImageAspectRatio = "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "21:9" | "9:16";
export type ImageResolutionTier = "auto-free" | "auto-paid" | "sd" | "2k" | "4k";
type ImageResolutionAccess = "free" | "paid";
type ImageResolutionPreset = {
  tier: ImageResolutionTier;
  label: string;
  value: string;
  access: ImageResolutionAccess;
};

export const imageAspectRatioOptions: Array<{ label: string; value: ImageAspectRatio }> = [
  { label: "Auto", value: "auto" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:2", value: "3:2" },
  { label: "16:9", value: "16:9" },
  { label: "21:9", value: "21:9" },
  { label: "9:16", value: "9:16" },
];

const imageAutoResolutionPresets: ImageResolutionPreset[] = [
  { tier: "auto-free", label: "Free（提示词指定）", value: "", access: "free" },
  { tier: "auto-paid", label: "Paid（提示词指定）", value: "", access: "paid" },
];

const imageResolutionPresets: Record<Exclude<ImageAspectRatio, "auto">, ImageResolutionPreset[]> = {
  "1:1": [
    { tier: "sd", label: "Free 实际档", value: "1248x1248", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "2048x2048", access: "paid" },
    { tier: "4k", label: "Paid 高像素上限", value: "2880x2880", access: "paid" },
  ],
  "4:3": [
    { tier: "sd", label: "Free 实际档", value: "1440x1072", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "2048x1536", access: "paid" },
    { tier: "4k", label: "Paid 高像素", value: "3264x2448", access: "paid" },
  ],
  "3:2": [
    { tier: "sd", label: "Free 实际档", value: "1536x1024", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "2160x1440", access: "paid" },
    { tier: "4k", label: "Paid 高像素", value: "3456x2304", access: "paid" },
  ],
  "16:9": [
    { tier: "sd", label: "Free 实际档", value: "1664x928", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "2560x1440", access: "paid" },
    { tier: "4k", label: "Paid 4K", value: "3840x2160", access: "paid" },
  ],
  "21:9": [
    { tier: "sd", label: "Free 实际档", value: "1904x816", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "3360x1440", access: "paid" },
    { tier: "4k", label: "Paid 高像素", value: "3808x1632", access: "paid" },
  ],
  "9:16": [
    { tier: "sd", label: "Free 实际档", value: "928x1664", access: "free" },
    { tier: "2k", label: "Paid 2K", value: "1440x2560", access: "paid" },
    { tier: "4k", label: "Paid 4K", value: "2160x3840", access: "paid" },
  ],
};

export const modeOptions: Array<{ label: string; value: ImageMode; description: string }> = [
  { label: "生成", value: "generate", description: "提示词生成新图，也可上传参考图辅助生成" },
  { label: "编辑", value: "edit", description: "上传源图后按提示词进行局部或整体编辑" },
];

export const imageQualityOptions: Array<{ label: string; value: ImageQuality; description: string }> = [
  { label: "Low", value: "low", description: "低质量，速度更快，适合草稿测试" },
  { label: "Medium", value: "medium", description: "均衡质量与速度，适合日常生成" },
  { label: "High", value: "high", description: "高质量，耗时更长，适合最终出图" },
];

export const modeLabelMap: Record<ImageMode, string> = { generate: "生成", edit: "编辑" };

export function formatResolutionLabel(value: string) {
  return value.replace("x", " x ");
}

export function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function getImageRemaining(account: Account) {
  const limit = account.limits_progress?.find((item) => item.feature_name === "image_gen");
  if (typeof limit?.remaining === "number") return Math.max(0, limit.remaining);
  return Math.max(0, account.quota);
}

export function isImageAccountUsable(account: Account, allowDisabled: boolean) {
  const disabled = Boolean(account.disabled) || account.status === "禁用";
  return (!disabled || allowDisabled) && account.status !== "异常" && account.status !== "限流" && getImageRemaining(account) > 0;
}

export function formatAvailableQuota(accounts: Account[], allowDisabled: boolean) {
  const availableAccounts = accounts.filter((account) => isImageAccountUsable(account, allowDisabled));
  return String(availableAccounts.reduce((sum, account) => sum + getImageRemaining(account), 0));
}

export function hasAvailablePaidImageAccount(accounts: Account[], allowDisabled: boolean) {
  return accounts.some((account) => isImageAccountUsable(account, allowDisabled) && (account.type === "Plus" || account.type === "Pro" || account.type === "Team"));
}

export function hasUsableFreeLegacyAccount(accounts: Account[], allowDisabled: boolean, imageMode: "studio" | "cpa", freeImageRoute: string) {
  if (imageMode !== "studio" || freeImageRoute !== "legacy") return false;
  return accounts.some((account) => isImageAccountUsable(account, allowDisabled) && account.type !== "Plus" && account.type !== "Pro" && account.type !== "Team");
}

export async function normalizeConversationHistory(items: ImageConversation[]) {
  return items.map((item) => normalizeConversation(item));
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatProcessingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function buildWaitingDots(totalSeconds: number) {
  return ".".repeat((totalSeconds % 3) + 1);
}

function mapTaskStatusToTurnStatus(status: string): ImageConversationStatus {
  switch (status) {
    case "queued": return "queued";
    case "running":
    case "cancel_requested": return "running";
    case "cancelled": return "cancelled";
    case "failed":
    case "expired": return "error";
    case "succeeded": return "success";
    default: return "success";
  }
}

function mapTaskImagesToStoredImages(images: ImageTaskView["images"]): StoredImage[] {
  return images.map((image, index) => ({
    id: image.file_id || image.gen_id || `task-image-${index}`,
    status: image.error && !image.b64_json && !image.url ? "error" : image.b64_json || image.url ? "success" : "loading",
    b64_json: image.b64_json,
    url: image.url,
    revised_prompt: image.revised_prompt,
    file_id: image.file_id,
    gen_id: image.gen_id,
    conversation_id: image.conversation_id,
    parent_message_id: image.parent_message_id,
    source_account_id: image.source_account_id,
    error: image.error,
  }));
}

function mergeRetryImageResult(currentImages: StoredImage[], taskImages: StoredImage[], retryImageIndex: number) {
  if (retryImageIndex < 0) return currentImages;
  return currentImages.map((image, index) => (index === retryImageIndex ? (taskImages[0] ?? image) : image));
}

function isActiveImageTaskStatus(status: string) {
  return status === "queued" || status === "running" || status === "cancel_requested";
}

function isFinalImageTaskStatus(status: string) {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "expired";
}

function selectPreferredTaskForTurn(turn: ImageConversationTurn, tasks: ImageTaskView[]) {
  if (tasks.length === 0) return null;
  const boundTask = turn.taskId ? tasks.find((candidate) => candidate.id === turn.taskId) ?? null : null;
  if (boundTask && !isFinalImageTaskStatus(boundTask.status)) return boundTask;
  const latestActiveTask = tasks.filter((candidate) => isActiveImageTaskStatus(candidate.status)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  if (latestActiveTask) return latestActiveTask;
  const latestNonCancelledTask = [...tasks].filter((candidate) => candidate.status !== "cancelled").sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  if (latestNonCancelledTask) return latestNonCancelledTask;
  if (boundTask) return boundTask;
  return tasks[tasks.length - 1] ?? null;
}

function deriveTurnStatusFromImages(images: StoredImage[], taskStatus: string): ImageConversationStatus {
  if (images.some((image) => image.status === "loading")) return taskStatus === "queued" ? "queued" : "running";
  if (images.some((image) => image.status === "error")) return "error";
  if (images.length > 0 && images.every((image) => image.status === "success")) return "success";
  return mapTaskStatusToTurnStatus(taskStatus);
}

export function applyTaskViewToConversation(conversation: ImageConversation, tasksByTurnKey: Map<string, ImageTaskView[]>) {
  const turns = (conversation.turns ?? []).map((turn) => {
    const tasks = tasksByTurnKey.get(`${conversation.id}:${turn.id}`) ?? [];
    const task = selectPreferredTaskForTurn(turn, tasks);
    if (!task) return turn;
    const mappedTaskImages = task.images.length > 0 ? mapTaskImagesToStoredImages(task.images) : [];
    const mergedImages = typeof task.retryImageIndex === "number" ? mergeRetryImageResult(turn.images, mappedTaskImages, task.retryImageIndex) : mappedTaskImages.length > 0 ? mappedTaskImages : turn.images;
    const mergedStatus = deriveTurnStatusFromImages(mergedImages, task.status);
    const mergedError = mergedStatus === "error" ? task.error || turn.error : undefined;
    return {
      ...turn,
      taskId: task.id,
      status: mergedStatus,
      queuePosition: task.queuePosition,
      waitingReason: task.waitingReason,
      waitingDetail: task.blockers?.[0]?.detail,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      cancelRequested: task.cancelRequested,
      error: mergedError,
      images: mergedImages,
    };
  });
  return normalizeConversation({ ...conversation, turns });
}

export function buildProcessingStatus(mode: ImageMode, elapsedSeconds: number, count: number, variant: string) {
  if (mode === "generate") {
    if (elapsedSeconds < 4) return { title: "正在提交生成请求", detail: `已进入图像生成队列，本次目标 ${count} 张` };
    if (elapsedSeconds < 12) return { title: "正在排队创建画面", detail: "模型正在准备构图与风格细节" };
    return { title: "模型正在生成图片", detail: "通常需要 1 到 5 分钟，请保持页面开启" };
  }
  if (elapsedSeconds < 4) return { title: variant === "selection-edit" ? "正在提交选区编辑" : "正在提交编辑请求", detail: "请求已发送，正在准备处理素材" };
  if (elapsedSeconds < 12) return { title: variant === "selection-edit" ? "正在上传源图和选区" : "正在上传编辑素材", detail: "素材上传完成后会立即进入改图阶段" };
  return { title: variant === "selection-edit" ? "模型正在按选区修改图片" : "模型正在编辑图片", detail: "通常需要 1 到 5 分钟，请保持页面开启" };
}

export function getImageResolutionOptions(aspectRatio: ImageAspectRatio) {
  if (aspectRatio === "auto") return imageAutoResolutionPresets;
  return imageResolutionPresets[aspectRatio] || [];
}
