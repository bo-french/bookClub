const API_URL = process.env.BUN_PUBLIC_API_URL || 'http://localhost:4000';

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

// --- Voting ---

export interface VotingWindow {
  id: number;
  nomination_window_id: number;
  opened_by: number;
  deadline: string;
  created_at: string;
  is_active: boolean;
}

export interface NomineeWithVotes extends Nomination {
  vote_count: number; // first-choice votes
}

export interface IrvResult {
  winner_id: number | null;
}

export interface CurrentVotingResponse {
  voting_window: VotingWindow | null;
  nomination_window: { id: number; deadline: string; is_active: boolean } | null;
  nominees: NomineeWithVotes[];
  user_rankings: { nomination_id: number; rank: number }[] | null;
  voter_count: number;
  irv_result: IrvResult | null;
}

export function getCurrentVotingWindow(token: string): Promise<CurrentVotingResponse> {
  return apiClient('/voting-windows/current', {}, token);
}

export function openVotingWindow(token: string, deadline: string): Promise<{ voting_window: VotingWindow }> {
  return apiClient('/voting-windows', {
    method: 'POST',
    body: JSON.stringify({ deadline }),
  }, token);
}

export function castVote(
  token: string,
  rankings: { nomination_id: number; rank: number }[]
): Promise<{ success: boolean }> {
  return apiClient('/votes', {
    method: 'POST',
    body: JSON.stringify({ rankings }),
  }, token);
}

// --- Past Results ---

export interface PastVotingCycle {
  voting_window: VotingWindow;
  nomination_window: { id: number; deadline: string; created_at: string };
  nominees: NomineeWithVotes[];
}

export interface PastVotingResponse {
  cycles: PastVotingCycle[];
}

export function getPastVotingResults(token: string): Promise<PastVotingResponse> {
  return apiClient('/voting-windows/past', {}, token);
}

// --- Books ---

export function getBookCoverUrl(
  token: string,
  title: string,
  author: string
): Promise<{ cover_url: string | null }> {
  const params = new URLSearchParams({ title, author });
  return apiClient(`/books/cover?${params}`, {}, token);
}

export function closeNominationWindowEarly(token: string, id: number): Promise<{ window: NominationWindow }> {
  return apiClient(`/nomination-windows/${id}/close`, { method: 'POST' }, token);
}

export function cancelNominationWindow(token: string, id: number): Promise<{ success: boolean }> {
  return apiClient(`/nomination-windows/${id}/cancel`, { method: 'POST' }, token);
}

export function closeVotingWindowEarly(token: string, id: number): Promise<{ voting_window: VotingWindow }> {
  return apiClient(`/voting-windows/${id}/close`, { method: 'POST' }, token);
}

export function cancelVotingWindow(token: string, id: number): Promise<{ success: boolean }> {
  return apiClient(`/voting-windows/${id}/cancel`, { method: 'POST' }, token);
}
