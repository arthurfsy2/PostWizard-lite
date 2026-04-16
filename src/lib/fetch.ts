/**
 * 简化的 fetch 工具（开源版去除认证）
 * 用于替换原 authenticatedFetch
 */

const API_BASE = "";

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  return res.json();
}

export async function apiPost<T>(url: string, data: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiPut<T>(url: string, data: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDelete(url: string): Promise<void> {
  await apiFetch(url, { method: "DELETE" });
}
