import { test, expect } from "../playwright-fixture";

test.describe("auth entrypoints", () => {
  test("landing page links to auth flow", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Brief Buddy/i);

    const signInLink = page.getByRole("link", { name: /^sign in$/i }).first();
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("heading", { name: /welcome to brief buddy/i })).toBeVisible();
  });
});
