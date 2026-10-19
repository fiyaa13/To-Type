/**
 * TO-TYPE — supabase.js
 * Inisialisasi Supabase client dan fungsi-fungsi database.
 *
 * ⚠️  KONFIGURASI:
 *      Isi SUPABASE_URL dan SUPABASE_ANON_KEY di bawah dengan nilai
 *      dari Supabase Dashboard → Settings → API.
 *      JANGAN pernah memasukkan service_role key atau DB password di sini.
 *
 * Menggunakan @supabase/supabase-js via CDN (ESM).
 * Import file ini sebagai modul ES di setiap halaman yang membutuhkannya.
 */

/* ── 1. KONFIGURASI (ISI DI SINI) ──────────────────────────── */
export const SUPABASE_URL = 'https://zltnnvtobsxkwaooywzj.supabase.co/rest/v1/';   // contoh: https://abcxyz.supabase.co
export const SUPABASE_ANON_KEY = 'sb_publishable_F9JFpIL6EgaJ7SJWAzuAJg_56egVFXU';      // publishable / anon key

/* ── 2. Inisialisasi Client ─────────────────────────────────── */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Supabase client — satu instance dipakai seluruh aplikasi.
 * Otomatis mengelola sesi (cookie/localStorage) dan refresh token.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,   // simpan sesi di localStorage
    autoRefreshToken: true,   // perpanjang token otomatis
    detectSessionInUrl: true,  // tangkap magic-link / OAuth callback
  },
});

/* ── 3. Helper: Cek apakah sudah dikonfigurasi ──────────────── */
export function isSupabaseConfigured() {
  return (
    SUPABASE_URL !== 'https://zltnnvtobsxkwaooywzj.supabase.co/rest/v1/' &&
    SUPABASE_ANON_KEY !== 'sb_publishable_F9JFpIL6EgaJ7SJWAzuAJg_56egVFXU' &&
    SUPABASE_URL.startsWith('https://')
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH FUNCTIONS
   ══════════════════════════════════════════════════════════════ */

/**
 * Daftarkan akun siswa baru.
 * Menyimpan nama, nomor absen, dan kelas sebagai user_metadata agar
 * bisa diakses tanpa query ke tabel profiles.
 *
 * @param {string} email
 * @param {string} password
 * @param {{ nama: string, absen: number, kelas: string }} profileData
 * @returns {Promise<{ user: object|null, error: string|null }>}
 */
export async function registerSiswa(email, password, profileData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nama: profileData.nama,
        absen: profileData.absen,
        kelas: profileData.kelas,
      },
    },
  });

  if (error) return { user: null, error: friendlyAuthError(error) };

  // Buat baris di tabel `profiles` menggunakan ID dari Supabase Auth
  if (data?.user) {
    await upsertProfile(data.user.id, profileData);
  }

  return { user: data?.user ?? null, error: null };
}

/**
 * Login siswa yang sudah terdaftar.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ session: object|null, error: string|null }>}
 */
export async function loginSiswa(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { session: null, error: friendlyAuthError(error) };
  return { session: data?.session ?? null, error: null };
}

/**
 * Logout — menghapus sesi dari browser.
 *
 * @returns {Promise<{ error: string|null }>}
 */
export async function logoutSiswa() {
  const { error } = await supabase.auth.signOut();
  if (error) return { error: friendlyAuthError(error) };
  return { error: null };
}

/**
 * Ambil sesi aktif yang sedang login.
 *
 * @returns {Promise<{ session: object|null, user: object|null }>}
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return {
    session: data?.session ?? null,
    user: data?.session?.user ?? null,
  };
}

/* ══════════════════════════════════════════════════════════════
   PROFILES TABLE
   Schema:
     id        uuid  PRIMARY KEY REFERENCES auth.users(id)
     nama      text  NOT NULL
     absen     int2  NOT NULL
     kelas     text  NOT NULL
     created_at timestamptz DEFAULT now()
   ══════════════════════════════════════════════════════════════ */

/**
 * Buat atau perbarui profil siswa berdasarkan auth.uid().
 *
 * @param {string} userId  - dari auth.users.id
 * @param {{ nama: string, absen: number, kelas: string }} profileData
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function upsertProfile(userId, profileData) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      nama: profileData.nama,
      absen: profileData.absen,
      kelas: profileData.kelas,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return { data: null, error: friendlyDbError(error, 'profil') };
  return { data, error: null };
}

/**
 * Ambil profil siswa yang sedang login.
 *
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function getMyProfile() {
  const { user } = await getSession();
  if (!user) return { data: null, error: 'Kamu belum login.' };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return { data: null, error: friendlyDbError(error, 'profil') };
  return { data, error: null };
}

/* ══════════════════════════════════════════════════════════════
   EXERCISES TABLE  (dibaca oleh semua siswa, RLS: SELECT for all)
   Schema:
     id          uuid    PRIMARY KEY DEFAULT gen_random_uuid()
     level       int2    NOT NULL  (1–5)
     title       text    NOT NULL
     description text
     content     text[]  NOT NULL  (array kata/kalimat/paragraf)
     min_wpm     int2    DEFAULT 0
     min_accuracy int2   DEFAULT 90
     created_at  timestamptz DEFAULT now()
   ══════════════════════════════════════════════════════════════ */

/**
 * Ambil semua materi latihan, diurutkan dari level terendah.
 *
 * @returns {Promise<{ data: object[]|null, error: string|null }>}
 */
export async function getExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('level', { ascending: true });

  if (error) return { data: null, error: friendlyDbError(error, 'materi latihan') };
  return { data, error: null };
}

/**
 * Ambil satu materi latihan berdasarkan level.
 *
 * @param {number} level
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function getExerciseByLevel(level) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('level', level)
    .single();

  if (error) return { data: null, error: friendlyDbError(error, `materi level ${level}`) };
  return { data, error: null };
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS TABLE  (satu baris per user per level, RLS: user owns rows)
   Schema:
     id            uuid    PRIMARY KEY DEFAULT gen_random_uuid()
     user_id       uuid    NOT NULL REFERENCES auth.users(id)
     level         int2    NOT NULL
     status        text    NOT NULL  ('active' | 'completed')
     best_wpm      int2    DEFAULT 0
     best_accuracy int2    DEFAULT 0
     last_attempt  timestamptz
     UNIQUE(user_id, level)
   ══════════════════════════════════════════════════════════════ */

/**
 * Ambil semua progres latihan milik siswa yang login.
 * Otomatis difilter berdasarkan auth.uid() via RLS.
 *
 * @returns {Promise<{ data: object[]|null, error: string|null }>}
 */
export async function getMyProgress() {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .order('level', { ascending: true });

  if (error) return { data: null, error: friendlyDbError(error, 'progres') };
  return { data: data ?? [], error: null };
}

/**
 * Simpan atau perbarui progres untuk level tertentu.
 * user_id diambil dari sesi auth — tidak dikirim dari frontend secara manual.
 *
 * @param {number} level
 * @param {{ status: string, best_wpm?: number, best_accuracy?: number }} progressData
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function upsertProgress(level, progressData) {
  const { user } = await getSession();
  if (!user) return { data: null, error: 'Kamu harus login untuk menyimpan progres.' };

  const payload = {
    user_id: user.id,          // ID dari Supabase Auth — bukan nama/absen
    level,
    status: progressData.status,
    last_attempt: new Date().toISOString(),
    ...(progressData.best_wpm !== undefined && { best_wpm: progressData.best_wpm }),
    ...(progressData.best_accuracy !== undefined && { best_accuracy: progressData.best_accuracy }),
  };

  const { data, error } = await supabase
    .from('progress')
    .upsert(payload, { onConflict: 'user_id,level' })
    .select()
    .single();

  if (error) return { data: null, error: friendlyDbError(error, 'progres') };
  return { data, error: null };
}

/* ══════════════════════════════════════════════════════════════
   RESULTS TABLE  (riwayat setiap sesi latihan)
   Schema:
     id          uuid    PRIMARY KEY DEFAULT gen_random_uuid()
     user_id     uuid    NOT NULL REFERENCES auth.users(id)
     level       int2    NOT NULL
     wpm         int2    NOT NULL
     accuracy    int2    NOT NULL
     duration_s  int4    NOT NULL  (durasi dalam detik)
     mistakes    int2    DEFAULT 0
     completed_at timestamptz DEFAULT now()
   ══════════════════════════════════════════════════════════════ */

/**
 * Simpan satu hasil sesi latihan ke riwayat.
 * user_id diambil dari sesi auth aktif — tidak dikirim secara manual.
 *
 * @param {{ level: number, wpm: number, accuracy: number, duration_s: number, mistakes?: number }} resultData
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function saveResult(resultData) {
  const { user } = await getSession();
  if (!user) return { data: null, error: 'Kamu harus login untuk menyimpan hasil.' };

  const { data, error } = await supabase
    .from('results')
    .insert({
      user_id: user.id,
      level: resultData.level,
      wpm: resultData.wpm,
      accuracy: resultData.accuracy,
      duration_s: resultData.duration_s,
      mistakes: resultData.mistakes ?? 0,
    })
    .select()
    .single();

  if (error) return { data: null, error: friendlyDbError(error, 'hasil latihan') };
  return { data, error: null };
}

/**
 * Ambil riwayat hasil latihan milik siswa yang login.
 * Diurutkan dari yang terbaru.
 *
 * @param {number|null} level  - Filter per level, atau null untuk semua.
 * @param {number} limit       - Jumlah baris maksimum.
 * @returns {Promise<{ data: object[]|null, error: string|null }>}
 */
export async function getMyResults(level = null, limit = 50) {
  let query = supabase
    .from('results')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (level !== null) query = query.eq('level', level);

  const { data, error } = await query;
  if (error) return { data: null, error: friendlyDbError(error, 'riwayat latihan') };
  return { data: data ?? [], error: null };
}

/* ══════════════════════════════════════════════════════════════
   KONEKSI TEST
   ══════════════════════════════════════════════════════════════ */

/**
 * Uji koneksi ke Supabase dengan query ringan ke tabel exercises.
 * Gunakan ini di konsol browser atau di halaman debug untuk memverifikasi
 * bahwa URL dan ANON KEY sudah benar sebelum fitur latihan diaktifkan.
 *
 * Cara pakai di browser console:
 *   import { testConnection } from './supabase.js';
 *   testConnection().then(console.log);
 *
 * @returns {Promise<{ ok: boolean, latencyMs: number, error: string|null }>}
 */
export async function testConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, latencyMs: 0, error: 'Supabase belum dikonfigurasi. Isi URL dan ANON_KEY di supabase.js.' };
  }

  const t0 = Date.now();
  try {
    const { error } = await supabase
      .from('exercises')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - t0;
    if (error) return { ok: false, latencyMs, error: friendlyDbError(error, 'koneksi') };
    return { ok: true, latencyMs, error: null };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: `Koneksi gagal: ${e.message}` };
  }
}

/* ══════════════════════════════════════════════════════════════
   ERROR MESSAGE HELPERS
   ══════════════════════════════════════════════════════════════ */

/**
 * Ubah pesan error Supabase Auth menjadi bahasa Indonesia yang ramah siswa.
 * @param {{ message: string, status?: number }} error
 * @returns {string}
 */
function friendlyAuthError(error) {
  const msg = error?.message?.toLowerCase() ?? '';

  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
    return 'Email atau password salah. Periksa kembali dan coba lagi.';
  if (msg.includes('email not confirmed'))
    return 'Email belum dikonfirmasi. Cek kotak masuk emailmu dan klik link konfirmasi.';
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Email ini sudah terdaftar. Coba login atau gunakan email lain.';
  if (msg.includes('password should be at least'))
    return 'Password terlalu pendek. Gunakan minimal 6 karakter.';
  if (msg.includes('rate limit'))
    return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Tidak ada koneksi internet. Periksa jaringan WiFi atau LAN kamu.';
  if (msg.includes('email address') && msg.includes('invalid'))
    return 'Format email tidak valid. Contoh: nama@gmail.com';

  console.error('[TO-TYPE Auth Error]', error);
  return `Terjadi kesalahan: ${error?.message ?? 'Tidak diketahui'}`;
}

/**
 * Ubah pesan error database Supabase menjadi pesan ramah.
 * @param {{ message: string, code?: string }} error
 * @param {string} context - Nama fitur/tabel untuk konteks.
 * @returns {string}
 */
function friendlyDbError(error, context) {
  const msg = error?.message?.toLowerCase() ?? '';
  const code = error?.code ?? '';

  if (code === 'PGRST116' || msg.includes('no rows'))
    return `Data ${context} tidak ditemukan.`;
  if (code === '42501' || msg.includes('rls') || msg.includes('permission'))
    return `Akses ke ${context} ditolak. Pastikan kamu sudah login.`;
  if (code === '23505' || msg.includes('unique'))
    return `Data ${context} sudah ada sebelumnya.`;
  if (code === '23503' || msg.includes('foreign key'))
    return `Referensi data tidak valid untuk ${context}.`;
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Koneksi ke server terputus. Periksa jaringan dan coba lagi.';

  console.error(`[TO-TYPE DB Error: ${context}]`, error);
  return `Gagal memuat ${context}. Coba muat ulang halaman.`;
}
