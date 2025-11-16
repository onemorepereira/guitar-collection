import { useState } from 'react';
import { GuitarDocument } from '../types/guitar';
import { Upload, FileText, Image, X, Download, Loader2 } from 'lucide-react';
import { guitarService } from '../services/guitarService';

interface DocumentManagerProps {
  documents: GuitarDocument[];
  onDocumentsChange: (documents: GuitarDocument[]) => void;
}

export const DocumentManager = ({ documents, onDocumentsChange }: DocumentManagerProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newDocuments: GuitarDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');

        if (!isPdf && !isImage) {
          alert(`${file.name}: Only PDFs and images are allowed`);
          continue;
        }

        // Upload to S3
        const uploadedUrl = await guitarService.uploadDocument(file);

        newDocuments.push({
          id: `doc-${Date.now()}-${i}`,
          url: uploadedUrl,
          name: file.name,
          type: isPdf ? 'pdf' : 'image',
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
        });
      }

      onDocumentsChange([...documents, ...newDocuments]);
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = (docId: string) => {
    onDocumentsChange(documents.filter(doc => doc.id !== docId));
  };

  const handleDownload = async (doc: GuitarDocument) => {
    try {
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Documentation</h3>
        <label className="btn-secondary flex items-center gap-2 cursor-pointer">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Add Documents
            </>
          )}
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No documents uploaded</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload brochures, manuals, or marketing materials
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  {doc.type === 'pdf' ? (
                    <FileText className="w-8 h-8 text-red-500 mb-2" />
                  ) : (
                    <Image className="w-8 h-8 text-blue-500 mb-2" />
                  )}
                  <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(doc.id)}
                  className="ml-2 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove document"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {doc.type === 'image' && (
                <img
                  src={doc.url}
                  alt={doc.name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
              )}

              <button
                onClick={() => handleDownload(doc)}
                className="w-full btn-outline flex items-center justify-center gap-2 text-sm py-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
