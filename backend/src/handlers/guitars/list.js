/**
 * List guitars handler
 */

const { queryItems } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateListQueryParams } = require('../../lib/validation');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function listGuitars(event) {
  try {
    const userId = await getUserIdFromEvent(event);

    // Validate and parse query string parameters
    const rawParams = event.queryStringParameters || {};
    const params = validateListQueryParams(rawParams);
    const { search, brand, type, yearMin, yearMax } = params;

    // Query guitars for this user
    let guitars = await queryItems(
      TABLES.GUITARS,
      'userId = :userId',
      {
        ':userId': userId,
      }
    );

    // Apply filters with validated parameters
    if (search) {
      const searchLower = search.toLowerCase();
      guitars = guitars.filter(guitar => {
        const searchableFields = [
          guitar.brand,
          guitar.model,
          guitar.color,
          guitar.serialNumber,
          guitar.notes?.map(n => n.content).join(' '),
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableFields.includes(searchLower);
      });
    }

    if (brand) {
      guitars = guitars.filter(guitar => guitar.brand === brand);
    }

    if (type) {
      guitars = guitars.filter(guitar => guitar.type === type);
    }

    // yearMin and yearMax are already validated and parsed as integers
    if (yearMin !== undefined) {
      guitars = guitars.filter(guitar => guitar.year >= yearMin);
    }

    if (yearMax !== undefined) {
      guitars = guitars.filter(guitar => guitar.year <= yearMax);
    }

    // Sort by creation date (newest first)
    guitars.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Map guitarId to id for frontend compatibility
    const guitarsResponse = guitars.map(guitar => {
      const { guitarId, ...rest } = guitar;
      return {
        ...rest,
        id: guitarId,
      };
    });

    return response.ok({
      guitars: guitarsResponse,
      count: guitarsResponse.length,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { listGuitars };
