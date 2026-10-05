import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderArchive, Upload, Edit3, Archive, Trash2, Download, 
  FileText, ShieldCheck, Check, X, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { formatFileSize, formatDateArabic } from '../utils/helpers';
import { getVaultFiles, uploadToVault, renameVaultFile, compressVaultFile, deleteVaultFile } from '../utils/storageService';

export default function VaultBar({ currentUser, onOpenAuth }) {
  const [vaultFiles, setVaultFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState(null);
  const [newName, setNewName] = useState('');

  const fileInputRef = useRef(null);

  const loadVaultFiles = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const files = await getVaultFiles(currentUser.id);
      setVaultFiles(files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVaultFiles();
  }, [currentUser]);

  // Handle Upload to Vault
  const handleUploadVault = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      await uploadToVault(files, currentUser.id);
      setSuccessMsg('تم حفظ الملف في مستودعك الخاص بنجاح');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadVaultFiles();
    } catch (err) {
      setError('حدث خطأ أثناء رفع الملف للمستودع');
    } finally {
      setUploading(false);
    }
  };

  // Operation 1: Rename (التسمية)
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;

    try {
      await renameVaultFile(renameTarget.id, newName.trim(), currentUser.id);
      setSuccessMsg('تمت إعادة تسمية الملف بنجاح');
      setTimeout(() => setSuccessMsg(''), 3000);
      setRenameTarget(null);
      setNewName('');
      loadVaultFiles();
    } catch (err) {
      setError('حدث خطأ أثناء تعديل الاسم');
    }
  };

  // Operation 2: Compress (الضغط)
  const handleCompress = async (file) => {
    try {
      setSuccessMsg(`جاري ضغط الملف "${file.originalName}"...`);
      await compressVaultFile(file.id, currentUser.id);
      setSuccessMsg('تم ضغط الملف إلى أرشيف ZIP بنجاح');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadVaultFiles();
    } catch (err) {
      setError('حدث خطأ أثناء ضغط الملف');
    }
  };

  // Operation 3: Delete (الحذف)
  const handleDelete = async (file) => {
    if (!confirm(`هل أنت متأكد من حذف الملف "${file.originalName}" من مستودعك؟`)) return;

    try {
      await deleteVaultFile(file.id, currentUser.id);
      setSuccessMsg('تم حذف الملف من المستودع بنجاح');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadVaultFiles();
    } catch (err) {
      setError('حدث خطأ أثناء حذف الملف');
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">المستودع السحابي المشفر</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          هذا القسم مخصص للاحتفاظ الشخصي والآمن بملفاتك. يرجى تسجيل الدخول للوصول إلى مستودعك الخاص.
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

  const totalVaultSize = vaultFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-5">
      
      {/* Vault Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5 text-slate-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-lg">المستودع الشخصي</h2>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200">
                تخزين مشفر خاص
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مساحتك الخاصة لحفظ الملفات مع إمكانية التسمية والضغط والحذف
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUploadVault}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'جاري الرفع...' : 'رفع ملف للمستودع'}</span>
          </button>

          <button
            onClick={loadVaultFiles}
            className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Files List Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold bg-slate-50/50">
          <span>الملفات المحفوظة بالمستودع ({vaultFiles.length})</span>
          <span>المساحة الإجمالية: {formatFileSize(totalVaultSize)}</span>
        </div>

        {vaultFiles.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
              <FolderArchive className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">المستودع فارغ</h4>
            <p className="text-xs text-slate-400">
              يمكنك رفع ملفاتك الشخصية الآن لحفظها وإدارتها بخصوصية تامة.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {vaultFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    file.isCompressed ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {file.isCompressed ? <Archive className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatFileSize(file.size)} • {formatDateArabic(file.uploadedAt)}
                      {file.isCompressed && <span className="mr-1.5 text-amber-700 font-semibold">(مضغوط ZIP)</span>}
                    </p>
                  </div>
                </div>

                {/* The 3 Actions: التسمية، الضغط، الحذف + التحميل */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  
                  {/* Download */}
                  <a
                    href={`/api/vault/download/${file.id}?userId=${currentUser.id}`}
                    download={file.originalName}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    title="تحميل"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  {/* 1. التسمية (Rename) */}
                  <button
                    onClick={() => {
                      setRenameTarget(file);
                      setNewName(file.originalName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>التسمية</span>
                  </button>

                  {/* 2. الضغط (Compress) */}
                  <button
                    onClick={() => handleCompress(file)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-500" />
                    <span>الضغط</span>
                  </button>

                  {/* 3. الحذف (Delete) */}
                  <button
                    onClick={() => handleDelete(file)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>الحذف</span>
                  </button>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">إعادة تسمية الملف</h3>
              <button
                onClick={() => setRenameTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الملف الجديد:
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
