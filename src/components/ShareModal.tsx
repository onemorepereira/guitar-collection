import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Share2,
  Link,
  Copy,
  Check,
  Loader2,
  Eye,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  Settings,
  BarChart3,
} from 'lucide-react';
import { Guitar, Share, SharedFields, GuitarImage } from '../types/guitar';
import { shareService } from '../services/shareService';

interface ShareModalProps {
  guitar: Guitar;
  onClose: () => void;
}

// Default shared fields configuration
const DEFAULT_SHARED_FIELDS: SharedFields = {
  brand: true,
  model: true,
  year: true,
  color: true,
  type: true,
  bodyMaterial: false,
  neckMaterial: false,
  fretboardMaterial: false,
  numberOfFrets: false,
  scaleLength: false,
  pickupConfiguration: false,
  finish: false,
  tuningMachines: false,
  bridge: false,
  nut: false,
  electronics: false,
  caseIncluded: false,
  countryOfOrigin: false,
  detailedSpecs: false,
  conditionReport: false,
  purchasePrice: false,
  purchaseDate: false,
  notes: false,
  provenance: false,
  documents: false,
};

// Field categories for organized display
const FIELD_CATEGORIES = {
  'Basic Info': ['brand', 'model', 'year', 'type', 'color'],
  'Specifications': [
    'bodyMaterial',
    'neckMaterial',
    'fretboardMaterial',
    'numberOfFrets',
    'scaleLength',
    'pickupConfiguration',
    'finish',
    'tuningMachines',
    'bridge',
    'nut',
    'electronics',
    'caseIncluded',
    'countryOfOrigin',
  ],
  'Detailed Specs': ['detailedSpecs', 'conditionReport'],
  'Private Info': ['purchasePrice', 'purchaseDate', 'notes', 'provenance', 'documents'],
};

// Human-readable field names
const FIELD_LABELS: Record<string, string> = {
  brand: 'Brand',
  model: 'Model',
  year: 'Year',
  type: 'Type',
  color: 'Color',
  bodyMaterial: 'Body Material',
  neckMaterial: 'Neck Material',
  fretboardMaterial: 'Fretboard Material',
  numberOfFrets: 'Number of Frets',
  scaleLength: 'Scale Length',
  pickupConfiguration: 'Pickup Configuration',
  finish: 'Finish',
  tuningMachines: 'Tuning Machines',
  bridge: 'Bridge',
  nut: 'Nut',
  electronics: 'Electronics',
  caseIncluded: 'Case Included',
  countryOfOrigin: 'Country of Origin',
  detailedSpecs: 'Detailed Specifications',
  conditionReport: 'Condition Report',
  purchasePrice: 'Purchase Price',
  purchaseDate: 'Purchase Date',
  notes: 'Notes',
  provenance: 'Provenance',
  documents: 'Documents',
};

export const ShareModal = ({ guitar, onClose }: ShareModalProps) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [loading, setLoading] = useState(false);
  const [existingShare, setExistingShare] = useState<Share | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [sharedFields, setSharedFields] = useState<SharedFields>(DEFAULT_SHARED_FIELDS);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    loadExistingShares();
    // Default to all images selected
    setSelectedImageIds(guitar.images.map((img) => img.id));
  }, [guitar.id]);

  const loadExistingShares = async () => {
    try {
      const allShares = await shareService.getShares();
      const guitarShares = allShares.filter((s) => s.guitarId === guitar.id);

      // Convert ShareListItem[] to Share[] (for display purposes)
      const fullShares: Share[] = [];
      for (const shareItem of guitarShares) {
        try {
          const fullShare = await shareService.getShare(shareItem.shareId);
          fullShares.push(fullShare);
        } catch (err) {
          console.error('Failed to load share details:', err);
        }
      }

      setShares(fullShares);

      // If there's an active share, load its settings
      const activeShare = fullShares.find((s) => s.isActive);
      if (activeShare) {
        setExistingShare(activeShare);
        setSharedFields(activeShare.sharedFields);
        setSelectedImageIds(activeShare.selectedImageIds);
        setActiveTab('manage');
      }
    } catch (err) {
      console.error('Failed to load shares:', err);
    }
  };

  const handleFieldToggle = (field: keyof SharedFields) => {
    setSharedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleImageToggle = (imageId: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleSelectAllImages = () => {
    setSelectedImageIds(guitar.images.map((img) => img.id));
  };

  const handleDeselectAllImages = () => {
    setSelectedImageIds([]);
  };

  const handleCreateShare = async () => {
    if (selectedImageIds.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const share = await shareService.createShare({
        guitarId: guitar.id,
        sharedFields,
        selectedImageIds,
      });
      setExistingShare(share);
      setShares((prev) => [share, ...prev]);
      setActiveTab('manage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShare = async () => {
    if (!existingShare) return;

    setLoading(true);
    setError(null);

    try {
      const updatedShare = await shareService.updateShare(existingShare.shareId, {
        sharedFields,
        selectedImageIds,
      });
      setExistingShare(updatedShare);
      setShares((prev) =>
        prev.map((s) => (s.shareId === updatedShare.shareId ? updatedShare : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update share');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to delete this share? The public link will stop working.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await shareService.deleteShare(shareId);
      setShares((prev) => prev.filter((s) => s.shareId !== shareId));
      if (existingShare?.shareId === shareId) {
        setExistingShare(null);
        setActiveTab('create');
        setSharedFields(DEFAULT_SHARED_FIELDS);
        setSelectedImageIds(guitar.images.map((img) => img.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete share');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (shareUrl: string) => {
    try {
      await shareService.copyShareUrl(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy link');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-primary-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Share Guitar</h2>
                <p className="text-sm text-gray-500">
                  {guitar.brand} {guitar.model} ({guitar.year})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Configure
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'manage'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline-block mr-2" />
              Shares ({shares.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Image Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Select Photos</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAllImages}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={handleDeselectAllImages}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {guitar.images.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => handleImageToggle(image.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIds.includes(image.id)
                          ? 'border-primary-600 ring-2 ring-primary-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={image.thumbnailUrl || image.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {selectedImageIds.includes(image.id) && (
                        <div className="absolute inset-0 bg-primary-600/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedImageIds.length} of {guitar.images.length} photos selected
                </p>
              </div>

              {/* Field Selection */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Information to Share</h3>
                <div className="space-y-4">
                  {Object.entries(FIELD_CATEGORIES).map(([category, fields]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {fields.map((field) => (
                          <label
                            key={field}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              sharedFields[field as keyof SharedFields]
                                ? 'border-primary-300 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={sharedFields[field as keyof SharedFields]}
                              onChange={() => handleFieldToggle(field as keyof SharedFields)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <span className="text-sm text-gray-700">
                              {FIELD_LABELS[field] || field}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-4">
              {shares.length === 0 ? (
                <div className="text-center py-12">
                  <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No shares yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Configure your share settings and create a public link
                  </p>
                </div>
              ) : (
                shares.map((share) => (
                  <div
                    key={share.shareId}
                    className={`p-4 border rounded-lg ${
                      share.isActive ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {share.isActive ? 'Active Share' : 'Inactive Share'}
                          </span>
                          {share.isActive && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              Live
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Created {formatDate(share.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteShare(share.shareId)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete share"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Share URL */}
                    <div className="bg-gray-100 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={share.shareUrl}
                          readOnly
                          className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 outline-none truncate"
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleCopyLink(share.shareUrl)}
                            className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                            title="Copy link"
                          >
                            {copied ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={share.shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{share.viewCount} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        <span>{share.selectedImageIds?.length || 0} photos</span>
                      </div>
                      {share.lastViewedAt && (
                        <div className="text-gray-400 text-xs sm:text-sm">
                          Last viewed {formatDate(share.lastViewedAt)}
                        </div>
                      )}
                    </div>

                    {/* Analytics Preview */}
                    {share.views && share.views.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Views</h4>
                        <div className="space-y-2">
                          {share.views.slice(-5).reverse().map((view, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 gap-0.5"
                            >
                              <span className="truncate">
                                {view.country || 'Unknown'} - {view.browser || 'Unknown browser'}
                              </span>
                              <span className="text-gray-400 flex-shrink-0">{formatDate(view.viewedAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
            {activeTab === 'create' && (
              <button
                onClick={existingShare ? handleUpdateShare : handleCreateShare}
                disabled={loading || selectedImageIds.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {existingShare ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    {existingShare ? 'Update Share' : 'Create Share'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
