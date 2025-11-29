export interface DetailedSpecs {
  // Body Details
  bodyShape?: string;
  bodyBinding?: string;
  topWood?: string;
  topCarve?: string;

  // Neck Details
  neckProfile?: string;
  neckJoint?: string;
  neckFinish?: string;
  fretboardRadius?: string;
  fretSize?: string;
  fretboardInlays?: string;
  nutWidth?: string;
  nutMaterial?: string;
  trussRod?: string;

  // Pickup Details
  neckPickup?: string;
  bridgePickup?: string;
  pickupSelector?: string;
  controls?: string;

  // Hardware Details
  hardwareFinish?: string;
  tailpiece?: string;
  pickguard?: string;
  controlKnobs?: string;
  strapButtons?: string;
  stringTrees?: string;

  // Miscellaneous
  stringGauge?: string;
  headstock?: string;
  weight?: string;
}

// Condition marker for documenting blemishes on guitar diagrams
export interface ConditionMarkerData {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  view: 'front' | 'back';
  severity: 'minor' | 'moderate' | 'major';
  type: string;
  note: string;
}

// Guitar body shape for condition diagrams
export type GuitarBodyShape =
  | 'stratocaster'
  | 'telecaster'
  | 'lespaul'
  | 'sg'
  | 'semihollow'
  | 'offset'
  | 'superstrat'
  | 'explorer'
  | 'flyingv'
  | 'rickenbacker';

export interface Guitar {
  id: string;
  userId: string; // Owner of the guitar - for multi-user data isolation
  // Basic Information
  brand: string;
  model: string;
  year: number;
  type: GuitarType;

  // Specifications
  bodyMaterial: string;
  neckMaterial: string;
  fretboardMaterial: string;
  numberOfFrets: number;
  scaleLength: string;
  pickupConfiguration: string;
  color: string;
  finish: string;

  // Additional specs
  tuningMachines?: string;
  bridge?: string;
  nut?: string;
  electronics?: string;
  caseIncluded?: boolean;
  countryOfOrigin?: string;

  // Detailed Specifications (optional, for enthusiasts)
  detailedSpecs?: DetailedSpecs;

  // Condition Documentation
  conditionShape?: GuitarBodyShape;
  conditionMarkers?: ConditionMarkerData[];

  // Images
  images: GuitarImage[];

  // Documentation (brochures, marketing materials, etc.)
  documents?: GuitarDocument[]; // Deprecated - use documentIds instead
  documentIds?: string[]; // IDs of documents in the documents table

  // Private Information
  privateInfo?: PrivateGuitarInfo;

  // Notes (Journal-style)
  notes: NoteEntry[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface GuitarImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  isPrimary: boolean;
  order: number;
}

export interface ProvenanceReportSummary {
  id: string;
  version: number;
  generatedAt: string;
  guitarId: string;
  ownerName: string;
  type?: 'provenance' | 'sales_ad';
}

export interface ProvenanceReportData {
  overview: string;
  specifications: {
    construction?: Record<string, string>;
    electronics?: Record<string, string>;
    hardware?: Record<string, string>;
    finish?: Record<string, string>;
    raw?: string;
  };
  provenance: string;
  authentication: {
    serialNumber: string | null;
    hasPhotographicDocumentation: boolean;
    hasReceiptDocumentation: boolean;
    supportingDocuments: number;
    documentTypes: Array<{ name: string; type: string }>;
    authenticationLevel: 'High' | 'Medium' | 'Basic';
  };
  valuation: {
    purchasePrice: number | null;
    purchaseDate: string | null;
    currentEstimatedValue: number | null;
    condition: string;
    notes: string | null;
  };
  metadata: {
    guitarBrand: string;
    guitarModel: string;
    guitarYear: number;
    serialNumber: string | null;
  };
}

export interface ProvenanceReport {
  userId: string;
  reportId: string;
  guitarId: string;
  version: number;
  generatedAt: string;
  ownerName: string;
  reportData: ProvenanceReportData;
  reportType?: 'provenance' | 'sales_ad';
}

export interface SalesAdData {
  headline: string;
  description: string;
  features: string[];
  specifications: {
    body?: Record<string, string>;
    neck?: Record<string, string>;
    electronics?: Record<string, string>;
    hardware?: Record<string, string>;
    other?: Record<string, string>;
    raw?: string;
  };
  condition: string;
  price: number | null;
  images: GuitarImage[];
  metadata: {
    guitarBrand: string;
    guitarModel: string;
    guitarYear: number;
    serialNumber: string | null;
  };
}

export interface SalesAdReport {
  userId: string;
  reportId: string;
  guitarId: string;
  version: number;
  generatedAt: string;
  ownerName: string;
  reportData: SalesAdData;
  reportType: 'sales_ad';
}

export interface GuitarDocument {
  id: string;
  url: string;
  name: string;
  type: 'pdf' | 'image';
  contentType: string;
  uploadedAt: string;
}

export interface PrivateGuitarInfo {
  serialNumber?: string;
  purchaseDate?: string;
  originalRetailPrice?: number;
  purchasePrice?: number;
  purchaseLocation?: string;
  currentValue?: number;
  currency?: string; // ISO currency code (USD, EUR, GBP, etc.)
  receiptUrl?: string;
  insuranceInfo?: string;
}

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: string;
}

export enum GuitarType {
  ELECTRIC = 'Electric',
  ACOUSTIC = 'Acoustic',
  CLASSICAL = 'Classical',
  BASS = 'Bass',
  SEMI_HOLLOW = 'Semi-Hollow',
  HOLLOW_BODY = 'Hollow Body',
  ELECTRIC_ACOUSTIC = 'Electric-Acoustic',
  OTHER = 'Other',
}

// Extraction status for documents
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Extracted content from documents
export interface ExtractedContent {
  extractionStatus: ExtractionStatus;
  text?: string;
  description?: string; // AI-generated description (images only)
  storageType?: 'dynamo' | 's3';
  s3Key?: string;
  extractedAt?: string;
  rawTextLength?: number;
  error?: string;
}

// Standalone Document type for the documents management system
export interface Document {
  id: string;
  userId: string;
  name: string;
  url: string;
  type: 'pdf' | 'image';
  contentType: string;
  uploadedAt: string;
  assignedGuitars: string[]; // Guitar IDs that use this document
  tags?: string[];
  notes?: string;
  updatedAt?: string;
  extractedContent?: ExtractedContent;
  jobId?: string; // Textract job ID (only present during PDF processing)
}

export interface GuitarFilters {
  search?: string;
  brand?: string;
  type?: GuitarType;
  yearMin?: number;
  yearMax?: number;
}

export interface GuitarFormData extends Omit<Guitar, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {}

// Share types
export interface SharedFields {
  brand: boolean;
  model: boolean;
  year: boolean;
  color: boolean;
  type: boolean;
  bodyMaterial: boolean;
  neckMaterial: boolean;
  fretboardMaterial: boolean;
  numberOfFrets: boolean;
  scaleLength: boolean;
  pickupConfiguration: boolean;
  finish: boolean;
  tuningMachines: boolean;
  bridge: boolean;
  nut: boolean;
  electronics: boolean;
  caseIncluded: boolean;
  countryOfOrigin: boolean;
  detailedSpecs: boolean;
  conditionReport: boolean;
  purchasePrice: boolean;
  purchaseDate: boolean;
  notes: boolean;
  provenance: boolean;
  documents: boolean;
}

export interface OptimizedImage {
  originalId: string;
  s3Key: string;
  url: string;
  width: number;
  height: number;
  size?: number;
}

export interface ShareView {
  viewedAt: string;
  referrer: string | null;
  country: string | null;
  browser: string | null;
}

export interface Share {
  shareId: string;
  userId: string;
  guitarId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  sharedFields: SharedFields;
  selectedImageIds: string[];
  optimizedImages: OptimizedImage[];
  viewCount: number;
  views: ShareView[];
  lastViewedAt?: string;
  shareUrl: string;
  guitar?: {
    brand: string;
    model: string;
    year: number;
    images?: GuitarImage[];
  };
}

export interface ShareListItem {
  shareId: string;
  guitarId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  viewCount: number;
  imageCount: number;
  shareUrl: string;
  guitar: {
    brand: string;
    model: string;
    year: number;
    thumbnail?: string;
  } | null;
}

export interface ShareFormData {
  guitarId: string;
  sharedFields?: Partial<SharedFields>;
  selectedImageIds?: string[];
}

export interface PublicShareImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export interface PublicShareData {
  shareId: string;
  createdAt: string;
  guitar: Partial<Guitar>;
  images: PublicShareImage[];
  sharedFields: SharedFields;
}
