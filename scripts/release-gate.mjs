import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function runCheck(label, command, args, cwd = process.cwd()) {
  process.stdout.write(`\n[release-gate] ${label}\n`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.stderr.write(`\n[release-gate] failed: ${label}\n`);
    process.exit(result.status ?? 1);
  }
}

function ensureNoPlaceholderLegalCopy() {
  const files = [
    "frontend/src/pages/PrivacyPage.tsx",
    "frontend/src/pages/TermsPage.tsx"
  ];
  for (const file of files) {
    const content = readFileSync(resolve(file), "utf8");
    if (content.includes("template is provided for operational readiness")) {
      throw new Error(`Placeholder legal copy still exists in ${file}.`);
    }
  }
}

function ensureSecureProductionDefaults() {
  const envExample = readFileSync(resolve(".env.example"), "utf8");
  const insecureDefaults = [
    { key: "AUTH_DEV_RETURN_VERIFICATION_TOKEN", expected: "false" },
    { key: "AUTH_DEV_LOG_VERIFICATION_LINK", expected: "false" },
    { key: "AUTH_RATE_LIMIT_FAIL_OPEN", expected: "false" }
  ];
  for (const item of insecureDefaults) {
    const expectedLine = `${item.key}=${item.expected}`;
    if (!envExample.includes(expectedLine)) {
      throw new Error(`Expected ${expectedLine} in .env.example`);
    }
  }
}

function main() {
  runCheck("Backend typecheck", "npm", ["run", "typecheck"]);
  runCheck("Backend tests", "npm", ["run", "test"]);
  runCheck("Backend build", "npm", ["run", "build"]);

  const frontendDir = resolve("frontend");
  runCheck("Frontend lint", "npm", ["run", "lint"], frontendDir);
  runCheck("Frontend tests", "npm", ["run", "test"], frontendDir);
  runCheck("Frontend build", "npm", ["run", "build"], frontendDir);

  process.stdout.write("\n[release-gate] Validating launch policy checks\n");
  ensureSecureProductionDefaults();
  ensureNoPlaceholderLegalCopy();

  process.stdout.write("\n[release-gate] All checks passed.\n");
}

main();
