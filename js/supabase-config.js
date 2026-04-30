/* Del URL + publishable/anon key. Ikke legg secret/service_role her. */
window.MJ_SUPABASE_URL = "https://yefatcprqfybbqxiarcz.supabase.co";
window.MJ_SUPABASE_ANON_KEY =
  "sb_publishable_tPKMDdCQsRCqqwQP-T97wg_0mpl2W7v";

/**
 * Admin «brukernavn» (Supabase krever e-post ved innlogging).
 * Full innloggings-e-post blir: BRUKERNAVN @ MJ_ADMIN_LOGIN_DOMAIN
 * Opprett nøyaktig den e-posten under Authentication → Users.
 */
window.MJ_ADMIN_USERNAME = "mariellogjhonatan";
window.MJ_ADMIN_LOGIN_DOMAIN = "mj-universe.site";
window.MJ_ADMIN_EMAIL =
  window.MJ_ADMIN_USERNAME + "@" + window.MJ_ADMIN_LOGIN_DOMAIN;

/**
 * Valgfritt: kanonisk URL til nettsiden (brukes i admin når du lager giveaway-lenker).
 * Tom = bruk nettleserens origin (fungerer ikke hvis du åpner admin fra file:// eller localhost).
 * Eksempel: window.MJ_PUBLIC_BASE_URL = "https://mj-universe.net";
 */
window.MJ_PUBLIC_BASE_URL = window.MJ_PUBLIC_BASE_URL || "";

/**
 * Bekreftelseslenke i e-post etter registrering (Supabase).
 * Skal ligge under Authentication → URL Configuration → Redirect URLs.
 * Site URL i dashboard skal ikke være localhost i produksjon.
 */
window.MJ_AUTH_EMAIL_REDIRECT =
  window.MJ_AUTH_EMAIL_REDIRECT || "https://mj-universe.net/account/";
