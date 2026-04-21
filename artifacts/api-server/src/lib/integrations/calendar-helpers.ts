// ─── Calendar Integration Helpers ────────────────────────────────────────────
// Uses @replit/connectors-sdk to proxy authenticated requests to Google Calendar.

import { ReplitConnectors } from "@replit/connectors-sdk";

export type CalendarProvider = "google" | "outlook" | "internal";

export type CalendarEventPayload = {
  title: string;
  scheduledAt: string;
  timezone: string;
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
  interviewId: string;
  applicationId?: string | null;
};

// ─── buildCalendarEventPayload ────────────────────────────────────────────────

export function buildCalendarEventPayload(input: CalendarEventPayload): Record<string, unknown> {
  return {
    summary: input.title,
    start: { dateTime: input.scheduledAt, timeZone: input.timezone },
    end: {
      dateTime: new Date(new Date(input.scheduledAt).getTime() + 60 * 60 * 1000).toISOString(),
      timeZone: input.timezone,
    },
    location: input.location ?? undefined,
    description: [
      input.notes ?? "",
      input.meetingUrl ? `Meeting link: ${input.meetingUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    extendedProperties: {
      private: {
        resuoneInterviewId: input.interviewId,
        resuoneApplicationId: input.applicationId ?? "",
      },
    },
  };
}

// ─── normalizeCalendarStatus ──────────────────────────────────────────────────

export function normalizeCalendarStatus(
  providerStatus: string | null | undefined,
): "pending" | "synced" | "failed" {
  if (!providerStatus) return "pending";
  if (providerStatus === "confirmed" || providerStatus === "accepted") return "synced";
  if (providerStatus === "cancelled" || providerStatus === "error") return "failed";
  return "pending";
}

// ─── providerSupportsCalendarSync ─────────────────────────────────────────────

export function providerSupportsCalendarSync(provider: string): boolean {
  return provider === "google";
}

// ─── createGoogleCalendarEvent ────────────────────────────────────────────────
// Uses the Replit connectors SDK — OAuth tokens are managed automatically.

export async function createGoogleCalendarEvent(
  payload: Record<string, unknown>,
): Promise<{ externalEventId: string | null; synced: boolean; error?: string }> {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy(
      "google-calendar",
      "/calendars/primary/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return { externalEventId: null, synced: false, error: text };
    }

    const data = await response.json() as { id?: string };
    return { externalEventId: data.id ?? null, synced: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { externalEventId: null, synced: false, error: message };
  }
}
