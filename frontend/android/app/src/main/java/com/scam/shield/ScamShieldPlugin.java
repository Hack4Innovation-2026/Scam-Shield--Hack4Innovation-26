package com.scam.shield;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Bridge between the web app and the native background scanner.
 *
 * Events: "scanResult" (a background scan finished while the app is open) and "openResult"
 * (the user tapped a scam alert).
 */
@CapacitorPlugin(
        name = "ScamShield",
        permissions = {
                @Permission(alias = "sms", strings = {Manifest.permission.RECEIVE_SMS}),
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}),
        })
public class ScamShieldPlugin extends Plugin {

    private JSONObject pendingOpen;

    @Override
    public void load() {
        AlertNotifier.ensureChannel(getContext());
        MessageScanner.setListener(event -> {
            try {
                notifyListeners("scanResult", new JSObject(event.toString()));
            } catch (JSONException ignored) {
                // event is built from valid JSON
            }
        });
        captureOpenIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnDestroy() {
        MessageScanner.setListener(null);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (captureOpenIntent(intent)) {
            notifyListeners("openResult", toJs(pendingOpen), true);
        }
    }

    /** The app was opened from a scam alert: remember the result for the web app. */
    private boolean captureOpenIntent(Intent intent) {
        if (intent == null) return false;
        String raw = intent.getStringExtra(AlertNotifier.EXTRA_SCAN_EVENT);
        if (raw == null) return false;
        intent.removeExtra(AlertNotifier.EXTRA_SCAN_EVENT);
        try {
            pendingOpen = new JSONObject(raw);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    private static JSObject toJs(JSONObject obj) {
        try {
            return new JSObject(obj.toString());
        } catch (JSONException e) {
            return new JSObject();
        }
    }

    // ------------------------------------------------------------------ methods

    /** Shares the API address and login token with the background components. */
    @PluginMethod
    public void configure(PluginCall call) {
        ScanConfig.save(getContext(), call.getString("apiUrl"), call.getString("token"),
                call.getBoolean("enabled", true));
        call.resolve(status());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    /** The result of the alert the app was opened from, if any (consumed once). */
    @PluginMethod
    public void getPendingResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("event", pendingOpen == null ? null : toJs(pendingOpen));
        pendingOpen = null;
        call.resolve(ret);
    }

    /** Opens the system screen where the user grants Notification access to Scam Shield. */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            call.resolve(status());
        } else {
            requestPermissionForAlias("sms", call, "permissionCallback");
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(status());   // no runtime permission before Android 13
        } else {
            requestPermissionForAlias("notifications", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void showToast(PluginCall call) {
        String text = call.getString("text", "");
        getActivity().runOnUiThread(() -> Toast.makeText(getContext(), text, Toast.LENGTH_LONG).show());
        call.resolve();
    }

    private JSObject status() {
        JSObject ret = new JSObject();
        ret.put("notificationAccess",
                NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName()));
        ret.put("sms", getPermissionState("sms") == PermissionState.GRANTED);
        ret.put("postNotifications", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        ret.put("apiUrl", ScanConfig.apiUrl(getContext()));
        ret.put("signedIn", ScanConfig.token(getContext()) != null);
        ret.put("enabled", ScanConfig.isEnabled(getContext()));
        return ret;
    }
}
