import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = window.MJ_SUPABASE_URL;
const key = window.MJ_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

function $(id) {
  return document.getElementById(id);
}

function isStaffUser(user) {
  const e = String(user?.email || "").toLowerCase();
  return e.endsWith("@mj-universe.site");
}

function normalizeSnap(raw) {
  const t = String(raw || "")
    .trim()
    .replace(/^@+/g, "")
    .toLowerCase();
  if (t.length < 5 || t.length > 32) return null;
  if (!/^[a-z0-9._-]+$/i.test(t)) return null;
  return t;
}

function isProfilesMissingError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = error.code || "";
  if (code === "PGRST205" || code === "42P01") return true;
  if (msg.includes("schema cache") && msg.includes("profiles")) return true;
  if (msg.includes("could not find the table") && msg.includes("profiles")) return true;
  return false;
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("snapchat_username")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { error, profile: null };
  return { error: null, profile: data };
}

function showMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("mj-auth-msg--ok", Boolean(ok));
}

function setDbSetupVisible(show) {
  const box = $("mj-db-setup");
  if (box) box.hidden = !show;
}

function setGuestVisible(show) {
  const g = $("mj-auth-guest");
  if (g) g.hidden = !show;
}

function switchTab(tab) {
  const regBtn = $("mj-tab-btn-register");
  const logBtn = $("mj-tab-btn-login");
  const regPanel = $("mj-panel-register");
  const logPanel = $("mj-panel-login");
  const isLogin = tab === "login";
  if (regBtn && logBtn) {
    regBtn.classList.toggle("is-active", !isLogin);
    logBtn.classList.toggle("is-active", isLogin);
    regBtn.setAttribute("aria-selected", String(!isLogin));
    logBtn.setAttribute("aria-selected", String(isLogin));
  }
  if (regPanel && logPanel) {
    regPanel.classList.toggle("is-hidden", isLogin);
    logPanel.classList.toggle("is-hidden", !isLogin);
  }
  if (isLogin) {
    history.replaceState(null, "", "#login");
  } else {
    history.replaceState(null, "", "#register");
  }
}

$("mj-tab-btn-register")?.addEventListener("click", () => switchTab("register"));
$("mj-tab-btn-login")?.addEventListener("click", () => switchTab("login"));

if (location.hash === "#login") {
  switchTab("login");
} else {
  switchTab("register");
}

async function refreshSessionUi() {
  const bar = $("mj-auth-status");
  const snapMissing = $("mj-snap-missing");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    setDbSetupVisible(false);
    if (bar) bar.hidden = true;
    if (snapMissing) snapMissing.hidden = true;
    setGuestVisible(true);
    return;
  }

  setGuestVisible(false);

  const { profile, error } = await loadProfile(session.user.id);
  const missingTable = isProfilesMissingError(error);

  if (missingTable) {
    setDbSetupVisible(true);
    if (bar) {
      bar.hidden = false;
      const label = $("mj-auth-label");
      if (label) {
        label.textContent =
          session.user.email || "Innlogget";
      }
    }
    if (snapMissing) snapMissing.hidden = true;
    return;
  }

  setDbSetupVisible(false);

  const staff = isStaffUser(session.user);

  if (bar) {
    bar.hidden = false;
    const label = $("mj-auth-label");
    if (label) {
      if (error) {
        label.textContent = "Innlogget (kunne ikke lese profil)";
      } else if (profile?.snapchat_username) {
        label.textContent = "@" + profile.snapchat_username;
      } else if (staff) {
        label.textContent = "Staff: " + (session.user.email || "");
      } else {
        label.textContent = session.user.email || "Innlogget";
      }
    }
  }

  if (snapMissing) {
    if (staff || profile?.snapchat_username) {
      snapMissing.hidden = true;
    } else {
      snapMissing.hidden = false;
    }
  }
}

$("form-mj-register")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("mj-reg-error");
  showMsg(errEl, "");
  const email = $("mj-reg-email").value.trim();
  const pw = $("mj-reg-password").value;
  const snap = normalizeSnap($("mj-reg-snap").value);
  if (!snap) {
    showMsg(errEl, "Snapchat-brukernavn må ha minst 5 tegn (kun a-z, 0-9, . _ -).");
    return;
  }
  const redirectTo =
    (typeof window.MJ_AUTH_EMAIL_REDIRECT === "string" && window.MJ_AUTH_EMAIL_REDIRECT.trim()) ||
    `${window.location.origin}/account/`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pw,
    options: {
      emailRedirectTo: redirectTo.replace(/\/$/, "") + "/",
      data: { snapchat_username: snap },
    },
  });
  if (error) {
    showMsg(errEl, error.message);
    return;
  }
  const uid = data.user?.id;
  if (uid && data.session) {
    const ins = await supabase.from("profiles").insert({
      id: uid,
      snapchat_username: snap,
    });
    if (ins.error) {
      if (isProfilesMissingError(ins.error)) {
        showMsg(
          errEl,
          "Profil-tabellen er ikke tilkoblet ennå - sjekk Supabase-oppsett eller prøv igjen senere."
        );
      } else {
        showMsg(errEl, ins.error.message + " (Snap-navn kan være tatt.)");
      }
      return;
    }
    showMsg(errEl, "Konto opprettet og innlogget.", true);
    await refreshSessionUi();
    return;
  }
  if (uid && !data.session) {
    showMsg(
      errEl,
      "Sjekk e-posten for bekreftelselenke. Nettadresse for lenken styres av Supabase (Site URL / redirect til mj-universe.net).",
      true
    );
    return;
  }
  showMsg(errEl, "Ukjent svar fra server.");
});

$("form-mj-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("mj-login-error");
  showMsg(errEl, "");
  const email = $("mj-login-email").value.trim();
  const pw = $("mj-login-password").value;
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pw,
  });
  if (error) {
    showMsg(errEl, error.message);
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    const { profile, error: perr } = await loadProfile(session.user.id);
    if (!isProfilesMissingError(perr) && !profile?.snapchat_username) {
      const snap = normalizeSnap($("mj-reg-snap")?.value || "");
      if ($("mj-snap-missing") && snap) {
        const ins = await supabase.from("profiles").insert({
          id: session.user.id,
          snapchat_username: snap,
        });
        if (ins.error && !isProfilesMissingError(ins.error)) {
          showMsg(errEl, ins.error.message);
        }
      }
    }
  }
  showMsg(errEl, "Innlogget.", true);
  await refreshSessionUi();
});

$("form-mj-snap-complete")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("mj-snap-complete-error");
  showMsg(errEl, "");
  const snap = normalizeSnap($("mj-snap-complete").value);
  if (!snap) {
    showMsg(errEl, "Minst 5 tegn, kun tillatte tegn.");
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    showMsg(errEl, "Logg inn først.");
    return;
  }
  const ins = await supabase.from("profiles").insert({
    id: session.user.id,
    snapchat_username: snap,
  });
  if (ins.error) {
    if (isProfilesMissingError(ins.error)) {
      showMsg(
        errEl,
        "Profil kan ikke lagres akkurat nå - teknisk oppsett mangler."
      );
    } else {
      showMsg(errEl, ins.error.message);
    }
    return;
  }
  showMsg(errEl, "Profil lagret.", true);
  await refreshSessionUi();
});

$("mj-auth-logout")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await refreshSessionUi();
});

supabase.auth.onAuthStateChange(() => {
  refreshSessionUi();
});

await refreshSessionUi();
