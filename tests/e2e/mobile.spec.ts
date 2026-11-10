import { chooseSlot, dayFromToday, expect, fillDetails, test } from "./fixtures";

const D4 = dayFromToday(4);

test("mobile: menu, layout and a full booking with the bottom bar", async ({ page, consoleErrors }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.locator("#mobile-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "About Us" })).toBeVisible();
  await menu.getByRole("link", { name: "Court Rentals" }).click();
  await expect(menu).toBeHidden();

  // Phones get rate-card cards instead of the table.
  await expect(page.locator("#pricing table")).toBeHidden();
  await expect(page.locator("#pricing li", { hasText: "Wooden Finish (2.5 mm)" })).toContainText("₹16,500");

  await page.goto("/#book");
  await chooseSlot(page, { sport: "Badminton", court: "Badminton Court 2", date: D4, duration: "1 hour", start: "8:00 AM" });
  // Nothing in the booking flow may be wider than the screen (the date strip scrolls inside itself).
  const tooWide = await page.evaluate(() => [...document.querySelectorAll("#book *")].filter((el) => el.getBoundingClientRect().width > window.innerWidth).map((el) => el.tagName));
  expect(tooWide).toEqual([]);
  const bar = page.getByRole("region", { name: "Selected slot" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Badminton Court 2");
  await bar.getByRole("button", { name: "Continue" }).click();

  await fillDetails(page, { name: "Ravi Kumar", email: "ravi@example.com", phone: "+91 90000 12345" });
  const review = page.getByRole("dialog", { name: "Review booking" });
  const box = await review.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  expect(box!.width).toBeLessThanOrEqual(vp.width);
  await page.getByRole("button", { name: /Pay ₹400 securely/ }).click();
  await page.getByRole("dialog", { name: /Razorpay Checkout/ }).getByRole("button", { name: "Pay" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Booking confirmed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(consoleErrors).toEqual([]);
});
