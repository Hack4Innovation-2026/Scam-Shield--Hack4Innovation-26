package com.scam.shield;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Results of background scans that finished while the app was closed. The web app collects them
 * the next time it opens, so they appear in History (guests have no server-side history).
 */
final class BackgroundScanStore {

    private static final String PREFS = "scam_shield_background_scans";
    private static final String KEY_EVENTS = "events";
    private static final int MAX_EVENTS = 100;

    private BackgroundScanStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void add(Context context, JSONObject event) {
        JSONArray events = read(context);
        events.put(event);
        // Keep only the newest MAX_EVENTS.
        JSONArray trimmed = new JSONArray();
        for (int i = Math.max(0, events.length() - MAX_EVENTS); i < events.length(); i++) {
            trimmed.put(events.opt(i));
        }
        prefs(context).edit().putString(KEY_EVENTS, trimmed.toString()).apply();
    }

    /** Returns the stored events (oldest first) and clears them. */
    static synchronized JSONArray drain(Context context) {
        JSONArray events = read(context);
        prefs(context).edit().remove(KEY_EVENTS).apply();
        return events;
    }

    private static JSONArray read(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_EVENTS, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }
}
