function statusClass(status) {
  return productStatusClass(status);
}

function renderRows(rows) {
  const tbody = document.querySelector("[data-client-orders]");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5">No purchases found yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((row) => {
      const status = row.status ?? "pending";
      const claimed = row.claimed_at ? "Yes" : "No";
      const canDownload = Boolean(row.download_url) && ["completed", "active", "delivered"].includes(status);
      return `<tr>
        <td>${row.order_id}</td>
        <td>${row.product ?? "-"}</td>
        <td class="${statusClass(status)}">${status}</td>
        <td>${claimed}</td>
        <td>${
          canDownload
            ? `<a class="btn btn-primary" href="${row.download_url}" target="_blank" rel="noopener noreferrer">Download</a>`
            : "Not available"
        }</td>
      </tr>`;
    })
    .join("");
}

function formatExpiry(iso) {
  if (!iso) return "No expiry";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function renderSidebarSections(rows) {
  const productsRoot = document.querySelector("[data-products-list]");
  const keysRoot = document.querySelector("[data-keys-list]");
  const downloadsRoot = document.querySelector("[data-downloads-list]");
  const kpiOrders = document.querySelector("[data-kpi-orders]");
  const kpiActive = document.querySelector("[data-kpi-active]");
  const kpiClaimed = document.querySelector("[data-kpi-claimed]");
  const kpiDownloads = document.querySelector("[data-kpi-downloads]");

  const products = [...new Set(rows.map((r) => r.product).filter(Boolean))];
  const withKeys = rows.filter((r) => r.license_key);
  const downloads = rows.filter(
    (r) => r.download_url && ["completed", "active", "delivered"].includes((r.status ?? "").toLowerCase())
  );
  const activeCount = rows.filter((r) =>
    ["active", "completed", "delivered"].includes((r.status ?? "").toLowerCase())
  ).length;
  const claimedCount = rows.filter((r) => Boolean(r.claimed_at)).length;

  if (kpiOrders) kpiOrders.textContent = String(rows.length);
  if (kpiActive) kpiActive.textContent = String(activeCount);
  if (kpiClaimed) kpiClaimed.textContent = String(claimedCount);
  if (kpiDownloads) kpiDownloads.textContent = String(downloads.length);

  if (productsRoot) {
    productsRoot.innerHTML = products.length
      ? products.map((p) => `<li>${p}</li>`).join("")
      : "<li>No products yet.</li>";
  }

  if (keysRoot) {
    keysRoot.innerHTML = withKeys.length
      ? withKeys
          .map(
            (r) =>
              `<li><span class="muted" style="display:block;font-size:0.82rem;margin-bottom:4px">${r.order_id ?? ""} · ${r.product ?? "-"}</span><code>${r.license_key}</code><span class="muted" style="display:block;font-size:0.82rem;margin-top:4px">Expires: ${formatExpiry(r.license_expires_at)}</span></li>`
          )
          .join("")
      : "<li>No keys available yet.</li>";
  }

  if (downloadsRoot) {
    downloadsRoot.innerHTML = downloads.length
      ? downloads
          .map(
            (d) =>
              `<li><strong>${d.product ?? "-"}</strong> (${d.order_id ?? ""}): <a href="${d.download_url}" target="_blank" rel="noopener noreferrer">Download</a></li>`
          )
          .join("")
      : "<li>No downloads available yet.</li>";
  }
}

async function loadOrders() {
  const session = getClientSession();
  const message = document.querySelector("[data-client-message]");
  if (!session) {
    window.location.href = "./dashboard.html";
    return;
  }
  const rows = await loadClientOrders();
  const loadErr = typeof window.__verdantOrdersLoadError === "string" ? window.__verdantOrdersLoadError : "";
  if (message) {
    if (loadErr) {
      message.style.color = "#f6a0a0";
      message.textContent = loadErr;
    } else if (!rows.length) {
      message.style.color = "";
      message.textContent =
        "No orders found for this account. Purchases appear here after checkout completes.";
    } else {
      message.style.color = "";
      message.textContent = `Showing ${rows.length} order(s). Last synced: ${new Date().toLocaleTimeString()}`;
    }
  }
  renderRows(rows);
  renderSidebarSections(rows);
}

function setupUi() {
  const session = getClientSession();
  const account = document.querySelector("[data-client-account]");
  if (account) {
    account.textContent = session
      ? `Logged in as ${session.username} (${session.email})`
      : "No active session";
  }

  const refresh = document.querySelector("[data-refresh-orders]");
  if (refresh) refresh.addEventListener("click", () => loadOrders());

  const logout = document.querySelector("[data-logout]");
  if (logout) {
    logout.addEventListener("click", () => {
      localStorage.removeItem(CLIENT_SESSION_KEY);
      localStorage.removeItem("verdant_dashboard_autologin");
      window.location.href = "./dashboard.html";
    });
  }
}

setupUi();
loadOrders();
setInterval(loadOrders, 12000);
