const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:8787"
    : window.location.origin;

function show(el, text, isError) {
  el.textContent = text;
  el.style.color = isError ? "#f6a0a0" : "#bdfcc6";
}

function redirectToSuccess({ orderId, licenseKey, product, productId, remainingGiftCardBalance }) {
  const u = new URL("payment-success.html", window.location.href);
  u.searchParams.set("orderId", orderId);
  u.searchParams.set("licenseKey", licenseKey);
  u.searchParams.set("product", product);
  if (productId && String(productId).trim()) {
    u.searchParams.set("productId", String(productId).trim());
  }
  if (remainingGiftCardBalance !== null && remainingGiftCardBalance !== undefined) {
    u.searchParams.set("giftRemaining", String(remainingGiftCardBalance));
  }
  window.location.replace(u.pathname + u.search);
}

async function run() {
  const root = document.getElementById("payment-return-status");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("cancel") === "1") {
    show(
      root,
      "Payment was cancelled. You can return to the product page to try again.",
      true
    );
    return;
  }

  const sessionId = params.get("session_id");
  if (!sessionId) {
    show(
      root,
      "Missing checkout session. If you already paid, check the dashboard, or return to the product page and contact support with your receipt.",
      true
    );
    return;
  }

  show(root, "Completing your payment - please wait…", false);

  try {
    const response = await fetch(`${API_BASE}/api/stripe/verify-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const json = await response.json();
    if (!response.ok || !json.orderId) {
      const err =
        typeof json.error === "string"
          ? json.error
          : json.error?.message ?? "Verification failed";
      show(
        root,
        `We could not finalize the payment: ${err}. If Stripe already charged you, do not pay again; open the dashboard or contact support with your receipt.`,
        true
      );
      return;
    }
    redirectToSuccess({
      orderId: json.orderId,
      licenseKey: json.licenseKey,
      product: json.product,
      productId: json.productId,
      remainingGiftCardBalance: json.remainingGiftCardBalance,
    });
  } catch (e) {
    show(
      root,
      `Connection error: ${e.message}. Check your network and the dashboard; do not pay twice.`,
      true
    );
  }
}

run();
