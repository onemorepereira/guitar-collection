import { useState } from 'react';
import { X, Edit, Star, Upload, ImageIcon, GripVertical } from 'lucide-react';
import { StagedImage, validateImageFile, resizeImage } from '../utils/imageUtils';
import { ImageEditor } from './ImageEditor';

interface ImageStagingProps {
  images: StagedImage[];
  onImagesChange: (images: StagedImage[]) => void;
  onUpload: () => void;
  uploading: boolean;
}

export const ImageStaging = ({
  images,
  onImagesChange,
  onUpload,
  uploading,
}: ImageStagingProps) => {
  const [editingImage, setEditingImage] = useState<StagedImage | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: StagedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateImageFile(file);

      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      // Resize image before staging (max 2048px, quality 0.85)
      const resizedFile = await resizeImage(file, 2048, 2048, 0.85);
      const preview = URL.createObjectURL(resizedFile);

      newImages.push({
        id: `staged-${Date.now()}-${i}`,
        file: resizedFile,
        preview,
        rotation: 0,
        edited: false,
      });
    }

    onImagesChange([...images, ...newImages]);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const newImages: StagedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateImageFile(file);

      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      // Resize image before staging (max 2048px, quality 0.85)
      const resizedFile = await resizeImage(file, 2048, 2048, 0.85);
      const preview = URL.createObjectURL(resizedFile);

      newImages.push({
        id: `staged-${Date.now()}-${i}`,
        file: resizedFile,
        preview,
        rotation: 0,
        edited: false,
      });
    }

    onImagesChange([...images, ...newImages]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeImage = (id: string) => {
    const image = images.find((img) => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter((img) => img.id !== id));
  };

  const setPrimary = (id: string) => {
    const image = images.find((img) => img.id === id);
    if (!image) return;

    const reordered = images.filter((img) => img.id !== id);
    onImagesChange([image, ...reordered]);
  };

  const handleSaveEdit = async (
    imageId: string,
    rotation: number,
    cropArea?: any,
    caption?: string
  ) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    // Generate a new preview and processed file if the image was edited
    let newPreview = image.preview;
    let newFile = image.file;
    if (rotation !== 0 || cropArea) {
      try {
        // Process the image to create both the file and preview
        const { processImage } = await import('../utils/imageUtils');
        const processedFile = await processImage(image.file, rotation, cropArea);
        newFile = processedFile;
        newPreview = URL.createObjectURL(processedFile);

        // Revoke old preview URL
        URL.revokeObjectURL(image.preview);
      } catch (error) {
        console.error('Error generating preview:', error);
      }
    }

    onImagesChange(
      images.map((img) =>
        img.id === imageId
          ? {
              ...img,
              file: newFile,
              preview: newPreview,
              rotation: 0, // Reset rotation since it's been applied
              cropArea: undefined, // Reset crop since it's been applied
              edited: rotation !== 0 || !!cropArea,
            }
          : img
      )
    );
    setEditingImage(null);
  };

  // Drag to reorder
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(dragOverIndex, 0, draggedImage);

    onImagesChange(newImages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/50 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Drop images here or click to browse
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Supports JPG, PNG, GIF up to 30MB • Auto-resized to 2048px
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* Staged Images */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              Staged Images ({images.length})
            </h3>
            <button
              type="button"
              onClick={onUpload}
              disabled={uploading || images.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              title={`Upload ${images.length} staged image${images.length > 1 ? 's' : ''}`}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : `Upload ${images.length} Image${images.length > 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                className={`relative group cursor-move ${
                  dragOverIndex === index ? 'opacity-50' : ''
                }`}
              >
                {/* Drag Handle */}
                <div className="absolute top-2 left-2 bg-gray-900/70 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Image */}
                <div
                  className={`relative h-40 rounded-lg overflow-hidden ${
                    index === 0 ? 'ring-4 ring-primary-500' : ''
                  }`}
                  style={{
                    transform: `rotate(${img.rotation}deg)`,
                  }}
                >
                  <img
                    src={img.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingImage(img)}
                      className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-all"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="opacity-0 group-hover:opacity-100 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-all"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Badge */}
                  {index === 0 && (
                    <div className="absolute bottom-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Primary
                    </div>
                  )}

                  {/* Set Primary Button */}
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => setPrimary(img.id)}
                      className="absolute bottom-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Set as main image"
                    >
                      Set Primary
                    </button>
                  )}

                  {/* Edited Badge */}
                  {img.edited && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      Edited
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="mt-2">
                  <p className="text-xs text-gray-600 truncate" title={img.file.name}>
                    {img.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(img.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-900">
              <strong>Tips:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Images are automatically resized to 2048px for faster uploads</li>
                <li>Drag images to reorder them</li>
                <li>First image is the primary image</li>
                <li>Click edit to rotate or crop</li>
                <li>Click "Upload" when ready to save</li>
              </ul>
            </p>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingImage && (
        <ImageEditor
          image={editingImage}
          onSave={(rotation, cropArea, caption) =>
            handleSaveEdit(editingImage.id, rotation, cropArea, caption)
          }
          onCancel={() => setEditingImage(null)}
        />
      )}
    </div>
  );
};
