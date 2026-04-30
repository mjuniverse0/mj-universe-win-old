/**
 * mj-universe.media/vlog/ — liste publiserte vlog-slug fra watch_videos.
 */
(function () {
  var SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
  var WATCH_BASE = window.MJ_WATCH_BASE || "https://mj-universe.watch/";
  var ok =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL) &&
    KEY.length > 20 &&
    (KEY.startsWith("sb_publishable_") || KEY.startsWith("eyJ"));

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

  function watchUrl(slug) {
    var b = WATCH_BASE.replace(/\/?$/, "/");
    return b + "?v=" + encodeURIComponent(slug);
  }

  async function load() {
    var root = document.getElementById("mj-vlog-root");
    if (!root) return;
    if (!ok) {
      root.innerHTML = "<p>Konfigurer Supabase.</p>";
      return;
    }
    var q =
      "/rest/v1/watch_videos?is_published=eq.true&content_kind=eq.vlog&select=slug,title,description,sort_order&order=sort_order.asc,title.asc";
    var res = await fetch(SB_URL + q, { headers: headers() });
    if (!res.ok) {
      root.innerHTML = "<p>Kunne ikke laste videoer.</p>";
      return;
    }
    var rows = await res.json().catch(function () {
      return [];
    });
    if (!Array.isArray(rows) || !rows.length) {
      root.innerHTML =
        "<p>Ingen vlog-poster ennå. Legg inn i admin → <strong>Watch / vlog</strong>.</p>";
      return;
    }
    root.innerHTML =
      '<div class="mj-vlog-grid">' +
      rows
        .map(function (r) {
          var desc = r.description ? "<p>" + esc(r.description) + "</p>" : "";
          return (
            '<a class="mj-vlog-card" href="' +
            esc(watchUrl(r.slug)) +
            '"><h3>' +
            esc(r.title) +
            "</h3>" +
            desc +
            '<p><i class="fa-solid fa-play" aria-hidden="true"></i> Se på mj-universe.watch</p></a>'
          );
        })
        .join("") +
      "</div>";
  }

  load();
})();
