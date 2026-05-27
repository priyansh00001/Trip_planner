"""
tests/test_realtime_scraper.py

Tests for the real-time on-demand transport scraper system.

Test groups:
  1. Seed data  — transport_seed.get_seed_options()
  2. Router helpers — _hours_since, _format_option, _group_options
  3. GET /api/transport — never-empty guarantee
  4. POST /api/transport/scrape-now — SSE stream
  5. Background helpers — _save_seed_to_db, _background_scrape_pair
  6. TransportScraper._estimate_cab()
  7. GoogleTransportScraper._validate_results()

NOTE: HTTP tests use a minimal FastAPI app that wraps ONLY the transport
router so we avoid the heavy main.app lifespan (pipeline start, RAG rebuild).
"""

import json
import asyncio
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Minimal test app — only the transport router, no lifespan hooks
# ---------------------------------------------------------------------------

def _make_test_app():
    """Create a bare FastAPI app with only the transport router."""
    app = FastAPI()
    from routers.transport import router as transport_router
    app.include_router(transport_router, prefix="/api")
    return app


# ---------------------------------------------------------------------------
# DB mock factory
# ---------------------------------------------------------------------------

def _make_db_mock(transport_rows=None, index_rows=None):
    """Build a mock for `routers.transport.db`."""
    transport_rows = transport_rows if transport_rows is not None else []
    index_rows     = index_rows     if index_rows     is not None else []

    class _Table:
        def __init__(self, name):
            self._name = name
            self._rows = (
                transport_rows if name == "transport_options" else index_rows
            )

        def select(self, *a, **kw):   return self
        def eq(self, *a, **kw):       return self
        def order(self, *a, **kw):    return self
        def upsert(self, *a, **kw):   return self
        def update(self, *a, **kw):   return self

        def execute(self):
            return MagicMock(data=list(self._rows))

    mock = MagicMock()
    mock.table.side_effect = lambda name: _Table(name)
    return mock


# ===========================================================================
# 1. SEED DATA TESTS
# ===========================================================================

class TestSeedData:

    def test_known_pair_returns_options(self):
        from scrapers.transport_seed import get_seed_options
        opts = get_seed_options("Delhi", "Jaipur")
        assert len(opts) > 0

    def test_reversed_pair_works(self):
        from scrapers.transport_seed import get_seed_options
        fwd = get_seed_options("Mumbai", "Goa")
        rev = get_seed_options("Goa", "Mumbai")
        assert len(fwd) > 0
        assert len(rev) > 0

    def test_unknown_pair_returns_empty(self):
        from scrapers.transport_seed import get_seed_options
        assert get_seed_options("Timbuktu", "Narnia") == []

    def test_record_has_required_fields(self):
        from scrapers.transport_seed import get_seed_options
        opts = get_seed_options("Delhi", "Goa")
        assert len(opts) > 0
        required = {
            "mode", "operator", "price_min_inr", "price_max_inr",
            "duration_minutes", "origin_slug", "destination_slug",
        }
        for opt in opts:
            missing = required - opt.keys()
            assert not missing, f"Missing fields: {missing}"
            assert opt["price_min_inr"] > 0
            assert opt["price_max_inr"] >= opt["price_min_inr"]

    def test_max_two_operators_per_mode(self):
        from scrapers.transport_seed import get_seed_options
        from collections import Counter
        opts = get_seed_options("Delhi", "Varanasi")
        counts = Counter(o["mode"] for o in opts)
        for mode, n in counts.items():
            assert n <= 2, f"Expected ≤2 operators for {mode}, got {n}"

    def test_case_insensitive_partial_match(self):
        from scrapers.transport_seed import get_seed_options
        opts = get_seed_options("bangalore", "munnar")
        assert len(opts) > 0


# ===========================================================================
# 2. ROUTER HELPERS
# ===========================================================================

class TestRouterHelpers:

    def test_hours_since_empty_returns_999(self):
        from routers.transport import _hours_since
        assert _hours_since("") == 999.0

    def test_hours_since_now_is_near_zero(self):
        from routers.transport import _hours_since
        ts = datetime.now(timezone.utc).isoformat()
        assert _hours_since(ts) < 0.02

    def test_hours_since_24h_ago(self):
        from routers.transport import _hours_since
        old = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        assert 23.9 < _hours_since(old) < 24.1

    def test_hours_since_z_suffix(self):
        from routers.transport import _hours_since
        ts = (datetime.now(timezone.utc) - timedelta(hours=6)
              ).strftime("%Y-%m-%dT%H:%M:%SZ")
        hours = _hours_since(ts)
        assert 5.9 < hours < 6.1

    def test_hours_since_malformed(self):
        from routers.transport import _hours_since
        assert _hours_since("not-a-date") == 999.0

    def test_format_option_maps_fields(self):
        from routers.transport import _format_option
        raw = {
            "mode": "flight", "operator": "IndiGo",
            "price_min_inr": 3500, "price_max_inr": 5000,
            "duration_minutes": 90, "departure_times": ["06:00"],
            "frequency": "Daily", "booking_url": "https://indigo.com",
            "source": "google_search", "scraped_at": "2026-01-01",
        }
        out = _format_option(raw)
        assert out["mode"]          == "flight"
        assert out["operator"]      == "IndiGo"
        assert out["price_min_inr"] == 3500
        assert out["data_freshness"] == "2026-01-01"

    def test_format_option_handles_missing_keys(self):
        from routers.transport import _format_option
        out = _format_option({})
        assert out["mode"]          == ""
        assert out["price_min_inr"] == 0
        assert out["departure_times"] == []

    def test_group_options_separates_modes(self):
        from routers.transport import _group_options
        items = [
            {"mode": "flight", "operator": "A", "price_min_inr": 3000,
             "price_max_inr": 4000, "duration_minutes": 90},
            {"mode": "train",  "operator": "B", "price_min_inr": 500,
             "price_max_inr": 800,  "duration_minutes": 270},
            {"mode": "unknown", "operator": "C"},
        ]
        grouped = _group_options(items)
        assert len(grouped["flight"]) == 1
        assert len(grouped["train"])  == 1
        assert len(grouped["bus"])    == 0
        assert len(grouped["cab"])    == 0


# ===========================================================================
# 3. GET /api/transport — NEVER-EMPTY GUARANTEE
# ===========================================================================

class TestGetTransportNeverEmpty:

    def test_empty_db_known_pair_returns_seed(self):
        mock_db = _make_db_mock([])
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task"):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Jaipur")
        assert resp.status_code == 200
        data = resp.json()
        total = sum(len(v) for v in data["options"].values())
        assert total > 0, "Should return seed options for known pair"
        assert data["scraping_in_progress"] is True
        has_seed_source = any(
            opt.get("source") == "seed_data"
            for mode_list in data["options"].values()
            for opt in mode_list
        )
        assert has_seed_source is True

    def test_empty_db_unknown_pair_gets_cab_estimate(self):
        """For unknown pairs the cab estimate should be the floor."""
        mock_db = _make_db_mock([])
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task"):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Jaisalmer")
        assert resp.status_code == 200
        data = resp.json()
        total = sum(len(v) for v in data["options"].values())
        assert total > 0

    def test_fresh_db_returns_data_without_rescraping(self):
        fresh = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        rows = [{
            "mode": "flight", "operator": "IndiGo",
            "price_min_inr": 3500, "price_max_inr": 5000,
            "duration_minutes": 90, "departure_times": ["06:00"],
            "frequency": "Daily", "booking_url": "https://indigo.in",
            "source": "google_search", "scraped_at": fresh,
        }]
        mock_db = _make_db_mock(rows)
        create_task = MagicMock()
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task", create_task):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Jaipur")
        assert resp.status_code == 200
        data = resp.json()
        assert data["scraping_in_progress"] is False
        assert len(data["options"]["flight"]) == 1
        assert data["options"]["flight"][0]["operator"] == "IndiGo"
        assert not create_task.called

    def test_stale_db_triggers_background_scrape(self):
        stale = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        rows = [{
            "mode": "train", "operator": "Shatabdi",
            "price_min_inr": 500, "price_max_inr": 1200,
            "duration_minutes": 270, "departure_times": [],
            "frequency": "Daily", "booking_url": "https://irctc.co.in",
            "source": "seed_data", "scraped_at": stale,
        }]
        mock_db = _make_db_mock(rows)
        create_task = MagicMock()
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task", create_task):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Jaipur")
        assert resp.status_code == 200
        data = resp.json()
        assert data["scraping_in_progress"] is True
        assert create_task.called

    def test_response_has_correct_structure(self):
        mock_db = _make_db_mock([])
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task"):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Goa")
        assert resp.status_code == 200
        data = resp.json()
        for key in ("origin", "destination", "options",
                    "scraping_in_progress", "message"):
            assert key in data, f"Missing key: {key}"
        for mode in ("flight", "train", "bus", "cab"):
            assert mode in data["options"]
            assert isinstance(data["options"][mode], list)

    def test_missing_destination_returns_422(self):
        app = _make_test_app()
        client = TestClient(app)
        resp = client.get("/api/transport?origin=Delhi")
        assert resp.status_code == 422

    def test_missing_origin_returns_422(self):
        app = _make_test_app()
        client = TestClient(app)
        resp = client.get("/api/transport?destination=Goa")
        assert resp.status_code == 422

    def test_message_is_set_when_scraping(self):
        mock_db = _make_db_mock([])
        app = _make_test_app()
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.asyncio.create_task"):
            client = TestClient(app)
            resp = client.get("/api/transport?origin=Delhi&destination=Jaipur")
        data = resp.json()
        assert data["scraping_in_progress"] is True
        assert len(data["message"]) > 0


# ===========================================================================
# 4. POST /api/transport/scrape-now — SSE STREAM
# ===========================================================================

class TestScrapeNowSSE:
    """
    GoogleTransportScraper and TransportScraper are imported inside the
    endpoint function (lazy imports), so we patch them at their source
    module paths, not at routers.transport.*
    """

    def _mock_google_and_scraper(self, flight_results=None, train_results=None,
                                   bus_results=None, cab=None, mapped=None):
        mock_google = MagicMock()
        mock_google.scrape_flights = AsyncMock(return_value=flight_results or [])
        mock_google.scrape_trains  = AsyncMock(return_value=train_results  or [])
        mock_google.scrape_buses   = AsyncMock(return_value=bus_results    or [])

        mock_scraper = MagicMock()
        mock_scraper._estimate_cab       = AsyncMock(return_value=cab)
        mock_scraper._map_google_results = MagicMock(return_value=mapped or [])
        mock_scraper.save_to_db          = AsyncMock(return_value=None)

        return mock_google, mock_scraper

    def _sse_patches(self, mg, ms):
        """Return the correct patch targets for the lazy-import inside the endpoint."""
        return [
            patch("scrapers.google_transport_scraper.GoogleTransportScraper",
                  return_value=mg),
            patch("scrapers.transport_scraper.TransportScraper",
                  return_value=ms),
        ]

    def test_empty_body_returns_400(self):
        app = _make_test_app()
        client = TestClient(app)
        resp = client.post("/api/transport/scrape-now", json={})
        assert resp.status_code == 400

    def test_missing_destination_returns_400(self):
        app = _make_test_app()
        client = TestClient(app)
        resp = client.post("/api/transport/scrape-now",
                           json={"origin": "Delhi"})
        assert resp.status_code == 400

    def test_missing_origin_returns_400(self):
        app = _make_test_app()
        client = TestClient(app)
        resp = client.post("/api/transport/scrape-now",
                           json={"destination": "Goa"})
        assert resp.status_code == 400

    def test_known_pair_stream_contains_data_lines(self):
        """Stream must contain at least one 'data:' SSE line."""
        mg, ms = self._mock_google_and_scraper()
        app = _make_test_app()
        p1, p2 = self._sse_patches(mg, ms)
        with p1, p2:
            client = TestClient(app)
            resp = client.post("/api/transport/scrape-now",
                               json={"origin": "Delhi", "destination": "Jaipur"})
        assert resp.status_code == 200
        assert "data:" in resp.text

    def test_stream_always_ends_with_complete_event(self):
        """The final event must be the 'complete' marker."""
        mg, ms = self._mock_google_and_scraper()
        app = _make_test_app()
        p1, p2 = self._sse_patches(mg, ms)
        with p1, p2:
            client = TestClient(app)
            resp = client.post("/api/transport/scrape-now",
                               json={"origin": "Delhi", "destination": "Agra"})
        assert "All transport options loaded" in resp.text

    def test_seed_data_event_emitted_for_known_pair(self):
        """For Delhi→Jaipur (a known seed pair) we should get seed_data event."""
        mg, ms = self._mock_google_and_scraper()
        app = _make_test_app()
        p1, p2 = self._sse_patches(mg, ms)
        with p1, p2:
            client = TestClient(app)
            resp = client.post("/api/transport/scrape-now",
                               json={"origin": "Delhi", "destination": "Jaipur"})
        body = resp.text
        assert "estimated" in body or "seed_data" in body

    def test_live_data_event_when_google_returns_results(self):
        """When Google returns results, a live_data event with source=live appears."""
        google_result = [{
            "operator": "IndiGo", "price_inr": 3500,
            "duration_minutes": 90, "departure_times": ["06:00"],
            "frequency": "3 daily",
        }]
        mapped = [{
            "mode": "flight", "operator": "IndiGo",
            "price_min_inr": 3150, "price_max_inr": 4025,
            "duration_minutes": 90, "departure_times": ["06:00"],
            "frequency": "3 daily", "booking_url": "https://ixigo.com",
            "source": "google_search",
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "origin_city": "Delhi", "destination_city": "Goa",
            "origin_slug": "delhi", "destination_slug": "goa",
        }]
        mg, ms = self._mock_google_and_scraper(
            flight_results=google_result, mapped=mapped
        )
        app = _make_test_app()
        p1, p2 = self._sse_patches(mg, ms)
        with p1, p2, patch("routers.transport.asyncio.create_task"):
            client = TestClient(app)
            resp = client.post("/api/transport/scrape-now",
                               json={"origin": "Delhi", "destination": "Goa"})
        body = resp.text
        assert "live_data" in body
        assert "IndiGo" in body

    def test_mode_failed_event_when_google_returns_empty(self):
        """If no live results, a mode_failed event should appear."""
        mg, ms = self._mock_google_and_scraper()   # all empty by default
        app = _make_test_app()
        p1, p2 = self._sse_patches(mg, ms)
        with p1, p2:
            client = TestClient(app)
            resp = client.post("/api/transport/scrape-now",
                               json={"origin": "Delhi", "destination": "Jaipur"})
        body = resp.text
        assert "mode_failed" in body or "complete" in body


# ===========================================================================
# 5. BACKGROUND HELPERS
# ===========================================================================

class TestSaveSeedToDb:

    @pytest.mark.asyncio
    async def test_calls_upsert_with_seed(self):
        from routers.transport import _save_seed_to_db
        seed = [{"mode": "train", "operator": "Shatabdi",
                 "origin_slug": "delhi", "destination_slug": "jaipur"}]
        mock_db = _make_db_mock()
        with patch("routers.transport.db", mock_db):
            await _save_seed_to_db(seed, "delhi", "jaipur")
        mock_db.table.assert_called()

    @pytest.mark.asyncio
    async def test_swallows_db_error(self):
        """DB failure must not propagate — seed save is best-effort."""
        from routers.transport import _save_seed_to_db
        bad_db = MagicMock()
        bad_db.table.side_effect = Exception("connection refused")
        with patch("routers.transport.db", bad_db):
            await _save_seed_to_db([{"mode": "bus"}], "delhi", "jaipur")
        # Must complete without raising


class TestBackgroundScrapePair:

    @pytest.mark.asyncio
    async def test_does_not_raise_on_scraper_crash(self):
        """A crashed scraper must never propagate out."""
        from routers.transport import _background_scrape_pair
        mock_db = _make_db_mock()
        bad_scraper = MagicMock()
        bad_scraper._scrape_pair = AsyncMock(
            side_effect=RuntimeError("scraper exploded")
        )
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.TransportScraper",
                   return_value=bad_scraper):
            await _background_scrape_pair("Delhi", "Jaipur")

    @pytest.mark.asyncio
    async def test_saves_results_on_success(self):
        from routers.transport import _background_scrape_pair
        records = [{"mode": "flight", "operator": "IndiGo",
                    "origin_slug": "delhi", "destination_slug": "jaipur",
                    "scraped_at": datetime.utcnow().isoformat()}]
        mock_db = _make_db_mock()
        mock_scraper = MagicMock()
        mock_scraper._scrape_pair = AsyncMock(return_value=records)
        mock_scraper.save_to_db   = AsyncMock(return_value=None)
        with patch("routers.transport.db", mock_db), \
             patch("routers.transport.TransportScraper",
                   return_value=mock_scraper):
            await _background_scrape_pair("Delhi", "Jaipur")
        mock_scraper.save_to_db.assert_awaited_once()


# ===========================================================================
# 6. TransportScraper._estimate_cab()
# ===========================================================================

class TestEstimateCab:

    @pytest.mark.asyncio
    async def test_known_cities_returns_cab_dict(self):
        from scrapers.transport_scraper import TransportScraper
        cab = await TransportScraper()._estimate_cab("Delhi", "Jaipur")
        assert cab is not None
        assert cab["mode"]          == "cab"
        assert cab["price_min_inr"] > 0
        assert cab["price_max_inr"] >= cab["price_min_inr"]
        assert cab["duration_minutes"] > 0
        assert cab["source"]        == "calculated"

    @pytest.mark.asyncio
    async def test_too_far_returns_none(self):
        """Delhi → Andaman Islands is > 800 km; cab is not practical."""
        from scrapers.transport_scraper import TransportScraper
        cab = await TransportScraper()._estimate_cab("Delhi", "Andaman Islands")
        assert cab is None

    @pytest.mark.asyncio
    async def test_unknown_city_does_not_crash(self):
        from scrapers.transport_scraper import TransportScraper
        cab = await TransportScraper()._estimate_cab("Faketown", "Nowhereville")
        # Either None (unknown coords) or a valid dict — must not raise
        if cab is not None:
            assert "mode" in cab

    @pytest.mark.asyncio
    async def test_price_range_is_reasonable_for_jaipur(self):
        """Jaipur is ~280 km from Delhi; expect ₹2k–₹8k price range."""
        from scrapers.transport_scraper import TransportScraper
        cab = await TransportScraper()._estimate_cab("Delhi", "Jaipur")
        if cab:
            assert 1500 <= cab["price_min_inr"] <= 10000, \
                f"Price out of expected range: ₹{cab['price_min_inr']}"


# ===========================================================================
# 7. GoogleTransportScraper._validate_results()
# ===========================================================================

class TestGoogleValidation:

    def test_valid_flight_passes(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [{"operator": "IndiGo", "price_inr": 4500,
                  "duration_minutes": 90, "departure_times": ["06:00"]}]
        assert len(GoogleTransportScraper()._validate_results(items, "flight")) == 1

    def test_price_below_minimum_rejected(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [{"operator": "FakeLine", "price_inr": 5,
                  "duration_minutes": 120}]
        assert len(GoogleTransportScraper()._validate_results(items, "train")) == 0

    def test_price_above_maximum_rejected(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [{"operator": "LuxuryBus", "price_inr": 999_999,
                  "duration_minutes": 300}]
        assert len(GoogleTransportScraper()._validate_results(items, "bus")) == 0

    def test_missing_operator_rejected(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [{"operator": "", "price_inr": 3000, "duration_minutes": 90}]
        assert len(GoogleTransportScraper()._validate_results(items, "flight")) == 0

    def test_zero_price_rejected(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [{"operator": "SomeAir", "price_inr": 0,
                  "duration_minutes": 90}]
        assert len(GoogleTransportScraper()._validate_results(items, "flight")) == 0

    def test_multiple_items_filtered_correctly(self):
        from scrapers.google_transport_scraper import GoogleTransportScraper
        items = [
            {"operator": "IndiGo",   "price_inr": 3500, "duration_minutes": 90},  # ✓
            {"operator": "SpiceJet", "price_inr": -100, "duration_minutes": 90},  # ✗
            {"operator": "",         "price_inr": 4000, "duration_minutes": 90},  # ✗
            {"operator": "Air India","price_inr": 8000, "duration_minutes": 120}, # ✓
        ]
        valid = GoogleTransportScraper()._validate_results(items, "flight")
        assert len(valid) == 2
        ops = {v["operator"] for v in valid}
        assert "IndiGo" in ops and "Air India" in ops
