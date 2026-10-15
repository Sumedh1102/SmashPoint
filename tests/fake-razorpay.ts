/**
 * A local stand-in for the parts of Razorpay's REST API this app uses, for automated tests
 * only. The app talks to it through RAZORPAY_API_BASE_URL, which the app honours only outside
 * production builds. Payments it creates are signed with the test key secret exactly as
 * Razorpay documents (HMAC-SHA256 of "order_id|payment_id"), so the app's real verification
 * code runs unchanged. It is NOT a substitute for testing with real Razorpay test keys.
 */
import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

type Order = { id: string; amount: number; currency: string; receipt: string; notes: Record<string, string>; status: string };
type Payment = { id: string; order_id: string; amount: number; currency: string; status: "authorized" | "captured" | "failed" | "refunded"; error_description?: string };
type Refund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export type FakeRazorpay = {
  url: string;
  close(): Promise<void>;
};

const id = (prefix: string) => `${prefix}_${randomBytes(7).toString("hex")}`;

export async function startFakeRazorpay(opts: { port: number; keyId: string; keySecret: string; refundStatus?: Refund["status"] }): Promise<FakeRazorpay> {
  const orders = new Map<string, Order>();
  const payments = new Map<string, Payment>();
  const refunds = new Map<string, Refund>();
  let failNextOrder = false;
  let refundStatus: Refund["status"] = opts.refundStatus ?? "processed";
  const expectedAuth = `Basic ${Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString("base64")}`;

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const read = async (req: IncomingMessage) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  };

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      // ── test controls (not part of Razorpay's API) ──
      if (parts[0] === "__test") {
        const body = req.method === "POST" ? await read(req) : {};
        if (parts[1] === "pay") {
          const order = orders.get(body.orderId);
          if (!order) return send(res, 404, { error: "no such order" });
          const payment: Payment = {
            id: id("pay"),
            order_id: order.id,
            amount: body.amount ?? order.amount,
            currency: order.currency,
            status: body.status ?? "captured",
            error_description: body.status === "failed" ? "Your card was declined." : undefined,
          };
          payments.set(payment.id, payment);
          if (payment.status === "captured") order.status = "paid";
          const signature = createHmac("sha256", opts.keySecret).update(`${order.id}|${payment.id}`).digest("hex");
          return send(res, 200, { paymentId: payment.id, signature, payment });
        }
        if (parts[1] === "refund-mode") {
          refundStatus = body.status;
          return send(res, 200, { ok: true });
        }
        if (parts[1] === "process-refunds") {
          for (const r of refunds.values()) if (r.status === "pending") r.status = "processed";
          return send(res, 200, { ok: true });
        }
        if (parts[1] === "fail-next-order") {
          failNextOrder = true;
          return send(res, 200, { ok: true });
        }
        if (parts[1] === "state") return send(res, 200, { orders: [...orders.values()], payments: [...payments.values()], refunds: [...refunds.values()] });
        return send(res, 404, {});
      }

      if (req.headers.authorization !== expectedAuth) return send(res, 401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } });
      if (parts[0] !== "v1") return send(res, 404, {});

      // POST /v1/orders
      if (req.method === "POST" && parts[1] === "orders" && parts.length === 2) {
        if (failNextOrder) {
          failNextOrder = false;
          return send(res, 500, { error: { description: "Simulated gateway error" } });
        }
        const body = await read(req);
        if (!Number.isInteger(body.amount) || body.amount < 100) return send(res, 400, { error: { description: "amount invalid" } });
        const order: Order = { id: id("order"), amount: body.amount, currency: body.currency, receipt: body.receipt, notes: body.notes ?? {}, status: "created" };
        orders.set(order.id, order);
        return send(res, 200, order);
      }
      // GET /v1/orders/:id/payments
      if (req.method === "GET" && parts[1] === "orders" && parts[3] === "payments") {
        return send(res, 200, { items: [...payments.values()].filter((p) => p.order_id === parts[2]) });
      }
      // /v1/payments/:id[...]
      if (parts[1] === "payments" && parts[2]) {
        const payment = payments.get(parts[2]);
        if (!payment) return send(res, 404, { error: { description: "payment not found" } });
        if (req.method === "GET" && parts.length === 3) return send(res, 200, payment);
        if (req.method === "POST" && parts[3] === "capture") {
          const body = await read(req);
          if (payment.status !== "authorized" || body.amount !== payment.amount) return send(res, 400, { error: { description: "cannot capture" } });
          payment.status = "captured";
          orders.get(payment.order_id)!.status = "paid";
          return send(res, 200, payment);
        }
        if (req.method === "POST" && parts[3] === "refund") {
          const body = await read(req);
          if (payment.status !== "captured") return send(res, 400, { error: { description: "payment not captured" } });
          const refund: Refund = { id: id("rfnd"), payment_id: payment.id, amount: body.amount, status: refundStatus };
          refunds.set(refund.id, refund);
          payment.status = "refunded";
          return send(res, 200, refund);
        }
        if (req.method === "GET" && parts[3] === "refunds" && parts[4]) {
          const refund = refunds.get(parts[4]);
          return refund ? send(res, 200, refund) : send(res, 404, {});
        }
      }
      return send(res, 404, { error: { description: "not implemented in fake" } });
    } catch (err) {
      return send(res, 500, { error: { description: String(err) } });
    }
  });
  await new Promise<void>((resolve) => server.listen(opts.port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${opts.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Test helper: simulate the customer completing (or failing) payment for an order. */
export async function fakePay(baseUrl: string, orderId: string, status: "captured" | "authorized" | "failed" = "captured", amount?: number) {
  const res = await fetch(`${baseUrl}/__test/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status, amount }) });
  if (!res.ok) throw new Error(`fake pay failed: ${res.status}`);
  return (await res.json()) as { paymentId: string; signature: string };
}
