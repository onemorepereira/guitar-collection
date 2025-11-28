import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Guitar } from '../types/guitar';
import { guitarService } from '../services/guitarService';
import { GuitarCard } from './GuitarCard';
import { SearchBar } from './SearchBar';
import { Footer } from './Footer';
import { UserNameEditor } from './UserNameEditor';
import { useAuth } from '../context/AuthContext';
import { Plus, Loader2, DoorOpen, User, Edit2, Grid, List, FileText, Clock, Calendar, Table } from 'lucide-react';
import { CollectionTable } from './CollectionTable';

type ViewMode = 'gallery' | 'list' | 'timeline' | 'table';

export const GuitarGallery = () => {
  const navigate = useNavigate();
  const { user, logout, updateUserName } = useAuth();
  const [guitars, setGuitars] = useState<Guitar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Load view preference from localStorage
    const saved = localStorage.getItem('guitarViewMode');
    const isMobile = window.innerWidth < 640; // sm breakpoint
    // Force gallery view on mobile if table was saved (table doesn't work well on mobile)
    if (saved === 'table' && isMobile) return 'gallery';
    return (saved === 'list' || saved === 'gallery' || saved === 'timeline' || saved === 'table') ? saved : 'gallery';
  });

  useEffect(() => {
    loadGuitars();
  }, [search]);

  useEffect(() => {
    // Save view mode preference
    localStorage.setItem('guitarViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (user?.name) {
      document.title = `Guitar Collection Manager - ${user.name}`;
    }
  }, [user]);

  const loadGuitars = async () => {
    setLoading(true);
    try {
      const filters = search ? { search } : {};
      const data = await guitarService.getGuitars(filters, user?.id);
      setGuitars(data);
    } catch (error) {
      console.error('Error loading guitars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (searchValue: string) => {
    setSearch(searchValue);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpdateName = async (newName: string) => {
    await updateUserName(newName);
  };

  // Calculate total collection value
  const totalValue = guitars.reduce((sum, guitar) => {
    const price = guitar.privateInfo?.purchasePrice || 0;
    return sum + price;
  }, 0);

  // Default sort: by purchase date descending (newest first)
  const displayGuitars = [...guitars].sort((a: Guitar, b: Guitar) => {
    const dateA = a.privateInfo?.purchaseDate || a.createdAt;
    const dateB = b.privateInfo?.purchaseDate || b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime(); // Newest first
  });

  // Timeline helper functions
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

  // Group guitars by year for timeline view
  const sortedGuitars = [...guitars].sort((a: Guitar, b: Guitar) => {
    const dateA = a.privateInfo?.purchaseDate || a.createdAt;
    const dateB = b.privateInfo?.purchaseDate || b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime(); // Oldest first
  });

  const guitarsByYear = sortedGuitars.reduce((acc, guitar) => {
    const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;
    const year = getYear(date);
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(guitar);
    return acc;
  }, {} as Record<number, Guitar[]>);

  const years = Object.keys(guitarsByYear).map(Number).sort((a, b) => a - b); // Oldest year first

  // Group guitars by exact date for timeline view
  const guitarsByDate = sortedGuitars.reduce((acc, guitar) => {
    const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;
    const dateKey = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(guitar);
    return acc;
  }, {} as Record<string, Guitar[]>);

  const uniqueDates = Object.keys(guitarsByDate).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Guitar Collection Manager</h1>
              <p className="text-gray-600 mt-1">
                {user?.name}
                <span className="text-gray-400 mx-2">•</span>
                {guitars.length} {guitars.length === 1 ? 'guitar' : 'guitars'}
                {totalValue > 0 && (
                  <>
                    <span className="text-gray-400 mx-2">•</span>
                    <span>
                      ${totalValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} invested
                    </span>
                  </>
                )}
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
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('gallery')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'gallery'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Gallery view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List view"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Timeline view"
                >
                  <Clock className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`hidden sm:block p-2 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Table view (editable)"
                >
                  <Table className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => navigate('/add')}
                className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm hover:shadow-md"
                title="Add new guitar to collection"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/documents')}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                title="Manage documents"
              >
                <FileText className="w-5 h-5" />
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

          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by brand, model, serial number, color, or notes..."
          />
        </div>
      </header>

      {/* Gallery */}
      <main className={viewMode === 'table' ? 'w-full px-4 pb-12' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12'}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : guitars.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No guitars found</h3>
            <p className="text-gray-600 mb-6">
              {search
                ? 'Try a different search term'
                : 'Start building your collection by adding your first guitar'}
            </p>
            {!search && (
              <button onClick={() => navigate('/add')} className="btn-primary">
                Add Your First Guitar
              </button>
            )}
          </div>
        ) : viewMode === 'gallery' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {displayGuitars.map((guitar) => (
              <GuitarCard
                key={guitar.id}
                guitar={guitar}
                onClick={() => navigate(`/guitar/${guitar.id}`)}
              />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guitar
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S/N
                    </th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purchase Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayGuitars.map((guitar) => (
                    <tr
                      key={guitar.id}
                      onClick={() => navigate(`/guitar/${guitar.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                            {guitar.images && guitar.images.length > 0 ? (
                              <img
                                className="h-10 w-10 sm:h-12 sm:w-12 rounded object-cover"
                                src={(guitar.images.find(img => img.isPrimary) || guitar.images[0]).url}
                                alt={`${guitar.brand} ${guitar.model}`}
                              />
                            ) : (
                              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No image</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {guitar.brand} {guitar.model} {guitar.year}
                        </div>
                        {/* S/N on mobile */}
                        {guitar.privateInfo?.serialNumber && (
                          <div className="md:hidden text-xs text-gray-500 font-mono mt-1">
                            S/N: {guitar.privateInfo.serialNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{guitar.color || '—'}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-mono">
                          {guitar.privateInfo?.serialNumber || '—'}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                          {guitar.type}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {guitar.privateInfo?.purchasePrice
                            ? `$${guitar.privateInfo.purchasePrice.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : '—'}
                        </div>
                      </td>
                      <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {guitar.privateInfo?.purchaseDate
                            ? new Date(guitar.privateInfo.purchaseDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline View */
          <div>
            {/* Vertical Timeline (Mobile and Default) */}
            <div className="lg:hidden">
              <div className="relative px-4 pt-8">
                {/* Vertical line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-8 bottom-0 w-0.5 bg-primary-200" />

                <div className="space-y-8 py-4">
                  {uniqueDates.map((dateKey) => {
                    const guitarsOnDate = guitarsByDate[dateKey];
                    const displayDate = formatDate(dateKey);

                    return (
                      <div key={dateKey} className="relative flex items-center justify-between gap-4">
                        {/* Date label (left side) */}
                        <div className="text-sm text-gray-600 font-medium text-right flex-1">
                          {displayDate}
                          {guitarsOnDate.length > 1 && (
                            <span className="text-xs text-gray-500 ml-1">({guitarsOnDate.length})</span>
                          )}
                        </div>

                        {/* Connection dot */}
                        <div className="w-3 h-3 rounded-full bg-primary-400 border-4 border-white shadow z-10 flex-shrink-0" />

                        {/* Guitar thumbnails (right side) - overlapping if multiple */}
                        <div className="flex-1">
                          <div className="flex -space-x-3">
                            {guitarsOnDate.map((guitar, index) => {
                              const primaryImage = guitar.images?.find(img => img.isPrimary) || guitar.images?.[0];
                              const tooltipText = [
                                guitar.year ? `${guitar.year} ${guitar.brand} ${guitar.model}` : `${guitar.brand} ${guitar.model}`,
                                guitar.color,
                                guitar.privateInfo?.purchasePrice
                                  ? new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: guitar.privateInfo.currency || 'USD',
                                    }).format(guitar.privateInfo.purchasePrice)
                                  : null
                              ].filter(Boolean).join(' • ');

                              return (
                                <div
                                  key={guitar.id}
                                  onClick={() => navigate(`/guitar/${guitar.id}`)}
                                  className="cursor-pointer group relative"
                                  style={{ zIndex: guitarsOnDate.length - index }}
                                >
                                  {primaryImage ? (
                                    <img
                                      src={primaryImage.url}
                                      alt={`${guitar.brand} ${guitar.model}`}
                                      className="w-20 h-20 object-cover rounded-full shadow-md hover:shadow-xl transition-all hover:scale-110 hover:z-50 border-2 border-white"
                                    />
                                  ) : (
                                    <div className="w-20 h-20 bg-gray-200 rounded-full shadow-md hover:shadow-xl transition-all hover:scale-110 hover:z-50 flex items-center justify-center border-2 border-white">
                                      <Calendar className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  {/* Tooltip */}
                                  <div className="tooltip-nowrap absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg whitespace-nowrap">
                                    {tooltipText}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vertical Timeline with Round Tokens (Desktop) */}
            <div className="hidden lg:block px-8 py-8">
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-primary-200" />

                <div className="space-y-12">
                  {years.map((year) => (
                    <div key={year}>
                      {/* Year marker on timeline */}
                      <div className="flex items-center gap-6 mb-8">
                        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary-600 text-white font-bold text-xl shadow-lg z-10">
                          {year}
                        </div>
                        <div className="flex items-center gap-4 flex-1">
                          <span className="text-gray-600 font-medium">
                            {guitarsByYear[year].length} guitar{guitarsByYear[year].length !== 1 ? 's' : ''} acquired
                          </span>
                          <div className="flex-1 h-0.5 bg-primary-100" />
                        </div>
                      </div>

                      {/* Guitars for this year - wrapped with round tokens */}
                      <div className="ml-10 pl-10 border-l-2 border-primary-100 overflow-visible">
                        <div className="flex flex-wrap gap-6 overflow-visible">
                          {guitarsByYear[year].map((guitar) => {
                            const primaryImage = guitar.images?.find(img => img.isPrimary) || guitar.images?.[0];
                            const date = guitar.privateInfo?.purchaseDate || guitar.createdAt;
                            const tooltipText = [
                              guitar.year ? `${guitar.year} ${guitar.brand} ${guitar.model}` : `${guitar.brand} ${guitar.model}`,
                              guitar.color,
                              guitar.privateInfo?.purchasePrice
                                ? new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: guitar.privateInfo.currency || 'USD',
                                  }).format(guitar.privateInfo.purchasePrice)
                                : null
                            ].filter(Boolean).join(' • ');

                            return (
                              <div
                                key={guitar.id}
                                onClick={() => navigate(`/guitar/${guitar.id}`)}
                                className="cursor-pointer group flex flex-col items-center w-32 overflow-visible"
                              >
                                {/* Round token */}
                                <div className="relative mb-3 overflow-visible">
                                  {primaryImage ? (
                                    <img
                                      src={primaryImage.url}
                                      alt={`${guitar.brand} ${guitar.model}`}
                                      className="w-28 h-28 object-cover rounded-full shadow-md hover:shadow-xl transition-all hover:scale-110 border-4 border-white"
                                    />
                                  ) : (
                                    <div className="w-28 h-28 bg-gray-200 rounded-full shadow-md hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center border-4 border-white">
                                      <Calendar className="w-10 h-10 text-gray-400" />
                                    </div>
                                  )}
                                  {/* Tooltip */}
                                  <div className="tooltip-nowrap absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg whitespace-nowrap">
                                    {tooltipText}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>

                                {/* Guitar info below token */}
                                <div className="text-center">
                                  <h3 className="font-semibold text-gray-900 text-sm truncate w-full">
                                    {guitar.brand}
                                  </h3>
                                  <p className="text-xs text-gray-600 truncate w-full">{guitar.model}</p>
                                  <p className="text-xs text-gray-400 mt-1">{formatDate(date)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View - Editable */
          <div className="card p-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Collection Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Click any cell to edit. Changes save automatically.
              </p>
            </div>
            <CollectionTable
              guitars={displayGuitars}
              onUpdate={(updatedGuitar) => {
                setGuitars(prev =>
                  prev.map(g => g.id === updatedGuitar.id ? updatedGuitar : g)
                );
              }}
            />
          </div>
        ) : null}
      </main>

      <Footer />

      {/* User Name Editor Modal */}
      {editingName && user && (
        <UserNameEditor
          currentName={user.name}
          onSave={handleUpdateName}
          onCancel={() => setEditingName(false)}
        />
      )}
    </div>
  );
};
