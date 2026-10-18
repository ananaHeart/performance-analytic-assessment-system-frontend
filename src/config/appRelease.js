// The Android app download. Change the link here (or set VITE_APK_URL on Render), never in page code.
export const APP_RELEASE = {
  // Google Drive share link (Heart, 2026-10-18: Marka-2026-10-18-v1.2-redesign-only.apk).
  // It may change after today's rebuild; then update this line or set VITE_APK_URL.
  url: import.meta.env.VITE_APK_URL ||
    'https://drive.google.com/file/d/1JySEv1K2XRlgP7yiIZQrYn3SxCFESp5_/view?usp=sharing',
  version: '', // left empty on purpose: the site doesn't show a version number
  size: 'about 33 MB', // Drive shows 33M for the 2026-10-18 build; update after each rebuild
  minAndroid: 'Android 7.0 or later', // minSdk 24
  updated: '', // for example 'October 17, 2026'
}

export function hasAppDownload() {
  return Boolean(APP_RELEASE.url)
}
