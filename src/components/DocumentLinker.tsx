/**
 * Document Linker Component
 * Allows linking existing documents from the document library to a guitar
 */

import { useState, useEffect } from 'react';
import { Document } from '../types/guitar';
import { documentService } from '../services/documentService';
import { FileText, Image as ImageIcon, Link2, Unlink, Loader2, ExternalLink } from 'lucide-react';
import { useImageUrl } from '../hooks/useImageUrl';

interface DocumentLinkerProps {
  linkedDocumentIds: string[];
  onDocumentIdsChange: (documentIds: string[]) => void;
}

export const DocumentLinker = ({ linkedDocumentIds, onDocumentIdsChange }: DocumentLinkerProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentService.list();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (documentId: string) => {
    if (linkedDocumentIds.includes(documentId)) {
      // Unlink
      onDocumentIdsChange(linkedDocumentIds.filter(id => id !== documentId));
    } else {
      // Link
      onDocumentIdsChange([...linkedDocumentIds, documentId]);
    }
  };

  const linkedDocuments = documents.filter(doc => linkedDocumentIds.includes(doc.id));
  const availableDocuments = documents.filter(doc => !linkedDocumentIds.includes(doc.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Linked Documents</h3>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="btn-outline text-sm flex items-center gap-2"
          title={showPicker ? 'Close document picker' : 'Link documents to this guitar'}
        >
          <Link2 className="w-4 h-4" />
          <span className="hidden sm:inline">{showPicker ? 'Close' : 'Link Documents'}</span>
        </button>
      </div>

      {/* Linked Documents */}
      {linkedDocuments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {linkedDocuments.map(doc => (
            <LinkedDocumentCard
              key={doc.id}
              document={doc}
              onUnlink={() => toggleDocument(doc.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No documents linked yet</p>
      )}

      {/* Document Picker */}
      {showPicker && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Available Documents</h4>
          {availableDocuments.length === 0 ? (
            <p className="text-sm text-gray-500">
              No more documents available.{' '}
              <a href="/documents" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline inline-flex items-center gap-1">
                Upload documents <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {availableDocuments.map(doc => (
                <AvailableDocumentCard
                  key={doc.id}
                  document={doc}
                  onLink={() => toggleDocument(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface LinkedDocumentCardProps {
  document: Document;
  onUnlink: () => void;
}

const LinkedDocumentCard = ({ document, onUnlink }: LinkedDocumentCardProps) => {
  const imageUrl = useImageUrl(document.url);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
      {/* Preview */}
      <div className="flex-shrink-0">
        {document.type === 'image' && imageUrl ? (
          <img
            src={imageUrl}
            alt={document.name}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
        <p className="text-xs text-gray-500 capitalize">{document.type}</p>
      </div>

      {/* Unlink Button */}
      <button
        type="button"
        onClick={onUnlink}
        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
        title="Unlink document"
      >
        <Unlink className="w-4 h-4" />
      </button>
    </div>
  );
};

interface AvailableDocumentCardProps {
  document: Document;
  onLink: () => void;
}

const AvailableDocumentCard = ({ document, onLink }: AvailableDocumentCardProps) => {
  const imageUrl = useImageUrl(document.url);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition-colors cursor-pointer"
      onClick={onLink}
    >
      {/* Preview */}
      <div className="flex-shrink-0">
        {document.type === 'image' && imageUrl ? (
          <img
            src={imageUrl}
            alt={document.name}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
        <p className="text-xs text-gray-500 capitalize">{document.type}</p>
      </div>

      {/* Link Button */}
      <button
        type="button"
        onClick={onLink}
        className="flex-shrink-0 p-2 text-primary-600 hover:bg-primary-50 rounded transition-colors"
        title="Link document"
      >
        <Link2 className="w-4 h-4" />
      </button>
    </div>
  );
};
