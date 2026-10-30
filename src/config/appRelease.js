// The Android app download. Change the link here (or set VITE_APK_URL on Render), never in page code.
export const APP_RELEASE = {
  // Current Google Drive share link provided by Heart on 2026-10-28.
  // For deployment-specific releases, this can still be overridden with VITE_APK_URL.
  url: import.meta.env.VITE_APK_URL ||
    'https://drive.google.com/file/d/1_zKSqucsx0QYMI6jzAC563jdTzwDH28d/view?usp=sharing',
  version: '1.2', // v1.2 (versionCode 3) is the first build with a real versionName; shown as "Version 1.2"
  size: 'about 33 MB', // Drive shows 33M for the 2026-10-18 build; update after each rebuild
  minAndroid: 'Android 7.0 or later', // minSdk 24
  updated: '', // for example 'October 17, 2026'
}

export function hasAppDownload() {
  return Boolean(APP_RELEASE.url)
}
