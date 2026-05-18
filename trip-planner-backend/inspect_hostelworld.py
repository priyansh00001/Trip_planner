import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        print("Navigating to Hostelworld...")
        await page.goto("https://www.hostelworld.com/st/hostels/asia/india/jaipur/", wait_until="domcontentloaded", timeout=60000)
        print("Page loaded, waiting...")
        await page.evaluate("window.scrollBy(0, 1000)")
        await asyncio.sleep(5)
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")
        
        with open("hostelworld.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("HTML saved to hostelworld.html")

        await browser.close()

asyncio.run(main())
