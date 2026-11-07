from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.goto("http://127.0.0.1:3456/", wait_until="networkidle")
    print(page.evaluate("""() => {
        const before = window.scrollY;
        window.scrollTo(0, 1500);
        return {before, after: window.scrollY,
                docScrollTop: document.documentElement.scrollTop,
                bodyScrollTop: document.body.scrollTop,
                htmlOverflow: getComputedStyle(document.documentElement).overflow,
                bodyOverflow: getComputedStyle(document.body).overflow,
                bodyH: document.body.scrollHeight,
                innerH: window.innerHeight};
    }"""))
    page.wait_for_timeout(500)
    print("scrollY now:", page.evaluate("window.scrollY"))
    print("visible:", page.evaluate("document.querySelectorAll('[data-reveal].is-visible').length"))
    # try real mouse wheel
    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(600)
    print("after wheel scrollY:", page.evaluate("window.scrollY"),
          "visible:", page.evaluate("document.querySelectorAll('[data-reveal].is-visible').length"))
    # check who is the scrolling element
    print("scrollingElement:", page.evaluate("document.scrollingElement && document.scrollingElement.tagName"))
    print("root el overflow chain:", page.evaluate("""() => {
        const out=[]; let el=document.querySelector('.manifesto');
        while(el && el!==document.documentElement){ const cs=getComputedStyle(el);
          out.push({c:(el.className||el.tagName).toString().slice(0,40), of:cs.overflow, pos:cs.position, h:cs.height});
          el=el.parentElement;} return out;}"""))
    b.close()
