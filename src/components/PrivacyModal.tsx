import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal = ({ isOpen, onClose }: PrivacyModalProps) => {
  // Handle Escape key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-600 mb-6">Last Updated: January 2025</p>

          <div className="bg-primary-50 border-l-4 border-primary-500 p-4 mb-6 rounded">
            <p className="text-sm">
              <strong>🔒 Privacy in Plain English</strong><br />
              We believe privacy should be simple and transparent. This policy explains what data
              we collect, why we collect it, and what we do (and don't do) with it.
            </p>
          </div>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">The Short Version</h3>
            <div className="space-y-2 text-sm">
              <p>
                <strong className="text-gray-900">What we collect:</strong>{' '}
                <span className="text-gray-700">
                  Your email, name, and the guitar collection data you enter.
                </span>
              </p>
              <p>
                <strong className="text-gray-900">What we don't do:</strong>{' '}
                <span className="text-gray-700">
                  Sell your data, track you around the web, or spam you.
                </span>
              </p>
              <p>
                <strong className="text-gray-900">Your control:</strong>{' '}
                <span className="text-gray-700">You can export or delete your data anytime.</span>
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Information We Collect</h3>

            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">What</th>
                    <th className="px-4 py-2 text-left font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Email</td>
                    <td className="px-4 py-2 text-gray-700">
                      Account creation and password resets
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Name</td>
                    <td className="px-4 py-2 text-gray-700">Personalize your experience</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Password</td>
                    <td className="px-4 py-2 text-gray-700">
                      Secure your account (encrypted!)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Guitar data</td>
                    <td className="px-4 py-2 text-gray-700">Track your collection</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Photos</td>
                    <td className="px-4 py-2 text-gray-700">Display your guitars</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
              <p className="text-xs font-semibold text-gray-900 mb-1">What We DON'T Collect:</p>
              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                <li>Your browsing history outside our app</li>
                <li>Your location</li>
                <li>Third-party tracking cookies</li>
                <li>Anything we don't actually need</li>
              </ul>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">How We Use Your Data</h3>
            <p className="text-sm text-gray-700 mb-2">We use your data to:</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-3">
              <li>Provide and maintain the service</li>
              <li>Send password reset emails</li>
              <li>Fix bugs and improve features</li>
              <li>Prevent fraud and abuse</li>
            </ul>
            <p className="text-sm text-gray-700 mb-2">
              <strong>We will NEVER:</strong>
            </p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Sell your data to third parties</li>
              <li>Share your collection with anyone else</li>
              <li>Send you spam</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Data Security</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>
                <strong>Encryption:</strong> All data encrypted in transit (HTTPS) and at rest
              </li>
              <li>
                <strong>Passwords:</strong> Hashed and salted (never stored in plain text)
              </li>
              <li>
                <strong>Access control:</strong> Only authorized systems can access your data
              </li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mt-3">
              <p className="text-xs text-gray-700">
                <strong>⚠️ Important:</strong> No system is 100% secure. We do our best, but we
                recommend you keep your own backups of important information.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sharing Your Data</h3>
            <p className="text-sm text-gray-700 mb-2">We share your data only:</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>With your explicit consent</li>
              <li>With service providers (cloud hosting, email) under strict agreements</li>
              <li>If required by law</li>
            </ul>
            <p className="text-sm text-gray-700 mt-2">
              <strong>We will never sell your data. Period.</strong>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Your Rights</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>
                <strong>Access:</strong> Download all your information anytime
              </li>
              <li>
                <strong>Edit:</strong> Change your data whenever you want
              </li>
              <li>
                <strong>Delete:</strong> Remove your account and all data
              </li>
              <li>
                <strong>Export:</strong> Get a copy in a portable format
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cookies & Tracking</h3>
            <p className="text-sm text-gray-700 mb-2">We use minimal cookies to:</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-2">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Ensure security</li>
            </ul>
            <p className="text-sm text-gray-700">
              <strong>We don't use:</strong> Advertising cookies, tracking pixels, or social media
              tracking.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Children's Privacy</h3>
            <p className="text-sm text-gray-700">
              This service is not for children under 13. We don't knowingly collect data from kids.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Data Retention</h3>
            <p className="text-sm text-gray-700">
              We keep your data while you have an account. When you delete your account, your data
              is permanently removed from our active systems.
            </p>
          </section>

          <div className="bg-primary-50 border-l-4 border-primary-500 p-4 rounded">
            <p className="text-sm">
              <strong>Our Promise:</strong><br />
              We built this app because we love guitars, not to harvest your data. Your privacy
              matters to us. We'll always be transparent, never sneaky, and always on your side. 🎸
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
