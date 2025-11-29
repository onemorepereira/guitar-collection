import { useState, useRef, useCallback, useEffect } from 'react';
import { X, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { GuitarTemplateMap, GuitarShape, ViewAngle } from './GuitarTemplates';

export interface ConditionMarker {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  view: ViewAngle;
  severity: 'minor' | 'moderate' | 'major';
  type: string; // scratch, ding, chip, wear, crack, etc.
  note: string;
}

interface ConditionDiagramProps {
  shape: GuitarShape;
  markers: ConditionMarker[];
  onMarkersChange: (markers: ConditionMarker[]) => void;
  readOnly?: boolean;
}

const MARKER_TYPES = [
  'Scratch',
  'Ding / dent',
  'Chip',
  'Crack',
  'Wear',
  'Fret issue',
  'Hardware issue',
  'Electronics issue',
  'Repair',
  'Modification',
  'Other',
];

const SEVERITY_CONFIG = {
  minor: {
    label: 'Minor',
    color: 'bg-yellow-400',
    borderColor: 'border-yellow-500',
    bgLight: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: Info,
    description: 'Cosmetic only, barely visible',
  },
  moderate: {
    label: 'Moderate',
    color: 'bg-orange-400',
    borderColor: 'border-orange-500',
    bgLight: 'bg-orange-50 dark:bg-orange-900/20',
    icon: AlertTriangle,
    description: 'Visible but doesn\'t affect playability',
  },
  major: {
    label: 'Major',
    color: 'bg-red-500',
    borderColor: 'border-red-600',
    bgLight: 'bg-red-50 dark:bg-red-900/20',
    icon: AlertCircle,
    description: 'Significant damage or affects playability',
  },
};

export const ConditionDiagram = ({
  shape,
  markers,
  onMarkersChange,
  readOnly = false,
}: ConditionDiagramProps) => {
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [newMarkerPos, setNewMarkerPos] = useState<{ x: number; y: number; view: ViewAngle } | null>(null);
  const frontDiagramRef = useRef<HTMLDivElement>(null);
  const backDiagramRef = useRef<HTMLDivElement>(null);

  const TemplateComponent = GuitarTemplateMap[shape];

  const frontMarkers = markers.filter((m) => m.view === 'front');
  const backMarkers = markers.filter((m) => m.view === 'back');

  const handleDiagramClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, view: ViewAngle, ref: React.RefObject<HTMLDivElement>) => {
      if (readOnly) return;

      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setSelectedMarker(null);
      setNewMarkerPos({ x, y, view });
    },
    [readOnly]
  );

  const handleAddMarker = (type: string, severity: ConditionMarker['severity'], note: string) => {
    if (!newMarkerPos) return;

    const newMarker: ConditionMarker = {
      id: `marker-${Date.now()}`,
      x: newMarkerPos.x,
      y: newMarkerPos.y,
      view: newMarkerPos.view,
      severity,
      type,
      note,
    };

    onMarkersChange([...markers, newMarker]);
    setNewMarkerPos(null);
  };

  const handleDeleteMarker = (id: string) => {
    onMarkersChange(markers.filter((m) => m.id !== id));
    setSelectedMarker(null);
  };

  const handleUpdateMarker = (id: string, updates: Partial<ConditionMarker>) => {
    onMarkersChange(
      markers.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const selectedMarkerData = markers.find((m) => m.id === selectedMarker);

  // Close dialogs on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewMarkerPos(null);
        setSelectedMarker(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dialogs when clicking outside the component
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setNewMarkerPos(null);
        setSelectedMarker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to render a single diagram
  const renderDiagram = (view: ViewAngle, ref: React.RefObject<HTMLDivElement>, viewMarkers: ConditionMarker[]) => (
    <div className="text-center flex-1 min-w-[280px]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 capitalize">{view}</h3>
      <div
        ref={ref}
        onClick={(e) => handleDiagramClick(e, view, ref)}
        className={`relative bg-gray-50 dark:bg-gray-800 border-2 rounded-xl mx-auto aspect-square ${
          !readOnly ? 'cursor-crosshair border-blue-300 dark:border-blue-600' : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <TemplateComponent className="absolute inset-0 w-full h-full text-gray-400 dark:text-gray-500 p-2" view={view} />

        {/* Existing markers */}
        {viewMarkers.map((marker) => {
          const config = SEVERITY_CONFIG[marker.severity];
          const markerIndex = markers.findIndex(m => m.id === marker.id) + 1;
          return (
            <button
              type="button"
              key={marker.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMarker(marker.id);
              }}
              className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full ${config.color} border ${config.borderColor} shadow-md flex items-center justify-center transition-transform hover:scale-125 ${
                selectedMarker === marker.id ? 'ring-2 ring-offset-1 ring-primary-500 scale-125' : ''
              }`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              title={`#${markerIndex} ${marker.type}: ${marker.note}`}
            >
              <span className="text-white text-[10px] font-bold leading-none">
                {markerIndex}
              </span>
            </button>
          );
        })}

        {/* New marker placement */}
        {newMarkerPos && newMarkerPos.view === view && (
          <div
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-blue-500 border border-blue-600 animate-pulse flex items-center justify-center"
            style={{ left: `${newMarkerPos.x}%`, top: `${newMarkerPos.y}%` }}
          >
            <span className="text-white text-[10px] font-bold leading-none">
              {markers.length + 1}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="space-y-4 overflow-hidden">
      {/* Both diagrams side by side */}
      <div className="flex flex-wrap justify-center gap-4">
        {renderDiagram('front', frontDiagramRef, frontMarkers)}
        {renderDiagram('back', backDiagramRef, backMarkers)}
      </div>

      {/* Marker form/details panel */}
      {(newMarkerPos || selectedMarkerData) && (
        <div className="mx-auto">
          {newMarkerPos ? (
            <NewMarkerForm
              onSubmit={handleAddMarker}
              onCancel={() => setNewMarkerPos(null)}
            />
          ) : selectedMarkerData ? (
            <MarkerDetails
              marker={selectedMarkerData}
              onUpdate={(updates) => handleUpdateMarker(selectedMarkerData.id, updates)}
              onDelete={() => handleDeleteMarker(selectedMarkerData.id)}
              onClose={() => setSelectedMarker(null)}
              readOnly={readOnly}
            />
          ) : null}
        </div>
      )}

      {/* Blemishes list */}
      {markers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Condition Issues ({markers.length})</h4>
            <div className="flex gap-3 text-xs">
              {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => {
                const count = markers.filter((m) => m.severity === severity).length;
                if (count === 0) return null;
                return (
                  <div key={severity} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${config.color}`} />
                    <span className="text-gray-500 dark:text-gray-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {markers.map((marker, idx) => {
              const config = SEVERITY_CONFIG[marker.severity];
              return (
                <button
                  type="button"
                  key={marker.id}
                  onClick={() => setSelectedMarker(marker.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${config.bgLight} ${
                    selectedMarker === marker.id
                      ? `border-2 ${config.borderColor}`
                      : 'border border-transparent hover:opacity-80'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${config.color} border ${config.borderColor} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{idx + 1}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{marker.type}</div>
                    {marker.note && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{marker.note}</div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{marker.view}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {markers.length === 0 && !newMarkerPos && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400">
          <Info className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
          <p className="text-sm">No condition markers yet. Click on either diagram to add blemishes.</p>
        </div>
      )}
    </div>
  );
};

// Form for adding a new marker
interface NewMarkerFormProps {
  onSubmit: (type: string, severity: ConditionMarker['severity'], note: string) => void;
  onCancel: () => void;
}

const NewMarkerForm = ({ onSubmit, onCancel }: NewMarkerFormProps) => {
  const [type, setType] = useState('Scratch');
  const [severity, setSeverity] = useState<ConditionMarker['severity']>('minor');
  const [note, setNote] = useState('');

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Condition Marker</h3>

      <div className="space-y-4">
        <div>
          <label className="label">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input-field text-sm"
          >
            {MARKER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Severity</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <button
                type="button"
                key={key}
                onClick={() => setSeverity(key as ConditionMarker['severity'])}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  severity === key
                    ? `${config.borderColor} bg-opacity-20`
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <span className={`inline-block w-4 h-4 rounded-full ${config.color} mb-1`} />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the condition issue..."
            className="input-field"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(type, severity, note)}
            className="btn-primary flex-1"
          >
            Add Marker
          </button>
        </div>
      </div>
    </div>
  );
};

// Details view for existing marker
interface MarkerDetailsProps {
  marker: ConditionMarker;
  onUpdate: (updates: Partial<ConditionMarker>) => void;
  onDelete: () => void;
  onClose: () => void;
  readOnly: boolean;
}

const MarkerDetails = ({ marker, onUpdate, onDelete, onClose, readOnly }: MarkerDetailsProps) => {
  const config = SEVERITY_CONFIG[marker.severity];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-full ${config.color}`} />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{marker.type}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            marker.severity === 'minor' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
            marker.severity === 'moderate' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {config.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Location</label>
          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{marker.view} view</p>
        </div>

        {readOnly ? (
          <div>
            <label className="label">Note</label>
            <p className="text-sm text-gray-600 dark:text-gray-400">{marker.note || 'No note provided'}</p>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Type</label>
              <select
                value={marker.type}
                onChange={(e) => onUpdate({ type: e.target.value })}
                className="input-field text-sm"
              >
                {MARKER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Severity</label>
              <div className="flex gap-2">
                {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onUpdate({ severity: key as ConditionMarker['severity'] })}
                    className={`flex-1 p-2 rounded-lg border-2 text-center text-sm transition-colors ${
                      marker.severity === key
                        ? `${cfg.borderColor}`
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className={`inline-block w-3 h-3 rounded-full ${cfg.color} mr-1`} />
                    <span className="text-gray-900 dark:text-gray-100">{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Note</label>
              <textarea
                value={marker.note}
                onChange={(e) => onUpdate({ note: e.target.value })}
                placeholder="Describe the condition issue..."
                className="input-field"
                rows={3}
              />
            </div>

            <button
              type="button"
              onClick={onDelete}
              className="w-full px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
            >
              Delete Marker
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConditionDiagram;
