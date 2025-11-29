// Guitar body shape templates for condition diagrams
// Re-exports from modular template files

// Export types
export type { GuitarShape, ViewAngle, TemplateProps } from './templates';

// Export individual templates
export {
  StratocasterTemplate,
  TelecasterTemplate,
  LesPaulTemplate,
  SGTemplate,
  SemihollowTemplate,
  OffsetTemplate,
  SuperstratTemplate,
  ExplorerTemplate,
  FlyingVTemplate,
  RickenbackerTemplate,
  GuitarTemplateMap,
} from './templates';

// Import for local use
import { GuitarShape, TemplateProps, GuitarTemplateMap } from './templates';

// Get template component by shape name
export const getGuitarTemplate = (shape: GuitarShape): React.ComponentType<TemplateProps> => {
  return GuitarTemplateMap[shape];
};

// Get all available shapes
export const getAvailableShapes = (): GuitarShape[] => {
  return Object.keys(GuitarTemplateMap) as GuitarShape[];
};
