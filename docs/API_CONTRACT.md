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
