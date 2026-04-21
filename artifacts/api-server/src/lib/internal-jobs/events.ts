import { db, internalJobApplicationEventsTable } from "@workspace/db";
import type { INTERNAL_JOB_EVENT_TYPE, INTERNAL_JOB_ACTOR_TYPE } from "@workspace/db";
import { logger } from "../logger.js";

type EventType = (typeof INTERNAL_JOB_EVENT_TYPE)[number];
type ActorType = (typeof INTERNAL_JOB_ACTOR_TYPE)[number];

interface CreateEventParams {
  applicationId: string;
  actorType: ActorType;
  actorUserId?: string;
  eventType: EventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function createApplicationEvent(params: CreateEventParams): Promise<void> {
  try {
    await db.insert(internalJobApplicationEventsTable).values({
      applicationId: params.applicationId,
      actorType: params.actorType,
      actorUserId: params.actorUserId ?? null,
      eventType: params.eventType,
      title: params.title,
      description: params.description ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    logger.error({ err, params }, "Failed to create application event");
  }
}

export async function getApplicationEvents(applicationId: string) {
  return db
    .select()
    .from(internalJobApplicationEventsTable)
    .where(
      (await import("drizzle-orm")).eq(
        internalJobApplicationEventsTable.applicationId,
        applicationId,
      ),
    )
    .orderBy(internalJobApplicationEventsTable.createdAt);
}
