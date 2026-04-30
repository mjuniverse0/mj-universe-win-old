/**
 * Butikk-satellitt: produkter fra Supabase; kjop krever innlogget bruker.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = window.MJ_SUPABASE_URL;
const key = window.MJ_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function formatPrice(cents) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(Number(cents || 0) / 100);
}

async function refreshAuthGate() {
  const gate = document.getElementById("mj-store-gate");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!gate) return session;
  gate.hidden = Boolean(session);
  return session;
}

async function loadProducts() {
  const root = document.getElementById("mj-store-products");
  if (!root) return;
  const { data, error } = await supabase
    .from("store_products")
    .select("id, slug, title, description, price_cents")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    root.innerHTML = "<p>Kunne ikke laste produkter.</p>";
    return;
  }
  if (!data?.length) {
    root.innerHTML = `
      <article class="mj-store-card">
        <h3>Butikken er klar — produkter mangler</h3>
        <p>Domene og side er oppe, men tabellen <code>store_products</code> har ingen aktive varer enda.</p>
        <p class="mj-store-price">Neste steg: legg inn produkter i admin (sort_order + is_active=true).</p>
      </article>`;
    return;
  }
  root.innerHTML = data
    .map((p) => {
      return `<article class="mj-store-card" data-product-id="${esc(p.id)}">
        <h3>${esc(p.title)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        <p class="mj-store-price">${esc(formatPrice(p.price_cents))}</p>
        <button type="button" class="btn btn--primary mj-store-buy" data-id="${esc(p.id)}">Kjøp (MVP)</button>
      </article>`;
    })
    .join("");

  root.querySelectorAll(".mj-store-buy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const msg = document.getElementById("mj-store-msg");
      if (msg) msg.textContent = "";
      const session = await refreshAuthGate();
      if (!session) {
        if (msg) msg.textContent = "Logg inn for å kjøpe.";
        return;
      }
      const id = btn.getAttribute("data-id");
      const { error: e2 } = await supabase.from("store_orders").insert({
        user_id: session.user.id,
        product_id: id,
        status: "pending",
      });
      if (e2) {
        if (msg) msg.textContent = e2.message;
        return;
      }
      if (msg) msg.textContent = "Bestilling registrert (pending). Vi kontakter deg / betaling kommer senere.";
    });
  });
}

await refreshAuthGate();
await loadProducts();
supabase.auth.onAuthStateChange(() => {
  refreshAuthGate();
});
