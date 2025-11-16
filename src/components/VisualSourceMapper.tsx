import { useState, useRef, useEffect } from 'react';
import { Search, X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ExtractedField {
  field: string;
  value: string | number | boolean;
  confidence: number;
  category: 'basic' | 'specs' | 'detailed';
  sourceText?: string;
  reasoning?: string;
}

interface VisualSourceMapperProps {
  fields: ExtractedField[];
  rawText: string;
}

export const VisualSourceMapper = ({ fields, rawText }: VisualSourceMapperProps) => {
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [highlightedRanges, setHighlightedRanges] = useState<Array<{ start: number; end: number; field: string }>>([]);
  const sourceTextRef = useRef<HTMLDivElement>(null);

  // Find all occurrences of sourceText in rawText and calculate ranges
  useEffect(() => {
    const ranges: Array<{ start: number; end: number; field: string }> = [];

    fields.forEach((field) => {
      if (!field.sourceText) return;

      // Find all occurrences of this sourceText in the raw text
      const searchText = field.sourceText;
      const lowerRawText = rawText.toLowerCase();
      const lowerSearchText = searchText.toLowerCase();

      let index = lowerRawText.indexOf(lowerSearchText);
      while (index !== -1) {
        ranges.push({
          start: index,
          end: index + searchText.length,
          field: field.field,
        });
        // Find next occurrence
        index = lowerRawText.indexOf(lowerSearchText, index + 1);
      }
    });

    setHighlightedRanges(ranges);
  }, [fields, rawText]);

  // Scroll to highlighted text when field is selected
  useEffect(() => {
    if (!selectedField || !sourceTextRef.current) return;

    const selectedRange = highlightedRanges.find(r => r.field === selectedField);
    if (!selectedRange) return;

    // Find the highlighted element and scroll to it
    const highlightElements = sourceTextRef.current.querySelectorAll(`[data-field="${selectedField}"]`);
    if (highlightElements.length > 0) {
      highlightElements[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedField, highlightedRanges]);

  const renderHighlightedText = () => {
    if (highlightedRanges.length === 0) {
      return <div className="whitespace-pre-wrap font-mono text-[0.65rem] leading-relaxed text-gray-700">{rawText}</div>;
    }

    // Sort ranges by start position
    const sortedRanges = [...highlightedRanges].sort((a, b) => a.start - b.start);

    // Build the highlighted text
    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    sortedRanges.forEach((range, i) => {
      // Add text before this highlight
      if (range.start > lastIndex) {
        elements.push(
          <span key={`text-${i}`}>
            {rawText.substring(lastIndex, range.start)}
          </span>
        );
      }

      // Add highlighted text
      const isSelected = range.field === selectedField;
      elements.push(
        <mark
          key={`mark-${i}`}
          data-field={range.field}
          className={`rounded px-0.5 cursor-pointer transition-colors ${
            isSelected
              ? 'bg-primary-400 text-white font-semibold'
              : 'bg-yellow-200 hover:bg-yellow-300'
          }`}
          onClick={() => setSelectedField(range.field)}
          title={`Click to view ${range.field} details`}
        >
          {rawText.substring(range.start, range.end)}
        </mark>
      );

      lastIndex = range.end;
    });

    // Add remaining text
    if (lastIndex < rawText.length) {
      elements.push(
        <span key="text-end">
          {rawText.substring(lastIndex)}
        </span>
      );
    }

    return <div className="whitespace-pre-wrap font-mono text-[0.65rem] leading-relaxed text-gray-700">{elements}</div>;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getFieldLabel = (fieldName: string): string => {
    const labels: Record<string, string> = {
      brand: 'Brand',
      model: 'Model',
      year: 'Year',
      type: 'Type',
      bodyMaterial: 'Body Material',
      neckMaterial: 'Neck Material',
      fretboardMaterial: 'Fretboard Material',
      numberOfFrets: 'Number of Frets',
      scaleLength: 'Scale Length',
      pickupConfiguration: 'Pickup Configuration',
      color: 'Color',
      finish: 'Finish',
      tuningMachines: 'Tuning Machines',
      bridge: 'Bridge',
      nut: 'Nut',
      electronics: 'Electronics',
      caseIncluded: 'Case Included',
      countryOfOrigin: 'Country of Origin',
      bodyShape: 'Body Shape',
      neckProfile: 'Neck Profile',
      neckJoint: 'Neck Joint',
      fretboardRadius: 'Fretboard Radius',
      fretSize: 'Fret Size',
      neckPickup: 'Neck Pickup',
      bridgePickup: 'Bridge Pickup',
      hardwareFinish: 'Hardware Finish',
    };
    return labels[fieldName] || fieldName;
  };

  const selectedFieldData = fields.find(f => f.field === selectedField);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-primary-600 mb-2">
          <Search className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Source Document Mapping</h3>
        </div>
        <p className="text-sm text-gray-600">
          Click on any field to see where it was found in the source document.
          Highlighted text shows extracted values.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 grid grid-cols-2 gap-4 mt-4 overflow-hidden">
        {/* Left column: Source text */}
        <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
            <h4 className="font-semibold text-sm text-gray-900">Source Document</h4>
            <p className="text-xs text-gray-600">{rawText.length.toLocaleString()} characters</p>
          </div>
          <div
            ref={sourceTextRef}
            className="flex-1 overflow-y-auto p-4"
          >
            {renderHighlightedText()}
          </div>
        </div>

        {/* Right column: Extracted fields */}
        <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
            <h4 className="font-semibold text-sm text-gray-900">Extracted Fields ({fields.length})</h4>
            <p className="text-xs text-gray-600">Click to view source location</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {fields.map((field) => (
              <div
                key={field.field}
                onClick={() => setSelectedField(field.field)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  selectedField === field.field
                    ? 'border-primary-400 bg-primary-50 shadow-md'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {getFieldLabel(field.field)}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      {String(field.value)}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getConfidenceColor(field.confidence)}`}>
                    {getConfidenceLabel(field.confidence)} {Math.round(field.confidence * 100)}%
                  </div>
                </div>

                {/* Source text preview */}
                {field.sourceText && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-start gap-1.5">
                      <Search className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Source:</div>
                        <div className="text-xs text-gray-700 font-mono bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                          "{field.sourceText}"
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reasoning */}
                {field.reasoning && selectedField === field.field && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">AI Reasoning:</div>
                        <div className="text-xs text-gray-700 italic">
                          {field.reasoning}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
