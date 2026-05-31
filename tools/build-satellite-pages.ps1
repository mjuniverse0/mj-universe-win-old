# Regenerer sites/*/index.html for MJ-satellitter (kjør manuelt ved behov)
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $PSScriptRoot
$sitesDir = Join-Path $base "sites"

$fontHref = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,200..900;1,9..144,200..900&family=Outfit:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&display=swap"

$quick = @(
  @{ id = "net";  url = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub"; hint = "mj-universe.net" },
  @{ id = "vip";  url = "https://mj-universe.vip/"; icon = "fa-solid fa-crown"; label = "VIP"; hint = "Community" },
  @{ id = "soc";  url = "https://mj-universe.social/"; icon = "fa-solid fa-share-nodes"; label = "Social"; hint = "Profiler" },
  @{ id = "med";  url = "https://mj-universe.media/"; icon = "fa-brands fa-youtube"; label = "Media"; hint = "YouTube" },
  @{ id = "liv";  url = "https://mj-universe.live/"; icon = "fa-solid fa-tower-broadcast"; label = "Live"; hint = "Streams" },
  @{ id = "dat";  url = "https://mj-universe.date/"; icon = "fa-solid fa-heart"; label = "Date"; hint = "Date-videoer" },
  @{ id = "lol";  url = "https://mj-universe.lol/"; icon = "fa-solid fa-face-laugh-beam"; label = "Fun"; hint = "Challenges" },
  @{ id = "wch";  url = "https://mj-universe.watch/"; icon = "fa-solid fa-eye"; label = "Watch"; hint = "Eksklusivt" },
  @{ id = "sto";  url = "https://mj-universe.store/"; icon = "fa-solid fa-bag-shopping"; label = "Store"; hint = "Merch" },
  @{ id = "mjst"; url = "https://mjuniverse.store/"; icon = "fa-solid fa-store"; label = "MJStore"; hint = "Alt. URL" }
)

function Get-QuickGrid([string]$currentId) {
  $lines = @(
    '        <div class="sat-quick">',
    '          <p class="sat-quick__title">Hele MJ Universe - trykk for å bytte site</p>',
    '          <div class="sat-quick-grid">'
  )
  foreach ($q in $quick) {
    $inner = @"
            <span class="sat-quick-card__icon"><i class="$($q.icon)" aria-hidden="true"></i></span>
            <span class="sat-quick-card__label">$($q.label)</span>
            <span class="sat-quick-card__hint">$($q.hint)</span>
"@
    if ($q.id -eq $currentId) {
      $lines += "            <span class=`"sat-quick-card is-current`" aria-current=`"page`">$inner</span>"
    } else {
      $lines += "            <a class=`"sat-quick-card`" href=`"$($q.url)`">$inner</a>"
    }
  }
  $lines += '          </div>', '        </div>'
  return ($lines -join "`n")
}

function Nav-Line($items) {
  $out = @()
  foreach ($it in $items) {
    $cur = if ($it.cur) { ' aria-current="page"' } else { '' }
    $out += "          <a href=`"$($it.href)`"$cur><i class=`"$($it.icon)`" aria-hidden=`"true`"></i> $($it.label)</a>"
  }
  return ($out -join "`n")
}

$footer = @'
      <footer class="site-footer">
        <a class="footer-snap" href="https://www.snapchat.com/add/mj_universe?share_id=5JV2bdenR46VRWEZGr03FQ&amp;locale=nb_NO" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-snapchat" aria-hidden="true"></i>
          <span>Add <strong>@mj_universe</strong> on Snapchat</span>
        </a>
        <p class="network-brand-line">
          <strong>MJ Universe</strong> er et innholdsprosjekt av <strong>Mariell Berntzen</strong> og <strong>Jhonatan Wik</strong>. Hovedhub:
          <a href="https://mj-universe.net/">mj-universe.net</a>
        </p>
        <div class="network-footer">
          <span class="network-footer__title">MJ Universe Network</span>
          <nav class="network-footer__links" aria-label="Alle MJ Universe-domener">
            <a href="https://mj-universe.net/">mj-universe.net</a>
            <a href="https://mj-universe.media/">mj-universe.media</a>
            <a href="https://mj-universe.date/">mj-universe.date</a>
            <a href="https://mj-universe.watch/">mj-universe.watch</a>
            <a href="https://mj-universe.social/">mj-universe.social</a>
            <a href="https://mj-universe.lol/">mj-universe.lol</a>
            <a href="https://mj-universe.live/">mj-universe.live</a>
            <a href="https://mj-universe.vip/">mj-universe.vip</a>
            <a href="https://mj-universe.store/">mj-universe.store</a>
            <a href="https://mjuniverse.store/">mjuniverse.store</a>
          </nav>
        </div>
        <p class="site-footer__tagline"><i class="fa-solid fa-infinity" aria-hidden="true"></i> MJ-Universe</p>
      </footer>
'@

$pages = @(
  @{
    folder = "mj-universe.date"; theme = "sat-hero--rose"; pageTitle = "Date - MJ Universe | mj-universe.date"
    canon = "https://mj-universe.date/"; desc = "Date-videoer med Mariell Berntzen og Jhonatan Wik - MJ Universe. Cheap vs luxury, vlog. mj-universe.date"
    badge = "Date"; icon = "fa-solid fa-heart"; h1 = "Date-videoer"; domain = "mj-universe.date"
    quickId = "dat"
    lead = "mj-universe.date er hub for date-konsepter og vlogger med Mariell Berntzen og Jhonatan Wik - f.eks. 500 kr vs 1500 kr date, cheap vs luxury. Full video paa YouTube (@MJUniverse-1); her bygger dere artikler, BTS og egne URL-er for Google."
    h2 = "Eksempel-URLer"; bullets = @("/50-vs-150-date - tekst + embed + lenke til hub", "/cheap-vs-luxury-date"); kw = "date vlog - Mariell Berntzen - Jhonatan Wik - mj-universe.date"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-heart"; label = "Date"; cur = $true }
      @{ href = "https://mj-universe.media/"; icon = "fa-solid fa-film"; label = "Media" }
      @{ href = "https://mj-universe.vip/"; icon = "fa-solid fa-crown"; label = "VIP" }
    )
    primary = @{ href = "https://www.youtube.com/@MJUniverse-1"; label = "YouTube"; class = "sat-btn--primary"; extra = ' target="_blank" rel="noopener noreferrer"' }
    secondary = @{ href = "https://mj-universe.net/"; label = "Hovedhub"; extra = "" }
  },
  @{
    folder = "mj-universe.live"; theme = "sat-hero--cyan"; pageTitle = "Live - MJ Universe | mj-universe.live"
    canon = "https://mj-universe.live/"; desc = "Live fra MJ Universe - TikTok og YouTube. Mariell Berntzen og Jhonatan Wik."
    badge = "Live"; icon = "fa-solid fa-tower-broadcast"; h1 = "Live"; domain = "mj-universe.live"
    quickId = "liv"
    lead = "mj-universe.live er for livestreams fra Mariell Berntzen og Jhonatan Wik pa TikTok og YouTube. Sjekk ogsaa status paa hovedhubben."
    h2 = "Plan for siden"; bullets = @("Neste planlagte live (dato/klokkeslett)", "Lenke til siste stream", "Valgfritt: chat-embed"); kw = "MJ Universe live - Mariell og Jhonatan - mj-universe.live"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-tower-broadcast"; label = "Live"; cur = $true }
      @{ href = "https://mj-universe.social/"; icon = "fa-solid fa-share-nodes"; label = "Social" }
      @{ href = "https://mj-universe.media/"; icon = "fa-brands fa-youtube"; label = "Media" }
    )
    primary = @{ href = "https://mj-universe.net/live/live.html"; label = "Live-side (.net)"; class = "sat-btn--primary"; extra = "" }
    secondary = @{ href = "https://mj-universe.vip/"; label = "VIP"; extra = "" }
  },
  @{
    folder = "mj-universe.social"; theme = "sat-hero--violet"; pageTitle = "Social - MJ Universe | mj-universe.social"
    canon = "https://mj-universe.social/"; desc = "Snapchat, TikTok, YouTube - MJ Universe. Mariell Berntzen og Jhonatan Wik."
    badge = "Social"; icon = "fa-solid fa-share-nodes"; h1 = "Social hub"; domain = "mj-universe.social"
    quickId = "soc"
    lead = "Samler offisielle profiler for Mariell Berntzen og Jhonatan Wik: Snapchat @mj_universe, YouTube @MJUniverse-1, TikTok @mariellberntz. Instagram legges til nar konto er klar."
    h2 = "Lenker"; bullets = @("Snapchat: snapchat.com/add/mj_universe", "YouTube: @MJUniverse-1", "TikTok: @mariellberntz"); kw = "MJ Universe social - mj-universe.social"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-share-nodes"; label = "Social"; cur = $true }
      @{ href = "https://mj-universe.vip/"; icon = "fa-solid fa-crown"; label = "VIP" }
      @{ href = "https://mj-universe.media/"; icon = "fa-brands fa-youtube"; label = "Media" }
    )
    primary = @{ href = "https://www.snapchat.com/add/mj_universe"; label = "Snapchat"; class = "sat-btn--primary"; extra = ' target="_blank" rel="noopener noreferrer"' }
    secondary = @{ href = "https://www.youtube.com/@MJUniverse-1"; label = "YouTube"; extra = ' target="_blank" rel="noopener noreferrer"' }
  },
  @{
    folder = "mj-universe.media"; theme = "sat-hero--cyan"; pageTitle = "Media - YouTube hub | mj-universe.media"
    canon = "https://mj-universe.media/"; desc = "YouTube og video-hub for MJ Universe - Mariell Berntzen og Jhonatan Wik."
    badge = "Media"; icon = "fa-brands fa-youtube"; h1 = "YouTube & video"; domain = "mj-universe.media"
    quickId = "med"
    lead = "mj-universe.media er YouTube-hubben: embeds, siste video og spillelister. Kanalen er @MJUniverse-1. Kobler til date-, watch- og hub-sider."
    h2 = "Struktur"; bullets = @("/latest eller forside - siste upload", "/all-videos - oversikt", "Egne sider per stort konsept"); kw = "MJ Universe YouTube - mj-universe.media"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-brands fa-youtube"; label = "Media"; cur = $true }
      @{ href = "https://mj-universe.date/"; icon = "fa-solid fa-heart"; label = "Date" }
      @{ href = "https://mj-universe.watch/"; icon = "fa-solid fa-eye"; label = "Watch" }
    )
    primary = @{ href = "https://www.youtube.com/@MJUniverse-1"; label = "Abonner"; class = "sat-btn--primary"; extra = ' target="_blank" rel="noopener noreferrer"' }
    secondary = @{ href = "https://mj-universe.net/vlog/"; label = "Vlog (.net)"; extra = "" }
  },
  @{
    folder = "mj-universe.lol"; theme = "sat-hero--lime"; pageTitle = "Challenges - MJ Universe | mj-universe.lol"
    canon = "https://mj-universe.lol/"; desc = "Fun og challenges - MJ Universe. Mariell Berntzen og Jhonatan Wik."
    badge = "Fun"; icon = "fa-solid fa-face-laugh-beam"; h1 = "Challenges"; domain = "mj-universe.lol"
    quickId = "lol"
    lead = "mj-universe.lol er for challenges, humor og rare ideer. Bygg egne undersider per video med unik tekst og lenke til YouTube."
    h2 = "Ideer"; bullets = @("/spicy-food-challenge", "/24-hour-challenge", "/couple-challenge"); kw = "couple challenge - MJ Universe - mj-universe.lol"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-face-laugh-beam"; label = "Fun"; cur = $true }
      @{ href = "https://mj-universe.media/"; icon = "fa-solid fa-film"; label = "Media" }
      @{ href = "https://mj-universe.vip/"; icon = "fa-solid fa-crown"; label = "VIP" }
    )
    primary = @{ href = "https://www.youtube.com/@MJUniverse-1"; label = "YouTube"; class = "sat-btn--primary"; extra = ' target="_blank" rel="noopener noreferrer"' }
    secondary = @{ href = "https://mj-universe.net/"; label = "Hub"; extra = "" }
  },
  @{
    folder = "mj-universe.watch"; theme = "sat-hero--violet"; pageTitle = "Watch - eksklusivt | mj-universe.watch"
    canon = "https://mj-universe.watch/"; desc = "Eksklusive klipp og extras - MJ Universe. Mariell Berntzen og Jhonatan Wik."
    badge = "Watch"; icon = "fa-solid fa-eye"; h1 = "Exclusive"; domain = "mj-universe.watch"
    quickId = "wch"
    lead = "Klipp som ikke (eller ikke lenger) ligger pa YouTube: bloopers, extras, korte fan-versjoner. Full video via Media og @MJUniverse-1."
    h2 = "Innhold"; bullets = @("Korte klipp med lenke til full video", "Why we cut this - tekst for SEO"); kw = "MJ Universe exclusive - mj-universe.watch"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-eye"; label = "Watch"; cur = $true }
      @{ href = "https://mj-universe.media/"; icon = "fa-brands fa-youtube"; label = "Media" }
      @{ href = "https://mj-universe.date/"; icon = "fa-solid fa-heart"; label = "Date" }
    )
    primary = @{ href = "https://mj-universe.media/"; label = "Til Media"; class = "sat-btn--primary"; extra = "" }
    secondary = @{ href = "https://www.youtube.com/@MJUniverse-1"; label = "YouTube"; extra = ' target="_blank" rel="noopener noreferrer"' }
  },
  @{
    folder = "mj-universe.store"; theme = "sat-hero--amber"; pageTitle = "Merch - MJ Universe | mj-universe.store"
    canon = "https://mj-universe.store/"; desc = "Offisiell merch - MJ Universe. Mariell Berntzen og Jhonatan Wik."
    badge = "Store"; icon = "fa-solid fa-bag-shopping"; h1 = "Merch"; domain = "mj-universe.store"
    quickId = "sto"
    lead = "Nettbutikk for MJ Universe kommer her: hoodies, stickers, limited drops. Unike produktsider - ikke kopier tekst fra andre domener."
    h2 = "Lansering"; bullets = @("Velg kanonisk butikk-URL", "301 fra alternativ domene"); kw = "MJ Universe merch - mj-universe.store"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "index.html"; icon = "fa-solid fa-bag-shopping"; label = "Store"; cur = $true }
      @{ href = "https://mjuniverse.store/"; icon = "fa-solid fa-store"; label = "MJStore" }
      @{ href = "https://mj-universe.social/"; icon = "fa-solid fa-share-nodes"; label = "Social" }
    )
    primary = @{ href = "https://mj-universe.net/"; label = "Hovedhub"; class = "sat-btn--primary"; extra = "" }
    secondary = @{ href = "https://mjuniverse.store/"; label = "mjuniverse.store"; extra = "" }
  },
  @{
    folder = "mjuniverse.store"; theme = "sat-hero--amber"; pageTitle = "Merch - MJUniverse | mjuniverse.store"
    canon = "https://mjuniverse.store/"; desc = "MJUniverse store - samme merch-prosjekt som mj-universe.store."
    badge = "Store"; icon = "fa-solid fa-store"; h1 = "MJUniverse store"; domain = "mjuniverse.store"
    quickId = "mjst"
    lead = "Samme merch som mj-universe.store - annen skrivemate for SEO. Mariell Berntzen og Jhonatan Wik bak MJ Universe."
    h2 = "SEO"; bullets = @("Velg en hovedbutikk + 301"); kw = "MJUniverse store - merch"
    nav = @(
      @{ href = "https://mj-universe.net/"; icon = "fa-solid fa-house"; label = "Hub" }
      @{ href = "https://mj-universe.store/"; icon = "fa-solid fa-bag-shopping"; label = ".store" }
      @{ href = "index.html"; icon = "fa-solid fa-store"; label = "MJStore"; cur = $true }
      @{ href = "https://mj-universe.social/"; icon = "fa-solid fa-share-nodes"; label = "Social" }
    )
    primary = @{ href = "https://mj-universe.store/"; label = "mj-universe.store"; class = "sat-btn--primary"; extra = "" }
    secondary = @{ href = "https://mj-universe.net/"; label = "Hub"; extra = "" }
  }
)

foreach ($p in $pages) {
  $bulletsHtml = ($p.bullets | ForEach-Object { "            <li>$_</li>" }) -join "`n"
  $qg = Get-QuickGrid $p.quickId
  $navHtml = Nav-Line $p.nav
  $prim = $p.primary
  $sec = $p.secondary

  $html = @"
<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>$($p.pageTitle)</title>
    <meta name="description" content="$($p.desc)" />
    <link rel="canonical" href="$($p.canon)" />
    <meta name="theme-color" content="#0c0a12" />
    <link rel="icon" type="image/png" href="https://mj-universe.net/images/logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="$fontHref" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="https://mj-universe.net/css/style.css" />
    <link rel="stylesheet" href="css/seo.css" />
    <link rel="stylesheet" href="css/satellite.css" />
  </head>
  <body>
    <div class="noise" aria-hidden="true"></div>
    <div class="seo-wrap seo-wrap--sat">
      <header class="site-header">
        <a href="https://mj-universe.net/" class="logo" aria-label="MJ Universe hub">
          <span class="logo-badge">
            <img class="logo-img" src="https://mj-universe.net/images/logo.png" alt="" width="160" height="64" decoding="async" />
          </span>
        </a>
        <nav class="nav nav--sat" aria-label="Meny">
$navHtml
        </nav>
      </header>
      <main class="sat-main">
        <section class="sat-hero $($p.theme)" aria-labelledby="sat-h1">
          <p class="sat-hero__badge"><i class="$($p.icon)" aria-hidden="true"></i> $($p.badge)</p>
          <div class="sat-hero__icon" aria-hidden="true"><i class="$($p.icon)"></i></div>
          <h1 class="sat-hero__title" id="sat-h1">$($p.h1)</h1>
          <span class="sat-hero__domain">$($p.domain)</span>
          <p class="sat-hero__lead">$($p.lead)</p>
          <div class="sat-hero__actions">
            <a class="$($prim.class)" href="$($prim.href)"$($prim.extra)><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> $($prim.label)</a>
            <a href="$($sec.href)"$($sec.extra)><i class="fa-solid fa-link" aria-hidden="true"></i> $($sec.label)</a>
          </div>
        </section>
        <div class="sat-body">
          <div class="sat-panel">
            <h2>$($p.h2)</h2>
            <ul>
$bulletsHtml
            </ul>
          </div>
$qg
          <p class="sat-kw"><strong>SEO:</strong> $($p.kw)</p>
        </div>
      </main>
$footer
    </div>
  </body>
</html>
"@
  $out = Join-Path (Join-Path $sitesDir $p.folder) "index.html"
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($out, $html, $utf8)
  Write-Host "Wrote $out"
}
