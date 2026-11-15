import json, asyncio
from playwright.async_api import async_playwright
CK=json.load(open("cookies.json")); TOK=CK["__Secure-authjs.session-token"]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx=await b.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36")
        await ctx.add_cookies([{"name":"__Secure-authjs.session-token","value":TOK,"domain":"agentgames.zkverify.io","path":"/","httpOnly":True,"secure":True,"sameSite":"Lax"}])
        pg=await ctx.new_page()
        await pg.goto("https://agentgames.zkverify.io/dashboard", wait_until="networkidle", timeout=60000)
        try: await pg.click("text=Skip tour", timeout=5000)
        except: pass
        await pg.wait_for_timeout(1000)
        await pg.click("text=Register agent")
        await pg.wait_for_timeout(4000)
        print("URL:", pg.url)
        print("BODY>>>", (await pg.inner_text("body"))[:2000].replace("\n"," | "))
        ins=await pg.eval_on_selector_all("input,select,textarea,button","els=>els.map(e=>({t:e.tagName,ty:e.type,n:e.name,ph:e.placeholder,txt:(e.innerText||'').slice(0,40),id:e.id}))")
        print("ELS>>>", json.dumps(ins)[:2000])
        await pg.screenshot(path="agentreg.png", full_page=True)
        await b.close()
asyncio.run(main())
