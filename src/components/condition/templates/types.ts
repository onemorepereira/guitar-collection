// Shared types for guitar templates

export type GuitarShape =
  | 'stratocaster'
  | 'telecaster'
  | 'lespaul'
  | 'sg'
  | 'semihollow'
  | 'offset'
  | 'superstrat'
  | 'explorer'
  | 'flyingv'
  | 'rickenbacker';

export type ViewAngle = 'front' | 'back';

export interface TemplateProps {
  className?: string;
  view?: 'front' | 'back';
}
