import { test, expect } from "@playwright/test";

test.describe("the public Equipment page", () => {
  test("a visitor sees the shop's approved equipment with its picture, and nothing unapproved or private", async ({
    page,
  }) => {
    await page.goto("/equipment");
    await expect(page.getByRole("heading", { name: "In the shop" })).toBeVisible({
      timeout: 15_000,
    });

    // Approved, in the woodshop, with a front photo.
    const woodshop = page.getByRole("region", {
      name: "Woodshop (incl. hand tools & stained glass)",
    });
    await expect(woodshop.getByText("Orbital sander")).toBeVisible();
    await expect(woodshop.getByText("DeWalt DWE6423")).toBeVisible();
    await expect(woodshop.getByText("× 12")).toBeVisible();
    const photo = woodshop.getByRole("img", { name: "Orbital sander: DeWalt DWE6423" });
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);

    // Pending review, and retired.
    await expect(page.getByText("Jigsaw")).toHaveCount(0);
    await expect(page.getByText("Swing-away heat press")).toHaveCount(0);
    await expect(page.getByText("Contractor table saw")).toHaveCount(0);

    // What only members, stewards and staff see.
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("DW6423-88421");
    expect(text).not.toContain("Bay A shelf");
    expect(text).not.toMatch(/BX-\d{5}/);
  });
});
