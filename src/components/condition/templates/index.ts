// Export all guitar templates and types
export * from './types';

export { StratocasterTemplate } from './StratocasterTemplate';
export { TelecasterTemplate } from './TelecasterTemplate';
export { LesPaulTemplate } from './LesPaulTemplate';
export { SGTemplate } from './SGTemplate';
export { SemihollowTemplate } from './SemihollowTemplate';
export { OffsetTemplate } from './OffsetTemplate';
export { SuperstratTemplate } from './SuperstratTemplate';
export { ExplorerTemplate } from './ExplorerTemplate';
export { FlyingVTemplate } from './FlyingVTemplate';
export { RickenbackerTemplate } from './RickenbackerTemplate';

// Template component map for dynamic rendering
import { StratocasterTemplate } from './StratocasterTemplate';
import { TelecasterTemplate } from './TelecasterTemplate';
import { LesPaulTemplate } from './LesPaulTemplate';
import { SGTemplate } from './SGTemplate';
import { SemihollowTemplate } from './SemihollowTemplate';
import { OffsetTemplate } from './OffsetTemplate';
import { SuperstratTemplate } from './SuperstratTemplate';
import { ExplorerTemplate } from './ExplorerTemplate';
import { FlyingVTemplate } from './FlyingVTemplate';
import { RickenbackerTemplate } from './RickenbackerTemplate';
import { GuitarShape, TemplateProps } from './types';

export const GuitarTemplateMap: Record<GuitarShape, React.ComponentType<TemplateProps>> = {
  stratocaster: StratocasterTemplate,
  telecaster: TelecasterTemplate,
  lespaul: LesPaulTemplate,
  sg: SGTemplate,
  semihollow: SemihollowTemplate,
  offset: OffsetTemplate,
  superstrat: SuperstratTemplate,
  explorer: ExplorerTemplate,
  flyingv: FlyingVTemplate,
  rickenbacker: RickenbackerTemplate,
};
