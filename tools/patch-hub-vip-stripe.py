# Patches exported Next HTML on mj-universe.net: Stripe VIP + tiers (run after scp fetch).
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "mj-net-vip-patch"

NEW_VIP_BODY = """<div class="space-y-4"><div class="grid grid-cols-1 gap-4 md:grid-cols-3"><div class="flex flex-col gap-3 rounded-2xl border border-line bg-white/[0.03] p-4"><div class="space-y-1"><p class="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">M\u00e5nedlig</p><p class="text-lg font-semibold text-white">99 NOK <span class="text-xs font-normal text-white/45">/ mnd</span></p></div><ul class="list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/55"><li>Eksklusive videoer og VIP-oppdateringer</li><li>Merch-muligheter (f.eks. klistremerker) ved utvalgte drops &mdash; <span class="text-amber-200/80">ikke garanti</span></li><li>Digital tilgang er kjernen i produktet</li></ul><a href="https://buy.stripe.com/8x25kD8Xw95828Bdoo2cg0j" class="mt-auto inline-flex items-center justify-center rounded-2xl bg-amber-400/90 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300" target="_blank" rel="noopener noreferrer">G\u00e5 til Stripe Checkout</a></div><div class="flex flex-col gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/[0.06] p-4 ring-1 ring-fuchsia-400/20"><div class="space-y-1"><p class="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200/80">Kvartal</p><p class="text-lg font-semibold text-white">299 NOK <span class="text-xs font-normal text-white/45">/ 3 mnd</span></p></div><ul class="list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/60"><li>Alt i m\u00e5nedlig VIP</li><li>Flere eksklusive klipp tidlig til fans</li><li>H\u00f8yere sjanse for merch (caps, t-skjorter, stickers) ved kampanjer &mdash; <span class="text-amber-200/80">aldri garanti p\u00e5 kl\u00e6r</span></li></ul><a href="https://buy.stripe.com/dRm6oH2z8epsdRj4RS2cg0k" class="mt-auto inline-flex items-center justify-center rounded-2xl bg-fuchsia-400/95 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-fuchsia-300" target="_blank" rel="noopener noreferrer">G\u00e5 til Stripe Checkout</a></div><div class="flex flex-col gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.06] p-4"><div class="space-y-1"><p class="text-[10px] font-semibold uppercase tracking-wide text-cyan-200/80">\u00c5rlig</p><p class="text-lg font-semibold text-white">999 NOK <span class="text-xs font-normal text-white/45">/ \u00e5r</span></p></div><ul class="list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/60"><li>St\u00f8rstedelen av VIP-verdien samlet</li><li>St\u00f8rre sjanse for begrensede merch-kampanjer &mdash; <span class="text-amber-200/80">bonus, ikke et l\u00f8fte om fysisk vare</span></li><li>Best for langsiktig st\u00f8tte til Mariell og Jhonatan</li></ul><a href="https://buy.stripe.com/5kQaEXb5Ea9cfZracc2cg0i" class="mt-auto inline-flex items-center justify-center rounded-2xl border border-cyan-300/45 bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition hover:border-cyan-200/55 hover:bg-white/[0.11]" target="_blank" rel="noopener noreferrer">G\u00e5 til Stripe Checkout</a></div></div><p class="rounded-2xl border border-dashed border-white/18 bg-black/25 px-4 py-3 text-[11px] leading-relaxed text-white/48">VIP handler prim\u00e6rt om <strong class="text-white/70">digital tilgang og fellesskap</strong>. Klistremerker, caps og t-skjorter kan forekomme ved enkelte kampanjer, og <strong class="text-white/70">jo h\u00f8yere abonnementsniv\u00e5, desto st\u00f8rre sjanse</strong> &mdash; men <strong class="text-white/70">fysiske goder er aldri garantert</strong> og er ikke det kj\u00f8pet i hovedsak gir.</p></div><section class="rounded-3xl border border-line bg-white/[0.02] p-5 space-y-2 text-xs text-white/45"><p class="font-semibold text-white/60">Retur-URL-er (Stripe Payment Links / Checkout)</p><p><span class="text-white/35">Suksess:</span> <code class="break-all text-[11px] text-fuchsia-200/80">https://mj-universe.net/betaling/takk/</code></p><p><span class="text-white/35">Avbrudd:</span> <code class="break-all text-[11px] text-fuchsia-200/80">https://mj-universe.net/betaling/avbrutt/</code></p><p class="text-white/35">Sett disse i Stripe Payment Link (etter betaling / avbrutt) s\u00e5 kundene lander riktig.</p></section>"""

TAKK_STRIPE = (
    "Stripe har sendt deg tilbake hit. Kvittering og abonnementsstatus kommer p\u00e5 e-post fra Stripe; "
    "sjekk s\u00f8ppelpost om du ikke ser den innen noen minutter. "
    "VIP-tilgang kobles til konto n\u00e5r betaling er bekreftet."
)


def patch_vip() -> None:
    p = ROOT / "vip" / "index.html"
    html = p.read_text(encoding="utf-8")
    html = html.replace("Betaling skjer trygt via PayPal.", "Betaling skjer trygt via Stripe.")
    html = html.replace("Betaling skjer trygt med PayPal", "Betaling skjer trygt med Stripe")
    start = html.find('<div class="rounded-3xl border border-amber-400/25')
    needle = '</section><a class="inline-block text-[11px]'
    end = html.find(needle, start)
    if start < 0 or end < 0:
        raise SystemExit(f"VIP block markers not found: start={start} end={end}")
    insert_end = end + len("</section>")
    html = html[:start] + NEW_VIP_BODY + html[insert_end:]
    html = html.replace("PayPal", "Stripe").replace(
        "NEXT_PUBLIC_PAYPAL_VIP_CHECKOUT_URL",
        "STRIPE_DASHBOARD_PAYMENT_LINKS",
    )
    p.write_text(html, encoding="utf-8")
    print("patched vip/index.html")


def patch_takk() -> None:
    p = ROOT / "betaling" / "takk" / "index.html"
    html = p.read_text(encoding="utf-8")
    html2, n = re.subn(
        r"PayPal har sendt deg tilbake hit\.[^<]+",
        TAKK_STRIPE,
        html,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"takk: expected 1 PayPal paragraph replace, got {n}")
    html2 = html2.replace("PayPal", "Stripe")
    p.write_text(html2, encoding="utf-8")
    print("patched betaling/takk/index.html")


def patch_avbrutt() -> None:
    p = ROOT / "betaling" / "avbrutt" / "index.html"
    html = p.read_text(encoding="utf-8")
    html2, n = re.subn(
        r"PayPal, eller betalingen ble ikke fullført\.[^<]*",
        "Du lukket Stripe Checkout eller fullførte ikke betalingen. "
        "Ingenting er trukket — prøv gjerne igjen når du er klar.",
        html,
        count=1,
    )
    if n != 1:
        html2 = html.replace("PayPal", "Stripe Checkout", 1)
        if html2 == html:
            raise SystemExit("avbrutt: could not patch")
    p.write_text(html2, encoding="utf-8")
    print("patched betaling/avbrutt/index.html")


def main() -> None:
    patch_vip()
    patch_takk()
    patch_avbrutt()


if __name__ == "__main__":
    main()
