package com.spectrapackmachines.crm;

import android.Manifest;
import android.app.Activity;
import android.location.Location;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

/** One main-frame message port, restricted to the CRM HTTPS origin. */
final class CrmMobileBridge implements ForegroundLocation.Listener {
    interface ContactLauncher { boolean open(String address); }
    static final int LOCATION_PERMISSION = 22;
    private final Activity activity;
    private final WebView web;
    private final ContactLauncher launcher;
    private final ForegroundLocation location;
    private final String deviceId;
    private WebMessagePort port;
    private String nonce = "", permissionRequest = "";
    private boolean foreground;
    CrmMobileBridge(Activity activity, WebView web, ContactLauncher launcher) {
        this.activity = activity; this.web = web; this.launcher = launcher;
        location = new ForegroundLocation(activity, this);
        android.content.SharedPreferences prefs = activity.getSharedPreferences("crm-installation", 0);
        String existing = prefs.getString("deviceId", null);
        deviceId = existing == null ? UUID.randomUUID().toString() : existing;
        if (existing == null) prefs.edit().putString("deviceId", deviceId).apply();
    }
    private JSONObject snapshot() throws Exception {
        return new JSONObject().put("deviceId", deviceId).put("version", "1.1.0").put("foreground", foreground).put("location", location.status());
    }
    void attach() {
        detach();
        if (!CrmUrls.isCrmPage(web.getUrl())) return;
        nonce = UUID.randomUUID().toString();
        final String current = nonce;
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream stream = activity.getAssets().open("mobile.js")) { byte[] bytes = new byte[4096]; int count; while ((count = stream.read(bytes)) != -1) buffer.write(bytes, 0, count); }
            String script = new String(buffer.toByteArray(), StandardCharsets.UTF_8).replace("__NONCE__", JSONObject.quote(current)).replace("__STATE__", snapshot().toString());
            WebMessagePort[] channels = web.createWebMessageChannel(); port = channels[0];
            port.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override public void onMessage(WebMessagePort source, WebMessage message) {
                    if (!current.equals(nonce) || !CrmUrls.isCrmPage(web.getUrl())) return;
                    String raw = message.getData();
                    if (raw == null || raw.length() > 18000) return;
                    try { JSONObject input = new JSONObject(raw); if (current.equals(input.optString("nonce"))) command(input); } catch (Exception ignored) { }
                }
            });
            web.evaluateJavascript(script, ignored -> { if (current.equals(nonce) && CrmUrls.isCrmPage(web.getUrl())) web.postWebMessage(new WebMessage(current, new WebMessagePort[]{channels[1]}), Uri.parse(CrmUrls.ORIGIN)); });
        } catch (Exception ignored) { detach(); }
    }
    private void command(JSONObject input) throws Exception {
        String id = input.optString("id"), type = input.optString("type");
        if ("location_stop".equals(type)) { location.want(false); answer(id, new JSONObject().put("location", "off")); }
        else if ("location_start".equals(type)) {
            if (!foreground) { answer(id, new JSONObject().put("error", "Open the app to enable location.")); return; }
            if (!location.permitted()) {
                permissionRequest = id;
                activity.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION);
            } else { location.want(true); answer(id, new JSONObject().put("location", location.status())); }
        } else if ("open_external".equals(type)) {
            String url = input.optString("url");
            boolean opened = foreground && CrmUrls.isExternalLink(url) && launcher.open(url);
            answer(id, new JSONObject().put("opened", opened));
        }
    }
    void permissionsResult() {
        String id = permissionRequest; permissionRequest = "";
        try {
            if (location.permitted()) location.want(true);
            else state("denied");
            answer(id, new JSONObject().put("location", location.permitted() ? location.status() : "denied"));
        } catch (Exception ignored) { }
    }
    private void answer(String id, JSONObject message) throws Exception { send(message.put("id", id)); }
    private void send(JSONObject message) {
        if (port == null || nonce.isEmpty() || !CrmUrls.isCrmPage(web.getUrl())) return;
        try { message.put("nonce", nonce); port.postMessage(new WebMessage(message.toString())); } catch (Exception ignored) { }
    }
    @Override public void state(String status) {
        try { send(new JSONObject().put("state", snapshot().put("location", status))); } catch (Exception ignored) { }
    }
    @Override public void point(Location fix) {
        if (!foreground) return;
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US); format.setTimeZone(TimeZone.getTimeZone("UTC"));
            JSONObject point = new JSONObject().put("latitude", fix.getLatitude()).put("longitude", fix.getLongitude()).put("accuracy", fix.getAccuracy()).put("capturedAt", format.format(new Date(fix.getTime())));
            send(new JSONObject().put("type", "location").put("point", point));
        } catch (Exception ignored) { }
    }
    void resume() { foreground = true; state(location.status()); location.resume(); state(location.status()); }
    void pause() { foreground = false; location.pause(); state(location.status()); }
    void detach() { location.detach(); if (port != null) { port.close(); port = null; } nonce = ""; permissionRequest = ""; }
}
