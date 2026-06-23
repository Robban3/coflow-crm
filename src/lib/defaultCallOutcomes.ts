// Default call outcomes, used as a fallback when an organization has no rows in
// call_outcomes yet. The defaults were only seeded for orgs that existed at the
// seed migration (20260217143010), so newer orgs would otherwise see an empty
// outcome picker in both "Logga samtal" and Power Call. call_logs stores the
// outcome key/label as text, so these save correctly without a matching DB row.
export interface DefaultCallOutcome {
  id: string;
  key: string;
  label: string;
  category: string;
  requires_note: boolean;
  requires_task: boolean;
  lead_status_effect: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export const DEFAULT_CALL_OUTCOMES: DefaultCallOutcome[] = [
  { id: "no_answer", key: "no_answer", label: "Ej svar", category: "neutral", requires_note: false, requires_task: false, lead_status_effect: null, icon: "phone-missed", color: "slate", sort_order: 1 },
  { id: "callback", key: "callback", label: "Återkoppling", category: "neutral", requires_note: false, requires_task: true, lead_status_effect: null, icon: "calendar-clock", color: "amber", sort_order: 2 },
  { id: "answered", key: "answered", label: "Svar", category: "positive", requires_note: true, requires_task: false, lead_status_effect: null, icon: "message-square", color: "green", sort_order: 3 },
  { id: "not_interested", key: "not_interested", label: "Ej intresserad", category: "negative", requires_note: true, requires_task: false, lead_status_effect: "not_interested", icon: "x-circle", color: "red", sort_order: 4 },
  { id: "booked", key: "booked", label: "Bokad", category: "positive", requires_note: true, requires_task: false, lead_status_effect: null, icon: "calendar-check", color: "green", sort_order: 5 },
  { id: "wrong_number", key: "wrong_number", label: "Nummer fel", category: "negative", requires_note: true, requires_task: false, lead_status_effect: "invalid_phone", icon: "phone-off", color: "red", sort_order: 6 },
];
