import asyncio
from playwright.async_api import async_playwright
from datetime import date, timedelta

travel_date = (date.today() + timedelta(days=30)).strftime('%Y%m%d')
doj = (date.today() + timedelta(days=30)).strftime('%d-%b-%Y')

URLS = [
  ('ixigo_flight',
   f'https://www.ixigo.com/search/result/flight/DEL/JAI/{travel_date}/1/0/0/E/OW'),
  ('railyatri',
   'https://www.railyatri.in/trains-between-stations?from=NDLS&to=JP'),
  ('redbus',
   f'https://www.redbus.in/bus-tickets/delhi-to-jaipur?fromCityName=Delhi&toCityName=Jaipur&doj={doj}'),
  ('ixigo_train',
   'https://www.ixigo.com/train/search/result?from=NDLS&to=JP'),
  ('google_flights',
   f'https://www.google.com/travel/flights/search?tfs=CBwQAhooagcIARIDREVMEgoyMDI1LTExLTAxcgcIARIDSkFJGgJJTg'),
]

async def main():
  async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    for name, url in URLS:
      try:
        page = await browser.new_page()
        await page.set_extra_http_headers({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        resp = await page.goto(url, wait_until='domcontentloaded', timeout=20000)
        await page.wait_for_timeout(3000)
        text = await page.inner_text('body')
        text_len = len(text.strip())
        title = await page.title()
        status = resp.status if resp else 'unknown'
        blocked = any(p in text.lower() for p in [
          'captcha', 'verify you are human', 'access denied',
          'enable javascript', 'just a moment', '403', 'blocked'
        ])
        print(f'{name}:')
        print(f'  status={status} title={title[:50].encode("ascii", "ignore").decode()}')
        print(f'  content_length={text_len}')
        print(f'  blocked={blocked}')
        print(f'  first_200_chars={text[:200].strip().encode("ascii", "ignore").decode()}')
        await page.close()
      except Exception as e:
        print(f'{name}: FAILED — {e}')
    await browser.close()

if __name__ == '__main__':
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
