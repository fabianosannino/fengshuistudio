// FengShui Studio — Service Worker
// Provides offline caching and install prompt support

const CACHE_NAME = 'fengshuistudio-v1'

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
  '/dashboard',
  '/login',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore individual fetch failures during precache
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch: network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests and API calls
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  if (request.url.includes('supabase.co')) return
  if (request.url.includes('stripe.com')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 })
        })
      })
  )
})
