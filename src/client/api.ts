import type { BootstrapData, Report, ReportStatus, Role } from "../shared/types";

function getApiBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;

  const { protocol, hostname, port } = window.location;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "5173") {
    return "http://localhost:4000";
  }

  return `${protocol}//${window.location.host}`;
}

export const apiBase = getApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<T>;
}

export function getBootstrap() {
  return request<BootstrapData>("/api/bootstrap");
}

export function createReport(input: {
  reporterName: string;
  reporterRole: Role;
  sessionId: string;
  teamId?: string;
  pointId?: string;
  category: string;
  content: string;
  imageUrls: string[];
  isUrgent: boolean;
  affectsSettlement: boolean;
}) {
  return request<Report>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getReports(filters: {
  sessionId?: string;
  role?: string;
  category?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters.sessionId) params.set("sessionId", filters.sessionId);
  if (filters.role) params.set("role", filters.role);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);

  return request<Report[]>(`/api/reports?${params.toString()}`);
}

export function updateReportStatus(id: string, status: ReportStatus) {
  return request<Report>(`/api/reports/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}
