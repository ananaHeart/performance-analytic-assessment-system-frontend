// The Android app download. Change the link here (or set VITE_APK_URL on Render), never in page code.
export const APP_RELEASE = {
  // Google Drive share link (Heart, 2026-10-17: Marka-2026-10-07.apk, the cloud build).
  // It may change after today's rebuild; then update this line or set VITE_APK_URL.
  url: import.meta.env.VITE_APK_URL ||
    'https://drive.google.com/file/d/1r9HawQ1YID3OFYRKNU5dVJNpwhXY7qAa/view?usp=sharing',
  version: '', // leave empty: every build so far is "1.1-scanner-test"
  size: 'about 33 MB', // from MOBILE, 2026-10-17; update after each rebuild
  minAndroid: 'Android 7.0 or later', // minSdk 24
  updated: '', // for example 'October 17, 2026'
}

export function hasAppDownload() {
  return Boolean(APP_RELEASE.url)
}
