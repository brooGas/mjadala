// Starts an M-Pesa STK push for a Watt AI Agent Pro or All-Access subscription.
// Uses the existing Daraja credentials; callback URL is separate so other Mjadala payments are untouched.
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = (origin: string | null) => origin && (
  ["https://mjadala.vercel.app", "https://mjadala.app", "https://www.mjadala.app", "http://localhost:3000", "http://127.0.0.1:3000"].includes(origin) ||
  /^https:\/\/mjadala(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)
) ? origin : "https://mjadala.vercel.app";
const json = (status: number, body: Record<string, unknown>, origin: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  },
});

function getSupabasePublicKey(): string {
  const direct = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (direct) return direct;
  try {
    const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.default === "string") return parsed.default;
      const first = Object.values(parsed).find((value) => typeof value === "string");
      if (typeof first === "string") return first;
    }
  } catch { /* safe empty-key fallback */ }
  return "";
}

function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new Error(`Missing server setting: ${name}`);
  return value;
}
function normalizePhone(raw: string): string {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
  if (!/^254\d{9}$/.test(phone)) throw new Error("Enter a valid Kenyan M-Pesa number, for example 07XXXXXXXX.");
  return phone;
}
function darajaBase() {
  return env("DARAJA_ENV", "sandbox") === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}
function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
async function accessToken() {
  const auth = btoa(`${env("DARAJA_CONSUMER_KEY")}:${env("DARAJA_CONSUMER_SECRET")}`);
  const response = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`M-Pesa authentication failed (${response.status}).`);
  return String(body.access_token);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return json(200, { ok: true }, origin);
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, origin);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(401, { error: "Please sign in to purchase a Watt AI plan." }, origin);

  const url = env("SUPABASE_URL");
  const anon = getSupabasePublicKey();
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!anon) return json(503, { error: "Watt AI payment service is not configured." }, origin);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData?.user) return json(401, { error: "Your Mjadala session has expired. Sign in again." }, origin);

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "The payment request could not be read." }, origin); }
  const planCode = typeof body?.plan_code === "string" ? body.plan_code : "";
  let phone: string;
  try { phone = normalizePhone(body?.phone); } catch (error) { return json(400, { error: (error as Error).message }, origin); }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: plan, error: planError } = await admin.from("watt_ai_plans")
    .select("plan_code,title,agent_key,amount_kes,duration_days,is_active")
    .eq("plan_code", planCode).eq("is_active", true).maybeSingle();
  if (planError || !plan) return json(404, { error: "That Watt AI plan is unavailable. Please refresh and try again." }, origin);
  if (Number(plan.amount_kes) < 1) return json(400, { error: "This plan does not require payment." }, origin);

  const { data: payment, error: insertError } = await admin.from("watt_ai_payments").insert({
    user_id: authData.user.id,
    plan_code: plan.plan_code,
    amount_kes: Number(plan.amount_kes),
    phone_number: phone,
    payment_status: "pending",
  }).select("id").single();
  if (insertError || !payment) {
    console.error("Watt AI payment record insert failed", insertError?.message);
    return json(500, { error: "Watt AI could not start your payment. Please try again." }, origin);
  }

  try {
    const shortcode = env("DARAJA_SHORTCODE");
    const passkey = env("DARAJA_PASSKEY");
    const ts = timestamp();
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const bearer = await accessToken();
    const accountRef = `WATT${String(payment.id).replace(/-/g, "").slice(0, 8)}`;
    const stk = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: env("DARAJA_TRANSACTION_TYPE", "CustomerPayBillOnline"),
        Amount: Math.round(Number(plan.amount_kes)),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: env("WATT_DARAJA_CALLBACK_URL"),
        AccountReference: accountRef,
        TransactionDesc: `Watt ${plan.title}`.slice(0, 20),
      }),
    });
    const result = await stk.json();
    if (!stk.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID) {
      throw new Error(result.errorMessage || result.ResponseDescription || `Safaricom rejected the STK request (${stk.status}).`);
    }
    const { error: updateError } = await admin.from("watt_ai_payments").update({
      merchant_request_id: result.MerchantRequestID,
      checkout_request_id: result.CheckoutRequestID,
      payment_status: "processing",
    }).eq("id", payment.id);
    if (updateError) throw updateError;
    return json(200, {
      ok: true,
      payment_id: payment.id,
      plan_title: plan.title,
      amount_kes: Number(plan.amount_kes),
      customer_message: result.CustomerMessage || "Check your phone and enter your M-Pesa PIN to approve the payment.",
    }, origin);
  } catch (error) {
    await admin.from("watt_ai_payments").update({ payment_status: "failed", result_description: String((error as Error).message || error).slice(0, 500) }).eq("id", payment.id);
    console.error("Watt AI STK push failed", String((error as Error).message || error));
    return json(502, { error: "We could not send the M-Pesa prompt. Please check the number and try again." }, origin);
  }
});
