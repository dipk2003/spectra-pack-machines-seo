package com.spectrapackmachines.crm;

public final class CrmUrlsTest {
    private static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
    }
    public static void main(String[] args) {
        for (String url : new String[]{CrmUrls.HOME, CrmUrls.ORIGIN + "/admin/login", CrmUrls.ORIGIN + "/admin/products/test", CrmUrls.ORIGIN + "/api/auth/callback/credentials", "https://spectrapackmachines.com:443/admin/leads"})
            check(CrmUrls.isInternalNavigation(url), "Expected CRM navigation: " + url);
        for (String url : new String[]{null, "", CrmUrls.ORIGIN, CrmUrls.ORIGIN + "/administrator", CrmUrls.ORIGIN + "/", CrmUrls.ORIGIN + "/admin/../public", CrmUrls.ORIGIN + "/admin/%2e%2e/public", "http://spectrapackmachines.com/admin", "https://spectrapackmachines.com.evil.test/admin", "https://evil.test@spectrapackmachines.com/admin", "https://spectrapackmachines.com:444/admin", "file:///admin", "javascript:alert(1)", "data:text/html,test", "intent://example", "https://other.test/admin"})
            check(!CrmUrls.isInternalNavigation(url), "Untrusted navigation accepted: " + url);
        check(CrmUrls.isTrustedBlob("blob:" + CrmUrls.ORIGIN + "/123"), "CRM blob export");
        check(!CrmUrls.isTrustedBlob("blob:https://evil.test/123"), "External blob blocked");
        check(!CrmUrls.isTrustedBlob("blob:https://spectrapackmachines.com.evil.test/123"), "Blob suffix attack blocked");
        check(CrmUrls.isExternalLink("tel:+919370440729"), "Dial link");
        check(CrmUrls.isExternalLink("mailto:info@spectrapackmachines.com"), "Mail link");
        check(CrmUrls.isExternalLink("https://wa.me/919370440729"), "WhatsApp link");
        check(!CrmUrls.isExternalLink("intent://evil"), "Arbitrary Android intents blocked");
        check(!CrmUrls.isExternalLink("file:///sdcard/private"), "Local file links blocked");
        check(CrmUrls.safeFilename("../../private.csv", "text/csv").indexOf('/') == -1, "Export filename has no path");
        check(CrmUrls.safeFilename("", "text/csv").endsWith(".csv"), "CSV export default");
        System.out.println("Android navigation, external-link and filename checks passed.");
    }
}
