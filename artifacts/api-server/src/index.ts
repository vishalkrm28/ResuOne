import { validateEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import app from "./app.js";

// ── Environment validation — runs before server starts listening ───────────────
// Log actionable messages for missing vars; exit with code 1 so the process
// manager (Replit workflow) surfaces the reason clearly.
const env = validateEnv();
if (!env.valid) {
  logger.fatal(
    { missing: env.missing },
    "Server startup aborted: fix the environment variables listed above, then restart.",
  );
  process.exit(1);
}

// ── PORT ──────────────────────────────────────────────────────────────────────
const rawPort = process.env["PORT"]!; // already validated by validateEnv()
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.fatal({ rawPort }, "Invalid PORT value — must be a positive integer");
  process.exit(1);
}

// ── Start listening ───────────────────────────────────────────────────────────
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port,
      billingEnabled: env.billingConfigured,
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
    "Server listening",
  );
});

// ── Process-level error guards ────────────────────────────────────────────────
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — server will exit");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
