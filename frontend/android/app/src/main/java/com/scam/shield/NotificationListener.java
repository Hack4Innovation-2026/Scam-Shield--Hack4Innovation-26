package com.scam.shield;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Receives every notification posted on the device (once the user grants Notification access)
 * and queues the message-like ones for scanning. The system keeps this service bound, so it works
 * while the app itself is closed.
 */
public class NotificationListener extends NotificationListenerService {

    // Not messages: media players, downloads, calls, navigation, system status...
    private static final Set<String> SKIPPED_CATEGORIES = new HashSet<>(Arrays.asList(
            Notification.CATEGORY_TRANSPORT, Notification.CATEGORY_PROGRESS, Notification.CATEGORY_SERVICE,
            Notification.CATEGORY_SYSTEM, Notification.CATEGORY_ALARM, Notification.CATEGORY_CALL,
            Notification.CATEGORY_NAVIGATION, Notification.CATEGORY_STOPWATCH));

    // API "source" per known app, so the backend picks the right model and stats show the channel.
    private static final Map<String, String> SOURCES = new HashMap<>();
    static {
        SOURCES.put("com.whatsapp", "whatsapp");
        SOURCES.put("com.whatsapp.w4b", "whatsapp");
        SOURCES.put("org.telegram.messenger", "telegram");
        SOURCES.put("com.instagram.android", "instagram");
        SOURCES.put("com.google.android.gm", "email");
        SOURCES.put("com.microsoft.office.outlook", "email");
        SOURCES.put("com.google.android.apps.messaging", "sms");
        SOURCES.put("com.samsung.android.messaging", "sms");
        SOURCES.put("com.android.mms", "sms");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (pkg.equals(getPackageName())) return;   // our own alerts

        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (n.category != null && SKIPPED_CATEGORIES.contains(n.category)) return;

        Bundle extras = n.extras;
        if (extras == null) return;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (body == null) body = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (body == null) return;

        // The title is usually the sender ("VM-SBIBNK", a contact name) - useful context for the analysis.
        String text = title != null ? title + "\n" + body : body.toString();
        String source = SOURCES.containsKey(pkg) ? SOURCES.get(pkg) : "notifications";
        MessageScanner.scan(this, body.toString(), text, source, appLabel(pkg));
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }
}
