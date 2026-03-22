import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIntegrationStatusRows } from "./status";

test("buildIntegrationStatusRows marks missing provider as not_connected", () => {
  const rows = buildIntegrationStatusRows([], ["google"]);
  assert.equal(rows[0]?.status, "not_connected");
  assert.equal(rows[0]?.requiresReconnect, false);
});

test("buildIntegrationStatusRows marks expired token as reconnect_required", () => {
  const now = Date.parse("2026-03-22T12:00:00.000Z");
  const rows = buildIntegrationStatusRows(
    [
      {
        provider: "google",
        status: "connected",
        expiresAt: new Date("2026-03-22T11:00:00.000Z"),
        lastError: null,
        lastSyncedAt: new Date("2026-03-22T10:00:00.000Z")
      }
    ],
    ["google"],
    now
  );
  assert.equal(rows[0]?.status, "reconnect_required");
  assert.equal(rows[0]?.connected, false);
  assert.equal(rows[0]?.requiresReconnect, true);
});

test("buildIntegrationStatusRows preserves healthy connected status", () => {
  const now = Date.parse("2026-03-22T12:00:00.000Z");
  const rows = buildIntegrationStatusRows(
    [
      {
        provider: "slack",
        status: "connected",
        expiresAt: null,
        lastError: null,
        lastSyncedAt: new Date("2026-03-22T11:30:00.000Z")
      }
    ],
    ["slack"],
    now
  );
  assert.equal(rows[0]?.status, "connected");
  assert.equal(rows[0]?.connected, true);
  assert.equal(rows[0]?.requiresReconnect, false);
});
