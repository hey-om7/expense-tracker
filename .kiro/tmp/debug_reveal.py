from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto("http://127.0.0.1:3456/", wait_until="networkidle")
    print("html classes:", page.evaluate("document.documentElement.className"))
    print("reduced:", page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"))
    print("total reveal:", page.evaluate("document.querySelectorAll('[data-reveal]').length"))
    page.evaluate("""() => new Promise(r => {
        let y=0; const step=()=>{ y+=window.innerHeight*0.8; window.scrollTo(0,y);
        if(y<document.body.scrollHeight) setTimeout(step,90); else {window.scrollTo(0,0); setTimeout(r,700);} }; step();
    })""")
    page.wait_for_timeout(800)
    print("visible after scroll:", page.evaluate("document.querySelectorAll('[data-reveal].is-visible').length"))
    print("still hidden:", page.evaluate("""[...document.querySelectorAll('[data-reveal]:not(.is-visible)')].map(e=>e.className).slice(0,10)"""))
    # what does a mid-page section compute to?
    print(page.evaluate("""() => {
        const el = document.querySelector('.manifesto__lead');
        if(!el) return 'no manifesto';
        const cs = getComputedStyle(el);
        return {cls: el.className, opacity: cs.opacity, transform: cs.transform};
    }"""))
    b.close()
