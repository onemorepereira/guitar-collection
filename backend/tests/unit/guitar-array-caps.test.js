const {
  validateGuitarUpdateFields,
  MAX_ARRAY_ITEMS,
} = require('../../src/lib/validation');
const { ValidationError } = require('../../src/lib/errors');

describe('guitar array length caps', () => {
  test('rejects a conditionMarkers array over the cap', () => {
    const markers = Array.from({ length: MAX_ARRAY_ITEMS + 1 }, (_, i) => ({
      id: String(i),
      x: 1,
      y: 1,
    }));
    expect(() =>
      validateGuitarUpdateFields({ brand: 'Fender', conditionMarkers: markers })
    ).toThrow(ValidationError);
  });

  test('rejects a notes array over the cap', () => {
    const notes = Array.from({ length: MAX_ARRAY_ITEMS + 1 }, (_, i) => ({
      id: String(i),
      text: 'x',
    }));
    expect(() =>
      validateGuitarUpdateFields({ brand: 'Fender', notes })
    ).toThrow(ValidationError);
  });

  test('rejects an images array over the cap', () => {
    const images = Array.from({ length: MAX_ARRAY_ITEMS + 1 }, (_, i) => ({
      id: String(i),
      url: `https://x/${i}.jpg`,
    }));
    expect(() =>
      validateGuitarUpdateFields({ brand: 'Fender', images })
    ).toThrow(ValidationError);
  });

  test('accepts arrays within the cap', () => {
    expect(() =>
      validateGuitarUpdateFields({
        brand: 'Fender',
        conditionMarkers: [{ id: '1', x: 1, y: 1 }],
        notes: [{ id: '1', text: 'nice' }],
      })
    ).not.toThrow();
  });
});
