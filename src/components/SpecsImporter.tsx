import { useState } from 'react';
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { guitarService } from '../services/guitarService';
import { VisualSourceMapper } from './VisualSourceMapper';

interface ExtractedField {
  field: string;
  value: string | number | boolean;
  confidence: number; // 0-1
  category: 'basic' | 'specs' | 'detailed';
  sourceText?: string; // Exact text snippet from source containing this value
  reasoning?: string; // Brief explanation of why this value was extracted
}

interface ExtractedSpecs {
  fields: ExtractedField[];
  rawText?: string;
}

interface SpecsImporterProps {
  onClose: () => void;
  onApply: (specs: ExtractedField[]) => void;
  existingFields: Record<string, any>; // Current form values to check for overwrites
}

type InputMethod = 'file' | 'text';
type Stage = 'input' | 'processing' | 'review' | 'mapping';

export const SpecsImporter = ({ onClose, onApply, existingFields }: SpecsImporterProps) => {
  const [stage, setStage] = useState<Stage>('input');
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extractedSpecs, setExtractedSpecs] = useState<ExtractedSpecs | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/pdf', 'text/plain'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or TXT file');
      return;
    }

    // Validate file size (30MB)
    if (selectedFile.size > 30 * 1024 * 1024) {
      setError('File must be smaller than 30MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;

    // Validate text length (50k chars)
    if (text.length > 50000) {
      setError('Text must be less than 50,000 characters');
      return;
    }

    setPastedText(text);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (inputMethod === 'file' && !file) {
      setError('Please select a file');
      return;
    }

    if (inputMethod === 'text' && !pastedText.trim()) {
      setError('Please paste some text');
      return;
    }

    setError(null);
    setStage('processing');

    try {
      let result: ExtractedSpecs;

      if (inputMethod === 'file') {
        result = await guitarService.extractSpecsFromFile(file!);
      } else {
        result = await guitarService.extractSpecsFromText(pastedText);
      }

      setExtractedSpecs(result);

      // Pre-select all fields by default
      const allFieldNames = new Set(result.fields.map(f => f.field));
      setSelectedFields(allFieldNames);

      setStage('review');
    } catch (err) {
      console.error('Error extracting specs:', err);
      setError('Failed to extract specifications. Please try again or enter manually.');
      setStage('input');
    }
  };

  const toggleField = (fieldName: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFields(newSelected);
  };

  const handleApplySpecs = () => {
    if (!extractedSpecs) return;

    const selectedSpecs = extractedSpecs.fields.filter(f => selectedFields.has(f.field));
    onApply(selectedSpecs);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
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
      countryOfOrigin: 'Country of Origin',
      // Detailed specs
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

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      basic: 'Basic Information',
      specs: 'Specifications',
      detailed: 'Detailed Specifications',
    };
    return labels[category] || category;
  };

  const willOverwrite = (fieldName: string): boolean => {
    return existingFields[fieldName] !== undefined &&
           existingFields[fieldName] !== '' &&
           existingFields[fieldName] !== null;
  };

  const groupedFields = extractedSpecs?.fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ExtractedField[]>) || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import Guitar Specifications</h2>
              <p className="text-sm text-gray-600">
                {stage === 'input' && 'Upload a document or paste text to extract specs'}
                {stage === 'processing' && 'Analyzing specifications...'}
                {stage === 'review' && 'Review and select fields to import'}
                {stage === 'mapping' && 'View source document and extracted field locations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'input' && (
            <div className="space-y-6">
              {/* Input Method Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Choose input method:</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setInputMethod('file')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      inputMethod === 'file'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2 text-primary-600" />
                    <div className="font-medium text-gray-900">Upload File</div>
                    <div className="text-sm text-gray-600">PDF or TXT</div>
                  </button>
                  <button
                    onClick={() => setInputMethod('text')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      inputMethod === 'text'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <FileText className="w-6 h-6 mx-auto mb-2 text-primary-600" />
                    <div className="font-medium text-gray-900">Paste Text</div>
                    <div className="text-sm text-gray-600">Copy & paste</div>
                  </button>
                </div>
              </div>

              {/* File Upload */}
              {inputMethod === 'file' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Select file:</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                      id="specs-file-input"
                    />
                    <label htmlFor="specs-file-input" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      {file ? (
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-gray-900">Click to upload</p>
                          <p className="text-sm text-gray-600 mt-1">
                            PDF or TXT (max 30MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Text Paste */}
              {inputMethod === 'text' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Paste specifications:</label>
                  <textarea
                    value={pastedText}
                    onChange={handleTextChange}
                    placeholder="Paste guitar specifications from manufacturer website or spec sheet..."
                    rows={12}
                    className="input-field resize-none font-mono text-sm"
                  />
                  <p className="text-sm text-gray-600">
                    {pastedText.length.toLocaleString()} / 50,000 characters
                  </p>
                </div>
              )}

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Tips for best results:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Use official manufacturer spec sheets or product pages</li>
                      <li>Include as much detail as possible</li>
                      <li>Technical specifications work better than marketing copy</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-16 h-16 animate-spin text-primary-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing specifications...</h3>
              <p className="text-sm text-gray-600">This may take 10-30 seconds</p>
            </div>
          )}

          {stage === 'review' && extractedSpecs && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">
                      Found {extractedSpecs.fields.length} specifications
                    </p>
                    <p className="text-sm text-green-800">
                      Review and select which fields to import
                    </p>
                  </div>
                </div>
              </div>

              {/* Extracted Fields by Category */}
              {Object.entries(groupedFields).map(([category, fields]) => (
                <div key={category} className="space-y-1.5">
                  <h3 className="font-semibold text-gray-900 text-sm">{getCategoryLabel(category)}</h3>
                  <div className="space-y-1.5">
                    {fields.map((field) => (
                      <div
                        key={field.field}
                        className={`border rounded-lg p-2.5 transition-all ${
                          selectedFields.has(field.field)
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedFields.has(field.field)}
                              onChange={() => toggleField(field.field)}
                              className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 text-sm">
                                  {getFieldLabel(field.field)}
                                </span>
                                {willOverwrite(field.field) && (
                                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                                    Will overwrite
                                  </span>
                                )}
                              </div>
                              {willOverwrite(field.field) ? (
                                <div className="space-y-1">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 font-medium min-w-[60px]">Existing:</span>
                                    <span className="text-sm text-gray-600 line-through">{String(existingFields[field.field])}</span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs text-green-600 font-medium min-w-[60px]">New:</span>
                                    <span className="text-sm text-green-700 font-medium">{String(field.value)}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-700 text-sm">{String(field.value)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getConfidenceColor(
                                field.confidence
                              )}`}
                            >
                              {getConfidenceLabel(field.confidence)} ({Math.round(field.confidence * 100)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Selection Summary */}
              <div className="text-sm text-gray-600">
                {selectedFields.size} of {extractedSpecs.fields.length} fields selected
              </div>
            </div>
          )}

          {stage === 'mapping' && extractedSpecs && extractedSpecs.rawText && (
            <div className="h-[600px]">
              <VisualSourceMapper
                fields={extractedSpecs.fields}
                rawText={extractedSpecs.rawText}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          {stage === 'input' && (
            <>
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={
                  (inputMethod === 'file' && !file) ||
                  (inputMethod === 'text' && !pastedText.trim())
                }
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Specs
              </button>
            </>
          )}

          {stage === 'review' && (
            <>
              <button onClick={() => setStage('input')} className="btn-secondary">
                ← Back
              </button>
              <div className="flex items-center gap-3">
                {extractedSpecs?.rawText && (
                  <button
                    onClick={() => setStage('mapping')}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    View Source Mapping
                  </button>
                )}
                <button
                  onClick={handleApplySpecs}
                  disabled={selectedFields.size === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply {selectedFields.size} Field{selectedFields.size !== 1 ? 's' : ''} to Form
                </button>
              </div>
            </>
          )}

          {stage === 'mapping' && (
            <>
              <button onClick={() => setStage('review')} className="btn-secondary">
                ← Back to Review
              </button>
              <button
                onClick={handleApplySpecs}
                disabled={selectedFields.size === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                Apply {selectedFields.size} Field{selectedFields.size !== 1 ? 's' : ''} to Form
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
