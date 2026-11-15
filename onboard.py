import json, asyncio
from playwright.async_api import async_playwright

CK = json.load(open("cookies.json"))
TOK = CK["__Secure-authjs.session-token"]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx = await b.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        await ctx.add_cookies([{
            "name":"__Secure-authjs.session-token","value":TOK,
            "domain":"agentgames.zkverify.io","path":"/","httpOnly":True,"secure":True,"sameSite":"Lax"
        }])
        pg = await ctx.new_page()
        await pg.goto("https://agentgames.zkverify.io/register", wait_until="networkidle", timeout=60000)
        print("URL:", pg.url)
        txt = await pg.inner_text("body")
        print("BODY>>>", txt[:1500].replace("\n"," | "))
        # list inputs
        ins = await pg.eval_on_selector_all("input,select,textarea", "els=>els.map(e=>({tag:e.tagName,type:e.type,name:e.name,ph:e.placeholder,id:e.id}))")
        print("INPUTS>>>", json.dumps(ins)[:1200])
        await pg.screenshot(path="reg.png", full_page=True)
        await b.close()

asyncio.run(main())
