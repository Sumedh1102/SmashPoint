import { chooseSlot, dayFromToday, expect, fillDetails, test, webhookSignature } from "./fixtures";
import { fakePay } from "../fake-razorpay";
import { E2E } from "../../playwright.config";

const D2 = dayFromToday(2);
const D3 = dayFromToday(3);

test.describe.configure({ mode: "serial" });

test("home page: multi-sport hero, sports, live courts, rate card, no errors or overflow", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/One destination\.\s*Three ways to play\./i);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: /Book Now/ })).toBeVisible();
  for (const label of ["Home", "Sports", "Court Rentals", "Book a Court", "About Us", "Contact"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();

  // The three sports get equal billing in the hero and the sports section.
  const heroSports = page.getByRole("list", { name: "Our sports" });
  for (const sport of ["Badminton", "Pickleball", "Basketball"]) await expect(heroSports.getByRole("link", { name: new RegExp(`Book ${sport}`) })).toBeVisible();
  await expect(page.locator("#sports > div > ul > li")).toHaveCount(3);
  await expect(page.locator("#sport-badminton")).toContainText("Court 1 – Green Mat (5 mm)");
  await expect(page.locator("#sport-badminton")).toContainText("Court 2 – Wooden Finish (2.5 mm)");
  await expect(page.locator("#sport-pickleball")).toContainText("Paddle included. Ball needs to be purchased separately.");

  const cards = page.locator("#courts article");
  await expect(cards).toHaveCount(5);
  for (const name of ["Badminton Court 1", "Badminton Court 2", "Pickleball Court 1", "Pickleball Court 2", "Basketball Court 1"]) {
    await expect(page.locator("#courts").getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.locator("#courts article img")).toHaveCount(5);
  for (const img of await page.locator("#courts article img").all()) expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 || !el.complete)).toBe(true);

  // The rate card: exact published prices, hourly and monthly.
  const table = page.locator("#pricing table");
  await expect(table.locator("tbody tr")).toHaveCount(4);
  const rows: [RegExp, string[]][] = [
    [/Green Mat/, ["₹500", "₹900", "₹7,000", "₹19,500", "₹37,500", "₹72,000"]],
    [/Wooden Finish/, ["₹400", "₹700", "₹6,000", "₹16,500", "₹31,500", "₹60,000"]],
    [/Pickleball/, ["₹400", "₹700", "₹5,500", "₹15,000", "₹27,500", "₹50,000"]],
    [/Basketball/, ["₹700", "₹1,300", "₹7,000", "₹19,500", "₹37,500", "₹72,000"]],
  ];
  for (const [label, prices] of rows) {
    const cells = await table.locator("tbody tr", { has: page.getByRole("rowheader", { name: label }) }).locator("td").allInnerTexts();
    expect(cells.slice(0, 6).map((c) => c.split("\n")[0]!.trim())).toEqual(prices);
  }
  for (const note of ["Monthly rentals are valid from Monday to Saturday.", "Timings and availability are subject to change.", "Advance booking is recommended.", "Terms and conditions apply."]) {
    await expect(page.locator("#pricing")).toContainText(note);
  }
  await expect(page.locator("#coaching")).toContainText("state certified");

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancellation & refund policy" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("book buttons pre-select the sport or court; no peak surcharge; badminton bookable 5–7 PM", async ({ page, request }) => {
  await page.goto("/");
  const book = page.locator("#book");
  await page.locator("#sport-basketball").getByRole("link", { name: "Book Basketball now" }).click();
  await expect(book.getByRole("group", { name: "Sport" }).getByRole("button", { name: /Basketball/ })).toHaveAttribute("aria-pressed", "true");
  await expect(book.getByRole("group", { name: "Court" }).getByRole("button", { name: /Basketball Court 1/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?sport=basketball#book$/);

  // A rate-card row books its court.
  await page.locator("#pricing table").getByRole("link", { name: "Book Badminton Court 2" }).click();
  await expect(book.getByRole("group", { name: "Court" }).getByRole("button", { name: /Badminton Court 2/ })).toHaveAttribute("aria-pressed", "true");
  await expect(book.getByRole("group", { name: "Court" }).getByRole("button", { name: /Badminton Court 2/ })).toContainText("Wooden Finish (2.5 mm)");

  // Duration options show the exact rate-card prices.
  await book.locator(`[data-date="${D2}"]`).click();
  const durations = book.getByRole("group", { name: "Duration" });
  await expect(durations.getByRole("button", { name: /1 hour/ })).toContainText("₹400");
  await expect(durations.getByRole("button", { name: /2 hours/ })).toContainText("₹700");
  await expect(durations.getByRole("button", { name: /2 hours/ })).toContainText("Save ₹100");

  // Evening slots — including 5–7 PM on badminton — are open at the same price.
  for (const t of ["5:00 PM", "6:00 PM"]) await expect(book.getByRole("button", { name: new RegExp(`^${t} to .*₹400, available`) })).toBeEnabled();
  await durations.getByRole("button", { name: /2 hours/ }).click();
  await expect(book.getByRole("button", { name: /^4:00 PM to 6:00 PM, ₹700, available/ })).toBeEnabled();
  await expect(book.getByRole("button", { name: /^8:00 PM to 10:00 PM, ₹700, available/ })).toBeEnabled();
  // The last two-hour slot ends at 10 PM
  await expect(book.getByRole("button", { name: /^9:00 PM to/ })).toHaveCount(0);

  // The API agrees: every badminton court-1 slot costs ₹500 for one hour, ₹900 for two.
  for (const [duration, price] of [[60, 50_000], [120, 90_000]] as const) {
    const availability = await (await request.get(`/api/availability?date=${D2}&duration=${duration}&court=badminton-court-1`)).json();
    expect(new Set(availability.courts[0].slots.map((s: { price: number }) => s.price))).toEqual(new Set([price]));
  }
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
  await expect(summary).toContainText("₹700");
  await summary.getByRole("button", { name: "Continue" }).click();

  await fillDetails(page);
  const review = page.getByRole("dialog", { name: "Review booking" });
  for (const text of ["Pickleball", "Pickleball Court 1", "7:00 PM", "9:00 PM", "2 hours", "₹700", "Paddle included. Ball needs to be purchased separately."]) await expect(review).toContainText(text);
  await page.getByRole("button", { name: /Pay ₹700 securely/ }).click();

  const checkout = page.getByRole("dialog", { name: /Razorpay Checkout/ });
  await expect(checkout).toBeVisible();
  await expect(checkout.locator("[data-amount]")).toHaveText("70000"); // paise, from the server
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
  await page.getByRole("button", { name: /Pay ₹700 securely/ }).click();
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
  await page.getByRole("button", { name: /Cancel & refund ₹700/ }).click();
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
