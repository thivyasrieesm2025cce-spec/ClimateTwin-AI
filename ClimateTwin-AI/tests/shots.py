import sys, os, json
from playwright.sync_api import sync_playwright
out = sys.argv[1]; pages = sys.argv[2].split(',') ; w=int(sys.argv[3]) if len(sys.argv)>3 else 1366; h=int(sys.argv[4]) if len(sys.argv)>4 else 900
url = 'file:///home/claude/climatetwin/dist/index.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width':w,'height':h})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(600)
    for name in pages:
        if name!='home':
            pg.evaluate("(n)=>{ if(typeof go==='function') go(n); }", name)
        pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(out, f'{name}_{w}.png'), full_page=True)
    print('\n'.join(errs) if errs else 'no console errors')
    b.close()
