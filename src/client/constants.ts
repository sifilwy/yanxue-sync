import type { ReportStatus } from "../shared/types";

export const profileStorageKey = "yanxue-sync-profile";

export const statusLabels: Record<ReportStatus, string> = {
  open: "未处理",
  processing: "处理中",
  done: "已处理"
};
