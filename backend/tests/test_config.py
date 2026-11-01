import importlib


def test_blank_env_values_fall_back_to_defaults(monkeypatch):
    # .env.example ships with blank values; copying it must not break model loading or CORS.
    monkeypatch.setenv("MODELS_DIR", "")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "")
    from app import config
    try:
        importlib.reload(config)
        assert (config.MODELS_DIR / "sms_model.pkl").exists()
        assert "http://localhost:5173" in config.CORS_ORIGINS
        assert config.MAX_UPLOAD_BYTES == 5 * 1024 * 1024
    finally:
        monkeypatch.undo()
        importlib.reload(config)


def test_scan_retention_days_default_and_override(monkeypatch):
    from app import config
    try:
        monkeypatch.setenv("SCAN_RETENTION_DAYS", "")        # blank, as in a copied .env.example
        importlib.reload(config)
        assert config.SCAN_RETENTION_DAYS == 90
        monkeypatch.setenv("SCAN_RETENTION_DAYS", "30")
        importlib.reload(config)
        assert config.SCAN_RETENTION_DAYS == 30
        monkeypatch.setenv("SCAN_RETENTION_DAYS", "0")       # keep forever
        importlib.reload(config)
        assert config.SCAN_RETENTION_DAYS == 0
    finally:
        monkeypatch.undo()
        importlib.reload(config)
