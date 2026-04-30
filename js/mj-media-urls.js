/**
 * Delt: tillatte innebyggings-URL-er og direkte video (Storage / mp4).
 * Brukes av watch-video-page.js og fitness-page.js (last inn først).
 */
(function (w) {
  function isEmbedUrl(u) {
    var s = String(u || "").trim();
    if (!s || !/^https:\/\//i.test(s)) return false;
    try {
      var p = new URL(s);
      if (p.protocol !== "https:") return false;
      var h = p.hostname.toLowerCase();
      if (
        h === "www.youtube.com" ||
        h === "youtube.com" ||
        h === "www.youtube-nocookie.com" ||
        h.endsWith(".youtube.com")
      ) {
        return true;
      }
      if (h === "player.vimeo.com" || h === "vimeo.com" || h.endsWith(".vimeo.com")) return true;
      if (h.endsWith(".tiktok.com") && /\/embed/i.test(p.pathname)) return true;
      if (h === "player.twitch.tv" || h.endsWith(".twitch.tv")) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function isDirectVideoUrl(u) {
    var s = String(u || "").trim();
    if (!s || !/^https:\/\//i.test(s)) return false;
    try {
      var p = new URL(s);
      if (p.protocol !== "https:") return false;
      var h = p.hostname.toLowerCase();
      if (h.endsWith(".supabase.co") && p.pathname.indexOf("/storage/v1/object/public/") !== -1) return true;
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(p.pathname + p.search)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function isExternalHttpsLink(u) {
    try {
      var p = new URL(String(u || "").trim());
      return p.protocol === "https:" || p.protocol === "http:";
    } catch (e) {
      return false;
    }
  }

  w.MJ_MEDIA = { isEmbedUrl, isDirectVideoUrl, isExternalHttpsLink };
})(window);
