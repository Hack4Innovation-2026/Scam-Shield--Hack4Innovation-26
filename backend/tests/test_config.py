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
