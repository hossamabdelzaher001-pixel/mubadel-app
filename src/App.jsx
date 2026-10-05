import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import SuccessModal from './components/SuccessModal';
import SecurityWarningModal from './components/SecurityWarningModal';
import UploadBar from './components/UploadBar';
import PublicFilesBar from './components/PublicFilesBar';
import VaultBar from './components/VaultBar';
import MyUploadsBar from './components/MyUploadsBar';
import RecipientsBar from './components/RecipientsBar';
import { getOrCreateClientId } from './utils/helpers';
import { getPublicFiles, getRecipients } from './utils/storageService';
import { setupSecurityProtection } from './utils/securityProtection';
import { 
  UploadCloud, Globe, Layers, FolderUp, Users, 
  ShieldCheck 
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mubadel_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState(null);
  const [securityViolation, setSecurityViolation] = useState(null);

  const [publicFiles, setPublicFiles] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [clientId] = useState(() => getOrCreateClientId());

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('mubadel_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mubadel_user');
  };

  const fetchPublicFiles = async () => {
    try {
      const files = await getPublicFiles(currentUser?.id, clientId);
      setPublicFiles(files || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecipients = async () => {
    if (!currentUser) {
      setRecipients([]);
      return;
    }
    try {
      const list = await getRecipients(currentUser.id);
      setRecipients(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const cleanup = setupSecurityProtection((violationAction) => {
      setSecurityViolation(violationAction);
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    fetchPublicFiles();
  }, [currentUser, clientId]);

  useEffect(() => {
    fetchRecipients();
  }, [currentUser]);

  const handleUploadSuccess = (data) => {
    setSuccessModalData(data);
    fetchPublicFiles();
  };

  // 5 Main Navigation Bars
  const tabs = [
    {
      id: 1,
      title: 'رفع الملفات',
      desc: 'إرفاق وتعيين الأمان',
      icon: UploadCloud,
      badge: null
    },
    {
      id: 2,
      title: 'الملفات العامة',
      desc: 'الاستلام وفك التشفير',
      icon: Globe,
      badge: publicFiles.length > 0 ? publicFiles.length : null
    },
    {
      id: 3,
      title: 'المستودع',
      desc: 'تخزين شخصي مشفر',
      icon: Layers,
      badge: null
    },
    {
      id: 4,
      title: 'الملفات التي رفعتها',
      desc: 'متابعة الرموز والاستلام',
      icon: FolderUp,
      badge: null
    },
    {
      id: 5,
      title: 'المستلمون المميزون',
      desc: 'الأرقام المتفق عليها',
      icon: Users,
      badge: recipients.length > 0 ? recipients.length : null
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-cairo text-slate-900">
      
      {/* Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Navigation Tabs - Clean Dark-Slate & Light-Surface Theme */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl transition-all text-right group ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                    isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-xs sm:text-sm truncate">
                        {tab.title}
                      </p>
                      {tab.badge !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}>
                      {tab.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Views Content */}
        <div>
          {activeTab === 1 && (
            <UploadBar
              currentUser={currentUser}
              recipients={recipients}
              onUploadSuccess={handleUploadSuccess}
            />
          )}

          {activeTab === 2 && (
            <PublicFilesBar
              files={publicFiles}
              currentUser={currentUser}
              clientId={clientId}
              onRefresh={fetchPublicFiles}
            />
          )}

          {activeTab === 3 && (
            <VaultBar
              currentUser={currentUser}
              onOpenAuth={() => setShowAuthModal(true)}
            />
          )}

          {activeTab === 4 && (
            <MyUploadsBar
              currentUser={currentUser}
              onOpenAuth={() => setShowAuthModal(true)}
              onFileDeleted={fetchPublicFiles}
            />
          )}

          {activeTab === 5 && (
            <RecipientsBar
              recipients={recipients}
              currentUser={currentUser}
              onOpenAuth={() => setShowAuthModal(true)}
              onRefreshRecipients={fetchRecipients}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 مُبادِل - التبادل الآمن للملفات</p>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>حماية مشفرة</span>
            <span>•</span>
            <span>تأمين متقدم ضد التخمين</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
      />

      <SuccessModal
        isOpen={!!successModalData}
        onClose={() => setSuccessModalData(null)}
        uploadedData={successModalData}
        onGoToPublic={() => setActiveTab(2)}
      />

      <SecurityWarningModal
        isOpen={!!securityViolation}
        onClose={() => setSecurityViolation(null)}
        violationAction={securityViolation}
      />

    </div>
  );
}
