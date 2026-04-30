const statusRows = [
  { name: "Fortnite", support: "Global", status: "Operational", uptime: "98.53%" },
  { name: "Apex Legends", support: "Global", status: "Operational", uptime: "98.57%" },
  { name: "Roblox", support: "Global", status: "Operational", uptime: "98.72%" },
  { name: "CS2", support: "Global", status: "Operational", uptime: "98.44%" },
  { name: "Forza Horizon 5", support: "Global", status: "Operational", uptime: "98.50%" },
];

const extRows = [
  { name: "Cloudflare", status: "Operational" },
  { name: "Discord API", status: "Operational" },
  { name: "GitHub", status: "Operational" },
];

function statusClass(value) {
  if (value.toLowerCase() === "operational") return "ok";
  if (value.toLowerCase() === "degraded") return "warn";
  return "down";
}

function paintStatusTable() {
  const root = document.querySelector("[data-status-table]");
  if (!root) return;
  root.innerHTML = statusRows
    .map(
      (row) => `<tr>
        <td>${row.name}</td>
        <td>${row.support}</td>
        <td class="${statusClass(row.status)}">${row.status}</td>
        <td>${row.uptime}</td>
      </tr>`
    )
    .join("");
}

function paintExternalTable() {
  const root = document.querySelector("[data-external-table]");
  if (!root) return;
  root.innerHTML = extRows
    .map(
      (row) => `<tr>
        <td>${row.name}</td>
        <td class="${statusClass(row.status)}">${row.status}</td>
      </tr>`
    )
    .join("");
}

function hookContactForm() {
  const form = document.querySelector("[data-contact-form]");
  const out = document.querySelector("[data-contact-result]");
  if (!form || !out) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    out.textContent = "Message sent. Team Verdant will reply soon.";
    form.reset();
  });
}

paintStatusTable();
paintExternalTable();
hookContactForm();

function enhanceBrandLogo() {
  const brands = document.querySelectorAll(".brand .dot");
  brands.forEach((dot) => {
    if (!dot || dot.getAttribute("data-logo-ready") === "1") return;
    dot.setAttribute("data-logo-ready", "1");
    dot.style.backgroundImage = "url('/assets/images/logo.png')";
    dot.style.backgroundSize = "cover";
    dot.style.backgroundPosition = "center";
    dot.style.backgroundRepeat = "no-repeat";
  });
}

enhanceBrandLogo();

function runParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dust = [];
  const net = [];
  let w = 0;
  let h = 0;
  let time = 0;
  let mouseX = -9999;
  let mouseY = -9999;

  const DUST_CAP = 320;
  const NET_CAP = 72;
  const LINK_DIST = 148;

  function countDust() {
    return Math.min(DUST_CAP, Math.max(72, Math.floor(window.innerWidth / 6.5)));
  }

  function countNet() {
    return Math.min(NET_CAP, Math.max(28, Math.floor(window.innerWidth / 30)));
  }

  function makeDust() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.45,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      base: Math.random() * 0.42 + 0.18,
      ph: Math.random() * Math.PI * 2,
    };
  }

  function makeNet() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.1 + 1,
      vx: (Math.random() - 0.5) * 0.62,
      vy: (Math.random() - 0.5) * 0.62,
      a: Math.random() * 0.42 + 0.18,
      ph: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    canvas.width = Math.floor(iw * dpr);
    canvas.height = Math.floor(ih * dpr);
    canvas.style.width = `${iw}px`;
    canvas.style.height = `${ih}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = iw;
    h = ih;
  }

  function repopulate() {
    dust.length = 0;
    net.length = 0;
    for (let i = 0; i < countDust(); i += 1) dust.push(makeDust());
    for (let i = 0; i < countNet(); i += 1) net.push(makeNet());
  }

  function wrap(p) {
    if (p.x < -24) p.x = w + 24;
    if (p.x > w + 24) p.x = -24;
    if (p.y < -24) p.y = h + 24;
    if (p.y > h + 24) p.y = -24;
  }

  function nudgeFromMouse(p, strength) {
    const dx = p.x - mouseX;
    const dy = p.y - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 < 4 || d2 > 200 * 200) return;
    const d = Math.sqrt(d2);
    const f = (1 - d / 200) * strength;
    p.vx += (dx / d) * f * 0.14;
    p.vy += (dy / d) * f * 0.14;
  }

  /** Clear device-pixel buffer; avoids stale frames when DPR transform is applied. */
  function clearFrame() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function draw() {
    time += 0.014;
    clearFrame();

    for (let i = 0; i < dust.length; i += 1) {
      const p = dust[i];
      p.x += p.vx;
      p.y += p.vy;
      nudgeFromMouse(p, 0.07);
      p.vx *= 0.9994;
      p.vy *= 0.9994;
      wrap(p);
      const tw = 0.16 * Math.sin(time * 1.15 + p.ph);
      const a = Math.max(0.12, Math.min(0.92, p.base + tw));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248,250,252,${a})`;
      ctx.fill();
    }

    for (let i = 0; i < net.length; i += 1) {
      const p = net[i];
      p.x += p.vx;
      p.y += p.vy;
      nudgeFromMouse(p, 0.18);
      p.vx += (Math.random() - 0.5) * 0.008;
      p.vy += (Math.random() - 0.5) * 0.008;
      p.vx = Math.max(-1.25, Math.min(1.25, p.vx * 0.9975));
      p.vy = Math.max(-1.25, Math.min(1.25, p.vy * 0.9975));
      wrap(p);
    }

    for (let i = 0; i < net.length; i += 1) {
      for (let j = i + 1; j < net.length; j += 1) {
        const a = net[i];
        const b = net[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK_DIST) {
          const t = 1 - d / LINK_DIST;
          const alpha = t * 0.28;
          ctx.strokeStyle = `rgba(175,175,178,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < net.length; i += 1) {
      const p = net[i];
      const tw = 0.09 * Math.sin(time * 1.65 + p.ph);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,210,212,${Math.min(0.92, p.a + tw)})`;
      ctx.fill();
    }

    window.requestAnimationFrame(draw);
  }

  resize();
  repopulate();
  window.addEventListener("resize", () => {
    resize();
    repopulate();
  });
  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );

  draw();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runParticles, { once: true });
} else {
  runParticles();
}

function initPageMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.body.classList.add("page-motion");
}

function initScrollReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -7% 0px", threshold: 0.07 }
  );

  function observe(el, dir, delayIdx) {
    if (!el || el.classList.contains("reveal")) return;
    el.classList.add("reveal", `reveal-${dir}`);
    el.style.setProperty("--reveal-delay", `${Math.min(delayIdx * 72, 780)}ms`);
    observer.observe(el);
  }

  const nav = document.querySelector(".nav");
  if (nav) observe(nav, "down", 0);

  document.querySelectorAll(".hero").forEach((el, i) => observe(el, "up", i));

  document.querySelectorAll("section.section > .container").forEach((el, i) => {
    if (el.querySelector("[data-product-card], .cards .card")) return;
    if (el.querySelector(".contact-grid, .client-layout, .table-wrap")) return;
    observe(el, "up", i + 1);
  });

  document.querySelectorAll("footer.footer > .container").forEach((el, i) => observe(el, "fade", i));

  document.querySelectorAll("[data-product-card], .cards .card").forEach((el, i) => {
    const dir = i % 3 === 0 ? "up" : i % 3 === 1 ? "left" : "right";
    observe(el, dir, i);
  });

  document.querySelectorAll(".panel").forEach((panel, i) => {
    if (panel.closest("[data-product-card]")) return;
    if (panel.closest(".contact-grid, .client-layout")) return;
    observe(panel, "up", i);
  });

  document.querySelectorAll(".table-wrap, .contact-grid, .client-layout, .stat-row").forEach((el, i) =>
    observe(el, i % 2 === 0 ? "up" : "left", i)
  );
}

initPageMotion();
initScrollReveal();

function initHomeLoadingOverlay() {
  const el = document.getElementById("home-loading");
  if (!el || !document.body.classList.contains("page-home")) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const minMs = reduced ? 380 : 1250;
  const fadeMs = reduced ? 200 : 780;

  const dismiss = () => {
    el.classList.add("home-loading--done");
    el.removeAttribute("aria-busy");
    window.setTimeout(() => el.remove(), fadeMs);
  };

  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const finish = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    window.setTimeout(dismiss, Math.max(0, minMs - (now - t0)));
  };

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });
}

initHomeLoadingOverlay();
