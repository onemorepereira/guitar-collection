import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { provenanceService } from '../services/provenanceService';
import { ProvenanceReport as ProvenanceReportType } from '../types/guitar';

export default function ProvenanceReport() {
  const { guitarId, reportId } = useParams<{ guitarId: string; reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ProvenanceReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [guitarId, reportId]);

  const loadReport = async () => {
    if (!guitarId || !reportId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await provenanceService.getReport(guitarId, reportId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading provenance report...</p>
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

  const { reportData, ownerName, generatedAt, version } = report;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Bar - Hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Guitar
          </button>
          <div className="flex gap-3">
            <button onClick={handlePrint} className="btn-outline flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Certificate Content */}
      <div className="max-w-5xl mx-auto p-8 print:p-0">
        <div className="bg-white shadow-lg print:shadow-none">
          {/* Certificate Border */}
          <div className="border-8 border-double border-gray-800 print:border-4">
            <div className="p-12 print:p-8">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-300 pb-8 mb-8">
                <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
                  CERTIFICATE OF PROVENANCE
                </h1>
                <p className="text-lg text-gray-600 font-serif">
                  Instrument Authentication & Documentation
                </p>
              </div>

              {/* Instrument Title */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-serif font-semibold text-gray-900 mb-2">
                  {reportData.metadata.guitarYear} {reportData.metadata.guitarBrand}{' '}
                  {reportData.metadata.guitarModel}
                </h2>
                {reportData.metadata.serialNumber && (
                  <p className="text-gray-600 font-mono">
                    Serial Number: {reportData.metadata.serialNumber}
                  </p>
                )}
              </div>

              {/* Overview Section */}
              <section className="mb-8">
                <h3 className="text-xl font-serif font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  I. Overview
                </h3>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {reportData.overview}
                </div>
              </section>

              {/* Specifications Section */}
              <section className="mb-8">
                <h3 className="text-xl font-serif font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  II. Technical Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reportData.specifications.construction && Object.keys(reportData.specifications.construction).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Construction</h4>
                      <dl className="space-y-1">
                        {Object.entries(reportData.specifications.construction).map(
                          ([key, value]) => (
                            <div key={key} className="flex">
                              <dt className="text-gray-600 min-w-[120px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                              <dd className="text-gray-900">{String(value)}</dd>
                            </div>
                          )
                        )}
                      </dl>
                    </div>
                  )}
                  {reportData.specifications.electronics && Object.keys(reportData.specifications.electronics).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Electronics</h4>
                      <dl className="space-y-1">
                        {Object.entries(reportData.specifications.electronics).map(
                          ([key, value]) => (
                            <div key={key} className="flex">
                              <dt className="text-gray-600 min-w-[120px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                              <dd className="text-gray-900">{String(value)}</dd>
                            </div>
                          )
                        )}
                      </dl>
                    </div>
                  )}
                  {reportData.specifications.hardware && Object.keys(reportData.specifications.hardware).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Hardware</h4>
                      <dl className="space-y-1">
                        {Object.entries(reportData.specifications.hardware).map(
                          ([key, value]) => (
                            <div key={key} className="flex">
                              <dt className="text-gray-600 min-w-[120px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                              <dd className="text-gray-900">{String(value)}</dd>
                            </div>
                          )
                        )}
                      </dl>
                    </div>
                  )}
                  {reportData.specifications.finish && Object.keys(reportData.specifications.finish).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Finish</h4>
                      <dl className="space-y-1">
                        {Object.entries(reportData.specifications.finish).map(
                          ([key, value]) => (
                            <div key={key} className="flex">
                              <dt className="text-gray-600 min-w-[120px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                              <dd className="text-gray-900">{String(value)}</dd>
                            </div>
                          )
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              </section>

              {/* Provenance Section */}
              <section className="mb-8">
                <h3 className="text-xl font-serif font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  III. Provenance & Ownership History
                </h3>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {reportData.provenance}
                </div>
              </section>

              {/* Authentication Section */}
              <section className="mb-8">
                <h3 className="text-xl font-serif font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  IV. Authentication
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600">Authentication Level:</p>
                      <p className="font-semibold text-gray-900">
                        {reportData.authentication.authenticationLevel}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Supporting Documents:</p>
                      <p className="font-semibold text-gray-900">
                        {reportData.authentication.supportingDocuments}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600">Photographic Documentation:</p>
                      <p className="font-semibold text-gray-900">
                        {reportData.authentication.hasPhotographicDocumentation
                          ? 'Available'
                          : 'Not Available'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Receipt Documentation:</p>
                      <p className="font-semibold text-gray-900">
                        {reportData.authentication.hasReceiptDocumentation
                          ? 'Available'
                          : 'Not Available'}
                      </p>
                    </div>
                  </div>
                  {reportData.authentication.documentTypes.length > 0 && (
                    <div>
                      <p className="text-gray-600 mb-2">Document Types:</p>
                      <ul className="list-disc list-inside text-gray-900">
                        {reportData.authentication.documentTypes.map((doc, idx) => (
                          <li key={idx}>
                            {doc.name} ({doc.type})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Valuation Section */}
              {(reportData.valuation.purchasePrice ||
                reportData.valuation.currentEstimatedValue) && (
                <section className="mb-8">
                  <h3 className="text-xl font-serif font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                    V. Valuation
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {reportData.valuation.purchasePrice && (
                      <div>
                        <p className="text-gray-600">Purchase Price:</p>
                        <p className="font-semibold text-gray-900">
                          ${reportData.valuation.purchasePrice.toLocaleString()}
                        </p>
                        {reportData.valuation.purchaseDate && (
                          <p className="text-sm text-gray-500">
                            {new Date(reportData.valuation.purchaseDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                    {reportData.valuation.currentEstimatedValue && (
                      <div>
                        <p className="text-gray-600">Current Estimated Value:</p>
                        <p className="font-semibold text-gray-900">
                          ${reportData.valuation.currentEstimatedValue.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {reportData.valuation.condition && (
                    <div className="mt-4">
                      <p className="text-gray-600">Condition:</p>
                      <p className="font-semibold text-gray-900">
                        {reportData.valuation.condition}
                      </p>
                    </div>
                  )}
                  {reportData.valuation.notes && (
                    <div className="mt-4">
                      <p className="text-gray-700 italic">{reportData.valuation.notes}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Footer/Certification */}
              <div className="mt-12 pt-8 border-t-2 border-gray-300">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-gray-600 mb-2">Certified for:</p>
                    <p className="font-serif text-xl font-semibold text-gray-900">
                      {ownerName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600 mb-2">Certificate Details:</p>
                    <p className="text-sm text-gray-700">
                      Version {version}
                    </p>
                    <p className="text-sm text-gray-700">
                      Generated: {new Date(generatedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Report ID: {reportId}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
