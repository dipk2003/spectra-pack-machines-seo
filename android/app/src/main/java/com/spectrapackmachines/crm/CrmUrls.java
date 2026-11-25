package com.spectrapackmachines.crm;

import java.net.URI;

/** Shared navigation policy; no app credentials or API secrets are embedded. */
public final class CrmUrls {
    public static final String ORIGIN = "https://spectrapackmachines.com";
    public static final String HOME = ORIGIN + "/admin/mobile";
    private CrmUrls() { }

    public static boolean isTrustedOrigin(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "spectrapackmachines.com".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }

    public static boolean isCrmPage(String value) {
        if (!isTrustedOrigin(value)) return false;
        String path = URI.create(value).getPath();
        return path != null && !path.contains("/../") && !path.endsWith("/..")
            && ("/admin".equals(path) || path.startsWith("/admin/"));
    }

    public static boolean isInternalNavigation(String value) {
        if (isCrmPage(value)) return true;
        if (!isTrustedOrigin(value)) return false;
        String path = URI.create(value).getPath();
        return path != null && path.startsWith("/api/auth/") && !path.contains("/../") && !path.endsWith("/..");
    }

    public static boolean isLogin(String value) {
        if (!isTrustedOrigin(value)) return false;
        String path = URI.create(value).getPath();
        return path != null && (path.equals("/admin/login") || path.equals("/admin/login/") || path.startsWith("/api/auth/"));
    }

    public static boolean isTrustedBlob(String value) {
        return value != null && value.startsWith("blob:") && isTrustedOrigin(value.substring(5));
    }

    public static boolean isExternalLink(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if ("https".equalsIgnoreCase(scheme)) return uri.getHost() != null && uri.getRawUserInfo() == null;
            return "tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) || "whatsapp".equalsIgnoreCase(scheme);
        } catch (Exception ignored) { return false; }
    }

    public static String safeFilename(String value, String mime) {
        String name = value == null ? "" : value.replaceAll("[^a-zA-Z0-9._ -]", "_");
        name = name.replaceAll("^[. ]+", "").trim();
        if (name.length() > 100) name = name.substring(name.length() - 100);
        if (!name.isEmpty()) return name;
        String extension = mime.contains("csv") ? ".csv" : mime.contains("spreadsheet") ? ".xlsx" : mime.contains("pdf") ? ".pdf" : ".txt";
        return "spectra-crm-export" + extension;
    }
}
