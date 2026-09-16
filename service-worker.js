const SHARE_DB_NAME = 'selim-share-db';
const SHARE_DB_VERSION = 1;
const SHARE_STORE_NAME = 'shared-files';
const MAX_SHARED_PHOTOS = 20;
const APP_VERSION = 'whatsapp-3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isShareTarget = requestUrl.pathname.endsWith('/share-target') || requestUrl.pathname.endsWith('/share-target/');

  if (event.request.method === 'POST' && isShareTarget) {
    event.respondWith(receiveSharedPhotos(event.request));
  }
});

async function receiveSharedPhotos(request) {
  let photos = [];

  try {
    const formData = await request.formData();
    photos = formData.getAll('photos')
      .filter((item) => item && typeof item.arrayBuffer === 'function' && String(item.type || '').startsWith('image/'))
      .slice(0, MAX_SHARED_PHOTOS);

    if (photos.length > 0) {
      await saveSharedPhotos(photos);
    }
  } catch (error) {
    console.error('Erro ao receber fotos compartilhadas:', error);
  }

  const destination = new URL('./index.html', self.registration.scope);
  destination.searchParams.set('shared', '1');
  destination.searchParams.set('count', String(photos.length));
  destination.searchParams.set('v', APP_VERSION);
  return Response.redirect(destination.href, 303);
}

function openShareDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SHARE_STORE_NAME)) {
        database.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedPhotos(photos) {
  const database = await openShareDatabase();
  const files = photos.map((photo, index) => ({
    name: photo.name || `foto_whatsapp_${index + 1}.jpg`,
    type: photo.type || 'image/jpeg',
    lastModified: photo.lastModified || Date.now(),
    blob: photo
  }));

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SHARE_STORE_NAME, 'readwrite');
    transaction.objectStore(SHARE_STORE_NAME).put({
      id: `incoming-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      files
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
