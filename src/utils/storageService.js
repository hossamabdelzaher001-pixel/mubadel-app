import JSZip from 'jszip';

// Local storage keys
const PUBLIC_FILES_KEY = 'mubadel_public_files';
const VAULT_FILES_KEY = 'mubadel_vault_files';
const RECIPIENTS_KEY = 'mubadel_recipients';
const BLOCKED_CLIENTS_KEY = 'mubadel_blocked_clients';

// Helper to check expiry
export function isFileExpired(file) {
  if (!file.expiresAt) return false;
  return new Date() > new Date(file.expiresAt);
}

// 1. Get Public Files (Hybrid)
export async function getPublicFiles(currentUserId, clientId) {
  try {
    const res = await fetch(`/api/files/public?clientId=${clientId}${currentUserId ? `&currentUserId=${currentUserId}` : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files) && data.files.length > 0) {
        return data.files;
      }
    }
  } catch (e) {}

  // Fallback to local persistence
  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  const files = saved ? JSON.parse(saved) : [];
  const activeFiles = files.filter(f => !isFileExpired(f));

  return activeFiles.map(f => ({
    id: f.id,
    originalName: f.originalName,
    size: f.size,
    mimetype: f.mimetype,
    uploadedAt: f.uploadedAt,
    expiresAt: f.expiresAt,
    expiryHours: f.expiryHours,
    isUploadedByMe: currentUserId && f.uploader?.id === currentUserId,
    recipientNumber: f.recipientNumber,
    requiredTools: {
      pin: true,
      account: !!f.security?.account,
      name: !!f.security?.name
    },
    isPermanentlyBlocked: f.blockedClients?.includes(clientId) || false,
    fileData: f.fileData
  }));
}

// 2. Suggest unique PIN
export async function suggestUniquePin() {
  try {
    const res = await fetch('/api/files/suggest-pin');
    if (res.ok) {
      const data = await res.json();
      if (data.suggestedPin) return data.suggestedPin;
    }
  } catch (e) {}

  // Local calculation
  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  const files = saved ? JSON.parse(saved) : [];
  const activePins = new Set(files.filter(f => !isFileExpired(f)).map(f => f.security?.pin));

  let pin = '';
  do {
    pin = Math.floor(10000 + Math.random() * 90000).toString();
  } while (activePins.has(pin));

  return pin;
}

// 3. Upload Public Files (Hybrid)
export async function uploadSharedFiles(files, { pin, account, name, expiryHours, recipientNumber, currentUser, customFileName }) {
  // Try server first
  try {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('pin', pin);
    formData.append('account', account || '');
    formData.append('name', name || '');
    formData.append('expiryHours', expiryHours);
    if (recipientNumber) formData.append('recipientNumber', recipientNumber);
    if (customFileName) formData.append('customFileName', customFileName);
    if (currentUser) {
      formData.append('userId', currentUser.id);
      formData.append('userName', currentUser.name);
      formData.append('userEmail', currentUser.email);
    }

    const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const errData = await res.json().catch(() => ({}));
    if (errData.error && errData.error.includes('مستخدم بالفعل')) {
      return { success: false, error: errData.error };
    }
  } catch (e) {}

  // Local fallback
  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  const currentFiles = saved ? JSON.parse(saved) : [];

  // Check collision locally
  const cleanPin = pin.trim();
  const cleanAccount = account ? account.trim().toLowerCase() : '';
  const cleanName = name ? name.trim().toLowerCase() : '';

  const collision = currentFiles.find(f => {
    if (isFileExpired(f)) return false;
    if (f.security?.pin === cleanPin) return true;
    if (cleanAccount && f.security?.account && f.security.account.toLowerCase() === cleanAccount) return true;
    if (cleanName && f.security?.name && f.security.name.toLowerCase() === cleanName) return true;
    return false;
  });

  if (collision) {
    return {
      success: false,
      error: 'أحد أدوات الأمان المدخلة (الرقم السري أو الاسم أو الحساب) مستخدم بالفعل في ملف نشط آخر. يرجى اختيار رمز مختلف أو الضغط على اقتراح رمز.'
    };
  }

  const hours = parseInt(expiryHours, 10);
  const expiresAt = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    const fileDataPromise = new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

    const fileData = await fileDataPromise;

    let finalName = file.name;
    if (customFileName && files.length === 1) {
      const origExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
      finalName = customFileName.trim();
      if (origExt && !finalName.endsWith(origExt)) {
        finalName += origExt;
      }
    }

    const newEntry = {
      id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      originalName: finalName,
      size: file.size,
      mimetype: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      expiresAt,
      expiryHours: hours,
      recipientNumber: recipientNumber || null,
      uploader: {
        id: currentUser?.id || 'guest',
        name: currentUser?.name || 'مستخدم',
        email: currentUser?.email || ''
      },
      security: {
        pin: cleanPin,
        account: account ? account.trim() : '',
        name: name ? name.trim() : ''
      },
      failedAttempts: {},
      blockedClients: [],
      downloadsCount: 0,
      fileData: fileData // Base64 for download
    };

    currentFiles.push(newEntry);
  }

  localStorage.setItem(PUBLIC_FILES_KEY, JSON.stringify(currentFiles));
  return { success: true };
}

// 4. Unlock Public File (Hybrid with 7 attempts check)
export async function unlockFile(fileId, { pin, account, name, clientId, currentUserId }) {
  // Try server
  try {
    const res = await fetch(`/api/files/unlock/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, account, name, clientId, currentUserId })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, ...data };
    }
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403) {
      return { success: false, isBlocked: true, error: 'تم حظر هذا الجهاز نهائياً من فتح هذا الملف لأسباب أمنية.' };
    }
  } catch (e) {}

  // Local fallback
  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  const currentFiles = saved ? JSON.parse(saved) : [];
  const file = currentFiles.find(f => f.id === fileId);

  if (!file) {
    return { success: false, error: 'الملف غير موجود أو انتهت صلاحيته' };
  }

  file.blockedClients = file.blockedClients || [];
  file.failedAttempts = file.failedAttempts || {};

  if (file.blockedClients.includes(clientId)) {
    return { success: false, isBlocked: true, error: 'تم حظر هذا الجهاز نهائياً من فتح هذا الملف لأسباب أمنية.' };
  }

  const pinMatch = (file.security?.pin || '') === (pin || '').trim();
  const accountMatch = !file.security?.account || (file.security.account.toLowerCase() === (account || '').trim().toLowerCase());
  const nameMatch = !file.security?.name || (file.security.name.toLowerCase() === (name || '').trim().toLowerCase());

  if (pinMatch && accountMatch && nameMatch) {
    file.downloadsCount = (file.downloadsCount || 0) + 1;
    delete file.failedAttempts[clientId];
    localStorage.setItem(PUBLIC_FILES_KEY, JSON.stringify(currentFiles));

    return {
      success: true,
      downloadUrl: file.fileData,
      file: {
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype || 'application/octet-stream',
        fileData: file.fileData
      }
    };
  } else {
    file.failedAttempts[clientId] = (file.failedAttempts[clientId] || 0) + 1;
    const attempts = file.failedAttempts[clientId];

    if (attempts >= 7) {
      if (!file.blockedClients.includes(clientId)) {
        file.blockedClients.push(clientId);
      }
      localStorage.setItem(PUBLIC_FILES_KEY, JSON.stringify(currentFiles));
      return { success: false, isBlocked: true, error: 'تم حظر هذا الجهاز نهائياً من فتح هذا الملف لأسباب أمنية.' };
    }

    localStorage.setItem(PUBLIC_FILES_KEY, JSON.stringify(currentFiles));
    return { success: false, isBlocked: false, error: 'بيانات الأمان غير مطابقة، يرجى التأكد وإعادة المحاولة.' };
  }
}

// 5. My Uploads (Hybrid)
export async function getMyUploads(userId) {
  try {
    const res = await fetch(`/api/files/my-uploads?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files) && data.files.length > 0) return data.files;
    }
  } catch (e) {}

  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  const files = saved ? JSON.parse(saved) : [];
  return files.filter(f => f.uploader?.id === userId);
}

// 6. Delete Shared File
export async function deleteSharedFile(fileId, userId) {
  try {
    await fetch(`/api/files/${fileId}?userId=${userId}`, { method: 'DELETE' });
  } catch (e) {}

  const saved = localStorage.getItem(PUBLIC_FILES_KEY);
  if (saved) {
    const files = JSON.parse(saved).filter(f => f.id !== fileId);
    localStorage.setItem(PUBLIC_FILES_KEY, JSON.stringify(files));
  }
  return true;
}

// 7. Vault Files (Hybrid)
export async function getVaultFiles(userId) {
  try {
    const res = await fetch(`/api/vault?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files) && data.files.length > 0) return data.files;
    }
  } catch (e) {}

  const saved = localStorage.getItem(VAULT_FILES_KEY);
  const files = saved ? JSON.parse(saved) : [];
  return files.filter(f => f.ownerId === userId);
}

// Upload to Vault
export async function uploadToVault(files, userId) {
  const saved = localStorage.getItem(VAULT_FILES_KEY);
  const vault = saved ? JSON.parse(saved) : [];

  for (const file of files) {
    const reader = new FileReader();
    const dataPromise = new Promise(res => {
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });
    const fileData = await dataPromise;

    vault.push({
      id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      ownerId: userId,
      originalName: file.name,
      size: file.size,
      mimetype: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      isCompressed: false,
      fileData
    });
  }

  localStorage.setItem(VAULT_FILES_KEY, JSON.stringify(vault));
  return true;
}

// Rename in Vault
export async function renameVaultFile(fileId, newName, userId) {
  const saved = localStorage.getItem(VAULT_FILES_KEY);
  if (!saved) return false;
  const vault = JSON.parse(saved);
  const file = vault.find(f => f.id === fileId && f.ownerId === userId);
  if (file) {
    file.originalName = newName;
    localStorage.setItem(VAULT_FILES_KEY, JSON.stringify(vault));
    return true;
  }
  return false;
}

// Compress in Vault (Uses client JSZip)
export async function compressVaultFile(fileId, userId) {
  const saved = localStorage.getItem(VAULT_FILES_KEY);
  if (!saved) return false;
  const vault = JSON.parse(saved);
  const file = vault.find(f => f.id === fileId && f.ownerId === userId);
  if (!file) return false;

  const zip = new JSZip();
  // Extract base64
  const base64Content = file.fileData.split(',')[1] || '';
  zip.file(file.originalName, base64Content, { base64: true });

  const zipBlob = await zip.generateAsync({ type: 'base64' });
  const zipDataUrl = 'data:application/zip;base64,' + zipBlob;

  const zipName = file.originalName.replace(/\.[^/.]+$/, "") + '.zip';
  vault.push({
    id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    ownerId: userId,
    originalName: zipName,
    size: Math.round(zipBlob.length * 0.75),
    mimetype: 'application/zip',
    uploadedAt: new Date().toISOString(),
    isCompressed: true,
    fileData: zipDataUrl
  });

  localStorage.setItem(VAULT_FILES_KEY, JSON.stringify(vault));
  return true;
}

// Delete from Vault
export async function deleteVaultFile(fileId, userId) {
  const saved = localStorage.getItem(VAULT_FILES_KEY);
  if (!saved) return false;
  const vault = JSON.parse(saved).filter(f => f.id !== fileId);
  localStorage.setItem(VAULT_FILES_KEY, JSON.stringify(vault));
  return true;
}

// 8. Recipients (Hybrid)
export async function getRecipients(userId) {
  const saved = localStorage.getItem(RECIPIENTS_KEY);
  const list = saved ? JSON.parse(saved) : [];
  return list.filter(r => r.ownerId === userId);
}

export async function addRecipient(userId, recipientNumber, name) {
  const saved = localStorage.getItem(RECIPIENTS_KEY);
  const list = saved ? JSON.parse(saved) : [];

  if (list.some(r => r.ownerId === userId && r.recipientNumber === recipientNumber.trim())) {
    return { success: false, error: 'هذا الرقم مضاف بالفعل في قائمتك' };
  }

  const newRecip = {
    id: 'recip_' + Date.now(),
    ownerId: userId,
    recipientNumber: recipientNumber.trim(),
    name: name?.trim() || `مستلم (${recipientNumber.trim()})`,
    createdAt: new Date().toISOString()
  };

  list.push(newRecip);
  localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(list));
  return { success: true, recipient: newRecip };
}

export async function deleteRecipient(id, userId) {
  const saved = localStorage.getItem(RECIPIENTS_KEY);
  if (!saved) return false;
  const list = JSON.parse(saved).filter(r => r.id !== id);
  localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(list));
  return true;
}
