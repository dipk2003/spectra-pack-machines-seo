'use client';
export type NativeState = { deviceId: string; version: string; foreground: boolean; location: 'off'|'on'|'denied'|'unavailable' };
export type NativeRequest = { type: 'location_start'|'location_stop'|'open_external'; url?: string };
declare global {
  interface Window {
    SpectraCRM?: { state: NativeState; request: (input: NativeRequest) => Promise<{ opened?: boolean; location?: NativeState['location'] }> };
  }
}
export const openNativeContact = async (url: string) => {
  if (!window.SpectraCRM) return false;
  const result = await window.SpectraCRM.request({ type: 'open_external', url });
  if (!result.opened) throw new Error('The phone could not open that app. Check that it is installed.');
  return true;
};
