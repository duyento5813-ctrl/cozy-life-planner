import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const $ = id => document.getElementById(id);
const KEYS = { planner_data:'cozy-planner-demo-v1', finance_data:'cozy-finance-v1', efficiency_data:'cozy-efficiency-v2' };
const PREFKEY = 'cozy-cloud-preferences-v1';
const OWNERKEY = 'cozy-cloud-owner-v1';
const TABLES = [...Object.keys(KEYS), 'user_preferences'];
let client = null, user = null, busy = false, paused = false, poll = null;
let baseline = {}, lastLocal = {}, generation = 0, recoveryPrompted = false;

const status = s => { if ($('cozySyncStatus')) $('cozySyncStatus').textContent = s; };
const message = s => { if ($('cozyAuthMessage')) $('cozyAuthMessage').textContent = s; };
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const localKey = table => table === 'user_preferences' ? PREFKEY : KEYS[table];
const localValue = table => parse(localStorage.getItem(localKey(table)));
const setLocal = (table, value) => localStorage.setItem(localKey(table), JSON.stringify(value));
const snapshot = () => Object.fromEntries(Object.entries(KEYS).map(([table,key]) => [table, localStorage.getItem(key)]));

function backup() {
  const payload = { format:'cozy-full-backup', version:1, createdAt:new Date().toISOString(), data:snapshot(), preferences:localStorage.getItem(PREFKEY) };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'cozy-full-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function preferences() { return parse(localStorage.getItem(PREFKEY)) || {language:'bilingual',theme:'light',reminders:true}; }
function applyPrefs() {
  const p = preferences();
  if ($('cozyLanguage')) $('cozyLanguage').value = p.language || 'bilingual';
  if ($('cozyTheme')) $('cozyTheme').value = p.theme || 'light';
  if ($('cozyReminders')) $('cozyReminders').checked = p.reminders !== false;
  document.body.classList.toggle('cozy-dark', p.theme === 'dark' || (p.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
}
function setPrefs() {
  const p = { language:$('cozyLanguage').value, theme:$('cozyTheme').value, reminders:$('cozyReminders').checked };
  localStorage.setItem(PREFKEY, JSON.stringify(p)); applyPrefs();
}
function showAuth() {
  const signed = !!user;
  if ($('cozyAuthForm')) $('cozyAuthForm').hidden = signed;
  if ($('cozySignedIn')) $('cozySignedIn').hidden = !signed;
  if ($('cozyAuthStatus')) $('cozyAuthStatus').textContent = signed ? '已登入 / Đã đăng nhập: ' + (user.email || '') : '尚未登入 / Chưa đăng nhập';
  if ($('cozyAccountBadge')) $('cozyAccountBadge').textContent = signed ? (user.email || '已登入') : '離線模式 / Chưa đăng nhập';
}
function isConfigured() {
  return typeof SUPABASE_URL === 'string' && /^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(SUPABASE_URL) &&
    typeof SUPABASE_PUBLISHABLE_KEY === 'string' && SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') && !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');
}
function validate(table, v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (table === 'planner_data') return Array.isArray(v.events) && Array.isArray(v.tasks) && !!v.goalLists;
  return true;
}
async function remoteRow(table, uid) {
  const {data,error} = await client.from(table).select('data,updated_at').eq('user_id',uid).maybeSingle();
  if (error) throw error;
  return data;
}
async function upload(table, value, oldTimestamp, uid) {
  const query = oldTimestamp
    ? client.from(table).update({data:value}).eq('user_id',uid).eq('updated_at',oldTimestamp).select('updated_at')
    : client.from(table).insert({user_id:uid,data:value}).select('updated_at');
  const {data,error} = await query;
  if (error) throw error;
  if (!data?.length) throw Error('Dữ liệu đám mây đã thay đổi. Đồng bộ tạm dừng để tránh ghi đè.');
  return data[0].updated_at;
}
async function sync() {
  if (!user || busy || paused || !navigator.onLine) return;
  const uid = user.id, currentGeneration = generation;
  busy = true; status('同步中 / Đang đồng bộ...');
  let needReload = false;
  try {
    for (const table of TABLES) {
      if (generation !== currentGeneration || user?.id !== uid) return;
      const current = localValue(table), raw = JSON.stringify(current);
      const remote = await remoteRow(table, uid);
      if (generation !== currentGeneration || user?.id !== uid) return;
      const prior = baseline[table];
      if (!remote) {
        if (current !== null) {
          if (!validate(table,current)) throw Error('Dữ liệu máy không hợp lệ: ' + table);
          baseline[table] = await upload(table,current,null,uid);
        }
        lastLocal[table] = raw;
        continue;
      }
      if (!validate(table,remote.data)) throw Error('Dữ liệu đám mây không hợp lệ: ' + table);
      if (prior === undefined) {
        if (current !== null && raw !== JSON.stringify(remote.data)) {
          paused = true; backup();
          status('資料衝突 / Dữ liệu máy và đám mây khác nhau');
          const useCloud = confirm('Đã tải bản sao lưu dữ liệu máy.\nOK: dùng dữ liệu ĐÁM MÂY trên máy này.\nCancel: GIỮ NGUYÊN dữ liệu máy và tạm dừng đồng bộ.');
          if (!useCloud) { message('Đồng bộ tạm dừng. Dữ liệu trên máy được giữ nguyên.'); return; }
          setLocal(table,remote.data); needReload ||= table !== 'user_preferences';
          if (table === 'user_preferences') applyPrefs();
          baseline[table] = remote.updated_at; lastLocal[table] = JSON.stringify(remote.data);
          paused = false;
          continue;
        }
        if (current === null) {
          setLocal(table,remote.data); needReload ||= table !== 'user_preferences';
          if (table === 'user_preferences') applyPrefs();
          lastLocal[table] = JSON.stringify(remote.data);
        } else lastLocal[table] = raw;
        baseline[table] = remote.updated_at;
        continue;
      }
      const localChanged = raw !== lastLocal[table], remoteChanged = remote.updated_at !== prior;
      if (localChanged && remoteChanged) {
        paused = true; backup();
        throw Error('Cả máy và đám mây đều đã thay đổi. Đã tải bản sao lưu; đồng bộ tạm dừng.');
      }
      if (remoteChanged) {
        setLocal(table,remote.data); baseline[table] = remote.updated_at;
        lastLocal[table] = JSON.stringify(remote.data);
        if (table === 'user_preferences') applyPrefs(); else needReload = true;
      } else if (localChanged && current !== null) {
        if (!validate(table,current)) throw Error('Dữ liệu máy không hợp lệ: ' + table);
        baseline[table] = await upload(table,current,prior,uid); lastLocal[table] = raw;
      }
    }
    status('已同步 / Đã đồng bộ · ' + new Date().toLocaleTimeString());
    if (needReload) location.reload();
  } catch (e) {
    console.error('Cozy sync:',e);
    status('同步失敗 / Đồng bộ lỗi: ' + e.message);
    message(e.message);
  } finally { busy = false; }
}
async function initUser(u) {
  const uid = u?.id || null;
  if (uid === user?.id) return;
  generation++; if (poll) { clearInterval(poll); poll = null; }
  user = u || null; baseline = {}; lastLocal = {}; paused = false; showAuth();
  if (!user) { status('尚未登入 / Chưa đăng nhập'); return; }
  const owner = localStorage.getItem(OWNERKEY);
  if (owner && owner !== uid) {
    paused = true;
    status('此瀏覽器已有其他帳號的資料 / Trình duyệt có dữ liệu tài khoản khác');
    message('Hãy sử dụng hồ sơ trình duyệt riêng để tránh lẫn dữ liệu.');
    return;
  }
  // Mark ownership only after checking; never silently mix another account's cache.
  if (!owner) localStorage.setItem(OWNERKEY,uid);
  await sync();
  poll = setInterval(() => { if (user?.id === uid) sync(); },4000);
}
async function init() {
  applyPrefs(); showAuth();
  if ($('cozyExportAll')) $('cozyExportAll').onclick = backup;
  for (const id of ['cozyLanguage','cozyTheme','cozyReminders']) {
    if ($(id)) $(id).addEventListener('change',setPrefs);
  }
  if (!isConfigured()) {
    status('尚未設定 / Chưa cấu hình Supabase');
    message('Kiểm tra SUPABASE_URL và Publishable key trong supabase-config.js.');
    return;
  }
  client = createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{detectSessionInUrl:true,autoRefreshToken:true,persistSession:true}
  });
  let authMode = 'login';
  const authModes = {
    login: ['登入現有帳號 / Đăng nhập tài khoản đã có','登入 / Đăng nhập'],
    register: ['建立新帳號 / Tạo tài khoản mới','註冊 / Tạo tài khoản'],
    reset: ['重設密碼 / Nhận email đặt lại mật khẩu','發送郵件 / Gửi email khôi phục']
  };
  function setAuthMode(mode) {
    authMode = mode;
    for (const [name,id] of [['login','cozyModeLogin'],['register','cozyModeRegister'],['reset','cozyModeReset']]) {
      const button = $(id); if (!button) continue;
      button.classList.toggle('active',name === mode);
      button.setAttribute('aria-pressed',String(name === mode));
    }
    $('cozyModeDescription').textContent = authModes[mode][0];
    $('cozyAuthSubmit').textContent = authModes[mode][1];
    $('cozyPasswordField').hidden = mode === 'reset';
    $('cozyPassword').disabled = mode === 'reset';
    $('cozyPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('cozyConfirmField').hidden = mode !== 'register';
    $('cozyConfirmPassword').disabled = mode !== 'register';
    $('cozyConfirmPassword').value = '';
    message('');
  }
  $('cozyModeLogin').onclick = () => setAuthMode('login');
  $('cozyModeRegister').onclick = () => setAuthMode('register');
  $('cozyModeReset').onclick = () => setAuthMode('reset');
  setAuthMode('login');
  const authError = error => {
    if (!error) return '';
    const m = error.message || String(error);
    if (/after \d+ seconds|rate limit|too many requests/i.test(m)) return 'Yêu cầu quá nhiều lần. Vui lòng đợi một chút rồi thử lại. (' + m + ')';
    if (/invalid login credentials/i.test(m)) return 'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được xác nhận.';
    if (/email not confirmed/i.test(m)) return 'Vui lòng mở email và xác nhận tài khoản trước khi đăng nhập.';
    return m;
  };
  $('cozyAuthForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('cozyEmail').value.trim(), password = $('cozyPassword').value;
    const submit = $('cozyAuthSubmit');
    if (!email) { message('Vui lòng nhập email.'); return; }
    if (authMode !== 'reset' && password.length < 6) { message('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    if (authMode === 'register' && password !== $('cozyConfirmPassword').value) { message('Mật khẩu xác nhận không khớp.'); return; }
    submit.disabled = true;
    message('處理中 / Đang xử lý...');
    try {
      if (authMode === 'login') {
        const {error} = await client.auth.signInWithPassword({email,password});
        message(error ? authError(error) : '登入成功 / Đăng nhập thành công.');
      } else if (authMode === 'register') {
        const {data,error} = await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
        message(error ? authError(error) : data?.session ? '註冊成功 / Tạo tài khoản thành công.' : '已送出註冊要求 / Đã gửi yêu cầu đăng ký. Hãy kiểm tra email để xác nhận tài khoản (nếu được yêu cầu).');
      } else {
        const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?mode=reset'});
        message(error ? authError(error) : '若帳號存在，將收到郵件 / Nếu email đã đăng ký, em sẽ nhận được thư khôi phục mật khẩu.');
      }
    } catch(err) { console.error(err); message('Không thể kết nối: ' + err.message); }
    finally { submit.disabled = false; }
  };
  if ($('cozyChangePassword')) $('cozyChangePassword').onclick = async () => {
    const pass = prompt('新密碼 / Mật khẩu mới (ít nhất 6 ký tự)');
    if (pass === null) return; if (pass.length < 6) { message('Mật khẩu quá ngắn.'); return; }
    const {error} = await client.auth.updateUser({password:pass});
    message(error ? error.message : '密碼已更新 / Đã đổi mật khẩu.');
  };
  if ($('cozyLogout')) $('cozyLogout').onclick = async () => {
    if (!confirm('登出？/ Đăng xuất? Dữ liệu cục bộ vẫn còn trên máy này.')) return;
    const {error} = await client.auth.signOut();
    if (error) message(error.message); else location.reload();
  };
  if ($('cozySyncNow')) $('cozySyncNow').onclick = () => {
    if (paused) { message('Đồng bộ đang tạm dừng do xung đột hoặc tài khoản khác. Không thể tự động bỏ qua để tránh mất dữ liệu.'); return; }
    sync();
  };
  client.auth.onAuthStateChange((event,session) => {
    if (event === 'PASSWORD_RECOVERY' && !recoveryPrompted) {
      recoveryPrompted = true;
      setTimeout(async () => {
        const pass = prompt('請設定新密碼 / Nhập mật khẩu mới (ít nhất 6 ký tự)');
        if (!pass) return;
        if (pass.length < 6) { message('Mật khẩu quá ngắn.'); return; }
        const {error} = await client.auth.updateUser({password:pass});
        message(error ? error.message : '密碼已重設 / Đã đặt lại mật khẩu.');
      },200);
    }
    if (['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) {
      // Defer database calls outside the Supabase auth callback.
      setTimeout(() => initUser(session?.user || null).catch(e => {
        console.error('Cozy auth:',e); status('連線失敗 / Lỗi kết nối'); message(e.message);
      }),0);
    }
  });
  // Explicitly read the session too: the UI must not depend solely on INITIAL_SESSION.
  const {data,error} = await client.auth.getSession();
  if (error) throw error;
  await initUser(data?.session?.user || null);
}
init().catch(e => {
  console.error('Cozy initialization:',e);
  status('連線失敗 / Lỗi kết nối'); showAuth(); message('Không thể khởi tạo Supabase: ' + e.message);
});
