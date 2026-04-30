import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = window.MJ_SUPABASE_URL;
const key = window.MJ_SUPABASE_ANON_KEY;
const adminDomain =
  window.MJ_ADMIN_LOGIN_DOMAIN || "mj-universe.site";
const defaultUsername = window.MJ_ADMIN_USERNAME || "mariellogjhonatan";

function loginEmailFromUsername(raw) {
  const u = (raw || defaultUsername).trim().replace(/\s+/g, "").toLowerCase();
  return u + "@" + adminDomain;
}

const supabase = createClient(url, key);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function show(id) {
  $$(".admin-panel").forEach((p) => p.classList.toggle("is-hidden", p.id !== id));
  $$(".admin-nav button").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.panel === id)
  );
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("#login-password").value;
  const em = loginEmailFromUsername($("#login-username").value);
  $("#login-error").textContent = "";
  const { error } = await supabase.auth.signInWithPassword({
    email: em,
    password: pw,
  });
  if (error) {
    $("#login-error").textContent =
      error.message + " · Supabase user email must be: " + em;
    return;
  }
  $("#screen-login").classList.add("is-hidden");
  $("#screen-dash").classList.remove("is-hidden");
  await refreshAll();
});

$("#btn-logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

$$(".admin-nav button").forEach((b) =>
  b.addEventListener("click", () => show(b.dataset.panel))
);

async function refreshAll() {
  show("panel-polls");
  await loadPollsAdmin();
  await loadQuestionsAdmin();
  await loadEventsAdmin();
  await loadMilestonesAdmin();
  await loadLiveAdmin();
  await loadSnapAdmin();
  await loadFitnessAdmin();
  await loadChatAdmin();
  await loadWatchAdmin();
  await loadStoreAdmin();
  await loadTrafficAdmin();
}

async function loadPollsAdmin() {
  const { data: polls } = await supabase
    .from("polls")
    .select("id,question,is_active,created_at")
    .order("created_at", { ascending: false });
  const box = $("#polls-admin-list");
  box.innerHTML = "";
  (polls || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `<div><strong>${esc(p.question)}</strong><br><small>${
      p.is_active ? "ACTIVE" : "inactive"
    } · ${p.id.slice(0, 8)}…</small></div>
      <div class="admin-row-actions">
        <button type="button" class="btn btn--sm" data-activate="${p.id}">Set active</button>
        <button type="button" class="btn btn--sm btn--ghost" data-votes="${p.id}">Votes</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-activate]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-activate");
      const { data: all } = await supabase.from("polls").select("id");
      for (const p of all || []) {
        await supabase
          .from("polls")
          .update({ is_active: p.id === id })
          .eq("id", p.id);
      }
      await loadPollsAdmin();
    })
  );
  box.querySelectorAll("[data-votes]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-votes");
      const { data } = await supabase
        .from("poll_votes")
        .select("voter_name,option_id,created_at")
        .eq("poll_id", id);
      const { data: opts } = await supabase
        .from("poll_options")
        .select("id,label")
        .eq("poll_id", id);
      const map = Object.fromEntries((opts || []).map((o) => [o.id, o.label]));
      const lines = (data || [])
        .map((v) => `${esc(v.voter_name)} → ${esc(map[v.option_id] || "?")}`)
        .join("\n");
      $("#votes-dump").textContent = lines || "(no votes yet)";
    })
  );
}

$("#form-new-poll").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#new-poll-q").value.trim();
  const o1 = $("#new-poll-o1").value.trim();
  const o2 = $("#new-poll-o2").value.trim();
  const o3 = $("#new-poll-o3").value.trim();
  const o4 = $("#new-poll-o4").value.trim();
  const opts = [o1, o2, o3, o4].filter(Boolean);
  if (!q || opts.length < 2) return;
  const { data: poll, error } = await supabase
    .from("polls")
    .insert({ question: q, is_active: false })
    .select("id")
    .single();
  if (error) {
    $("#poll-create-msg").textContent = error.message;
    return;
  }
  const rows = opts.map((label, i) => ({
    poll_id: poll.id,
    label,
    sort_order: i,
  }));
  await supabase.from("poll_options").insert(rows);
  $("#poll-create-msg").textContent = "Poll created. Click “Set active” to show it on the site.";
  $("#form-new-poll").reset();
  await loadPollsAdmin();
});

async function loadQuestionsAdmin() {
  const { data } = await supabase
    .from("visitor_questions")
    .select("id,body,from_name,created_at,answer")
    .order("created_at", { ascending: false });
  const box = $("#questions-admin-list");
  box.innerHTML = "";
  (data || []).forEach((q) => {
    const row = document.createElement("div");
    row.className = "admin-q";
    row.innerHTML = `<p><strong>${esc(q.from_name)}</strong> · ${new Date(
      q.created_at
    ).toLocaleString("nb-NO")}</p><p>${esc(q.body)}</p>
      <textarea class="input" rows="2" data-answer-id="${q.id}" placeholder="Answer…"></textarea>
      <button type="button" class="btn btn--sm btn--primary" data-save-q="${q.id}">Save answer</button>`;
    const ta = row.querySelector("textarea");
    if (ta) ta.value = q.answer || "";
    box.appendChild(row);
  });
  box.querySelectorAll("[data-save-q]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-save-q");
      const ta = box.querySelector(`[data-answer-id="${id}"]`);
      const answer = ta.value.trim();
      await supabase
        .from("visitor_questions")
        .update({
          answer: answer || null,
          answered_at: answer ? new Date().toISOString() : null,
        })
        .eq("id", id);
      btn.textContent = "Saved";
      setTimeout(() => (btn.textContent = "Save answer"), 1500);
    })
  );
}

$("#ev-copy-giveaway-link").addEventListener("click", async () => {
  const el = $("#ev-giveaway-link");
  const v = el.value;
  if (!v) return;
  try {
    await navigator.clipboard.writeText(v);
    $("#ev-copy-giveaway-link").textContent = "Copied";
    setTimeout(() => ($("#ev-copy-giveaway-link").textContent = "Copy link"), 2000);
  } catch {
    el.select();
    document.execCommand("copy");
  }
});

$("#form-new-event").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#ev-create-msg").textContent = "";
  $("#ev-giveaway-link-wrap").hidden = true;
  const title = $("#ev-title").value.trim();
  const body = $("#ev-body").value.trim();
  const event_type = $("#ev-type").value;
  const starts = $("#ev-start").value ? new Date($("#ev-start").value).toISOString() : null;
  const ends = $("#ev-end").value ? new Date($("#ev-end").value).toISOString() : null;
  const winnerRaw = $("#ev-winner-slots").value.trim();
  let winner_slots = null;
  if (event_type === "giveaway") {
    if (!body || body.length < 2) {
      $("#ev-create-msg").textContent = "Giveaway: fill in the prize in the description field (shown to entrants).";
      return;
    }
    const n = parseInt(winnerRaw, 10);
    if (Number.isNaN(n) || n < 1 || n > 50) {
      $("#ev-create-msg").textContent = "Giveaway: set number of winners between 1 and 50 (fair draw among all entries).";
      return;
    }
    winner_slots = n;
  }
  const row = {
    title,
    body: body || null,
    event_type,
    starts_at: starts,
    ends_at: ends,
    is_active: true,
  };
  if (event_type === "giveaway") row.winner_slots = winner_slots;
  const { data: evRow, error } = await supabase.from("events").insert(row).select("id").single();
  if (error) {
    $("#ev-create-msg").textContent = error.message;
    return;
  }
  $("#form-new-event").reset();
  if (event_type === "giveaway" && evRow?.id) {
    $("#ev-giveaway-link").value = giveawayStandaloneUrl(evRow.id);
    $("#ev-giveaway-link-wrap").hidden = false;
    $("#ev-create-msg").textContent =
      "Giveaway saved. Copy the link below and post it on Snapchat.";
  } else {
    $("#ev-create-msg").textContent = "Event added.";
  }
  await loadEventsAdmin();
});

async function loadEventsAdmin() {
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  const box = $("#events-admin-list");
  box.innerHTML = "";
  (data || []).forEach((ev) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    const slotsHint =
      ev.event_type === "giveaway" && ev.winner_slots != null
        ? ` · ${esc(String(ev.winner_slots))} winner(s) to draw`
        : "";
    const copyLinkBtn =
      ev.event_type === "giveaway"
        ? `<button type="button" class="btn btn--sm" data-copy-gw="${ev.id}">Copy link</button>`
        : "";
    const entriesBtn =
      ev.event_type === "giveaway"
        ? `<button type="button" class="btn btn--sm" data-giveaway-entries="${ev.id}">Entries</button>`
        : "";
    row.innerHTML = `<div><strong>${esc(ev.title)}</strong> (${ev.event_type})<br><small>active: ${
      ev.is_active
    }${slotsHint} · ${ev.id.slice(0, 8)}…</small></div>
      <div class="admin-row-actions">${copyLinkBtn}${entriesBtn}<button type="button" class="btn btn--sm btn--ghost" data-del-event="${ev.id}">Delete</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-del-event]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await supabase.from("events").delete().eq("id", btn.getAttribute("data-del-event"));
      await loadEventsAdmin();
    })
  );
  box.querySelectorAll("[data-copy-gw]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-copy-gw");
      const url = giveawayStandaloneUrl(id);
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy link"), 2000);
      } catch {
        prompt("Copy this URL:", url);
      }
    })
  );
  box.querySelectorAll("[data-giveaway-entries]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-giveaway-entries");
      const { data: evMeta } = await supabase
        .from("events")
        .select("ends_at,winner_slots,is_active,title")
        .eq("id", id)
        .maybeSingle();
      const { data, error: entriesError } = await supabase
        .from("giveaway_entries")
        .select("snap_username,reaction_emoji,created_at")
        .eq("event_id", id)
        .order("created_at", { ascending: true });
      if (entriesError) {
        $("#giveaway-entries-dump").textContent =
          `Could not load entries: ${entriesError.message}\n\n` +
          "If you see “relation … does not exist” or permission errors, run in Supabase SQL Editor:\n" +
          "• setup-giveaway-entries.sql\n" +
          "• then fix-supabase-admin-and-api.sql";
        return;
      }
      const entries = data || [];
      const lines = entries.map(
        (r, i) =>
          `${i + 1}. @${String(r.snap_username)}  ·  ${new Date(r.created_at).toLocaleString("nb-NO")}${
            r.reaction_emoji && r.reaction_emoji !== "🎁" ? `  (${r.reaction_emoji})` : ""
          }`
      );
      let out =
        lines.join("\n") ||
        "No entries yet — share the giveaway link (Copy link) on Snapchat. People sign up on giveaway.html.";
      const now = new Date();
      const ended =
        !evMeta?.is_active ||
        (evMeta.ends_at && new Date(evMeta.ends_at) < now);
      if (ended && entries.length && evMeta) {
        out += "\n\n--- GIVEAWAY ENDED — pick winners fairly ---\n";
        const ws = evMeta.winner_slots;
        out += `All ${entries.length} entrants (same odds — do not use signup order as “winners”):\n`;
        entries.forEach((r, i) => {
          out += `  ${i + 1}. @${String(r.snap_username)}\n`;
        });
        if (ws != null && ws >= 1) {
          out += `\nYou planned ${ws} winner(s). Use any fair random draw among the full list above.\n`;
        } else {
          out +=
            "\n(No “number of winners” was set — pick how many you want and draw fairly among everyone.)\n";
        }
      } else if (entries.length && evMeta?.winner_slots != null && evMeta.winner_slots >= 1) {
        out += `\n\n--- Note ---\n`;
        out += `You will draw ${evMeta.winner_slots} winner(s) fairly from all ${entries.length} entrants (not “first to sign up wins”).\n`;
      }
      $("#giveaway-entries-dump").textContent = out;
    })
  );
}

$("#form-new-milestone").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#ms-title").value.trim();
  const body = $("#ms-body").value.trim();
  const milestone_date = $("#ms-date").value;
  if (!title || !milestone_date) return;
  const { data: last } = await supabase
    .from("milestones")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;
  await supabase.from("milestones").insert({
    title,
    body: body || null,
    milestone_date,
    sort_order,
  });
  $("#form-new-milestone").reset();
  await loadMilestonesAdmin();
});

async function loadLiveAdmin() {
  $("#live-save-msg").textContent = "";
  const { data, error } = await supabase
    .from("site_live_status")
    .select("is_live,embed_url,tiktok_username,tiktok_username_secondary")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    $("#live-save-msg").textContent = error.message;
    return;
  }
  if (data) {
    $("#live-is-live").checked = !!data.is_live;
    $("#live-tiktok-user").value = data.tiktok_username || "";
    $("#live-tiktok-user-2").value = data.tiktok_username_secondary || "";
    $("#live-embed-url").value = data.embed_url || "";
  }
}

$("#form-live-status").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#live-save-msg").textContent = "";
  const isLive = $("#live-is-live").checked;
  const tiktok = $("#live-tiktok-user").value.trim().replace(/^@+/, "");
  const tiktok2 = $("#live-tiktok-user-2").value.trim().replace(/^@+/, "");
  const embedRaw = $("#live-embed-url").value.trim();
  const { error } = await supabase.from("site_live_status").upsert(
    {
      id: 1,
      is_live: isLive,
      tiktok_username: tiktok || null,
      tiktok_username_secondary: tiktok2 || null,
      embed_url: embedRaw || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    $("#live-save-msg").textContent = error.message;
    return;
  }
  $("#live-save-msg").textContent = "Saved. Homepage and live page update within ~1 minute for visitors (or on refresh).";
});

function parseMetricNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const t = s.toLowerCase().replace(/\s/g, "").replace(/\u00a0/g, "");
  const mMatch = t.match(/^([0-9]+[.,]?[0-9]*)m$/);
  if (mMatch) {
    const n = parseFloat(mMatch[1].replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1e6) : null;
  }
  const kMatch = t.match(/^([0-9]+[.,]?[0-9]*)k$/);
  if (kMatch) {
    const n = parseFloat(kMatch[1].replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  const digits = t.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const num = parseInt(digits, 10);
  return Number.isFinite(num) ? num : null;
}

function formatMetricDelta(oldN, newN) {
  const d = newN - oldN;
  if (d === 0) return "Uendret vs. forrige lagring";
  const abs = new Intl.NumberFormat("nb-NO").format(Math.abs(d));
  const sign = d > 0 ? "+" : "−";
  let pct = "";
  if (oldN !== 0 && Number.isFinite(oldN)) {
    const p = Math.round((d / oldN) * 100);
    if (Number.isFinite(p)) pct = ` (${sign}${Math.abs(p)} %)`;
  }
  return `${sign}${abs} vs. forrige lagring${pct}`;
}

function computeViewDelta(prevRaw, nextRaw) {
  const oldN = parseMetricNumber(prevRaw);
  const newN = parseMetricNumber(nextRaw);
  if (oldN != null && newN != null) return formatMetricDelta(oldN, newN);
  if (oldN == null && newN != null) return "Ny verdi (ingen tidligere tall å sammenligne med)";
  return null;
}

function mergeSnapField(sel, key, base) {
  const el = $(sel);
  const t = (el && el.value) ? el.value.trim() : "";
  if (t === "") {
    const prev = base[key];
    return { value: prev != null && prev !== "" ? prev : null, changed: false };
  }
  const prevStr = base[key] != null ? String(base[key]) : "";
  return { value: t, changed: t !== prevStr };
}

async function loadSnapAdmin() {
  $("#snap-save-msg").textContent = "";
  const { data, error } = await supabase
    .from("site_snap_stats")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    $("#snap-save-msg").textContent =
      error.message;
    return;
  }
  if (data) {
    $("#snap-username").value = data.snapchat_username || "";
    $("#snap-metric-views").value = data.metric_story_views_7d || "";
    $("#snap-metric-views-30").value = data.metric_story_views_30d || "";
    $("#snap-metric-views-90").value = data.metric_story_views_90d || "";
    $("#snap-metric-views-all").value = data.metric_story_views_all_time || "";
    $("#snap-metric-engagement").value = data.metric_engagement || "";
    $("#snap-metric-subs").value = data.metric_subscribers || "";
    $("#snap-insights-note").value = data.insights_note || "";
  }
}

$("#form-snap-stats").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#snap-save-msg").textContent = "";
  const { data: cur, error: loadErr } = await supabase
    .from("site_snap_stats")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (loadErr) {
    $("#snap-save-msg").textContent = loadErr.message;
    return;
  }
  const base = cur || {};

  const u = $("#snap-username").value.trim().replace(/^@+/, "");
  const snapchat_username =
    u !== "" ? u : (base.snapchat_username != null && base.snapchat_username !== "" ? base.snapchat_username : "mj_universe");

  const m7 = mergeSnapField("#snap-metric-views", "metric_story_views_7d", base);
  const m30 = mergeSnapField("#snap-metric-views-30", "metric_story_views_30d", base);
  const m90 = mergeSnapField("#snap-metric-views-90", "metric_story_views_90d", base);
  const mall = mergeSnapField("#snap-metric-views-all", "metric_story_views_all_time", base);
  const meng = mergeSnapField("#snap-metric-engagement", "metric_engagement", base);
  const msubs = mergeSnapField("#snap-metric-subs", "metric_subscribers", base);
  const note = mergeSnapField("#snap-insights-note", "insights_note", base);

  const d7 =
    m7.changed ? computeViewDelta(base.metric_story_views_7d, m7.value) : null;
  const d30 =
    m30.changed ? computeViewDelta(base.metric_story_views_30d, m30.value) : null;
  const d90 =
    m90.changed ? computeViewDelta(base.metric_story_views_90d, m90.value) : null;
  const dall =
    mall.changed ? computeViewDelta(base.metric_story_views_all_time, mall.value) : null;

  const row = {
    id: 1,
    snapchat_username,
    metric_story_views_7d: m7.value,
    metric_story_views_30d: m30.value,
    metric_story_views_90d: m90.value,
    metric_story_views_all_time: mall.value,
    metric_engagement: meng.value,
    metric_subscribers: msubs.value,
    insights_note: note.value,
    metric_story_views_7d_delta: m7.changed
      ? d7
      : base.metric_story_views_7d_delta ?? null,
    metric_story_views_30d_delta: m30.changed
      ? d30
      : base.metric_story_views_30d_delta ?? null,
    metric_story_views_90d_delta: m90.changed
      ? d90
      : base.metric_story_views_90d_delta ?? null,
    metric_story_views_all_time_delta: mall.changed
      ? dall
      : base.metric_story_views_all_time_delta ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("site_snap_stats").upsert(row, { onConflict: "id" });
  if (error) {
    $("#snap-save-msg").textContent = error.message;
    return;
  }
  $("#snap-save-msg").textContent =
    "Lagret. Tomme felt ble ikke overskrevet. Snapchat-siden oppdateres ved oppdatering.";
  await loadSnapAdmin();
});

function slugifyTitle(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function loadFitnessAdmin() {
  $("#fitness-season-msg").textContent = "";
  $("#fitness-ep-msg").textContent = "";
  const { data: seasons, error: e1 } = await supabase
    .from("fitness_seasons")
    .select("*")
    .order("sort_order", { ascending: true });
  if (e1) {
    $("#fitness-season-msg").textContent = e1.message;
    return;
  }
  const { data: episodes, error: e2 } = await supabase.from("fitness_episodes").select("*");
  if (e2) {
    $("#fitness-season-msg").textContent = e2.message;
    return;
  }
  const epsSorted = (episodes || []).slice().sort((a, b) => {
    const sa = String(a.season_id);
    const sb = String(b.season_id);
    if (sa !== sb) return sa.localeCompare(sb);
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.episode_number - b.episode_number;
  });

  const sel = $("#ep-season-id");
  sel.innerHTML = "";
  (seasons || []).forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = `${s.title} (${s.slug})${s.is_published ? "" : " — draft"}`;
    sel.appendChild(o);
  });
  if (!seasons?.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "(ingen sesong — opprett først)";
    sel.appendChild(o);
  }

  const bySeason = Object.fromEntries((seasons || []).map((s) => [s.id, []]));
  epsSorted.forEach((ep) => {
    if (bySeason[ep.season_id]) bySeason[ep.season_id].push(ep);
  });

  const box = $("#fitness-admin-list");
  box.innerHTML = "";
  (seasons || []).forEach((s) => {
    const wrap = document.createElement("div");
    wrap.className = "admin-stack";
    wrap.style.marginBottom = "1.25rem";
    const head = document.createElement("div");
    head.className = "admin-row";
    head.innerHTML = `<div><strong>${esc(s.title)}</strong><br><small>slug: ${esc(s.slug)} · ${
      s.is_published ? "published" : "draft"
    }</small></div>
      <button type="button" class="btn btn--sm btn--ghost" data-del-season="${s.id}">Delete season</button>`;
    wrap.appendChild(head);
    (bySeason[s.id] || []).forEach((ep) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<div>Ep ${ep.episode_number}: ${esc(ep.title)}${
        ep.is_published ? "" : " (draft)"
      }</div>
        <button type="button" class="btn btn--sm btn--ghost" data-del-ep="${ep.id}">Delete episode</button>`;
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
  });

  box.querySelectorAll("[data-del-season]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this season and all its episodes?")) return;
      await supabase.from("fitness_seasons").delete().eq("id", btn.getAttribute("data-del-season"));
      await loadFitnessAdmin();
    })
  );
  box.querySelectorAll("[data-del-ep]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this episode?")) return;
      await supabase.from("fitness_episodes").delete().eq("id", btn.getAttribute("data-del-ep"));
      await loadFitnessAdmin();
    })
  );
}

async function loadTrafficAdmin() {
  const msg = $("#traffic-msg");
  const tbody = $("#traffic-tbody");
  const table = $("#traffic-table");
  if (!tbody || !table) return;
  const { data, error } = await supabase.rpc("views_stats");
  if (error) {
    if (msg) msg.textContent = error.message;
    table.hidden = true;
    return;
  }
  if (msg) msg.textContent = "";
  const d = data && typeof data === "object" ? data : {};
  const rows = [
    ["Siste 24 timer", d.h24],
    ["Siste 7 dager", d.d7],
    ["Siste 14 dager", d.d14],
    ["Siste 30 dager", d.d30],
    ["Siste 90 dager", d.d90],
    ["Siste 180 dager", d.d180],
    ["Siste 12 måneder", d.mo12],
    ["All time (alt lagret)", d.all],
  ];
  tbody.innerHTML = rows
    .map(
      ([label, v]) =>
        `<tr><td>${esc(label)}</td><td>${esc(
          new Intl.NumberFormat("nb-NO").format(Number(v) || 0)
        )}</td></tr>`
    )
    .join("");
  table.hidden = false;
}

async function fetchChatDisplayMapForAdmin(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc("chat_user_displays", { uids: ids });
  if (!error && Array.isArray(data)) {
    return Object.fromEntries(
      data.map((row) => [row.user_id, { snap: row.snap_label, badge: row.badge || null }])
    );
  }
  const { data: profs } = await supabase.from("profiles").select("id, snapchat_username").in("id", ids);
  return Object.fromEntries(
    (profs || []).map((p) => [p.id, { snap: p.snapchat_username, badge: null }])
  );
}

async function loadChatAdmin() {
  const box = $("#chat-admin-list");
  if (!box) return;
  const { data, error } = await supabase
    .from("community_chat_messages")
    .select("id, body, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
    return;
  }
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const displayMap = await fetchChatDisplayMapForAdmin(ids);
  box.innerHTML = "";
  rows.forEach((m) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    const d = displayMap[m.user_id];
    const snap = d?.snap || String(m.user_id || "").slice(0, 8);
    const badge =
      d?.badge && String(d.badge).trim()
        ? `<span class="admin-chat-badge admin-chat-badge--creator">${esc(String(d.badge).trim())}</span> `
        : "";
    row.innerHTML = `<div>${badge}<strong>@${esc(snap)}</strong><br>${esc(m.body)}<br><small>${esc(
      m.created_at
    )}</small></div>
      <button type="button" class="btn btn--sm btn--ghost" data-del-chat="${m.id}">Slett</button>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-del-chat]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Slette denne meldingen?")) return;
      await supabase.from("community_chat_messages").delete().eq("id", btn.getAttribute("data-del-chat"));
      await loadChatAdmin();
    })
  );
}

async function loadWatchAdmin() {
  const box = $("#watch-admin-list");
  if (!box) return;
  const { data, error } = await supabase
    .from("watch_videos")
    .select("id, slug, title, content_kind, is_published, sort_order")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
    return;
  }
  box.innerHTML = "";
  (data || []).forEach((w) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `<div><strong>${esc(w.title)}</strong><br><small><code>${esc(w.slug)}</code> · ${esc(
      w.content_kind
    )} · ${w.is_published ? "publisert" : "utkast"}</small></div>
      <div class="admin-row-actions">
        <button type="button" class="btn btn--sm" data-toggle-watch="${w.id}">${
      w.is_published ? "Avpubliser" : "Publiser"
    }</button>
        <button type="button" class="btn btn--sm btn--ghost" data-del-watch="${w.id}">Slett</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-toggle-watch]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-watch");
      const { data: row } = await supabase.from("watch_videos").select("is_published").eq("id", id).single();
      await supabase.from("watch_videos").update({ is_published: !row?.is_published }).eq("id", id);
      await loadWatchAdmin();
    })
  );
  box.querySelectorAll("[data-del-watch]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Slette denne videoen?")) return;
      await supabase.from("watch_videos").delete().eq("id", btn.getAttribute("data-del-watch"));
      await loadWatchAdmin();
    })
  );
}

async function loadStoreAdmin() {
  const plist = $("#store-products-list");
  const olist = $("#store-orders-list");
  if (!plist || !olist) return;
  const { data: products, error: e1 } = await supabase
    .from("store_products")
    .select("id, slug, title, price_cents, is_active")
    .order("sort_order", { ascending: true });
  if (e1) {
    plist.innerHTML = `<p class="muted">${esc(e1.message)}</p>`;
    return;
  }
  plist.innerHTML = "";
  (products || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `<div><strong>${esc(p.title)}</strong><br><small>${esc(p.slug)} · ${(p.price_cents / 100).toFixed(
      0
    )} NOK · ${p.is_active ? "aktiv" : "inaktiv"}</small></div>
      <div class="admin-row-actions">
        <button type="button" class="btn btn--sm" data-toggle-prod="${p.id}">${p.is_active ? "Deaktiver" : "Aktiver"}</button>
        <button type="button" class="btn btn--sm btn--ghost" data-del-prod="${p.id}">Slett</button>
      </div>`;
    plist.appendChild(row);
  });
  plist.querySelectorAll("[data-toggle-prod]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-prod");
      const { data: row } = await supabase.from("store_products").select("is_active").eq("id", id).single();
      await supabase.from("store_products").update({ is_active: !row?.is_active }).eq("id", id);
      await loadStoreAdmin();
    })
  );
  plist.querySelectorAll("[data-del-prod]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Slette produkt?")) return;
      await supabase.from("store_products").delete().eq("id", btn.getAttribute("data-del-prod"));
      await loadStoreAdmin();
    })
  );

  const { data: orders } = await supabase
    .from("store_orders")
    .select("id, status, created_at, user_id, product_id")
    .order("created_at", { ascending: false })
    .limit(50);
  const pmap = Object.fromEntries((products || []).map((p) => [p.id, p.title]));
  olist.innerHTML = "";
  (orders || []).forEach((o) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `<div><strong>${esc(pmap[o.product_id] || o.product_id)}</strong><br><small>${esc(
      o.status
    )} · ${esc(o.created_at)} · bruker ${esc(String(o.user_id).slice(0, 8))}…</small></div>`;
    olist.appendChild(row);
  });
}

$("#form-watch-video")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#watch-msg");
  if (msg) msg.textContent = "";
  const slug = $("#watch-slug").value.trim().toLowerCase();
  const title = $("#watch-title").value.trim();
  const youtube = $("#watch-youtube").value.trim();
  const videoFile = $("#watch-video-file").value.trim();
  const ltik = $("#watch-tiktok").value.trim();
  const lig = $("#watch-instagram").value.trim();
  const lsnap = $("#watch-snap").value.trim();
  if (!slug || !title) return;
  if (!youtube && !videoFile && !ltik && !lig && !lsnap) {
    if (msg) msg.textContent = "Fyll inn minst én kilde: embed-URL, video-URL (mp4) eller lenke.";
    return;
  }
  const { error } = await supabase.from("watch_videos").insert({
    slug,
    title,
    description: $("#watch-desc").value.trim() || null,
    youtube_embed_url: youtube || null,
    video_file_url: videoFile || null,
    link_tiktok: ltik || null,
    link_instagram: lig || null,
    link_snap: lsnap || null,
    content_kind: $("#watch-kind").value || "vlog",
    is_published: $("#watch-published").checked,
    sort_order: Number($("#watch-sort").value) || 0,
  });
  if (error) {
    if (msg) msg.textContent = error.message;
    return;
  }
  e.target.reset();
  $("#watch-sort").value = "0";
  $("#watch-published").checked = true;
  if (msg) msg.textContent = "Video lagt til.";
  await loadWatchAdmin();
});

$("#form-store-product")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#store-prod-msg");
  if (msg) msg.textContent = "";
  const slug = $("#prod-slug").value.trim().toLowerCase().replace(/\s+/g, "-");
  const title = $("#prod-title").value.trim();
  const nok = Math.max(0, parseInt($("#prod-price-nok").value, 10) || 0);
  if (!slug || !title) return;
  const { error } = await supabase.from("store_products").insert({
    slug,
    title,
    description: $("#prod-desc").value.trim() || null,
    price_cents: nok * 100,
    is_active: $("#prod-active").checked,
    sort_order: Number($("#prod-sort").value) || 0,
  });
  if (error) {
    if (msg) msg.textContent = error.message;
    return;
  }
  e.target.reset();
  $("#prod-sort").value = "0";
  $("#prod-active").checked = true;
  if (msg) msg.textContent = "Produkt lagt til.";
  await loadStoreAdmin();
});

$("#form-fitness-season").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#fitness-season-msg").textContent = "";
  const title = $("#new-season-title").value.trim();
  if (!title) return;
  let slug = $("#new-season-slug").value.trim();
  if (!slug) slug = slugifyTitle(title);
  if (!slug) {
    $("#fitness-season-msg").textContent = "Could not create slug from title.";
    return;
  }
  const { error } = await supabase.from("fitness_seasons").insert({
    title,
    slug,
    description: $("#new-season-desc").value.trim() || null,
    sort_order: Number($("#new-season-sort").value) || 0,
    is_published: $("#new-season-published").checked,
  });
  if (error) {
    $("#fitness-season-msg").textContent = error.message;
    return;
  }
  $("#form-fitness-season").reset();
  $("#new-season-sort").value = "0";
  $("#fitness-season-msg").textContent = "Season added.";
  await loadFitnessAdmin();
});

$("#form-fitness-episode").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#fitness-ep-msg").textContent = "";
  const seasonId = $("#ep-season-id").value;
  if (!seasonId) {
    $("#fitness-ep-msg").textContent = "Create a season first.";
    return;
  }
  const title = $("#ep-title").value.trim();
  if (!title) return;
  const { error } = await supabase.from("fitness_episodes").insert({
    season_id: seasonId,
    title,
    episode_number: Math.max(1, parseInt($("#ep-num").value, 10) || 1),
    sort_order: Number($("#ep-sort").value) || 0,
    body: $("#ep-body").value.trim() || null,
    video_url: $("#ep-video-url").value.trim() || null,
    youtube_embed_url: $("#ep-youtube").value.trim() || null,
    snap_story_url: $("#ep-snap").value.trim() || null,
    link_tiktok: $("#ep-tiktok").value.trim() || null,
    link_instagram: $("#ep-instagram").value.trim() || null,
    thumbnail_url: $("#ep-thumb").value.trim() || null,
    is_published: $("#ep-published").checked,
    published_at: $("#ep-published").checked ? new Date().toISOString() : null,
  });
  if (error) {
    $("#fitness-ep-msg").textContent = error.message;
    return;
  }
  $("#form-fitness-episode").reset();
  $("#ep-num").value = "1";
  $("#ep-sort").value = "0";
  $("#ep-published").checked = true;
  $("#fitness-ep-msg").textContent = "Episode added.";
  await loadFitnessAdmin();
});

async function loadMilestonesAdmin() {
  const { data } = await supabase
    .from("milestones")
    .select("*")
    .order("sort_order", { ascending: true });
  const box = $("#milestones-admin-list");
  box.innerHTML = "";
  (data || []).forEach((m) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `<div><strong>${esc(m.title)}</strong> · ${m.milestone_date}</div>
      <button type="button" class="btn btn--sm btn--ghost" data-del-ms="${m.id}">Delete</button>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-del-ms]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await supabase.from("milestones").delete().eq("id", btn.getAttribute("data-del-ms"));
      await loadMilestonesAdmin();
    })
  );
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function publicBaseUrl() {
  const b = String(window.MJ_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (b) return b;
  return window.location.origin;
}

function giveawayStandaloneUrl(eventId) {
  return `${publicBaseUrl()}/giveaway.html?g=${eventId}`;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    $("#screen-dash").classList.add("is-hidden");
    $("#screen-login").classList.remove("is-hidden");
  }
  if (session?.user) {
    $("#screen-login").classList.add("is-hidden");
    $("#screen-dash").classList.remove("is-hidden");
    refreshAll();
  }
});

const {
  data: { session: initial },
} = await supabase.auth.getSession();
if (initial?.user) {
  $("#screen-login").classList.add("is-hidden");
  $("#screen-dash").classList.remove("is-hidden");
  await refreshAll();
}
