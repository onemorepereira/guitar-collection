interface GuitarVisibilityCardProps {
  showInGallery: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Owner opt-in for the public landing-page gallery. Off by default.
 */
export function GuitarVisibilityCard({ showInGallery, onChange }: GuitarVisibilityCardProps) {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Visibility</h2>
      <div className="flex items-start gap-3">
        <input
          id="showInGallery"
          type="checkbox"
          checked={showInGallery}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby="showInGallery-description"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <div>
          <label htmlFor="showInGallery" className="font-medium text-gray-900 dark:text-gray-100">
            Show in the public gallery
          </label>
          <p id="showInGallery-description" className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Features this guitar on the guitarhelp.click home page: photos, brand, model, year and
            specs. Never your name, serial, price, or notes.
          </p>
        </div>
      </div>
    </div>
  );
}
