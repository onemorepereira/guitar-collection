import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Maximize2,
} from 'lucide-react';
import { PickIcon } from './PickIcon';
import { PublicShareData } from '../types/guitar';
import { shareService } from '../services/shareService';

export const SharedGuitarView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [shareData, setShareData] = useState<PublicShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (shareId) {
      loadShare();
    }
  }, [shareId]);

  const loadShare = async () => {
    if (!shareId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await shareService.getPublicShare(shareId);
      setShareData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared guitar');
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    if (!shareData) return;
    setCurrentImageIndex((prev) => (prev + 1) % shareData.images.length);
  };

  const prevImage = () => {
    if (!shareData) return;
    setCurrentImageIndex(
      (prev) => (prev - 1 + shareData.images.length) % shareData.images.length
    );
  };

  const openFullScreen = (index?: number) => {
    if (index !== undefined) {
      setCurrentImageIndex(index);
    }
    setIsFullScreen(true);
  };

  const closeFullScreen = () => {
    setIsFullScreen(false);
  };

  // Keyboard navigation for fullscreen
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isFullScreen || !shareData) return;

      switch (e.key) {
        case 'Escape':
          closeFullScreen();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
      }
    },
    [isFullScreen, shareData]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <PickIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" gColor="white" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'Share not found' ? 'Share Not Found' : 'Unable to Load'}
          </h2>
          <p className="text-gray-600">
            {error === 'Share not found'
              ? 'This shared guitar link is no longer available or has been removed.'
              : 'There was a problem loading this shared guitar. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  const { guitar, images, sharedFields } = shareData;
  const currentImage = images[currentImageIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PickIcon className="w-6 h-6 text-primary-600" gColor="white" />
              <span className="text-lg font-semibold text-gray-900">
                Shared from GuitarHelp
              </span>
            </div>
            <a
              href="https://guitarhelp.click"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <span>Learn more</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === currentImageIndex
                        ? 'border-primary-600 ring-2 ring-primary-200'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Image */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="relative min-h-96 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
                {currentImage ? (
                  <button
                    onClick={() => openFullScreen()}
                    className="cursor-zoom-in focus:outline-none"
                    title="Click to view full screen"
                  >
                    <img
                      src={currentImage.url}
                      alt={`${guitar.brand} ${guitar.model}`}
                      className="max-w-full max-h-[500px] object-contain"
                    />
                  </button>
                ) : (
                  <div className="w-full h-96 flex items-center justify-center">
                    <PickIcon className="w-24 h-24 text-gray-400" gColor="white" />
                  </div>
                )}

                {/* Fullscreen button */}
                {currentImage && (
                  <button
                    onClick={() => openFullScreen()}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    title="View full screen"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white text-sm font-medium">
                      {currentImageIndex + 1} / {images.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {sharedFields.brand && guitar.brand}{' '}
                {sharedFields.model && guitar.model}
              </h1>
              <div className="flex items-center gap-3 text-gray-600">
                {sharedFields.year && guitar.year && (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>{guitar.year}</span>
                  </>
                )}
                {sharedFields.type && guitar.type && (
                  <>
                    {sharedFields.year && <span className="text-gray-400">|</span>}
                    <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                      {guitar.type}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Specifications */}
            {hasVisibleSpecs(guitar, sharedFields) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-bold text-gray-900">Specifications</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {sharedFields.color && guitar.color && (
                    <SpecItem label="Color" value={guitar.color} />
                  )}
                  {sharedFields.bodyMaterial && guitar.bodyMaterial && (
                    <SpecItem label="Body Material" value={guitar.bodyMaterial} />
                  )}
                  {sharedFields.neckMaterial && guitar.neckMaterial && (
                    <SpecItem label="Neck Material" value={guitar.neckMaterial} />
                  )}
                  {sharedFields.fretboardMaterial && guitar.fretboardMaterial && (
                    <SpecItem label="Fretboard" value={guitar.fretboardMaterial} />
                  )}
                  {sharedFields.numberOfFrets && guitar.numberOfFrets && (
                    <SpecItem label="Frets" value={guitar.numberOfFrets.toString()} />
                  )}
                  {sharedFields.scaleLength && guitar.scaleLength && (
                    <SpecItem label="Scale Length" value={guitar.scaleLength} />
                  )}
                  {sharedFields.pickupConfiguration && guitar.pickupConfiguration && (
                    <SpecItem label="Pickups" value={guitar.pickupConfiguration} />
                  )}
                  {sharedFields.finish && guitar.finish && (
                    <SpecItem label="Finish" value={guitar.finish} />
                  )}
                  {sharedFields.tuningMachines && guitar.tuningMachines && (
                    <SpecItem label="Tuning Machines" value={guitar.tuningMachines} span2 />
                  )}
                  {sharedFields.bridge && guitar.bridge && (
                    <SpecItem label="Bridge" value={guitar.bridge} span2 />
                  )}
                  {sharedFields.nut && guitar.nut && (
                    <SpecItem label="Nut" value={guitar.nut} />
                  )}
                  {sharedFields.electronics && guitar.electronics && (
                    <SpecItem label="Electronics" value={guitar.electronics} span2 />
                  )}
                  {sharedFields.countryOfOrigin && guitar.countryOfOrigin && (
                    <SpecItem label="Country of Origin" value={guitar.countryOfOrigin} />
                  )}
                  {sharedFields.caseIncluded && guitar.caseIncluded !== undefined && (
                    <SpecItem label="Case Included" value={guitar.caseIncluded ? 'Yes' : 'No'} />
                  )}
                </div>
              </div>
            )}

            {/* Detailed Specifications */}
            {sharedFields.detailedSpecs && guitar.detailedSpecs && hasDetailedSpecs(guitar.detailedSpecs) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-bold text-gray-900">Detailed Specifications</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(guitar.detailedSpecs).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <SpecItem
                        key={key}
                        label={formatDetailedSpecLabel(key)}
                        value={value}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {sharedFields.notes && guitar.notes && Array.isArray(guitar.notes) && guitar.notes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
                <div className="space-y-3">
                  {guitar.notes.map((note: any, index: number) => (
                    <div key={note.id || index} className="text-gray-700">
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      {note.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Image Viewer */}
      {isFullScreen && currentImage && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={closeFullScreen}
        >
          {/* Close button */}
          <button
            onClick={closeFullScreen}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
            title="Close (Esc)"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                title="Previous (Left Arrow)"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                title="Next (Right Arrow)"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}

          {/* Main image */}
          <img
            src={currentImage.url}
            alt={`${guitar.brand} ${guitar.model}`}
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Thumbnail strip at bottom */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg max-w-[90vw] overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                    idx === currentImageIndex
                      ? 'border-white'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
            <PickIcon className="w-4 h-4" />
            <span>Shared with</span>
            <a
              href="https://guitarhelp.click"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              GuitarHelp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper to check if there are any visible specifications
function hasVisibleSpecs(guitar: PublicShareData['guitar'], sharedFields: PublicShareData['sharedFields']): boolean {
  return (
    (sharedFields.color && !!guitar.color) ||
    (sharedFields.bodyMaterial && !!guitar.bodyMaterial) ||
    (sharedFields.neckMaterial && !!guitar.neckMaterial) ||
    (sharedFields.fretboardMaterial && !!guitar.fretboardMaterial) ||
    (sharedFields.numberOfFrets && !!guitar.numberOfFrets) ||
    (sharedFields.scaleLength && !!guitar.scaleLength) ||
    (sharedFields.pickupConfiguration && !!guitar.pickupConfiguration) ||
    (sharedFields.finish && !!guitar.finish) ||
    (sharedFields.tuningMachines && !!guitar.tuningMachines) ||
    (sharedFields.bridge && !!guitar.bridge) ||
    (sharedFields.nut && !!guitar.nut) ||
    (sharedFields.electronics && !!guitar.electronics) ||
    (sharedFields.countryOfOrigin && !!guitar.countryOfOrigin) ||
    (sharedFields.caseIncluded && guitar.caseIncluded !== undefined)
  );
}

// Helper to check if there are detailed specs
function hasDetailedSpecs(detailedSpecs: any): boolean {
  return Object.values(detailedSpecs || {}).some((v) => v);
}

// Format detailed spec labels
function formatDetailedSpecLabel(key: string): string {
  const labels: Record<string, string> = {
    bodyShape: 'Body Shape',
    bodyBinding: 'Body Binding',
    topWood: 'Top Wood',
    topCarve: 'Top Carve',
    neckProfile: 'Neck Profile',
    neckJoint: 'Neck Joint',
    neckFinish: 'Neck Finish',
    fretboardRadius: 'Fretboard Radius',
    fretSize: 'Fret Size',
    fretboardInlays: 'Fretboard Inlays',
    nutWidth: 'Nut Width',
    nutMaterial: 'Nut Material',
    trussRod: 'Truss Rod',
    neckPickup: 'Neck Pickup',
    bridgePickup: 'Bridge Pickup',
    pickupSelector: 'Pickup Selector',
    controls: 'Controls',
    hardwareFinish: 'Hardware Finish',
    tailpiece: 'Tailpiece',
    pickguard: 'Pickguard',
    controlKnobs: 'Control Knobs',
    strapButtons: 'Strap Buttons',
    stringTrees: 'String Trees',
    stringGauge: 'String Gauge',
    headstock: 'Headstock',
    weight: 'Weight',
  };
  return labels[key] || key;
}

const SpecItem = ({
  label,
  value,
  span2 = false,
}: {
  label: string;
  value: string;
  span2?: boolean;
}) => (
  <div className={span2 ? 'col-span-2' : ''}>
    <span className="text-sm text-gray-500 block mb-1">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);
