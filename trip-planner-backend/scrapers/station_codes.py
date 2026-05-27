# IMPLEMENTATION NOTE: Maps Indian city names to transport codes.
# Ixigo flights use IATA airport codes.
# Ixigo/Railyatri trains use Indian Railways station codes.
# Without correct codes, searches return empty results silently.

AIRPORT_CODES = {
  "delhi":      "DEL",  "new delhi":   "DEL",
  "mumbai":     "BOM",  "bombay":      "BOM",
  "bangalore":  "BLR",  "bengaluru":   "BLR",
  "chennai":    "MAA",  "hyderabad":   "HYD",
  "kolkata":    "CCU",  "calcutta":    "CCU",
  "pune":       "PNQ",  "ahmedabad":   "AMD",
  "goa":        "GOI",  "goa north":   "GOI",
  "goa south":  "GOI",  "kochi":       "COK",
  "jaipur":     "JAI",  "varanasi":    "VNS",
  "agra":       "AGR",  "lucknow":     "LKO",
  "chandigarh": "IXC",  "amritsar":    "ATQ",
  "srinagar":   "SXR",  "leh":         "IXL",
  "bhubaneswar":"BBI",  "guwahati":    "GAU",
  "patna":      "PAT",  "ranchi":      "IXR",
  "indore":     "IDR",  "nagpur":      "NAG",
  "coimbatore": "CJB",  "mangalore":   "IXE",
  "visakhapatnam":"VTZ","port blair":  "IXZ",
  "jaisalmer":    "JSA",
  "jodhpur":      "JDH",
  "udaipur":      "UDR",
  "pushkar":      None,   # nearest is Ajmer, no airport
  "varkala":      None,   # nearest is TRV (Trivandrum)
  "kovalam":      "TRV",
  "munnar":       None,   # no airport, nearest COK
  "coorg":        None,   # no airport, nearest MYQ
  "hampi":        "HBX",  # Hubli airport, nearest
  "pondicherry":  "PNY",
  "manali":       "KUU",  # Kullu-Manali airport
  "shimla":       "SLV",
  "dharamshala":  "DHM",  # Gaggal airport
  "spiti valley": None,   # no airport
  "darjeeling":   "IXB",  # Bagdogra, nearest
  "gangtok":      "IXB",  # Bagdogra, nearest
  "andaman islands": "IXZ",
  "kaziranga":    "GAU",  # Guwahati, nearest
  "ranthambore":  "JAI",  # Jaipur, nearest
  "jim corbett":  "IXD",  # Allahabad alt; or DEL
  "bhopal":       "BHO",
}

RAILWAY_CODES = {
  "delhi":       "NDLS", "new delhi":    "NDLS",
  "mumbai":      "CSTM", "mumbai central":"BCT",
  "bangalore":   "SBC",  "bengaluru":    "SBC",
  "chennai":     "MAS",  "hyderabad":    "HYB",
  "kolkata":     "HWH",  "calcutta":     "HWH",
  "pune":        "PUNE", "ahmedabad":    "ADI",
  "jaipur":      "JP",   "varanasi":     "BSB",
  "agra":        "AGC",  "lucknow":      "LKO",
  "goa":         "MAO",  "kochi":        "ERS",
  "manali":      None,   # no railway — skip train search
  "shimla":      "SML",  "darjeeling":   "NJP",
  "udaipur":     "UDZ",  "jodhpur":      "JU",
  "jaisalmer":   "JSM",  "pushkar":      "AII",
  "hampi":       "HPT",  "pondicherry":  "PDY",
  "munnar":      None,   # no railway
  "coorg":       None,   # no railway
  "spiti valley":None,   # no railway
  "dharamshala": "PTKC", "gangtok":      None,
  "andaman islands":None,"kaziranga":    "FKM",
  "ranthambore": "SWM",  "jim corbett":  "RMK",
  "varkala":      "VAK",
  "kovalam":      None,   # no railway
  "chandigarh":   "CDG",
  "bhopal":       "BPL",
  "guwahati":     "GHY",
}

def get_airport_code(city: str) -> str | None:
  return AIRPORT_CODES.get(city.lower().strip())

def get_railway_code(city: str) -> str | None:
  return RAILWAY_CODES.get(city.lower().strip())

def has_railway(city: str) -> bool:
  code = RAILWAY_CODES.get(city.lower().strip())
  return code is not None  # None means no railway connectivity
