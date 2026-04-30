async function renderClientPageData() {
  const rows = await loadClientOrders();

  const pRoot = document.querySelector("[data-products-client-table]");
  if (pRoot) {
    pRoot.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<tr><td>${r.product ?? "-"}</td><td class="${productStatusClass(r.status)}">${r.status ?? "pending"}</td><td>${r.order_id}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="3">No products found.</td></tr>`;
  }

  const kRoot = document.querySelector("[data-keys-table]");
  if (kRoot) {
    kRoot.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<tr><td>${r.order_id}</td><td>${r.product ?? "-"}</td><td>${r.license_key ? `<code>${r.license_key}</code>` : "Not assigned"}</td><td>${
                r.license_expires_at ? new Date(r.license_expires_at).toLocaleDateString() : "No expiry"
              }</td></tr>`
          )
          .join("")
      : `<tr><td colspan="4">No keys found.</td></tr>`;
  }

  const dRoot = document.querySelector("[data-downloads-table]");
  if (dRoot) {
    dRoot.innerHTML = rows.length
      ? rows
          .map((r) => {
            const status = r.status ?? "pending";
            const ready = r.download_url && ["completed", "active", "delivered"].includes(status.toLowerCase());
            return `<tr><td>${r.product ?? "-"}</td><td class="${productStatusClass(status)}">${status}</td><td>${
              ready
                ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${r.download_url}">Download</a>`
                : "Not available"
            }</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="3">No downloads found.</td></tr>`;
  }

  const tRoot = document.querySelector("[data-transactions-table]");
  if (tRoot) {
    tRoot.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<tr><td>${r.order_id}</td><td>${r.product ?? "-"}</td><td class="${productStatusClass(r.status)}">${r.status ?? "pending"}</td><td>${r.claimed_at ? "Yes" : "No"}</td><td>${new Date(r.created_at).toLocaleString()}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="5">No transactions found.</td></tr>`;
  }
}

renderClientPageData();
