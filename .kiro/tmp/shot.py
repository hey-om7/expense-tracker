#!/usr/bin/env python3
"""Capture full-page screenshots at several viewports and report layout problems.

Usage: python3 shot.py <label> [path] [widths...]
Writes to .kiro/tmp/shots/<label>-<width>.png
"""
import sys, os, json
from playwright.sync_api import sync_playwright

LABEL = sys.argv[1] if len(sys.argv) > 1 else "home"
PATH = sys.argv[2] if len(sys.argv) > 2 else "/"
WIDTHS = [int(w) for w in sys.argv[3:]] or [390, 768, 1440]

OUT = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT, exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3456")

report = {}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for w in WIDTHS:
        height = 900 if w >= 768 else 844
        ctx = browser.new_context(
            viewport={"width": w, "height": height},
            device_scale_factor=2 if w <= 430 else 1,
            is_mobile=w <= 430,
            has_touch=w <= 430,
        )
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(BASE + PATH, wait_until="networkidle", timeout=60000)
        # Disable smooth scrolling so scripted scrolling lands instantly,
        # otherwise scroll-reveal never triggers during capture.
        page.add_style_tag(content="html{scroll-behavior:auto !important}")
        # reveal all scroll-reveal content, then settle
        page.evaluate("""() => new Promise(r => {
            let y = 0;
            const step = () => {
                y += window.innerHeight * 0.6;
                window.scrollTo(0, y);
                if (y < document.body.scrollHeight) setTimeout(step, 120);
                else { window.scrollTo(0, 0); setTimeout(r, 900); }
            };
            step();
        })""")
        page.wait_for_timeout(1200)
        left = page.evaluate("document.querySelectorAll('[data-reveal]:not(.is-visible)').length")
        if left:
            page.evaluate("document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-visible'))")
            page.wait_for_timeout(700)

        metrics = page.evaluate("""() => {
            const de = document.documentElement;
            const overflow = [];
            const vw = window.innerWidth;
            document.querySelectorAll('body *').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && (r.right > vw + 2 || r.left < -2)) {
                    const cs = getComputedStyle(el);
                    if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') return;
                    overflow.push({
                        tag: el.tagName.toLowerCase(),
                        cls: (el.className || '').toString().slice(0, 70),
                        left: Math.round(r.left), right: Math.round(r.right)
                    });
                }
            });
            // small tap targets among interactive elements
            const small = [];
            document.querySelectorAll('a, button, [role=button], input, select').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return;
                if (r.height < 40 || r.width < 40) {
                    small.push({
                        tag: el.tagName.toLowerCase(),
                        cls: (el.className || '').toString().slice(0, 60),
                        txt: (el.textContent || '').trim().slice(0, 28),
                        w: Math.round(r.width), h: Math.round(r.height)
                    });
                }
            });
            const brokenImgs = [...document.images]
                .filter(i => i.complete && i.naturalWidth === 0)
                .map(i => i.currentSrc || i.src);
            const lowRes = [...document.images]
                .filter(i => i.naturalWidth > 0 && i.getBoundingClientRect().width > 0
                          && i.naturalWidth < i.getBoundingClientRect().width * 0.9)
                .map(i => ({src: (i.currentSrc||'').split('/').pop(),
                            nat: i.naturalWidth, disp: Math.round(i.getBoundingClientRect().width)}));
            return {
                scrollW: de.scrollWidth, clientW: de.clientWidth,
                docH: de.scrollHeight,
                hOverflow: de.scrollWidth > de.clientWidth + 1,
                overflowEls: overflow.slice(0, 12),
                smallTargets: small.slice(0, 15),
                brokenImgs, lowRes: lowRes.slice(0, 10),
            };
        }""")
        metrics["consoleErrors"] = errors[:10]
        report[w] = metrics
        page.screenshot(path=os.path.join(OUT, f"{LABEL}-{w}.png"), full_page=True)
        ctx.close()
    browser.close()

print(json.dumps(report, indent=2))
