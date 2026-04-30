/**
 * Optional: set embed URL without editing the iframe in live.html.
 * Add before this script in live.html:
 *   <script>window.MJ_LIVE_EMBED_URL = "https://www.youtube.com/embed/YOUR_VIDEO_ID";</script>
 */
(function () {
  var url = String(window.MJ_LIVE_EMBED_URL || "").trim();
  if (!url) return;
  var el = document.getElementById("live-stream");
  if (el) el.src = url;
})();
