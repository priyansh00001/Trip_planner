from slugify import slugify

# Structure: (origin, destination): {mode: (min_inr, max_inr, duration_min, operators[])}
SEED_DATA: dict[tuple, dict] = {

  ("Delhi", "Jaipur"): {
    "flight": (1500, 5000,   65,  ["IndiGo", "Air India", "SpiceJet"]),
    "train":  (155,  1200,   270, ["Shatabdi Express", "Ajmer Shatabdi", "Intercity SF"]),
    "bus":    (350,  900,    300, ["RSRTC Volvo", "Orange Travels", "Raj Travels"]),
  },
  ("Delhi", "Agra"): {
    "train":  (100,  800,    120, ["Gatimaan Express", "Taj Express", "Shatabdi"]),
    "bus":    (250,  700,    240, ["UPSRTC", "Raj National Express"]),
  },
  ("Delhi", "Manali"): {
    "bus":    (900,  1800,   780, ["HPTDC Volvo", "HRTC", "Manali Travels"]),
    "train":  (500,  1800,   480, ["Kalka Shatabdi + taxi", "Chandigarh connect"]),
  },
  ("Delhi", "Shimla"): {
    "bus":    (700,  1400,   540, ["HRTC Volvo", "HPTDC", "Kalka connect"]),
    "train":  (350,  1200,   360, ["Shatabdi to Kalka + toy train"]),
  },
  ("Delhi", "Dharamshala"): {
    "bus":    (900,  1600,   720, ["HRTC Volvo", "Himachal Holidays"]),
    "flight": (3500, 9000,   75,  ["IndiGo", "Air India"]),
  },
  ("Delhi", "Varanasi"): {
    "flight": (2500, 9000,   90,  ["IndiGo", "Air India", "Vistara"]),
    "train":  (500,  2200,   660, ["Kashi Vishwanath", "Poorva Express", "Rajdhani"]),
    "bus":    (800,  1800,   720, ["UP Roadways", "Shrinath"]),
  },
  ("Delhi", "Goa"): {
    "flight": (3500, 12000,  150, ["IndiGo", "GoAir", "SpiceJet", "Air India"]),
    "train":  (1000, 4500,   1680,["Rajdhani", "Goa Express"]),
  },
  ("Delhi", "Bangalore"): {
    "flight": (3500, 14000,  160, ["IndiGo", "Air India", "Vistara", "SpiceJet"]),
    "train":  (1500, 5500,   1800,["Rajdhani", "Karnataka Express"]),
  },
  ("Mumbai", "Goa"): {
    "flight": (1500, 7000,   75,  ["IndiGo", "GoAir", "SpiceJet"]),
    "train":  (400,  2000,   480, ["Konkan Railway", "Mandovi Express", "Tejas"]),
    "bus":    (700,  1800,   540, ["Paulo Travels", "VRL", "Kadamba"]),
  },
  ("Mumbai", "Pune"): {
    "train":  (100,  600,    180, ["Deccan Queen", "Shatabdi", "Pragati"]),
    "bus":    (200,  700,    180, ["MSRTC Shivneri", "Neeta Travels", "VRL"]),
  },
  ("Mumbai", "Udaipur"): {
    "flight": (2500, 9000,   90,  ["IndiGo", "Air India"]),
    "train":  (500,  2200,   720, ["Mewar Express", "Chetak Express"]),
    "bus":    (1200, 2500,   780, ["Raj Travels", "Hanuwant Travels"]),
  },
  ("Bangalore", "Goa"): {
    "flight": (1800, 7000,   60,  ["IndiGo", "SpiceJet", "Air India"]),
    "train":  (300,  1800,   540, ["Goa Express", "VSG Express"]),
    "bus":    (800,  2000,   600, ["VRL", "SRS Travels", "Orange"]),
  },
  ("Bangalore", "Coorg"): {
    "bus":    (300,  700,    240, ["KSRTC", "Kallada", "SRS"]),
  },
  ("Chennai", "Pondicherry"): {
    "bus":    (150,  400,    150, ["TNSTC", "PTC", "Parveen"]),
    "train":  (50,   300,    180, ["Puducherry Express"]),
  },
  ("Kolkata", "Darjeeling"): {
    "flight": (2000, 8000,   60,  ["IndiGo", "Air India"]),
    "train":  (400,  1800,   480, ["Darjeeling Mail", "Kanchankanya"]),
    "bus":    (700,  1500,   600, ["North Bengal ST", "Sikkim Nationalised"]),
  },
  ("Jaipur", "Goa"): {
    "flight": (4000, 12000,  150, ["IndiGo", "SpiceJet", "Air India"]),
    "train":  (900,  3500,   1440,["Jaipur–Vasco Express"]),
  },
  ("Delhi", "Pushkar"): {
    "bus":    (400,  900,    420, ["RSRTC", "Raj Travels"]),
    "train":  (200,  900,    360, ["via Ajmer"]),
  },
  ("Mumbai", "Hampi"): {
    "train":  (400,  2000,   720, ["Hampi Express", "UBL Express"]),
    "bus":    (800,  1800,   840, ["VRL", "SRS Travels"]),
  },
  ("Chennai", "Hampi"): {
    "train":  (350,  1800,   600, ["Hampi Express"]),
    "bus":    (700,  1600,   720, ["KSRTC", "VRL"]),
  },
  ("Bangalore", "Hampi"): {
    "bus":    (500,  1200,   480, ["KSRTC Rajahamsa", "VRL"]),
    "train":  (200,  1000,   480, ["Hampi Express"]),
  },
  ("Chennai", "Varkala"): {
    "train":  (200,  1200,   360, ["Kerala Express", "Island Express"]),
    "bus":    (600,  1400,   480, ["TNSTC", "KSRTC"]),
  },
  ("Bangalore", "Munnar"): {
    "bus":    (600,  1400,   540, ["KSRTC", "Kerala RTC"]),
  },
  ("Bangalore", "Dharamshala"): {
    "flight": (4000, 14000,  180, ["IndiGo via Delhi", "Air India"]),
  },
  ("Delhi", "Spiti Valley"): {
    "bus":    (800,  1600,   960, ["HRTC", "local buses via Shimla"]),
  },
  ("Kolkata", "Gangtok"): {
    "bus":    (500,  1200,   540, ["SNT", "Sikkim Nationalised"]),
    "flight": (2500, 8000,   60,  ["IndiGo to Bagdogra + taxi"]),
  },
  ("Delhi", "Andaman Islands"): {
    "flight": (6000, 20000,  180, ["IndiGo", "Air India", "GoAir"]),
  },
  ("Kolkata", "Kaziranga"): {
    "bus":    (500,  1200,   480, ["ASTC", "private operators"]),
    "train":  (300,  1200,   360, ["via Furkating"]),
  },
  ("Delhi", "Ranthambore"): {
    "train":  (200,  900,    240, ["Sawai Madhopur trains"]),
    "bus":    (350,  800,    300, ["RSRTC"]),
  },
  ("Delhi", "Jim Corbett"): {
    "train":  (200,  800,    300, ["via Ramnagar"]),
    "bus":    (400,  900,    330, ["Uttarakhand Roadways"]),
  },
  ("Mumbai", "Jim Corbett"): {
    "flight": (3000, 10000,  120, ["IndiGo via Delhi"]),
    "train":  (600,  2500,   960, ["via Delhi + Ramnagar"]),
  },
}

def get_seed_options(
  origin: str, destination: str
) -> list[dict]:
  """
  Returns seed transport options for a city pair.
  Tries both (origin, dest) and (dest, origin) if direct
  pair not found. Returns empty list if no seed data exists.
  """
  from datetime import datetime

  key = (origin.strip(), destination.strip())
  rev = (destination.strip(), origin.strip())

  data = SEED_DATA.get(key) or SEED_DATA.get(rev) or {}
  if not data:
    # Try partial match — check if either city appears in any key
    for k, v in SEED_DATA.items():
      if (origin.lower() in k[0].lower() or
          origin.lower() in k[1].lower()) and \
         (destination.lower() in k[0].lower() or
          destination.lower() in k[1].lower()):
        data = v
        break

  if not data:
    return []

  results = []
  for mode, (price_min, price_max, duration, operators) in data.items():
    for op in operators[:2]:  # max 2 operators per mode from seed
      results.append({
        "origin_city":        origin,
        "destination_city":   destination,
        "origin_slug":        slugify(origin),
        "destination_slug":   slugify(destination),
        "mode":               mode,
        "operator":           op,
        "price_min_inr":      price_min,
        "price_max_inr":      price_max,
        "duration_minutes":   duration,
        "departure_times":    [],
        "frequency":          "Check operator website",
        "booking_url":        _booking_url(mode, origin, destination, op),
        "source":             "seed_data",
        "scraped_at":         datetime.utcnow().isoformat(),
      })
  return results

def _booking_url(
  mode: str, origin: str, dest: str, operator: str
) -> str:
  o = origin.lower().replace(" ", "-")
  d = dest.lower().replace(" ", "-")
  if mode == "flight":
    from scrapers.station_codes import get_airport_code
    oc = get_airport_code(origin) or origin[:3].upper()
    dc = get_airport_code(dest)   or dest[:3].upper()
    return (
      f"https://www.google.com/flights#flt="
      f"{oc}.{dc}..;c:INR;e:1;sd:1;t:f"
    )
  if mode == "train":
    return f"https://www.irctc.co.in/nget/train-search"
  if mode == "bus":
    return f"https://www.redbus.in/bus-tickets/{o}-to-{d}"
  return ""
