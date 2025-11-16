/**
 * Create guitar handler
 */

const { v4: uuidv4 } = require('uuid');
const { putItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateGuitar, validateGuitarUpdateFields } = require('../../lib/validation');
const { sanitizeGuitarData } = require('../../lib/sanitization');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function createGuitar(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Step 1: Validate allowed fields (prevents NoSQL injection)
    const filteredData = validateGuitarUpdateFields(body);

    // Step 2: Sanitize all input (prevents XSS)
    const data = sanitizeGuitarData(filteredData);

    // Step 3: Validate business logic
    validateGuitar(data);

    // Create guitar record - only include provided fields
    const guitar = {
      userId,
      guitarId: uuidv4(),
      // Required fields
      brand: data.brand,
      model: data.model,
      year: parseInt(data.year),
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add optional fields only if provided
    if (data.type !== undefined) guitar.type = data.type;
    if (data.bodyMaterial !== undefined) guitar.bodyMaterial = data.bodyMaterial;
    if (data.neckMaterial !== undefined) guitar.neckMaterial = data.neckMaterial;
    if (data.fretboardMaterial !== undefined) guitar.fretboardMaterial = data.fretboardMaterial;
    if (data.numberOfFrets !== undefined) guitar.numberOfFrets = parseInt(data.numberOfFrets);
    if (data.scaleLength !== undefined) guitar.scaleLength = data.scaleLength;
    if (data.pickupConfiguration !== undefined) guitar.pickupConfiguration = data.pickupConfiguration;
    if (data.color !== undefined) guitar.color = data.color;
    if (data.finish !== undefined) guitar.finish = data.finish;
    if (data.tuningMachines !== undefined) guitar.tuningMachines = data.tuningMachines;
    if (data.bridge !== undefined) guitar.bridge = data.bridge;
    if (data.nut !== undefined) guitar.nut = data.nut;
    if (data.electronics !== undefined) guitar.electronics = data.electronics;
    if (data.caseIncluded !== undefined) guitar.caseIncluded = data.caseIncluded;
    if (data.countryOfOrigin !== undefined) guitar.countryOfOrigin = data.countryOfOrigin;
    if (data.detailedSpecs !== undefined) guitar.detailedSpecs = data.detailedSpecs;
    if (data.images !== undefined) guitar.images = data.images;
    if (data.documents !== undefined) guitar.documents = data.documents;
    if (data.documentIds !== undefined) guitar.documentIds = data.documentIds;
    if (data.privateInfo !== undefined) guitar.privateInfo = data.privateInfo;
    if (data.notes !== undefined) guitar.notes = data.notes;

    await putItem(TABLES.GUITARS, guitar);

    // Map guitarId to id for frontend compatibility
    const guitarResponse = {
      ...guitar,
      id: guitar.guitarId,
    };
    delete guitarResponse.guitarId;

    return response.created({
      message: 'Guitar created successfully',
      guitar: guitarResponse,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { createGuitar };
