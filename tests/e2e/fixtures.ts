import { createHmac } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import { fakePay } from "../fake-razorpay";
import { E2E } from "../../playwright.config";

/**
 * Stand-in for https://checkout.razorpay.com/v1/checkout.js: renders a minimal "checkout"
 * with Pay / Fail / Close buttons. Pay asks the fake Razorpay API for a payment signed with
 * the test key secret and hands it to the app's success handler, exactly like Checkout does.
 */
const FAKE_CHECKOUT_JS = `
window.Razorpay = function (options) { this.options = options; this.handlers = {}; };
window.Razorpay.prototype.on = function (event, cb) { this.handlers[event] = cb; };
window.Razorpay.prototype.open = function () {
  var self = this, o = this.options;
  var el = document.createElement("div");
  el.id = "fake-razorpay";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Razorpay Checkout (test double)");
  el.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;font:16px sans-serif";
  el.innerHTML = '<p>Test checkout · <span data-amount>' + o.amount + '</span> ' + o.currency + ' · <span data-order>' + o.order_id + '</span> · key <span data-key>' + o.key + '</span></p>' +
    '<button id="rzp-pay">Pay</button><button id="rzp-fail">Fail attempt</button><button id="rzp-close">Close</button>';
  document.body.appendChild(el);
  el.querySelector("#rzp-pay").onclick = async function () {
    var r = await window.__fakePay(o.order_id, "captured");
    el.remove();
    o.handler({ razorpay_payment_id: r.paymentId, razorpay_order_id: o.order_id, razorpay_signature: r.signature });
  };
  el.querySelector("#rzp-fail").onclick = async function () {
    await window.__fakePay(o.order_id, "failed");
    if (self.handlers["payment.failed"]) self.handlers["payment.failed"]({ error: { description: "Your card was declined." } });
  };
  el.querySelector("#rzp-close").onclick = function () { el.remove(); o.modal && o.modal.ondismiss && o.modal.ondismiss(); };
};`;

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await use(errors);
  },
  page: async ({ page }, use) => {
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_CHECKOUT_JS }));
    await page.exposeFunction("__fakePay", (orderId: string, status: "captured" | "failed") => fakePay(E2E.fakeRazorpay, orderId, status));
    await use(page);
  },
});
export { expect };

/** ISO date n days from today in Asia/Kolkata. */
export function dayFromToday(n: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function webhookSignature(body: string) {
  return createHmac("sha256", E2E.webhookSecret).update(body).digest("hex");
}

/** Steps 1–5 of the booking wizard. */
export async function chooseSlot(page: Page, opts: { sport: string; court: string; date: string; duration: "1 hour" | "2 hours"; start: string }) {
  const book = page.locator("#book");
  await book.getByRole("group", { name: "Sport" }).getByRole("button", { name: new RegExp(opts.sport, "i") }).click();
  await book.getByRole("group", { name: "Court" }).getByRole("button", { name: new RegExp(opts.court) }).click();
  await book.locator(`[data-date="${opts.date}"]`).click();
  await book.getByRole("group", { name: "Duration" }).getByRole("button", { name: opts.duration }).click();
  const slot = book.getByRole("button", { name: new RegExp(`^${opts.start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} to`) });
  await expect(slot).toBeEnabled();
  await slot.click();
}

export async function fillDetails(page: Page, who = { name: "Asha Verma", email: "asha@example.com", phone: "98765 43210" }) {
  const dialog = page.getByRole("dialog", { name: "Your details" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(who.name);
  await dialog.getByLabel("Email address").fill(who.email);
  await dialog.getByLabel("Mobile number").fill(who.phone);
  await page.getByRole("button", { name: "Review booking" }).click();
  await expect(page.getByRole("dialog", { name: "Review booking" })).toBeVisible();
}
