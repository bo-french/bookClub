const API_URL = typeof window !== 'undefined'
  ? (window as any).__ENV__?.BUN_PUBLIC_API_URL || 'http://localhost:4000'
  : process.env.BUN_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiClient(path: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// --- Nominations ---

export interface NominationWindow {
  id: number;
  opened_by: number;
  deadline: string;
  created_at: string;
  is_active: boolean;
}

export interface Nomination {
  id: number;
  title: string;
  author: string;
  summary: string;
  pitch: string | null;
  created_at: string;
  nominated_by_clerk_id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface CurrentWindowResponse {
  window: NominationWindow | null;
  nominations: Nomination[];
}

export function getCurrentWindow(token: string): Promise<CurrentWindowResponse> {
  return apiClient('/nomination-windows/current', {}, token);
}

export function openNominationWindow(token: string, deadline: string): Promise<CurrentWindowResponse> {
  return apiClient('/nomination-windows', {
    method: 'POST',
    body: JSON.stringify({ deadline }),
  }, token);
}

export function submitNomination(
  token: string,
  data: { title: string; author: string; summary: string; pitch?: string }
): Promise<Nomination> {
  return apiClient('/nominations', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}
