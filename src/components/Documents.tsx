/**
 * Documents Management Page
 * Central location to manage all documents (PDFs, brochures, marketing images)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document } from '../types/guitar';
import { documentService } from '../services/documentService';
import { Upload, FileText, Image as ImageIcon, Download, Trash2, Edit2, Save, X, Loader2, Tag, ArrowLeft, DoorOpen, User, Grid } from 'lucide-react';
import { useImageUrl } from '../hooks/useImageUrl';
import { useAuth } from '../context/AuthContext';
import { UserNameEditor } from './UserNameEditor';
import { Footer } from './Footer';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Document Library</h1>
              <p className="text-gray-600 mt-1">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'} • Manage brochures, marketing materials, and manuals
              </p>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-2 sm:gap-4 flex-wrap">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg group">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">{user?.name}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                  title="Change display name"
                >
                  <Edit2 className="w-3 h-3 text-gray-600" />
                </button>
              </div>
              <button
                onClick={() => navigate('/collection')}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                title="Back to guitar collection"
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
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
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 mb-3 text-primary-600 animate-spin" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 mb-3 text-gray-400" />
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF or images (PNG, JPG, WEBP)</p>
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

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
          <p className="text-gray-600">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map(doc => (
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
}: DocumentCardProps) => {
  const imageUrl = useImageUrl(document.url);
  const assignedCount = document.assignedGuitars?.length || 0;

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
          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
            <FileText className="w-16 h-16 text-gray-400" />
          </div>
        )}
      </div>

      {/* Details */}
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => onEditFormChange({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={e => onEditFormChange({ ...editForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={editForm.tags}
              onChange={e => onEditFormChange({ ...editForm, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
          <h3 className="font-semibold text-gray-900 mb-2 truncate">{document.name}</h3>

          {document.notes && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{document.notes}</p>
          )}

          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {document.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <span className="capitalize">{document.type}</span>
            <span>•</span>
            <span>{new Date(document.uploadedAt).toLocaleDateString()}</span>
          </div>

          {assignedCount > 0 && (
            <div className="text-sm text-gray-600 mb-3">
              Assigned to {assignedCount} guitar{assignedCount !== 1 ? 's' : ''}
            </div>
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
              className="btn-outline text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 px-3 py-2"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
