import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './components/Landing';
import { NotFound } from './components/NotFound';

// Public pages are static imports (pre-rendered at build time); everything
// else loads on demand so the public pages ship a small bundle.
const named = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType })));

const GuitarGallery = named(() => import('./components/GuitarGallery'), 'GuitarGallery');
const GuitarDetail = named(() => import('./components/GuitarDetail'), 'GuitarDetail');
const GuitarForm = named(() => import('./components/GuitarForm'), 'GuitarForm');
const Documents = named(() => import('./components/Documents'), 'Documents');
const Timeline = named(() => import('./components/Timeline'), 'Timeline');
const ProvenanceReport = lazy(() => import('./components/ProvenanceReport'));
const SalesAd = lazy(() => import('./components/SalesAd'));
const SharedGuitarView = named(() => import('./components/SharedGuitarView'), 'SharedGuitarView');
const Login = named(() => import('./components/Login'), 'Login');
const Register = named(() => import('./components/Register'), 'Register');
const ForgotPassword = named(() => import('./components/ForgotPassword'), 'ForgotPassword');
const ResetPassword = named(() => import('./components/ResetPassword'), 'ResetPassword');
const AccountPage = named(() => import('./components/AccountPage'), 'AccountPage');

// Only lazy routes sit inside a Suspense boundary: a boundary around the
// pre-rendered public pages would switch them to client rendering when the
// auth check updates state during hydration.
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
  </div>
);
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<Spinner />}>{children}</Suspense>;
/** The route tree without a router, so the build can render it with StaticRouter. */
export function AppRoutes() {
  return (
    <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Lazy><Login /></Lazy>} />
          <Route path="/register" element={<Lazy><Register /></Lazy>} />
          <Route path="/forgot-password" element={<Lazy><ForgotPassword /></Lazy>} />
          <Route path="/reset-password" element={<Lazy><ResetPassword /></Lazy>} />
          <Route path="/s/:shareId" element={<Lazy><SharedGuitarView /></Lazy>} />

          {/* Protected routes */}
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <Lazy><GuitarGallery /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Lazy><AccountPage /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:id"
            element={
              <ProtectedRoute>
                <Lazy><GuitarDetail /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <Lazy><GuitarForm /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <Lazy><GuitarForm /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Lazy><Documents /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <ProtectedRoute>
                <Lazy><Timeline /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/provenance/:reportId"
            element={
              <ProtectedRoute>
                <Lazy><ProvenanceReport /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/sales/:reportId"
            element={
              <ProtectedRoute>
                <Lazy><SalesAd /></Lazy>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
    </AuthProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
