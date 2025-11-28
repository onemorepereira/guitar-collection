import { Guitar } from '../types/guitar';
import { Calendar } from 'lucide-react';
import { PickIcon } from './PickIcon';
import { useImageUrl } from '../hooks/useImageUrl';

interface GuitarCardProps {
  guitar: Guitar;
  onClick: () => void;
}

export const GuitarCard = ({ guitar, onClick }: GuitarCardProps) => {
  const primaryImage = guitar.images.find(img => img.isPrimary) || guitar.images[0];
  const imageUrl = useImageUrl(primaryImage?.thumbnailUrl || primaryImage?.url);

  return (
    <div
      onClick={onClick}
      className="card overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-transform duration-200"
    >
      <div className="relative h-80 bg-gradient-to-br from-gray-100 to-gray-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${guitar.brand} ${guitar.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PickIcon className="w-16 h-16 text-gray-400" gColor="white" />
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/60 to-transparent pointer-events-none" />
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-white text-sm font-medium">{guitar.type}</span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          {guitar.brand} {guitar.model}
        </h3>

        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">{guitar.year}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Body:</span>
            <p className="font-medium text-gray-900 truncate">{guitar.bodyMaterial}</p>
          </div>
          <div>
            <span className="text-gray-500">Color:</span>
            <p className="font-medium text-gray-900 truncate">{guitar.color}</p>
          </div>
        </div>

        {(guitar.privateInfo?.originalRetailPrice || guitar.privateInfo?.purchasePrice) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              {guitar.privateInfo?.originalRetailPrice && (
                <div>
                  <span className="text-xs text-gray-500">MSRP</span>
                  <p className="text-base font-semibold text-gray-900">
                    ${guitar.privateInfo.originalRetailPrice.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              )}
              {guitar.privateInfo?.purchasePrice && (
                <div>
                  <span className="text-xs text-gray-500">Paid</span>
                  <p className="text-base font-semibold text-primary-600">
                    ${guitar.privateInfo.purchasePrice.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
