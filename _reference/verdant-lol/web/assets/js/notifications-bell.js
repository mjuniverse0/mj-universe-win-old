/**
 * Public ops/payment alerts for all visitors + optional admin controls (recover, server dismiss).
 */
(function () {
  const SITE_API =
    window.location.protocol === "file:"
      ? "http://localhost:8787"
      : window.location.origin;

  const ADMIN_SECRET_STORAGE = "verdant_dashboard_admin_secret";
  const LOCAL_DISMISS_KEY = "verdant_notify_dismissed_ids_v1";

  function adminSecretGet() {
    try {
      return sessionStorage.getItem(ADMIN_SECRET_STORAGE) || "";
    } catch {
      return "";
    }
  }

  function dismissedGet() {
    try {
      const raw = localStorage.getItem(LOCAL_DISMISS_KEY);
      const arr = JSON.parse(raw || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function dismissedAdd(id) {
    const s = dismissedGet();
    s.add(id);
    try {
      localStorage.setItem(LOCAL_DISMISS_KEY, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
  }

  function ensureNavClusterWithBell() {
    const inner = document.querySelector(".nav .nav-inner");
    if (!inner || document.getElementById("admin-notify-wrap")) return;
    const links = inner.querySelector(".links");
    if (!links) return;
    const cluster = document.createElement("div");
    cluster.className = "nav-cluster";
    links.replaceWith(cluster);
    cluster.appendChild(links);
    const wrap = document.createElement("div");
    wrap.id = "admin-notify-wrap";
    wrap.className = "notify-bell-wrap";
    wrap.innerHTML = `
      <button type="button" id="admin-notify-btn" class="btn btn-ghost notify-bell" aria-label="Shop alerts">
        <span aria-hidden="true">🔔</span>
        <span id="admin-notify-badge" class="notify-badge">0</span>
      </button>
      <div id="admin-notify-panel" class="notify-panel" hidden></div>`;
    cluster.appendChild(wrap);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(cents, cur) {
    if (cents == null || !Number.isFinite(Number(cents))) return "";
    const c = String(cur || "usd").toUpperCase();
    return `${(Number(cents) / 100).toFixed(2)} ${c}`;
  }

  function renderNotifyPanel(items, panel, opts) {
    const { onRecover, onReadServer, onReadAllServer, onDismissLocal, hasAdmin } = opts;
    if (!items.length) {
      panel.innerHTML = `<p class="muted">No alerts.</p>
        <button type="button" class="btn btn-ghost" id="notify-read-all-empty">Dismiss all (local)</button>`;
      document.getElementById("notify-read-all-empty")?.addEventListener("click", onReadAllServer);
      return;
    }
    panel.innerHTML = items
      .map((n) => {
        const money =
          n.amountCents != null ? `<div class="notify-meta">${formatMoney(n.amountCents, n.currency)}</div>` : "";
        const ids = [
          n.stripePaymentIntentId ? `PI: ${n.stripePaymentIntentId}` : "",
          n.stripeSessionId ? `Session: ${n.stripeSessionId}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const sev =
          n.severity === "error"
            ? "rgba(255,120,120,.95)"
            : n.severity === "success"
              ? "rgba(120,220,160,.95)"
              : "var(--muted)";
        const recoverBtn =
          hasAdmin &&
          n.recoverable &&
          (n.stripePaymentIntentId || n.stripeSessionId)
            ? `<div class="notify-actions"><button type="button" class="btn btn-primary btn-sm" data-recover="${n.id}">Restore order</button></div>`
            : "";
        const dismissLabel = hasAdmin ? "Dismiss" : "Hide";
        const dismissFn = hasAdmin ? "data-read" : "data-local-dismiss";
        return `<div class="notify-item" data-id="${n.id}">
        <div class="notify-title" style="color:${sev}">${escapeHtml(n.title || "Alert")}</div>
        <div class="notify-meta">${escapeHtml(n.detail || "")}</div>
        ${money}
        ${ids ? `<div class="notify-meta">${escapeHtml(ids)}</div>` : ""}
        ${recoverBtn}
        <div class="notify-actions">
          <button type="button" class="btn btn-ghost btn-sm" ${dismissFn}="${n.id}">${dismissLabel}</button>
        </div>
      </div>`;
      })
      .join("");
    panel.querySelectorAll("[data-read]").forEach((btn) => {
      btn.addEventListener("click", () => onReadServer(btn.getAttribute("data-read")));
    });
    panel.querySelectorAll("[data-local-dismiss]").forEach((btn) => {
      btn.addEventListener("click", () => onDismissLocal(btn.getAttribute("data-local-dismiss")));
    });
    panel.querySelectorAll("[data-recover]").forEach((btn) => {
      btn.addEventListener("click", () => onRecover(btn.getAttribute("data-recover")));
    });
    const foot = document.createElement("div");
    foot.className = "notify-actions";
    foot.style.marginTop = "12px";
    foot.innerHTML = `<button type="button" class="btn btn-ghost" id="notify-read-all-foot">${
      hasAdmin ? "Mark all read" : "Hide all locally"
    }</button>`;
    panel.appendChild(foot);
    document.getElementById("notify-read-all-foot")?.addEventListener("click", onReadAllServer);
  }

  function hookPaymentAlertsBell() {
    ensureNavClusterWithBell();
    const wrap = document.getElementById("admin-notify-wrap");
    const btn = document.getElementById("admin-notify-btn");
    const panel = document.getElementById("admin-notify-panel");
    const badge = document.getElementById("admin-notify-badge");
    if (!wrap || !btn || !panel || !badge) return;

    wrap.hidden = false;

    let itemsCache = [];
    let pollTimer = null;

    function hasAdmin() {
      return Boolean(adminSecretGet());
    }

    function effectiveUnreadCount() {
      const dismissed = dismissedGet();
      const adm = hasAdmin();
      return itemsCache.filter((x) => {
        if (adm) return !x.read;
        return !x.read && !dismissed.has(x.id);
      }).length;
    }

    function updateBellCount() {
      const n = effectiveUnreadCount();
      badge.textContent = String(n);
      badge.style.display = n > 0 ? "inline-block" : "none";
    }

    async function fetchAlerts() {
      try {
        const res = await fetch(`${SITE_API}/api/notifications`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          itemsCache = [];
          updateBellCount();
          return;
        }
        itemsCache = json.items || [];
        updateBellCount();
        if (!panel.hidden) {
          renderPanel();
        }
      } catch {
        itemsCache = [];
        updateBellCount();
      }
    }

    function renderPanel() {
      renderNotifyPanel(itemsCache, panel, {
        hasAdmin: hasAdmin(),
        onRecover: recoverByNotifId,
        onReadServer: markOneRead,
        onReadAllServer: markAllRead,
        onDismissLocal: (id) => {
          dismissedAdd(id);
          updateBellCount();
          renderPanel();
        },
      });
    }

    async function markOneRead(id) {
      if (!hasAdmin() || !id) return;
      const secret = adminSecretGet();
      await fetch(`${SITE_API}/api/admin/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ id }),
      });
      await fetchAlerts();
    }

    async function markAllRead() {
      if (hasAdmin()) {
        const secret = adminSecretGet();
        await fetch(`${SITE_API}/api/admin/notifications/read-all`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
        });
        await fetchAlerts();
      } else {
        for (const x of itemsCache) {
          if (!x.read) dismissedAdd(x.id);
        }
        updateBellCount();
        renderPanel();
      }
    }

    async function recoverByNotifId(notifId) {
      const n = itemsCache.find((x) => x.id === notifId);
      if (!n || !hasAdmin()) return;
      const secret = adminSecretGet();
      const body = {};
      if (n.stripeSessionId) body.sessionId = n.stripeSessionId;
      else if (n.stripePaymentIntentId) body.paymentIntentId = n.stripePaymentIntentId;
      else return;
      try {
        const res = await fetch(`${SITE_API}/api/admin/stripe/recover-fulfillment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(body),
        });
        await res.json().catch(() => ({}));
        await fetchAlerts();
        renderPanel();
      } catch {
        /* ignore */
      }
    }

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        await fetchAlerts();
        renderPanel();
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) panel.hidden = true;
    });

    fetchAlerts();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchAlerts, 60000);

    window.__verdantNotifyRefresh = fetchAlerts;

    window.addEventListener("storage", (ev) => {
      if (ev.key === ADMIN_SECRET_STORAGE) fetchAlerts();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hookPaymentAlertsBell);
  } else {
    hookPaymentAlertsBell();
  }
})();
