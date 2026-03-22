import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./passwords";

test("hashPassword creates verifiable salted hash", () => {
  const password = "StrongPass123";
  const hashA = hashPassword(password);
  const hashB = hashPassword(password);

  assert.notEqual(hashA, hashB, "salted hashes should differ");
  assert.ok(verifyPassword(password, hashA));
  assert.ok(verifyPassword(password, hashB));
  assert.equal(verifyPassword("WrongPass123", hashA), false);
});
