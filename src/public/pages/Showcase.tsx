import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { PickIcon } from '../../components/PickIcon';
import { guitarService } from '../../services/guitarService';
import { Guitar } from '../../types/guitar';
import { useImageUrls } from '../../hooks/useImageUrl';

/**
 * A random guitar from the community gallery (owners opt in per guitar).
 * Fetched after hydration; the pre-rendered HTML shows the loading card in the
 * same box as the loaded card, so nothing shifts.
 */
export const Showcase = () => {
  const [guitar, setGuitar] = useState<Guitar | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRandomGuitar = async () => {
    setLoading(true);
    try {
      setGuitar(await guitarService.getRandomPublicGuitar());
    } catch (error) {
      console.error('Error fetching random guitar:', error);
      setGuitar(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRandomGuitar();
  }, []);

  const primaryImage = guitar?.images.find((img) => img.isPrimary) || guitar?.images[0];
  const imageUrls = useImageUrls(primaryImage ? [primaryImage.url] : []);
  const imageUrl = imageUrls[0];

  return (
    <div className="min-h-[480px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[480px]">
              <Loader2 className="w-12 h-12 animate-spin text-primary-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading showcase guitar...</p>
            </div>
          ) : guitar ? (
            <div className="space-y-6">
              {/* Title Section */}
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                  From the community gallery
                </p>
                <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {guitar.year} {guitar.brand} {guitar.model}
                </h3>
              </div>

              {/* Guitar Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/30 overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Image */}
                  <div className="relative bg-gray-100 dark:bg-gray-700 aspect-square md:aspect-auto min-h-[400px]">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`${guitar.brand} ${guitar.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PickIcon className="w-24 h-24 text-gray-300 dark:text-gray-500" gColor="white" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-8 lg:p-12 flex flex-col justify-center space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Type
                        </h3>
                        <p className="text-xl text-gray-900 dark:text-gray-100">{guitar.type}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Color
                        </h3>
                        <p className="text-xl text-gray-900 dark:text-gray-100">{guitar.color}</p>
                      </div>

                      {guitar.finish && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Finish
                          </h3>
                          <p className="text-xl text-gray-900 dark:text-gray-100">{guitar.finish}</p>
                        </div>
                      )}
                    </div>

                    {/* Specifications */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Specifications</h3>

                      {guitar.bodyMaterial && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Body Material</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.bodyMaterial}</span>
                        </div>
                      )}

                      {guitar.neckMaterial && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Neck Material</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.neckMaterial}</span>
                        </div>
                      )}

                      {guitar.fretboardMaterial && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Fretboard</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.fretboardMaterial}</span>
                        </div>
                      )}

                      {guitar.pickupConfiguration && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Pickups</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.pickupConfiguration}</span>
                        </div>
                      )}

                      {guitar.scaleLength && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Scale Length</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.scaleLength}</span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Number of Frets</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.numberOfFrets}</span>
                      </div>

                      {guitar.countryOfOrigin && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Made In</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{guitar.countryOfOrigin}</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <button
                        onClick={fetchRandomGuitar}
                        disabled={loading}
                        className="btn-outline w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        title="Show another random guitar from the community"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Loading...' : 'Show Another Guitar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-20">
              <PickIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" gColor="white" />
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Your collection, organized
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Track specs, photos, documents and condition for every guitar you own.
                Collections are private by default.
              </p>
              <Link to="/register" className="btn-primary" title="Create new account">
                Get Started Free
              </Link>
            </div>
          )}
    </div>
  );
};
