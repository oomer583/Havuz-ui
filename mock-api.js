/**
 * havuz mock-api.js
 * Önizleme ve test amaçlı sahte API uygulaması.
 * Gerçek havuz-api.js ile birebir aynı imzaya ve veri yapısına sahiptir.
 */

const STORAGE_KEY = 'havuz_mock_db_v1';

// Varsayılan başlangıç verisi
function getDefaultData() {
  const account1 = {
    email: 'ali.yilmaz@gmail.com',
    main: true,
    reachable: true,
    used: 4.8 * 1024 * 1024 * 1024,
    limit: 15 * 1024 * 1024 * 1024
  };
  const account2 = {
    email: 'ali.yedek1@gmail.com',
    main: false,
    reachable: true,
    used: 3.2 * 1024 * 1024 * 1024,
    limit: 15 * 1024 * 1024 * 1024
  };
  const account3 = {
    email: 'ali.depo2@gmail.com',
    main: false,
    reachable: true,
    used: 2.5 * 1024 * 1024 * 1024,
    limit: 15 * 1024 * 1024 * 1024
  };
  const account4 = {
    email: 'ali.arsiv3@gmail.com',
    main: false,
    reachable: true,
    used: 1.4 * 1024 * 1024 * 1024,
    limit: 15 * 1024 * 1024 * 1024
  };

  const files = [
    {
      name: 'tatil-2026.mp4',
      size: 1.84 * 1024 * 1024 * 1024,
      created: Date.now() - 86400000 * 2
    },
    {
      name: 'ödev-fizik.pdf',
      size: 4.2 * 1024 * 1024,
      created: Date.now() - 86400000 * 5
    },
    {
      name: 'proje.zip',
      size: 348 * 1024 * 1024,
      created: Date.now() - 86400000 * 8
    },
    {
      name: 'doğum-günü.jpg',
      size: 8.6 * 1024 * 1024,
      created: Date.now() - 86400000 * 12
    }
  ];

  return {
    email: 'ali.yilmaz@gmail.com',
    isCreated: true,
    isUnlocked: true,
    password: 'ornek-guclu-sifre123',
    recoveryKey: 'K7QM-2XPA-9LWV-4TH8-V3NC',
    accounts: [account1, account2, account3, account4],
    files: files
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('localStorage okunamadı, varsayılan veri kullanılıyor:', e);
  }
  const def = getDefaultData();
  saveData(def);
  return def;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage yazılamadı:', e);
  }
}

let db = loadData();
const listeners = new Set();
let busy = false;

function notify() {
  saveData(db);
  const st = havuz.status();
  for (const cb of listeners) {
    try {
      cb(st);
    } catch (err) {
      console.error('havuz listener hatası:', err);
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function human(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = Math.abs(Number(bytes));
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  const formatted = i === 0 ? Math.round(val) : val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : val.toFixed(1);
  return `${formatted} ${units[i]}`;
}

export const havuz = {
  /**
   * Google girişini açar ve { email, step } döner.
   * step değeri 'create' ya da 'unlock' olur.
   */
  async signIn() {
    await delay(350);
    // Havuz daha önce oluşturulmuşsa 'unlock' ekranına git
    const step = db.isCreated ? 'unlock' : 'create';
    return {
      email: db.email,
      step
    };
  },

  /**
   * Yeni havuz oluşturur ve kurtarma anahtarını döner.
   */
  async createPool(password) {
    if (!password || password.length < 10) {
      const err = new Error('Şifre en az 10 karakter uzunluğunda olmalıdır.');
      err.code = 'weak_password';
      throw err;
    }

    await delay(400);

    // Rastgele 5'erli kurtarma anahtarı üret
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const key = `K7QM-${segment()}-${segment()}-${segment()}-${segment()}`;

    db.isCreated = true;
    db.isUnlocked = true;
    db.password = password;
    db.recoveryKey = key;
    
    // Eğer hesap yoksa ana hesabı ekle
    if (!db.accounts || db.accounts.length === 0) {
      db.accounts = [{
        email: db.email,
        main: true,
        reachable: true,
        used: 0,
        limit: 15 * 1024 * 1024 * 1024
      }];
    }

    notify();
    return key;
  },

  /**
   * Havuzu şifre ile açar.
   */
  async unlock(password) {
    await delay(300);
    if (password !== db.password) {
      const err = new Error('Girdiğin şifre hatalı. Lütfen kontrol edip tekrar dene.');
      err.code = 'wrong_password';
      throw err;
    }

    db.isUnlocked = true;
    notify();
    return true;
  },

  /**
   * Şifresini unutan kullanıcı için kurtarma işlemi.
   */
  async recover(recoveryKey, newPassword) {
    await delay(400);
    const cleanedInput = (recoveryKey || '').replace(/[\s-]/g, '').toUpperCase();
    const cleanedTarget = (db.recoveryKey || '').replace(/[\s-]/g, '').toUpperCase();

    if (!cleanedInput || cleanedInput !== cleanedTarget) {
      const err = new Error('Kurtarma anahtarı eşleşmedi. Lütfen anahtarı eksiksiz gir.');
      err.code = 'wrong_recovery';
      throw err;
    }

    if (!newPassword || newPassword.length < 10) {
      const err = new Error('Yeni şifre en az 10 karakter uzunluğunda olmalıdır.');
      err.code = 'weak_password';
      throw err;
    }

    db.password = newPassword;
    db.isUnlocked = true;
    notify();
    return true;
  },

  /**
   * Yeni Google hesabı bağlar.
   * onCode({ code, url }) çağrılır, abortController signal ile iptal edilebilir.
   */
  async addAccount({ onCode, signal }) {
    if (signal?.aborted) {
      const err = new Error('İşlem iptal edildi.');
      err.code = 'cancelled';
      throw err;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, (_, i) => (i === 4 ? '-' : chars[Math.floor(Math.random() * chars.length)])).join('');
    const url = 'https://google.com/device';

    if (typeof onCode === 'function') {
      onCode({ code, url });
    }

    // 4 saniye sonra simüle edilmiş onay
    return new Promise((resolve, reject) => {
      let timer = null;
      const onAbort = () => {
        clearTimeout(timer);
        const err = new Error('Hesap bağlama iptal edildi.');
        err.code = 'cancelled';
        reject(err);
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      timer = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        const nextIndex = (db.accounts?.length || 0) + 1;
        const newEmail = `ali.ekhesap${nextIndex}@gmail.com`;

        const newAcc = {
          email: newEmail,
          main: false,
          reachable: true,
          used: 0,
          limit: 15 * 1024 * 1024 * 1024
        };

        if (!db.accounts) db.accounts = [];
        db.accounts.push(newAcc);
        notify();
        resolve(newEmail);
      }, 3500);
    });
  },

  /**
   * Ekranın ihtiyaç duyduğu durum verisi.
   */
  status() {
    const accounts = db.accounts || [];
    const files = db.files || [];

    const accountsCount = accounts.length;
    let protection = 'no_accounts';
    if (accountsCount === 1) {
      protection = 'none';
    } else if (accountsCount === 2) {
      protection = 'copy';
    } else if (accountsCount >= 3) {
      protection = 'parity';
    }

    // Gerçek toplam kapasite hesaplama:
    // Eğer 1 hesap varsa: 15 GB
    // Eğer 2 hesap varsa (kopya koruması): toplam depolama alanı yarı yarıya kullanılır -> 15 GB efektif
    // Eğer 3+ hesap varsa (parite koruması): 1 hesap pariteye ayrılır -> (N - 1) * 15 GB efektif
    let rawTotalLimit = 0;
    let rawTotalUsed = 0;
    for (const acc of accounts) {
      rawTotalLimit += (acc.limit || 15 * 1024 * 1024 * 1024);
      rawTotalUsed += (acc.used || 0);
    }

    let filesBytes = 0;
    for (const f of files) {
      filesBytes += (f.size || 0);
    }

    // Toplam havuz limiti ve kullanılan miktar
    let effectiveLimit = rawTotalLimit;
    if (protection === 'copy' && accountsCount >= 2) {
      effectiveLimit = rawTotalLimit / 2;
    } else if (protection === 'parity' && accountsCount >= 3) {
      effectiveLimit = ((accountsCount - 1) / accountsCount) * rawTotalLimit;
    }

    // Kullanıcıya gösterilen doluluk (orijinal istekte: "11.9 GB / 32.2 GB", %37)
    // Hesapların toplam used değeri veya filesBytes üzerinden orantı
    const used = Math.min(rawTotalUsed, effectiveLimit);
    const limit = effectiveLimit > 0 ? effectiveLimit : 15 * 1024 * 1024 * 1024;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const canStillStore = Math.max(0, limit - used);

    return {
      email: db.email,
      accounts: accounts.map(a => ({ ...a })),
      used,
      limit,
      percent,
      files: files.map(f => ({ ...f })),
      filesBytes,
      canStillStore,
      protection,
      busy,
      isUnlocked: Boolean(db.isUnlocked),
      isCreated: Boolean(db.isCreated)
    };
  },

  /**
   * Dosya yükler ve ilerlemeyi yüzde olarak bildirir (0 - 100).
   */
  async upload(file, onProgress) {
    if (!file) throw new Error('Yüklenecek dosya seçilmedi.');

    const currentStatus = this.status();
    if (file.size > currentStatus.canStillStore) {
      const err = new Error('Havuzda bu dosya için yeterli depolama alanı kalmadı.');
      err.code = 'no_space';
      throw err;
    }

    const alreadyExists = (db.files || []).some(f => f.name.toLowerCase() === file.name.toLowerCase());
    if (alreadyExists) {
      const err = new Error(`"${file.name}" adında bir dosya zaten havuzda mevcut.`);
      err.code = 'exists';
      throw err;
    }

    busy = true;
    notify();

    // 10 adımdan oluşan gerçekçi bir yükleme simülasyonu
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await delay(120);
      const progress = Math.round((i / steps) * 100);
      if (typeof onProgress === 'function') {
        onProgress(progress);
      }
    }

    if (!db.files) db.files = [];
    const newFile = {
      name: file.name,
      size: file.size,
      created: Date.now()
    };
    db.files.unshift(newFile);

    // Hesaplara dosya paylaştırma simülasyonu
    if (db.accounts && db.accounts.length > 0) {
      const perAcc = Math.ceil(file.size / db.accounts.length);
      db.accounts.forEach(acc => {
        acc.used = Math.min(acc.limit, (acc.used || 0) + perAcc);
      });
    }

    busy = false;
    notify();
    return newFile;
  },

  /**
   * Dosyayı indirir.
   */
  async download(name) {
    await delay(300);
    const file = (db.files || []).find(f => f.name === name);
    if (!file) {
      const err = new Error('İstenen dosya bulunamadı.');
      err.code = 'not_found';
      throw err;
    }

    const blob = new Blob([`havuz şifrelenmiş veri bloğu: ${file.name}`], { type: 'application/octet-stream' });
    const rebuilt = name.includes('proje') || name.includes('tatil');

    return {
      blob,
      name: file.name,
      rebuilt
    };
  },

  /**
   * Dosyayı siler.
   */
  async remove(name) {
    await delay(250);
    const index = (db.files || []).findIndex(f => f.name === name);
    if (index === -1) {
      const err = new Error('Silinecek dosya bulunamadı.');
      err.code = 'not_found';
      throw err;
    }

    const removed = db.files.splice(index, 1)[0];

    // Hesapların kullanılan alanını düşür
    if (db.accounts && db.accounts.length > 0) {
      const perAcc = Math.ceil((removed.size || 0) / db.accounts.length);
      db.accounts.forEach(acc => {
        acc.used = Math.max(0, (acc.used || 0) - perAcc);
      });
    }

    notify();
    return true;
  },

  /**
   * Değişiklik dinleyicisi ekler.
   */
  onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /**
   * Önizlemede oturumu kilitleme veya ekranları test etmek için yardımcı fonksiyonlar
   */
  lock() {
    db.isUnlocked = false;
    notify();
  },

  resetDemo() {
    db = getDefaultData();
    saveData(db);
    notify();
  },

  setProtectionDemo(count) {
    if (count === 1) {
      db.accounts = [db.accounts[0]];
    } else if (count === 2) {
      db.accounts = [db.accounts[0], db.accounts[1]];
    } else {
      const def = getDefaultData();
      db.accounts = def.accounts;
    }
    notify();
  }
};
