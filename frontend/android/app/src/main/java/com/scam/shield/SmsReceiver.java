package com.scam.shield;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Scans incoming SMS directly from the system broadcast (needs the RECEIVE_SMS permission).
 * Complements the notification listener: it works even if the SMS app's notifications are muted.
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null) return;

        // A long SMS arrives as several parts; join them per sender.
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        for (SmsMessage part : parts) {
            if (part == null) continue;
            String sender = part.getDisplayOriginatingAddress();
            if (sender == null) sender = "unknown";
            StringBuilder sb = bySender.get(sender);
            if (sb == null) bySender.put(sender, sb = new StringBuilder());
            sb.append(part.getDisplayMessageBody());
        }

        for (Map.Entry<String, StringBuilder> entry : bySender.entrySet()) {
            String body = entry.getValue().toString();
            MessageScanner.scan(context, body, entry.getKey() + "\n" + body, "sms", "SMS from " + entry.getKey());
        }
    }
}
