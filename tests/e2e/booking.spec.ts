import { chooseSlot, dayFromToday, expect, fillDetails, test, webhookSignature } from "./fixtures";
import { fakePay } from "../fake-razorpay";
import { E2E } from "../../playwright.config";

const D2 = dayFromToday(2);
const D3 = dayFromToday(3);

test.describe.configure({ mode: "serial" });

test("home page: hero, five courts with live availability, no errors or overflow", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Your game\.\s*Your court\./i);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Book a Court" })).toBeVisible();
  const cards = page.locator("#courts article");
  await expect(cards).toHaveCount(5);
  for (const name of ["Badminton Court 1", "Badminton Court 2", "Pickleball Court 1", "Pickleball Court 2", "Basketball Court 1"]) {
    await expect(page.locator("#courts").getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.locator("#courts article img")).toHaveCount(5);
  for (const img of await page.locator("#courts article img").all()) expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 || !el.complete)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Privacy policy" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("badminton academy closure is shown and enforced; other sports stay open", async ({ page, request }) => {
  await page.goto("/#book");
  const book = page.locator("#book");
  await book.getByRole("group", { name: "Sport" }).getByRole("button", { name: /Badminton/ }).click();
  await book.locator(`[data-date="${D2}"]`).click();
  for (const t of ["5:00 PM", "6:00 PM"]) {
    const slot = book.getByRole("button", { name: new RegExp(`^${t} to`) });
    await expect(slot).toBeDisabled();
    await expect(slot).toContainText("Academy session");
  }
  await expect(book.getByRole("button", { name: /^4:00 PM to/ })).toBeEnabled();
  await expect(book.getByRole("button", { name: /^7:00 PM to/ })).toBeEnabled();
  await book.getByRole("group", { name: "Duration" }).getByRole("button", { name: "2 hours" }).click();
  await expect(book.getByRole("button", { name: /^4:00 PM to 6:00 PM/ })).toBeDisabled();
  await expect(book.getByRole("button", { name: /^6:00 PM to 8:00 PM/ })).toBeDisabled();
  await expect(book.getByRole("button", { name: /^3:00 PM to 5:00 PM/ })).toBeEnabled();
  await expect(book.getByRole("button", { name: /^7:00 PM to 9:00 PM/ })).toBeEnabled();
  // The last two-hour slot ends at 10 PM
  await expect(book.getByRole("button", { name: /^9:00 PM to/ })).toHaveCount(0);

  await book.getByRole("group", { name: "Sport" }).getByRole("button", { name: /Pickleball/ }).click();
  await book.getByRole("group", { name: "Duration" }).getByRole("button", { name: "1 hour" }).click();
  await expect(book.getByRole("button", { name: /^5:00 PM to/ })).toBeEnabled();
  await expect(book.getByRole("button", { name: /^6:00 PM to/ })).toBeEnabled();

  // The backend rejects it too, whatever the browser sends.
  const availability = await (await request.get(`/api/availability?date=${D2}&duration=60&sport=badminton`)).json();
  const courtId = availability.courts[0].courtId as string;
  const res = await request.post("/api/bookings", {
    headers: { Origin: E2E.baseURL },
    data: { courtId, date: D2, startMinute: 17 * 60, duration: 60, name: "Rule Breaker", email: "rb@example.com", phone: "9876543210" },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).error).toMatch(/academy sessions/);
});

test("books a two-hour pickleball slot end to end and locks it", async ({ page, consoleErrors }) => {
  await page.goto("/");
  // The court card hands its court to the booking flow.
  await page.locator("#courts article", { has: page.getByRole("heading", { name: "Pickleball Court 1" }) }).getByRole("button", { name: "Book Pickleball Court 1" }).click();
  const book = page.locator("#book");
  await expect(book.getByRole("group", { name: "Court" }).getByRole("button", { name: /Pickleball Court 1/ })).toHaveAttribute("aria-pressed", "true");
  await chooseSlot(page, { sport: "Pickleball", court: "Pickleball Court 1", date: D2, duration: "2 hours", start: "7:00 PM" });

  const summary = page.getByRole("complementary", { name: "Booking summary" });
  await expect(summary).toContainText("Pickleball Court 1");
  await expect(summary).toContainText("7:00 PM – 9:00 PM");
  await expect(summary).toContainText("₹1,600");
  await summary.getByRole("button", { name: "Continue" }).click();

  await fillDetails(page);
  const review = page.getByRole("dialog", { name: "Review booking" });
  for (const text of ["Pickleball", "Pickleball Court 1", "7:00 PM", "9:00 PM", "2 hours", "₹1,600"]) await expect(review).toContainText(text);
  await page.getByRole("button", { name: /Pay ₹1,600 securely/ }).click();

  const checkout = page.getByRole("dialog", { name: /Razorpay Checkout/ });
  await expect(checkout).toBeVisible();
  await expect(checkout.locator("[data-amount]")).toHaveText("160000"); // paise, from the server
  await expect(checkout.locator("[data-key]")).toHaveText(E2E.keyId); // only the public key id reaches the browser
  await checkout.getByRole("button", { name: "Pay" }).click();

  await expect(page).toHaveURL(/\/booking\/SP-[A-Z0-9]{6}\?t=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Booking confirmed");
  await expect(page.locator("main")).toContainText("Pickleball Court 1");
  await expect(page.getByRole("link", { name: "Add to calendar" })).toBeVisible();

  // The slot is gone for everyone else, on this court only.
  await page.goto("/#book");
  await chooseSlot(page, { sport: "Pickleball", court: "Pickleball Court 2", date: D2, duration: "1 hour", start: "7:00 PM" });
  await book.getByRole("group", { name: "Court" }).getByRole("button", { name: /Pickleball Court 1/ }).click();
  for (const t of ["7:00 PM", "8:00 PM"]) {
    const slot = book.getByRole("button", { name: new RegExp(`^${t} to`) });
    await expect(slot).toBeDisabled();
    await expect(slot).toContainText("Booked");
  }
  await expect(book.getByRole("button", { name: /^9:00 PM to/ })).toBeEnabled();
  expect(consoleErrors).toEqual([]);
});

test("closing checkout doesn't confirm; choosing another slot releases the hold", async ({ page }) => {
  await page.goto("/#book");
  await chooseSlot(page, { sport: "Basketball", court: "Basketball Court 1", date: D3, duration: "1 hour", start: "10:00 AM" });
  await page.getByRole("complementary", { name: "Booking summary" }).getByRole("button", { name: "Continue" }).click();
  await fillDetails(page);
  await page.getByRole("button", { name: /Pay ₹1,500 securely/ }).click();
  const checkout = page.getByRole("dialog", { name: /Razorpay Checkout/ });
  await checkout.getByRole("button", { name: "Fail attempt" }).click();
  await checkout.getByRole("button", { name: "Close" }).click();

  const notPaid = page.getByRole("dialog", { name: "Payment not completed" });
  await expect(notPaid).toBeVisible();
  await expect(notPaid).toContainText("Your card was declined.");
  await expect(notPaid).toContainText("isn't confirmed");

  // While held, the slot is unavailable to others.
  const held = await (await page.request.get(`/api/availability?date=${D3}&duration=60&sport=basketball`)).json();
  expect(held.courts[0].slots.find((s: { startMinute: number }) => s.startMinute === 600).state).toBe("HELD");

  await notPaid.getByRole("button", { name: "Choose another slot" }).click();
  await expect(page.locator("#book").getByRole("button", { name: /^10:00 AM to/ })).toBeEnabled();
});

test("Razorpay webhook confirms a payment, ignores duplicates and rejects bad signatures", async ({ request }) => {
  const availability = await (await request.get(`/api/availability?date=${D3}&duration=60&sport=pickleball`)).json();
  const courtId = availability.courts[1].courtId as string;
  const created = await request.post("/api/bookings", {
    headers: { Origin: E2E.baseURL },
    data: { courtId, date: D3, startMinute: 8 * 60, duration: 60, name: "Webhook Payer", email: "wh@example.com", phone: "+91 91234 56789" },
  });
  expect(created.status()).toBe(201);
  const { code, token, checkout } = await created.json();
  const paid = await fakePay(E2E.fakeRazorpay, checkout.orderId);

  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: paid.paymentId, order_id: checkout.orderId, amount: checkout.amount, currency: "INR", status: "captured" } } },
  });
  const send = (sig: string, eventId = "evt_e2e_1") => request.post("/api/payments/webhook/razorpay", { data: body, headers: { "Content-Type": "application/json", "X-Razorpay-Signature": sig, "X-Razorpay-Event-Id": eventId } });

  expect((await send("0".repeat(64))).status()).toBe(401);
  const first = await send(webhookSignature(body));
  expect(first.status()).toBe(200);
  const status = await (await request.get(`/api/bookings/${code}?t=${token}`)).json();
  expect(status.status).toBe("CONFIRMED");
  expect(await (await send(webhookSignature(body))).text()).toContain("duplicate");
  expect((await send(webhookSignature(body), "evt_e2e_2")).status()).toBe(200); // same payment, new event id: still idempotent
  const again = await (await request.get(`/api/bookings/${code}?t=${token}`)).json();
  expect(again.payment.status).toBe("PAID");
});

test("guards: tampered prices are ignored and booking pages need their access token", async ({ request }) => {
  const availability = await (await request.get(`/api/availability?date=${D3}&duration=60&sport=badminton`)).json();
  const courtId = availability.courts[0].courtId as string;
  const res = await request.post("/api/bookings", {
    headers: { Origin: E2E.baseURL },
    data: { courtId, date: D3, startMinute: 9 * 60, duration: 60, name: "Price Hacker", email: "ph@example.com", phone: "9876543210", total: 100, price: 1, amount: 1 },
  });
  expect(res.status()).toBe(201);
  const { code, checkout } = await res.json();
  expect(checkout.amount).toBe(50_000); // ₹500, computed by the server
  expect((await request.get(`/api/bookings/${code}?t=wrong-token-value`)).status()).toBe(404);
  expect((await request.get(`/booking/${code}`)).status()).toBe(404);
  // Cross-site requests are refused.
  const cross = await request.post("/api/bookings", { headers: { Origin: "https://evil.example" }, data: {} });
  expect(cross.status()).toBe(403);
});

test("admin: login required, dashboard shows real bookings, cancel with refund", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/dashboard/attendance");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/coaches");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E.admin.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();

  await page.getByLabel("Password").fill(E2E.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Upcoming/ })).toContainText(/[1-9]/);

  await page.getByRole("link", { name: "Bookings", exact: true }).click();
  await page.getByPlaceholder("SP-…, name, email, phone").fill("Asha");
  await page.getByRole("button", { name: "Filter" }).click();
  const row = page.getByRole("row", { name: /Asha Verma/ }).filter({ hasText: "Pickleball Court 1" });
  await expect(row).toContainText("Pickleball Court 1");
  await expect(row).toContainText("Confirmed");
  await expect(row).toContainText("Paid");
  await row.getByRole("link").first().click();

  await expect(page.getByRole("heading", { name: "Cancel booking" })).toBeVisible();
  await page.getByLabel("Reason").fill("Court resurfacing");
  await page.getByLabel(/Cancel and refund in full/).check();
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: /Cancel & refund ₹1,600/ }).click();
  await expect(page.getByText("Booking cancelled and a full refund was requested from Razorpay.")).toBeVisible();
  await expect(page.locator("main")).toContainText("Refunded");
  await expect(page.locator("main")).toContainText(/Refund rfnd_\w+ · processed/);
  await expect(page.getByRole("heading", { name: "Cancel booking" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("no Razorpay secret reaches the browser", async ({ page }) => {
  await page.goto("/");
  const html = await page.content();
  const scripts = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter(Boolean));
  let bundle = "";
  for (const src of scripts) bundle += await (await page.request.get(src)).text();
  for (const secret of [E2E.keySecret, E2E.webhookSecret, "e2e-auth-secret"]) {
    expect(html).not.toContain(secret);
    expect(bundle).not.toContain(secret);
  }
});
