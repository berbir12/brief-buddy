import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validatePasswordStrength } from "./authSecurity";

describe("validatePasswordStrength", () => {
  test("rejects passwords shorter than minimum length", () => {
    assert.equal(validatePasswordStrength("Abc123xyz"), "Password must be at least 10 characters.");
  });

  test("rejects passwords without lowercase letters", () => {
    assert.equal(validatePasswordStrength("PASSWORD1234"), "Password must include a lowercase letter.");
  });

  test("rejects passwords without uppercase letters", () => {
    assert.equal(validatePasswordStrength("password1234"), "Password must include an uppercase letter.");
  });

  test("rejects passwords without numbers", () => {
    assert.equal(validatePasswordStrength("PasswordOnly"), "Password must include a number.");
  });

  test("accepts passwords that satisfy all requirements", () => {
    assert.equal(validatePasswordStrength("StrongPass123"), null);
  });
});
