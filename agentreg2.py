import json, asyncio
from playwright.async_api import async_playwright
CK=json.load(open("cookies.json")); TOK=CK["__Secure-authjs.session-token"]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx=await b.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36")
        await ctx.add_cookies([{"name":"__Secure-authjs.session-token","value":TOK,"domain":"agentgames.zkverify.io","path":"/","httpOnly":True,"secure":True,"sameSite":"Lax"}])
        pg=await ctx.new_page()
        await pg.goto("https://agentgames.zkverify.io/dashboard/agents", wait_until="networkidle", timeout=60000)
        btns = pg.locator("button:has-text('Register agent')")
        print("count:", await btns.count())
        for i in range(await btns.count()):
            try:
                await btns.nth(i).click(timeout=4000)
                await pg.wait_for_timeout(1500)
                dlg = pg.locator("[role=dialog]")
                if await dlg.count():
                    print("dialog opened at btn", i)
                    print("DLG>>>", (await dlg.first.inner_text())[:1200].replace("\n"," | "))
                    ins=await dlg.first.locator("input,select,textarea,button").evaluate_all("els=>els.map(e=>({t:e.tagName,ty:e.type,ph:e.placeholder,txt:(e.innerText||'').slice(0,30)}))")
                    print("FIELDS>>>", json.dumps(ins)[:1500])
                    break
            except Exception as e:
                print("btn",i,"err",str(e)[:60])
        await pg.screenshot(path="agentmodal.png", full_page=True)
        await b.close()
asyncio.run(main())
