/**
 * /snapchat/ - henter Snapchat-innsiktstall fra site_snap_stats (Supabase).
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

  var VIEW_FIELDS = [
    {
      key: "metric_story_views_7d",
      label: "Siste 7 dager",
      deltaKey: "metric_story_views_7d_delta",
    },
    {
      key: "metric_story_views_30d",
      label: "Siste 30 dager",
      deltaKey: "metric_story_views_30d_delta",
    },
    {
      key: "metric_story_views_90d",
      label: "Siste 90 dager",
      deltaKey: "metric_story_views_90d_delta",
    },
    {
      key: "metric_story_views_all_time",
      label: "All time",
      deltaKey: "metric_story_views_all_time_delta",
    },
  ];

  function deltaModifierClass(text) {
    if (!text) return "";
    var t = String(text);
    if (/^\s*\+/.test(t) || /vs\. forrige lagring\s*\(\+/.test(t)) return "snap-metric__delta--up";
    if (/^\s*[−-]/.test(t) || /vs\. forrige lagring\s*\([−-]/.test(t)) return "snap-metric__delta--down";
    return "snap-metric__delta--neutral";
  }

  async function fetchStats() {
    if (!ok) return null;
    var cols =
      "snapchat_username,metric_story_views_7d,metric_story_views_30d,metric_story_views_90d,metric_story_views_all_time," +
      "metric_story_views_7d_delta,metric_story_views_30d_delta,metric_story_views_90d_delta,metric_story_views_all_time_delta," +
      "metric_engagement,metric_subscribers,insights_note,updated_at";
    var res = await fetch(SB_URL + "/rest/v1/site_snap_stats?id=eq.1&select=" + cols, {
      headers: headers(),
    });
    if (!res.ok) return null;
    var rows = await res.json().catch(function () {
      return [];
    });
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("nb-NO", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return "";
    }
  }

  function render(el, row) {
    if (!el) return;
    if (!row) {
      el.innerHTML =
        '<p class="lead">Kunne ikke laste tall akkurat nå.</p>';
      return;
    }
    var parts = [];
    VIEW_FIELDS.forEach(function (vf) {
      var v = row[vf.key];
      if (v && String(v).trim()) {
        var deltaRaw = vf.deltaKey && row[vf.deltaKey] ? String(row[vf.deltaKey]).trim() : "";
        var deltaHtml = deltaRaw
          ? '<div class="snap-metric__delta ' +
            deltaModifierClass(deltaRaw) +
            '">' +
            esc(deltaRaw) +
            "</div>"
          : "";
        parts.push(
          '<div class="snap-metric"><div class="snap-metric__label">' +
            esc(vf.label) +
            '</div><div class="snap-metric__value">' +
            esc(String(v).trim()) +
            "</div>" +
            deltaHtml +
            "</div>"
        );
      }
    });
    if (row.metric_engagement && String(row.metric_engagement).trim()) {
      parts.push(
        '<div class="snap-metric"><div class="snap-metric__label">Engasjement / annet</div><div class="snap-metric__value">' +
          esc(row.metric_engagement) +
          "</div></div>"
      );
    }
    if (row.metric_subscribers && String(row.metric_subscribers).trim()) {
      parts.push(
        '<div class="snap-metric"><div class="snap-metric__label">Abonnenter / følgere (ca.)</div><div class="snap-metric__value">' +
          esc(row.metric_subscribers) +
          "</div></div>"
      );
    }
    var metricsHtml;
    if (parts.length > 0) {
      metricsHtml = '<div class="snap-metrics snap-metrics--views">' + parts.join("") + "</div>";
    } else {
      metricsHtml =
        '<p class="lead">Ingen visningstall i periodene ennå. I <strong>admin → Snapchat</strong> trenger du ikke fylle alle felt - tomme felt beholdes når du lagrer.</p>';
    }
    var note = row.insights_note && String(row.insights_note).trim()
      ? '<p class="snap-insights-note">' + esc(row.insights_note) + "</p>"
      : "";
    var updated = fmtDate(row.updated_at);
    var foot = updated
      ? '<p class="lead snap-metrics-updated">Sist oppdatert på nettsiden: ' + esc(updated) + "</p>"
      : "";
    el.innerHTML = metricsHtml + note + foot;
  }

  var mount = document.getElementById("snap-metrics-root");
  if (mount) {
    fetchStats().then(function (row) {
      render(mount, row);
    });
  }
})();
