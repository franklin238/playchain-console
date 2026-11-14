"""PlayChain logo: builds the SVG mark + lockups, renders PNGs with headless Chrome.
Run: <venv python> make_logo.py   (writes into this folder)"""
import base64, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
LIME, TEAL, INK = "#c8ff4d", "#4de1c1", "#0b0d0c"


def mark(uid, bg=True):
    """The mark on a 512 grid: a flat world-disc with three chain nodes on its rim, and a play
    button standing on it."""
    cx, cy, rx, ry, depth = 256, 334, 190, 62, 24
    import math
    nodes = []
    for deg in (150, 90, 30):
        a = math.radians(deg)
        nodes.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    node_svg = "".join(
        f'<circle cx="{x:.1f}" cy="{y + depth / 2:.1f}" r="15" fill="{INK}" stroke="url(#{uid}g)" stroke-width="8"/>'
        for x, y in nodes)
    links = "".join(  # short bars between the nodes, so the rim reads as a chain
        f'<path d="M{nodes[i][0]:.1f} {nodes[i][1] + depth / 2:.1f} Q {(nodes[i][0] + nodes[i + 1][0]) / 2:.1f} {cy + ry + depth / 2 + 6:.1f} {nodes[i + 1][0]:.1f} {nodes[i + 1][1] + depth / 2:.1f}" fill="none" stroke="url(#{uid}g)" stroke-width="8" stroke-linecap="round" opacity=".0"/>'
        for i in range(2))
    tri = "M188 104 L188 312 L372 208 Z"
    background = (f'<rect width="512" height="512" rx="116" fill="{INK}"/>'
                  f'<rect width="512" height="512" rx="116" fill="url(#{uid}glow)"/>'
                  f'<rect x="3" y="3" width="506" height="506" rx="113" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="2"/>'
                  if bg else "")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
 <linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LIME}"/><stop offset="1" stop-color="{TEAL}"/></linearGradient>
 <linearGradient id="{uid}side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2b22"/><stop offset="1" stop-color="#0e1410"/></linearGradient>
 <radialGradient id="{uid}face" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#1c2a20"/><stop offset="1" stop-color="#0f1611"/></radialGradient>
 <radialGradient id="{uid}glow" cx=".5" cy=".62" r=".55"><stop offset="0" stop-color="{LIME}" stop-opacity=".16"/><stop offset="1" stop-color="{LIME}" stop-opacity="0"/></radialGradient>
 <filter id="{uid}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
 <filter id="{uid}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
 <mask id="{uid}m"><path d="{tri}" fill="#fff" stroke="#fff" stroke-width="40" stroke-linejoin="round"/></mask>
 <linearGradient id="{uid}gloss" gradientUnits="userSpaceOnUse" x1="168" y1="84" x2="250" y2="320"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
{background}
<!-- disc: side band, then top face -->
<path d="M{cx - rx} {cy} L{cx - rx} {cy + depth} A{rx} {ry} 0 0 0 {cx + rx} {cy + depth} L{cx + rx} {cy} A{rx} {ry} 0 0 1 {cx - rx} {cy} Z" fill="url(#{uid}side)" stroke="url(#{uid}g)" stroke-width="6" stroke-linejoin="round"/>
<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#{uid}face)" stroke="url(#{uid}g)" stroke-width="10"/>
<ellipse cx="{cx}" cy="{cy}" rx="{rx * .68:.0f}" ry="{ry * .68:.0f}" fill="none" stroke="{LIME}" stroke-opacity=".16" stroke-width="3"/>
<ellipse cx="{cx}" cy="{cy}" rx="{rx * .36:.0f}" ry="{ry * .36:.0f}" fill="none" stroke="{LIME}" stroke-opacity=".12" stroke-width="3"/>
{links}{node_svg}
<!-- play button standing on the disc -->
<ellipse cx="258" cy="322" rx="104" ry="20" fill="#000" opacity=".6" filter="url(#{uid}soft)"/>
<path d="{tri}" fill="{LIME}" opacity=".45" filter="url(#{uid}blur)" stroke="{LIME}" stroke-width="40" stroke-linejoin="round"/>
<path d="{tri}" fill="url(#{uid}g)" stroke="url(#{uid}g)" stroke-width="40" stroke-linejoin="round"/>
<rect width="512" height="512" fill="url(#{uid}gloss)" mask="url(#{uid}m)"/>
</svg>'''


def main():
    font = base64.b64encode(open(os.path.join(HERE, "jakarta.woff2"), "rb").read()).decode()
    open(os.path.join(HERE, "playchain-mark.svg"), "w").write(mark("a", bg=True))
    open(os.path.join(HERE, "playchain-mark-transparent.svg"), "w").write(mark("b", bg=False))

    def word(fg, sub=True, size=150, tag=None, tag_size=34):
        t = (f'<div class="tag" style="color:{fg};opacity:.62;font-size:{tag_size}px">{tag}</div>' if tag else "")
        return (f'<div class="word" style="font-size:{size}px;color:{fg}">PLAY'
                f'<span style="color:{LIME if fg != INK else "#5b8a00"}">CHAIN</span></div>{t}')

    pieces = {
        # id: (html, transparent background?)
        "playchain-logo-icon": (f'<div class="sq">{mark("c")}</div>', True),
        "playchain-logo-icon-transparent": (f'<div class="sq">{mark("d", bg=False)}</div>', True),
        "playchain-logo-horizontal-dark": (f'<div class="h" style="background:{INK}"><div class="m">{mark("e")}</div><div>{word("#f3f3f3", tag="THE WEB3 GAME CONSOLE ON ROBINHOOD CHAIN")}</div></div>', False),
        "playchain-logo-horizontal-transparent": (f'<div class="h"><div class="m">{mark("f", bg=False)}</div><div>{word("#f3f3f3")}</div></div>', True),
        "playchain-logo-horizontal-light": (f'<div class="h" style="background:#f6f7f2"><div class="m">{mark("g")}</div><div>{word(INK, tag="THE WEB3 GAME CONSOLE ON ROBINHOOD CHAIN")}</div></div>', False),
        "playchain-logo-stacked-dark": (f'<div class="st" style="background:{INK}"><div class="m2">{mark("h")}</div>{word("#f3f3f3", size=128, tag="PLAY · VOTE · BURN $WIF")}</div>', False),
        "playchain-banner-x": (f'<div class="bn"><div class="m3">{mark("i")}</div><div>{word("#f3f3f3", size=104, tag="THE WEB3 GAME CONSOLE ON ROBINHOOD CHAIN", tag_size=24)}</div></div>', False),
    }
    css = f'''@font-face{{font-family:J;src:url(data:font/woff2;base64,{font}) format("woff2");font-weight:200 800}}
html,body{{margin:0;background:transparent}} body{{font-family:J,sans-serif}}
.sq{{width:1024px;height:1024px}} .sq svg{{width:100%;height:100%;display:block}}
.h{{display:inline-flex;align-items:center;gap:56px;padding:90px 120px 90px 100px}}
.m{{width:300px;height:300px}} .m svg,.m2 svg,.m3 svg{{width:100%;height:100%;display:block}}
.word{{font-weight:800;letter-spacing:.01em;line-height:1;white-space:nowrap}}
.tag{{font-weight:700;font-size:34px;letter-spacing:.24em;margin-top:26px;white-space:nowrap}}
.st{{display:inline-flex;flex-direction:column;align-items:center;padding:110px 140px 120px;text-align:center}}
.m2{{width:420px;height:420px;margin-bottom:56px}}
.bn{{width:1500px;height:500px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:64px;
     background:radial-gradient(ellipse at 30% 60%,rgba(200,255,77,.14),transparent 55%),radial-gradient(ellipse at 85% 30%,rgba(77,225,193,.10),transparent 50%),{INK}}}
.m3{{width:240px;height:240px;flex-shrink:0}}'''
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome", headless=True)
        for name, (html, transparent) in pieces.items():
            page = b.new_page(viewport={"width": 2400, "height": 1400})
            page.set_content(f"<style>{css}</style>{html}")
            page.evaluate("document.fonts.ready")
            page.locator("body > div").first.screenshot(path=os.path.join(HERE, name + ".png"), omit_background=transparent)
            page.close(); print("wrote", name)
        b.close()


main()
