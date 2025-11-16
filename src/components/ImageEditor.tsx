import { useState, useRef, useEffect } from 'react';
import { RotateCw, RotateCcw, Crop, X, Check } from 'lucide-react';
import { StagedImage, CropArea } from '../utils/imageUtils';

interface ImageEditorProps {
  image: StagedImage;
  onSave: (rotation: number, cropArea?: CropArea, caption?: string) => void;
  onCancel: () => void;
}

type AspectRatio = 'free' | '16:9' | '4:3' | '3:2' | '1:1' | '3:4' | '9:16';

export const ImageEditor = ({ image, onSave, onCancel }: ImageEditorProps) => {
  const [rotation, setRotation] = useState(image.rotation);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [caption, setCaption] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && canvasRef.current) {
      drawImage();
    }
  }, [rotation, image.preview]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  // Handle mouse up outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        drawImage();
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  const drawImage = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on rotation
    if (rotation === 90 || rotation === 270) {
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
    } else {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply rotation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    // Draw crop area if cropping
    if (isCropping && cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const width = Math.abs(cropEnd.x - cropStart.x);
      const height = Math.abs(cropEnd.y - cropStart.y);

      // Darken outside crop area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y, x, height);
      ctx.fillRect(x + width, y, canvas.width - (x + width), height);
      ctx.fillRect(0, y + height, canvas.width, canvas.height - (y + height));

      // Draw crop border
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }
  };

  const handleRotateCW = () => {
    setRotation((prev) => (prev + 90) % 360);
    // Clear crop selection when rotating since coordinates become invalid
    setIsDragging(false);
    setCropStart(null);
    setCropEnd(null);
  };

  const handleRotateCCW = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
    // Clear crop selection when rotating since coordinates become invalid
    setIsDragging(false);
    setCropStart(null);
    setCropEnd(null);
  };

  const getAspectRatioValue = (ratio: AspectRatio): number | null => {
    switch (ratio) {
      case '16:9':
        return 16 / 9;
      case '4:3':
        return 4 / 3;
      case '3:2':
        return 3 / 2;
      case '1:1':
        return 1;
      case '3:4':
        return 3 / 4;
      case '9:16':
        return 9 / 16;
      default:
        return null;
    }
  };

  const constrainToAspectRatio = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): { x: number; y: number } => {
    const ratio = getAspectRatioValue(aspectRatio);
    if (!ratio) return end;

    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    let newWidth = width;
    let newHeight = height;

    if (width / height > ratio) {
      newWidth = height * ratio;
    } else {
      newHeight = width / ratio;
    }

    const newX = end.x > start.x ? start.x + newWidth : start.x - newWidth;
    const newY = end.y > start.y ? start.y + newHeight : start.y - newHeight;

    return { x: newX, y: newY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setIsDragging(true);
    setCropStart({ x, y });
    setCropEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !isDragging || !cropStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    let y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Constrain to aspect ratio if needed
    const constrainedEnd = constrainToAspectRatio(cropStart, { x, y });

    setCropEnd(constrainedEnd);
    drawImage();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Keep the crop selection visible after releasing mouse
    if (isCropping && cropStart && cropEnd) {
      drawImage();
    }
  };

  const handleSave = () => {
    let cropArea: CropArea | undefined;

    if (isCropping && cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const width = Math.abs(cropEnd.x - cropStart.x);
      const height = Math.abs(cropEnd.y - cropStart.y);

      if (width > 10 && height > 10) {
        cropArea = { x, y, width, height };
      }
    }

    onSave(rotation, cropArea, caption);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Edit Image</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Canvas */}
            <div className="flex justify-center bg-gray-100 rounded-lg p-4">
              <div className="relative">
                <img
                  ref={imgRef}
                  src={image.preview}
                  alt="Edit"
                  className="hidden"
                  onLoad={drawImage}
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="max-w-full max-h-[50vh] border border-gray-300 rounded cursor-crosshair"
                  style={{ cursor: isCropping ? 'crosshair' : 'default' }}
                />
              </div>
            </div>

            {/* Tools */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRotateCCW}
                className="btn-outline p-2"
                title="Rotate counter-clockwise 90°"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleRotateCW}
                className="btn-outline p-2"
                title="Rotate clockwise 90°"
              >
                <RotateCw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isCropping) {
                    // Entering crop mode
                    setIsCropping(true);
                  }
                  // Don't turn off crop mode - let the user keep their selection
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isCropping
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'border-2 border-gray-300 hover:border-gray-400'
                }`}
                title={isCropping ? 'Crop mode active' : 'Enable crop tool'}
              >
                <Crop className="w-4 h-4" />
                {isCropping ? 'Cropping Active - Drag to select area' : 'Enable Crop'}
              </button>

              {isCropping && (
                <div className="flex items-center gap-2 border-l-2 border-gray-300 pl-3 ml-1">
                  <span className="text-sm font-medium text-gray-700">Aspect:</span>
                  {(['free', '16:9', '4:3', '3:2', '1:1', '3:4', '9:16'] as AspectRatio[]).map(
                    (ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => {
                          setAspectRatio(ratio);
                          setIsDragging(false);
                          setCropStart(null);
                          setCropEnd(null);
                          drawImage();
                        }}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={`Set ${ratio === 'free' ? 'free' : ratio} aspect ratio`}
                      >
                        {ratio === 'free' ? 'Free' : ratio}
                      </button>
                    )
                  )}
                </div>
              )}

              {isCropping && cropStart && cropEnd && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDragging(false);
                    setCropStart(null);
                    setCropEnd(null);
                    drawImage();
                  }}
                  className="btn-secondary"
                  title="Clear crop selection"
                >
                  Clear Crop
                </button>
              )}
            </div>

            {/* Caption */}
            <div>
              <label className="label">Image Caption (Optional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g., Front view, Headstock closeup, etc."
                className="input-field"
              />
            </div>

            {/* Current Rotation Info */}
            {rotation !== 0 && (
              <div className="bg-primary-50 border-l-4 border-primary-500 p-3 rounded">
                <p className="text-sm text-primary-900">
                  Current rotation: <strong>{rotation}°</strong>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary" title="Discard changes">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn-primary flex items-center gap-2" title="Save edits to image">
            <Check className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
