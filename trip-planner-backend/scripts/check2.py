import asyncio
from scrapers.transport_scraper import TransportScraper
from scrapers.browser_agent import BrowserAgent
from datetime import date, timedelta

travel_date = (date.today() + timedelta(days=30)).strftime('%Y%m%d')

async def main():
  agent = BrowserAgent()

  # Source 1 — Ixigo flights
  print('=== IXIGO FLIGHTS ===')
  url = f'https://www.ixigo.com/search/result/flight/DEL/JAI/{travel_date}/1/0/0/E/OW'
  try:
    result = await agent.extract_from_url(url, 'Delhi to Jaipur flight')
    print('transport items:', len(result.get('transport', [])))
    print('quality:', result.get('_quality'))
    print('skipped:', result.get('_skipped'))
    print('reason:', result.get('_reason'))
    if result.get('transport'):
      print('sample:', str(result['transport'][0]).encode('ascii', 'ignore').decode())
  except Exception as e:
    print('EXCEPTION:', e)

  print()

  # Source 2 — Railyatri trains
  print('=== RAILYATRI TRAINS ===')
  url2 = 'https://www.railyatri.in/trains-between-stations?from=NDLS&to=JP'
  try:
    result2 = await agent.extract_from_url(url2, 'Delhi to Jaipur train')
    print('transport items:', len(result2.get('transport', [])))
    print('quality:', result2.get('_quality'))
    print('skipped:', result2.get('_skipped'))
    print('reason:', result2.get('_reason'))
    if result2.get('transport'):
      print('sample:', str(result2['transport'][0]).encode('ascii', 'ignore').decode())
  except Exception as e:
    print('EXCEPTION:', e)

  print()

  # Source 3 — RedBus
  print('=== REDBUS ===')
  doj = (date.today() + timedelta(days=30)).strftime('%d-%b-%Y')
  url3 = f'https://www.redbus.in/bus-tickets/delhi-to-jaipur?fromCityName=Delhi&toCityName=Jaipur&doj={doj}'
  try:
    result3 = await agent.extract_from_url(url3, 'Delhi to Jaipur bus')
    print('transport items:', len(result3.get('transport', [])))
    print('quality:', result3.get('_quality'))
    print('skipped:', result3.get('_skipped'))
    print('reason:', result3.get('_reason'))
    if result3.get('transport'):
      print('sample:', str(result3['transport'][0]).encode('ascii', 'ignore').decode())
  except Exception as e:
    print('EXCEPTION:', e)

if __name__ == '__main__':
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
