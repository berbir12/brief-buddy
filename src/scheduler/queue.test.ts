import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBriefingJobId } from "./jobIds";

test("buildBriefingJobId uses daily bucket for non-alert modes", () => {
  const now = new Date("2026-03-22T10:15:00.000Z");
  const id = buildBriefingJobId("user-1", "morning", now);
  assert.equal(id, "briefing:user-1:morning:2026-03-22");
});

test("buildBriefingJobId uses 15-minute bucket for alert mode", () => {
  const now = new Date("2026-03-22T10:16:00.000Z");
  const bucket = Math.floor(now.getTime() / (15 * 60 * 1000));
  const id = buildBriefingJobId("user-1", "alert", now);
  assert.equal(id, `briefing:user-1:alert:alert-${bucket}`);
});
