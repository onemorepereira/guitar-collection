import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Guitar, Document, ProvenanceReportSummary } from '../types/guitar';
import { guitarService } from '../services/guitarService';
import { documentService } from '../services/documentService';
import { provenanceService } from '../services/provenanceService';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Info,
  Lock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText as FileCertificate,
  Sparkles,
  StickyNote,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ReceiptViewer } from './ReceiptViewer';
import { NotesJournal } from './NotesJournal';
import { FileText, Image as ImageIcon, Download, Tag } from 'lucide-react';
import { PickIcon } from './PickIcon';
import { ImageViewer } from './ImageViewer';
import { ShareModal } from './ShareModal';
import { Footer } from './Footer';
import { useImageUrls } from '../hooks/useImageUrl';
import { useAuth } from '../context/AuthContext';
import { NoteEntry } from '../types/guitar';
import { ConditionReport } from './condition';
import { ClipboardCheck } from 'lucide-react';

const getCurrencySymbol = (currencyCode?: string): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    CAD: 'C$',
    AUD: 'A$',
    MXN: 'MX$',
    BRL: 'R$',
  };
  return symbols[currencyCode || 'USD'] || currencyCode || '$';
};

export const GuitarDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guitar, setGuitar] = useState<Guitar | null>(null);
  const [linkedDocuments, setLinkedDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [provenanceReports, setProvenanceReports] = useState<ProvenanceReportSummary[]>([]);
  const [salesAds, setSalesAds] = useState<ProvenanceReportSummary[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingSalesAd, setGeneratingSalesAd] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Ref to track thumbnail buttons for scrolling into view
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Load image URLs from IndexedDB
  const imageUrls = useImageUrls(guitar?.images.map(img => img.url) || []);
  const thumbnailUrls = useImageUrls(guitar?.images.map(img => img.thumbnailUrl || img.url) || []);

  useEffect(() => {
    loadGuitar();
  }, [id]);

  // Scroll active thumbnail into view when currentImageIndex changes
  useEffect(() => {
    if (thumbnailRefs.current[currentImageIndex]) {
      thumbnailRefs.current[currentImageIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentImageIndex]);

  // Keyboard navigation for images
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!guitar || guitar.images.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextImage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [guitar, currentImageIndex]);

  const loadGuitar = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const data = await guitarService.getGuitar(id, user.id);
      // Sort images by order
      if (data) {
        data.images = [...data.images].sort((a, b) => a.order - b.order);
      }
      setGuitar(data);

      // Load linked documents
      if (data?.documentIds && data.documentIds.length > 0) {
        try {
          const allDocuments = await documentService.list();
          const linked = allDocuments.filter(doc => data.documentIds!.includes(doc.id));
          setLinkedDocuments(linked);
        } catch (docError) {
          console.error('Error loading linked documents:', docError);
          setLinkedDocuments([]);
        }
      } else {
        setLinkedDocuments([]);
      }

      // Load provenance reports and sales ads
      if (data?.id) {
        loadProvenanceReports(data.id);
        loadSalesAds(data.id);
      }
    } catch (error) {
      console.error('Error loading guitar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !user) return;
    try {
      await guitarService.deleteGuitar(id, user.id);
      navigate('/collection');
    } catch (error) {
      console.error('Error deleting guitar:', error);
    }
  };

  const nextImage = () => {
    if (!guitar) return;
    setCurrentImageIndex((prev) => (prev + 1) % guitar.images.length);
  };

  const prevImage = () => {
    if (!guitar) return;
    setCurrentImageIndex(
      (prev) => (prev - 1 + guitar.images.length) % guitar.images.length
    );
  };

  const loadProvenanceReports = async (guitarId: string) => {
    try {
      const reports = await provenanceService.listReports(guitarId, 'provenance');
      setProvenanceReports(reports);
    } catch (error) {
      console.error('Error loading provenance reports:', error);
      setProvenanceReports([]);
    }
  };

  const loadSalesAds = async (guitarId: string) => {
    try {
      const ads = await provenanceService.listReports(guitarId, 'sales_ad');
      setSalesAds(ads);
    } catch (error) {
      console.error('Error loading sales ads:', error);
      setSalesAds([]);
    }
  };

  const handleGenerateReport = async () => {
    if (!guitar?.id) return;

    try {
      setGeneratingReport(true);
      const result = await provenanceService.generateReport(guitar.id, 'provenance');
      // Reload reports after generation
      await loadProvenanceReports(guitar.id);
      // Navigate to the new report (encode reportId to handle # character)
      navigate(`/guitar/${encodeURIComponent(guitar.id)}/provenance/${encodeURIComponent(result.id)}`);
    } catch (error) {
      console.error('Error generating provenance report:', error);
      alert('Failed to generate provenance report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateSalesAd = async () => {
    if (!guitar?.id) return;

    try {
      setGeneratingSalesAd(true);
      const result = await provenanceService.generateReport(guitar.id, 'sales_ad');
      // Reload sales ads after generation
      await loadSalesAds(guitar.id);
      // Navigate to the new sales ad
      navigate(`/guitar/${encodeURIComponent(guitar.id)}/sales/${encodeURIComponent(result.id)}`);
    } catch (error) {
      console.error('Error generating sales ad:', error);
      alert('Failed to generate sales ad. Please try again.');
    } finally {
      setGeneratingSalesAd(false);
    }
  };

  const handleViewReport = (reportId: string) => {
    if (!guitar?.id) return;
    navigate(`/guitar/${encodeURIComponent(guitar.id)}/provenance/${encodeURIComponent(reportId)}`);
  };

  const handleViewSalesAd = (adId: string) => {
    if (!guitar?.id) return;
    navigate(`/guitar/${encodeURIComponent(guitar.id)}/sales/${encodeURIComponent(adId)}`);
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the view action
    if (!guitar?.id) return;

    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      await provenanceService.deleteReport(guitar.id, reportId);
      // Reload both lists to refresh
      await loadProvenanceReports(guitar.id);
      await loadSalesAds(guitar.id);
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!guitar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Guitar not found</h2>
          <button onClick={() => navigate('/collection')} className="btn-primary mt-4">
            Back to Collection
          </button>
        </div>
      </div>
    );
  }

  const currentImage = guitar.images[currentImageIndex];
  const currentImageUrl = imageUrls[currentImageIndex];
  const currentThumbnailUrls = thumbnailUrls;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/collection')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Return to guitar collection"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Collection</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                title="Share guitar"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate(`/edit/${guitar.id}`)}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                title="Edit guitar details"
              >
                <Edit className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Thumbnails - Top */}
            {guitar.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scroll-smooth">
                {guitar.images.map((img, idx) => {
                  const thumbUrl = currentThumbnailUrls[idx];
                  return (
                    <button
                      key={img.id}
                      ref={(el) => (thumbnailRefs.current[idx] = el)}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentImageIndex
                          ? 'border-primary-600 ring-2 ring-primary-200 dark:ring-primary-800'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      title={`View image ${idx + 1}`}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <PickIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" gColor="white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main Image - Bottom */}
            <div className="card overflow-hidden">
              <div className="relative min-h-96 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-4">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={`${guitar.brand} ${guitar.model}`}
                    className="max-w-full max-h-[600px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowImageViewer(true)}
                    title="Click to enlarge"
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center">
                    <PickIcon className="w-24 h-24 text-gray-400 dark:text-gray-500" gColor="white" />
                  </div>
                )}

                {guitar.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      title="Previous image (Left Arrow)"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      title="Next image (Right Arrow)"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-medium">
                    {currentImageIndex + 1} / {guitar.images.length}
                  </span>
                </div>
              </div>

              {currentImage?.caption && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{currentImage.caption}</p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {guitar.brand} {guitar.model}
                  </h1>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{guitar.year}</span>
                    {guitar.type && (
                      <>
                        <span className="text-gray-400 dark:text-gray-500">•</span>
                        <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                          {guitar.type}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Specifications</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SpecItem label="Body Material" value={guitar.bodyMaterial || 'Not specified'} />
                <SpecItem label="Neck Material" value={guitar.neckMaterial || 'Not specified'} />
                <SpecItem label="Fretboard" value={guitar.fretboardMaterial || 'Not specified'} />
                <SpecItem label="Frets" value={guitar.numberOfFrets?.toString() || 'Not specified'} />
                <SpecItem label="Scale Length" value={guitar.scaleLength || 'Not specified'} />
                <SpecItem label="Pickups" value={guitar.pickupConfiguration || 'Not specified'} />
                <SpecItem label="Color" value={guitar.color || 'Not specified'} />
                <SpecItem label="Finish" value={guitar.finish || 'Not specified'} />
                {guitar.tuningMachines && (
                  <SpecItem label="Tuning Machines" value={guitar.tuningMachines} span2 />
                )}
                {guitar.bridge && <SpecItem label="Bridge" value={guitar.bridge} span2 />}
                {guitar.nut && <SpecItem label="Nut" value={guitar.nut} />}
                {guitar.electronics && (
                  <SpecItem label="Electronics" value={guitar.electronics} span2 />
                )}
                {guitar.countryOfOrigin && (
                  <SpecItem label="Country of Origin" value={guitar.countryOfOrigin} />
                )}
                <SpecItem
                  label="Case Included"
                  value={guitar.caseIncluded ? 'Yes' : 'No'}
                />
              </div>
            </div>

            {/* Detailed Specifications */}
            {guitar.detailedSpecs && Object.values(guitar.detailedSpecs).some(v => v) && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Detailed Specifications</h2>
                </div>

                <div className="space-y-6">
                  {/* Body Details */}
                  {(guitar.detailedSpecs.bodyShape || guitar.detailedSpecs.bodyBinding ||
                    guitar.detailedSpecs.topWood || guitar.detailedSpecs.topCarve) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Body Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {guitar.detailedSpecs.bodyShape && (
                          <SpecItem label="Body Shape" value={guitar.detailedSpecs.bodyShape} />
                        )}
                        {guitar.detailedSpecs.bodyBinding && (
                          <SpecItem label="Body Binding" value={guitar.detailedSpecs.bodyBinding} />
                        )}
                        {guitar.detailedSpecs.topWood && (
                          <SpecItem label="Top Wood" value={guitar.detailedSpecs.topWood} />
                        )}
                        {guitar.detailedSpecs.topCarve && (
                          <SpecItem label="Top Carve" value={guitar.detailedSpecs.topCarve} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Neck Details */}
                  {(guitar.detailedSpecs.neckProfile || guitar.detailedSpecs.neckJoint ||
                    guitar.detailedSpecs.neckFinish || guitar.detailedSpecs.fretboardRadius ||
                    guitar.detailedSpecs.fretSize || guitar.detailedSpecs.fretboardInlays ||
                    guitar.detailedSpecs.nutWidth || guitar.detailedSpecs.nutMaterial ||
                    guitar.detailedSpecs.trussRod) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Neck Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {guitar.detailedSpecs.neckProfile && (
                          <SpecItem label="Neck Profile" value={guitar.detailedSpecs.neckProfile} />
                        )}
                        {guitar.detailedSpecs.neckJoint && (
                          <SpecItem label="Neck Joint" value={guitar.detailedSpecs.neckJoint} />
                        )}
                        {guitar.detailedSpecs.neckFinish && (
                          <SpecItem label="Neck Finish" value={guitar.detailedSpecs.neckFinish} />
                        )}
                        {guitar.detailedSpecs.fretboardRadius && (
                          <SpecItem label="Fretboard Radius" value={guitar.detailedSpecs.fretboardRadius} />
                        )}
                        {guitar.detailedSpecs.fretSize && (
                          <SpecItem label="Fret Size" value={guitar.detailedSpecs.fretSize} />
                        )}
                        {guitar.detailedSpecs.fretboardInlays && (
                          <SpecItem label="Fretboard Inlays" value={guitar.detailedSpecs.fretboardInlays} />
                        )}
                        {guitar.detailedSpecs.nutWidth && (
                          <SpecItem label="Nut Width" value={guitar.detailedSpecs.nutWidth} />
                        )}
                        {guitar.detailedSpecs.nutMaterial && (
                          <SpecItem label="Nut Material" value={guitar.detailedSpecs.nutMaterial} />
                        )}
                        {guitar.detailedSpecs.trussRod && (
                          <SpecItem label="Truss Rod" value={guitar.detailedSpecs.trussRod} span2 />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pickup Details */}
                  {(guitar.detailedSpecs.neckPickup || guitar.detailedSpecs.bridgePickup ||
                    guitar.detailedSpecs.pickupSelector || guitar.detailedSpecs.controls) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Pickup Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {guitar.detailedSpecs.neckPickup && (
                          <SpecItem label="Neck Pickup" value={guitar.detailedSpecs.neckPickup} />
                        )}
                        {guitar.detailedSpecs.bridgePickup && (
                          <SpecItem label="Bridge Pickup" value={guitar.detailedSpecs.bridgePickup} />
                        )}
                        {guitar.detailedSpecs.pickupSelector && (
                          <SpecItem label="Pickup Selector" value={guitar.detailedSpecs.pickupSelector} />
                        )}
                        {guitar.detailedSpecs.controls && (
                          <SpecItem label="Controls" value={guitar.detailedSpecs.controls} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hardware Details */}
                  {(guitar.detailedSpecs.hardwareFinish || guitar.detailedSpecs.tailpiece ||
                    guitar.detailedSpecs.pickguard || guitar.detailedSpecs.controlKnobs ||
                    guitar.detailedSpecs.strapButtons || guitar.detailedSpecs.stringTrees) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Hardware Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {guitar.detailedSpecs.hardwareFinish && (
                          <SpecItem label="Hardware Finish" value={guitar.detailedSpecs.hardwareFinish} />
                        )}
                        {guitar.detailedSpecs.tailpiece && (
                          <SpecItem label="Tailpiece" value={guitar.detailedSpecs.tailpiece} />
                        )}
                        {guitar.detailedSpecs.pickguard && (
                          <SpecItem label="Pickguard" value={guitar.detailedSpecs.pickguard} />
                        )}
                        {guitar.detailedSpecs.controlKnobs && (
                          <SpecItem label="Control Knobs" value={guitar.detailedSpecs.controlKnobs} />
                        )}
                        {guitar.detailedSpecs.strapButtons && (
                          <SpecItem label="Strap Buttons" value={guitar.detailedSpecs.strapButtons} />
                        )}
                        {guitar.detailedSpecs.stringTrees && (
                          <SpecItem label="String Trees" value={guitar.detailedSpecs.stringTrees} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Miscellaneous */}
                  {(guitar.detailedSpecs.stringGauge || guitar.detailedSpecs.headstock ||
                    guitar.detailedSpecs.weight) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Miscellaneous</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {guitar.detailedSpecs.stringGauge && (
                          <SpecItem label="String Gauge" value={guitar.detailedSpecs.stringGauge} />
                        )}
                        {guitar.detailedSpecs.headstock && (
                          <SpecItem label="Headstock" value={guitar.detailedSpecs.headstock} />
                        )}
                        {guitar.detailedSpecs.weight && (
                          <SpecItem label="Weight" value={guitar.detailedSpecs.weight} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Private Information */}
            {guitar.privateInfo && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Private Information</h2>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {guitar.privateInfo.serialNumber && (
                      <PrivateItem label="Serial Number" value={guitar.privateInfo.serialNumber} />
                    )}
                    {guitar.privateInfo.purchaseDate && (
                      <PrivateItem
                        label="Purchase Date"
                        value={format(new Date(guitar.privateInfo.purchaseDate), 'PPP')}
                      />
                    )}
                    {guitar.privateInfo.originalRetailPrice && (
                      <PrivateItem
                        label="Original Retail Price"
                        value={`${getCurrencySymbol(guitar.privateInfo.currency)}${guitar.privateInfo.originalRetailPrice.toLocaleString()}`}
                      />
                    )}
                    {guitar.privateInfo.purchasePrice && (
                      <PrivateItem
                        label="Purchase Price"
                        value={`${getCurrencySymbol(guitar.privateInfo.currency)}${guitar.privateInfo.purchasePrice.toLocaleString()}`}
                      />
                    )}
                    {guitar.privateInfo.purchaseLocation && (
                      <PrivateItem
                        label="Purchase Location"
                        value={guitar.privateInfo.purchaseLocation}
                      />
                    )}
                    {guitar.privateInfo.currentValue && (
                      <PrivateItem
                        label="Current Value"
                        value={`${getCurrencySymbol(guitar.privateInfo.currency)}${guitar.privateInfo.currentValue.toLocaleString()}`}
                      />
                    )}
                    {guitar.privateInfo.insuranceInfo && (
                      <PrivateItem
                        label="Insurance Info"
                        value={guitar.privateInfo.insuranceInfo}
                      />
                    )}
                    {guitar.privateInfo.receiptUrl && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Receipt:</span>
                        <button
                          onClick={() => setShowReceiptViewer(true)}
                          className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-right underline"
                          title="View receipt or proof of purchase"
                        >
                          View Receipt
                        </button>
                      </div>
                    )}
                  </div>
              </div>
            )}

            {/* Documentation */}
            {linkedDocuments.length > 0 && (
              <div className="card p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Documentation</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {linkedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          {doc.type === 'pdf' ? (
                            <FileText className="w-8 h-8 text-red-500 mb-2" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-blue-500 mb-2" />
                          )}
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {doc.type === 'image' && (
                        <img
                          src={doc.url}
                          alt={doc.name}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}

                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full btn-outline flex items-center justify-center gap-2 text-sm py-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {guitar.notes && guitar.notes.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <StickyNote className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notes</h2>
                </div>
                <NotesJournal
                  notes={guitar.notes}
                  onAddNote={() => {}}
                  onDeleteNote={() => {}}
                  readOnly={true}
                  maxInitialNotes={3}
                />
              </div>
            )}

            {/* Condition Report */}
            {guitar.conditionShape && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Condition Report</h2>
                </div>
                <ConditionReport
                  shape={guitar.conditionShape}
                  markers={guitar.conditionMarkers || []}
                />
              </div>
            )}

            {/* AI-Generated Documents */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI-Generated Documents</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate provenance certificate"
                  >
                    {generatingReport ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    ) : (
                      <FileCertificate className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-primary-600" />
                    )}
                  </button>
                  <button
                    onClick={handleGenerateSalesAd}
                    disabled={generatingSalesAd}
                    className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate sales listing"
                  >
                    {generatingSalesAd ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <Tag className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Provenance Reports Section */}
              {provenanceReports.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <FileCertificate className="w-4 h-4" />
                    Provenance Certificates
                  </h3>
                  <div className="space-y-2">
                    {provenanceReports.map((report) => (
                      <div
                        key={report.id}
                        className="relative group"
                      >
                        <button
                          onClick={() => handleViewReport(report.id)}
                          className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                  Version {report.version}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(report.generatedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>
                            <Eye className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
                          </div>
                        </button>
                        <button
                          onClick={(e) => handleDeleteReport(report.id, e)}
                          className="absolute right-2 top-2 p-1.5 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete report"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sales Ads Section */}
              {salesAds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Sales Listings
                  </h3>
                  <div className="space-y-2">
                    {salesAds.map((ad) => (
                      <div
                        key={ad.id}
                        className="relative group"
                      >
                        <button
                          onClick={() => handleViewSalesAd(ad.id)}
                          className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                  Version {ad.version}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(ad.generatedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>
                            <Eye className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
                          </div>
                        </button>
                        <button
                          onClick={(e) => handleDeleteReport(ad.id, e)}
                          className="absolute right-2 top-2 p-1.5 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete sales ad"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {provenanceReports.length === 0 && salesAds.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="mb-2 font-medium">No AI-generated documents yet</p>
                  <p className="text-sm max-w-md mx-auto">
                    Generate a formal provenance certificate or a compelling sales listing
                    using AI-powered content generation
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Guitar?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {guitar.brand} {guitar.model}? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary"
                title="Cancel deletion"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
                title="Confirm deletion"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer */}
      {showReceiptViewer && guitar?.privateInfo?.receiptUrl && (
        <ReceiptViewer
          receiptUrl={guitar.privateInfo.receiptUrl}
          onClose={() => setShowReceiptViewer(false)}
        />
      )}

      {/* Image Viewer */}
      {showImageViewer && currentImageUrl && (
        <ImageViewer
          imageUrl={currentImageUrl}
          alt={`${guitar.brand} ${guitar.model}`}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          guitar={guitar}
          onClose={() => setShowShareModal(false)}
        />
      )}

      <Footer />
    </div>
  );
};

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
    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">{label}</span>
    <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
  </div>
);

const PrivateItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-start">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}:</span>
    <span className="font-medium text-gray-900 dark:text-gray-100 text-right">{value}</span>
  </div>
);
