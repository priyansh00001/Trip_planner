import asyncio
from core.supabase_client import db

async def main():
    try:
        response = db.table('transport_options').select('*').execute()
        data = response.data
        
        if not data:
            print("Total pairs with data: 0")
            print("Pairs with all 3 modes: 0")
            print("Fallback records: 0 / Scraped records: 0 / Calculated: 0")
            return
            
        # Aggregations
        q1_dict = {}
        q2_dict = {}
        q3_dict = {}
        q4_dict = {}
        
        for r in data:
            orig = r['origin_slug']
            dest = r['destination_slug']
            mode = r['mode']
            src = r['source']
            price = r.get('price_min_inr')
            scraped = r.get('scraped_at')
            
            # Query 1
            key1 = (orig, dest, mode, src)
            if key1 not in q1_dict:
                q1_dict[key1] = {'count': 0, 'cheapest': float('inf'), 'freshest': ''}
            q1_dict[key1]['count'] += 1
            if price is not None and price < q1_dict[key1]['cheapest']:
                q1_dict[key1]['cheapest'] = price
            if scraped and scraped > q1_dict[key1]['freshest']:
                q1_dict[key1]['freshest'] = scraped
                
            # Query 2
            key2 = (orig, dest)
            if key2 not in q2_dict:
                q2_dict[key2] = {'modes': set(), 'sources': set()}
            q2_dict[key2]['modes'].add(mode)
            q2_dict[key2]['sources'].add(src)
            
            # Query 3
            key3 = (src, mode)
            if key3 not in q3_dict:
                q3_dict[key3] = 0
            q3_dict[key3] += 1
            
            # Query 4
            data_type = src if src in ['fallback', 'calculated'] else 'scraped'
            if data_type not in q4_dict:
                q4_dict[data_type] = 0
            q4_dict[data_type] += 1
            
        print("--- QUERY 1 (Current transport coverage) ---")
        for k in sorted(q1_dict.keys()):
            v = q1_dict[k]
            cheap = v['cheapest'] if v['cheapest'] != float('inf') else 'None'
            print(f"{k[0]:<15} {k[1]:<15} {k[2]:<8} {k[3]:<10} {v['count']:<5} {cheap:<8} {v['freshest']}")
            
        print("\n--- QUERY 2 (Pairs with all modes) ---")
        q2_list = [(k, v) for k, v in q2_dict.items()]
        q2_list.sort(key=lambda x: len(x[1]['modes']), reverse=True)
        for k, v in q2_list:
            modes = ", ".join(sorted(v['modes']))
            srcs = ", ".join(sorted(v['sources']))
            print(f"{k[0]:<15} {k[1]:<15} {len(v['modes']):<5} {modes:<20} {srcs}")
            
        print("\n--- QUERY 3 (Sources used) ---")
        for k in sorted(q3_dict.keys()):
            print(f"{k[0]:<15} {k[1]:<10} {q3_dict[k]}")
            
        print("\n--- QUERY 4 (Fallback vs real ratio) ---")
        for k in sorted(q4_dict.keys()):
            print(f"{k:<15} {q4_dict[k]}")
            
        print("\nDB STATE VARIABLES:")
        total_pairs = len(q2_dict)
        pairs_3_modes = sum(1 for v in q2_dict.values() if len(v['modes']) >= 3)
        fallback_recs = q4_dict.get('fallback', 0)
        scraped_recs = q4_dict.get('scraped', 0)
        calc_recs = q4_dict.get('calculated', 0)
        
        print(f"Total pairs with data: {total_pairs}")
        print(f"Pairs with all 3 modes: {pairs_3_modes}")
        print(f"Fallback records: {fallback_recs} / Scraped records: {scraped_recs} / Calculated: {calc_recs}")

    except Exception as e:
        print(f"Failed: {e}")

if __name__ == '__main__':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
