export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StagedImage {
  id: string;
  file: File;
  preview: string;
  rotation: number; // 0, 90, 180, 270
  cropArea?: CropArea;
  edited: boolean;
}

/**
 * Rotate an image by the specified degrees (90, 180, 270)
 */
export const rotateImage = async (
  file: File,
  degrees: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      const rad = (degrees * Math.PI) / 180;

      // Swap width and height for 90 and 270 degree rotations
      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Apply rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const rotatedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(rotatedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        file.type,
        0.95
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Crop an image to the specified area
 */
export const cropImage = async (
  file: File,
  cropArea: CropArea
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(croppedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        file.type,
        0.95
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Apply rotation and crop to an image
 */
export const processImage = async (
  file: File,
  rotation: number,
  cropArea?: CropArea
): Promise<File> => {
  let processedFile = file;

  // Apply rotation if needed
  if (rotation !== 0) {
    processedFile = await rotateImage(processedFile, rotation);
  }

  // Apply crop if needed
  if (cropArea) {
    processedFile = await cropImage(processedFile, cropArea);
  }

  return processedFile;
};

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio
 */
export const resizeImage = async (
  file: File,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  quality: number = 0.85
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Check if resize is needed
      if (width <= maxWidth && height <= maxHeight) {
        // No resize needed, return original file
        resolve(file);
        return;
      }

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (max 30MB)
  const maxSize = 30 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be smaller than 30MB' };
  }

  return { valid: true };
};

/**
 * Create a preview URL for a file
 */
export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * Revoke a preview URL to free memory
 */
export const revokePreviewUrl = (url: string): void => {
  URL.revokeObjectURL(url);
};

/**
 * Get image dimensions
 */
export const getImageDimensions = (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
