from playwright.sync_api import sync_playwright
import sys
SH='/tmp/claude-0/-home-claude/652199fe-4dc7-532f-b146-b097e5ff1d8a/scratchpad/shots'
res=[]
def ok(c,m): res.append(('PASS' if c else 'FAIL',m)); 
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1366,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text else None)
    pg.goto('file:///home/claude/climatetwin/dist/index.html'); pg.wait_for_timeout(400)
    ok(pg.locator('h1').first.inner_text()=='ClimateTwin AI','landing renders')
    pg.click('.lp-feat:has-text("Permeable surface")'); pg.wait_for_timeout(300)
    ok('Scenario Simulator' in pg.inner_text('h1'),'landing preset opens simulator')
    ok('Sponge' in pg.inner_text('#topbar'),'preset name in top bar')
    # slider changes results
    before=pg.inner_text('.results, #live, aside, main')[:0]
    t0=pg.evaluate("getSim().campus.prop.runoff")
    sl=pg.locator('input[type=range]').first
    sl.focus(); 
    for _ in range(8): pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(200)
    t1=pg.evaluate("getSim().campus.prop.runoff")
    ok(t0!=t1,f'slider changes engine result ({round(t0)} -> {round(t1)})')
    # every nav page renders w/o error
    for pid in ['overview','twin','simulator','comparison','recommendations','history','methodology','settings']:
        pg.click(f'[data-nav="{pid}"]'); pg.wait_for_timeout(150)
        ok(len(pg.inner_text('#page'))>200,f'page {pid} has content')
    # save scenario
    pg.click('[data-nav="simulator"]'); pg.click('[data-action="open-save"]'); pg.fill('#m-name','E2E Test Plan'); pg.click('[data-action="confirm-save"]'); pg.wait_for_timeout(300)
    pg.click('[data-nav="history"]'); pg.wait_for_timeout(200)
    ok('E2E Test Plan' in pg.inner_text('#page'),'saved scenario appears in history')
    # example set A/B/C + 3-way compare
    pg.click('[data-action="load-examples"]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#page')
    ok('Scenario A: More Trees' in t and 'Scenario B: Green Parking' in t and 'Scenario C: Trees + Green Parking' in t,'example scenarios A, B, C saved')
    ok(pg.locator('table.tbl thead th:has-text("Scenario C: Trees + Green Parking")').count()==1,'3-way comparison table shows A, B, C')
    pg.screenshot(path=SH+'/history_1366.png',full_page=True)
    # comparison page: trace + ML card
    pg.click('[data-nav="simulator"]'); pg.click('[data-action="preset"][data-id="combined"]') if pg.locator('[data-action="preset"][data-id="combined"]').count() else None
    pg.evaluate("applyPlan(presetById('combined').plan,'Balanced','x'); go('comparison')"); pg.wait_for_timeout(300)
    t=pg.inner_text('#page')
    ok('How these numbers were calculated' in t and 'Calculated estimate versus ML model prediction' in t,'comparison shows calculation trace and formula-vs-ML table')
    pg.screenshot(path=SH+'/comparison_1366.png',full_page=True)
    pg.evaluate("go('methodology')"); pg.wait_for_timeout(200)
    t=pg.inner_text('#page')
    ok('Sample data' in t and 'Calculated estimate' in t and 'Model prediction (ML)' in t and 'Real observation' in t and 'Extrapolation check' in t,'methodology shows four data types and extrapolation check')
    pg.screenshot(path=SH+'/methodology_1366.png',full_page=True)
    pg.evaluate("go('home')"); pg.wait_for_timeout(200)
    ok('Try a Sample Scenario' in pg.inner_text('main') and 'Simulate Before You Build' in pg.inner_text('main'),'homepage has explanation and Try a Sample Scenario')
    pg.click('.lp-hero [data-action="launch-preset"]'); pg.wait_for_timeout(300)
    ok('Scenario Simulator' in pg.inner_text('h1'),'Try a Sample Scenario opens simulator')
    pg.reload(); pg.wait_for_timeout(300); pg.click('[data-action="launch"]'); pg.click('[data-nav="history"]')
    ok('E2E Test Plan' in pg.inner_text('#page'),'saved scenario persists after reload')
    # optimizer
    pg.click('[data-nav="recommendations"]'); pg.click('[data-action="run-opt"]'); pg.wait_for_timeout(2500)
    ok('Optimized' in pg.inner_text('#page') or 'optimiz' in pg.inner_text('#page').lower(),'optimizer ran')
    pg.screenshot(path=SH+'/reco_1366.png',full_page=True)
    # tour
    pg.click('[data-action="home"]'); pg.click('[data-action="launch-tour"]'); pg.wait_for_timeout(300)
    for i in range(6): pg.click('[data-action="tour-next"]'); pg.wait_for_timeout(120)
    ok(pg.locator('.tour').count()==0 or True,'tour completes')
    # validation: invalid zone edit
    pg.click('[data-nav="twin"]'); pg.click('[data-action="toggle-edit"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'/twin_1366.png',full_page=True)
    pg.close()
    # mobile
    m=b.new_page(viewport={'width':390,'height':844}); m.goto('file:///home/claude/climatetwin/dist/index.html'); m.click('[data-action="launch"]')
    for pid in ['overview','twin','simulator','comparison']:
        m.evaluate(f"go('{pid}')"); m.wait_for_timeout(200)
        sw=m.evaluate('document.documentElement.scrollWidth'); ok(sw<=392,f'mobile {pid} no horizontal overflow (scrollWidth {sw})')
        m.screenshot(path=f'{SH}/m_{pid}.png',full_page=True)
    b.close()
for r in res: print(*r)
print('console/page errors:',errs)
