import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
const key = (window.MJ_SUPABASE_ANON_KEY || "").trim();
const supabase = createClient(url, key);

let channel = null;

function isStaffSession(session) {
  const e = String(session?.user?.email || "").toLowerCase();
  return e.endsWith("@mj-universe.site");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

async function fetchDisplayMap(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc("chat_user_displays", { uids: ids });
  if (!error && Array.isArray(data)) {
    return Object.fromEntries(
      data.map((row) => [row.user_id, { snap: row.snap_label, badge: row.badge || null }])
    );
  }
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, snapchat_username")
    .in("id", ids);
  return Object.fromEntries(
    (profs || []).map((p) => [p.id, { snap: p.snapchat_username, badge: null }])
  );
}

async function fetchRecent() {
  const { data: rows, error } = await supabase
    .from("community_chat_messages")
    .select("id, body, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return { lines: [], error };
  if (!rows?.length) return { lines: [], error: null };
  const chronological = [...rows].reverse();
  const ids = [...new Set(chronological.map((r) => r.user_id))];
  const displayMap = await fetchDisplayMap(ids);
  const lines = chronological.map((r) => {
    const d = displayMap[r.user_id];
    return {
      ...r,
      snap: d?.snap || "ukjent",
      badge: d?.badge || null,
    };
  });
  return { lines, error: null };
}

function render(logEl, lines, showStaffDelete) {
  if (!logEl) return;
  logEl.innerHTML = lines
    .map((r) => {
      const delBtn = showStaffDelete
        ? `<button type="button" class="mj-chat-del" data-id="${esc(
            r.id
          )}" title="Slett melding" aria-label="Slett melding"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`
        : "";
      const badge =
        r.badge && String(r.badge).trim()
          ? `<span class="mj-chat-badge mj-chat-badge--creator">${esc(String(r.badge).trim())}</span>`
          : "";
      return `<div class="mj-chat-line">${delBtn}<span class="mj-chat-line__who">@${esc(
        r.snap
      )}</span>${badge}<span class="mj-chat-line__time">${esc(fmtTime(r.created_at))}</span><br/>${esc(
        r.body
      )}</div>`;
    })
    .join("");
  logEl.scrollTop = logEl.scrollHeight;
}

function teardownChannel() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

async function bindRealtime(logEl, isStaff) {
  teardownChannel();
  const refresh = async () => {
    const next = await fetchRecent();
    render(logEl, next.lines, isStaff);
  };
  channel = supabase
    .channel("mj-community-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "community_chat_messages" },
      refresh
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "community_chat_messages" },
      refresh
    )
    .subscribe();
}

async function applyUi() {
  const logEl = document.getElementById("mj-chat-log");
  const form = document.getElementById("mj-chat-form");
  const input = document.getElementById("mj-chat-input");
  const errEl = document.getElementById("mj-chat-error");
  const gate = document.getElementById("mj-chat-gate");
  const setupEl = document.getElementById("mj-chat-setup");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (setupEl) setupEl.hidden = true;

  if (!session) {
    if (gate) gate.hidden = false;
    if (form) form.hidden = true;
    teardownChannel();
    if (logEl) logEl.innerHTML = "";
    return;
  }

  if (gate) gate.hidden = true;
  if (form) form.hidden = false;

  const isStaff = isStaffSession(session);
  const { lines, error: fetchErr } = await fetchRecent();
  if (fetchErr) {
    const msg = String(fetchErr.message || "").toLowerCase();
    if (
      fetchErr.code === "PGRST205" ||
      fetchErr.code === "42P01" ||
      (msg.includes("schema cache") && msg.includes("community_chat")) ||
      (msg.includes("could not find the table") && msg.includes("community_chat"))
    ) {
      if (setupEl) setupEl.hidden = false;
    }
    if (errEl) errEl.textContent = fetchErr.message;
    if (logEl) logEl.innerHTML = "";
    teardownChannel();
    return;
  }
  if (errEl) errEl.textContent = "";

  render(logEl, lines, isStaff);
  await bindRealtime(logEl, isStaff);

  if (logEl && !logEl.dataset.mjDelBound) {
    logEl.dataset.mjDelBound = "1";
    logEl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".mj-chat-del");
      if (!btn) return;
      const {
        data: { session: s3 },
      } = await supabase.auth.getSession();
      if (!isStaffSession(s3)) return;
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (errEl) errEl.textContent = "";
      const { error: delErr } = await supabase.from("community_chat_messages").delete().eq("id", id);
      if (delErr) {
        if (errEl) errEl.textContent = delErr.message;
        return;
      }
      const next = await fetchRecent();
      render(logEl, next.lines, isStaffSession(s3));
    });
  }

  if (form && !form.dataset.mjBound) {
    form.dataset.mjBound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errEl) errEl.textContent = "";
      const {
        data: { session: s2 },
      } = await supabase.auth.getSession();
      if (!s2) return;
      const body = (input?.value || "").trim();
      if (body.length < 1 || body.length > 500) return;
      const { error } = await supabase.from("community_chat_messages").insert({
        user_id: s2.user.id,
        body,
      });
      if (error) {
        if (errEl) errEl.textContent = error.message;
        return;
      }
      if (input) input.value = "";
      const next = await fetchRecent();
      render(logEl, next.lines, isStaffSession(s2));
    });
  }
}

await applyUi();
supabase.auth.onAuthStateChange(() => {
  applyUi();
});
