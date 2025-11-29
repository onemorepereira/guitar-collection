# Guitar Collection API Contract

## Overview

This document defines the contract between the backend API and frontend for guitar data exchange. The API returns whatever attributes exist in the database without forcing defaults, and the frontend handles missing/null values gracefully.

## Guitar Data Model

### Required Fields

These fields **MUST** always be present and non-null in API responses:

- `id` (string) - Unique identifier for the guitar
- `userId` (string) - Owner's user ID
- `brand` (string) - Guitar brand/manufacturer
- `model` (string) - Guitar model name
- `year` (number) - Year of manufacture
- `createdAt` (string, ISO 8601) - Timestamp when record was created
- `updatedAt` (string, ISO 8601) - Timestamp when record was last updated

### Optional Basic Fields

These fields **MAY** be present. If absent or null, frontend should handle gracefully:

- `type` (string) - Guitar type (Electric, Acoustic, Bass, etc.)
- `color` (string) - Guitar color
- `finish` (string) - Finish type (e.g., Gloss, Satin)

### Optional Specification Fields

All specification fields are optional. Frontend displays "Not specified" or hides the field if null/undefined:

- `bodyMaterial` (string) - Body wood/material
- `neckMaterial` (string) - Neck wood/material
- `fretboardMaterial` (string) - Fretboard wood/material
- `numberOfFrets` (number) - Number of frets
- `scaleLength` (string) - Scale length (e.g., "25.5\"")
- `pickupConfiguration` (string) - Pickup config (e.g., "HSH", "SSS")
- `tuningMachines` (string) - Tuning machine details
- `bridge` (string) - Bridge type
- `nut` (string) - Nut material/type
- `electronics` (string) - Electronics description
- `caseIncluded` (boolean) - Whether case is included (defaults to false if absent)
- `countryOfOrigin` (string) - Country where manufactured

### Optional Nested Objects

These are complex objects that may be entirely absent, partially populated, or null:

#### `detailedSpecs` (object, optional)

Contains detailed specification attributes. Any field within may be null/undefined:

- Body Details: `bodyShape`, `bodyBinding`, `topWood`, `topCarve`
- Neck Details: `neckProfile`, `neckJoint`, `neckFinish`, `fretboardRadius`, `fretSize`, `fretboardInlays`, `nutWidth`, `nutMaterial`, `trussRod`
- Pickup Details: `neckPickup`, `bridgePickup`, `pickupSelector`, `controls`
- Hardware Details: `hardwareFinish`, `tailpiece`, `pickguard`, `controlKnobs`, `strapButtons`, `stringTrees`
- Misc: `stringGauge`, `headstock`, `weight`

#### `privateInfo` (object, optional)

Contains private/sensitive information. Any field within may be null/undefined:

- `serialNumber` (string)
- `purchaseDate` (string, ISO 8601)
- `originalRetailPrice` (number)
- `purchasePrice` (number)
- `purchaseLocation` (string)
- `currentValue` (number)
- `currency` (string) - ISO currency code (e.g., "USD")
- `insuranceInfo` (string)
- `receiptUrl` (string)

#### `images` (array, optional)

Array of guitar images. May be empty array, but should not be null:

- `id` (string) - Image identifier
- `url` (string) - Image URL
- `thumbnailUrl` (string, optional) - Thumbnail URL
- `isPrimary` (boolean) - Whether this is the main image
- `order` (number) - Display order
- `caption` (string, optional) - Image caption

#### `notes` (array, optional)

Array of journal notes. May be empty array, but should not be null:

- `id` (string) - Note identifier
- `content` (string) - Note text
- `createdAt` (string, ISO 8601) - When note was created

### Condition Documentation Fields

These fields document the physical condition of the guitar using visual diagrams:

#### `conditionShape` (string, optional)

Guitar body shape template for condition diagrams. Valid values:
- `stratocaster`, `telecaster`, `lespaul`, `sg`, `semihollow`
- `offset`, `superstrat`, `explorer`, `flyingv`, `rickenbacker`

#### `conditionMarkers` (array, optional)

Array of condition markers placed on the guitar diagram. Each marker documents a blemish or issue:

- `id` (string) - Unique marker identifier
- `x` (number) - X position as percentage (0-100)
- `y` (number) - Y position as percentage (0-100)
- `view` (string) - Which diagram view: `"front"` or `"back"`
- `severity` (string) - Issue severity: `"minor"`, `"moderate"`, or `"major"`
- `type` (string) - Issue type (e.g., "Scratch", "Ding / dent", "Chip", "Crack", "Wear", "Fret issue", "Hardware issue", "Electronics issue", "Repair", "Modification", "Other")
- `note` (string) - Detailed description of the issue

**Condition Score Calculation** (frontend):
```
score = 100 - (minor × 2) - (moderate × 5) - (major × 10)
```

Score labels: Mint (95+), Excellent (85+), Very Good (70+), Good (50+), Fair (30+), Poor (<30)

## API Behavior

### Creating Guitars (POST /guitars)

- Only required fields must be provided
- Optional fields are stored only if provided in request
- Missing optional fields are NOT saved as null - they're simply omitted from the database record

### Updating Guitars (PUT /guitars/{id})

- Only provided fields are updated
- To clear a field, explicitly send null or empty string
- Missing fields in update request are left unchanged in database

### Retrieving Guitars (GET /guitars, GET /guitars/{id})

- Returns all fields that exist in the database
- Missing/null optional fields are returned as-is (null or undefined)
- Frontend must handle null/undefined gracefully using:
  - Optional chaining (`guitar.numberOfFrets?.toString()`)
  - Null coalescing (`guitar.type || 'Not specified'`)
  - Conditional rendering (`{guitar.type && <span>{guitar.type}</span>}`)

### AI-Powered Spec Extraction (POST /specs/extract)

Extract guitar specifications from PDFs or text using Amazon Bedrock Nova Lite.

**Authentication**: Required (JWT token)

**Content Types Supported**:
- `multipart/form-data` - For file uploads (PDF or TXT)
- `application/json` - For pasted text content

**Request Format (File Upload)**:
```
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="file"; filename="receipt.pdf"
Content-Type: application/pdf

<binary PDF data>
--boundary--
```

**Request Format (Text Paste)**:
```json
{
  "text": "Fender American Professional Stratocaster\nBody: Alder\nNeck: Maple\n..."
}
```

**Response Format**:
```json
{
  "fields": [
    {
      "field": "brand",
      "value": "Fender",
      "confidence": 0.95,
      "category": "basic",
      "sourceText": "Fender American Professional",
      "reasoning": "Brand name explicitly stated"
    },
    {
      "field": "scaleLength",
      "value": "25.5 inch",
      "confidence": 0.85,
      "category": "specs",
      "sourceText": "25.5 inch scale"
    }
  ],
  "rawText": "Fender American Professional Stratocaster\nBody: Alder..."
}
```

**Response Fields**:
- `fields` (array) - Extracted guitar specifications
  - `field` (string) - Field name matching guitar data model
  - `value` (string|number|boolean) - Extracted value
  - `confidence` (number) - AI confidence score (0.0-1.0)
  - `category` (string) - Field category: "basic", "specs", or "detailed"
  - `sourceText` (string, optional) - Original text snippet containing this value
  - `reasoning` (string, optional) - AI explanation for extraction
- `rawText` (string) - Full source text for visual mapping in UI

**Field Categories**:
- **basic**: brand, model, year, type (4 fields)
- **specs**: bodyMaterial, neckMaterial, fretboardMaterial, numberOfFrets, scaleLength, pickupConfiguration, color, finish, tuningMachines, bridge, nut, electronics, caseIncluded, countryOfOrigin (14 fields)
- **detailed**: All detailedSpecs fields (25+ fields)

**Extraction Limits**:
- Maximum 30 fields returned (most important only)
- Only fields with confidence >= 0.7 included
- Text input limited to 50,000 characters
- Supported file types: PDF, TXT

**Error Responses**:
```json
// No file or text provided
{ "error": "No file uploaded" }
{ "error": "No text provided" }

// Invalid file type
{ "error": "Unsupported file type. Please upload PDF or TXT" }

// Text too large
{ "error": "Text content too large (max 50,000 characters)" }

// AI extraction failed
{ "error": "Failed to extract specifications with AI" }
{ "error": "Failed to parse PDF file" }
```

**AI Model**: Amazon Bedrock Nova Lite (`amazon.nova-lite-v1:0`)

**Cost**: ~$0.00024 per extraction (typical: 2000 input tokens, 500 output tokens)

## Examples

### Minimal Valid Guitar

```json
{
  "id": "abc-123",
  "userId": "user-456",
  "brand": "Fender",
  "model": "Stratocaster",
  "year": 2020,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### Fully Populated Guitar

```json
{
  "id": "abc-123",
  "userId": "user-456",
  "brand": "PRS",
  "model": "Custom 24",
  "year": 2023,
  "type": "Electric",
  "bodyMaterial": "Mahogany",
  "neckMaterial": "Mahogany",
  "fretboardMaterial": "Rosewood",
  "numberOfFrets": 24,
  "scaleLength": "25\"",
  "pickupConfiguration": "HH",
  "color": "Charcoal Burst",
  "finish": "Nitrocellulose",
  "detailedSpecs": {
    "neckProfile": "Pattern Thin",
    "neckJoint": "Set-Neck"
  },
  "privateInfo": {
    "serialNumber": "23-123456",
    "purchasePrice": 4500,
    "currency": "USD"
  },
  "images": [],
  "notes": [],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### Guitar with Missing Optional Fields

```json
{
  "id": "xyz-789",
  "userId": "user-456",
  "brand": "Gibson",
  "model": "Les Paul",
  "year": 1959,
  "color": "Sunburst",
  "images": [],
  "notes": [],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

In this example, `type`, `bodyMaterial`, `neckMaterial`, etc. are completely absent from the response because they were never provided.

### Guitar with Condition Documentation

```json
{
  "id": "cond-123",
  "userId": "user-456",
  "brand": "Fender",
  "model": "Stratocaster",
  "year": 1965,
  "conditionShape": "stratocaster",
  "conditionMarkers": [
    {
      "id": "marker-1",
      "x": 45.2,
      "y": 32.8,
      "view": "front",
      "severity": "minor",
      "type": "Scratch",
      "note": "Light surface scratch near pickguard"
    },
    {
      "id": "marker-2",
      "x": 78.5,
      "y": 65.0,
      "view": "back",
      "severity": "moderate",
      "type": "Ding / dent",
      "note": "Small dent from belt buckle wear"
    }
  ],
  "images": [],
  "notes": [],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

This guitar has a condition score of 93 (100 - 2 - 5 = 93), rated "Excellent".

---

## Shares API

The Shares API enables creating public links to share guitar information with configurable field visibility and watermarked images.

### Share Data Model

```typescript
interface Share {
  shareId: string;           // Unique share identifier (UUID)
  userId: string;            // Owner's user ID
  guitarId: string;          // Associated guitar ID
  createdAt: string;         // ISO 8601 timestamp
  updatedAt: string;         // ISO 8601 timestamp
  isActive: boolean;         // Whether share link is active
  sharedFields: SharedFields; // Field visibility configuration
  selectedImageIds: string[];// IDs of images to include
  optimizedImages: OptimizedImage[]; // Watermarked/resized images
  viewCount: number;         // Total view count
  views: ShareView[];        // View analytics (max 1000)
  lastViewedAt?: string;     // Last view timestamp
}

interface SharedFields {
  brand: boolean;            // Default: true
  model: boolean;            // Default: true
  year: boolean;             // Default: true
  color: boolean;            // Default: true
  type: boolean;             // Default: true
  bodyMaterial: boolean;     // Default: false
  neckMaterial: boolean;     // Default: false
  fretboardMaterial: boolean;// Default: false
  numberOfFrets: boolean;    // Default: false
  scaleLength: boolean;      // Default: false
  pickupConfiguration: boolean; // Default: false
  finish: boolean;           // Default: false
  tuningMachines: boolean;   // Default: false
  bridge: boolean;           // Default: false
  nut: boolean;              // Default: false
  electronics: boolean;      // Default: false
  caseIncluded: boolean;     // Default: false
  countryOfOrigin: boolean;  // Default: false
  detailedSpecs: boolean;    // Default: false
  conditionReport: boolean;  // Default: false
  purchasePrice: boolean;    // Default: false (private)
  purchaseDate: boolean;     // Default: false (private)
  notes: boolean;            // Default: false (private)
  provenance: boolean;       // Default: false (private)
  documents: boolean;        // Default: false (private)
}

interface OptimizedImage {
  originalId: string;        // Original image ID
  s3Key: string;             // S3 storage key
  url: string;               // Public URL
  width: number;             // Image width
  height: number;            // Image height
}
```

### Creating Shares (POST /shares)

**Authentication**: Required (JWT token)
**CSRF**: Required (`x-csrf-protection` header)

**Request**:
```json
{
  "guitarId": "abc-123",
  "sharedFields": {
    "bodyMaterial": true,
    "neckMaterial": true
  },
  "selectedImageIds": ["img-1", "img-2"]
}
```

- `guitarId` (required) - Guitar to share
- `sharedFields` (optional) - Override default field visibility
- `selectedImageIds` (optional) - Specific images to include (max 10). If omitted, all images are included.

**Response** (201):
```json
{
  "message": "Share created successfully",
  "share": {
    "shareId": "uuid-here",
    "guitarId": "abc-123",
    "isActive": true,
    "sharedFields": { ... },
    "selectedImageIds": ["img-1", "img-2"],
    "optimizedImages": [
      {
        "originalId": "img-1",
        "url": "https://images.guitarhelp.click/shares/...",
        "width": 1200,
        "height": 800
      }
    ],
    "viewCount": 0,
    "shareUrl": "https://guitarhelp.click/s/uuid-here"
  }
}
```

### Listing Shares (GET /shares)

**Authentication**: Required

Returns all shares for the authenticated user with guitar summary info.

**Response** (200):
```json
{
  "shares": [
    {
      "shareId": "uuid-here",
      "guitarId": "abc-123",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z",
      "isActive": true,
      "viewCount": 42,
      "imageCount": 3,
      "shareUrl": "https://guitarhelp.click/s/uuid-here",
      "guitar": {
        "brand": "Fender",
        "model": "Stratocaster",
        "year": 1965,
        "thumbnail": "https://images.guitarhelp.click/..."
      }
    }
  ],
  "count": 1
}
```

### Getting Share Details (GET /shares/{shareId})

**Authentication**: Required (owner only)

Returns full share details including all configuration and analytics.

**Response** (200):
```json
{
  "share": {
    "shareId": "uuid-here",
    "guitarId": "abc-123",
    "isActive": true,
    "sharedFields": { ... },
    "selectedImageIds": [...],
    "optimizedImages": [...],
    "viewCount": 42,
    "views": [
      {
        "viewedAt": "2025-01-15T10:30:00Z",
        "referrer": "https://reverb.com",
        "country": "US",
        "browser": "Chrome"
      }
    ],
    "shareUrl": "https://guitarhelp.click/s/uuid-here",
    "guitar": {
      "brand": "Fender",
      "model": "Stratocaster",
      "year": 1965,
      "images": [...]
    }
  }
}
```

### Updating Shares (PUT /shares/{shareId})

**Authentication**: Required (owner only)
**CSRF**: Required

**Request**:
```json
{
  "sharedFields": {
    "purchasePrice": true
  },
  "selectedImageIds": ["img-1", "img-3"],
  "isActive": false
}
```

All fields are optional. Only provided fields are updated.

- Changing `selectedImageIds` triggers image reprocessing
- Setting `isActive: false` disables the share link

**Response** (200):
```json
{
  "message": "Share updated successfully",
  "share": { ... }
}
```

### Deleting Shares (DELETE /shares/{shareId})

**Authentication**: Required (owner only)
**CSRF**: Required

Deletes the share and its optimized images from S3.

**Response** (200):
```json
{
  "message": "Share deleted successfully"
}
```

### Public Share View (GET /public/shares/{shareId})

**Authentication**: None (public endpoint)

Returns filtered guitar data based on `sharedFields` configuration. Records view analytics.

**Response** (200):
```json
{
  "shareId": "uuid-here",
  "createdAt": "2025-01-01T00:00:00Z",
  "guitar": {
    "brand": "Fender",
    "model": "Stratocaster",
    "year": 1965,
    "color": "Sunburst",
    "conditionShape": "stratocaster",
    "conditionMarkers": [...]
  },
  "images": [
    {
      "id": "img-1",
      "url": "https://images.guitarhelp.click/shares/...",
      "width": 1200,
      "height": 800
    }
  ],
  "sharedFields": { ... }
}
```

**Note**: Only fields with `sharedFields[field] === true` are included in `guitar`. Condition data (`conditionShape`, `conditionMarkers`) requires `sharedFields.conditionReport === true`.

**Error Responses**:
- `404` - Share not found or inactive
- `404` - Guitar no longer exists

---

## Frontend Handling Guidelines

1. **Always check for null/undefined** before calling methods on optional string fields
2. **Use optional chaining** for nested objects: `guitar.privateInfo?.serialNumber`
3. **Provide fallback values** for display: `guitar.type || 'Not specified'`
4. **Conditionally render** UI elements that depend on optional data
5. **Initialize form fields** with empty strings/defaults when editing: `guitar.bodyMaterial || ''`

## Benefits of This Approach

1. **Reduced coupling**: Backend doesn't need to know all possible attributes upfront
2. **Flexible schema evolution**: New optional fields can be added without backend changes
3. **Storage efficiency**: Only store data that exists
4. **Clear semantics**: null/undefined means "not provided" rather than "explicitly set to empty"
5. **Frontend control**: Frontend decides how to handle and display missing data
