/**
 * Documents Management Page
 * Central location to manage all documents (PDFs, brochures, marketing images)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document } from '../types/guitar';
import { documentService } from '../services/documentService';
import { Upload, FileText, Image as ImageIcon, Download, Trash2, Edit2, Save, X, Loader2, Tag, ArrowLeft, DoorOpen, User, Grid, Eye, CheckCircle, Clock, AlertCircle, RefreshCw, Search, Filter } from 'lucide-react';
import { useImageUrl } from '../hooks/useImageUrl';
import { useAuth } from '../context/AuthContext';
import { UserNameEditor } from './UserNameEditor';
import { Footer } from './Footer';
import { ExtractionStatus } from '../types/guitar';

export const Documents = () => {
  const navigate = useNavigate();
  const { user, logout, updateUserName } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; notes: string; tags: string }>({
    name: '',
    notes: '',
    tags: '',
  });
  const [viewingContent, setViewingContent] = useState<Document | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'image'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'none'>('all');

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    // Search filter - check name, notes, tags, and extracted content
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = doc.name.toLowerCase().includes(query);
      const matchesNotes = doc.notes?.toLowerCase().includes(query);
      const matchesTags = doc.tags?.some(tag => tag.toLowerCase().includes(query));
      const matchesExtractedText = doc.extractedContent?.text?.toLowerCase().includes(query);
      const matchesExtractedDescription = doc.extractedContent?.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesNotes && !matchesTags && !matchesExtractedText && !matchesExtractedDescription) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'all' && doc.type !== typeFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const docStatus = doc.extractedContent?.extractionStatus;
      if (statusFilter === 'none') {
        if (docStatus) return false;
      } else {
        if (docStatus !== statusFilter) return false;
      }
    }

    return true;
  });

  const hasActiveFilters = searchQuery || typeFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
  };

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
      alert('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedDocs: Document[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');

        if (!isPdf && !isImage) {
          alert(`${file.name}: Only PDFs and images are allowed`);
          continue;
        }

        const doc = await documentService.upload(file);
        uploadedDocs.push(doc);
      }

      setDocuments([...uploadedDocs, ...documents]);
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const assignedCount = doc.assignedGuitars?.length || 0;
    const confirmMessage = assignedCount > 0
      ? `This document is assigned to ${assignedCount} guitar(s). Are you sure you want to delete it? It will be unassigned from all guitars.`
      : 'Are you sure you want to delete this document?';

    if (!confirm(confirmMessage)) return;

    try {
      await documentService.delete(id);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const startEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditForm({
      name: doc.name,
      notes: doc.notes || '',
      tags: doc.tags?.join(', ') || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', notes: '', tags: '' });
  };

  const saveEdit = async (id: string) => {
    try {
      const tags = editForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const updated = await documentService.update(id, {
        name: editForm.name,
        notes: editForm.notes,
        tags,
      });

      setDocuments(documents.map(d => (d.id === id ? updated : d)));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Failed to update document');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpdateName = async (newName: string) => {
    await updateUserName(newName);
  };

  const handleTriggerExtraction = async (id: string) => {
    try {
      await documentService.triggerExtraction(id);
      // Update local state to show pending status
      setDocuments(documents.map(d =>
        d.id === id
          ? {
              ...d,
              extractedContent: {
                extractionStatus: 'pending' as const
              }
            }
          : d
      ));
    } catch (error) {
      console.error('Error triggering extraction:', error);
      alert('Failed to trigger extraction');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Document Library</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'} • Manage brochures, marketing materials, and manuals
              </p>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-2 sm:gap-4 flex-wrap">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg group">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{user?.name}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all"
                  title="Change display name"
                >
                  <Edit2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <button
                onClick={() => navigate('/collection')}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                title="Back to guitar collection"
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                title="Logout and exit"
              >
                <DoorOpen className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex-grow">
        <div className="py-8">

      {/* Upload Section */}
      <div className="card p-6 mb-8">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 mb-3 text-primary-600 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">PDF or images (PNG, JPG, WEBP)</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            accept="application/pdf,image/*"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Search and Filter Section */}
      {documents.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, notes, tags, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'pdf' | 'image')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Status</option>
              <option value="completed">Extracted</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="none">Not Extracted</option>
            </select>
          </div>

          {/* Results count and clear filters */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredDocuments.length} of {documents.length} documents
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents yet</h3>
          <p className="text-gray-600 dark:text-gray-400">Upload your first document to get started</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents match your filters</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search or filter criteria</p>
          <button
            onClick={clearFilters}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDocuments.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isEditing={editingId === doc.id}
              editForm={editForm}
              onEditFormChange={setEditForm}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={handleDelete}
              onViewContent={setViewingContent}
              onTriggerExtraction={handleTriggerExtraction}
            />
          ))}
        </div>
      )}
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* User Name Editor Modal */}
      {editingName && (
        <UserNameEditor
          currentName={user?.name || ''}
          onSave={handleUpdateName}
          onCancel={() => setEditingName(false)}
        />
      )}

      {/* Extracted Content Viewer Modal */}
      {viewingContent && (
        <ExtractedContentViewer
          document={viewingContent}
          onClose={() => setViewingContent(null)}
        />
      )}
    </div>
  );
};

// Extracted Content Viewer Modal
interface ExtractedContentViewerProps {
  document: Document;
  onClose: () => void;
}

const ExtractedContentViewer = ({ document, onClose }: ExtractedContentViewerProps) => {
  const extractedContent = document.extractedContent;
  const hasText = extractedContent?.text && extractedContent.text.trim().length > 0;
  const hasDescription = extractedContent?.description && extractedContent.description.trim().length > 0;

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{document.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Extracted {extractedContent?.extractedAt
                ? new Date(extractedContent.extractedAt).toLocaleDateString()
                : 'content'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Description for images */}
          {hasDescription && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-medium text-blue-900 dark:text-blue-200">AI Description</h3>
              </div>
              <p className="text-blue-800 dark:text-blue-300 text-sm whitespace-pre-wrap">
                {extractedContent?.description}
              </p>
            </div>
          )}

          {/* Extracted Text */}
          {hasText && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Extracted Text</h3>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {extractedContent?.text}
                </pre>
              </div>
            </div>
          )}

          {/* No content message */}
          {!hasText && !hasDescription && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>No extracted content available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {extractedContent?.rawTextLength && (
              <span>Raw text: {extractedContent.rawTextLength.toLocaleString()} chars</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-primary px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface DocumentCardProps {
  document: Document;
  isEditing: boolean;
  editForm: { name: string; notes: string; tags: string };
  onEditFormChange: (form: { name: string; notes: string; tags: string }) => void;
  onStartEdit: (doc: Document) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewContent: (doc: Document) => void;
  onTriggerExtraction: (id: string) => void;
}

const DocumentCard = ({
  document,
  isEditing,
  editForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewContent,
  onTriggerExtraction,
}: DocumentCardProps) => {
  const imageUrl = useImageUrl(document.url);
  const assignedCount = document.assignedGuitars?.length || 0;
  const extractionStatus = document.extractedContent?.extractionStatus;
  const hasExtractedContent = extractionStatus === 'completed' &&
    (document.extractedContent?.text || document.extractedContent?.description);

  const getStatusBadge = () => {
    if (!extractionStatus) {
      return (
        <button
          onClick={() => onTriggerExtraction(document.id)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Extract content from this document"
        >
          <RefreshCw className="w-3 h-3" />
          Extract
        </button>
      );
    }

    const statusConfig: Record<ExtractionStatus, { icon: React.ReactNode; label: string; className: string }> = {
      pending: {
        icon: <Clock className="w-3 h-3" />,
        label: 'Pending',
        className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
      },
      processing: {
        icon: <RefreshCw className="w-3 h-3 animate-spin" />,
        label: 'Processing',
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      },
      completed: {
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Extracted',
        className: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      },
      failed: {
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'Failed',
        className: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      },
    };

    const config = statusConfig[extractionStatus];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <div className="card p-4 hover:shadow-lg transition-shadow">
      {/* Preview */}
      <div className="mb-4">
        {document.type === 'image' && imageUrl ? (
          <img
            src={imageUrl}
            alt={document.name}
            className="w-full h-48 object-cover rounded"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded flex items-center justify-center">
            <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>

      {/* Details */}
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => onEditFormChange({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={e => onEditFormChange({ ...editForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={editForm.tags}
              onChange={e => onEditFormChange({ ...editForm, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="manual, brochure, specs"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(document.id)}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 btn-outline flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">{document.name}</h3>

          {document.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{document.notes}</p>
          )}

          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {document.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
            {document.type === 'pdf' ? (
              <span title="PDF"><FileText className="w-4 h-4" /></span>
            ) : (
              <span title="Image"><ImageIcon className="w-4 h-4" /></span>
            )}
            <span>•</span>
            <span>{new Date(document.uploadedAt).toLocaleDateString()}</span>
            {getStatusBadge()}
          </div>

          {assignedCount > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Assigned to {assignedCount} guitar{assignedCount !== 1 ? 's' : ''}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {hasExtractedContent && (
              <button
                onClick={() => onViewContent(document)}
                className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2"
              >
                <Eye className="w-4 h-4" />
                View Extracted Content
              </button>
            )}
            <div className="flex gap-2">
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-outline flex items-center justify-center gap-2 text-sm py-2"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
              <button
                onClick={() => onStartEdit(document)}
                className="btn-outline flex items-center justify-center gap-2 px-3 py-2"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(document.id)}
                className="btn-outline text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 px-3 py-2"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
