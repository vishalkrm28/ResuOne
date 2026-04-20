import { createClerkClient, verifyToken } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { initFreeCredits } from "../lib/credits.js";
import { logger } from "../lib/logger.js";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

function extractToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const sessionCookie = req.cookies?.["__session"];
  if (sessionCookie) return sessionCookie;
  return null;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  let userId: string;
  try {
    // Use the PEM public key stored in CLERK_JWT_KEY so verification works
    // fully offline — no secret key or JWKS network request needed.
    const payload = await verifyToken(token, {
      jwtKey: process.env.CLERK_JWT_KEY,
    });
    userId = payload.sub;
  } catch (err) {
    req.log?.warn(
      { err: (err as Error).message, path: req.path },
      "authMiddleware: token verification failed",
    );
    next();
    return;
  }

  try {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (existingUser) {
      // If email is missing, refresh the profile from Clerk and patch the DB row
      if (!existingUser.email) {
        try {
          const clerkUser = await clerk.users.getUser(userId);
          const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
          const firstName = clerkUser.firstName ?? null;
          const lastName = clerkUser.lastName ?? null;
          const profileImageUrl = clerkUser.imageUrl ?? null;
          if (email) {
            await db.update(usersTable).set({ email, firstName, lastName, profileImageUrl, updatedAt: new Date() }).where(eq(usersTable.id, userId));
            existingUser.email = email;
            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.profileImageUrl = profileImageUrl;
          }
        } catch (profileSyncErr) {
          logger.warn({ profileSyncErr, userId }, "Non-fatal: failed to sync Clerk profile to DB — auth proceeds with cached data");
        }
      }
      req.user = {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        profileImageUrl: existingUser.profileImageUrl,
      };
    } else {
      // Try to fetch full profile from Clerk; if secretKey is invalid, fall
      // back to a minimal record so the user can still be authenticated.
      let email: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let profileImageUrl: string | null = null;

      try {
        const clerkUser = await clerk.users.getUser(userId);
        email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
        firstName = clerkUser.firstName ?? null;
        lastName = clerkUser.lastName ?? null;
        profileImageUrl = clerkUser.imageUrl ?? null;
      } catch (profileErr) {
        req.log?.warn(
          { err: (profileErr as Error).message, userId },
          "authMiddleware: could not fetch Clerk profile — using empty fields",
        );
      }

      // Check if a row already exists with this email but a different Clerk ID
      // (e.g. dev → production Clerk instance migration where the same Google
      // account receives a new Clerk user ID in the production environment).
      if (email) {
        const [existingByEmail] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (existingByEmail && existingByEmail.id !== userId) {
          const oldId = existingByEmail.id;
          req.log?.info(
            { oldId, newClerkId: userId, email },
            "authMiddleware: email match found with different Clerk ID — re-keying user",
          );

          // Re-key the user: migrate all data from the old DB id to the new
          // Clerk id so that every subsequent login resolves by ID.
          // Steps:
          //  1. Temporarily blank the old row's email to release the unique constraint
          //  2. Insert a new users row with the new Clerk ID and real email
          //  3. Move all child table rows to the new ID
          //  4. Delete the old users row
          // Capture stripe fields before we touch the old row
          const oldRowResult = await db.execute(sql`
            SELECT stripe_customer_id, stripe_subscription_id, subscription_status,
                   subscription_price_id, current_period_end, created_at
            FROM users WHERE id = ${oldId}
          `);
          const oldRow = oldRowResult.rows[0];

          // Release all unique constraints on old row before creating the new one
          await db.execute(sql`
            UPDATE users
            SET email              = 'migrating_' || id || '@tmp.parsepilot.internal',
                stripe_customer_id = NULL,
                stripe_subscription_id = NULL
            WHERE id = ${oldId}
          `);

          const oldFields = oldRow as Record<string, unknown>;

          await db.execute(sql`
            INSERT INTO users
              (id, email, first_name, last_name, profile_image_url,
               stripe_customer_id, stripe_subscription_id, subscription_status,
               subscription_price_id, current_period_end, created_at, updated_at)
            VALUES (
              ${userId}, ${email}, ${firstName}, ${lastName}, ${profileImageUrl},
              ${oldFields["stripe_customer_id"] ?? null},
              ${oldFields["stripe_subscription_id"] ?? null},
              ${(oldFields["subscription_status"] as string) ?? null},
              ${(oldFields["subscription_price_id"] as string) ?? null},
              ${oldFields["current_period_end"] ?? null},
              ${oldFields["created_at"] ?? null},
              NOW()
            )
            ON CONFLICT (id) DO NOTHING
          `);

          // Move child rows
          await db.execute(sql`UPDATE applications           SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE bulk_sessions           SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE bulk_passes             SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE contact_messages        SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE unlock_purchases        SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE usage_balances          SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE usage_events            SET user_id = ${userId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE user_identity_profiles  SET user_id = ${userId} WHERE user_id = ${oldId}`);

          // Delete the old users row (no children reference it anymore)
          await db.execute(sql`DELETE FROM users WHERE id = ${oldId}`);

          req.log?.info({ oldId, newId: userId }, "authMiddleware: user re-key complete");

          req.user = {
            id: userId,
            email,
            firstName,
            lastName,
            profileImageUrl,
          };
          next();
          return;
        }
      }

      const userData = { id: userId, email, firstName, lastName, profileImageUrl };

      const [newUser] = await db
        .insert(usersTable)
        .values(userData)
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { ...userData, updatedAt: new Date() },
        })
        .returning();

      await initFreeCredits(newUser.id);

      req.user = {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        profileImageUrl: newUser.profileImageUrl,
      };
    }
  } catch (err) {
    req.log?.error({ err }, "authMiddleware: failed to upsert Clerk user");
  }

  next();
}
