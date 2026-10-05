import React from 'react';
import { ShieldAlert, X, Lock } from 'lucide-react';

export default function SecurityWarningModal({ isOpen, onClose, violationAction }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-red-200 relative text-right">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Red Shield Header */}
        <div className="bg-red-700 text-white p-6 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <ShieldAlert className="w-8 h-8 text-white animate-bounce" />
          </div>
          <h3 className="text-lg font-black tracking-tight">تنبيه أمني مشدد</h3>
          <p className="text-xs text-red-100 mt-1">تم رصد إجراء غير مصرح به</p>
        </div>

        {/* Content with exact required message */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs sm:text-sm font-bold leading-relaxed space-y-2">
            <p className="text-sm text-red-800 font-black">
              عذراً، لا يمكن عمل ذلك لأغراض الأمان والحماية ولحماية حقوق الملكية الفكرية.
            </p>
            <p className="text-xs text-red-700 font-medium">
              تم تسجيل بيانات المحاولة وجهازك وتوقيتها وإرسال إشعار فوري إلى الإدارة المختصة عبر:
            </p>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-red-200 text-center font-mono text-xs text-slate-800" dir="ltr">
              hossamabdelzaher001@gmail.com
            </div>
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <p>• الإجراء المرصود: <strong className="text-slate-800">{violationAction || 'فحص العنصر أو زر الفأرة'}</strong></p>
            <p>• حالة النظام: <strong>كافة الأكواد والمحتويات مشفرة ومحمية قانونياً.</strong></p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            فهمت ذلك، والعودة للتطبيق
          </button>
        </div>

      </div>
    </div>
  );
}
