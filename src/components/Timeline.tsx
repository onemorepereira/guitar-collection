import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Guitar } from '../types/guitar';
import { guitarService } from '../services/guitarService';
import { Loader2, Calendar, DollarSign, ArrowLeft, Grid } from 'lucide-react';

export const Timeline = () => {
  const navigate = useNavigate();
  const { logout, user, updateUserName } = useAuth();
  const [guitars, setGuitars] = useState<Guitar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuitars();
  }, []);

  const loadGuitars = async () => {
    try {
      setLoading(true);
      const data = await guitarService.getGuitars();
      // Sort by purchase date (or createdAt as fallback), newest first
      const sorted = data.sort((a: Guitar, b: Guitar) => {
        const dateA = a.privateInfo?.purchaseDate || a.createdAt;
        const dateB = b.privateInfo?.purchaseDate || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setGuitars(sorted);
    } catch (error) {
      console.error('Error loading guitars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpdateName = async (newName: string) => {
    await updateUserName(newName);
  };

  const handleGuitarClick = (guitarId: string) => {
    navigate(`/guitar/${guitarId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  // Group guitars by year for markers
  const guitarsByYear = guitars.reduce((acc, guitar) => {
    const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;
    const year = getYear(date);
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(guitar);
    return acc;
  }, {} as Record<number, Guitar[]>);

  const years = Object.keys(guitarsByYear).map(Number).sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (guitars.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Collection Timeline</h1>
              <button
                onClick={() => navigate('/collection')}
                className="btn-outline flex items-center gap-2"
              >
                <Grid className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Collection</span>
              </button>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No guitars yet</h3>
            <p className="text-gray-600">Add your first guitar to see your timeline</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Collection Timeline</h1>
              <p className="text-gray-600 mt-1">
                Your guitar acquisition journey ({guitars.length} guitar{guitars.length !== 1 ? 's' : ''})
              </p>
            </div>
            <button
              onClick={() => navigate('/collection')}
              className="btn-outline flex items-center gap-2"
            >
              <Grid className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Collection</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Vertical Timeline (Mobile and Default) */}
        <div className="lg:hidden">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary-200" />

            <div className="space-y-8">
              {years.map((year) => (
                <div key={year}>
                  {/* Year marker */}
                  <div className="flex items-center mb-6">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-600 text-white font-bold text-lg shadow-lg z-10">
                      {year}
                    </div>
                    <div className="ml-4 text-sm text-gray-500">
                      {guitarsByYear[year].length} guitar{guitarsByYear[year].length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Guitars for this year */}
                  <div className="space-y-6 ml-16">
                    {guitarsByYear[year].map((guitar) => {
                      const primaryImage = guitar.images[0];
                      const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;

                      return (
                        <div
                          key={guitar.id}
                          onClick={() => handleGuitarClick(guitar.id)}
                          className="relative cursor-pointer group"
                        >
                          {/* Connection dot */}
                          <div className="absolute -left-16 top-6 w-4 h-4 rounded-full bg-primary-400 border-4 border-white shadow" />

                          {/* Guitar card */}
                          <div className="card hover:shadow-lg transition-shadow">
                            <div className="flex gap-4">
                              {/* Guitar image */}
                              <div className="flex-shrink-0">
                                {primaryImage ? (
                                  <img
                                    src={primaryImage.url}
                                    alt={`${guitar.brand} ${guitar.model}`}
                                    className="w-24 h-24 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                                    <Calendar className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>

                              {/* Guitar info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {guitar.brand} {guitar.model}
                                </h3>
                                <p className="text-sm text-gray-600">{guitar.year}</p>
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(date)}
                                </div>
                                {guitar.privateInfo?.purchasePrice && (
                                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                    <DollarSign className="w-4 h-4" />
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: guitar.privateInfo.currency || 'USD',
                                    }).format(guitar.privateInfo.purchasePrice)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Timeline (Desktop) */}
        <div className="hidden lg:block">
          <div className="relative pb-16">
            {/* Horizontal line */}
            <div className="absolute top-16 left-0 right-0 h-0.5 bg-primary-200" />

            <div className="relative">
              <div className="flex gap-8 overflow-x-auto pb-4">
                {years.map((year, yearIndex) => (
                  <div key={year} className="flex gap-8">
                    {/* Year marker */}
                    <div className="flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-600 text-white font-bold text-lg shadow-lg z-10">
                          {year}
                        </div>
                        <div className="mt-2 text-sm text-gray-500 whitespace-nowrap">
                          {guitarsByYear[year].length} guitar{guitarsByYear[year].length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Guitars for this year */}
                    {guitarsByYear[year].map((guitar, guitarIndex) => {
                      const primaryImage = guitar.images[0];
                      const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;

                      return (
                        <div
                          key={guitar.id}
                          onClick={() => handleGuitarClick(guitar.id)}
                          className="flex-shrink-0 cursor-pointer group"
                        >
                          <div className="flex flex-col items-center">
                            {/* Guitar image */}
                            <div className="relative">
                              {/* Connection line to main timeline */}
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-primary-400" />

                              <div className="card p-3 hover:shadow-lg transition-shadow w-48">
                                {primaryImage ? (
                                  <img
                                    src={primaryImage.url}
                                    alt={`${guitar.brand} ${guitar.model}`}
                                    className="w-full h-32 object-cover rounded mb-3"
                                  />
                                ) : (
                                  <div className="w-full h-32 bg-gray-200 rounded mb-3 flex items-center justify-center">
                                    <Calendar className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}

                                <h3 className="font-semibold text-gray-900 text-sm truncate">
                                  {guitar.brand} {guitar.model}
                                </h3>
                                <p className="text-xs text-gray-600">{guitar.year}</p>
                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(date)}
                                </div>
                                {guitar.privateInfo?.purchasePrice && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                    <DollarSign className="w-3 h-3" />
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: guitar.privateInfo.currency || 'USD',
                                      maximumFractionDigits: 0,
                                    }).format(guitar.privateInfo.purchasePrice)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
