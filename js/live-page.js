/**
 * live/live.html — henter site_live_status fra Supabase og viser embed eller TikTok-lenke(r).
 */
(function () {
  var SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
  var ok =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL) &&
    KEY.length > 20 &&
    (KEY.startsWith("sb_publishable_") || KEY.startsWith("eyJ"));

  var POLL_MS = 45000;

  function headers() {
    return {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
    };
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function safeEmbedUrl(raw) {
    var u = String(raw || "").trim();
    if (!u || !/^https:\/\//i.test(u)) return "";
    try {
      var p = new URL(u);
      var h = p.hostname.toLowerCase();
      if (
        h === "www.youtube.com" ||
        h === "youtube.com" ||
        h === "www.youtube-nocookie.com" ||
        h.endsWith(".youtube.com") ||
        h === "player.twitch.tv" ||
        h.endsWith(".twitch.tv")
      ) {
        return u;
      }
    } catch (e) {}
    return "";
  }

  function tiktokProfile(user) {
    var u = String(user || "").trim().replace(/^@+/, "");
    if (!u) return "https://www.tiktok.com/";
    return "https://www.tiktok.com/@" + encodeURIComponent(u);
  }

  function tiktokLiveUrl(user) {
    var u = String(user || "").trim().replace(/^@+/, "");
    if (!u) return tiktokProfile("");
    return "https://www.tiktok.com/@" + encodeURIComponent(u) + "/live";
  }

  /** Unike brukernavn fra rad 1 + 2 (rekkefølge bevares). */
  function tiktokUsersFromRow(row) {
    var out = [];
    function add(x) {
      var u = String(x || "").trim().replace(/^@+/, "");
      if (!u) return;
      if (out.indexOf(u) === -1) out.push(u);
    }
    if (row) {
      add(row.tiktok_username);
      add(row.tiktok_username_secondary);
    }
    return out;
  }

  function tiktokLiveLinksHtml(users) {
    return users
      .map(function (u) {
        return (
          '<a href="' +
          esc(tiktokLiveUrl(u)) +
          '" target="_blank" rel="noopener">' +
          "@" +
          esc(u) +
          "</a>"
        );
      })
      .join(" · ");
  }

  async function fetchStatus() {
    if (!ok) return null;
    var res = await fetch(
      SB_URL +
        "/rest/v1/site_live_status?id=eq.1&select=is_live,embed_url,tiktok_username,tiktok_username_secondary",
      { headers: headers() }
    );
    if (!res.ok) return null;
    var rows = await res.json().catch(function () {
      return [];
    });
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  function render(stage, row) {
    if (!stage) return;
    stage.innerHTML = "";
    stage.className = "live-stage";

    if (!row) {
      stage.classList.add("live-stage--error");
      stage.innerHTML =
        '<p class="live-stage__msg">Kunne ikke laste live-status akkurat nå.</p>';
      return;
    }

    var users = tiktokUsersFromRow(row);

    var embed = safeEmbedUrl(row.embed_url);
    if (embed) {
      stage.classList.add("live-stage--embed");
      var wrap = document.createElement("div");
      wrap.className = "live-stage__iframe-wrap";
      var iframe = document.createElement("iframe");
      iframe.className = "live-stage__iframe";
      iframe.title = "Live stream";
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      iframe.src = embed;
      wrap.appendChild(iframe);
      stage.appendChild(wrap);
      var note = document.createElement("p");
      note.className = "live-stage__sub";
      if (users.length) {
        note.innerHTML =
          "Innebygd strøm (YouTube/Twitch). TikTok-live: " + tiktokLiveLinksHtml(users) + ".";
      } else {
        note.textContent = "Innebygd strøm (YouTube/Twitch).";
      }
      stage.appendChild(note);
      return;
    }

    if (row.is_live && users.length) {
      stage.classList.add("live-stage--tiktok");
      var btns = users
        .map(function (u) {
          return (
            '<a class="btn btn--primary btn--touch-submit live-stage__cta" href="' +
            esc(tiktokLiveUrl(u)) +
            '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-tiktok" aria-hidden="true"></i> Live @' +
            esc(u) +
            "</a>"
          );
        })
        .join("");
      stage.innerHTML =
        '<p class="live-stage__badge">ON AIR</p>' +
        '<p class="live-stage__title">Vi sender live på TikTok</p>' +
        '<p class="live-stage__lead">Velg konto — åpne i app eller nettleser.</p>' +
        '<div class="live-stage__ctas">' +
        btns +
        "</div>" +
        '<p class="live-stage__hint">Tips: strøm samtidig til YouTube fra OBS og lim inn <strong>embed-URL</strong> i admin — da vises video her.</p>';
      return;
    }

    stage.classList.add("live-stage--offline");
    var profileLinks = users
      .map(function (u) {
        return (
          '<a class="btn btn--ghost live-stage__cta" href="' +
          esc(tiktokProfile(u)) +
          '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-tiktok" aria-hidden="true"></i> @' +
          esc(u) +
          "</a>"
        );
      })
      .join("");
    stage.innerHTML =
      '<p class="live-stage__title">Ikke live akkurat nå</p>' +
      '<p class="live-stage__lead">Følg med på TikTok — når vi sender, skrur vi på «On air» i admin.</p>' +
      (profileLinks ? '<div class="live-stage__ctas">' + profileLinks + "</div>" : "");
  }

  var stageEl = document.getElementById("live-stage");

  async function tick() {
    var row = await fetchStatus();
    render(stageEl, row);
  }

  tick();
  setInterval(tick, POLL_MS);
})();
