import { test, expect, type Page } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./fixtures/test-user";

async function signIn(page: Page) {
  await page.goto("/auth/signin");
  await page.getByLabel("Email", { exact: true }).fill(TEST_USER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("real login and middleware allow/deny (Risk #3)", () => {
  test("a real login establishes a session and reaches the protected dashboard", async ({ page }) => {
    await signIn(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Weekly planning dashboard")).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  });

  test("an authenticated request to a protected API route gets past middleware's 401 gate", async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Deliberately minimal/invalid body: this proves the request reached the
    // route's own validation (a 400), not that generation succeeded — a full
    // 200 belongs to test-plan.md Phase 2's seam test, not this one.
    const response = await page.request.post("/api/plans/generate", { data: {} });

    expect(response.status()).toBe(400);
  });

  test("an unauthenticated request to the same protected API route is rejected with 401", async ({ request }) => {
    const response = await request.post("/api/plans/generate", { data: {} });

    expect(response.status()).toBe(401);
  });
});
