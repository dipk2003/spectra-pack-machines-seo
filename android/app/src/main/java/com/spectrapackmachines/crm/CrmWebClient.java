package com.spectrapackmachines.crm;

import android.graphics.Bitmap;
import android.net.http.SslError;
import android.webkit.*;

final class CrmWebClient extends WebViewClient {
    interface Screen {
        void loading();
        void finished(boolean success);
        void error(String message);
        void external(String address);
    }
    private final Screen screen;
    private final CrmDownloads downloads;
    private boolean failed;

    CrmWebClient(Screen screen, CrmDownloads downloads) { this.screen = screen; this.downloads = downloads; }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!request.isForMainFrame()) return false;
        String address = request.getUrl().toString();
        if (CrmUrls.isInternalNavigation(address)) return false;
        if (request.hasGesture() && CrmUrls.isExternalLink(address)) screen.external(address);
        return true;
    }

    @Override public void onPageStarted(WebView view, String address, Bitmap icon) {
        failed = false;
        downloads.detach();
        if (!CrmUrls.isInternalNavigation(address)) { view.stopLoading(); failed = true; screen.error("Open this link using your phone's browser."); return; }
        screen.loading();
    }

    @Override public void onPageFinished(WebView view, String address) {
        screen.finished(!failed);
        if (!failed && CrmUrls.isCrmPage(address)) downloads.attach(view);
        CookieManager.getInstance().flush();
    }

    @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) { failed = true; screen.error("Check your internet connection, then try again."); }
    }

    @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        if (request.isForMainFrame()) { failed = true; screen.error("The CRM is temporarily unavailable. Please try again shortly."); }
    }

    @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        handler.cancel();
        failed = true;
        screen.error("A secure connection could not be established. Please try again later.");
    }
}
