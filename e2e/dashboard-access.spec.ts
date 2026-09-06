import { test, expect } from "@playwright/test";

test.describe("protected dashboard access", () => {
  test("redirects unauthenticated visitors to sign-in", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in NOPE" })).toBeVisible();
  });
});
