import React, { useState, useEffect } from 'react';
import { 
  FolderUp, Key, Eye, EyeOff, Clock, Trash2, Copy, Check, 
  RefreshCw, ShieldCheck, DownloadCloud 
} from 'lucide-react';
import { formatFileSize, formatTimeRemaining, formatDateArabic } from '../utils/helpers';
import { getMyUploads, deleteSharedFile } from '../utils/storageService';

export default function MyUploadsBar({ currentUser, onOpenAuth, onFileDeleted }) {
  const [myFiles, setMyFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedPins, setRevealedPins] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [msg, setMsg] = useState('');

  const loadMyFiles = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const files = await getMyUploads(currentUser.id);
      setMyFiles(files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyFiles();
  }, [currentUser]);

  const togglePinReveal = (id) => {
    setRevealedPins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySecurityDetails = (file) => {
    const text = `بيانات استلام الملف (${file.originalName}):\n- الرقم السري (PIN): ${file.security.pin}${file.security.account ? `\n- الحساب: ${file.security.account}` : ''}${file.security.name ? `\n- الاسم: ${file.security.name}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteSharedFile = async (file) => {
    if (!confirm(`هل تريد بالتأكيد حذف الملف "${file.originalName}" وإلغاء إتاحته؟`)) return;

    try {
      await deleteSharedFile(file.id, currentUser.id);
      setMsg('تم حذف الملف بنجاح');
      setTimeout(() => setMsg(''), 3000);
      loadMyFiles();
      if (onFileDeleted) onFileDeleted();
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mx-auto">
          <FolderUp className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-base sm:text-lg">الملفات التي رفعتها</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          يرجى تسجيل الدخول لمتابعة ملفاتك المشتركة، مراجعة رموز الأمان الخاصة بها، أو إلغاء إتاحتها.
        </p>
        <button
          onClick={onOpenAuth}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          تسجيل الدخول الآن
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <FolderUp className="w-5 h-5 text-slate-100" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base sm:text-lg">الملفات التي رفعتها للتبادل</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة الرموز السرية ومشاركتها مع الطرف المستلم وإدارة الملفات
            </p>
          </div>
        </div>

        <button
          onClick={loadMyFiles}
          className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Files Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold bg-slate-50/50">
          <span>ملفاتي المشتركة ({myFiles.length})</span>
        </div>

        {myFiles.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
              <FolderUp className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">لم تقم برفع أي ملف للتبادل حتى الآن</h4>
            <p className="text-xs text-slate-400">
              يمكنك رفع ملف برقم سري مخصص من قسم "رفع الملفات".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myFiles.map((file) => {
              const isRevealed = revealedPins[file.id];

              return (
                <div key={file.id} className="p-5 space-y-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{file.originalName}</h4>
                        {file.isExpired && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                            منتهي
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {formatFileSize(file.size)} • {formatDateArabic(file.uploadedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopySecurityDetails(file)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                      >
                        {copiedId === file.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>نسخ بيانات الفتح</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteSharedFile(file)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف الملف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Security Credentials Strip */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* PIN */}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">الرقم السري:</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-xs bg-white px-2.5 py-1 rounded-md border border-slate-200">
                          <span>{isRevealed ? file.security.pin : '•••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(file.id)}
                            className="text-slate-400 hover:text-slate-700"
                            title={isRevealed ? 'إخفاء' : 'إظهار'}
                          >
                            {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Optional Account */}
                      {file.security.account && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="text-slate-400">الحساب:</span>
                          <strong className="font-semibold text-slate-800">{file.security.account}</strong>
                        </div>
                      )}

                      {/* Optional Name */}
                      {file.security.name && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="text-slate-400">الاسم:</span>
                          <strong className="font-semibold text-slate-800">{file.security.name}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatTimeRemaining(file.expiresAt)}</span>
                      </div>

                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-bold">
                        <DownloadCloud className="w-3 h-3" />
                        <span>{file.downloadsCount || 0} استلام</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
