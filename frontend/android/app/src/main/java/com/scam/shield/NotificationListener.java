package com.scam.shield;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

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

    private static final String TAG = "ScamShield";

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
    public void onListenerConnected() {
        Log.i(TAG, "Notification listener connected");
    }

    @Override
    public void onListenerDisconnected() {
        Log.w(TAG, "Notification listener disconnected");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (pkg.equals(getPackageName())) return;   // our own alerts

        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (n.category != null && SKIPPED_CATEGORIES.contains(n.category)) return;

        if (!isMessageSource(pkg, n)) return;

        Bundle extras = n.extras;
        if (extras == null) return;
        Log.d(TAG, "Notification from " + pkg + " (category " + n.category + ")");
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (body == null) body = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (body == null) return;

        // The title is usually the sender ("VM-SBIBNK", a contact name) - useful context for the analysis.
        String text = title != null ? title + "\n" + body : body.toString();
        String source = SOURCES.containsKey(pkg) ? SOURCES.get(pkg) : "notifications";
        MessageScanner.scan(this, body.toString(), text, source, appLabel(pkg));
    }

    /**
     * Known messaging apps and anything posted as a message/email are scanned. Other system
     * apps (Android System, System UI, Settings, Play Store...) post status notifications, not
     * messages, so they are skipped; ordinary third-party apps are scanned.
     */
    private boolean isMessageSource(String pkg, Notification n) {
        if (SOURCES.containsKey(pkg)) return true;
        if (Notification.CATEGORY_MESSAGE.equals(n.category) || Notification.CATEGORY_EMAIL.equals(n.category)) return true;
        // Debug builds: allow `adb shell cmd notification post` for testing.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable && "com.android.shell".equals(pkg)) return true;
        try {
            int flags = getPackageManager().getApplicationInfo(pkg, 0).flags;
            return (flags & (ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) == 0;
        } catch (PackageManager.NameNotFoundException e) {
            // Android 11+ hides most installed apps from us; system packages are always visible,
            // so an invisible package is an ordinary app - scan it.
            return true;
        }
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
