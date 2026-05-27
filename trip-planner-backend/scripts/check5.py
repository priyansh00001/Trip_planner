from scrapers.station_codes import (
  get_airport_code, get_railway_code, has_railway, AIRPORT_CODES, RAILWAY_CODES
)

# Check all 25 destinations + 15 origin cities
ALL_CITIES = [
  'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata',
  'Hyderabad', 'Ahmedabad', 'Pune', 'Jaipur', 'Jaisalmer',
  'Jodhpur', 'Udaipur', 'Pushkar', 'Goa', 'Varkala',
  'Kovalam', 'Munnar', 'Coorg', 'Hampi', 'Pondicherry',
  'Manali', 'Shimla', 'Dharamshala', 'Spiti Valley',
  'Darjeeling', 'Gangtok', 'Varanasi', 'Agra',
  'Andaman Islands', 'Kaziranga', 'Ranthambore', 'Jim Corbett',
  'Lucknow', 'Chandigarh', 'Bhopal', 'Kochi', 'Guwahati'
]

print(f"{'City':<20} {'Airport':<10} {'Railway':<10} {'Has Rail'}")
print('-' * 55)
missing_airport = []
missing_rail    = []
for city in ALL_CITIES:
  airport = get_airport_code(city)
  railway = get_railway_code(city)
  has_r   = has_railway(city)
  print(f"{city:<20} {str(airport):<10} {str(railway):<10} {has_r}")
  if not airport:    missing_airport.append(city)
  if railway is None and city not in ['Munnar','Coorg','Spiti Valley',
                                       'Gangtok','Andaman Islands']:
    missing_rail.append(city)

print()
print('Missing airport codes:', missing_airport)
print('Unexpected missing rail:', missing_rail)
