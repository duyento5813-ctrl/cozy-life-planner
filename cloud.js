import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
const $ = id => document.getElementById(id);
const KEYS = {planner_data:'cozy-planner-demo-v1',finance_data:'cozy-finance-v1',efficiency_data:'cozy-efficiency-v2'};
const PREFKEY='cozy-cloud-preferences-v1';
let client=null,user=null,busy=false,baseline={},lastLocal={},poll=null,paused=false;
const status = s => {if($('cozySyncStatus'))$('cozySyncStatus').textContent=s};
const message = s => {if($('cozyAuthMessage'))$('cozyAuthMessage').textContent=s};
const parse = s => {try{return JSON.parse(s)}catch{return null}};
const snapshot=()=>Object.fromEntries(Object.entries(KEYS).map(([t,k])=>[t,localStorage.getItem(k)]));
function backup(){const payload={format:'cozy-full-backup',version:1,createdAt:new Date().toISOString(),data:snapshot(),preferences:localStorage.getItem(PREFKEY)};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cozy-full-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function preferences(){return parse(localStorage.getItem(PREFKEY))||{language:'bilingual',theme:'light',reminders:true}}
function applyPrefs(){const p=preferences();$('cozyLanguage').value=p.language||'bilingual';$('cozyTheme').value=p.theme||'light';$('cozyReminders').checked=p.reminders!==false;document.body.classList.toggle('cozy-dark',p.theme==='dark'||(p.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));}
function setPrefs(){const p={language:$('cozyLanguage').value,theme:$('cozyTheme').value,reminders:$('cozyReminders').checked};localStorage.setItem(PREFKEY,JSON.stringify(p));applyPrefs();}
function showAuth(){const signed=!!user;$('cozyAuthForm').hidden=signed;$('cozySignedIn').hidden=!signed;$('cozyAuthStatus').textContent=signed?'已登入 / Đã đăng nhập: '+user.email:'尚未登入 / Chưa đăng nhập';$('cozyAccountBadge').textContent=signed?user.email:'離線模式 / Chưa đăng nhập';}
function isConfigured(){return SUPABASE_URL.startsWith('https://')&&SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')&&!SUPABASE_PUBLISHABLE_KEY.includes('PASTE_')}
async function remoteRow(table){const {data,error}=await client.from(table).select('data,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data;}
function localValue(table){const key=table==='user_preferences'?PREFKEY:KEYS[table];return parse(localStorage.getItem(key));}
function setLocal(table,value){const key=table==='user_preferences'?PREFKEY:KEYS[table];localStorage.setItem(key,JSON.stringify(value));}
function validate(table,v){if(!v||typeof v!=='object'||Array.isArray(v))return false;if(table==='planner_data')return Array.isArray(v.events)&&Array.isArray(v.tasks)&&!!v.goalLists;if(table==='finance_data')return true;if(table==='efficiency_data')return true;return true;}
async function upload(table,value,oldTimestamp){let query;
 if(oldTimestamp){query=client.from(table).update({data:value}).eq('user_id',user.id).eq('updated_at',oldTimestamp).select('updated_at');}
 else {query=client.from(table).insert({user_id:user.id,data:value}).select('updated_at');}
 const {data,error}=await query;if(error)throw error;if(!data?.length)throw Error('Dữ liệu đám mây đã thay đổi; ngừng đồng bộ để tránh ghi đè.');return data[0].updated_at;
}
async function sync(force=false){if(!user||busy||paused||!navigator.onLine)return;busy=true;status('同步中 / Đang đồng bộ...');try{
 for(const table of [...Object.keys(KEYS),'user_preferences']){
  const current=localValue(table),raw=JSON.stringify(current),remote=await remoteRow(table),prior=baseline[table];
  if(!remote){if(current!==null){const stamp=await upload(table,current,null);baseline[table]=stamp;}lastLocal[table]=raw;continue;}
  if(prior===undefined){if(current!==null&&raw!==JSON.stringify(remote.data)){
    paused=true;status('雲端與本機資料不同 / Dữ liệu máy và đám mây khác nhau');backup();
    const choose=confirm('已下載完整備份。雲端已有不同資料。\nĐã tải bản sao lưu. Nhấn OK để dùng dữ liệu ĐÁM MÂY (thay dữ liệu máy); nhấn Cancel để GIỮ NGUYÊN và dừng đồng bộ.');
    if(!choose){message('Đồng bộ đã tạm dừng; dữ liệu trên máy được giữ nguyên.');return;}
    setLocal(table,remote.data);lastLocal[table]=JSON.stringify(remote.data);baseline[table]=remote.updated_at;paused=false;location.reload();return;
  }
   if(current===null){setLocal(table,remote.data);lastLocal[table]=JSON.stringify(remote.data);if(table==='user_preferences')applyPrefs();else {location.reload();return;}}
   else lastLocal[table]=raw;
   baseline[table]=remote.updated_at;continue;
  }
  const localChanged=raw!==lastLocal[table],remoteChanged=remote.updated_at!==prior;
  if(localChanged&&remoteChanged){paused=true;backup();throw Error('Hai thiết bị đã sửa cùng dữ liệu. Đã tải bản sao lưu; đồng bộ tạm dừng.');}
  if(remoteChanged){if(!validate(table,remote.data))throw Error('Dữ liệu trên mây không hợp lệ: '+table);setLocal(table,remote.data);baseline[table]=remote.updated_at;lastLocal[table]=JSON.stringify(remote.data);if(table==='user_preferences')applyPrefs();else {location.reload();return;}}
  else if(localChanged){if(current!==null){baseline[table]=await upload(table,current,prior);lastLocal[table]=raw;}}
 }
 status('已同步 / Đã đồng bộ · '+new Date().toLocaleTimeString());
 }catch(e){console.error(e);status('同步失敗 / Đồng bộ lỗi: '+e.message)}finally{busy=false;}}
async function initUser(u){user=u;baseline={};lastLocal={};paused=false;showAuth();if(poll)clearInterval(poll);if(u){const owner=localStorage.getItem('cozy-cloud-owner-v1');if(owner&&owner!==u.id){paused=true;status('此瀏覽器已有其他帳號的資料 / Trình duyệt có dữ liệu của tài khoản khác');message('Hãy dùng hồ sơ trình duyệt riêng. Không đồng bộ để tránh lộ dữ liệu giữa các tài khoản.');return;}localStorage.setItem('cozy-cloud-owner-v1',u.id);await sync();poll=setInterval(()=>sync(),4000)}else status('尚未登入 / Chưa đăng nhập');}
async function init(){applyPrefs();$('cozyExportAll').onclick=backup;['cozyLanguage','cozyTheme','cozyReminders'].forEach(id=>$(id).addEventListener('change',setPrefs));
 if(!isConfigured()){status('請先設定 supabase-config.js / Cần điền khóa publishable');message('Chỉ dùng publishable key, tuyệt đối không dùng secret/service_role key.');$('cozyAuthForm').hidden=true;return;}
 client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{detectSessionInUrl:true,autoRefreshToken:true,persistSession:true}});
 $('cozyAuthForm').onsubmit=async e=>{e.preventDefault();const {error}=await client.auth.signInWithPassword({email:$('cozyEmail').value.trim(),password:$('cozyPassword').value});message(error?error.message:'登入成功 / Đăng nhập thành công')};
 $('cozyRegister').onclick=async()=>{const email=$('cozyEmail').value.trim(),password=$('cozyPassword').value;if(!email||password.length<6){message('Nhập email và mật khẩu ít nhất 6 ký tự.');return;}const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});message(error?error.message:'請檢查驗證郵件 / Kiểm tra email xác nhận đăng ký.');};
 $('cozyForgot').onclick=async()=>{const email=$('cozyEmail').value.trim();if(!email){message('Nhập email trước.');return;}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?mode=reset'});message(error?error.message:'若帳號存在，請檢查郵件 / Nếu tài khoản tồn tại, kiểm tra email.');};
 $('cozyChangePassword').onclick=async()=>{const pass=prompt('新密碼 / Mật khẩu mới (ít nhất 6 ký tự)');if(pass===null)return;if(pass.length<6){message('Mật khẩu quá ngắn.');return;}const {error}=await client.auth.updateUser({password:pass});message(error?error.message:'密碼已更新 / Đã đổi mật khẩu.');};
 $('cozyLogout').onclick=async()=>{if(!confirm('登出？/ Đăng xuất? Dữ liệu cục bộ vẫn còn trên máy này.'))return;const {error}=await client.auth.signOut();if(error)message(error.message);else location.reload()};
 $('cozySyncNow').onclick=()=>{paused=false;sync(true)};
 client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){setTimeout(async()=>{const pass=prompt('請設定新密碼 / Nhập mật khẩu mới (ít nhất 6 ký tự)');if(pass&&pass.length>=6){const {error}=await client.auth.updateUser({password:pass});message(error?error.message:'密碼已重設 / Đã đặt lại mật khẩu.')}},200)}if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='INITIAL_SESSION'){if(session?.user?.id!==user?.id)initUser(session?.user||null)}});
 const {data}=await client.auth.getUser();if(data?.user?.id!==user?.id)await initUser(data?.user||null);
}
init().catch(e=>message(e.message));
