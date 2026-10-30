package com.scam.shield;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** High-priority "possible scam" notification; tapping it opens the full result in the app. */
final class AlertNotifier {

    static final String CHANNEL_ID = "scam_alerts";
    static final String EXTRA_SCAN_EVENT = "com.scam.shield.SCAN_EVENT";

    private AlertNotifier() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Scam alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Warnings when an incoming message looks like a scam");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    static void showScamAlert(Context context, JSONObject event) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;   // POST_NOTIFICATIONS not granted
        ensureChannel(context);

        JSONObject result = event.optJSONObject("result");
        if (result == null) return;
        int risk = result.optInt("risk_score");
        String app = event.optString("app", "a message");
        String preview = event.optString("text");
        if (preview.length() > 160) preview = preview.substring(0, 160) + "…";

        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_SCAN_EVENT, event.toString());
        int requestCode = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pending = PendingIntent.getActivity(context, requestCode, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle("⚠ Possible scam in " + app + " (risk " + risk + ")")
                .setContentText(result.optString("advice"))
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(result.optString("reason") + "\n\n“" + preview + "”\n\n" + result.optString("advice")))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setColor(0xFFEF4444)
                .setAutoCancel(true)
                // Own group per alert: otherwise Android bundles several alerts under one summary,
                // and tapping that summary opens the app without the specific result.
                .setGroup("scam_alert_" + requestCode)
                .setContentIntent(pending);

        try {
            manager.notify(requestCode, builder.build());
        } catch (SecurityException ignored) {
            // permission revoked between the check and the call
        }
    }
}
