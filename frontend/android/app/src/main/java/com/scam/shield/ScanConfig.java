package com.scam.shield;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Settings shared between the web app (which sets them through the plugin) and the background
 * components (notification listener, SMS receiver, scan worker), which run without the WebView.
 */
public final class ScanConfig {

    private static final String PREFS = "scam_shield";
    private static final String KEY_API_URL = "api_url";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_ENABLED = "background_scanning";

    /** The Android emulator reaches the host machine's localhost at 10.0.2.2. */
    static final String DEFAULT_API_URL = "http://10.0.2.2:8000";

    private ScanConfig() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static String apiUrl(Context context) {
        String url = prefs(context).getString(KEY_API_URL, DEFAULT_API_URL);
        return url.replaceAll("/+$", "");
    }

    /** Login token of the signed-in user, or null for guests. */
    public static String token(Context context) {
        return prefs(context).getString(KEY_TOKEN, null);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static void save(Context context, String apiUrl, String token, boolean enabled) {
        SharedPreferences.Editor editor = prefs(context).edit();
        if (apiUrl != null && !apiUrl.isEmpty()) editor.putString(KEY_API_URL, apiUrl);
        if (token != null && !token.isEmpty()) editor.putString(KEY_TOKEN, token);
        else editor.remove(KEY_TOKEN);
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.apply();
    }

    static void clearToken(Context context) {
        prefs(context).edit().remove(KEY_TOKEN).apply();
    }
}
