import { expect, type Page } from "@playwright/test";

/**
 * Pick a fixture user in the Dev toolbar. The toolbar is server-rendered with
 * only "Guest"; the user list arrives after hydration, so wait for the option
 * instead of reading the list once.
 */
export async function switchUser(page: Page, label: string | RegExp) {
  await expect(page.getByText("Dev · Switch user")).toBeVisible();
  const toolbarSelect = page.locator("div.fixed.bottom-0 select");
  const option = toolbarSelect.locator("option", { hasText: label }).first();
  await expect(option).toBeAttached({ timeout: 20_000 });
  const value = await option.getAttribute("value");
  if (value == null) throw new Error(`User option has no value: ${label}`);
  await toolbarSelect.selectOption(value);
  await expect(toolbarSelect).toHaveValue(value);
}
