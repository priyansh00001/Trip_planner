"""A1 — Connectivity pre-check for all target sites."""
import httpx
import asyncio

async def check():
    sites = {
        'ixigo_flights': 'https://www.ixigo.com',
        'ixigo_trains':  'https://www.ixigo.com/train',
        'redbus':        'https://www.redbus.in',
        'nominatim':     'https://nominatim.openstreetmap.org',
    }
    async with httpx.AsyncClient(timeout=10) as client:
        for name, url in sites.items():
            try:
                r = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                print(f'{name}: {r.status_code}')
            except Exception as e:
                print(f'{name}: FAILED — {e}')

asyncio.run(check())
