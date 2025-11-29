import { useState } from 'react';
import { NoteEntry } from '../types/guitar';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';


interface NotesJournalProps {
  notes: NoteEntry[];
  onAddNote: (content: string) => void;
  onDeleteNote: (noteId: string) => void;
  readOnly?: boolean;
  maxInitialNotes?: number; // If set, will show this many notes initially with "Show More" button
}

export const NotesJournal = ({ notes, onAddNote, onDeleteNote, readOnly = false, maxInitialNotes }: NotesJournalProps) => {
  const [newNote, setNewNote] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [visibleNotesCount, setVisibleNotesCount] = useState(maxInitialNotes || notes.length);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote('');
    }
  };

  const handleDelete = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteNote(noteId);
    setShowDeleteConfirm(null);
  };

  // Sort notes by date, newest first
  const sortedNotes = [...notes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Get visible notes based on the count
  const visibleNotes = maxInitialNotes ? sortedNotes.slice(0, visibleNotesCount) : sortedNotes;
  const hasMoreNotes = maxInitialNotes && visibleNotesCount < sortedNotes.length;
  const showMoreCount = Math.min(3, sortedNotes.length - visibleNotesCount);

  const handleShowMore = () => {
    setVisibleNotesCount(prev => Math.min(prev + 3, sortedNotes.length));
  };

  const handleShowLess = () => {
    setVisibleNotesCount(maxInitialNotes || 3);
  };

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      {!readOnly && (
        <div className="space-y-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newNote.trim()) {
                  onAddNote(newNote.trim());
                  setNewNote('');
                }
              }
            }}
            placeholder="Add a new note (Enter to save, Shift+Enter for new line)..."
            rows={3}
            className="input-field resize-none"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (newNote.trim()) {
                onAddNote(newNote.trim());
                setNewNote('');
              }
            }}
            disabled={!newNote.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add note entry"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {sortedNotes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8 italic">
            No notes yet. Add your first note above!
          </p>
        ) : (
          <>
            {visibleNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow relative group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <time dateTime={note.createdAt}>
                    {note.createdAt ? format(new Date(note.createdAt), 'PPp') : 'Unknown date'}
                  </time>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteConfirm(note.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all text-red-600 dark:text-red-400"
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.content}</p>

              {/* Delete Confirmation */}
              {showDeleteConfirm === note.id && (
                <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg flex items-center justify-center p-4">
                  <div className="text-center space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Delete this entry?</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteConfirm(null);
                        }}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                        title="Cancel deletion"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, note.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        title="Confirm deletion"
                      >
                        Delete Entry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            ))}

            {/* Show More / Show Less Buttons */}
            {maxInitialNotes && sortedNotes.length > maxInitialNotes && (
              <div className="flex justify-center pt-2">
                {hasMoreNotes ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShowMore();
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors"
                    title={`Load ${showMoreCount} more ${showMoreCount === 1 ? 'note' : 'notes'}`}
                  >
                    Show {showMoreCount} more {showMoreCount === 1 ? 'note' : 'notes'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShowLess();
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors"
                    title="Collapse notes list"
                  >
                    Show less
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
