import { X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal = ({ isOpen, onClose }: TermsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
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
              <strong>👋 Hey there!</strong><br />
              These terms are written in plain English because nobody likes reading legal jargon.
              This is a fun, personal project for tracking guitar collections. We're keeping it
              simple and friendly.
            </p>
          </div>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">1. The Basics</h3>
            <p className="text-sm text-gray-700">
              By using this Guitar Collection app, you agree to these terms. If you don't agree,
              that's totally fine – just don't use the app.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">2. What This App Is</h3>
            <p className="text-sm text-gray-700">
              This is a personal project to help you track and organize your guitar collection.
              It's free to use, built for fun, and provided "as-is" without any fancy warranties.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">3. Your Account</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>You're responsible for keeping your password secure</li>
              <li>Don't share your account with others</li>
              <li>You must be 13 years or older to use this app</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">4. Your Content</h3>
            <p className="text-sm text-gray-700 mb-2">
              All the guitar information, photos, and notes you add belong to you. We don't claim
              any ownership of your data.
            </p>
            <p className="text-sm text-gray-700">You're responsible for:</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Making sure you have the right to upload any photos</li>
              <li>Not uploading anything illegal, harmful, or offensive</li>
              <li>Backing up your own data</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">5. What We Won't Do</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>We won't sell your data</li>
              <li>We won't spam you with emails</li>
              <li>We won't share your guitar collection with anyone</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">6. What We Can't Promise</h3>
            <p className="text-sm text-gray-700 mb-2">This is a personal/hobby project, so:</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>The app might have bugs</li>
              <li>The service might go down sometimes</li>
              <li>We can't guarantee your data will be safe forever (please back it up!)</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">7. Things You Shouldn't Do</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Try to hack or break the app</li>
              <li>Upload viruses or malicious code</li>
              <li>Use the app for anything illegal</li>
              <li>Abuse the service or overload servers</li>
            </ul>
            <p className="text-sm text-gray-700 mt-2">Basically, be cool. Don't be a jerk.</p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              8. Disclaimer & Limitation of Liability
            </h3>
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-2">
              <p className="text-xs text-gray-700 font-semibold mb-1">IMPORTANT LEGAL STUFF:</p>
              <p className="text-xs text-gray-700">
                THIS SERVICE IS PROVIDED "AS-IS" WITHOUT ANY WARRANTIES. WE'RE NOT LIABLE FOR ANY
                DAMAGES, DATA LOSS, OR ISSUES THAT MIGHT ARISE FROM USING THE APP.
              </p>
            </div>
            <p className="text-sm text-gray-700">
              <strong>In plain English:</strong> We built this for fun and hope you enjoy it, but
              we can't be held responsible if something goes wrong. Use at your own risk!
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">9. Indemnification</h3>
            <p className="text-sm text-gray-700 mb-2">
              You agree to defend and hold us harmless from claims arising from:
            </p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Your use or misuse of the service</li>
              <li>Your violation of these terms</li>
              <li>Any content you upload</li>
            </ul>
            <p className="text-sm text-gray-700 mt-2">
              <strong>In plain English:</strong> If you do something that gets us in legal trouble,
              you're responsible. Don't upload illegal stuff.
            </p>
          </section>

          <div className="bg-primary-50 border-l-4 border-primary-500 p-4 rounded">
            <p className="text-sm">
              <strong>Bottom Line:</strong><br />
              Be nice, respect others' data, don't break stuff, and have fun tracking your awesome
              guitar collection. That's what this is all about! 🎸
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
