/**
 * mj-universe.watch/?v=slug — video fra watch_videos (YouTube/Vimeo/TikTok embed, Storage-mp4, eller lenker).
 */
(function () {
  var SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
  var ok =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL) &&
    KEY.length > 20 &&
    (KEY.startsWith("sb_publishable_") || KEY.startsWith("eyJ"));

  var MJ = window.MJ_MEDIA;

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

  function isEmbed(u) {
    return MJ && MJ.isEmbedUrl ? MJ.isEmbedUrl(u) : false;
  }

  function isVideoFile(u) {
    return MJ && MJ.isDirectVideoUrl ? MJ.isDirectVideoUrl(u) : false;
  }

  function isLink(u) {
    return MJ && MJ.isExternalHttpsLink ? MJ.isExternalHttpsLink(u) : false;
  }

  function slugFromQuery() {
    var p = new URLSearchParams(window.location.search);
    var v = (p.get("v") || "").trim().toLowerCase();
    if (!v || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(v)) return null;
    return v;
  }

  function linkPill(href, iconClass, label) {
    return (
      '<a class="mj-watch-link-pill" href="' +
      esc(href) +
      '" target="_blank" rel="noopener noreferrer"><i class="' +
      esc(iconClass) +
      '" aria-hidden="true"></i> ' +
      esc(label) +
      "</a>"
    );
  }

  function renderLinks(row) {
    var parts = [];
    var t = row.link_tiktok && String(row.link_tiktok).trim();
    if (t && isLink(t)) parts.push(linkPill(t, "fa-brands fa-tiktok", "TikTok"));
    var ig = row.link_instagram && String(row.link_instagram).trim();
    if (ig && isLink(ig)) parts.push(linkPill(ig, "fa-brands fa-instagram", "Instagram"));
    var sn = row.link_snap && String(row.link_snap).trim();
    if (sn && isLink(sn)) parts.push(linkPill(sn, "fa-brands fa-snapchat", "Snapchat"));
    if (!parts.length) return "";
    return '<div class="mj-watch-links">' + parts.join("") + "</div>";
  }

  async function run() {
    var titleEl = document.getElementById("mj-watch-title");
    var descEl = document.getElementById("mj-watch-desc");
    var player = document.getElementById("mj-watch-player");
    var empty = document.getElementById("mj-watch-empty");
    var slug = slugFromQuery();
    if (!slug) {
      if (empty) empty.hidden = false;
      return;
    }
    if (!ok) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Innholdet er ikke tilgjengelig akkurat nå.";
      }
      return;
    }
    var cols =
      "title,description,youtube_embed_url,video_file_url,link_tiktok,link_instagram,link_snap";
    var q =
      "/rest/v1/watch_videos?slug=eq." +
      encodeURIComponent(slug) +
      "&is_published=eq.true&select=" +
      cols +
      "&limit=1";
    var res = await fetch(SB_URL + q, { headers: headers() });
    var rows = res.ok ? await res.json().catch(function () { return []; }) : [];
    var row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Fant ikke denne videoen.";
      }
      return;
    }
    if (empty) empty.hidden = true;
    if (titleEl) titleEl.textContent = row.title || slug;
    if (descEl) {
      descEl.textContent = row.description || "";
      descEl.hidden = !row.description;
    }
    document.title = (row.title || "Video") + " | mj-universe.watch";

    var embed = row.youtube_embed_url && isEmbed(row.youtube_embed_url) ? String(row.youtube_embed_url).trim() : "";
    var vfile = row.video_file_url && isVideoFile(row.video_file_url) ? String(row.video_file_url).trim() : "";

    var inner = "";
    if (embed) {
      inner =
        '<iframe title="' +
        esc(row.title) +
        '" src="' +
        esc(embed) +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
    } else if (vfile) {
      inner =
        '<video controls playsinline preload="metadata" class="mj-watch-video-el"><source src="' +
        esc(vfile) +
        '" type="video/mp4" />Nettleseren støtter ikke avspilling.</video>';
    }

    var linksHtml = renderLinks(row);

    if (player) {
      if (inner) {
        player.innerHTML = inner + linksHtml;
      } else if (linksHtml) {
        player.innerHTML =
          '<p class="mj-watch-fallback">Ingen innebygd avspilling for denne oppføringen — bruk lenkene under.</p>' +
          linksHtml;
      } else {
        player.innerHTML =
          "<p>Ingen gyldig embed-URL, video (Storage/mp4) eller ekstern lenke er satt i admin.</p>";
      }
    }
  }

  run();
})();
