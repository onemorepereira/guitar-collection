import { useState } from 'react';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';

interface UserNameEditorProps {
  currentName: string;
  onSave: (newName: string) => Promise<void>;
  onCancel: () => void;
}

export const UserNameEditor = ({ currentName, onSave, onCancel }: UserNameEditorProps) => {
  const [newName, setNewName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    if (newName.trim() === currentName) {
      onCancel();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(newName.trim());
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900">Change Display Name</h3>
          <button
            onClick={onCancel}
            disabled={saving}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="display-name" className="label">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                id="display-name"
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                className="input-field"
                placeholder="Enter your display name"
                disabled={saving}
                autoFocus
                maxLength={50}
              />
              <p className="text-sm text-gray-500 mt-1">
                This is how your name will appear throughout the app.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="btn-secondary"
              title="Cancel without saving"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !newName.trim() || newName.trim() === currentName}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save new display name"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
