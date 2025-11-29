import { GuitarTemplateMap, GuitarShape, ViewAngle } from './GuitarTemplates';
import { ConditionMarker } from './ConditionDiagram';

const SEVERITY_CONFIG = {
  minor: {
    label: 'Minor',
    color: 'bg-yellow-400',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-700',
    bgLight: 'bg-yellow-50',
  },
  moderate: {
    label: 'Moderate',
    color: 'bg-orange-400',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700',
    bgLight: 'bg-orange-50',
  },
  major: {
    label: 'Major',
    color: 'bg-red-500',
    borderColor: 'border-red-600',
    textColor: 'text-red-700',
    bgLight: 'bg-red-50',
  },
};

// Scoring: Start at 100, deduct points per issue
const SEVERITY_POINTS = {
  minor: 2,
  moderate: 5,
  major: 10,
};

const calculateConditionScore = (markers: ConditionMarker[]): number => {
  const deductions = markers.reduce((total, m) => total + SEVERITY_POINTS[m.severity], 0);
  return Math.max(0, 100 - deductions);
};

const getScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 95) return { label: 'Mint', color: 'text-green-600' };
  if (score >= 85) return { label: 'Excellent', color: 'text-green-500' };
  if (score >= 70) return { label: 'Very Good', color: 'text-blue-500' };
  if (score >= 55) return { label: 'Good', color: 'text-yellow-600' };
  if (score >= 40) return { label: 'Fair', color: 'text-orange-500' };
  return { label: 'Poor', color: 'text-red-500' };
};

interface ConditionReportProps {
  shape: GuitarShape;
  markers: ConditionMarker[];
  compact?: boolean;
}

export const ConditionReport = ({ shape, markers, compact = false }: ConditionReportProps) => {
  const TemplateComponent = GuitarTemplateMap[shape];
  const frontMarkers = markers.filter((m) => m.view === 'front');
  const backMarkers = markers.filter((m) => m.view === 'back');

  const severityCounts = {
    minor: markers.filter((m) => m.severity === 'minor').length,
    moderate: markers.filter((m) => m.severity === 'moderate').length,
    major: markers.filter((m) => m.severity === 'major').length,
  };

  const conditionScore = calculateConditionScore(markers);
  const scoreInfo = getScoreLabel(conditionScore);

  const renderDiagram = (view: ViewAngle, viewMarkers: ConditionMarker[]) => (
    <div className="flex flex-col items-center">
      <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">{view}</h4>
      <div
        className="relative bg-gray-50 border border-gray-200 rounded-lg"
        style={{
          width: compact ? '160px' : '200px',
          height: compact ? '160px' : '200px',
        }}
      >
        <TemplateComponent className="absolute inset-0 w-full h-full text-gray-300 p-1" view={view} />

        {viewMarkers.map((marker) => {
          const config = SEVERITY_CONFIG[marker.severity];
          const markerIndex = markers.findIndex(m => m.id === marker.id) + 1;
          return (
            <div
              key={marker.id}
              className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full ${config.color} border ${config.borderColor} flex items-center justify-center`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              title={`#${markerIndex} ${marker.type}: ${marker.note}`}
            >
              <span className="text-white text-[8px] font-bold leading-none">
                {markerIndex}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (markers.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-3xl font-bold text-green-600 mb-1">100</div>
        <div className="text-sm font-medium text-green-600">Mint Condition</div>
        <p className="text-xs text-gray-500 mt-2">No issues documented</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score and summary header */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={`text-3xl font-bold ${scoreInfo.color}`}>{conditionScore}</div>
          <div className={`text-sm font-medium ${scoreInfo.color}`}>{scoreInfo.label}</div>
        </div>
        <div className="flex-1 border-l border-gray-200 pl-4">
          <div className="text-sm text-gray-600 mb-1">
            {markers.length} issue{markers.length !== 1 ? 's' : ''} documented
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(severityCounts).map(([severity, count]) => {
              if (count === 0) return null;
              const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
              return (
                <span
                  key={severity}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgLight} ${config.textColor}`}
                >
                  {count} {config.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Diagrams */}
      <div className="flex gap-4 justify-center">
        {renderDiagram('front', frontMarkers)}
        {renderDiagram('back', backMarkers)}
      </div>

      {/* Issue list */}
      <div className="space-y-2">
        {markers.map((marker, idx) => {
          const config = SEVERITY_CONFIG[marker.severity];
          return (
            <div
              key={marker.id}
              className={`flex items-start gap-3 p-2 rounded-lg ${config.bgLight}`}
            >
              <span className={`w-5 h-5 rounded-full ${config.color} border ${config.borderColor} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-[10px] font-bold">{idx + 1}</span>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{marker.type}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${config.bgLight} ${config.textColor}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">({marker.view})</span>
                </div>
                {marker.note && (
                  <p className="text-sm text-gray-600 mt-0.5">{marker.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConditionReport;
