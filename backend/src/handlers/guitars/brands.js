/**
 * Get guitar brands handler
 * Returns unique brands from the user's guitar collection
 */

const { queryItems } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES, GUITAR_TYPES, GUITAR_CONDITIONS } = require('../../config/constants');

async function getBrands(event) {
  try {
    const userId = await getUserIdFromEvent(event);

    // Query all guitars for this user
    const guitars = await queryItems(
      TABLES.GUITARS,
      'userId = :userId',
      {
        ':userId': userId,
      }
    );

    // Extract unique brands from the user's collection
    const brandSet = new Set();
    guitars.forEach(guitar => {
      if (guitar.brand) {
        brandSet.add(guitar.brand);
      }
    });

    // Convert to sorted array
    const brands = Array.from(brandSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return response.ok({
      brands,
      types: GUITAR_TYPES,
      conditions: GUITAR_CONDITIONS,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { getBrands };
