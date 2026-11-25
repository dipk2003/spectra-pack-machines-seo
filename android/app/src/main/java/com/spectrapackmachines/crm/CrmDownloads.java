package com.spectrapackmachines.crm;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebView;
import android.webkit.URLUtil;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Origin-scoped export channel. No JavaScript interface or storage permission. */
final class CrmDownloads {
    interface Listener {
        void ready(File file, String name, String mime);
        void failed(String message);
    }
    private static final int MAX_BYTES = 15 * 1024 * 1024;
    private final Context context;
    private final Listener listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebMessagePort port;
    private volatile String nonce = "";

    CrmDownloads(Context context, Listener listener) { this.context = context; this.listener = listener; }

    void detach() {
        nonce = "";
        if (port != null) { port.close(); port = null; }
    }

    void attach(WebView view) {
        detach();
        if (!CrmUrls.isCrmPage(view.getUrl())) return;
        final String token = UUID.randomUUID().toString();
        nonce = token;
        try {
            String script;
            try (InputStream source = context.getAssets().open("exports.js")) {
                script = new String(readLimited(source, 64 * 1024), StandardCharsets.UTF_8)
                    .replace("__NONCE__", JSONObject.quote(token)).replace("__MAX_BYTES__", String.valueOf(MAX_BYTES));
            }
            WebMessagePort[] channels = view.createWebMessageChannel();
            port = channels[0];
            port.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override public void onMessage(WebMessagePort source, WebMessage message) {
                    if (!token.equals(nonce) || !CrmUrls.isCrmPage(view.getUrl())) return;
                    final String raw = message.getData();
                    if (raw == null || raw.length() > MAX_BYTES * 4 / 3 + 4096) { fail("Export is too large. Use the desktop CRM for this file."); return; }
                    worker.execute(() -> receiveExport(raw, token));
                }
            });
            view.evaluateJavascript(script, ignored -> {
                if (token.equals(nonce) && CrmUrls.isCrmPage(view.getUrl())) {
                    view.postWebMessage(new WebMessage(token, new WebMessagePort[]{channels[1]}), Uri.parse(CrmUrls.ORIGIN));
                }
            });
        } catch (Exception ignored) { fail("Exports could not be prepared. Reload the CRM and try again."); }
    }

    private void receiveExport(String raw, String token) {
        try {
            JSONObject data = new JSONObject(raw);
            if (!token.equals(nonce) || !token.equals(data.optString("nonce"))) return;
            if (!"export".equals(data.optString("type"))) throw new IOException();
            String encoded = data.getString("data");
            int separator = encoded.indexOf(",");
            if (!encoded.startsWith("data:") || separator < 0 || !encoded.substring(0, separator).endsWith(";base64")) throw new IOException();
            byte[] bytes = Base64.decode(encoded.substring(separator + 1), Base64.DEFAULT);
            if (bytes.length > MAX_BYTES) throw new IOException();
            String mime = mime(data.optString("mime"));
            File file = newExport();
            try (OutputStream out = new FileOutputStream(file)) { out.write(bytes); }
            if (token.equals(nonce)) deliver(file, CrmUrls.safeFilename(data.optString("name"), mime), mime);
        } catch (Exception ignored) { fail("Could not prepare this export. Please try again."); }
    }

    void download(WebView view, String address, String userAgent, String disposition, String mimeType) {
        if (!CrmUrls.isCrmPage(view.getUrl())) return;
        if (CrmUrls.isTrustedBlob(address)) { fail("Please reload the CRM, then export again."); return; }
        if (!CrmUrls.isTrustedOrigin(address)) { fail("This download is not available inside the CRM app."); return; }
        final String cookies = CookieManager.getInstance().getCookie(address);
        worker.execute(() -> {
            try {
                String current = address;
                for (int redirects = 0; redirects < 4; redirects++) {
                    if (!CrmUrls.isTrustedOrigin(current)) throw new IOException();
                    HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(20000);
                    connection.setRequestProperty("User-Agent", userAgent);
                    if (cookies != null) connection.setRequestProperty("Cookie", cookies);
                    try {
                        int status = connection.getResponseCode();
                        if (status >= 300 && status < 400) { current = new URL(new URL(current), connection.getHeaderField("Location")).toString(); continue; }
                        if (status != 200 || connection.getContentLengthLong() > MAX_BYTES) throw new IOException();
                        String type = mime(connection.getContentType() == null ? mimeType : connection.getContentType());
                        File file = newExport();
                        try (InputStream input = connection.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                            byte[] buffer = new byte[8192]; int total = 0, count;
                            while ((count = input.read(buffer)) != -1) { total += count; if (total > MAX_BYTES) throw new IOException(); out.write(buffer, 0, count); }
                        }
                        deliver(file, CrmUrls.safeFilename(URLUtil.guessFileName(address, disposition, type), type), type);
                        return;
                    } finally { connection.disconnect(); }
                }
                throw new IOException();
            } catch (Exception ignored) { fail("Download failed. Check your connection and sign-in, then try again."); }
        });
    }

    private File newExport() throws IOException {
        File directory = new File(context.getCacheDir(), "crm-exports");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException();
        // Files stay private until Android's Save dialog grants the chosen destination.
        File[] old = directory.listFiles();
        if (old != null) for (File file : old) if (file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
        return File.createTempFile("export-", ".tmp", directory);
    }

    private static byte[] readLimited(InputStream input, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
        while ((count = input.read(buffer)) != -1) { if (out.size() + count > limit) throw new IOException(); out.write(buffer, 0, count); }
        return out.toByteArray();
    }

    private static String mime(String value) {
        String type = value == null ? "" : value.split(";", 2)[0].trim().toLowerCase(java.util.Locale.ROOT);
        return type.matches("text/(csv|plain)|application/(pdf|vnd.ms-excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet)|image/(png|jpeg)|audio/(mpeg|mp4|wav|x-wav)") ? type : "application/octet-stream";
    }
    private void deliver(File file, String name, String type) { main.post(() -> listener.ready(file, name, type)); }
    private void fail(String message) { main.post(() -> listener.failed(message)); }
    void close() { detach(); worker.shutdownNow(); }
}
