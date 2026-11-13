// Shared helpers used by every page
const $ = s => document.querySelector(s), U = n => Number(n || 0).toLocaleString();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lab = i => i.name + (i.color ? ' ' + i.color : '') + (i.len ? ' ' + i.len + '"' : '');
async function api(url, method = 'GET', body) {
  const r = await fetch('/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status == 401 && !location.pathname.startsWith('/login')) location = '/login';
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j;
}
function toast(m) { const t = $('#T'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', 2800); }
// form(title, [{k,l,v,type}], async values => ..., deleteFn?)
function form(title, fs, ok, del) {
  $('#M').innerHTML = `<div class=mb><div class=md><h3>${esc(title)}</h3>${fs.map(f => `<label>${f.l}<input id=f_${f.k} type=${f.type || 'text'} value="${esc(f.v)}"></label>`).join('')}<div class=row>${del ? '<button class=bad id=del>Delete</button>' : ''}<button onclick="$('#M').innerHTML=''">Cancel</button><button class=pri id=ok>Save</button></div></div></div>`;
  $('#ok').onclick = async () => { const v = {}; fs.forEach(f => v[f.k] = $('#f_' + f.k).value); try { await ok(v); $('#M').innerHTML = ''; } catch (e) { toast(e.message); } };
  if (del) $('#del').onclick = async () => { try { await del(); $('#M').innerHTML = ''; } catch (e) { toast(e.message); } };
}
async function logout() { await api('logout', 'POST'); location = '/login'; }
function changePassword() {
  form('Change my password', [{ k: 'old', l: 'Current password', type: 'password' }, { k: 'new', l: 'New password (6+ characters)', type: 'password' }],
    async v => { await api('password', 'POST', v); toast('Password changed'); });
}
