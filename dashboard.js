/**
 * TO-TYPE — dashboard.js  (ES Module)
 * Logic dashboard: level state, progress, tips, auth guard, Supabase integration.
 *
 * Strategi:
 * 1. Cek sesi login → jika tidak ada, redirect ke index.html
 * 2. Muat profil siswa dari sessionStorage / Supabase
 * 3. Ambil progres dari Supabase (atau fallback data demo)
 * 4. Render level cards berdasarkan state: locked | active | completed
 * 5. Tombol aksi mengarah ke halaman latihan (typing.html?level=N)
 * 6. Tombol Keluar memanggil handleLogout()
 */

import { handleLogout, DEMO_MODE } from './auth.js';
import {
  getSession,
  getMyProfile,
  getMyProgress,
  upsertProgress,
  isSupabaseConfigured,
} from './supabase.js';

'use strict';

/* ══════════════════════════════════════════════════════════════
   DATA: Level Definitions
   ══════════════════════════════════════════════════════════════ */
const LEVEL_DEFS = [
  {
    id: 1,
    name: 'Level 1: Baris Tengah',
    emoji: '⌨️',
    description: 'Huruf dasar: A · S · D · F · J · K · L · ;',
    content: 'asdf jkl; asdf jkl; fdsa ;lkj',
    req: 'Akurasi ≥ 90%',
    minAccuracy: 90,
    minWpm: 0,
  },
  {
    id: 2,
    name: 'Level 2: Baris Atas & Bawah',
    emoji: '🔡',
    description: 'Semua alfabet: Q W E R T Y U I O P & Z X C V B N M',
    content: 'qwerty uiop zxcvbnm',
    req: 'Akurasi ≥ 90%',
    minAccuracy: 90,
    minWpm: 0,
  },
  {
    id: 3,
    name: 'Level 3: Kata',
    emoji: '📝',
    description: 'Kosakata bengkel otomotif: oli, rem, kopling, piston, klep',
    content: 'oli rem kopling piston klep mesin bensin solar',
    req: 'Akurasi ≥ 90%, Min. 10 KPM • Selesaikan Level 2 untuk membuka',
    minAccuracy: 90,
    minWpm: 10,
    requires: 2,
  },
  {
    id: 4,
    name: 'Level 4: Kalimat',
    emoji: '📄',
    description: 'Langkah servis singkat: cek oli mesin, setel rantai roda, bersihkan filter udara',
    content: 'Ganti oli mesin setiap 3000 km untuk menjaga performa kendaraan.',
    req: 'Akurasi ≥ 90%, Min. 12 KPM • Selesaikan Level 3 untuk membuka',
    minAccuracy: 90,
    minWpm: 12,
    requires: 3,
  },
  {
    id: 5,
    name: 'Level 5: Paragraf',
    emoji: '📋',
    description: 'Prosedur K3 bengkel, diagnosis kerusakan & standar penulisan estimasi biaya perbaikan',
    content: 'Sebelum memulai servis, gunakan alat pelindung diri dan pastikan area kerja bersih.',
    req: 'Akurasi ≥ 92%, Target 10 Kata Per Menit (KPM) • Selesaikan Level 4 untuk membuka',
    minAccuracy: 92,
    minWpm: 15,
    requires: 4,
  },
];

/* ══════════════════════════════════════════════════════════════
   DATA: Tips
   ══════════════════════════════════════════════════════════════ */
const TIPS = [
  'Jangan terburu-buru. Utamakan ketepatan jari pada tuts daripada kecepatan. Kecepatan akan datang sendiri.',
  'Latih posisi jari home row (ASDF JKL;) hingga terasa natural sebelum berpindah ke baris lain.',
  'Jangan lihat keyboard. Latih otot memori jarimu dengan fokus pada layar.',
  'Istirahatkan tangan setiap 20–30 menit untuk mencegah kelelahan sendi.',
  'Pundak rileks, pergelangan tangan sedikit terangkat — jangan tumpukan di meja.',
  'Setiap jari bertanggung jawab atas tombol tertentu. Konsistensi adalah kunci.',
];

/* ══════════════════════════════════════════════════════════════
   DEMO DATA (dipakai jika Supabase belum dikonfigurasi)
   ══════════════════════════════════════════════════════════════ */
const DEMO_PROGRESS = [
  { level: 1, status: 'completed', best_wpm: 22, best_accuracy: 94 },
  { level: 2, status: 'active',    best_wpm: 10, best_accuracy: 85 },
];

/* ══════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════ */
let siswaData    = null;  // { nama, kelas, absen, email }
let progressData = [];    // array dari Supabase atau demo

/* ══════════════════════════════════════════════════════════════
   DOM
   ══════════════════════════════════════════════════════════════ */
const elUserNama   = document.getElementById('user-nama');
const elUserKelas  = document.getElementById('user-kelas');
const elUserAvatar = document.getElementById('user-avatar');
const elLevelsList = document.getElementById('levels-list');
const elSkeleton   = document.getElementById('levels-skeleton');
const elProgressBar  = document.getElementById('progress-bar-fill');
const elProgressWrap = document.getElementById('progress-bar-wrapper');
const elProgressLabel = document.getElementById('progress-label');
const elDemoBanner   = document.getElementById('demo-banner');
const elTipsText     = document.getElementById('tips-text');
const elSaveStatus   = document.getElementById('save-status');
const elSaveStatusIcon = document.getElementById('save-status-icon');
const elSaveStatusText = document.querySelector('#save-status span:last-child');
const toast          = document.getElementById('toast');
const toastMsg       = document.getElementById('toast-msg');

/* ══════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message, type = 'info', duration = 3500) {
  if (toastTimer) clearTimeout(toastTimer);
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️', warning: '🔔' };
  document.querySelector('.toast__icon').textContent = icons[type] ?? 'ℹ️';
  toastMsg.textContent = message;
  toast.className = `toast toast--${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ══════════════════════════════════════════════════════════════
   SAVE STATUS INDICATOR
   ══════════════════════════════════════════════════════════════ */
let saveTimer = null;
function showSaveStatus(state, message) {
  if (saveTimer) clearTimeout(saveTimer);
  const icons = { saving: '💾', saved: '✅', error: '❌' };
  elSaveStatus.hidden = false;
  elSaveStatus.className = `save-status save-status--${state}`;
  document.getElementById('save-status-icon').textContent = icons[state] ?? '💾';
  document.getElementById('save-status-text').textContent = message;
  if (state !== 'saving') {
    saveTimer = setTimeout(() => { elSaveStatus.hidden = true; }, 3000);
  }
}

/* ══════════════════════════════════════════════════════════════
   AUTH GUARD  — redirect jika tidak ada sesi
   ══════════════════════════════════════════════════════════════ */
async function guardAuth() {
  if (DEMO_MODE) {
    // Cek sessionStorage
    const saved = sessionStorage.getItem('totype_siswa');
    if (!saved) {
      window.location.replace('index.html');
      return false;
    }
    siswaData = JSON.parse(saved);
    return true;
  }

  const { session, user } = await getSession();
  if (!session || !user) {
    window.location.replace('index.html');
    return false;
  }

  // Ambil profil dari sessionStorage dulu (cepat), lalu sinkron Supabase
  const cached = sessionStorage.getItem('totype_siswa');
  if (cached) {
    siswaData = JSON.parse(cached);
  } else {
    const { data: profile } = await getMyProfile();
    if (profile) {
      siswaData = { nama: profile.nama, kelas: profile.kelas, absen: profile.absen, email: user.email };
      sessionStorage.setItem('totype_siswa', JSON.stringify(siswaData));
    } else {
      const meta = user.user_metadata ?? {};
      siswaData = { nama: meta.nama ?? 'Siswa', kelas: meta.kelas ?? '-', absen: meta.absen ?? 0, email: user.email };
    }
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════
   RENDER USER INFO
   ══════════════════════════════════════════════════════════════ */
function renderUserInfo() {
  if (!siswaData) return;
  elUserNama.textContent   = siswaData.nama ?? 'Siswa';
  elUserKelas.textContent  = siswaData.kelas ?? '—';
  elUserAvatar.textContent = (siswaData.nama ?? 'S')[0].toUpperCase();
}

/* ══════════════════════════════════════════════════════════════
   LOAD PROGRESS
   ══════════════════════════════════════════════════════════════ */
async function loadProgress() {
  if (DEMO_MODE) {
    progressData = DEMO_PROGRESS;
    return;
  }

  const { data, error } = await getMyProgress();
  if (error) {
    showToast(`Gagal memuat progres: ${error}`, 'error', 5000);
    progressData = [];
  } else {
    progressData = data ?? [];
  }
}

/* ══════════════════════════════════════════════════════════════
   COMPUTE LEVEL STATES
   ══════════════════════════════════════════════════════════════ */
function computeLevelStates() {
  return LEVEL_DEFS.map(def => {
    const prog = progressData.find(p => p.level === def.id);

    // Completed?
    if (prog?.status === 'completed') {
      return { ...def, state: 'completed', best_wpm: prog.best_wpm, best_accuracy: prog.best_accuracy };
    }

    // Check unlock requirement
    if (def.requires) {
      const prereq = progressData.find(p => p.level === def.requires && p.status === 'completed');
      if (!prereq) {
        return { ...def, state: 'locked' };
      }
    }

    // Active (no prerequisite issue)
    return {
      ...def,
      state: 'active',
      best_wpm: prog?.best_wpm ?? 0,
      best_accuracy: prog?.best_accuracy ?? 0,
      inProgress: !!prog,
    };
  });
}

/* ══════════════════════════════════════════════════════════════
   RENDER LEVEL CARDS
   ══════════════════════════════════════════════════════════════ */
function renderLevels(levels) {
  // Remove skeleton
  elSkeleton?.remove();
  elLevelsList.innerHTML = '';

  const completedCount = levels.filter(l => l.state === 'completed').length;
  const pct = Math.round((completedCount / LEVEL_DEFS.length) * 100);

  // Update progress bar
  elProgressBar.style.width = `${pct}%`;
  elProgressWrap.setAttribute('aria-valuenow', pct);
  elProgressLabel.textContent = `${completedCount} dari ${LEVEL_DEFS.length} Level (${pct}%)`;

  levels.forEach((level, idx) => {
    const card = buildLevelCard(level, idx);
    elLevelsList.appendChild(card);
  });
}

function buildLevelCard(level, idx) {
  const li = document.createElement('div');
  li.className = 'level-card';
  li.setAttribute('data-status', level.state);
  li.setAttribute('data-level', level.id);
  li.setAttribute('role', 'listitem');
  li.style.animationDelay = `${idx * 0.07}s`;

  // Icon
  const iconClass = {
    active:    'level-card__icon--active',
    completed: 'level-card__icon--completed',
    locked:    'level-card__icon--locked',
  }[level.state];

  const iconEmoji = {
    active:    level.emoji,
    completed: '✅',
    locked:    '🔒',
  }[level.state];

  // Badge HTML
  let badgeHtml = '';
  if (level.state === 'active' && level.inProgress) {
    badgeHtml = `<span class="level-badge level-badge--active">● Level Aktif Saat Ini</span>`;
  } else if (level.state === 'active' && !level.inProgress) {
    badgeHtml = `<span class="level-badge level-badge--active">▶ Siap Dimulai</span>`;
  } else if (level.state === 'completed') {
    badgeHtml = `<span class="level-badge level-badge--completed">✓ Selesai</span>`;
    if (level.best_accuracy > 0) {
      badgeHtml += ` <span class="level-badge level-badge--best">Akurasi ${level.best_accuracy}%</span>`;
    }
  }

  // Action HTML
  let actionHtml = '';
  if (level.state === 'active') {
    const btnLabel = level.inProgress ? 'Lanjutkan Latihan' : 'Mulai Latihan';
    const btnIcon  = level.inProgress ? '▶' : '+';
    actionHtml = `
      <button class="btn-start" data-action="start" data-level="${level.id}" aria-label="${btnLabel} ${level.name}">
        ${btnLabel} <span aria-hidden="true">${btnIcon}</span>
      </button>`;
  } else if (level.state === 'completed') {
    actionHtml = `
      <button class="btn-start btn-start--outline" data-action="retry" data-level="${level.id}" aria-label="Latihan Ulang ${level.name}">
        ↺ Latihan Ulang
      </button>`;
  } else {
    actionHtml = `
      <span class="locked-label" aria-label="Level terkunci">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
          <rect x="3" y="7" width="10" height="8" rx="2" stroke="currentColor" stroke-width="1.4"/>
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Terkunci
      </span>`;
  }

  // Best stats for completed
  const bestHtml = (level.state === 'completed' && level.best_wpm > 0)
    ? `<span style="font-size:11px;color:#4a5168;margin-right:8px">${level.best_wpm} KPM</span>`
    : '';

  li.innerHTML = `
    <div class="level-card__icon ${iconClass}" aria-hidden="true">${iconEmoji}</div>
    <div class="level-card__body">
      <div class="level-card__top">
        <span class="level-card__name">${level.name}</span>
        ${badgeHtml}
      </div>
      <div class="level-card__content">${level.description}</div>
      <div class="level-card__req">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Syarat lulus: ${level.req}
      </div>
    </div>
    <div class="level-card__action">
      ${bestHtml}
      ${actionHtml}
    </div>
  `;

  // Event listeners
  const btnStart = li.querySelector('[data-action]');
  if (btnStart) {
    btnStart.addEventListener('click', () => onLevelAction(level, btnStart.dataset.action));
  }

  return li;
}

/* ══════════════════════════════════════════════════════════════
   LEVEL ACTION HANDLER
   ══════════════════════════════════════════════════════════════ */
async function onLevelAction(level, action) {
  if (level.state === 'locked') return;

  // Tandai level sebagai active di Supabase (jika belum)
  if (action === 'start' && !level.inProgress) {
    showSaveStatus('saving', 'Menyimpan progres...');

    if (!DEMO_MODE) {
      const { error } = await upsertProgress(level.id, { status: 'active' });
      if (error) {
        showSaveStatus('error', `Gagal menyimpan: ${error}`);
        showToast(`Progres tidak tersimpan: ${error}`, 'error', 4000);
      } else {
        showSaveStatus('saved', 'Progres tersimpan!');
      }
    } else {
      // Demo: simpan ke memory
      const existing = progressData.find(p => p.level === level.id);
      if (!existing) {
        progressData.push({ level: level.id, status: 'active', best_wpm: 0, best_accuracy: 0 });
      }
      showSaveStatus('saved', '[Demo] Progres disimpan sementara');
    }
  }

  // Navigate ke halaman latihan
  // typing.html belum dibuat — arahkan ke placeholder dengan parameter level
  window.location.href = `typing.html?level=${level.id}`;
}

/* ══════════════════════════════════════════════════════════════
   TIPS ROTATOR
   ══════════════════════════════════════════════════════════════ */
function startTipsRotation() {
  let i = 0;
  elTipsText.textContent = TIPS[0];

  setInterval(() => {
    // Fade out
    elTipsText.style.opacity = '0';
    elTipsText.style.transform = 'translateY(4px)';
    setTimeout(() => {
      i = (i + 1) % TIPS.length;
      elTipsText.textContent = TIPS[i];
      elTipsText.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      elTipsText.style.opacity = '1';
      elTipsText.style.transform = 'translateY(0)';
    }, 300);
  }, 8000);
}

/* ══════════════════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════════════════ */
function attachLogout() {
  const btn  = document.getElementById('btn-logout');
  const btnM = document.getElementById('btn-logout-mobile');

  const doLogout = async () => {
    btn && (btn.textContent = 'Keluar...');
    await handleLogout(); // redirect dilakukan di dalam handleLogout
  };

  btn?.addEventListener('click', doLogout);
  btnM?.addEventListener('click', doLogout);
}

/* ══════════════════════════════════════════════════════════════
   HAMBURGER MENU
   ══════════════════════════════════════════════════════════════ */
function attachHamburger() {
  const btnH = document.getElementById('btn-hamburger');
  const menu = document.getElementById('mobile-menu');
  if (!btnH || !menu) return;

  btnH.addEventListener('click', () => {
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    btnH.setAttribute('aria-expanded', String(!isOpen));
  });
}

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */
async function init() {
  // 1. Auth guard
  const ok = await guardAuth();
  if (!ok) return;

  // 2. Render user info
  renderUserInfo();

  // 3. Show demo banner if needed
  if (DEMO_MODE) {
    elDemoBanner.hidden = false;
  }

  // 4. Load progress
  await loadProgress();

  // 5. Compute and render levels
  const levels = computeLevelStates();
  renderLevels(levels);

  // 6. Tips rotation
  startTipsRotation();

  // 7. Attach logout and hamburger
  attachLogout();
  attachHamburger();

  // 8. Test connection status
  if (isSupabaseConfigured()) {
    const { testConnection } = await import('./supabase.js');
    const { ok: connected, latencyMs, error } = await testConnection();
    if (!connected) {
      showToast(`Koneksi Supabase bermasalah: ${error}`, 'warning', 6000);
    } else {
      console.info(`[TO-TYPE] ✅ Supabase terhubung (${latencyMs}ms)`);
    }
  }
}

init();
