import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const vaultDir = path.join(__dirname, 'uploads', 'vault');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

const dbPath = path.join(dataDir, 'db.json');

// Initialize database if not exists
function getDB() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      files: [],
      vaultFiles: [],
      recipients: [],
      users: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const content = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed reading DB:', e);
    return { files: [], vaultFiles: [], recipients: [], users: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Cleanup expired files
function isFileExpired(file) {
  if (!file.expiresAt) return false;
  return new Date() > new Date(file.expiresAt);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + '-' + safeName.replace(/[^a-zA-Z0-9.\u0600-\u06FF_-]/g, '_'));
  }
});

const vaultStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vaultDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + '-' + safeName.replace(/[^a-zA-Z0-9.\u0600-\u06FF_-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1.5 * 1024 * 1024 * 1024 // 1.5 GB per file
  }
});

const uploadVault = multer({
  storage: vaultStorage,
  limits: {
    fileSize: 1.5 * 1024 * 1024 * 1024
  }
});

// Static files serving
app.use('/uploads', express.static(uploadsDir));

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

// --- API ROUTES ---

// 1. Suggest unique PIN
app.get('/api/files/suggest-pin', (req, res) => {
  const db = getDB();
  const activePins = new Set(
    db.files.filter(f => !isFileExpired(f)).map(f => f.security.pin)
  );

  let pin = '';
  let attempts = 0;
  do {
    // Generate 5-digit number
    pin = Math.floor(10000 + Math.random() * 90000).toString();
    attempts++;
  } while (activePins.has(pin) && attempts < 100);

  res.json({ suggestedPin: pin });
});

// 2. Upload shared file(s)
app.post('/api/files/upload', upload.array('files'), (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'لم يتم اختيار أي ملف' });
    }

    const {
      pin,
      account,
      name,
      expiryHours,
      recipientNumber,
      userId,
      userName,
      userEmail
    } = req.body;

    // Validate PIN (mandatory, digits only)
    if (!pin || !/^\d+$/.test(pin.trim())) {
      // Remove uploaded files
      files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(400).json({ error: 'الرقم السري إجباري ويجب أن يحتوي على أرقام فقط' });
    }

    // Validate Name (optional, letters only)
    if (name && !/^[\p{L}\s]+$/u.test(name.trim())) {
      files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(400).json({ error: 'الاسم اختياري ولكن يجب أن يحتوي على حروف فقط' });
    }

    const cleanPin = pin.trim();
    const cleanAccount = account ? account.trim() : '';
    const cleanName = name ? name.trim() : '';

    const db = getDB();

    // Check duplicate PIN or Security Credentials among active files
    const duplicate = db.files.find(f => {
      if (isFileExpired(f)) return false;
      if (f.security.pin === cleanPin) return true;
      if (cleanAccount && f.security.account && f.security.account.toLowerCase() === cleanAccount.toLowerCase()) return true;
      if (cleanName && f.security.name && f.security.name.toLowerCase() === cleanName.toLowerCase()) return true;
      return false;
    });

    if (duplicate) {
      files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(400).json({
        error: 'أحد أدوات الأمان المدخلة (الرقم السري، الحساب، أو الاسم) مستخدم بالفعل في ملف نشط آخر. يرجى اختيار رمز مختلف أو استخدام زر اقتراح رمز.'
      });
    }

    // Calculate expiry
    const hours = parseInt(expiryHours, 10);
    let expiresAt = null;
    if (hours > 0) {
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const uploadedEntries = [];
    for (const f of files) {
      const decodedOriginalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const fileEntry = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        originalName: decodedOriginalName,
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
        path: f.path,
        uploadedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        expiryHours: hours,
        recipientNumber: recipientNumber ? recipientNumber.trim() : null,
        uploader: {
          id: userId || 'anonymous',
          name: userName || 'مستخدم',
          email: userEmail || ''
        },
        security: {
          pin: cleanPin,
          account: cleanAccount,
          name: cleanName
        },
        failedAttempts: {},
        blockedClients: [],
        downloadsCount: 0
      };
      db.files.push(fileEntry);
      uploadedEntries.push(fileEntry);
    }

    saveDB(db);

    res.json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      files: uploadedEntries.map(f => ({
        id: f.id,
        name: f.originalName,
        size: f.size,
        expiresAt: f.expiresAt
      }))
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
  }
});

// 3. Get Public Files
app.get('/api/files/public', (req, res) => {
  const { currentUserId, clientId } = req.query;
  const db = getDB();

  // Active files only
  const activeFiles = db.files.filter(f => !isFileExpired(f));

  const safeList = activeFiles.map(f => {
    const isUploadedByMe = currentUserId && f.uploader.id === currentUserId;
    const clientAttempts = (clientId && f.failedAttempts[clientId]) || 0;
    const isPermanentlyBlocked = clientId && f.blockedClients.includes(clientId);

    return {
      id: f.id,
      originalName: f.originalName,
      size: f.size,
      mimetype: f.mimetype,
      uploadedAt: f.uploadedAt,
      expiresAt: f.expiresAt,
      expiryHours: f.expiryHours,
      uploaderName: f.uploader.name,
      isUploadedByMe: !!isUploadedByMe,
      recipientNumber: f.recipientNumber,
      // Security tools indicators (without revealing secrets)
      requiredTools: {
        pin: true, // PIN is always required
        account: !!f.security.account,
        name: !!f.security.name
      },
      remainingAttempts: Math.max(0, 7 - clientAttempts),
      isPermanentlyBlocked: !!isPermanentlyBlocked,
      downloadsCount: f.downloadsCount
    };
  });

  res.json({ files: safeList });
});

// 4. Unlock Public File
app.post('/api/files/unlock/:id', (req, res) => {
  const { id } = req.params;
  const { pin, account, name, clientId, currentUserId } = req.body;

  const db = getDB();
  const file = db.files.find(f => f.id === id);

  if (!file) {
    return res.status(404).json({ error: 'الملف غير موجود أو انتهت صلاحيته' });
  }

  if (isFileExpired(file)) {
    return res.status(410).json({ error: 'عذراً، انتهت صلاحية هذا الملف ولم يعد متاحاً' });
  }

  const effectiveClientId = clientId || 'unknown_client';

  // Check if permanently blocked (> 7 failed attempts)
  if (file.blockedClients && file.blockedClients.includes(effectiveClientId)) {
    return res.status(403).json({
      error: 'تم حظرك نهائياً من فتح هذا الملف لتجاوز الحد الأقصى للمحاولات (7 محاولات)',
      isBlocked: true,
      remainingAttempts: 0
    });
  }

  // Check security tools
  const pinMatch = file.security.pin === (pin || '').trim();
  const accountMatch = !file.security.account || (file.security.account.toLowerCase() === (account || '').trim().toLowerCase());
  const nameMatch = !file.security.name || (file.security.name.toLowerCase() === (name || '').trim().toLowerCase());

  if (pinMatch && accountMatch && nameMatch) {
    // Unlock success!
    file.downloadsCount = (file.downloadsCount || 0) + 1;
    // Clear failed attempts for this client
    if (file.failedAttempts) delete file.failedAttempts[effectiveClientId];
    saveDB(db);

    return res.json({
      success: true,
      message: 'تم التحقق بنجاح وتأكيد أدوات الأمان!',
      downloadUrl: `/api/files/download/${file.id}?token=${Buffer.from(file.id + ':' + file.security.pin).toString('base64')}`,
      file: {
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt
      }
    });
  } else {
    // Increment failed attempts
    file.failedAttempts = file.failedAttempts || {};
    file.blockedClients = file.blockedClients || [];

    file.failedAttempts[effectiveClientId] = (file.failedAttempts[effectiveClientId] || 0) + 1;
    const attempts = file.failedAttempts[effectiveClientId];
    const remaining = Math.max(0, 7 - attempts);

    if (attempts >= 7) {
      if (!file.blockedClients.includes(effectiveClientId)) {
        file.blockedClients.push(effectiveClientId);
      }
      saveDB(db);
      return res.status(403).json({
        error: 'تم حظرك نهائياً من فتح هذا الملف لتجاوز الحد الأقصى للمحاولات (7 محاولات)!',
        isBlocked: true,
        remainingAttempts: 0
      });
    }

    saveDB(db);
    return res.status(401).json({
      error: 'بيانات الأمان غير صحيحة، يرجى التأكد والمحاولة مرة أخرى.',
      isBlocked: false,
      remainingAttempts: remaining
    });
  }
});

// 5. Download Public File
app.get('/api/files/download/:id', (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  const db = getDB();
  const file = db.files.find(f => f.id === id);

  if (!file || !fs.existsSync(file.path)) {
    return res.status(404).send('الملف غير موجود');
  }

  // Validate token
  if (!token) {
    return res.status(403).send('غير مصرح بتحميل الملف بدون إذن');
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8');
  if (decoded !== `${file.id}:${file.security.pin}`) {
    return res.status(403).send('رمز التحقق غير صالح');
  }

  res.download(file.path, file.originalName);
});

// 6. User's Uploaded Files (البار الرابع)
app.get('/api/files/my-uploads', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ files: [] });

  const db = getDB();
  const myFiles = db.files.filter(f => f.uploader.id === userId);

  const formatted = myFiles.map(f => ({
    id: f.id,
    originalName: f.originalName,
    size: f.size,
    mimetype: f.mimetype,
    uploadedAt: f.uploadedAt,
    expiresAt: f.expiresAt,
    expiryHours: f.expiryHours,
    isExpired: isFileExpired(f),
    recipientNumber: f.recipientNumber,
    security: {
      pin: f.security.pin,
      account: f.security.account,
      name: f.security.name
    },
    downloadsCount: f.downloadsCount || 0,
    blockedClientsCount: (f.blockedClients || []).length
  }));

  res.json({ files: formatted });
});

// Delete a shared file
app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  const db = getDB();
  const index = db.files.findIndex(f => f.id === id);
  if (index === -1) return res.status(404).json({ error: 'الملف غير موجود' });

  const file = db.files[index];
  if (file.uploader.id !== userId) {
    return res.status(403).json({ error: 'ليس لديك صلاحية لحذف هذا الملف' });
  }

  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  db.files.splice(index, 1);
  saveDB(db);

  res.json({ success: true, message: 'تم حذف الملف بنجاح' });
});

// --- VAULT (المستودع - البار الثالث) ---

// 7. Get Vault Files
app.get('/api/vault', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ files: [] });

  const db = getDB();
  const userVault = db.vaultFiles.filter(f => f.ownerId === userId);
  res.json({ files: userVault });
});

// Upload to Vault
app.post('/api/vault/upload', uploadVault.array('files'), (req, res) => {
  try {
    const files = req.files;
    const { userId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'لم يتم اختيار أي ملف' });
    }

    const db = getDB();
    const created = [];

    for (const f of files) {
      const decodedOriginalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const entry = {
        id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        ownerId: userId || 'anonymous',
        originalName: decodedOriginalName,
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
        path: f.path,
        uploadedAt: new Date().toISOString(),
        isCompressed: false
      };
      db.vaultFiles.push(entry);
      created.push(entry);
    }

    saveDB(db);
    res.json({ success: true, files: created });
  } catch (err) {
    console.error('Vault upload error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف للمستودع' });
  }
});

// Rename in Vault (التسمية)
app.put('/api/vault/rename/:id', (req, res) => {
  const { id } = req.params;
  const { newName, userId } = req.body;

  if (!newName || !newName.trim()) {
    return res.status(400).json({ error: 'الاسم الجديد مطلوب' });
  }

  const db = getDB();
  const file = db.vaultFiles.find(f => f.id === id);

  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
  if (file.ownerId !== userId) return res.status(403).json({ error: 'غير مصرح' });

  // Retain original extension if not provided
  let finalName = newName.trim();
  const origExt = path.extname(file.originalName);
  if (origExt && !finalName.endsWith(origExt)) {
    finalName += origExt;
  }

  file.originalName = finalName;
  saveDB(db);

  res.json({ success: true, file });
});

// Compress in Vault (الضغط)
app.post('/api/vault/compress/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const db = getDB();
    const file = db.vaultFiles.find(f => f.id === id);

    if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
    if (file.ownerId !== userId) return res.status(403).json({ error: 'غير مصرح' });
    if (!fs.existsSync(file.path)) return res.status(404).json({ error: 'الملف الفعلي غير موجود على القرص' });

    // Read file and create zip
    const fileContent = fs.readFileSync(file.path);
    const zip = new JSZip();
    zip.file(file.originalName, fileContent);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    const zipFilename = Date.now() + '-' + path.parse(file.originalName).name + '.zip';
    const zipPath = path.join(vaultDir, zipFilename);
    fs.writeFileSync(zipPath, zipBuffer);

    const zipEntry = {
      id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      ownerId: userId,
      originalName: path.parse(file.originalName).name + '.zip',
      filename: zipFilename,
      size: zipBuffer.length,
      mimetype: 'application/zip',
      path: zipPath,
      uploadedAt: new Date().toISOString(),
      isCompressed: true
    };

    db.vaultFiles.push(zipEntry);
    saveDB(db);

    res.json({ success: true, message: 'تم ضغط الملف بنجاح إلى ملف ZIP', file: zipEntry });
  } catch (err) {
    console.error('Compress error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء ضغط الملف' });
  }
});

// Delete from Vault (الحذف)
app.delete('/api/vault/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  const db = getDB();
  const index = db.vaultFiles.findIndex(f => f.id === id);

  if (index === -1) return res.status(404).json({ error: 'الملف غير موجود' });
  const file = db.vaultFiles[index];
  if (file.ownerId !== userId) return res.status(403).json({ error: 'غير مصرح' });

  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  db.vaultFiles.splice(index, 1);
  saveDB(db);

  res.json({ success: true, message: 'تم حذف الملف من المستودع بنجاح' });
});

// Download from Vault
app.get('/api/vault/download/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  const db = getDB();
  const file = db.vaultFiles.find(f => f.id === id);

  if (!file || !fs.existsSync(file.path)) {
    return res.status(404).send('الملف غير موجود');
  }

  if (file.ownerId !== userId) {
    return res.status(403).send('غير مصرح بالتحميل');
  }

  res.download(file.path, file.originalName);
});

// --- FEATURED RECIPIENTS (المستلمون المميزون - البار الخامس) ---

// 8. Get Featured Recipients
app.get('/api/recipients', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ recipients: [] });

  const db = getDB();
  const userRecipients = db.recipients.filter(r => r.ownerId === userId);
  res.json({ recipients: userRecipients });
});

// Add Featured Recipient
app.post('/api/recipients', (req, res) => {
  const { userId, recipientNumber, name } = req.body;

  if (!recipientNumber || !recipientNumber.trim()) {
    return res.status(400).json({ error: 'رقم المستلم مطلوب' });
  }

  const cleanNumber = recipientNumber.trim();
  const db = getDB();

  // Check if already added
  const existing = db.recipients.find(r => r.ownerId === userId && r.recipientNumber === cleanNumber);
  if (existing) {
    return res.status(400).json({ error: 'هذا الرقم مضاف بالفعل في قائمة المستلمين المميزين لديك' });
  }

  const newRecipient = {
    id: 'recip_' + Date.now(),
    ownerId: userId || 'anonymous',
    recipientNumber: cleanNumber,
    name: name ? name.trim() : `مستلم (${cleanNumber})`,
    createdAt: new Date().toISOString()
  };

  db.recipients.push(newRecipient);
  saveDB(db);

  res.json({ success: true, recipient: newRecipient });
});

// Delete Featured Recipient
app.delete('/api/recipients/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  const db = getDB();
  const index = db.recipients.findIndex(r => r.id === id);

  if (index === -1) return res.status(404).json({ error: 'المستلم غير موجود' });
  if (db.recipients[index].ownerId !== userId) return res.status(403).json({ error: 'غير مصرح' });

  db.recipients.splice(index, 1);
  saveDB(db);

  res.json({ success: true, message: 'تم إزالة المستلم المميز' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
