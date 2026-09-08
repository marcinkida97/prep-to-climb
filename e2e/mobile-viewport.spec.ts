import { expect, test, type Page } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./fixtures/test-user";

const VIEWPORTS = [
  { name: "320x568 (mobile)", width: 320, height: 568 },
  { name: "375x667 (mobile)", width: 375, height: 667 },
  { name: "768x1024 (tablet)", width: 768, height: 1024 },
];

async function signIn(page: Page) {
  await page.goto("/auth/signin");
  await page.getByLabel("Email", { exact: true }).fill(TEST_USER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openQuestionnaireWizard(page: Page) {
  const regenerateButton = page.getByRole("button", { name: "Regenerate this weekly plan" });
  if (await regenerateButton.isVisible().catch(() => false)) {
    await regenerateButton.click();
  }
  await expect(page.getByText(/Step 1 of 3/)).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: window.innerWidth,
  }));

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe("mobile/tablet viewport correctness", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("landing page has no horizontal scroll", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { name: "PrepToClimb" })).toBeVisible();
        await expectNoHorizontalScroll(page);
      });

      test("dashboard has no horizontal scroll", async ({ page }) => {
        await signIn(page);

        await expectNoHorizontalScroll(page);
      });

      test("questionnaire wizard has no horizontal scroll", async ({ page }) => {
        await signIn(page);
        await openQuestionnaireWizard(page);

        await expectNoHorizontalScroll(page);
      });
    });
  }
});
