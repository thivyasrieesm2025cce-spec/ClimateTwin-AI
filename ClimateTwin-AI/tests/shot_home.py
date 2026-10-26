import sys
from playwright.sync_api import sync_playwright
out=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    for w,h in ((1366,900),(390,844)):
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text else None)
        pg.goto('file:///home/claude/climatetwin/dist/index.html'); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{out}/home_{w}.png',full_page=True)
        ow=pg.evaluate('document.documentElement.scrollWidth'); print(w,'scrollWidth',ow,'errors',errs)
    b.close()
