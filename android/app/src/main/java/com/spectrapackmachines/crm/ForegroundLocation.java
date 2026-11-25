package com.spectrapackmachines.crm;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;

/** No service/background permission: updates are removed synchronously on pause. */
final class ForegroundLocation implements LocationListener {
    interface Listener { void state(String status); void point(Location location); }
    private final Activity activity;
    private final LocationManager manager;
    private final Listener listener;
    private boolean resumed, wanted;
    private long lastSent;
    private String status = "off";
    ForegroundLocation(Activity activity, Listener listener) {
        this.activity = activity; this.listener = listener;
        manager = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
    }
    boolean permitted() { return fine() || activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED; }
    private boolean fine() { return activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED; }
    String status() { return status; }
    void want(boolean enabled) { wanted = enabled; if (enabled) start(); else stop(); }
    void resume() { resumed = true; if (wanted) start(); }
    void pause() { resumed = false; stop(); }
    void detach() { wanted = false; stop(); }
    private void report(String value) { status = value; listener.state(value); }
    @SuppressWarnings("MissingPermission")
    private void start() {
        if (!resumed || !wanted) return;
        if (!permitted()) { report("denied"); return; }
        try {
            manager.removeUpdates(this);
            boolean started = false;
            for (String provider : new String[]{LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
                if (LocationManager.GPS_PROVIDER.equals(provider) && !fine()) continue;
                if (!manager.isProviderEnabled(provider)) continue;
                manager.requestLocationUpdates(provider, 60000L, 25f, this, Looper.getMainLooper());
                started = true;
                Location recent = manager.getLastKnownLocation(provider);
                if (recent != null) onLocationChanged(recent);
            }
            report(started ? "on" : "unavailable");
        } catch (SecurityException ignored) { report("denied"); }
        catch (Exception ignored) { report("unavailable"); }
    }
    private void stop() { try { manager.removeUpdates(this); } catch (Exception ignored) { } report("off"); }
    @Override public void onLocationChanged(Location location) {
        if (!resumed || !wanted || !permitted()) return;
        long age = (SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos()) / 1000000;
        if (age < 0 || age > 120000 || !location.hasAccuracy() || location.getAccuracy() > 10000) return;
        long now = SystemClock.elapsedRealtime();
        if (lastSent != 0 && now - lastSent < 30000) return;
        lastSent = now; listener.point(location);
    }
    @Override public void onProviderDisabled(String provider) { if (wanted && resumed) start(); }
    @Override public void onProviderEnabled(String provider) { if (wanted && resumed) start(); }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
}
