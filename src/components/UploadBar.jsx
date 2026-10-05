import React, { useState, useRef } from 'react';
import { 
  Upload, File, X, AlertCircle, Sparkles, Shield, Clock, 
  ArrowLeft, ArrowRight, CheckCircle2, UserCheck, HardDrive, Layers
} from 'lucide-react';
import { formatFileSize } from '../utils/helpers';
import { suggestUniquePin, uploadSharedFiles } from '../utils/storageService';

export default function UploadBar({ currentUser, recipients, onUploadSuccess }) {
  const [step, setStep] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  
  // Optional Recipient
  const [selectedRecipient, setSelectedRecipient] = useState('');

  // Custom File Name Field
  const [customFileName, setCustomFileName] = useState('');

  // Security tools
  const [pin, setPin] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSuggestingPin, setIsSuggestingPin] = useState(false);

  // Expiration
  const [expiryHours, setExpiryHours] = useState('24');

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Constants
  const MAX_SINGLE_FILE = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
  const MAX_TOTAL_FILES = 8 * 1024 * 1024 * 1024;   // 8 GB

  // File Selection Handler
  const handleFileChange = (e) => {
    setFileError('');
    const newFiles = Array.from(e.target.files);
    validateAndAddFiles(newFiles);
  };

  const validateAndAddFiles = (incomingFiles) => {
    // Check single file limit (1.5 GB)
    for (const file of incomingFiles) {
      if (file.size > MAX_SINGLE_FILE) {
        setFileError(`الملف "${file.name}" حجمه ${formatFileSize(file.size)} ويتجاوز الحد الأقصى للملف الواحد (1.5 جيجابايت)!`);
        return;
      }
    }

    // Check total limit (8 GB)
    const combinedFiles = [...selectedFiles, ...incomingFiles];
    const totalSize = combinedFiles.reduce((acc, f) => acc + f.size, 0);

    if (totalSize > MAX_TOTAL_FILES) {
      setFileError(`إجمالي مساحة الملفات (${formatFileSize(totalSize)}) يتجاوز الحد الأقصى (8 جيجابايت)!`);
      return;
    }

    setSelectedFiles(combinedFiles);
  };

  const removeFile = (index) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    setFileError('');
  };

  // Suggest unique PIN
  const handleSuggestPin = async () => {
    setIsSuggestingPin(true);
    try {
      const suggested = await suggestUniquePin();
      if (suggested) {
        setPin(suggested);
        setSecurityError('');
      }
    } catch (err) {
      setPin(Math.floor(10000 + Math.random() * 90000).toString());
    } finally {
      setIsSuggestingPin(false);
    }
  };

  // Handle PIN change (digits only)
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setPin(value);
    setSecurityError('');
  };

  // Handle Name change (letters only)
  const handleNameChange = (e) => {
    const value = e.target.value.replace(/[^\p{L}\s]/gu, '');
    setName(value);
  };

  // Step 1 validation
  const handleNextFromFiles = () => {
    if (selectedFiles.length === 0) {
      setFileError('يرجى اختيار ملف واحد على الأقل للمتابعة');
      return;
    }
    if (recipients && recipients.length > 0) {
      setStep(1.5);
    } else {
      setStep(2);
    }
  };

  // Step 2 validation
  const handleNextFromSecurity = () => {
    if (!pin.trim()) {
      setSecurityError('الرقم السري إجباري ولا يقبل سوى أرقام فقط!');
      return;
    }
    setSecurityError('');
    setStep(3);
  };

  // Save / Upload
  const handleFinalSave = async () => {
    setIsUploading(true);
    setSecurityError('');
    setUploadProgress(40);

    try {
      setUploadProgress(70);
      const res = await uploadSharedFiles(selectedFiles, {
        pin,
        account,
        name,
        customFileName,
        expiryHours,
        recipientNumber: selectedRecipient,
        currentUser
      });

      setUploadProgress(100);

      if (!res.success) {
        setIsUploading(false);
        setSecurityError(res.error || 'حدث خطأ أثناء رفع الملف');
        if (res.error && res.error.includes('مستخدم بالفعل')) {
          setStep(2);
        }
        return;
      }

      setIsUploading(false);
      onUploadSuccess({
        pin,
        account,
        name,
        expiryHours: parseInt(expiryHours, 10),
        filesCount: selectedFiles.length
      });

      // Reset form
      setSelectedFiles([]);
      setCustomFileName('');
      setPin('');
      setAccount('');
      setName('');
      setSelectedRecipient('');
      setStep(1);
    } catch (err) {
      setIsUploading(false);
      setSecurityError('حدث خطأ غير متوقع، يرجى المحاولة لاحقاً');
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
      
      {/* Top Banner / Progress Indicator */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">رفع وتأمين الملفات للتبادل</h2>
              <p className="text-xs text-slate-500">
                إرفاق المستندات، تعيين بيانات الأمان، وتحديد وقت الصلاحية
              </p>
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={`px-2.5 py-1 rounded-lg ${step === 1 ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
              ١. الملفات
            </span>
            {recipients?.length > 0 && (
              <span className={`px-2.5 py-1 rounded-lg ${step === 1.5 ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
                المستلم
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg ${step === 2 ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
              ٢. أدوات الأمان
            </span>
            <span className={`px-2.5 py-1 rounded-lg ${step === 3 ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
              ٣. مدة الظهور
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        
        {/* STEP 1: Select Files */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-slate-800 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/40 hover:bg-slate-50 transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6 text-slate-800" />
              </div>

              <button
                type="button"
                className="bg-slate-900 group-hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs transition-colors mb-2 inline-flex items-center gap-2"
              >
                <span>ارفق الملف</span>
              </button>

              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                اضغط لاختيار الملفات من جهازك أو اسحبها للإفلات هنا
              </p>
              <p className="text-xs text-slate-400 mt-1">
                جميع الصيغ مدعومة (مستندات، صور، ملفات PDF، وسائط، ملفات مضغوطة)
              </p>

              {/* Limits Information Badge */}
              <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 bg-white py-1.5 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  أقصى حد للملف: <strong className="text-slate-900">1.5 جيجابايت</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 font-medium">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  أقصى مجموع: <strong className="text-slate-900">8 جيجابايت</strong>
                </span>
              </div>
            </div>

            {/* Error Message */}
            {fileError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs sm:text-sm font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-bold">
                  <span>الملفات المحددة ({selectedFiles.length})</span>
                  <span>الإجمالي: {formatFileSize(totalSize)}</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                          <File className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="إزالة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Optional Custom File Name */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    تخصيص اسم للملف (اختياري):
                  </label>
                  <input
                    type="text"
                    placeholder="اكتب اسماً مخصصاً للملف بدلاً من اسمه الأصلي (مثال: مستند العمل النهائي)..."
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    سيظهر هذا الاسم الدلالي للمستلم في قائمة الملفات العامة وبطاقة التحميل.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextFromFiles}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
                  >
                    <span>التالي</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1.5: Optional Featured Recipient */}
        {step === 1.5 && (
          <div className="space-y-5 max-w-xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-200">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">تعيين لمستلم مميز (خطوة إضافية)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكنك تخصيص هذا الملف لرقم مستلم مسجل لديك أو تخطي هذه الخطوة
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">اختر المستلم:</label>
              <div className="space-y-2">
                {recipients.map((recip) => (
                  <label
                    key={recip.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedRecipient === recip.recipientNumber 
                        ? 'border-slate-900 bg-slate-50 shadow-xs' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="recipientRadio"
                        checked={selectedRecipient === recip.recipientNumber}
                        onChange={() => setSelectedRecipient(recip.recipientNumber)}
                        className="text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">{recip.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">الرقم: {recip.recipientNumber}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecipient('');
                    setStep(2);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  تخطي الخطوة
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <span>التالي</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Security Tools */}
        {step === 2 && (
          <div className="space-y-5 max-w-xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-200">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">أدوات الأمان والحماية</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                حدد البيانات التي يجب على المستلم إدخالها لفتح الملف
              </p>
            </div>

            {securityError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-bold flex items-start gap-2.5 shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p>{securityError}</p>
                  <p className="text-xs font-normal text-red-600 mt-0.5">
                    يمكنك الضغط على زر <strong>"اقتراح رمز غير مستخدم"</strong> لتوليد رمز فريد ومضمون فوراً.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3.5">
              
              {/* Tool 1: PIN */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>١. الرقم السري (PIN)</span>
                    <span className="text-red-500 font-bold">* إجباري (أرقام فقط)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSuggestPin}
                    disabled={isSuggestingPin}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isSuggestingPin ? 'جاري التوليد...' : 'اقتراح رمز غير مستخدم'}</span>
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  placeholder="أدخل أرقاماً فقط (مثال: 48192)"
                  value={pin}
                  onChange={handlePinChange}
                  dir="ltr"
                  className="w-full text-center text-base font-mono font-bold tracking-widest px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  يقبل الأرقام حصراً، ويجب ألا يتطابق مع أي ملف نشط آخر.
                </p>
              </div>

              {/* Tool 2: Account */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    ٢. إدخال حساب (اختياري)
                  </label>
                  <span className="text-[11px] text-slate-400">اختياري</span>
                </div>
                <input
                  type="text"
                  placeholder="اسم المستخدم أو البريد"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  dir="ltr"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white text-left"
                />
                <p className="text-[11px] text-slate-400">
                  إذا حُدد، سيتوجب على الطرف الآخر إدخاله بدقة بجانب الرقم السري.
                </p>
              </div>

              {/* Tool 3: Name */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    ٣. إدخال اسم (اختياري - حروف فقط)
                  </label>
                  <span className="text-[11px] text-slate-400">حروف فقط</span>
                </div>
                <input
                  type="text"
                  placeholder="اكتب الاسم المطلوب"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  يقبل الحروف الأبجدية فقط دون أرقام أو رموز.
                </p>
              </div>

            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(recipients?.length > 0 ? 1.5 : 1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                onClick={handleNextFromSecurity}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Visibility & Expiration Hours */}
        {step === 3 && (
          <div className="space-y-5 max-w-xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-200">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">مدة ظهور الملف</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                حدد المدة التي يظل فيها الملف متاحاً قبل اختفائه تلقائياً
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { label: '4 ساعات', value: '4' },
                { label: '8 ساعات', value: '8' },
                { label: '12 ساعة', value: '12' },
                { label: '24 ساعة', value: '24' },
                { label: '48 ساعة', value: '48' },
                { label: '72 ساعة', value: '72' },
                { label: 'لا تختفي أبداً', value: '-1', full: true }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiryHours(opt.value)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    opt.full ? 'col-span-2 sm:col-span-3' : ''
                  } ${
                    expiryHours === opt.value
                      ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                  }`}
                >
                  <p className="text-xs sm:text-sm">{opt.label}</p>
                </button>
              ))}
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
              <p className="font-bold text-slate-900 mb-1">ملخص الرفع:</p>
              <p>• الملفات: {selectedFiles.length} ({formatFileSize(totalSize)})</p>
              <p>• الرقم السري (PIN): <span className="font-mono font-bold text-slate-900">{pin}</span></p>
              {account && <p>• الحساب: {account}</p>}
              {name && <p>• الاسم: {name}</p>}
              <p>• المدة: {expiryHours === '-1' ? 'دائم (لا يختفي)' : `${expiryHours} ساعة`}</p>
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-slate-900 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-[11px] font-semibold text-slate-600">
                  جاري تشفير ورفع الملفات...
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={handleFinalSave}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>حفظ ورفع الملف</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
