// Anti-tamper & Security Shield for Mubadel Application
// Protects code inspection, disables right-click, F12, DevTools shortcuts, and logs violations.

export function setupSecurityProtection(onSecurityViolation) {
  const TARGET_EMAIL = 'hossamabdelzaher001@gmail.com';

  const reportViolation = (actionType) => {
    const violationData = {
      action: actionType,
      targetEmail: TARGET_EMAIL,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'unknown',
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      pageUrl: window.location.href
    };

    // Trigger visual warning modal
    if (onSecurityViolation) {
      onSecurityViolation(actionType);
    }

    // Attempt background email report via Formspree / webhook / server endpoint
    try {
      fetch('https://formspree.io/f/xbjnqzzg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _subject: `⚠️ تنبيه أمني: محاولة فحص أو اختراق موقع مُبادِل (${actionType})`,
          email: TARGET_EMAIL,
          message: `تم رصد محاولة غير مصرح بها للعبث أو فحص الكود:
- الإجراء المحظور: ${actionType}
- التوقيت: ${violationData.timestamp}
- نظام وجهاز المتطفل: ${violationData.userAgent}
- دقة الشاشة: ${violationData.screenResolution}
- رابط الصفحة: ${violationData.pageUrl}`
        })
      }).catch(() => {});
    } catch (e) {}
  };

  // 1. Prevent Right-Click Context Menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    reportViolation('الضغط بزر الفأرة الأيمن (Right-Click Context Menu)');
    return false;
  };

  // 2. Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S
  const handleKeyDown = (e) => {
    // F12
    if (e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      reportViolation('الضغط على مفتاح F12 (أدوات المطورين)');
      return false;
    }

    // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element picker)
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      reportViolation(`اختصار المطورين (Ctrl+Shift+${String.fromCharCode(e.keyCode)})`);
      return false;
    }

    // Cmd+Option+I, Cmd+Option+J, Cmd+Option+C on macOS
    if (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      reportViolation('اختصار المطورين على نظام ماك (Cmd+Option+Inspect)');
      return false;
    }

    // Ctrl+U (View Source)
    if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 117)) {
      e.preventDefault();
      e.stopPropagation();
      reportViolation('محاولة عرض المصدر البرمجي (Ctrl+U)');
      return false;
    }

    // Ctrl+S (Save Page)
    if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 115)) {
      e.preventDefault();
      e.stopPropagation();
      reportViolation('محاولة حفظ الصفحة محلياً (Ctrl+S)');
      return false;
    }
  };

  // Attach global event listeners
  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });

  // Cleanup function
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}
