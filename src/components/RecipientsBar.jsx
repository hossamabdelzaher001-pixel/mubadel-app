import React, { useState } from 'react';
import { 
  Users, UserPlus, Trash2, Hash, Check, X, AlertCircle, 
  HelpCircle, UserCheck 
} from 'lucide-react';
import { formatDateArabic } from '../utils/helpers';
import { addRecipient, deleteRecipient } from '../utils/storageService';

export default function RecipientsBar({ recipients, currentUser, onOpenAuth, onRefreshRecipients }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [recipientNumber, setRecipientNumber] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!recipientNumber.trim()) {
      setError('يرجى كتابة رقم المستلم المتفق عليه');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await addRecipient(currentUser.id, recipientNumber.trim(), recipientLabel.trim());
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.error || 'حدث خطأ أثناء الحفظ');
        return;
      }

      setSuccess('تمت إضافة المستلم المميز بنجاح');
      setTimeout(() => setSuccess(''), 3000);
      setRecipientNumber('');
      setRecipientLabel('');
      setShowAddModal(false);
      onRefreshRecipients();
    } catch (err) {
      setIsSubmitting(false);
      setError('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDeleteRecipient = async (id) => {
    if (!confirm('هل تريد حذف هذا المستلم من قائمتك؟')) return;

    try {
      await deleteRecipient(id, currentUser.id);
      setSuccess('تمت الإزالة بنجاح');
      setTimeout(() => setSuccess(''), 3000);
      onRefreshRecipients();
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-base sm:text-lg">المستلمون المميزون</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          يرجى تسجيل الدخول لتسجيل أرقام المستلمين المتفق عليها مسبقاً وتسهيل إرسال الملفات إليهم.
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
            <Users className="w-5 h-5 text-slate-100" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base sm:text-lg">المستلمون المميزون</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة الأرقام المتفق عليها مع المستلمين لتخصيص الملفات بسرعة أثناء الرفع
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setError('');
            setShowAddModal(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستلم مميز</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tip Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">فائدة هذه الميزة:</span>
          <span className="text-slate-600 mr-1">
            عند حفظ مستلم هنا بالرقم المتفق عليه، ستظهر لك خطوة سريعة في "رفع الملفات" لتعيين الملف له مباشرة مع إمكانية تخطيها في أي وقت.
          </span>
        </div>
      </div>

      {/* Recipients Cards Grid */}
      {recipients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2.5 shadow-xs">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-700 text-sm">لا يوجد مستلمون مسجلون</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            اضغط على زر "إضافة مستلم مميز" لكتابة الرقم المتفق عليه.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {recipients.map((recip) => (
            <div
              key={recip.id}
              className="bg-white rounded-xl border border-slate-200 p-4.5 hover:border-slate-400 transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                    <UserCheck className="w-4 h-4" />
                  </div>

                  <button
                    onClick={() => handleDeleteRecipient(recip.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{recip.name}</h4>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border border-slate-200">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>الرقم: {recip.recipientNumber}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                أُضيف في: {formatDateArabic(recip.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">إضافة مستلم مميز</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                أدخل الرقم المتفق عليه مع الطرف الآخر
              </p>
            </div>

            {error && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اكتب الرقم هنا <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="اكتب الرقم هنا"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value)}
                    dir="ltr"
                    className="w-full pr-9 pl-3 py-2.5 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 text-right"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم أو مسمى المستلم (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: مكتبة التصوير أو الاسم"
                  value={recipientLabel}
                  onChange={(e) => setRecipientLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-5 py-2 rounded-xl transition-colors"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
