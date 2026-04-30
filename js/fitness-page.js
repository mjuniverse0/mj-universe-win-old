/**
 * /fitness/ — publiserte sesonger og episoder fra Supabase.
 */
(function () {
  var SB_URL = (window.MJ_SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = (window.MJ_SUPABASE_ANON_KEY || "").trim();
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

  var MJ = window.MJ_MEDIA;

  function isEmbed(u) {
    if (MJ && MJ.isEmbedUrl) return MJ.isEmbedUrl(u);
    var s = String(u || "").trim();
    if (!s || !/^https:\/\//i.test(s)) return false;
    try {
      var p = new URL(s);
      var h = p.hostname.toLowerCase();
      return (
        h === "www.youtube.com" ||
        h === "youtube.com" ||
        h === "www.youtube-nocookie.com" ||
        h.endsWith(".youtube.com")
      );
    } catch (e) {
      return false;
    }
  }

  function isVideoFile(u) {
    return MJ && MJ.isDirectVideoUrl ? MJ.isDirectVideoUrl(u) : false;
  }

  function isHttpLink(u) {
    return MJ && MJ.isExternalHttpsLink ? MJ.isExternalHttpsLink(u) : false;
  }

  async function load() {
    if (!ok) return { seasons: [], error: "config" };
    var sRes = await fetch(
      SB_URL +
        "/rest/v1/fitness_seasons?is_published=eq.true&select=id,title,slug,description,sort_order&order=sort_order.asc",
      { headers: headers() }
    );
    if (!sRes.ok) return { seasons: [], error: "fetch" };
    var seasons = await sRes.json().catch(function () {
      return [];
    });
    if (!Array.isArray(seasons) || !seasons.length) return { seasons: [], error: null };

    var out = [];
    for (var i = 0; i < seasons.length; i++) {
      var sid = seasons[i].id;
      var eRes = await fetch(
        SB_URL +
          "/rest/v1/fitness_episodes?season_id=eq." +
          encodeURIComponent(sid) +
          "&is_published=eq.true&select=id,title,episode_number,body,video_url,youtube_embed_url,snap_story_url,link_tiktok,link_instagram,thumbnail_url,published_at&order=sort_order.asc,episode_number.asc",
        { headers: headers() }
      );
      var eps = eRes.ok ? await eRes.json().catch(function () { return []; }) : [];
      out.push({ season: seasons[i], episodes: Array.isArray(eps) ? eps : [] });
    }
    return { seasons: out, error: null };
  }

  function renderMedia(ep) {
    var bits = [];
    var y = ep.youtube_embed_url && isEmbed(ep.youtube_embed_url) ? String(ep.youtube_embed_url).trim() : "";
    if (y) {
      bits.push(
        '<div class="fitness-ep__media"><iframe title="' +
          esc(ep.title) +
          '" src="' +
          esc(y) +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
      );
    }
    var v = ep.video_url && String(ep.video_url).trim();
    var vOk = v && (isVideoFile(v) || /^https?:\/\//i.test(v) || v.startsWith("/"));
    if (vOk) {
      var th = ep.thumbnail_url && String(ep.thumbnail_url).trim();
      var posterAttr = th ? ' poster="' + esc(th) + '"' : "";
      bits.push(
        '<div class="fitness-ep__media"><video controls playsinline preload="metadata"' +
          posterAttr +
          '><source src="' +
          esc(v) +
          '" type="video/mp4" />Nettleseren støtter ikke video.</video></div>'
      );
    }
    return bits.join("");
  }

  function renderEpisode(ep) {
    var links = [];
    if (ep.snap_story_url && String(ep.snap_story_url).trim() && isHttpLink(ep.snap_story_url)) {
      links.push(
        '<a href="' +
          esc(String(ep.snap_story_url).trim()) +
          '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-snapchat" aria-hidden="true"></i> Snapchat story</a>'
      );
    }
    if (ep.link_tiktok && String(ep.link_tiktok).trim() && isHttpLink(ep.link_tiktok)) {
      links.push(
        '<a href="' +
          esc(String(ep.link_tiktok).trim()) +
          '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-tiktok" aria-hidden="true"></i> TikTok</a>'
      );
    }
    if (ep.link_instagram && String(ep.link_instagram).trim() && isHttpLink(ep.link_instagram)) {
      links.push(
        '<a href="' +
          esc(String(ep.link_instagram).trim()) +
          '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-instagram" aria-hidden="true"></i> Instagram</a>'
      );
    }
    if (ep.video_url && String(ep.video_url).trim() && !ep.youtube_embed_url) {
      var vu = String(ep.video_url).trim();
      links.push('<a href="' + esc(vu) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-film" aria-hidden="true"></i> Video</a>');
    }
    var body = ep.body && String(ep.body).trim() ? "<p class=\"fitness-ep__body\">" + esc(ep.body) + "</p>" : "";
    return (
      '<article class="fitness-ep" id="ep-' +
      esc(ep.id) +
      '"><div class="fitness-ep__head"><span class="fitness-ep__num">Episode ' +
      esc(ep.episode_number) +
      '</span><h3 class="fitness-ep__title">' +
      esc(ep.title) +
      "</h3></div>" +
      body +
      renderMedia(ep) +
      (links.length ? '<div class="fitness-ep__links">' + links.join("") + "</div>" : "") +
      "</article>"
    );
  }

  function render(el, data) {
    if (!el) return;
    if (data.error === "config") {
      el.innerHTML = '<p class="empty-fitness">Konfigurer Supabase i <code>js/supabase-config.js</code>.</p>';
      return;
    }
    if (data.error === "fetch") {
      el.innerHTML = '<p class="empty-fitness">Kunne ikke laste innholdet akkurat nå.</p>';
      return;
    }
    if (!data.seasons || !data.seasons.length) {
      el.innerHTML =
        '<p class="empty-fitness">Ingen publiserte sesonger ennå — de legges inn fra admin under <strong>Fitness</strong>.</p>';
      return;
    }
    var html = data.seasons
      .map(function (block) {
        var s = block.season;
        var eps = block.episodes || [];
        var epHtml = eps.map(renderEpisode).join("");
        if (!epHtml) {
          epHtml = '<p class="fitness-ep__body">Ingen episoder publisert i denne sesongen ennå.</p>';
        }
        var desc = s.description && String(s.description).trim()
          ? '<p class="fitness-season__desc">' + esc(s.description) + "</p>"
          : "";
        return (
          '<section class="fitness-season" id="season-' +
          esc(s.slug) +
          '"><h2 class="fitness-season__title">' +
          esc(s.title) +
          "</h2>" +
          desc +
          epHtml +
          "</section>"
        );
      })
      .join("");
    el.innerHTML = html;
  }

  var mount = document.getElementById("fitness-series-root");
  if (mount) {
    load().then(function (data) {
      render(mount, data);
    });
  }
})();
