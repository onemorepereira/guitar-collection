import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './components/Landing';
import { GuitarGallery } from './components/GuitarGallery';
import { GuitarDetail } from './components/GuitarDetail';
import { GuitarForm } from './components/GuitarForm';
import { Documents } from './components/Documents';
import { Timeline } from './components/Timeline';
import ProvenanceReport from './components/ProvenanceReport';
import SalesAd from './components/SalesAd';
import { SharedGuitarView } from './components/SharedGuitarView';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/s/:shareId" element={<SharedGuitarView />} />

          {/* Protected routes */}
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <GuitarGallery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:id"
            element={
              <ProtectedRoute>
                <GuitarDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <GuitarForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <GuitarForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <ProtectedRoute>
                <Timeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/provenance/:reportId"
            element={
              <ProtectedRoute>
                <ProvenanceReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guitar/:guitarId/sales/:reportId"
            element={
              <ProtectedRoute>
                <SalesAd />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
