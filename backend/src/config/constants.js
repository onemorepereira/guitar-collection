/**
 * Application constants
 */

module.exports = {
  // Table names
  TABLES: {
    GUITARS: process.env.DYNAMODB_TABLE_GUITARS || 'guitar-collection-guitars-dev',
    USERS: process.env.DYNAMODB_TABLE_USERS || 'guitar-collection-users-dev',
    DOCUMENTS: process.env.DYNAMODB_TABLE_DOCUMENTS || 'guitar-collection-documents-dev',
    PROVENANCE_REPORTS: process.env.DYNAMODB_TABLE_PROVENANCE_REPORTS || 'guitar-collection-provenance-reports-dev',
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
  },

  // Guitar conditions
  GUITAR_CONDITIONS: [
    'Mint',
    'Excellent',
    'Very Good',
    'Good',
    'Fair',
    'Poor',
  ],

  // Guitar types
  GUITAR_TYPES: [
    'Electric',
    'Acoustic',
    'Classical',
    'Bass',
    'Hollow Body',
    'Semi-Hollow',
    'Resonator',
    'Other',
  ],

  // Popular guitar brands
  GUITAR_BRANDS: [
    'Fender',
    'Gibson',
    'Martin',
    'Taylor',
    'Ibanez',
    'PRS',
    'Gretsch',
    'Rickenbacker',
    'Yamaha',
    'ESP',
    'Jackson',
    'Schecter',
    'Epiphone',
    'Squier',
    'Takamine',
    'Guild',
    'Music Man',
    'Other',
  ],

  // Image constraints
  IMAGE_CONSTRAINTS: {
    MAX_SIZE_MB: 30,
    MAX_SIZE_BYTES: 30 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
    MAX_IMAGES_PER_GUITAR: 10,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Token expiration
  TOKEN_EXPIRATION: {
    ACCESS_TOKEN_HOURS: 1,
    ID_TOKEN_HOURS: 1,
    REFRESH_TOKEN_DAYS: 30,
  },
};
