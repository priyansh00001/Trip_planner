// src/lib/anonymousState.ts
export const ANON_STATE_KEY = "anonymous_trip";

export interface AnonymousState {
  tripId?: string;
  source?: string;
  originCity?: string;
  origin_city?: string;
  destination?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  duration_days?: number;
  budget?: string;
  budget_range?: string;
  preference?: string;
  travelers?: string;
  transport?: any;
  selected_transport?: any;
  transport_cost_inr?: number;
  remaining_budget_inr?: number;
  hotel?: any;
  places?: any[];
  plan_data?: any;
  status?: string;
  lastCompletedStep?: string; // e.g. 'trip-input', 'select-transport', 'select-stay', 'pick-places'
}

export function getAnonState(): AnonymousState | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(ANON_STATE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveAnonState(state: Partial<AnonymousState>) {
  if (typeof window === "undefined") return;
  const existing = getAnonState() || {};
  const merged = { ...existing, ...state };
  localStorage.setItem(ANON_STATE_KEY, JSON.stringify(merged));
}

export function clearAnonState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ANON_STATE_KEY);
}

// Ensure login URL retains context
export function getLoginUrlWithNext(currentPath: string): string {
  return `/login?next=${encodeURIComponent(currentPath)}`;
}
