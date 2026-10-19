/**
 * TO-TYPE — auth.js
 * Menangani Register, Login, dan Logout dari halaman index.html.
 * Menggunakan Supabase Auth via supabase.js.
 * Jika Supabase belum dikonfigurasi → fallback ke mode demo (sessionStorage).
 */

import {
  isSupabaseConfigured,
  registerSiswa,
  loginSiswa,
  logoutSiswa,
  getSession,
} from './supabase.js';

/* ── Mode Flag ──────────────────────────────────────────────── */
export const DEMO_MODE = !isSupabaseConfigured();

if (DEMO_MODE) {
  console.warn(
    '[TO-TYPE] ⚠️  Mode Demo aktif.\n' +
    'Isi SUPABASE_URL dan SUPABASE_ANON_KEY di supabase.js untuk mengaktifkan database.'
  );
}

/* ── Cek Sesi Aktif ─────────────────────────────────────────── */

/**
 * Panggil ini saat halaman index.html dimuat.
 * Jika siswa sudah login, redirect langsung ke dashboard.
 */
export async function checkExistingSession() {
  if (DEMO_MODE) return; // mode demo tidak punya sesi persisten

  const { session } = await getSession();
  if (session) {
    window.location.replace('dashboard.html');
  }
}

/* ── Register ───────────────────────────────────────────────── */

/**
 * Proses registrasi baru via Supabase Auth.
 * Dipanggil dari script.js saat form 'daftar' disubmit.
 *
 * @param {string} email
 * @param {string} password
 * @param {{ nama: string, absen: number, kelas: string }} profile
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function handleRegister(email, password, profile) {
  if (DEMO_MODE) {
    // Simpan ke sessionStorage sebagai demo
    sessionStorage.setItem('totype_siswa', JSON.stringify({ ...profile, email, demo: true }));
    return {
      ok: true,
      message: `[MODE DEMO] Halo, ${profile.nama}! Data disimpan sementara — hubungkan Supabase untuk akun permanen.`,
    };
  }

  const { user, error } = await registerSiswa(email, password, profile);
  if (error) return { ok: false, message: error };

  // Supabase mungkin perlu konfirmasi email — cek apakah sesi langsung aktif
  const { session } = await getSession();
  if (session) {
    sessionStorage.setItem('totype_siswa', JSON.stringify({ ...profile, email }));
    return { ok: true, message: `Akun berhasil dibuat! Selamat datang, ${profile.nama}!`, redirect: true };
  }

  // Konfirmasi email diperlukan
  return {
    ok: true,
    message: 'Akun berhasil dibuat! Cek emailmu dan klik link konfirmasi, lalu login.',
    redirect: false,
  };
}

/* ── Login ──────────────────────────────────────────────────── */

/**
 * Proses login via Supabase Auth.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, message: string, redirect?: boolean }>}
 */
export async function handleLogin(email, password) {
  if (DEMO_MODE) {
    const saved = sessionStorage.getItem('totype_siswa');
    if (saved) {
      return { ok: true, message: '[MODE DEMO] Login berhasil! (data dari sesi browser)', redirect: true };
    }
    return { ok: false, message: '[MODE DEMO] Tidak ada data sesi. Isi form dan klik Mulai Latihan.' };
  }

  const { session, error } = await loginSiswa(email, password);
  if (error) return { ok: false, message: error };

  // Ambil metadata profil dari user untuk simpan di sessionStorage
  const user = session?.user;
  const meta = user?.user_metadata ?? {};
  sessionStorage.setItem('totype_siswa', JSON.stringify({
    nama:  meta.nama  ?? 'Siswa',
    absen: meta.absen ?? 0,
    kelas: meta.kelas ?? '-',
    email: user?.email ?? '',
  }));

  return { ok: true, message: `Selamat datang kembali, ${meta.nama ?? 'Siswa'}!`, redirect: true };
}

/* ── Logout ─────────────────────────────────────────────────── */

/**
 * Logout dari Supabase dan bersihkan data lokal.
 * Redirect ke index.html setelah selesai.
 */
export async function handleLogout() {
  sessionStorage.removeItem('totype_siswa');

  if (!DEMO_MODE) {
    const { error } = await logoutSiswa();
    if (error) {
      console.error('[TO-TYPE] Logout error:', error);
      // Lanjutkan redirect meski ada error — sudah hapus sesi lokal
    }
  }

  window.location.replace('index.html');
}
