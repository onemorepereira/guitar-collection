import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Guitar, GuitarType, GuitarImage, NoteEntry, GuitarDocument } from '../types/guitar';
import { guitarService } from '../services/guitarService';
import { ArrowLeft, Save, Loader2, X, Upload, ChevronDown, ChevronUp, Sparkles, Receipt, Trash2 } from 'lucide-react';
import { ImageStaging } from './ImageStaging';
import { StagedImage } from '../utils/imageUtils';
import { NotesJournal } from './NotesJournal';
import { Footer } from './Footer';
import { useImageUrls } from '../hooks/useImageUrl';
import { AutocompleteInput } from './AutocompleteInput';
import { GUITAR_SUGGESTIONS } from '../constants/guitarSuggestions';
import { useAuth } from '../context/AuthContext';
import { useGuitarSuggestions, getTypicalSpecs } from '../hooks/useGuitarSuggestions';
import { SpecsImporter } from './SpecsImporter';
import { ReceiptImporter } from './ReceiptImporter';
import { DocumentLinker } from './DocumentLinker';

export const GuitarForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

  // Form state
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [type, setType] = useState<GuitarType>(GuitarType.ELECTRIC);
  const [bodyMaterial, setBodyMaterial] = useState('');
  const [neckMaterial, setNeckMaterial] = useState('');
  const [fretboardMaterial, setFretboardMaterial] = useState('');
  const [numberOfFrets, setNumberOfFrets] = useState(22);
  const [scaleLength, setScaleLength] = useState('');
  const [pickupConfiguration, setPickupConfiguration] = useState('');
  const [color, setColor] = useState('');
  const [finish, setFinish] = useState('');
  const [tuningMachines, setTuningMachines] = useState('');
  const [bridge, setBridge] = useState('');
  const [nut, setNut] = useState('');
  const [electronics, setElectronics] = useState('');
  const [caseIncluded, setCaseIncluded] = useState(false);
  const [images, setImages] = useState<GuitarImage[]>([]);
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);

  // Private info
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [originalRetailPrice, setOriginalRetailPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseLocation, setPurchaseLocation] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [insuranceInfo, setInsuranceInfo] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [showSpecsImporter, setShowSpecsImporter] = useState(false);
  const [showReceiptImporter, setShowReceiptImporter] = useState(false);
  const [showAutoFillPrompt, setShowAutoFillPrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previousModel, setPreviousModel] = useState('');

  // Detailed specs
  const [showDetailedSpecs, setShowDetailedSpecs] = useState(false);
  const [bodyShape, setBodyShape] = useState('');
  const [bodyBinding, setBodyBinding] = useState('');
  const [topWood, setTopWood] = useState('');
  const [topCarve, setTopCarve] = useState('');
  const [neckProfile, setNeckProfile] = useState('');
  const [neckJoint, setNeckJoint] = useState('');
  const [neckFinish, setNeckFinish] = useState('');
  const [fretboardRadius, setFretboardRadius] = useState('');
  const [fretSize, setFretSize] = useState('');
  const [fretboardInlays, setFretboardInlays] = useState('');
  const [nutWidth, setNutWidth] = useState('');
  const [nutMaterial, setNutMaterial] = useState('');
  const [trussRod, setTrussRod] = useState('');
  const [neckPickup, setNeckPickup] = useState('');
  const [bridgePickup, setBridgePickup] = useState('');
  const [pickupSelector, setPickupSelector] = useState('');
  const [controls, setControls] = useState('');
  const [hardwareFinish, setHardwareFinish] = useState('');
  const [tailpiece, setTailpiece] = useState('');
  const [pickguard, setPickguard] = useState('');
  const [controlKnobs, setControlKnobs] = useState('');
  const [strapButtons, setStrapButtons] = useState('');
  const [stringTrees, setStringTrees] = useState('');
  const [stringGauge, setStringGauge] = useState('');
  const [headstock, setHeadstock] = useState('');
  const [weight, setWeight] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');

  // Load image URLs from IndexedDB for uploaded images
  const uploadedImageUrls = useImageUrls(images.map(img => img.thumbnailUrl || img.url));

  // Get contextual suggestions based on selected brand
  const suggestions = useGuitarSuggestions({ brand, type });

  // Validation warnings for unusual combinations
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];

    // Acoustic + Floyd Rose (very unusual)
    if (
      (type === GuitarType.ACOUSTIC || type === GuitarType.ELECTRIC_ACOUSTIC) &&
      bridge &&
      bridge.toLowerCase().includes('floyd')
    ) {
      warnings.push('Floyd Rose bridges are very uncommon on acoustic guitars. Are you building a custom hybrid?');
    }

    // Classical + Humbuckers (unusual)
    if (
      type === GuitarType.CLASSICAL &&
      pickupConfiguration &&
      (pickupConfiguration.includes('HH') || pickupConfiguration.includes('Humbucker'))
    ) {
      warnings.push('Humbuckers are uncommon on classical guitars. Most classical guitars don\'t have pickups.');
    }

    // Modern model + very old year
    const currentYear = new Date().getFullYear();
    if (model && year && year < 1900) {
      warnings.push(`Year ${year} seems unusually old. Please double-check the year.`);
    }

    // Future year
    if (year && year > currentYear + 1) {
      warnings.push(`Year ${year} is in the future. Did you mean ${currentYear}?`);
    }

    // Specific model year validation (example: Meteora was introduced in 2023)
    if (brand === 'Fender' && model.toLowerCase().includes('meteora') && year && year < 2023) {
      warnings.push('The Fender Meteora was introduced in 2023. Did you mean a different model?');
    }

    return warnings;
  }, [type, bridge, pickupConfiguration, model, year, brand]);

  useEffect(() => {
    if (isEditMode) {
      loadGuitar();
    }
  }, [id]);

  // Watch for model changes to trigger auto-fill prompt
  useEffect(() => {
    // Only show prompt if:
    // 1. Model has changed (not initial load or edit mode population)
    // 2. We have both brand and model selected
    // 3. We're not in edit mode (don't auto-fill when editing existing guitar)
    if (
      model &&
      brand &&
      model !== previousModel &&
      previousModel !== '' &&
      !isEditMode
    ) {
      const typicalSpecs = getTypicalSpecs(brand, model);
      if (typicalSpecs) {
        setShowAutoFillPrompt(true);
      }
    }
    setPreviousModel(model);
  }, [model, brand, previousModel, isEditMode]);

  const handleAutoFillSpecs = () => {
    const typicalSpecs = getTypicalSpecs(brand, model);
    if (typicalSpecs) {
      // Only fill in fields that are currently empty
      if (!scaleLength && typicalSpecs.scaleLength) {
        setScaleLength(typicalSpecs.scaleLength);
      }
      if (!pickupConfiguration && typicalSpecs.pickupConfiguration) {
        setPickupConfiguration(typicalSpecs.pickupConfiguration);
      }
      if (!bodyMaterial && typicalSpecs.bodyMaterial) {
        setBodyMaterial(typicalSpecs.bodyMaterial);
      }
      if (!neckMaterial && typicalSpecs.neckMaterial) {
        setNeckMaterial(typicalSpecs.neckMaterial);
      }
      if (!fretboardMaterial && typicalSpecs.fretboardMaterial) {
        setFretboardMaterial(typicalSpecs.fretboardMaterial);
      }
      if (numberOfFrets === 22 && typicalSpecs.numberOfFrets) {
        setNumberOfFrets(typicalSpecs.numberOfFrets);
      }
    }
    setShowAutoFillPrompt(false);
  };

  const loadGuitar = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const guitar = await guitarService.getGuitar(id, user.id);
      if (guitar) {
        populateForm(guitar);
      }
    } catch (error) {
      console.error('Error loading guitar:', error);
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (guitar: Guitar) => {
    setBrand(guitar.brand);
    setModel(guitar.model);
    setYear(guitar.year);
    setType(guitar.type || GuitarType.ELECTRIC);
    setBodyMaterial(guitar.bodyMaterial || '');
    setNeckMaterial(guitar.neckMaterial || '');
    setFretboardMaterial(guitar.fretboardMaterial || '');
    setNumberOfFrets(guitar.numberOfFrets || 22);
    setScaleLength(guitar.scaleLength || '');
    setPickupConfiguration(guitar.pickupConfiguration || '');
    setColor(guitar.color || '');
    setFinish(guitar.finish || '');
    setTuningMachines(guitar.tuningMachines || '');
    setBridge(guitar.bridge || '');
    setNut(guitar.nut || '');
    setElectronics(guitar.electronics || '');
    setCaseIncluded(guitar.caseIncluded || false);
    setCountryOfOrigin(guitar.countryOfOrigin || '');
    setImages(guitar.images);
    setNotes(guitar.notes || []);
    setDocumentIds(guitar.documentIds || []);

    if (guitar.privateInfo) {
      setSerialNumber(guitar.privateInfo.serialNumber || '');
      setPurchaseDate(guitar.privateInfo.purchaseDate || '');
      setOriginalRetailPrice(guitar.privateInfo.originalRetailPrice?.toString() || '');
      setPurchasePrice(guitar.privateInfo.purchasePrice?.toString() || '');
      setPurchaseLocation(guitar.privateInfo.purchaseLocation || '');
      setCurrentValue(guitar.privateInfo.currentValue?.toString() || '');
      setCurrency(guitar.privateInfo.currency || 'USD');
      setInsuranceInfo(guitar.privateInfo.insuranceInfo || '');
      setReceiptUrl(guitar.privateInfo.receiptUrl || '');
    }

    if (guitar.detailedSpecs) {
      const specs = guitar.detailedSpecs;
      setBodyShape(specs.bodyShape || '');
      setBodyBinding(specs.bodyBinding || '');
      setTopWood(specs.topWood || '');
      setTopCarve(specs.topCarve || '');
      setNeckProfile(specs.neckProfile || '');
      setNeckJoint(specs.neckJoint || '');
      setNeckFinish(specs.neckFinish || '');
      setFretboardRadius(specs.fretboardRadius || '');
      setFretSize(specs.fretSize || '');
      setFretboardInlays(specs.fretboardInlays || '');
      setNutWidth(specs.nutWidth || '');
      setNutMaterial(specs.nutMaterial || '');
      setTrussRod(specs.trussRod || '');
      setNeckPickup(specs.neckPickup || '');
      setBridgePickup(specs.bridgePickup || '');
      setPickupSelector(specs.pickupSelector || '');
      setControls(specs.controls || '');
      setHardwareFinish(specs.hardwareFinish || '');
      setTailpiece(specs.tailpiece || '');
      setPickguard(specs.pickguard || '');
      setControlKnobs(specs.controlKnobs || '');
      setStrapButtons(specs.strapButtons || '');
      setStringTrees(specs.stringTrees || '');
      setStringGauge(specs.stringGauge || '');
      setHeadstock(specs.headstock || '');
      setWeight(specs.weight || '');

      // If any detailed spec is filled, show the section
      if (Object.values(specs).some(v => v)) {
        setShowDetailedSpecs(true);
      }
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDFs)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload an image (JPG, PNG, GIF) or PDF file');
      return;
    }

    // Validate file size (max 30MB)
    if (file.size > 30 * 1024 * 1024) {
      alert('File must be smaller than 30MB');
      return;
    }

    setReceiptFile(file);
    setUploadingReceipt(true);
    try {
      const url = await guitarService.uploadImage(file);
      setReceiptUrl(url);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Failed to upload receipt. Please try again.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const removeReceipt = () => {
    setReceiptUrl('');
    setReceiptFile(null);
  };

  const handleUploadStaged = async () => {
    if (stagedImages.length === 0) return;

    setUploadingImages(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);

    try {
      const newImages: GuitarImage[] = [];

      for (let i = 0; i < stagedImages.length; i++) {
        const staged = stagedImages[i];
        setCurrentUploadIndex(i);
        setUploadProgress(0);

        // The file is already processed when saved from the editor
        // So we just upload it directly with progress tracking
        const url = await guitarService.uploadImage(staged.file, (progress) => {
          setUploadProgress(progress);
        });

        newImages.push({
          id: `img-${Date.now()}-${i}`,
          url,
          thumbnailUrl: url,
          isPrimary: images.length === 0 && i === 0,
          order: images.length + i,
        });
      }

      setImages([...images, ...newImages]);

      // Clear staged images and revoke URLs
      stagedImages.forEach(img => URL.revokeObjectURL(img.preview));
      setStagedImages([]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload some images. Please try again.');
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
      setCurrentUploadIndex(0);
    }
  };

  const removeUploadedImage = (imageId: string) => {
    setImages(images.filter((img) => img.id !== imageId));
  };

  const setPrimaryImage = (imageId: string) => {
    setImages(
      images.map((img) => ({
        ...img,
        isPrimary: img.id === imageId,
      }))
    );
  };

  const reorderImages = (fromIndex: number, toIndex: number) => {
    const reordered = [...images];
    const [movedImage] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedImage);

    // Update order property for all images
    const updatedImages = reordered.map((img, idx) => ({
      ...img,
      order: idx,
    }));

    setImages(updatedImages);
  };

  const handleAddNote = (content: string) => {
    const newNote: NoteEntry = {
      id: `note-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
    };
    setNotes([...notes, newNote]);
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter((note) => note.id !== noteId));
  };

  const handleApplyExtractedSpecs = (extractedFields: any[]) => {
    // Field mapping from API response to state setters
    const fieldSetters: Record<string, (value: any) => void> = {
      brand: setBrand,
      model: setModel,
      year: (val) => setYear(Number(val)),
      type: setType,
      bodyMaterial: setBodyMaterial,
      neckMaterial: setNeckMaterial,
      fretboardMaterial: setFretboardMaterial,
      numberOfFrets: (val) => setNumberOfFrets(Number(val)),
      scaleLength: setScaleLength,
      pickupConfiguration: setPickupConfiguration,
      color: setColor,
      finish: setFinish,
      tuningMachines: setTuningMachines,
      bridge: setBridge,
      nut: setNut,
      electronics: setElectronics,
      caseIncluded: (val) => setCaseIncluded(Boolean(val)),
      countryOfOrigin: setCountryOfOrigin,
      // Detailed specs
      bodyShape: setBodyShape,
      bodyBinding: setBodyBinding,
      topWood: setTopWood,
      topCarve: setTopCarve,
      neckProfile: setNeckProfile,
      neckJoint: setNeckJoint,
      neckFinish: setNeckFinish,
      fretboardRadius: setFretboardRadius,
      fretSize: setFretSize,
      fretboardInlays: setFretboardInlays,
      nutWidth: setNutWidth,
      nutMaterial: setNutMaterial,
      trussRod: setTrussRod,
      neckPickup: setNeckPickup,
      bridgePickup: setBridgePickup,
      pickupSelector: setPickupSelector,
      controls: setControls,
      hardwareFinish: setHardwareFinish,
      tailpiece: setTailpiece,
      pickguard: setPickguard,
      controlKnobs: setControlKnobs,
      strapButtons: setStrapButtons,
      stringTrees: setStringTrees,
      stringGauge: setStringGauge,
      headstock: setHeadstock,
      weight: setWeight,
    };

    // Apply each extracted field
    extractedFields.forEach((field) => {
      const setter = fieldSetters[field.field];
      if (setter) {
        setter(field.value);
      }
    });

    // Auto-expand detailed specs if any were populated
    const detailedFields = extractedFields.filter(f => f.category === 'detailed');
    if (detailedFields.length > 0) {
      setShowDetailedSpecs(true);
    }
  };

  const handleApplyReceipt = (receiptData: {
    purchasePrice: number;
    purchaseDate: string;
    purchaseLocation: string;
    serialNumber?: string;
    notesAddition?: string;
  }) => {
    // Apply receipt data to private info
    setPurchasePrice(receiptData.purchasePrice.toString());
    setPurchaseDate(receiptData.purchaseDate);
    setPurchaseLocation(receiptData.purchaseLocation);

    if (receiptData.serialNumber) {
      setSerialNumber(receiptData.serialNumber);
    }

    // Add receipt details to notes if provided
    if (receiptData.notesAddition) {
      const timestamp = new Date().toISOString();
      const newNote: NoteEntry = {
        id: `note-${Date.now()}`,
        content: receiptData.notesAddition,
        createdAt: timestamp,
      };
      setNotes(prevNotes => [newNote, ...prevNotes]);
    }

    // Close the modal
    setShowReceiptImporter(false);
  };

  const getCurrentFormValues = () => {
    return {
      brand,
      model,
      year,
      type,
      bodyMaterial,
      neckMaterial,
      fretboardMaterial,
      numberOfFrets,
      scaleLength,
      pickupConfiguration,
      color,
      finish,
      tuningMachines,
      bridge,
      nut,
      electronics,
      caseIncluded,
      countryOfOrigin,
      bodyShape,
      bodyBinding,
      topWood,
      topCarve,
      neckProfile,
      neckJoint,
      neckFinish,
      fretboardRadius,
      fretSize,
      fretboardInlays,
      nutWidth,
      nutMaterial,
      trussRod,
      neckPickup,
      bridgePickup,
      pickupSelector,
      controls,
      hardwareFinish,
      tailpiece,
      pickguard,
      controlKnobs,
      strapButtons,
      stringTrees,
      stringGauge,
      headstock,
      weight,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!brand || !model || !year) {
      alert('Please fill in all required fields (Brand, Model, Year)');
      return;
    }

    setSaving(true);
    try {
      // Auto-upload staged images if there are any
      if (stagedImages.length > 0) {
        setUploadingImages(true);
        try {
          const newImages: GuitarImage[] = [];

          for (let i = 0; i < stagedImages.length; i++) {
            const staged = stagedImages[i];
            const url = await guitarService.uploadImage(staged.file);

            newImages.push({
              id: `img-${Date.now()}-${i}`,
              url,
              thumbnailUrl: url,
              isPrimary: images.length === 0 && i === 0,
              order: images.length + i,
            });
          }

          // Merge uploaded images with existing ones
          const allImages = [...images, ...newImages];
          setImages(allImages);

          // Clear staged images
          stagedImages.forEach(img => URL.revokeObjectURL(img.preview));
          setStagedImages([]);

          // Continue with saving the guitar with all images
          await saveGuitar(allImages);
        } catch (error) {
          console.error('Error uploading images:', error);
          alert('Failed to upload some images. Please try again.');
          return;
        } finally {
          setUploadingImages(false);
        }
      } else {
        // No staged images, just save directly
        await saveGuitar(images);
      }
    } catch (error) {
      console.error('Error saving guitar:', error);
      alert('Error saving guitar. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveGuitar = async (finalImages: GuitarImage[]) => {
    if (!user) {
      alert('You must be logged in to save a guitar');
      return;
    }

    const guitarData = {
      brand,
      model,
      year,
      type,
      bodyMaterial,
      neckMaterial,
      fretboardMaterial,
      numberOfFrets,
      scaleLength,
      pickupConfiguration,
      color,
      finish,
      tuningMachines: tuningMachines || undefined,
      bridge: bridge || undefined,
      nut: nut || undefined,
      electronics: electronics || undefined,
      caseIncluded,
      countryOfOrigin: countryOfOrigin || undefined,
      images: finalImages,
      documentIds: documentIds.length > 0 ? documentIds : undefined,
      notes,
      privateInfo: {
        serialNumber: serialNumber || undefined,
        purchaseDate: purchaseDate || undefined,
        originalRetailPrice: originalRetailPrice ? parseFloat(originalRetailPrice) : undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseLocation: purchaseLocation || undefined,
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        currency: currency || 'USD',
        receiptUrl: receiptUrl || undefined,
        insuranceInfo: insuranceInfo || undefined,
      },
      detailedSpecs: {
        bodyShape: bodyShape || undefined,
        bodyBinding: bodyBinding || undefined,
        topWood: topWood || undefined,
        topCarve: topCarve || undefined,
        neckProfile: neckProfile || undefined,
        neckJoint: neckJoint || undefined,
        neckFinish: neckFinish || undefined,
        fretboardRadius: fretboardRadius || undefined,
        fretSize: fretSize || undefined,
        fretboardInlays: fretboardInlays || undefined,
        nutWidth: nutWidth || undefined,
        nutMaterial: nutMaterial || undefined,
        trussRod: trussRod || undefined,
        neckPickup: neckPickup || undefined,
        bridgePickup: bridgePickup || undefined,
        pickupSelector: pickupSelector || undefined,
        controls: controls || undefined,
        hardwareFinish: hardwareFinish || undefined,
        tailpiece: tailpiece || undefined,
        pickguard: pickguard || undefined,
        controlKnobs: controlKnobs || undefined,
        strapButtons: strapButtons || undefined,
        stringTrees: stringTrees || undefined,
        stringGauge: stringGauge || undefined,
        headstock: headstock || undefined,
        weight: weight || undefined,
      },
    };

    if (isEditMode && id) {
      await guitarService.updateGuitar(id, guitarData, user.id);
      navigate(`/guitar/${id}`);
    } else {
      const newGuitar = await guitarService.createGuitar(guitarData);
      navigate(`/guitar/${newGuitar.id}`);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await guitarService.deleteGuitar(id);
      navigate('/collection');
    } catch (error) {
      console.error('Error deleting guitar:', error);
      alert('Failed to delete guitar. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Mobile: Stack vertically */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start">
              <button
                onClick={() => navigate(isEditMode ? `/guitar/${id}` : '/')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Cancel and return"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Cancel</span>
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              title={isEditMode ? 'Save changes' : 'Add guitar to collection'}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Auto-fill Prompt Toast */}
          {showAutoFillPrompt && (
            <div className="card p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-600 rounded-lg flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Auto-fill typical specs for {brand} {model}?
                    </h4>
                    <p className="text-sm text-gray-600 mt-0.5">
                      We can fill in common specifications based on this model
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoFillSpecs}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                    title="Auto-fill common specifications for this guitar model"
                  >
                    Yes, auto-fill
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAutoFillPrompt(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm whitespace-nowrap"
                    title="Dismiss auto-fill suggestion"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="card p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 shadow-md">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Heads up!</h4>
                  <ul className="space-y-1">
                    {validationWarnings.map((warning: string, index: number) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import Specs Button */}
          <div className="card p-4 sm:p-6 bg-gradient-to-r from-primary-50 to-purple-50 border-2 border-primary-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary-600 rounded-xl flex-shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Auto-Import Specifications</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Upload a PDF or paste text from manufacturer specs to automatically fill out the form
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecsImporter(true)}
                className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
                title="Import specifications from PDF or text using AI"
              >
                <Sparkles className="w-4 h-4" />
                Import Specs
              </button>
            </div>
          </div>

          {/* Images */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Images</h2>

            {/* Image Staging Area */}
            <ImageStaging
              images={stagedImages}
              onImagesChange={setStagedImages}
              onUpload={handleUploadStaged}
              uploading={uploadingImages}
              uploadProgress={uploadProgress}
              currentUploadIndex={currentUploadIndex}
            />

            {/* Uploaded Images */}
            {images.length > 0 && (
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Uploaded Images ({images.length})
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (Drag to reorder)
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, idx) => {
                    const imgUrl = uploadedImageUrls[idx];
                    return (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={() => setDraggedImageIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedImageIndex !== null && draggedImageIndex !== idx) {
                            reorderImages(draggedImageIndex, idx);
                          }
                          setDraggedImageIndex(null);
                        }}
                        onDragEnd={() => setDraggedImageIndex(null)}
                        className={`relative group cursor-move ${
                          draggedImageIndex === idx ? 'opacity-50' : ''
                        }`}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt=""
                            className={`w-full h-32 object-cover rounded-lg ${
                              img.isPrimary ? 'ring-4 ring-primary-500' : ''
                            }`}
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeUploadedImage(img.id)}
                          className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(img.id)}
                            className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Set as main image"
                          >
                            Set Primary
                          </button>
                        )}
                        {img.isPrimary && (
                          <span className="absolute bottom-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Brand <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                  value={brand}
                  onChange={setBrand}
                  suggestions={suggestions.brands}
                  className="input-field"
                  required
                  trackRecent={true}
                  recentKey="recent-guitar-brands"
                />
              </div>

              <div>
                <label className="label">
                  Model <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                  value={model}
                  onChange={setModel}
                  suggestions={suggestions.models}
                  placeholder={brand ? `Select a ${brand} model` : 'Select a model'}
                  className="input-field"
                  required
                  trackRecent={true}
                  recentKey="recent-guitar-models"
                />
              </div>

              <div>
                <label className="label">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as GuitarType)} className="input-field">
                  {Object.values(GuitarType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Color</label>
                <AutocompleteInput
                  value={color}
                  onChange={setColor}
                  suggestions={suggestions.colors}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Finish</label>
                <AutocompleteInput
                  value={finish}
                  onChange={setFinish}
                  suggestions={suggestions.finishes}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Specifications</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Body Material</label>
                <AutocompleteInput
                  value={bodyMaterial}
                  onChange={setBodyMaterial}
                  suggestions={suggestions.bodyMaterials}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Neck Material</label>
                <AutocompleteInput
                  value={neckMaterial}
                  onChange={setNeckMaterial}
                  suggestions={suggestions.neckMaterials}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Fretboard Material</label>
                <AutocompleteInput
                  value={fretboardMaterial}
                  onChange={setFretboardMaterial}
                  suggestions={suggestions.fretboardMaterials}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Number of Frets</label>
                <input
                  type="number"
                  value={numberOfFrets}
                  onChange={(e) => setNumberOfFrets(parseInt(e.target.value))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Scale Length</label>
                <input
                  type="text"
                  value={scaleLength}
                  onChange={(e) => setScaleLength(e.target.value)}
                  placeholder='e.g., 25.5"'
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Pickup Configuration</label>
                <AutocompleteInput
                  value={pickupConfiguration}
                  onChange={setPickupConfiguration}
                  suggestions={suggestions.pickupConfigurations}
                  placeholder="e.g., SSS, HH, HSS"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Tuning Machines</label>
                <AutocompleteInput
                  value={tuningMachines}
                  onChange={setTuningMachines}
                  suggestions={suggestions.tuningMachines}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Bridge</label>
                <AutocompleteInput
                  value={bridge}
                  onChange={setBridge}
                  suggestions={suggestions.bridges}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Nut</label>
                <AutocompleteInput
                  value={nut}
                  onChange={setNut}
                  suggestions={suggestions.nuts}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Electronics</label>
                <input
                  type="text"
                  value={electronics}
                  onChange={(e) => setElectronics(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Country of Origin</label>
                <AutocompleteInput
                  value={countryOfOrigin}
                  onChange={setCountryOfOrigin}
                  suggestions={suggestions.countriesOfOrigin}
                  placeholder="e.g., USA, Japan, Mexico"
                  className="input-field"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="caseIncluded"
                  checked={caseIncluded}
                  onChange={(e) => setCaseIncluded(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="caseIncluded" className="text-sm font-medium text-gray-700">
                  Case Included
                </label>
              </div>
            </div>
          </div>

          {/* Detailed Specifications */}
          <div className="card p-6">
            <button
              type="button"
              onClick={() => setShowDetailedSpecs(!showDetailedSpecs)}
              className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
              title={showDetailedSpecs ? "Hide detailed specifications" : "Show detailed specifications"}
            >
              <div>
                <h2 className="text-xl font-bold text-gray-900 text-left">Detailed Specifications</h2>
                <p className="text-sm text-gray-600 text-left mt-1">
                  Optional advanced specifications for enthusiasts
                </p>
              </div>
              {showDetailedSpecs ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {showDetailedSpecs && (
              <div className="space-y-6 pt-4 border-t border-gray-200">
                {/* Body Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Body Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Body Shape</label>
                      <AutocompleteInput
                        value={bodyShape}
                        onChange={setBodyShape}
                        suggestions={suggestions.bodyShapes}
                        placeholder="e.g., Double Cutaway, Single Cutaway"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Body Binding</label>
                      <input
                        type="text"
                        value={bodyBinding}
                        onChange={(e) => setBodyBinding(e.target.value)}
                        placeholder="e.g., Cream, Abalone"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Top Wood</label>
                      <input
                        type="text"
                        value={topWood}
                        onChange={(e) => setTopWood(e.target.value)}
                        placeholder="e.g., Figured Maple, Quilted Maple"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Top Carve</label>
                      <input
                        type="text"
                        value={topCarve}
                        onChange={(e) => setTopCarve(e.target.value)}
                        placeholder="e.g., 10-Top, AAA"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Neck Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Neck Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Neck Profile</label>
                      <AutocompleteInput
                        value={neckProfile}
                        onChange={setNeckProfile}
                        suggestions={suggestions.neckProfiles}
                        placeholder="e.g., Pattern Thin, C-Shape"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Neck Joint</label>
                      <AutocompleteInput
                        value={neckJoint}
                        onChange={setNeckJoint}
                        suggestions={suggestions.neckJoints}
                        placeholder="e.g., Set-Neck, Bolt-On"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Neck Finish</label>
                      <AutocompleteInput
                        value={neckFinish}
                        onChange={setNeckFinish}
                        suggestions={suggestions.neckFinishes}
                        placeholder="e.g., Nitrocellulose, Satin"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Fretboard Radius</label>
                      <input
                        type="text"
                        value={fretboardRadius}
                        onChange={(e) => setFretboardRadius(e.target.value)}
                        placeholder='e.g., 10", 12"'
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Fret Size</label>
                      <AutocompleteInput
                        value={fretSize}
                        onChange={setFretSize}
                        suggestions={suggestions.fretSizes}
                        placeholder="e.g., Medium, Jumbo"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Fretboard Inlays</label>
                      <AutocompleteInput
                        value={fretboardInlays}
                        onChange={setFretboardInlays}
                        suggestions={suggestions.fretboardInlays}
                        placeholder="e.g., Birds, Dots"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Nut Width</label>
                      <input
                        type="text"
                        value={nutWidth}
                        onChange={(e) => setNutWidth(e.target.value)}
                        placeholder='e.g., 1.6875", 1.65"'
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Nut Material</label>
                      <input
                        type="text"
                        value={nutMaterial}
                        onChange={(e) => setNutMaterial(e.target.value)}
                        placeholder="e.g., Bone, Tusq"
                        className="input-field"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Truss Rod</label>
                      <input
                        type="text"
                        value={trussRod}
                        onChange={(e) => setTrussRod(e.target.value)}
                        placeholder="e.g., Dual-Action, Single-Action"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Pickup Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Pickup Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Neck Pickup</label>
                      <input
                        type="text"
                        value={neckPickup}
                        onChange={(e) => setNeckPickup(e.target.value)}
                        placeholder="e.g., 58/15 LT, '59"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Bridge Pickup</label>
                      <input
                        type="text"
                        value={bridgePickup}
                        onChange={(e) => setBridgePickup(e.target.value)}
                        placeholder="e.g., 58/15 LT, JB"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Pickup Selector</label>
                      <input
                        type="text"
                        value={pickupSelector}
                        onChange={(e) => setPickupSelector(e.target.value)}
                        placeholder="e.g., 3-Way Toggle, 5-Way Blade"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Controls</label>
                      <input
                        type="text"
                        value={controls}
                        onChange={(e) => setControls(e.target.value)}
                        placeholder="e.g., 2 Volume, 1 Tone"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Hardware Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Hardware Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Hardware Finish</label>
                      <AutocompleteInput
                        value={hardwareFinish}
                        onChange={setHardwareFinish}
                        suggestions={suggestions.hardwareFinishes}
                        placeholder="e.g., Nickel, Chrome, Gold"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Tailpiece</label>
                      <input
                        type="text"
                        value={tailpiece}
                        onChange={(e) => setTailpiece(e.target.value)}
                        placeholder="e.g., Stop-Tail, Tremolo"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Pickguard</label>
                      <AutocompleteInput
                        value={pickguard}
                        onChange={setPickguard}
                        suggestions={suggestions.pickguards}
                        placeholder="e.g., Tortoise Shell, Black"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Control Knobs</label>
                      <input
                        type="text"
                        value={controlKnobs}
                        onChange={(e) => setControlKnobs(e.target.value)}
                        placeholder="e.g., Top Hat, Speed Knobs"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Strap Buttons</label>
                      <input
                        type="text"
                        value={strapButtons}
                        onChange={(e) => setStrapButtons(e.target.value)}
                        placeholder="e.g., Standard, Schaller"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">String Trees</label>
                      <input
                        type="text"
                        value={stringTrees}
                        onChange={(e) => setStringTrees(e.target.value)}
                        placeholder="e.g., Staggered, Butterfly"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Miscellaneous */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Miscellaneous</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">String Gauge</label>
                      <AutocompleteInput
                        value={stringGauge}
                        onChange={setStringGauge}
                        suggestions={suggestions.stringGauges}
                        placeholder="e.g., .010-.046, .011-.049"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Headstock</label>
                      <input
                        type="text"
                        value={headstock}
                        onChange={(e) => setHeadstock(e.target.value)}
                        placeholder="e.g., 3+3, 6-in-line"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Weight</label>
                      <input
                        type="text"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g., 7.5 lbs, 3.4 kg"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Private Information */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Private Information</h2>
                <p className="text-sm text-gray-600 mt-1">
                  This information is stored locally and kept private.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptImporter(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                title="Extract purchase information from receipt using AI"
              >
                <Receipt className="w-4 h-4" />
                Import Receipt
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Serial Number</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input-field"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CNY">CNY - Chinese Yuan</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="MXN">MXN - Mexican Peso</option>
                  <option value="BRL">BRL - Brazilian Real</option>
                </select>
              </div>

              <div>
                <label className="label">Purchase Location</label>
                <input
                  type="text"
                  value={purchaseLocation}
                  onChange={(e) => setPurchaseLocation(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Original Retail Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={originalRetailPrice}
                  onChange={(e) => setOriginalRetailPrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Current Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Insurance Info</label>
                <input
                  type="text"
                  value={insuranceInfo}
                  onChange={(e) => setInsuranceInfo(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Receipt / Proof of Purchase</label>
                {receiptUrl ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      title="View uploaded receipt"
                    >
                      <Upload className="w-4 h-4" />
                      {receiptFile?.name || 'View Receipt'}
                    </a>
                    <button
                      type="button"
                      onClick={removeReceipt}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="Remove receipt"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="btn-outline cursor-pointer inline-flex items-center gap-2" title="Upload receipt or proof of purchase">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptUpload}
                      disabled={uploadingReceipt}
                      className="hidden"
                    />
                    {uploadingReceipt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Receipt
                      </>
                    )}
                  </label>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Upload an image or PDF of your receipt
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
            <p className="text-sm text-gray-600 mb-4">
              Keep notes about your guitar's history, modifications, maintenance, and memories.
            </p>
            <NotesJournal
              notes={notes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>

          {/* Documentation */}
          <div className="card p-6">
            <DocumentLinker
              linkedDocumentIds={documentIds}
              onDocumentIdsChange={setDocumentIds}
            />
          </div>
        </form>

        {/* Danger Zone - Delete Guitar */}
        {isEditMode && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-8">
            <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Danger Zone</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Once you delete this guitar, there is no going back. All images, notes, and information will be permanently removed.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold text-sm uppercase tracking-wide"
                  >
                    Delete This Guitar Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Specs Importer Modal */}
      {showSpecsImporter && (
        <SpecsImporter
          onClose={() => setShowSpecsImporter(false)}
          onApply={handleApplyExtractedSpecs}
          existingFields={getCurrentFormValues()}
        />
      )}

      {/* Receipt Importer Modal */}
      {showReceiptImporter && (
        <ReceiptImporter
          onClose={() => setShowReceiptImporter(false)}
          onApply={handleApplyReceipt}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Guitar?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {brand} {model}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
