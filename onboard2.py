import json, asyncio
from playwright.async_api import async_playwright
CK = json.load(open("cookies.json"))
TOK = CK["__Secure-authjs.session-token"]
HANDLE="nikazkv01"; EMAIL="nikazkv01@divia.biz.id"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx = await b.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        await ctx.add_cookies([{"name":"__Secure-authjs.session-token","value":TOK,"domain":"agentgames.zkverify.io","path":"/","httpOnly":True,"secure":True,"sameSite":"Lax"}])
        pg = await ctx.new_page()
        await pg.goto("https://agentgames.zkverify.io/register", wait_until="networkidle", timeout=60000)
        await pg.fill('input[placeholder="your-handle"]', HANDLE)
        await pg.fill('input[placeholder="you@example.com"]', EMAIL)
        await pg.check('input[type=checkbox]')
        await pg.click('text=Complete registration')
        await pg.wait_for_timeout(6000)
        print("URL after:", pg.url)
        print("BODY>>>", (await pg.inner_text("body"))[:900].replace("\n"," | "))
        await pg.screenshot(path="after_register.png", full_page=True)
        await pg.goto("https://agentgames.zkverify.io/dashboard", wait_until="networkidle", timeout=60000)
        print("DASH URL:", pg.url)
        print("DASH>>>", (await pg.inner_text("body"))[:1500].replace("\n"," | "))
        await pg.screenshot(path="dashboard.png", full_page=True)
        print("COOKIES:", json.dumps(await ctx.cookies()))
        await b.close()
asyncio.run(main())
