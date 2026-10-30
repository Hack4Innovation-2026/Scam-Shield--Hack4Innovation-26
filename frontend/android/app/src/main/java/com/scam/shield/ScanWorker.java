package com.scam.shield;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

/** Sends one message to the API and raises an alert if it is a likely scam. */
public class ScanWorker extends Worker {

    static final String KEY_TEXT = "text";
    static final String KEY_SOURCE = "source";
    static final String KEY_APP = "app";

    private static final String TAG = "ScamShield";
    private static final int ALERT_THRESHOLD = 70;   // the API's "scam" band
    private static final int MAX_ATTEMPTS = 3;

    public ScanWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String text = getInputData().getString(KEY_TEXT);
        String source = getInputData().getString(KEY_SOURCE);
        String app = getInputData().getString(KEY_APP);
        if (text == null) return Result.failure();

        JSONObject result;
        try {
            result = ScanClient.analyze(getApplicationContext(), text, source == null ? "notifications" : source, app);
        } catch (ScanClient.HttpError e) {
            Log.w(TAG, "Scan rejected by server: " + e.getMessage());
            return e.status >= 500 && getRunAttemptCount() < MAX_ATTEMPTS ? Result.retry() : Result.failure();
        } catch (IOException e) {
            // Server unreachable / asleep: WorkManager retries with backoff.
            Log.w(TAG, "Scan failed, will retry: " + e.getMessage());
            return getRunAttemptCount() < MAX_ATTEMPTS ? Result.retry() : Result.failure();
        } catch (JSONException e) {
            Log.e(TAG, "Unexpected response", e);
            return Result.failure();
        }

        int risk = result.optInt("risk_score", 0);
        Log.i(TAG, "Scanned message from " + app + ": risk " + risk + " (" + result.optString("level") + ")");

        JSONObject event = new JSONObject();
        try {
            event.put("app", app).put("source", source).put("text", text).put("result", result)
                    .put("scannedAt", System.currentTimeMillis());
        } catch (JSONException ignored) {
            // all values are plain strings/objects
        }
        if (risk >= ALERT_THRESHOLD) AlertNotifier.showScamAlert(getApplicationContext(), event);
        // App open: deliver live. App closed: keep it for History until the app next opens.
        if (!MessageScanner.publish(event)) BackgroundScanStore.add(getApplicationContext(), event);
        return Result.success();
    }
}
