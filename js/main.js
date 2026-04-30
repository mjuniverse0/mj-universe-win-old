(function () {
  document.querySelectorAll(".profile-photo__img").forEach((img) => {
    const showFallback = () => {
      img.classList.add("is-hidden");
    };
    img.addEventListener("error", showFallback);
    img.addEventListener("load", () => {
      if (img.naturalWidth > 0) {
        img.closest(".profile-photo")?.classList.add("has-photo");
      }
    });
    if (img.complete && img.naturalWidth > 0) {
      img.closest(".profile-photo")?.classList.add("has-photo");
    }
  });

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const reveals = document.querySelectorAll(".reveal");

  if (!reveals.length || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  reveals.forEach((el) => observer.observe(el));
})();
