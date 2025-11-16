import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useImageData } from '../hooks/useImageUrl';

interface ReceiptViewerProps {
  receiptUrl: string;
  onClose: () => void;
}

export const ReceiptViewer = ({ receiptUrl, onClose }: ReceiptViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Detect if this is a CloudFront/S3 URL (starts with http/https) or IndexedDB URL
  const isHttpUrl = receiptUrl.startsWith('http://') || receiptUrl.startsWith('https://');
  const isIndexedDbUrl = receiptUrl.startsWith('indexeddb:');

  // Only use imageData hook for IndexedDB URLs to avoid double-fetching
  const imageData = useImageData(isIndexedDbUrl ? receiptUrl : undefined);

  // For HTTP URLs, use directly; for IndexedDB URLs, use resolved data
  const resolvedUrl = isHttpUrl ? receiptUrl : (imageData?.url || receiptUrl);
  const isPdf = isHttpUrl
    ? receiptUrl.toLowerCase().includes('.pdf')
    : imageData?.mimeType === 'application/pdf';

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle mouse up globally to stop dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mouseleave', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return; // Don't handle wheel for PDFs

    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1; // Negative deltaY = scroll up = zoom in
    setZoom((prev) => {
      const newZoom = Math.max(0.5, Math.min(3, prev + delta));
      // Reset position when zooming out to 1x or below
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPdf || zoom <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isPdf) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = 'receipt';
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm px-6 py-4 rounded-t-xl">
          <h3 className="text-lg font-bold text-white">Receipt / Proof of Purchase</h3>
          <div className="flex items-center gap-3">
            {!isPdf && (
              <>
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-white text-sm font-medium min-w-[60px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-hidden bg-gray-900 rounded-b-xl flex items-center justify-center p-4"
          onWheel={handleWheel}
        >
          {isPdf ? (
            <iframe
              src={resolvedUrl}
              className="w-full h-full bg-white rounded"
              title="Receipt PDF"
            />
          ) : (
            <div
              className="relative w-full h-full flex items-center justify-center"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
              }}
            >
              <img
                src={resolvedUrl}
                alt="Receipt"
                className="max-w-full max-h-full select-none"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.2s',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
