import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, LogIn, UserPlus } from 'lucide-react';
import { PickIcon } from './PickIcon';
import { guitarService } from '../services/guitarService';
import { Guitar } from '../types/guitar';
import { useImageUrls } from '../hooks/useImageUrl';
import { useAuth } from '../context/AuthContext';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [guitar, setGuitar] = useState<Guitar | null>(null);
  const [loading, setLoading] = useState(true);

  // If authenticated, redirect to collection
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/collection');
    }
  }, [isAuthenticated, navigate]);

  // Fetch random public guitar
  const fetchRandomGuitar = async () => {
    setLoading(true);
    try {
      const randomGuitar = await guitarService.getRandomPublicGuitar();
      setGuitar(randomGuitar);
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

  const primaryImage = guitar?.images.find(img => img.isPrimary) || guitar?.images[0];
  const imageUrls = useImageUrls(primaryImage ? [primaryImage.url] : []);
  const imageUrl = imageUrls[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 dark:bg-primary-500 rounded-full flex items-center justify-center">
                <PickIcon className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Guitar Collection Manager</h1>
                <p className="text-xs text-gray-400 dark:text-gray-500 tracking-wide">guitarhelp.click</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="btn-secondary flex items-center gap-2" title="Sign in to your account">
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
              <Link to="/register" className="btn-primary flex items-center gap-2" title="Create new account">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Up</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-primary-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading showcase guitar...</p>
            </div>
          ) : guitar ? (
            <div className="space-y-6">
              {/* Title Section */}
              <div className="text-center space-y-2">
                <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100">
                  {guitar.year} {guitar.brand} {guitar.model}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Featured from our community collection
                </p>
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

              {/* Call to Action */}
              <div className="text-center space-y-4 py-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Start Your Own Collection
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Track your guitar collection, document specifications, upload photos,
                  and keep notes about your instruments all in one place.
                </p>
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Link to="/register" className="btn-primary px-8" title="Create new account">
                    Get Started Free
                  </Link>
                  <Link to="/login" className="btn-secondary" title="Sign in to your account">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <PickIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" gColor="white" />
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Guitars Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Be the first to add a guitar to the collection!
              </p>
              <Link to="/register" className="btn-primary" title="Create new account">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            Guitar Collection Manager • Keep your instruments organized
          </p>
        </div>
      </footer>
    </div>
  );
};
