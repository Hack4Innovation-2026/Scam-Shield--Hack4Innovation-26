package com.scam.shield;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Calls the Scam Shield API directly from native code, so scanning works with the app closed. */
final class ScanClient {

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    // Generous: a free-tier host may need ~60 s to wake up.
    private static final int READ_TIMEOUT_MS = 70_000;
    private static final int MAX_TEXT_LENGTH = 20_000;

    static final class HttpError extends IOException {
        final int status;

        HttpError(int status, String body) {
            super("HTTP " + status + ": " + body);
            this.status = status;
        }
    }

    private ScanClient() {}

    /** POST /api/v1/analyze. Signed-in scans are saved to the user's history on the server. */
    static JSONObject analyze(Context context, String text, String source) throws IOException, JSONException {
        String token = ScanConfig.token(context);
        try {
            return post(context, text, source, token);
        } catch (HttpError e) {
            if (e.status == 401 && token != null) {
                // Expired session: forget the token and scan as a guest rather than dropping the message.
                ScanConfig.clearToken(context);
                return post(context, text, source, null);
            }
            throw e;
        }
    }

    private static JSONObject post(Context context, String text, String source, String token)
            throws IOException, JSONException {
        if (text.length() > MAX_TEXT_LENGTH) text = text.substring(0, MAX_TEXT_LENGTH);
        JSONObject body = new JSONObject().put("text", text).put("source", source);

        HttpURLConnection conn = (HttpURLConnection) new URL(ScanConfig.apiUrl(context) + "/api/v1/analyze").openConnection();
        try {
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            if (token != null) conn.setRequestProperty("Authorization", "Bearer " + token);

            try (OutputStream out = conn.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String response = stream == null ? "" : readAll(stream);
            if (status >= 400) throw new HttpError(status, response);
            return new JSONObject(response);
        } finally {
            conn.disconnect();
        }
    }

    private static String readAll(InputStream stream) throws IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
