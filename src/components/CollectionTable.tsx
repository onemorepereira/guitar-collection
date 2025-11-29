import { useState } from 'react';
import { Guitar, GuitarType } from '../types/guitar';
import { guitarService } from '../services/guitarService';
import { Save, X, Check } from 'lucide-react';

interface CollectionTableProps {
  guitars: Guitar[];
  onUpdate: (guitar: Guitar) => void;
}

interface EditingCell {
  guitarId: string;
  field: string;
}

export const CollectionTable = ({ guitars, onUpdate }: CollectionTableProps) => {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);

  const startEdit = (guitarId: string, field: string, currentValue: any) => {
    setEditingCell({ guitarId, field });
    setEditValue(currentValue?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (guitar: Guitar, field: string, value: string) => {
    setSaving(guitar.id);
    try {
      // Determine the field path and convert value to appropriate type
      const updates: any = {};

      // Handle nested fields
      if (field.startsWith('privateInfo.')) {
        const privateField = field.split('.')[1];
        updates.privateInfo = {
          ...guitar.privateInfo,
          [privateField]: privateField.includes('Price') || privateField.includes('Value')
            ? parseFloat(value) || 0
            : value
        };
      } else if (field === 'year' || field === 'numberOfFrets') {
        updates[field] = parseInt(value) || 0;
      } else if (field === 'caseIncluded') {
        updates[field] = value === 'true';
      } else if (field === 'type') {
        updates[field] = value as GuitarType;
      } else {
        updates[field] = value;
      }

      const updated = await guitarService.updateGuitar(guitar.id, updates);
      onUpdate(updated);
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(null);
    }
  };

  const renderCell = (guitar: Guitar, field: string, value: any) => {
    const isEditing = editingCell?.guitarId === guitar.id && editingCell?.field === field;
    const isSaving = saving === guitar.id;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(guitar, field, editValue);
              if (e.key === 'Escape') cancelEdit();
            }}
            className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            autoFocus
            disabled={isSaving}
          />
          <button
            onClick={() => saveEdit(guitar, field, editValue)}
            disabled={isSaving}
            className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
          >
            {isSaving ? <Save className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            onClick={cancelEdit}
            disabled={isSaving}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => startEdit(guitar.id, field, value)}
        className="cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 px-2 py-1 rounded min-h-[2rem] flex items-center"
        title="Click to edit"
      >
        {value || <span className="text-gray-400 dark:text-gray-500">—</span>}
      </div>
    );
  };

  const renderSelectCell = (guitar: Guitar, field: string, value: any, options: string[]) => {
    const isEditing = editingCell?.guitarId === guitar.id && editingCell?.field === field;
    const isSaving = saving === guitar.id;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(guitar, field, editValue);
              if (e.key === 'Escape') cancelEdit();
            }}
            className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            autoFocus
            disabled={isSaving}
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={() => saveEdit(guitar, field, editValue)}
            disabled={isSaving}
            className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
          >
            {isSaving ? <Save className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            onClick={cancelEdit}
            disabled={isSaving}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => startEdit(guitar.id, field, value)}
        className="cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 px-2 py-1 rounded min-h-[2rem] flex items-center"
        title="Click to edit"
      >
        {value || <span className="text-gray-400 dark:text-gray-500">—</span>}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="w-full border-collapse bg-white dark:bg-gray-800 shadow-sm rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 sticky top-0 z-10 shadow-sm">
          <tr>
            {/* Basic Information */}
            <th colSpan={6} className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 border-b border-gray-300 dark:border-gray-600 sticky top-0">
              Basic Information
            </th>
            {/* Specifications */}
            <th colSpan={9} className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-green-50 dark:bg-green-900/30 border-b border-gray-300 dark:border-gray-600 sticky top-0">
              Specifications
            </th>
            {/* Private Information */}
            <th colSpan={6} className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 border-b border-gray-300 dark:border-gray-600 sticky top-0">
              Private Information
            </th>
          </tr>
          <tr className="bg-gray-100 dark:bg-gray-700 sticky top-[52px] z-10">
            {/* Basic Info Headers */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Brand</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Model</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Year</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Type</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Color</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r-2 border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700">Finish</th>

            {/* Specs Headers */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Scale Length</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Pickups</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Body Wood</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Neck Wood</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Fretboard</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Frets</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Bridge</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Tuners</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r-2 border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700">Case</th>

            {/* Private Info Headers */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Serial #</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Purchase Date</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Purchase Price</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">MSRP</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">Current Value</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700">Purchase Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {guitars.map((guitar) => (
            <tr key={guitar.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {/* Basic Information */}
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'brand', guitar.brand)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'model', guitar.model)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'year', guitar.year)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">
                {renderSelectCell(guitar, 'type', guitar.type, Object.values(GuitarType))}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'color', guitar.color)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r-2 border-gray-200 dark:border-gray-600">{renderCell(guitar, 'finish', guitar.finish)}</td>

              {/* Specifications */}
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'scaleLength', guitar.scaleLength)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'pickupConfiguration', guitar.pickupConfiguration)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'bodyMaterial', guitar.bodyMaterial)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'neckMaterial', guitar.neckMaterial)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'fretboardMaterial', guitar.fretboardMaterial)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'numberOfFrets', guitar.numberOfFrets)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'bridge', guitar.bridge)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">{renderCell(guitar, 'tuningMachines', guitar.tuningMachines)}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r-2 border-gray-200 dark:border-gray-600">
                {renderSelectCell(guitar, 'caseIncluded', guitar.caseIncluded ? 'true' : 'false', ['true', 'false'])}
              </td>

              {/* Private Information */}
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700 font-mono text-xs">
                {renderCell(guitar, 'privateInfo.serialNumber', guitar.privateInfo?.serialNumber)}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">
                {renderCell(guitar, 'privateInfo.purchaseDate', guitar.privateInfo?.purchaseDate)}
              </td>
              <td className="px-4 py-2 text-sm border-r border-gray-100 dark:border-gray-700 font-semibold text-green-700 dark:text-green-400">
                {renderCell(guitar, 'privateInfo.purchasePrice', guitar.privateInfo?.purchasePrice ? `$${guitar.privateInfo.purchasePrice}` : '')}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700">
                {renderCell(guitar, 'privateInfo.originalRetailPrice', guitar.privateInfo?.originalRetailPrice ? `$${guitar.privateInfo.originalRetailPrice}` : '')}
              </td>
              <td className="px-4 py-2 text-sm border-r border-gray-100 dark:border-gray-700 font-semibold text-primary-700 dark:text-primary-400">
                {renderCell(guitar, 'privateInfo.currentValue', guitar.privateInfo?.currentValue ? `$${guitar.privateInfo.currentValue}` : '')}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                {renderCell(guitar, 'privateInfo.purchaseLocation', guitar.privateInfo?.purchaseLocation)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {guitars.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No guitars in your collection yet.
        </div>
      )}
    </div>
  );
};
