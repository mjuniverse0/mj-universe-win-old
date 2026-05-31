import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
const key = (window.MJ_SUPABASE_ANON_KEY || "").trim();
const el = document.getElementById("site-views");
const textEl = el && el.querySelector(".js-views-text");
const labelEl = el && el.querySelector(".js-views-label");
const periodRoot = document.getElementById("views-period-root");
const periodTrigger = document.getElementById("views-period-trigger");
const periodTriggerText = document.getElementById("views-period-trigger-text");
const periodList = document.getElementById("views-period-list");

const LS_KEY = "mj_views_period";

const PERIODS = [
  { id: "h24", label: "24 timer" },
  { id: "d7", label: "7 dager" },
  { id: "d14", label: "14 dager" },
  { id: "d30", label: "30 dager" },
  { id: "d90", label: "90 dager" },
  { id: "d180", label: "180 dager" },
  { id: "mo12", label: "12 mnd" },
  { id: "all", label: "All time" },
];

let currentPeriodId = "h24";

const keyOk = key.startsWith("sb_publishable_") || key.startsWith("eyJ");
const configured = Boolean(
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && keyOk && key.length > 20
);

function formatCount(n) {
  return new Intl.NumberFormat("nb-NO").format(Number(n) || 0);
}

function getSelectedPeriod() {
  const fromLs = localStorage.getItem(LS_KEY);
  const v = currentPeriodId || fromLs || "h24";
  if (!PERIODS.some((p) => p.id === v)) return "h24";
  return v;
}

function setLabelForPeriod(periodId) {
  const p = PERIODS.find((x) => x.id === periodId);
  if (labelEl && p) {
    labelEl.textContent = `Visninger siste ${p.label}:`;
  }
}

function syncTriggerLabel(periodId) {
  const p = PERIODS.find((x) => x.id === periodId);
  if (periodTriggerText && p) {
    periodTriggerText.textContent = p.label;
  }
}

function closePeriodMenu() {
  if (!periodList || !periodTrigger) return;
  periodList.hidden = true;
  periodTrigger.setAttribute("aria-expanded", "false");
}

function openPeriodMenu() {
  if (!periodList || !periodTrigger) return;
  periodList.hidden = false;
  periodTrigger.setAttribute("aria-expanded", "true");
  const active = periodList.querySelector(`[data-period="${getSelectedPeriod()}"]`);
  if (active) active.focus();
}

function setupPeriodMenu() {
  if (!periodRoot || !periodTrigger || !periodList) return;

  const saved = localStorage.getItem(LS_KEY);
  if (saved && PERIODS.some((p) => p.id === saved)) {
    currentPeriodId = saved;
  } else {
    currentPeriodId = "h24";
  }
  syncTriggerLabel(currentPeriodId);

  periodList.innerHTML = PERIODS.map(
    (p) =>
      `<li role="none"><button type="button" role="option" class="views-period__item" data-period="${p.id}" aria-selected="${
        p.id === currentPeriodId
      }">${p.label}</button></li>`
  ).join("");

  periodTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = periodTrigger.getAttribute("aria-expanded") === "true";
    if (open) closePeriodMenu();
    else openPeriodMenu();
  });

  periodList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    const id = btn.getAttribute("data-period");
    if (!id || !PERIODS.some((p) => p.id === id)) return;
    currentPeriodId = id;
    localStorage.setItem(LS_KEY, id);
    syncTriggerLabel(id);
    setLabelForPeriod(id);
    periodList.querySelectorAll(".views-period__item").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-period") === id ? "true" : "false");
    });
    closePeriodMenu();
    periodTrigger.focus();
    refreshFromCache();
  });

  document.addEventListener("click", () => closePeriodMenu());
  periodRoot.addEventListener("click", (e) => e.stopPropagation());

  periodTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePeriodMenu();
    }
  });
}

let refreshFromCache = () => {};

async function run() {
  if (!el || !textEl) return;
  if (!configured) {
    el.hidden = true;
    return;
  }

  setupPeriodMenu();

  const supabase = createClient(url, key);
  let cachedStats = null;

  async function fetchStats() {
    const { data, error } = await supabase.rpc("views_stats");
    if (error) throw error;
    cachedStats = data && typeof data === "object" ? data : {};
    return cachedStats;
  }

  refreshFromCache = function refreshFromCacheInner() {
    const period = getSelectedPeriod();
    setLabelForPeriod(period);
    if (!cachedStats) {
      textEl.textContent = "...";
      return;
    }
    const raw = cachedStats[period];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "0"), 10) || 0;
    textEl.textContent = formatCount(n);
  };

  async function refreshCount() {
    await fetchStats();
    refreshFromCache();
  }

  el.hidden = false;
  textEl.textContent = "...";
  setLabelForPeriod(getSelectedPeriod());

  const channel = supabase.channel("mj_universe_views", {
    config: { broadcast: { self: true } },
  });

  channel.on("broadcast", { event: "views_tick" }, () => {
    refreshCount().catch(() => {
      textEl.textContent = "-";
    });
  });

  channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") return;
    try {
      await supabase.from("page_views").insert({});
      await channel.send({
        type: "broadcast",
        event: "views_tick",
        payload: { t: Date.now() },
      });
      await refreshCount();
    } catch {
      textEl.textContent = "-";
    }
  });

  setInterval(() => {
    refreshCount().catch(() => {});
  }, 12000);
}

run().catch(() => {
  if (textEl) textEl.textContent = "-";
});
