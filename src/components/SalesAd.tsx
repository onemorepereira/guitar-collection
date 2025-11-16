import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Copy, ArrowLeft, Check } from 'lucide-react';
import { provenanceService } from '../services/provenanceService';
import { SalesAdReport } from '../types/guitar';

export default function SalesAd() {
  const { guitarId, reportId } = useParams<{ guitarId: string; reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<SalesAdReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReport();
  }, [guitarId, reportId]);

  const loadReport = async () => {
    if (!guitarId || !reportId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await provenanceService.getReport(guitarId, reportId);
      // Type guard to ensure we got a sales ad
      if (data.reportType !== 'sales_ad') {
        throw new Error('Invalid report type');
      }
      setReport(data as unknown as SalesAdReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales ad');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(`/guitar/${guitarId}`);
  };

  const handleCopyToClipboard = async () => {
    if (!report) return;

    const { reportData } = report;
    const adText = `${reportData.headline}

${reportData.description}

KEY FEATURES:
${reportData.features.map(f => `• ${f}`).join('\n')}

SPECIFICATIONS:
${Object.entries(reportData.specifications)
  .filter(([key]) => key !== 'raw')
  .map(([category, specs]) => {
    if (!specs || Object.keys(specs).length === 0) return '';
    return `${category.toUpperCase()}:\n${Object.entries(specs)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')}`;
  })
  .filter(Boolean)
  .join('\n\n')}

CONDITION: ${reportData.condition}
${reportData.price ? `PRICE: $${reportData.price.toLocaleString()}` : ''}
${reportData.metadata.serialNumber ? `SERIAL NUMBER: ${reportData.metadata.serialNumber}` : ''}
`;

    try {
      await navigator.clipboard.writeText(adText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sales ad...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Report not found'}</p>
          <button onClick={handleBack} className="btn-primary">
            Back to Guitar
          </button>
        </div>
      </div>
    );
  }

  const { reportData, generatedAt, version } = report;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Bar - Hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Guitar
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="btn-outline flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Text
                </>
              )}
            </button>
            <button onClick={handlePrint} className="btn-outline flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Sales Ad Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="bg-white shadow-lg print:shadow-none p-8">
          {/* Headline */}
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {reportData.headline}
          </h1>

          {/* Primary Image (if available) */}
          {reportData.images && reportData.images.length > 0 && (
            <div className="mb-6">
              <img
                src={reportData.images[0].url}
                alt={reportData.headline}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}

          {/* Price and Condition */}
          <div className="flex justify-between items-center mb-6 pb-6 border-b-2 border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Condition</p>
              <p className="text-xl font-semibold text-gray-900">{reportData.condition}</p>
            </div>
            {reportData.price && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-3xl font-bold text-primary-600">
                  ${reportData.price.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {reportData.description}
            </div>
          </div>

          {/* Key Features */}
          {reportData.features && reportData.features.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>
              <ul className="space-y-2">
                {reportData.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-primary-600 mt-1">•</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Specifications */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(reportData.specifications)
                .filter(([key]) => key !== 'raw')
                .map(([category, specs]) => {
                  if (!specs || typeof specs !== 'object' || Object.keys(specs).length === 0) return null;
                  return (
                    <div key={category}>
                      <h3 className="font-semibold text-gray-900 mb-2 capitalize">
                        {category}
                      </h3>
                      <dl className="space-y-1">
                        {Object.entries(specs).map(([key, value]) => (
                          <div key={key} className="flex">
                            <dt className="text-gray-600 min-w-[120px] capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </dt>
                            <dd className="text-gray-900">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Additional Images */}
          {reportData.images && reportData.images.length > 1 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Additional Photos</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {reportData.images.slice(1).map((image, idx) => (
                  <img
                    key={idx}
                    src={image.url}
                    alt={`${reportData.headline} - Photo ${idx + 2}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t-2 border-gray-200">
            <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
              <div>
                <p>
                  {reportData.metadata.guitarYear} {reportData.metadata.guitarBrand}{' '}
                  {reportData.metadata.guitarModel}
                </p>
                {reportData.metadata.serialNumber && (
                  <p className="font-mono">Serial: {reportData.metadata.serialNumber}</p>
                )}
              </div>
              <div className="text-right">
                <p>Version {version}</p>
                <p>Generated: {new Date(generatedAt).toLocaleDateString()}</p>
                <p className="text-xs mt-2">Report ID: {reportId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
