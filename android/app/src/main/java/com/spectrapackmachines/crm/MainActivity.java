package com.spectrapackmachines.crm;

import android.app.Activity;
import android.content.*;
import android.graphics.Insets;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import android.window.OnBackInvokedDispatcher;
import java.io.*;

public final class MainActivity extends Activity implements CrmWebClient.Screen, CrmDownloads.Listener {
    private static final int PICK_UPLOAD = 10, SAVE_EXPORT = 11;
    private WebView web;
    private ProgressBar progress;
    private View errorPanel;
    private TextView errorMessage;
    private CrmDownloads downloads;
    private CrmMobileBridge mobile;
    private ValueCallback<Uri[]> upload;
    private File pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        View root = findViewById(R.id.root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.getMenu().add("Reload CRM").setIcon(R.drawable.ic_refresh).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        toolbar.setOnMenuItemClickListener(item -> { reload(); return true; });
        web = findViewById(R.id.webview);
        progress = findViewById(R.id.progress);
        errorPanel = findViewById(R.id.error_panel);
        errorMessage = findViewById(R.id.error_message);
        findViewById(R.id.retry).setOnClickListener(view -> reload());
        downloads = new CrmDownloads(this, this);
        mobile = new CrmMobileBridge(this, web, this::launchContact);
        configureWebView();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        String last = state == null ? null : state.getString("crmPath");
        web.loadUrl(last != null && CrmUrls.isCrmPage(last) ? last : CrmUrls.HOME);
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Android's user-selected document picker only.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " SpectraCRM/1.1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new CrmWebClient(this, downloads, mobile));
        web.setDownloadListener((url, agent, disposition, mime, size) -> downloads.download(web, url, agent, disposition, mime));
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (upload != null) upload.onReceiveValue(null);
                upload = callback;
                try { startActivityForResult(params.createIntent(), PICK_UPLOAD); return true; }
                catch (ActivityNotFoundException ignored) { upload = null; callback.onReceiveValue(null); failed("No file picker is available on this phone."); return true; }
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message result) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (CrmUrls.isInternalNavigation(url)) web.loadUrl(url);
                        else external(url);
                        child.post(child::destroy);
                        return true;
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(popup);
                result.sendToTarget();
                return true;
            }
        });
    }

    private void reload() {
        String url = web.getUrl();
        web.loadUrl(CrmUrls.isCrmPage(url) ? url : CrmUrls.HOME);
    }

    @Override public void loading() { errorPanel.setVisibility(View.GONE); progress.setVisibility(View.VISIBLE); }
    @Override public void finished(boolean success) { progress.setVisibility(View.GONE); if (success) errorPanel.setVisibility(View.GONE); findViewById(R.id.toolbar).setVisibility(web.getUrl() != null && web.getUrl().contains("/admin/mobile") ? View.GONE : View.VISIBLE); }
    @Override public void error(String message) { progress.setVisibility(View.GONE); errorMessage.setText(message); errorPanel.setVisibility(View.VISIBLE); }
    @Override public void failed(String message) { if (!isFinishing()) Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    @Override public void external(String address) {
        launchContact(address);
    }
    private boolean launchContact(String address) {
        if (!CrmUrls.isExternalLink(address)) return false;
        Uri uri = Uri.parse(address);
        String action = "tel".equalsIgnoreCase(uri.getScheme()) ? Intent.ACTION_DIAL : "mailto".equalsIgnoreCase(uri.getScheme()) ? Intent.ACTION_SENDTO : Intent.ACTION_VIEW;
        Intent intent = new Intent(action, uri);
        if ("https".equalsIgnoreCase(uri.getScheme())) intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try { startActivity(intent); return true; }
        catch (ActivityNotFoundException ignored) { failed("No compatible app is installed to open this link."); return false; }
    }

    @Override public void ready(File file, String name, String mime) {
        if (isFinishing()) return;
        if (pendingExport != null) { file.delete(); failed("Finish saving the current export first."); return; }
        pendingExport = file;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
        try { startActivityForResult(intent, SAVE_EXPORT); }
        catch (ActivityNotFoundException ignored) { pendingExport.delete(); pendingExport = null; failed("No save-file app is available on this phone."); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_UPLOAD && upload != null) {
            upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); upload = null;
        }
        if (request == SAVE_EXPORT && pendingExport != null) {
            final File file = pendingExport; pendingExport = null;
            final Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            if (uri == null) { file.delete(); return; }
            new Thread(() -> {
                try (InputStream input = new FileInputStream(file); OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IOException();
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    runOnUiThread(() -> failed("Export saved."));
                } catch (Exception ignored) { runOnUiThread(() -> failed("Could not save this export. Please try again.")); }
                finally { file.delete(); }
            }, "crm-export-save").start();
        }
    }

    @Override public void onBackPressed() { handleBack(); }

    private void handleBack() {
        if (!CrmUrls.isCrmPage(web.getUrl())) { goBack(); return; }
        String script = "(function(){if(!window.dispatchEvent(new Event('spectra-native-back',{cancelable:true})))return true;var dialog=document.querySelector('[data-crm-dialog][aria-modal=true]');if(dialog){window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;}var menu=document.querySelector('button[aria-label=\"Close admin navigation\"]');if(menu){menu.click();return true;}return false;})()";
        web.evaluateJavascript(script, consumed -> { if (!"true".equals(consumed)) goBack(); });
    }

    private void goBack() {
        WebBackForwardList history = web.copyBackForwardList();
        int previous = history.getCurrentIndex() - 1;
        if (previous >= 0 && !CrmUrls.isLogin(history.getItemAtIndex(previous).getUrl())) web.goBack();
        else finish();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        if (CrmUrls.isCrmPage(web.getUrl())) state.putString("crmPath", CrmUrls.ORIGIN + Uri.parse(web.getUrl()).getPath());
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() { mobile.pause(); web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); if (mobile != null) mobile.resume(); }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) { super.onRequestPermissionsResult(request, permissions, results); if (request == CrmMobileBridge.LOCATION_PERMISSION) mobile.permissionsResult(); }
    @Override protected void onDestroy() {
        if (upload != null) upload.onReceiveValue(null);
        mobile.detach(); downloads.close(); web.stopLoading(); web.destroy(); super.onDestroy();
    }
}
