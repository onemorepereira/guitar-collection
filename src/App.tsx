import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './public/pages/Home';
import { FeaturePage } from './public/pages/features';
import { Faq } from './public/pages/Faq';
import { NotFound } from './components/NotFound';
import { usePageTitle } from './public/useDocumentHead';
import { ChunkErrorBoundary, ClearReloadFlag } from './components/ChunkErrorBoundary';

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
const Lazy = ({ children }: { children: ReactNode }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<Spinner />}>
      <ClearReloadFlag />
      {children}
    </Suspense>
  </ChunkErrorBoundary>
);
/** Tab title for app screens: "<Screen> | GuitarHelp". */
const Titled = ({ title, children }: { title: string; children: ReactNode }) => {
  usePageTitle(title);
  return <>{children}</>;
};
/** The route tree without a router, so the build can render it with StaticRouter. */
export function AppRoutes() {
  return (
    <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          {/* Feature pages are listed one by one (not /features/:slug) so the router,
              the pre-render list and the CloudFront router stay explicit. */}
          <Route path="/features/insurance-inventory" element={<FeaturePage slug="insurance-inventory" />} />
          <Route path="/features/condition-reports" element={<FeaturePage slug="condition-reports" />} />
          <Route path="/features/selling" element={<FeaturePage slug="selling" />} />
          <Route path="/features/ai-import" element={<FeaturePage slug="ai-import" />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/login" element={<Titled title="Sign in"><Lazy><Login /></Lazy></Titled>} />
          <Route path="/register" element={<Titled title="Create account"><Lazy><Register /></Lazy></Titled>} />
          <Route path="/forgot-password" element={<Titled title="Reset password"><Lazy><ForgotPassword /></Lazy></Titled>} />
          <Route path="/reset-password" element={<Titled title="Reset password"><Lazy><ResetPassword /></Lazy></Titled>} />
          <Route path="/s/:shareId" element={<Titled title="Shared guitar"><Lazy><SharedGuitarView /></Lazy></Titled>} />

          {/* Protected routes */}
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <Titled title="Collection"><Lazy><GuitarGallery /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Titled title="Account"><Lazy><AccountPage /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:id"
            element={
              <ProtectedRoute>
                <Titled title="Guitar details"><Lazy><GuitarDetail /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <Titled title="Add guitar"><Lazy><GuitarForm /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <Titled title="Edit guitar"><Lazy><GuitarForm /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Titled title="Documents"><Lazy><Documents /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <ProtectedRoute>
                <Titled title="Timeline"><Lazy><Timeline /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/provenance/:reportId"
            element={
              <ProtectedRoute>
                <Titled title="Provenance report"><Lazy><ProvenanceReport /></Lazy></Titled>
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/sales/:reportId"
            element={
              <ProtectedRoute>
                <Titled title="Sales listing"><Lazy><SalesAd /></Lazy></Titled>
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
