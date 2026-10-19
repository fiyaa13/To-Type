/**
 * TO-TYPE — script.js  (ES Module)
 * Halaman index.html: validasi form + integrasi Supabase Auth
 */

import { checkExistingSession, handleRegister, handleLogin, DEMO_MODE } from './auth.js';

'use strict';

/* ── Mode indicator ─────────────────────────────────────────── */
if (DEMO_MODE) {
  const badge = document.querySelector('.badge');
  if (badge) {
    badge.style.background = 'rgba(245,158,11,0.15)';
    badge.style.borderColor = 'rgba(245,158,11,0.4)';
    badge.style.color = '#fbbf24';
    badge.innerHTML = badge.innerHTML + ' <span style="font-size:10px">[MODE DEMO]</span>';
  }
}

/* ── Cek sesi aktif → redirect ke dashboard jika sudah login ── */
checkExistingSession();

/* ── DOM References ─────────────────────────────────────────── */
const form         = document.getElementById('form-mulai');
const btnMulai     = document.getElementById('btn-mulai');
const toast        = document.getElementById('toast');
const toastMsg     = document.getElementById('toast-msg');

// Tab switcher
const tabMasuk     = document.getElementById('tab-masuk');
const tabDaftar    = document.getElementById('tab-daftar');
const panelDaftar  = document.getElementById('panel-daftar');
const panelMasuk   = document.getElementById('panel-masuk');

// Daftar fields
const fieldNama    = document.getElementById('input-nama');
const fieldAbsen   = document.getElementById('input-absen');
const fieldKelas   = document.getElementById('input-kelas');
const groupNama    = document.getElementById('group-nama');
const groupAbsen   = document.getElementById('group-absen');
const groupKelas   = document.getElementById('group-kelas');
const errorNama    = document.getElementById('error-nama');
const errorAbsen   = document.getElementById('error-absen');
const errorKelas   = document.getElementById('error-kelas');

// Masuk fields
const fieldEmail    = document.getElementById('input-email');
const fieldPassword = document.getElementById('input-password');
const groupEmail    = document.getElementById('group-email');
const groupPassword = document.getElementById('group-password');
const errorEmail    = document.getElementById('error-email');
const errorPassword = document.getElementById('error-password');

// Password toggle
const btnTogglePw  = document.getElementById('btn-toggle-pw');
const eyeOpen      = document.getElementById('pw-eye-open');
const eyeClosed    = document.getElementById('pw-eye-closed');

/* ── State ──────────────────────────────────────────────────── */
let currentMode = 'masuk'; // 'masuk' | 'daftar'

/* ══════════════════════════════════════════════════════════════
   TAB SWITCHER
   ══════════════════════════════════════════════════════════════ */

function switchTab(mode) {
  currentMode = mode;

  const isDaftar = mode === 'daftar';
  tabMasuk.classList.toggle('auth-tab--active', !isDaftar);
  tabDaftar.classList.toggle('auth-tab--active', isDaftar);
  tabMasuk.setAttribute('aria-selected', String(!isDaftar));
  tabDaftar.setAttribute('aria-selected', String(isDaftar));

  panelDaftar.hidden = !isDaftar;

  // Ubah teks tombol submit
  const btnText = btnMulai.querySelector('.btn-mulai__text');
  btnText.textContent = isDaftar ? 'Buat Akun' : 'Masuk';

  // Ubah placeholder password
  fieldPassword.placeholder = isDaftar ? 'Buat password rahasiamu...' : 'Masukkan passwordmu...';
  fieldPassword.autocomplete = isDaftar ? 'new-password' : 'current-password';

  // Reset semua error
  clearAllErrors();

  // Focus first visible field
  if (isDaftar) fieldNama?.focus();
  else fieldEmail?.focus();
}

tabMasuk.addEventListener('click', () => switchTab('masuk'));
tabDaftar.addEventListener('click', () => switchTab('daftar'));

/* ══════════════════════════════════════════════════════════════
   PASSWORD TOGGLE
   ══════════════════════════════════════════════════════════════ */

btnTogglePw?.addEventListener('click', () => {
  const isPassword = fieldPassword.type === 'password';
  fieldPassword.type = isPassword ? 'text' : 'password';
  eyeOpen.style.display   = isPassword ? 'none'  : '';
  eyeClosed.style.display = isPassword ? ''      : 'none';
});

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
   VALIDATION HELPERS
   ══════════════════════════════════════════════════════════════ */

function setError(group, errEl, inputEl, message) {
  group.classList.remove('is-valid');
  group.classList.add('is-error');
  errEl.textContent = message;
  errEl.classList.add('visible');
  inputEl.classList.remove('shake');
  void inputEl.offsetWidth;
  inputEl.classList.add('shake');
}

function setValid(group, errEl) {
  group.classList.remove('is-error');
  group.classList.add('is-valid');
  errEl.textContent = '';
  errEl.classList.remove('visible');
}

function resetField(group, errEl) {
  group.classList.remove('is-error', 'is-valid');
  errEl.textContent = '';
  errEl.classList.remove('visible');
}

function clearAllErrors() {
  [
    [groupNama,    errorNama],
    [groupAbsen,   errorAbsen],
    [groupKelas,   errorKelas],
    [groupEmail,   errorEmail],
    [groupPassword, errorPassword],
  ].forEach(([g, e]) => g && e && resetField(g, e));
}

/* ── Field validators ───────────────────────────────────────── */

function validateNama() {
  const val = fieldNama.value.trim();
  if (!val)          return setError(groupNama, errorNama, fieldNama, 'Nama lengkap tidak boleh kosong.'), false;
  if (val.length < 3) return setError(groupNama, errorNama, fieldNama, 'Nama minimal 3 karakter.'), false;
  if (val.length > 60) return setError(groupNama, errorNama, fieldNama, 'Nama terlalu panjang (maks. 60 karakter).'), false;
  if (!/^[a-zA-ZÀ-ÿ\s'.()-]+$/.test(val)) return setError(groupNama, errorNama, fieldNama, 'Nama hanya boleh berisi huruf dan spasi.'), false;
  setValid(groupNama, errorNama); return true;
}

function validateAbsen() {
  const raw = fieldAbsen.value.trim();
  if (!raw) return setError(groupAbsen, errorAbsen, fieldAbsen, 'Nomor absen wajib diisi.'), false;
  const num = parseInt(raw, 10);
  if (isNaN(num)) return setError(groupAbsen, errorAbsen, fieldAbsen, 'Masukkan angka yang valid.'), false;
  if (num < 1)    return setError(groupAbsen, errorAbsen, fieldAbsen, 'Nomor absen minimal 1.'), false;
  if (num > 36)   return setError(groupAbsen, errorAbsen, fieldAbsen, 'Nomor absen maksimal 36.'), false;
  setValid(groupAbsen, errorAbsen); return true;
}

function validateKelas() {
  if (!fieldKelas.value) return setError(groupKelas, errorKelas, fieldKelas, 'Pilih kelas / jurusan terlebih dahulu.'), false;
  setValid(groupKelas, errorKelas); return true;
}

function validateEmail() {
  const val = fieldEmail.value.trim();
  if (!val) return setError(groupEmail, errorEmail, fieldEmail, 'Email tidak boleh kosong.'), false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return setError(groupEmail, errorEmail, fieldEmail, 'Format email tidak valid. Contoh: nama@gmail.com'), false;
  setValid(groupEmail, errorEmail); return true;
}

function validatePassword() {
  const val = fieldPassword.value;
  if (!val)        return setError(groupPassword, errorPassword, fieldPassword, 'Password tidak boleh kosong.'), false;
  if (val.length < 6) return setError(groupPassword, errorPassword, fieldPassword, 'Password minimal 6 karakter.'), false;
  setValid(groupPassword, errorPassword); return true;
}

/* ── Real-time validation ───────────────────────────────────── */

fieldNama?.addEventListener('input', () => { if (groupNama.classList.contains('is-error')) validateNama(); });
fieldNama?.addEventListener('blur',  () => { if (fieldNama.value.trim()) validateNama(); });
fieldAbsen?.addEventListener('input', () => { if (groupAbsen.classList.contains('is-error')) validateAbsen(); });
fieldAbsen?.addEventListener('blur',  () => { if (fieldAbsen.value.trim()) validateAbsen(); });
fieldKelas?.addEventListener('change', validateKelas);
fieldEmail?.addEventListener('input', () => { if (groupEmail.classList.contains('is-error')) validateEmail(); });
fieldEmail?.addEventListener('blur',  () => { if (fieldEmail.value.trim()) validateEmail(); });
fieldPassword?.addEventListener('input', () => { if (groupPassword.classList.contains('is-error')) validatePassword(); });

/* ── Remove shake after animation ──────────────────────────── */
[fieldNama, fieldAbsen, fieldKelas, fieldEmail, fieldPassword]
  .filter(Boolean)
  .forEach(el => el.addEventListener('animationend', () => el.classList.remove('shake')));

/* ══════════════════════════════════════════════════════════════
   RIPPLE
   ══════════════════════════════════════════════════════════════ */

btnMulai.addEventListener('click', function (e) {
  const ripple = this.querySelector('.btn-mulai__ripple');
  const rect   = this.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  ripple.style.width  = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left   = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top    = `${e.clientY - rect.top  - size / 2}px`;
  ripple.classList.remove('ripple-animate');
  void ripple.offsetWidth;
  ripple.classList.add('ripple-animate');
});

/* ══════════════════════════════════════════════════════════════
   LOADING STATE
   ══════════════════════════════════════════════════════════════ */

function setLoadingState(isLoading, label = 'Memproses') {
  const btnText = btnMulai.querySelector('.btn-mulai__text');
  const btnIcon = btnMulai.querySelector('.btn-mulai__icon');
  if (isLoading) {
    btnMulai.classList.add('loading');
    btnMulai.setAttribute('aria-busy', 'true');
    btnText.textContent = label;
    btnIcon.textContent = '⏳';
  } else {
    btnMulai.classList.remove('loading');
    btnMulai.removeAttribute('aria-busy');
    btnText.textContent = currentMode === 'daftar' ? 'Buat Akun' : 'Masuk';
    btnIcon.textContent = '→';
  }
}

/* ══════════════════════════════════════════════════════════════
   FORM SUBMIT
   ══════════════════════════════════════════════════════════════ */

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email    = fieldEmail.value.trim();
  const password = fieldPassword.value;

  // Validate shared fields
  const emailOk    = validateEmail();
  const passwordOk = validatePassword();

  if (currentMode === 'daftar') {
    const namaOk  = validateNama();
    const absenOk = validateAbsen();
    const kelasOk = validateKelas();

    if (!namaOk || !absenOk || !kelasOk || !emailOk || !passwordOk) {
      showToast('Periksa kembali isian formulirmu.', 'error', 3000);
      if (!namaOk)  fieldNama.focus();
      else if (!absenOk) fieldAbsen.focus();
      else if (!kelasOk) fieldKelas.focus();
      else if (!emailOk) fieldEmail.focus();
      else fieldPassword.focus();
      return;
    }

    const profile = {
      nama:  capitalize(fieldNama.value.trim()),
      absen: parseInt(fieldAbsen.value.trim(), 10),
      kelas: fieldKelas.value,
    };

    setLoadingState(true, 'Mendaftarkan');
    const { ok, message, redirect } = await handleRegister(email, password, profile);
    setLoadingState(false);

    showToast(message, ok ? 'success' : 'error', ok ? 4000 : 5000);

    if (ok && redirect) {
      setTimeout(() => window.location.href = 'dashboard.html', 1200);
    }

  } else {
    // Mode masuk
    if (!emailOk || !passwordOk) {
      showToast('Periksa kembali isian formulirmu.', 'error', 3000);
      if (!emailOk) fieldEmail.focus();
      else fieldPassword.focus();
      return;
    }

    setLoadingState(true, 'Masuk');
    const { ok, message, redirect } = await handleLogin(email, password);
    setLoadingState(false);

    showToast(message, ok ? 'success' : 'error', ok ? 3500 : 5000);

    if (ok && redirect) {
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    }
  }
});

/* ══════════════════════════════════════════════════════════════
   UTILITY
   ══════════════════════════════════════════════════════════════ */

function capitalize(str) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

/* ── Init ───────────────────────────────────────────────────── */
switchTab('masuk');
