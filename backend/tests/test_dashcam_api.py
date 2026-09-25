"""Dash Cam backend API tests: health, events CRUD, push register."""
import uuid
from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# -------- Health --------
class TestHealth:
    def test_root_ok(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert "Dash Cam" in body.get("message", "")


# -------- Events CRUD --------
class TestEvents:
    device_id = f"TEST_dev_{uuid.uuid4().hex[:12]}"

    def _cleanup(self, api_client, base_url):
        api_client.delete(f"{base_url}/api/events", params={"device_id": self.device_id})

    def test_create_impact_event(self, api_client, base_url):
        clip_id = f"TEST_clip_{uuid.uuid4().hex[:8]}"
        payload = {
            "device_id": self.device_id,
            "clip_id": clip_id,
            "type": "impact",
            "recorded_at": _now_iso(),
            "duration_sec": 60.0,
            "max_speed_kmh": 82.0,
            "avg_speed_kmh": 55.0,
            "g_force": 2.4,
        }
        r = api_client.post(f"{base_url}/api/events", json=payload)
        # Push should be non-blocking even with placeholder key
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["clip_id"] == clip_id
        assert data["type"] == "impact"
        assert data["device_id"] == self.device_id
        assert data["g_force"] == 2.4
        assert "id" in data and "created_at" in data

    def test_create_trip_event(self, api_client, base_url):
        clip_id = f"TEST_clip_{uuid.uuid4().hex[:8]}"
        payload = {
            "device_id": self.device_id,
            "clip_id": clip_id,
            "type": "trip",
            "recorded_at": _now_iso(),
            "duration_sec": 180.0,
            "max_speed_kmh": 50.0,
            "avg_speed_kmh": 30.0,
        }
        r = api_client.post(f"{base_url}/api/events", json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["type"] == "trip"
        assert data["clip_id"] == clip_id

    def test_list_events_sorted_newest_first(self, api_client, base_url):
        # Add two events with distinct recorded_at
        earlier = "2025-01-01T00:00:00+00:00"
        later = "2026-01-01T00:00:00+00:00"
        for ts in (earlier, later):
            api_client.post(f"{base_url}/api/events", json={
                "device_id": self.device_id,
                "clip_id": f"TEST_srt_{uuid.uuid4().hex[:6]}",
                "type": "trip",
                "recorded_at": ts,
                "duration_sec": 10, "max_speed_kmh": 10, "avg_speed_kmh": 5,
            })
        r = api_client.get(f"{base_url}/api/events", params={"device_id": self.device_id})
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)
        assert len(events) >= 2
        # Ensure sorted DESC by recorded_at
        ts_list = [e["recorded_at"] for e in events]
        assert ts_list == sorted(ts_list, reverse=True), f"Not sorted DESC: {ts_list}"
        # No mongo _id leaked
        for e in events:
            assert "_id" not in e

    def test_delete_single_event(self, api_client, base_url):
        clip_id = f"TEST_del_{uuid.uuid4().hex[:8]}"
        r = api_client.post(f"{base_url}/api/events", json={
            "device_id": self.device_id, "clip_id": clip_id, "type": "trip",
            "recorded_at": _now_iso(), "duration_sec": 5, "max_speed_kmh": 1, "avg_speed_kmh": 1,
        })
        assert r.status_code == 201
        r = api_client.delete(f"{base_url}/api/events/{clip_id}", params={"device_id": self.device_id})
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        # Verify not in list
        r = api_client.get(f"{base_url}/api/events", params={"device_id": self.device_id})
        assert all(e["clip_id"] != clip_id for e in r.json())

    def test_delete_all_events(self, api_client, base_url):
        # Ensure at least one exists
        api_client.post(f"{base_url}/api/events", json={
            "device_id": self.device_id, "clip_id": f"TEST_all_{uuid.uuid4().hex[:6]}",
            "type": "trip", "recorded_at": _now_iso(),
            "duration_sec": 5, "max_speed_kmh": 1, "avg_speed_kmh": 1,
        })
        r = api_client.delete(f"{base_url}/api/events", params={"device_id": self.device_id})
        assert r.status_code == 200
        assert r.json()["deleted"] >= 1
        r = api_client.get(f"{base_url}/api/events", params={"device_id": self.device_id})
        assert r.json() == []


# -------- Push register --------
class TestPushRegister:
    def test_register_push_with_placeholder_key(self, api_client, base_url):
        payload = {
            "user_id": f"TEST_user_{uuid.uuid4().hex[:8]}",
            "platform": "android",
            "device_token": "TEST_token_abc123",
        }
        r = api_client.post(f"{base_url}/api/register-push", json=payload)
        # With placeholder key, expect 500 (bad key) or 502 (provider unreachable), NOT a crash / 200
        assert r.status_code in (500, 502), f"Expected 500/502, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body
