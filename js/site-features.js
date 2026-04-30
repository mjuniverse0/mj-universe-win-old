(function () {
  const SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  const KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
  const ok =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL) &&
    KEY.length > 20 &&
    (KEY.startsWith("sb_publishable_") || KEY.startsWith("eyJ"));

  const TOGETHER_START = new Date(2022, 6, 23);

  function completedAnniversaryYears(now) {
    const startY = TOGETHER_START.getFullYear();
    let n = 0;
    for (let y = startY + 1; y <= now.getFullYear(); y++) {
      const ann = new Date(y, 6, 23);
      if (ann <= now) n++;
    }
    return n;
  }

  function nextAnniversary(now) {
    const y = now.getFullYear();
    let next = new Date(y, 6, 23);
    if (next <= now) next = new Date(y + 1, 6, 23);
    return next;
  }

  function formatLong(d) {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function updateTogetherText() {
    const now = new Date();
    const years = completedAnniversaryYears(now);
    const next = nextAnniversary(now);
    const elAbout = document.getElementById("together-summary");
    const elHero = document.getElementById("hero-together-text");
    const ann = `We have completed <strong>${years}</strong> full year${
      years === 1 ? "" : "s"
    } together (each new year together starts on <strong>23 July</strong>). Next anniversary: <strong>${formatLong(
      next
    )}</strong>.`;
    const short = `${years} year${years === 1 ? "" : "s"} together · next: ${formatLong(next)}`;
    if (elAbout) {
      elAbout.innerHTML = `We are two self-proclaimed idiots, born in <strong>2006</strong> and <strong>2007</strong>. ${ann}`;
    }
    if (elHero) elHero.innerHTML = short;
  }

  function deviceId() {
    const k = "mj_device_id";
    let id = localStorage.getItem(k);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(k, id);
    }
    return id;
  }

  function normalizeSnap(raw) {
    let s = String(raw || "").trim();
    if (s.startsWith("@")) s = s.slice(1);
    return s.toLowerCase();
  }

  function snapValid(s) {
    return s.length >= 2 && s.length <= 32 && /^[a-zA-Z0-9._-]+$/.test(s);
  }

  const GIVEAWAY_ROSTER_MS = 3000;

  async function fetchGiveawayPublicRoster(eventId) {
    const r = await rest("/rest/v1/rpc/get_giveaway_public_roster", {
      method: "POST",
      body: JSON.stringify({ p_event_id: eventId }),
    });
    if (!r.ok) return null;
    return r.json().catch(() => null);
  }

  function renderGiveawayRosterSection(sectionEl, data) {
    if (!sectionEl) return;
    const countEl = sectionEl.querySelector(".giveaway-roster-count");
    const ul = sectionEl.querySelector(".giveaway-roster-list");
    if (!data || !data.ok) {
      if (countEl) countEl.textContent = "";
      if (ul) ul.innerHTML = "";
      return;
    }
    const n = Number(data.count) || 0;
    if (countEl) {
      countEl.textContent =
        n === 0 ? "No one yet" : n === 1 ? "1 person" : `${n} people`;
    }
    if (!ul) return;
    ul.innerHTML = "";
    const list = Array.isArray(data.entrants) ? data.entrants : [];
    list.forEach((ent) => {
      const li = document.createElement("li");
      li.className = "giveaway-roster-li";
      li.textContent = `@${String(ent.snap_username || "")}`;
      ul.appendChild(li);
    });
  }

  function startGiveawayRosterPoll(sectionEl, eventId) {
    if (!sectionEl) return;
    const tick = async () => {
      const data = await fetchGiveawayPublicRoster(eventId);
      renderGiveawayRosterSection(sectionEl, data);
    };
    if (sectionEl._mjRosterTimer) clearInterval(sectionEl._mjRosterTimer);
    tick();
    sectionEl._mjRosterTimer = setInterval(tick, GIVEAWAY_ROSTER_MS);
  }

  function bindGiveawayEntry(wrap, eventId) {
    const snapInput = wrap.querySelector(".giveaway-snap");
    const msg = wrap.querySelector(".giveaway-msg");
    const btn = wrap.querySelector(".giveaway-enter-btn");
    const card = wrap.closest(".event-card");
    const rosterSection = card ? card.querySelector(".giveaway-roster") : null;

    async function submitEntry() {
      if (!msg || !snapInput || !btn || wrap.classList.contains("giveaway-enter--done")) return;
      msg.textContent = "";
      msg.classList.remove("giveaway-msg--ok");
      msg.classList.add("form-error");
      const snap = normalizeSnap(snapInput.value);
      if (!snapValid(snap)) {
        msg.textContent =
          "Enter your Snapchat username (letters, numbers, _ . - only, 2–32 characters).";
        snapInput.focus();
        return;
      }

      btn.disabled = true;
      const ins = await rest("/rest/v1/rpc/giveaway_enter", {
        method: "POST",
        body: JSON.stringify({
          p_event_id: eventId,
          p_device_id: deviceId(),
          p_snap_username: snap,
          p_reaction_emoji: null,
        }),
      });

      const rpcBody = await ins.json().catch(() => ({}));
      btn.disabled = false;

      if (ins.ok && rpcBody?.ok === true) {
        wrap.classList.add("giveaway-enter--done");
        msg.classList.remove("form-error");
        msg.classList.add("giveaway-msg--ok");
        const pos = rpcBody.position;
        const nWin =
          rpcBody.winner_count != null
            ? Number(rpcBody.winner_count)
            : rpcBody.winner_slots != null
              ? Number(rpcBody.winner_slots)
              : null;
        let line =
          "You're in! Good luck — we'll reach out on Snapchat if you win.";
        if (nWin === 1) {
          line = `You're in (#${pos} in signup order — for reference only). One winner will be picked at random from everyone when the giveaway ends.`;
        } else if (nWin != null && nWin >= 1) {
          line = `You're in (#${pos} in signup order — for reference only). We'll draw ${nWin} winners fairly from all entries when the giveaway ends.`;
        } else if (pos != null) {
          line = `You're in (#${pos}). Good luck — we'll reach out on Snapchat if you win.`;
        }
        msg.textContent = line;
        snapInput.disabled = true;
        btn.disabled = true;
        if (rosterSection) {
          const data = await fetchGiveawayPublicRoster(eventId);
          renderGiveawayRosterSection(rosterSection, data);
        }
        return;
      }

      if (rpcBody?.error === "duplicate") {
        msg.textContent = "You already entered this giveaway from this device.";
        return;
      }
      if (rpcBody?.error === "event_not_available") {
        msg.textContent = "This giveaway is not open for entries right now.";
        return;
      }
      if (rpcBody?.error === "giveaway_not_configured") {
        msg.textContent =
          "This giveaway is not fully set up yet (prize or number of winners).";
        return;
      }
      msg.textContent =
        "Could not send entry. Ask the host to run the latest giveaway SQL in Supabase.";
    }

    if (btn) btn.addEventListener("click", submitEntry);
    if (snapInput) {
      snapInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitEntry();
        }
      });
    }
  }

  function headers() {
    return {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
    };
  }

  async function rest(path, opts) {
    const res = await fetch(SB_URL + path, {
      ...opts,
      headers: { ...headers(), ...opts.headers },
    });
    return res;
  }

  function emptyStateHtml(iconClass, title, text) {
    return `<div class="empty-state" role="status"><div class="empty-state__icon"><i class="${iconClass}" aria-hidden="true"></i></div><p class="empty-state__title">${escapeHtml(
      title
    )}</p><p class="empty-state__text">${escapeHtml(text)}</p></div>`;
  }

  async function loadPoll() {
    const wrap = document.getElementById("section-poll");
    const ph = document.getElementById("poll-placeholder");
    if (!wrap || !ok) return;

    const pr = await rest(
      "/rest/v1/polls?is_active=eq.true&select=id,question&limit=1",
      {}
    );
    if (!pr.ok) {
      if (ph) ph.hidden = false;
      wrap.hidden = true;
      return;
    }
    const polls = await pr.json();
    if (!polls.length) {
      if (ph) ph.hidden = false;
      wrap.hidden = true;
      return;
    }
    const poll = polls[0];
    const or = await rest(
      `/rest/v1/poll_options?poll_id=eq.${poll.id}&select=id,label,sort_order&order=sort_order.asc`,
      {}
    );
    if (!or.ok) {
      if (ph) ph.hidden = false;
      wrap.hidden = true;
      return;
    }
    const options = await or.json();
    if (ph) ph.hidden = true;
    wrap.hidden = false;

    const title = wrap.querySelector(".js-poll-question");
    const form = wrap.querySelector(".js-poll-form");
    const results = wrap.querySelector(".js-poll-results");
    const err = wrap.querySelector(".js-poll-error");
    if (title) title.textContent = poll.question;
    if (form) {
      form.innerHTML = "";
      options.forEach((o) => {
        const id = `opt-${o.id}`;
        const lab = document.createElement("label");
        lab.className = "choice";
        lab.innerHTML = `<input type="radio" name="poll_option" value="${o.id}" id="${id}" required /> <span>${escapeHtml(
          o.label
        )}</span>`;
        form.appendChild(lab);
      });
      const stepHint = document.createElement("p");
      stepHint.className = "poll-flow-hint";
      stepHint.textContent =
        "Choose an option above, then your name and Vote. If you don’t see Yes/No (or other choices), scroll up a little on the page.";
      form.appendChild(stepHint);
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.name = "voter_name";
      nameInput.className = "input";
      nameInput.placeholder = "Your name or nickname (required)";
      nameInput.required = true;
      nameInput.maxLength = 80;
      nameInput.autocomplete = "nickname";
      form.appendChild(nameInput);
      const btn = document.createElement("button");
      btn.type = "submit";
      btn.className = "btn btn--primary btn--touch-submit";
      btn.textContent = "Vote";
      form.appendChild(btn);
      form.onsubmit = async (e) => {
        e.preventDefault();
        err.textContent = "";
        const fd = new FormData(form);
        const optionId = fd.get("poll_option");
        const voterName = String(fd.get("voter_name") || "").trim();
        if (!optionId || !voterName) return;
        const ins = await rest("/rest/v1/poll_votes", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            poll_id: poll.id,
            option_id: optionId,
            voter_name: voterName,
            device_id: deviceId(),
          }),
        });
        if (ins.ok) {
          form.classList.add("is-hidden");
          await showResults(poll.id, results);
          return;
        }
        const errBody = await ins.json().catch(() => ({}));
        if (
          ins.status === 409 ||
          errBody?.code === "23505" ||
          String(errBody?.message || "").toLowerCase().includes("duplicate")
        ) {
          err.textContent =
            "You already voted from this device. One vote per device.";
          return;
        }
        err.textContent = "Could not save vote. Try again.";
      };
    }
    await showResults(poll.id, results);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function publicBaseUrl() {
    const b = String(window.MJ_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    if (b) return b;
    return window.location.origin;
  }

  function giveawayStandaloneUrlForSite(eventId) {
    return `${publicBaseUrl()}/giveaway.html?g=${encodeURIComponent(eventId)}`;
  }

  /** Første giveaway rad fra API (RLS = aktivt tidsvindu). Ikke krev winner_slots her — ellers mangler knapp på mobil. */
  function firstVisibleGiveawayForCta(rows) {
    if (!Array.isArray(rows)) return null;
    for (const ev of rows) {
      const type = String(ev.event_type || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "");
      if (type === "giveaway") return ev;
    }
    return null;
  }

  function renderEventsGiveawayCta(rows) {
    const wrap = document.getElementById("events-giveaway-cta-wrap");
    if (!wrap) return;
    const hit = firstVisibleGiveawayForCta(rows);
    if (!hit) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    const url = giveawayStandaloneUrlForSite(hit.id);
    wrap.hidden = false;
    wrap.innerHTML = `<a class="btn btn--primary btn--touch-submit events-bli-med-btn" href="${escapeHtml(
      url
    )}">Bli med</a>
          <p class="events-giveaway-cta-hint">Giveawayen pågår til slutttid som er satt i admin — du kan oppdatere siden; den avsluttes ikke av det.</p>`;
  }

  async function showResults(pollId, container) {
    if (!container) return;
    const r = await rest("/rest/v1/rpc/get_poll_results", {
      method: "POST",
      body: JSON.stringify({ p_poll_id: pollId }),
    });
    if (!r.ok) return;
    let rows = await r.json();
    if (rows && !Array.isArray(rows) && Array.isArray(rows.get_poll_results)) {
      rows = rows.get_poll_results;
    }
    const list = Array.isArray(rows) ? rows : [];
    let max = 0;
    list.forEach((x) => {
      max = Math.max(max, Number(x.votes) || 0);
    });
    container.innerHTML = "";
    list.forEach((x) => {
      const votes = Number(x.votes) || 0;
      const pct = max > 0 ? Math.round((votes / max) * 100) : 0;
      const row = document.createElement("div");
      row.className = "poll-bar-row";
      row.innerHTML = `<div class="poll-bar-label"><span>${escapeHtml(
        x.label
      )}</span><span class="poll-bar-count">${votes}</span></div><div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%"></div></div>`;
      container.appendChild(row);
    });
  }

  async function loadMilestones() {
    const list = document.getElementById("milestones-list");
    if (!list || !ok) return;
    const r = await rest(
      "/rest/v1/milestones?select=title,body,milestone_date&order=sort_order.asc,milestone_date.asc",
      {}
    );
    if (!r.ok) {
      list.innerHTML = emptyStateHtml(
        "fa-solid fa-cloud-arrow-down",
        "Could not load timeline",
        "Check your connection or Supabase setup."
      );
      return;
    }
    const rows = await r.json();
    list.innerHTML = "";
    if (!rows.length) {
      list.innerHTML = emptyStateHtml(
        "fa-solid fa-heart",
        "Story loading…",
        "We will add milestones here (dates, trips, big moments). Watch this space."
      );
      return;
    }
    rows.forEach((m) => {
      const d = new Date(m.milestone_date + "T12:00:00");
      const li = document.createElement("li");
      li.className = "timeline-item reveal is-visible";
      li.innerHTML = `<time datetime="${m.milestone_date}">${formatLong(
        d
      )}</time><h4>${escapeHtml(m.title)}</h4>${
        m.body ? `<p>${escapeHtml(m.body)}</p>` : ""
      }`;
      list.appendChild(li);
    });
  }

  async function loadEvents() {
    const box = document.getElementById("events-list");
    const ctaWrap = document.getElementById("events-giveaway-cta-wrap");
    if (!box || !ok) {
      if (ctaWrap) {
        ctaWrap.hidden = true;
        ctaWrap.innerHTML = "";
      }
      return;
    }
    const r = await rest(
      "/rest/v1/events?select=id,title,body,event_type,starts_at,ends_at,winner_slots&order=starts_at.desc",
      {}
    );
    if (!r.ok) {
      if (ctaWrap) {
        ctaWrap.hidden = true;
        ctaWrap.innerHTML = "";
      }
      box.innerHTML = emptyStateHtml(
        "fa-solid fa-triangle-exclamation",
        "Could not load events",
        "Check your connection or Supabase setup."
      );
      return;
    }
    const rows = await r.json();
    renderEventsGiveawayCta(rows);
    box.innerHTML = "";
    if (!rows.length) {
      box.innerHTML = emptyStateHtml(
        "fa-solid fa-champagne-glasses",
        "All quiet for now",
        "When we run a giveaway or share news, you will see it here first."
      );
      return;
    }
    rows.forEach((ev) => {
      const type = String(ev.event_type || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "");
      const isGiveaway = type === "giveaway";

      const card = document.createElement("article");
      card.className = "event-card";
      const badge = isGiveaway ? '<span class="event-badge">Giveaway</span>' : "";
      const winN =
        ev.winner_slots != null && Number(ev.winner_slots) >= 1
          ? Number(ev.winner_slots)
          : null;
      const entryReady =
        isGiveaway &&
        winN != null &&
        ev.body &&
        String(ev.body).trim().length >= 2;
      let fairHint = "";
      if (entryReady && winN === 1) {
        fairHint = `<p class="giveaway-enter__fair">Everyone can enter with their Snapchat username. <strong>One winner</strong> will be picked at random from <em>all</em> entries — same odds for everyone.</p>`;
      } else if (entryReady && winN != null) {
        fairHint = `<p class="giveaway-enter__fair">We’ll draw <strong>${winN}</strong> winners fairly from <em>everyone</em> who enters — same chance for all.</p>`;
      }
      const prizeBlock =
        isGiveaway && ev.body
          ? `<p class="giveaway-prize-label">Prize</p><p class="giveaway-prize">${escapeHtml(
              String(ev.body)
            )}</p>`
          : "";
      const entryBlock =
        isGiveaway && entryReady
          ? `<div class="giveaway-enter giveaway-enter--desktop" data-event-id="${escapeHtml(ev.id)}">
          <p class="giveaway-enter__lead">Enter your <strong>Snapchat username</strong> and tap <strong>Bli med</strong> — one entry per device. The list below updates live.</p>${fairHint}
          <label class="giveaway-snap-label">Snapchat username</label>
          <input type="text" class="input giveaway-snap" inputmode="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="32" placeholder="e.g. mj_universe (no @)" />
          <button type="button" class="btn btn--primary btn--touch-submit giveaway-enter-btn">Bli med</button>
          <p class="giveaway-msg form-error" role="alert"></p>
        </div>`
          : isGiveaway && !entryReady
            ? `<p class="giveaway-enter__hold giveaway-enter__fair giveaway-enter__hold--desktop">This giveaway isn’t open for entries yet (add the prize and number of winners in admin).</p>`
            : "";
      const standaloneCta = isGiveaway
        ? `<div class="giveaway-standalone-cta">
          <a href="${escapeHtml(
            giveawayStandaloneUrlForSite(ev.id)
          )}" class="btn btn--primary btn--touch-submit giveaway-standalone-btn">Bli med</a>
          <p class="giveaway-standalone-cta-hint">Åpner påmelding — fungerer best på mobil.</p>
        </div>`
        : "";
      const rosterBlock = isGiveaway
        ? `<section class="giveaway-roster" data-event-id="${escapeHtml(
            ev.id
          )}" aria-live="polite">
          <div class="giveaway-roster-head"><strong>Participants</strong> <span class="giveaway-roster-count giveaway-roster-count--muted"></span></div>
          <ul class="giveaway-roster-list"></ul>
        </section>`
        : "";
      const bodyHtml =
        !isGiveaway && ev.body ? `<p>${escapeHtml(ev.body)}</p>` : "";
      card.innerHTML = `${badge}<h4>${escapeHtml(ev.title)}</h4>${prizeBlock}${standaloneCta}${entryBlock}${rosterBlock}${bodyHtml}`;
      box.appendChild(card);
      if (isGiveaway) {
        const sec = card.querySelector(".giveaway-roster");
        if (sec) startGiveawayRosterPoll(sec, ev.id);
      }
      if (isGiveaway && entryReady) {
        const w = card.querySelector(".giveaway-enter");
        if (w) bindGiveawayEntry(w, ev.id);
      }
    });
  }

  async function initLiveNav() {
    const navLive = document.getElementById("nav-live");
    const heroPill = document.getElementById("hero-live-pill");
    if (!ok) return;
    const r = await rest(
      "/rest/v1/site_live_status?select=is_live,embed_url,tiktok_username&id=eq.1",
      {}
    );
    if (!r.ok) return;
    const rows = await r.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return;
    const hasEmbed = !!(row.embed_url && String(row.embed_url).trim());
    const showLive = !!row.is_live || hasEmbed;
    if (navLive) {
      navLive.classList.toggle("nav-live-link--on-air", showLive);
      navLive.setAttribute("data-live", showLive ? "1" : "0");
    }
    if (heroPill) {
      heroPill.hidden = !showLive;
    }
  }

  updateTogetherText();
  if (!ok) return;
  loadPoll();
  loadMilestones();
  loadEvents();
  void initLiveNav();
})();
