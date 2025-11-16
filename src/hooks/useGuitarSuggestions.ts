import { useMemo } from 'react';
import guitarKnowledge from '../data/guitarKnowledge.json';
import { GUITAR_SUGGESTIONS } from '../constants/guitarSuggestions';
import { SuggestionItem } from '../components/AutocompleteInput';

interface UseGuitarSuggestionsProps {
  brand?: string;
  type?: string;
}

/**
 * Hook to provide contextual guitar specifications suggestions
 * Uses the guitar knowledge base to provide brand-specific suggestions
 * with rich context information
 */
export const useGuitarSuggestions = ({ brand, type }: UseGuitarSuggestionsProps = {}) => {
  const suggestions = useMemo(() => {
    // Get all brands from knowledge base as simple strings
    const brands = Object.keys(guitarKnowledge.brands);

    // If no brand is selected, return generic suggestions
    if (!brand) {
      return {
        brands,
        models: [] as SuggestionItem[],
        bodyMaterials: GUITAR_SUGGESTIONS.bodyMaterials,
        neckMaterials: GUITAR_SUGGESTIONS.neckMaterials,
        fretboardMaterials: GUITAR_SUGGESTIONS.fretboardMaterials,
        pickupConfigurations: GUITAR_SUGGESTIONS.pickupConfigurations,
        colors: guitarKnowledge.colors,
        finishes: GUITAR_SUGGESTIONS.finishes,
        bridges: GUITAR_SUGGESTIONS.bridges,
        nuts: GUITAR_SUGGESTIONS.nuts,
        tuningMachines: GUITAR_SUGGESTIONS.tuningMachines,
        countriesOfOrigin: GUITAR_SUGGESTIONS.countriesOfOrigin,
        bodyShapes: GUITAR_SUGGESTIONS.bodyShapes,
        neckProfiles: GUITAR_SUGGESTIONS.neckProfiles,
        neckJoints: GUITAR_SUGGESTIONS.neckJoints,
        neckFinishes: GUITAR_SUGGESTIONS.neckFinishes,
        fretSizes: GUITAR_SUGGESTIONS.fretSizes,
        fretboardInlays: GUITAR_SUGGESTIONS.fretboardInlays,
        hardwareFinishes: GUITAR_SUGGESTIONS.hardwareFinishes,
        pickguards: GUITAR_SUGGESTIONS.pickguards,
        stringGauges: GUITAR_SUGGESTIONS.stringGauges,
      };
    }

    // Find the brand in knowledge base (case-insensitive, handles "PRS (Paul Reed Smith)" → "PRS")
    const normalizedBrand = brand.split('(')[0].trim();
    const brandData = guitarKnowledge.brands[normalizedBrand as keyof typeof guitarKnowledge.brands];

    if (brandData) {
      // Brand found in knowledge base - provide contextual suggestions

      // Convert models to rich suggestions with context
      const modelsWithContext: SuggestionItem[] = (brandData.models || []).map(model => {
        // Determine body type context
        const bodyTypes = brandData.specs?.bodyType || [];
        const scaleLength = brandData.specs?.scaleLength?.[0] || '';
        const pickups = brandData.specs?.pickupConfiguration?.[0] || '';

        const contextParts: string[] = [];
        if (bodyTypes.length > 0) contextParts.push(bodyTypes[0]);
        if (scaleLength) contextParts.push(scaleLength);
        if (pickups) contextParts.push(pickups);

        return {
          label: model,
          context: contextParts.length > 0 ? contextParts.join(' • ') : undefined,
        };
      });

      return {
        brands,
        models: modelsWithContext,

        // Use brand-specific specs where available, fall back to generic
        bodyMaterials: brandData.specs?.bodyWood || GUITAR_SUGGESTIONS.bodyMaterials,
        neckMaterials: brandData.specs?.neckWood || GUITAR_SUGGESTIONS.neckMaterials,
        fretboardMaterials: brandData.specs?.fretboardWood || GUITAR_SUGGESTIONS.fretboardMaterials,
        pickupConfigurations: brandData.specs?.pickupConfiguration
          ? brandData.specs.pickupConfiguration.map(config => {
              // Map short codes to full descriptions if needed
              const configMap: Record<string, string> = {
                'SSS': 'SSS (3 Single Coils)',
                'HH': 'HH (2 Humbuckers)',
                'HSS': 'HSS (Humbucker/Single/Single)',
                'HSH': 'HSH (Humbucker/Single/Humbucker)',
                'H': 'H (Single Humbucker)',
                'SS': 'SS (2 Single Coils)',
                'P90-P90': 'P90/P90',
              };
              return configMap[config] || config;
            })
          : GUITAR_SUGGESTIONS.pickupConfigurations,

        // Generic suggestions (not brand-specific)
        colors: guitarKnowledge.colors,
        finishes: GUITAR_SUGGESTIONS.finishes,
        bridges: GUITAR_SUGGESTIONS.bridges,
        nuts: GUITAR_SUGGESTIONS.nuts,
        tuningMachines: GUITAR_SUGGESTIONS.tuningMachines,
        countriesOfOrigin: GUITAR_SUGGESTIONS.countriesOfOrigin,
        bodyShapes: GUITAR_SUGGESTIONS.bodyShapes,
        neckProfiles: GUITAR_SUGGESTIONS.neckProfiles,
        neckJoints: GUITAR_SUGGESTIONS.neckJoints,
        neckFinishes: GUITAR_SUGGESTIONS.neckFinishes,
        fretSizes: GUITAR_SUGGESTIONS.fretSizes,
        fretboardInlays: GUITAR_SUGGESTIONS.fretboardInlays,
        hardwareFinishes: GUITAR_SUGGESTIONS.hardwareFinishes,
        pickguards: GUITAR_SUGGESTIONS.pickguards,
        stringGauges: GUITAR_SUGGESTIONS.stringGauges,
      };
    }

    // Brand not in knowledge base - return generic suggestions
    return {
      brands,
      models: [] as SuggestionItem[],
      bodyMaterials: GUITAR_SUGGESTIONS.bodyMaterials,
      neckMaterials: GUITAR_SUGGESTIONS.neckMaterials,
      fretboardMaterials: GUITAR_SUGGESTIONS.fretboardMaterials,
      pickupConfigurations: GUITAR_SUGGESTIONS.pickupConfigurations,
      colors: guitarKnowledge.colors,
      finishes: GUITAR_SUGGESTIONS.finishes,
      bridges: GUITAR_SUGGESTIONS.bridges,
      nuts: GUITAR_SUGGESTIONS.nuts,
      tuningMachines: GUITAR_SUGGESTIONS.tuningMachines,
      countriesOfOrigin: GUITAR_SUGGESTIONS.countriesOfOrigin,
      bodyShapes: GUITAR_SUGGESTIONS.bodyShapes,
      neckProfiles: GUITAR_SUGGESTIONS.neckProfiles,
      neckJoints: GUITAR_SUGGESTIONS.neckJoints,
      neckFinishes: GUITAR_SUGGESTIONS.neckFinishes,
      fretSizes: GUITAR_SUGGESTIONS.fretSizes,
      fretboardInlays: GUITAR_SUGGESTIONS.fretboardInlays,
      hardwareFinishes: GUITAR_SUGGESTIONS.hardwareFinishes,
      pickguards: GUITAR_SUGGESTIONS.pickguards,
      stringGauges: GUITAR_SUGGESTIONS.stringGauges,
    };
  }, [brand, type]);

  return suggestions;
};

/**
 * Get typical specifications for a given brand and model
 * Used for auto-filling specs when a model is selected
 */
export const getTypicalSpecs = (brand: string, model: string): Partial<{
  scaleLength: string;
  pickupConfiguration: string;
  bodyMaterial: string;
  neckMaterial: string;
  fretboardMaterial: string;
  numberOfFrets: number;
}> | null => {
  const normalizedBrand = brand.split('(')[0].trim();
  const brandData = guitarKnowledge.brands[normalizedBrand as keyof typeof guitarKnowledge.brands];

  if (!brandData || !brandData.specs) {
    return null;
  }

  // Return most common specs for the brand
  const specs = brandData.specs;
  return {
    scaleLength: specs.scaleLength?.[0],
    pickupConfiguration: specs.pickupConfiguration?.[0],
    bodyMaterial: specs.bodyWood?.[0],
    neckMaterial: specs.neckWood?.[0],
    fretboardMaterial: specs.fretboardWood?.[0],
    numberOfFrets: 22, // Most common default
  };
};
