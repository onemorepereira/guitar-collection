/**
 * IndexedDB storage utility for guitar images
 * Provides much higher storage limits than localStorage (typically 50MB+ vs 5-10MB)
 */

const DB_NAME = 'guitar-collection-db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

interface ImageData {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

/**
 * Store an image file in IndexedDB
 * @param file - The image file to store
 * @returns A unique ID for the stored image
 */
export const storeImage = async (file: File): Promise<string> => {
  const db = await openDB();
  const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const imageData: ImageData = {
      id,
      blob: file,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    };

    const request = store.add(imageData);

    request.onsuccess = () => {
      resolve(id);
    };

    request.onerror = () => {
      reject(new Error('Failed to store image'));
    };
  });
};

/**
 * Retrieve an image from IndexedDB as a blob URL
 * @param id - The image ID
 * @returns A blob URL for the image
 */
export const getImageUrl = async (id: string): Promise<string | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as ImageData | undefined;
      if (result && result.blob) {
        const url = URL.createObjectURL(result.blob);
        resolve(url);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve image'));
    };
  });
};

/**
 * Retrieve an image from IndexedDB with its URL and MIME type
 * @param id - The image ID
 * @returns An object with the blob URL and MIME type
 */
export const getImageData = async (id: string): Promise<{ url: string; mimeType: string } | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as ImageData | undefined;
      if (result && result.blob) {
        const url = URL.createObjectURL(result.blob);
        // Handle legacy data without mimeType by using the blob's type
        const mimeType = result.mimeType || result.blob.type || 'application/octet-stream';
        resolve({ url, mimeType });
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve image'));
    };
  });
};

/**
 * Delete an image from IndexedDB
 * @param id - The image ID
 */
export const deleteImage = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete image'));
    };
  });
};

/**
 * Get all image IDs stored in IndexedDB
 */
export const getAllImageIds = async (): Promise<string[]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      resolve(request.result as string[]);
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve image IDs'));
    };
  });
};

/**
 * Clear all images from IndexedDB
 */
export const clearAllImages = async (): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to clear images'));
    };
  });
};
