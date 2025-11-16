import { useState, useEffect } from 'react';
import { getImageUrl, getImageData } from '../utils/imageStorage';

// Cache for blob URLs to avoid recreating them
const urlCache = new Map<string, string>();
const dataCache = new Map<string, { url: string; mimeType: string }>();

/**
 * Hook to load images from IndexedDB or use direct URLs
 * Handles both "indexeddb:{id}" format and regular URLs
 *
 * @param imageUrl - The image URL (either "indexeddb:{id}" or a regular URL)
 * @returns The resolved blob URL or null if loading
 */
export const useImageUrl = (imageUrl: string | undefined): string | null => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      return;
    }

    // If it's not an IndexedDB reference, use it directly
    if (!imageUrl.startsWith('indexeddb:')) {
      setResolvedUrl(imageUrl);
      return;
    }

    // Check cache first
    if (urlCache.has(imageUrl)) {
      setResolvedUrl(urlCache.get(imageUrl)!);
      return;
    }

    // Extract the ID and load from IndexedDB
    const imageId = imageUrl.replace('indexeddb:', '');
    let isCancelled = false;

    getImageUrl(imageId)
      .then((url) => {
        if (!isCancelled && url) {
          urlCache.set(imageUrl, url);
          setResolvedUrl(url);
        }
      })
      .catch((error) => {
        console.error('Failed to load image from IndexedDB:', error);
        if (!isCancelled) {
          setResolvedUrl(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  return resolvedUrl;
};

/**
 * Hook to load multiple images from IndexedDB
 *
 * @param imageUrls - Array of image URLs
 * @returns Array of resolved URLs (null for images still loading)
 */
export const useImageUrls = (imageUrls: string[]): (string | null)[] => {
  const [resolvedUrls, setResolvedUrls] = useState<(string | null)[]>(
    new Array(imageUrls.length).fill(null)
  );

  useEffect(() => {
    let isCancelled = false;

    const loadImages = async () => {
      const urls = await Promise.all(
        imageUrls.map(async (imageUrl) => {
          if (!imageUrl) return null;

          // If it's not an IndexedDB reference, use it directly
          if (!imageUrl.startsWith('indexeddb:')) {
            return imageUrl;
          }

          // Check cache first
          if (urlCache.has(imageUrl)) {
            return urlCache.get(imageUrl)!;
          }

          // Extract the ID and load from IndexedDB
          const imageId = imageUrl.replace('indexeddb:', '');
          try {
            const url = await getImageUrl(imageId);
            if (url) {
              urlCache.set(imageUrl, url);
              return url;
            }
          } catch (error) {
            console.error('Failed to load image from IndexedDB:', error);
          }

          return null;
        })
      );

      if (!isCancelled) {
        setResolvedUrls(urls);
      }
    };

    loadImages();

    return () => {
      isCancelled = true;
    };
  }, [imageUrls.join(',')]);

  return resolvedUrls;
};

/**
 * Hook to load image with MIME type from IndexedDB
 * Useful for detecting file types like PDFs
 *
 * @param imageUrl - The image URL (either "indexeddb:{id}" or a regular URL)
 * @returns Object with url and mimeType, or null if loading
 */
export const useImageData = (imageUrl: string | undefined): { url: string; mimeType: string } | null => {
  const [resolvedData, setResolvedData] = useState<{ url: string; mimeType: string } | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedData(null);
      return;
    }

    // If it's not an IndexedDB reference, use it directly (assume it's an image)
    if (!imageUrl.startsWith('indexeddb:')) {
      // Try to guess MIME type from URL extension
      const mimeType = imageUrl.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'image/jpeg';
      setResolvedData({ url: imageUrl, mimeType });
      return;
    }

    // Check cache first
    if (dataCache.has(imageUrl)) {
      setResolvedData(dataCache.get(imageUrl)!);
      return;
    }

    // Extract the ID and load from IndexedDB
    const imageId = imageUrl.replace('indexeddb:', '');
    let isCancelled = false;

    getImageData(imageId)
      .then((data) => {
        if (!isCancelled && data) {
          dataCache.set(imageUrl, data);
          setResolvedData(data);
        }
      })
      .catch((error) => {
        console.error('Failed to load image data from IndexedDB:', error);
        if (!isCancelled) {
          setResolvedData(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  return resolvedData;
};
