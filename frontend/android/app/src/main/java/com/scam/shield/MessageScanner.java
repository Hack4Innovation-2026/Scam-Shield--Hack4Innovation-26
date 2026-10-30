package com.scam.shield;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Entry point for every background input (notifications, SMS). De-duplicates and queues the scan
 * as a WorkManager job: the network call outlives the receiver or listener callback, and runs
 * once connectivity is available.
 */
public final class MessageScanner {

    /** Receives scan results while the app's WebView is alive (set by the plugin). */
    public interface Listener {
        void onScanResult(JSONObject event);
    }

    private static final long DEDUP_WINDOW_MS = 2 * 60 * 1000;
    private static final int DEDUP_CAPACITY = 200;
    private static final int MIN_TEXT_LENGTH = 8;

    // The same message often arrives twice (SMS broadcast + the SMS app's notification, or a
    // notification being updated). Keyed on the normalised message body.
    private static final Map<String, Long> recent = new LinkedHashMap<String, Long>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > DEDUP_CAPACITY;
        }
    };

    private static volatile Listener listener;

    private MessageScanner() {}

    public static void setListener(Listener l) {
        listener = l;
    }

    static void publish(JSONObject event) {
        Listener l = listener;
        if (l != null) l.onScanResult(event);
    }

    /**
     * @param body     the message text (used for de-duplication)
     * @param text     what is analysed (e.g. sender/title + body)
     * @param source   API source: "sms", "whatsapp", "email", "notifications", ...
     * @param appLabel human-readable origin shown in the alert ("WhatsApp", "SMS from VM-SBIBNK")
     */
    public static void scan(Context context, String body, String text, String source, String appLabel) {
        if (body == null || body.trim().length() < MIN_TEXT_LENGTH) return;
        if (!ScanConfig.isEnabled(context)) return;
        if (isDuplicate(body)) return;

        Data input = new Data.Builder()
                .putString(ScanWorker.KEY_TEXT, text)
                .putString(ScanWorker.KEY_SOURCE, source)
                .putString(ScanWorker.KEY_APP, appLabel)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(ScanWorker.class)
                .setInputData(input)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag("scan")
                .build();
        WorkManager.getInstance(context.getApplicationContext()).enqueue(request);
    }

    private static synchronized boolean isDuplicate(String body) {
        String key = body.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        long now = System.currentTimeMillis();
        Long seen = recent.get(key);
        recent.put(key, now);
        return seen != null && now - seen < DEDUP_WINDOW_MS;
    }
}
