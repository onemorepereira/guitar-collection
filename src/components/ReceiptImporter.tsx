import { useState } from 'react';
import { Receipt, Upload, FileText, X, Check, AlertTriangle, DollarSign, Calendar, Store, Package, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { guitarService } from '../services/guitarService';

interface PurchaseInfo {
  totalPaid: number;
  currency?: string;
  itemization?: string;
  merchantName: string;
  merchantType: 'retailer' | 'marketplace' | 'private_seller' | 'auction';
  merchantLocation?: string;
  merchantWebsite?: string;
  sellerUsername?: string;
  sellerEmail?: string;
  sellerNotes?: string;
  serialNumber?: string;
  productDescription?: string;
  productCondition?: string;
  purchaseDate: string;
  isMultiItem: boolean;
  lineItems?: Array<{
    description: string;
    price: number;
    isGuitar: boolean;
  }>;
  overallConfidence: number;
  warnings?: string[];
}

interface ReceiptExtractionResult {
  purchaseInfo: PurchaseInfo;
  rawText: string;
}

interface ReceiptImporterProps {
  onApply: (receiptData: {
    purchasePrice: number;
    purchaseDate: string;
    purchaseLocation: string;
    serialNumber?: string;
    notesAddition?: string;
  }) => void;
  onClose: () => void;
}

type Stage = 'input' | 'processing' | 'review' | 'multi-item-select';

export const ReceiptImporter = ({ onApply, onClose }: ReceiptImporterProps) => {
  const [stage, setStage] = useState<Stage>('input');
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [extractionResult, setExtractionResult] = useState<ReceiptExtractionResult | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleExtract = async () => {
    setError(null);
    setStage('processing');

    try {
      let result: ReceiptExtractionResult;

      if (inputMethod === 'file' && file) {
        result = await guitarService.extractReceiptFromFile(file);
      } else if (inputMethod === 'text' && textInput.trim()) {
        result = await guitarService.extractReceiptFromText(textInput);
      } else {
        throw new Error('Please provide a receipt file or paste receipt text');
      }

      setExtractionResult(result);

      // Check if multi-item and needs selection
      if (result.purchaseInfo.isMultiItem && result.purchaseInfo.lineItems) {
        setStage('multi-item-select');
      } else {
        setStage('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract receipt information');
      setStage('input');
    }
  };

  const handleMultiItemSelect = (itemIndex: number) => {
    setSelectedItemIndex(itemIndex);
    setStage('review');
  };

  const handleApply = () => {
    if (!extractionResult) return;

    const purchaseInfo = extractionResult.purchaseInfo;
    let totalPaid = purchaseInfo.totalPaid;
    let notesAddition = '';

    // If multi-item and user selected one, calculate proportional price
    if (purchaseInfo.isMultiItem && selectedItemIndex !== null && purchaseInfo.lineItems) {
      const selectedItem = purchaseInfo.lineItems[selectedItemIndex];
      const guitarItems = purchaseInfo.lineItems.filter(item => item.isGuitar);
      const subtotal = guitarItems.reduce((sum, item) => sum + item.price, 0);
      const proportion = selectedItem.price / subtotal;

      // Allocate total proportionally
      totalPaid = purchaseInfo.totalPaid * proportion;

      notesAddition = `Purchase Details (from receipt):\n`;
      notesAddition += `Selected: ${selectedItem.description} - $${selectedItem.price.toFixed(2)}\n`;
      notesAddition += `Proportional allocation: ${(proportion * 100).toFixed(1)}% of total\n`;
      notesAddition += `Total paid (allocated): $${totalPaid.toFixed(2)}\n`;
    } else {
      notesAddition = 'Purchase Details (from receipt):\n';
      notesAddition += `Total paid: $${totalPaid.toFixed(2)}\n`;
    }

    // Add merchant info
    notesAddition += `Merchant: ${purchaseInfo.merchantName}`;
    if (purchaseInfo.merchantLocation) {
      notesAddition += ` (${purchaseInfo.merchantLocation})`;
    }
    notesAddition += '\n';

    // Add seller info if marketplace/private
    if (purchaseInfo.sellerUsername || purchaseInfo.sellerEmail || purchaseInfo.sellerNotes) {
      notesAddition += 'Seller: ';
      if (purchaseInfo.sellerUsername) notesAddition += purchaseInfo.sellerUsername;
      if (purchaseInfo.sellerEmail) notesAddition += ` (${purchaseInfo.sellerEmail})`;
      if (purchaseInfo.sellerNotes) notesAddition += `\n${purchaseInfo.sellerNotes}`;
      notesAddition += '\n';
    }

    // Add itemization if available
    if (purchaseInfo.itemization) {
      notesAddition += `\nBreakdown: ${purchaseInfo.itemization}\n`;
    }

    // Add product details
    if (purchaseInfo.productDescription) {
      notesAddition += `Product: ${purchaseInfo.productDescription}\n`;
    }
    if (purchaseInfo.productCondition) {
      notesAddition += `Condition: ${purchaseInfo.productCondition}\n`;
    }

    // Build purchase location string
    let purchaseLocation = purchaseInfo.merchantName;
    if (purchaseInfo.merchantType === 'marketplace' && purchaseInfo.sellerUsername) {
      purchaseLocation = `${purchaseInfo.merchantName} (${purchaseInfo.sellerUsername})`;
    } else if (purchaseInfo.merchantLocation && purchaseInfo.merchantLocation !== 'Online') {
      purchaseLocation = `${purchaseInfo.merchantName}, ${purchaseInfo.merchantLocation}`;
    }

    onApply({
      purchasePrice: Math.round(totalPaid * 100) / 100, // Round to 2 decimals
      purchaseDate: purchaseInfo.purchaseDate,
      purchaseLocation,
      serialNumber: purchaseInfo.serialNumber,
      notesAddition: notesAddition.trim(),
    });
  };

  const renderInputStage = () => (
    <div className="space-y-4">
      {/* Input method selector */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setInputMethod('file')}
          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
            inputMethod === 'file'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-primary-300'
          }`}
        >
          <Upload className="w-5 h-5 mx-auto mb-1" />
          <span className="text-sm font-medium">Upload File</span>
        </button>
        <button
          type="button"
          onClick={() => setInputMethod('text')}
          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
            inputMethod === 'text'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-primary-300'
          }`}
        >
          <FileText className="w-5 h-5 mx-auto mb-1" />
          <span className="text-sm font-medium">Paste Text</span>
        </button>
      </div>

      {inputMethod === 'file' ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="receipt-file-input"
          />
          <label htmlFor="receipt-file-input" className="cursor-pointer">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Click to upload receipt
                </p>
                <p className="text-xs text-gray-500">PDF or TXT files accepted</p>
              </div>
            )}
          </label>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste Receipt Text
          </label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste receipt contents here (email receipts, invoices, etc.)..."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Extraction Failed</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">Receipt Import Tips</p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Works with Sweetwater, Reverb, Guitar Center, eBay receipts</li>
              <li>Extracts total paid, purchase date, merchant, serial number</li>
              <li>Handles multi-guitar receipts with proportional allocation</li>
              <li>Itemizes accessories and services in notes for provenance</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleExtract}
          disabled={inputMethod === 'file' ? !file : !textInput.trim()}
          className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Extract Receipt Info
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderProcessingStage = () => (
    <div className="text-center py-12">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Analyzing Receipt...
      </h3>
      <p className="text-sm text-gray-600">
        Extracting purchase details with AI
      </p>
    </div>
  );

  const renderMultiItemSelect = () => {
    if (!extractionResult || !extractionResult.purchaseInfo.lineItems) return null;

    const purchaseInfo = extractionResult.purchaseInfo;
    const guitarItems = purchaseInfo.lineItems!.filter(item => item.isGuitar);
    const subtotal = guitarItems.reduce((sum, item) => sum + item.price, 0);

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900">Multi-Item Receipt Detected</h4>
              <p className="text-sm text-amber-800 mt-1">
                This receipt contains {guitarItems.length} guitar{guitarItems.length > 1 ? 's' : ''}.
                Select which one this entry is for. The total price will be allocated proportionally.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-900">Receipt Summary</span>
              <span className="text-gray-600">
                Total: ${purchaseInfo.totalPaid.toFixed(2)} {purchaseInfo.currency || 'USD'}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {guitarItems.map((item, index) => {
              const proportion = item.price / subtotal;
              const allocatedPrice = purchaseInfo.totalPaid * proportion;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleMultiItemSelect(index)}
                  className="w-full text-left border-2 border-gray-200 rounded-lg p-3 hover:border-primary-400 hover:bg-primary-50 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Item price: ${item.price.toFixed(2)} ({(proportion * 100).toFixed(1)}% of subtotal)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary-600">
                        ${allocatedPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">allocated total</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 inline-block">
                    Includes proportional tax & shipping
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderReviewStage = () => {
    if (!extractionResult) return null;

    const purchaseInfo = extractionResult.purchaseInfo;
    let displayPrice = purchaseInfo.totalPaid;
    let priceNote = '';

    // Calculate allocated price if multi-item
    if (purchaseInfo.isMultiItem && selectedItemIndex !== null && purchaseInfo.lineItems) {
      const selectedItem = purchaseInfo.lineItems[selectedItemIndex];
      const guitarItems = purchaseInfo.lineItems.filter(item => item.isGuitar);
      const subtotal = guitarItems.reduce((sum, item) => sum + item.price, 0);
      const proportion = selectedItem.price / subtotal;
      displayPrice = purchaseInfo.totalPaid * proportion;
      priceNote = `${selectedItem.description} (${(proportion * 100).toFixed(1)}% allocated)`;
    }

    const confidenceColor = purchaseInfo.overallConfidence >= 0.9
      ? 'text-green-600 bg-green-50 border-green-200'
      : purchaseInfo.overallConfidence >= 0.8
      ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
      : 'text-red-600 bg-red-50 border-red-200';

    return (
      <div className="space-y-4">
        {/* Confidence Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-medium text-sm ${confidenceColor}`}>
          <Check className="w-4 h-4" />
          {Math.round(purchaseInfo.overallConfidence * 100)}% Confidence
        </div>

        {/* Warnings */}
        {purchaseInfo.warnings && purchaseInfo.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Please Review</p>
                <ul className="text-sm text-amber-700 mt-1 space-y-1">
                  {purchaseInfo.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Details */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Extracted Purchase Information</h4>
          </div>

          <div className="p-4 space-y-3">
            {/* Total Paid */}
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-600">Total Paid</div>
                <div className="text-lg font-bold text-gray-900">
                  ${displayPrice.toFixed(2)} {purchaseInfo.currency || 'USD'}
                </div>
                {priceNote && (
                  <div className="text-xs text-gray-500 mt-1">{priceNote}</div>
                )}
              </div>
            </div>

            {/* Purchase Date */}
            <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-600">Purchase Date</div>
                <div className="text-base text-gray-900">
                  {new Date(purchaseInfo.purchaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>

            {/* Merchant */}
            <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
              <Store className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-600">Merchant</div>
                <div className="text-base text-gray-900">{purchaseInfo.merchantName}</div>
                {purchaseInfo.merchantLocation && (
                  <div className="text-sm text-gray-600 mt-1">{purchaseInfo.merchantLocation}</div>
                )}
                {purchaseInfo.merchantWebsite && (
                  <div className="text-sm text-primary-600 mt-1">{purchaseInfo.merchantWebsite}</div>
                )}
              </div>
            </div>

            {/* Seller (if marketplace) */}
            {(purchaseInfo.sellerUsername || purchaseInfo.sellerNotes) && (
              <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                <Package className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-600">Seller</div>
                  {purchaseInfo.sellerUsername && (
                    <div className="text-base text-gray-900">{purchaseInfo.sellerUsername}</div>
                  )}
                  {purchaseInfo.sellerNotes && (
                    <div className="text-sm text-gray-600 mt-1">{purchaseInfo.sellerNotes}</div>
                  )}
                </div>
              </div>
            )}

            {/* Serial Number */}
            {purchaseInfo.serialNumber && (
              <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                <Package className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-600">Serial Number</div>
                  <div className="text-base font-mono text-gray-900">{purchaseInfo.serialNumber}</div>
                </div>
              </div>
            )}

            {/* Itemization */}
            {purchaseInfo.itemization && (
              <div className="pt-3 border-t border-gray-100">
                <div className="text-sm font-medium text-gray-600 mb-2">Itemization</div>
                <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 font-mono">
                  {purchaseInfo.itemization}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Raw Text Viewer */}
        {extractionResult && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900 text-sm">
                  View Extracted Text from PDF ({extractionResult.rawText.length.toLocaleString()} characters)
                </span>
              </div>
              {showRawText ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {showRawText && (
              <div className="p-4 bg-white border-t border-gray-200">
                {extractionResult.rawText.length < 100 ? (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">Low Text Content Warning</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Only {extractionResult.rawText.length} characters extracted. PDF parsing may have failed.
                        Consider copying the text from the PDF and using "Paste Text" instead.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="max-h-64 overflow-y-auto bg-gray-50 rounded border border-gray-200 p-3">
                  <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
                    {extractionResult.rawText}
                  </pre>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  This is the text that was extracted from your file and sent to the AI for analysis.
                  If this doesn't look right, try the "Paste Text" option instead.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            This information will be added to Private Info (price, date, location) and Notes (itemization, seller details).
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            Apply to Guitar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import Receipt</h2>
              <p className="text-sm text-gray-600">Extract purchase details automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === 'input' && renderInputStage()}
          {stage === 'processing' && renderProcessingStage()}
          {stage === 'multi-item-select' && renderMultiItemSelect()}
          {stage === 'review' && renderReviewStage()}
        </div>
      </div>
    </div>
  );
};
