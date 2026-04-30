(function () {
  var SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
  var ok =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL) &&
    KEY.length > 20 &&
    (KEY.startsWith("sb_publishable_") || KEY.startsWith("eyJ"));

  var UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var ROSTER_MS = 3000;

  function qs(name) {
    var p = new URLSearchParams(window.location.search);
    return (p.get(name) || "").trim();
  }

  function deviceId() {
    var k = "mj_device_id";
    var id = localStorage.getItem(k);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(k, id);
    }
    return id;
  }

  function normalizeSnap(raw) {
    var s = String(raw || "").trim();
    if (s.charAt(0) === "@") s = s.slice(1);
    return s.toLowerCase();
  }

  function snapValid(s) {
    return s.length >= 2 && s.length <= 32 && /^[a-zA-Z0-9._-]+$/.test(s);
  }

  function headers() {
    return {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
    };
  }

  function rest(path, opts) {
    return fetch(SB_URL + path, {
      method: opts.method || "GET",
      headers: Object.assign(headers(), (opts && opts.headers) || {}),
      body: opts.body,
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  var elLoading = document.getElementById("gw-loading");
  var elInvalid = document.getElementById("gw-invalid");
  var elCard = document.getElementById("gw-card");
  var rosterTimer = null;

  function hideLoading() {
    if (elLoading) elLoading.hidden = true;
  }

  function showInvalid(msg) {
    hideLoading();
    if (rosterTimer) {
      clearInterval(rosterTimer);
      rosterTimer = null;
    }
    if (elInvalid) {
      elInvalid.hidden = false;
      var t = elInvalid.querySelector(".gw-invalid-text");
      if (t) t.textContent = msg || "Ugyldig eller utgått lenke.";
    }
  }

  async function fetchPublicRoster(eventId) {
    var res = await rest("/rest/v1/rpc/get_giveaway_public_roster", {
      method: "POST",
      body: JSON.stringify({ p_event_id: eventId }),
    });
    if (!res.ok) return null;
    return res.json().catch(function () {
      return null;
    });
  }

  function renderRosterIntoSection(section, data) {
    if (!section) return;
    var stat = section.querySelector("#gw-roster-stat");
    var ul = section.querySelector("#gw-roster-ul");
    if (!data || !data.ok) {
      if (stat) stat.textContent = "Kunne ikke laste deltakerliste.";
      if (ul) ul.innerHTML = "";
      return;
    }
    var n = Number(data.count) || 0;
    if (stat) {
      stat.textContent =
        n === 0
          ? "Ingen har meldt seg på ennå."
          : n === 1
            ? "1 deltaker (oppdateres automatisk)."
            : n + " deltakere (oppdateres automatisk).";
    }
    if (!ul) return;
    ul.innerHTML = "";
    var list = Array.isArray(data.entrants) ? data.entrants : [];
    list.forEach(function (ent) {
      var li = document.createElement("li");
      li.className = "gw-roster-li";
      li.textContent = "@" + String(ent.snap_username || "");
      ul.appendChild(li);
    });
  }

  function startRosterPolling(eventId) {
    if (rosterTimer) {
      clearInterval(rosterTimer);
      rosterTimer = null;
    }
    var section = document.getElementById("gw-roster-section");
    async function tick() {
      var data = await fetchPublicRoster(eventId);
      renderRosterIntoSection(section, data);
    }
    tick();
    rosterTimer = setInterval(tick, ROSTER_MS);
  }

  async function load() {
    var gid = qs("g") || qs("id");
    if (!UUID_RE.test(gid)) {
      hideLoading();
      showInvalid("Mangler gyldig giveaway-ID i lenken (?g=…).");
      return;
    }

    if (!ok) {
      hideLoading();
      showInvalid("Konfigurasjon mangler (Supabase).");
      return;
    }

    var res = await rest("/rest/v1/rpc/get_giveaway_page_info", {
      method: "POST",
      body: JSON.stringify({ p_event_id: gid }),
    });

    hideLoading();

    if (!res.ok) {
      showInvalid(
        "Kunne ikke laste giveaway akkurat nå."
      );
      return;
    }

    var data = await res.json();
    if (!data || data.found === false) {
      showInvalid("Fant ikke denne giveawayen.");
      return;
    }

    if (elInvalid) elInvalid.hidden = true;
    if (elCard) {
      elCard.hidden = false;
      renderCard(data, gid);
    }
  }

  function renderCard(ev, eventId) {
    var ended = !!ev.ended;
    var canEnter = !!ev.can_enter && !ended;
    var entryReady = ev.entry_ready !== false;
    var wc =
      ev.winner_count != null
        ? Number(ev.winner_count)
        : ev.winner_slots != null
          ? Number(ev.winner_slots)
          : null;

    var html = "";
    html += '<span class="gw-badge">Giveaway</span>';
    html += "<h1>" + esc(ev.title) + "</h1>";
    if (ev.body) {
      html += '<p class="gw-prize-label">Premie</p>';
      html += '<p class="gw-muted gw-prize">' + esc(ev.body) + "</p>";
    }

    if (ended) {
      html +=
        '<div class="gw-banner gw-banner--ended" role="status">Denne giveawayen er avsluttet. Takk til alle som var med!</div>';
    } else if (!ev.is_active) {
      html +=
        '<div class="gw-banner gw-banner--ended" role="status">Giveawayen er ikke aktiv.</div>';
    } else if (!entryReady) {
      html +=
        '<div class="gw-banner gw-banner--wait" role="status">Giveawayen er ikke klar for påmelding ennå (premie eller antall vinnere mangler).</div>';
    } else if (!canEnter && ev.starts_at) {
      try {
        var st = new Date(ev.starts_at);
        if (st > new Date()) {
          html +=
            '<div class="gw-banner gw-banner--wait" role="status">Giveawayen starter snart.</div>';
        }
      } catch (e) {}
    }

    if (wc != null && wc >= 1 && canEnter) {
      if (wc === 1) {
        html +=
          '<p class="gw-muted">Skriv Snapchat-brukernavnet ditt og trykk <strong>Bli med</strong>. Én vinner trekkes <strong>tilfeldig blant alle</strong>. Listen under oppdateres fortløpende.</p>';
      } else {
        html +=
          '<p class="gw-muted">Skriv Snapchat-brukernavnet ditt og trykk <strong>Bli med</strong>. Vi trekker <strong>' +
          esc(String(wc)) +
          "</strong> vinnere tilfeldig blant alle. Listen under oppdateres fortløpende.</p>";
      }
    }

    if (canEnter) {
      html +=
        '<label for="gw-snap">Snapchat-brukernavn</label>' +
        '<input id="gw-snap" type="text" inputmode="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="32" placeholder="uten @" />' +
        '<button type="button" class="gw-submit" id="gw-enter-btn">Bli med</button>' +
        '<p id="gw-msg" class="gw-msg gw-msg--err" role="alert"></p>';
    }

    html += '<section class="gw-roster-section" id="gw-roster-section" aria-labelledby="gw-roster-title">';
    html += '<h2 class="gw-roster-h" id="gw-roster-title">Deltakere</h2>';
    html +=
      '<p id="gw-roster-stat" class="gw-muted gw-roster-stat" aria-live="polite">Laster deltakere…</p>';
    html += '<ul id="gw-roster-ul" class="gw-roster-ul"></ul>';
    html += "</section>";

    html += '<p class="gw-back"><a href="index.html">← Til forsiden</a></p>';

    elCard.innerHTML = html;

    startRosterPolling(eventId);

    if (!canEnter) return;

    var snapInput = document.getElementById("gw-snap");
    var msg = document.getElementById("gw-msg");
    var btn = document.getElementById("gw-enter-btn");

    async function submitEntry() {
      if (!snapInput || !msg || !btn || elCard.classList.contains("gw-done")) return;
      msg.textContent = "";
      msg.className = "gw-msg gw-msg--err";
      var snap = normalizeSnap(snapInput.value);
      if (!snapValid(snap)) {
        msg.textContent =
          "Skriv Snapchat-brukernavn (2–32 tegn: bokstaver, tall, _ . -).";
        snapInput.focus();
        return;
      }

      btn.disabled = true;
      var ins = await rest("/rest/v1/rpc/giveaway_enter", {
        method: "POST",
        body: JSON.stringify({
          p_event_id: eventId,
          p_device_id: deviceId(),
          p_snap_username: snap,
          p_reaction_emoji: null,
        }),
      });

      var body = await ins.json().catch(function () {
        return {};
      });
      btn.disabled = false;

      if (ins.ok && body && body.ok === true) {
        elCard.classList.add("gw-done");
        msg.className = "gw-msg gw-msg--ok";
        var pos = body.position;
        var nWin =
          body.winner_count != null
            ? Number(body.winner_count)
            : body.winner_slots != null
              ? Number(body.winner_slots)
              : null;
        var line = "Du er med! Listen oppdateres straks.";
        if (nWin === 1) {
          line =
            "Du er med (nr. " +
            pos +
            " i rekkefølgen, kun oversikt). Én vinner trekkes tilfeldig når giveaway er avsluttet.";
        } else if (nWin != null && nWin >= 1) {
          line =
            "Du er med (nr. " +
            pos +
            " i rekkefølgen, kun oversikt). Vi trekker " +
            nWin +
            " vinnere tilfeldig når giveaway er avsluttet.";
        }
        msg.textContent = line;
        snapInput.disabled = true;
        btn.disabled = true;
        var data = await fetchPublicRoster(eventId);
        renderRosterIntoSection(document.getElementById("gw-roster-section"), data);
        return;
      }

      if (body && body.error === "duplicate") {
        msg.textContent = "Du er allerede påmeldt fra denne enheten.";
        return;
      }
      if (body && body.error === "event_not_available") {
        msg.textContent = "Giveawayen er ikke åpen for påmelding nå.";
        return;
      }
      if (body && body.error === "giveaway_not_configured") {
        msg.textContent = "Giveawayen er ikke satt opp (premie eller antall vinnere).";
        return;
      }
      msg.textContent = "Kunne ikke melde på. Prøv igjen.";
    }

    if (btn) btn.addEventListener("click", submitEntry);
    if (snapInput) {
      snapInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          submitEntry();
        }
      });
    }
  }

  load();
})();
