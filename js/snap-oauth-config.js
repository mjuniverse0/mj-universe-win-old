/**
 * Offentlig OAuth-konfig (kun client_id + redirect) — IKKE client secret her.
 * Redirect URI ma vare EKSAKT lik det som er registrert i Snapchat OAuth App.
 */
(function () {
  /**
   * redirect_uri må være EKSAKT lik Snap Redirect URIs (ofte uten www).
   * Hvis bruker åpner siden på www, må vi likevel sende apex-URL til Snapchat.
   */
  var base;
  if (typeof window.MJ_PUBLIC_BASE_URL === "string" && window.MJ_PUBLIC_BASE_URL.trim()) {
    base = window.MJ_PUBLIC_BASE_URL.trim().replace(/\/$/, "");
  } else if (
    typeof window.location !== "undefined" &&
    /^(?:.+\.)?mj-universe\.net$/i.test((window.location.hostname || "").toLowerCase())
  ) {
    base = "https://mj-universe.net";
  } else {
    base = window.location.origin;
  }
  window.MJ_SNAP_OAUTH = {
    clientId: "848f46ed-175a-439b-87bf-549a201b4fe3",
    redirectUri: base + "/snapchat/oauth-callback.html",
    scope: "snapchat-profile-api",
    authorizeUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
  };
})();
