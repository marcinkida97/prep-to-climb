import { expect, test, type Page } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./fixtures/test-user";

async function signIn(page: Page) {
  await page.goto("/auth/signin");
  await page.getByLabel("Email", { exact: true }).fill(TEST_USER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

// The e2e test user may already have a saved plan from a previous local run (the
// dashboard opens on the saved plan first in that case) — "Regenerate" reopens the
// wizard from a clean step 1 either way, so this helper works for both first-run and
// returning-user states.
async function openQuestionnaireWizard(page: Page) {
  const regenerateButton = page.getByRole("button", { name: "Regenerate this weekly plan" });
  if (await regenerateButton.isVisible().catch(() => false)) {
    await regenerateButton.click();
  }
  await expect(page.getByText(/Step 1 of 3/)).toBeVisible();
}

test.describe("questionnaire wizard flow (Risk: MS-04 multi-step wizard)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openQuestionnaireWizard(page);
  });

  test("Next is blocked when the current step has a missing required field", async ({ page }) => {
    await page.getByLabel("Current climbing grade").selectOption("");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Choose your current climbing grade before generating a plan.")).toBeVisible();
    await expect(page.getByText(/Step 1 of 3/)).toBeVisible();
  });

  test("back navigation preserves data entered on earlier and later steps", async ({ page }) => {
    await page.getByLabel("Current climbing grade").selectOption("6B");
    await page.getByLabel("Training age").selectOption("2_plus_years");
    await page.getByLabel("Sessions per week").fill("3");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText(/Step 2 of 3/)).toBeVisible();
    await page.getByLabel("Primary goal").selectOption("general_fitness");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText(/Step 1 of 3/)).toBeVisible();
    await expect(page.getByLabel("Current climbing grade")).toHaveValue("6B");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Step 2 of 3/)).toBeVisible();
    await expect(page.getByLabel("Primary goal")).toHaveValue("general_fitness");
  });

  test("completing all three steps submits and reaches the generated plan", async ({ page }) => {
    await page.getByLabel("Current climbing grade").selectOption("6B");
    await page.getByLabel("Training age").selectOption("2_plus_years");
    await page.getByLabel("Sessions per week").fill("3");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Primary goal").selectOption("general_fitness");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText(/Step 3 of 3/)).toBeVisible();
    await page.getByRole("button", { name: "Generate weekly plan" }).click();

    await expect(page.getByText("Your saved weekly plan is ready to train from.")).toBeVisible();
  });
});
