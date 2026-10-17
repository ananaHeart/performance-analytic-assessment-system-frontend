import { useSyncExternalStore } from 'react'

// Light or dark theme on <html data-theme>. A choice is saved in localStorage; with no saved
// choice the site follows the device setting. index.html sets the attribute before the CSS loads.
const STORAGE_KEY = 'marka-theme'
const THEMES = new Set(['light', 'dark'])
const listeners = new Set()
const darkQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return THEMES.has(saved) ? saved : null
  } catch {
    return null
  }
}

function getDeviceTheme() {
  return darkQuery?.matches ? 'dark' : 'light'
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  listeners.forEach((listener) => listener())
}

export function getTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  return THEMES.has(current) ? current : readSavedTheme() ?? getDeviceTheme()
}

export function setTheme(theme) {
  if (!THEMES.has(theme)) return
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked; the theme still switches for this visit.
  }
  applyTheme(theme)
}

if (typeof window !== 'undefined') {
  // Follow the device live while there's no saved choice, and keep other tabs in step.
  darkQuery?.addEventListener('change', () => {
    if (!readSavedTheme()) applyTheme(getDeviceTheme())
  })
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) applyTheme(readSavedTheme() ?? getDeviceTheme())
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}
