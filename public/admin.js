let token = '';
const $ = id => document.getElementById(id);
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers } });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : { error: `Server trả về HTML thay vì JSON (HTTP ${response.status}). Kiểm tra URL backend hoặc log hosting.` };
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function responseData(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return { error: `Server trả về nội dung không hợp lệ (HTTP ${response.status}).` };
}
async function prepareIcon(file) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Chỉ chấp nhận PNG, JPEG, WebP hoặc GIF.');
  const image = new Image(); const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Không thể đọc file ảnh.')); image.src = objectUrl; });
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Không thể xử lý file ảnh.');
    return blob;
  } finally { URL.revokeObjectURL(objectUrl); }
}
function updateSnippet() {
  const base = location.origin;
  $('snippet').value = `<script src="${base}/widget.js?v=2" data-api-url="${base}" defer><\/script>`;
}
function renderFiles(files = []) {
  $('fileList').textContent = '';
  for (const file of files) {
    const row = document.createElement('div'); row.className = 'file-item';
    const label = document.createElement('span'); label.textContent = `${file.name} (${file.characters.toLocaleString()} ký tự)`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Xóa';
    remove.onclick = async () => { if (!confirm(`Xóa tệp ${file.name}?`)) return; await api('/api/admin/knowledge-file', { method: 'DELETE', body: JSON.stringify({ name: file.name }) }); await loadSettingsIntoForm(); };
    row.append(label, remove); $('fileList').append(row);
  }
}
async function loadSettingsIntoForm() {
  const s = await api('/api/admin/settings');
  $('model').value = s.model; $('website').value = s.websiteUrl; $('origins').value = s.origins.join(','); $('title').value = s.botTitle; $('color').value = s.botColor; $('extraUrls').value = (s.extraUrls || []).join('\n'); $('customText').value = s.customText || ''; $('instructions').value = s.botInstructions || ''; $('welcome').value = s.welcomeMessage || ''; $('commands').value = (s.commands || []).map(command => `${command.label} | ${command.url}`).join('\n');
  $('keyHint').textContent = s.hasApiKey ? `Đã lưu key: ${s.apiKeyHint}` : 'Chưa có API key'; $('iconMsg').textContent = s.hasIcon ? 'Đã có icon tùy chỉnh.' : 'Đang dùng icon mặc định.'; renderFiles(s.knowledgeFiles); updateSnippet();
}
$('loginBtn').onclick = async () => {
  token = $('token').value.trim();
  try {
    $('login').style.display = 'none'; $('panel').style.display = 'block';
    await loadSettingsIntoForm();
  } catch (error) { $('loginMsg').className = 'err'; $('loginMsg').textContent = error.message; }
};
$('settings').onsubmit = async event => {
  event.preventDefault();
  try {
    await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ deepseekKey: $('apiKey').value, model: $('model').value, websiteUrl: $('website').value, origins: $('origins').value, botTitle: $('title').value, botColor: $('color').value, extraUrls: $('extraUrls').value, customText: $('customText').value, botInstructions: $('instructions').value, welcomeMessage: $('welcome').value, commands: $('commands').value }) });
    $('apiKey').value = ''; $('msg').className = 'ok'; $('msg').textContent = 'Đã lưu và mã hóa cấu hình.'; updateSnippet();
  } catch (error) { $('msg').className = 'err'; $('msg').textContent = error.message; }
};
$('uploadIcon').onclick = async () => {
  const file = $('iconFile').files[0]; if (!file) return $('iconMsg').textContent = 'Hãy chọn file icon.';
  try { $('uploadIcon').disabled = true; $('iconMsg').textContent = 'Đang tối ưu icon…'; const optimized = await prepareIcon(file); const response = await fetch('/api/admin/icon', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream', 'x-file-type': optimized.type }, body: optimized }); const data = await responseData(response); if (!response.ok) throw new Error(data.error); $('iconMsg').className = 'ok'; $('iconMsg').textContent = 'Upload icon thành công.'; }
  catch (error) { $('iconMsg').className = 'err'; $('iconMsg').textContent = error.message; }
  finally { $('uploadIcon').disabled = false; }
};
$('uploadKnowledge').onclick = async () => {
  const file = $('knowledgeFile').files[0]; if (!file) return $('fileMsg').textContent = 'Hãy chọn file kiến thức.';
  try { $('uploadKnowledge').disabled = true; $('fileMsg').textContent = 'Đang đọc file…'; const response = await fetch('/api/admin/knowledge-file', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) }, body: file }); const data = await responseData(response); if (!response.ok) throw new Error(data.error); $('fileMsg').className = 'ok'; $('fileMsg').textContent = 'Upload thành công. Hãy lập chỉ mục lại.'; await loadSettingsIntoForm(); }
  catch (error) { $('fileMsg').className = 'err'; $('fileMsg').textContent = error.message; }
  finally { $('uploadKnowledge').disabled = false; }
};
$('reindex').onclick = async () => {
  try {
    $('reindex').disabled = true; $('msg').className = ''; $('msg').textContent = 'Đã bắt đầu lập chỉ mục…';
    await api('/api/admin/reindex', { method: 'POST' });
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const state = await api('/api/admin/reindex-status');
      if (state.status === 'completed') { $('msg').className = 'ok'; $('msg').textContent = `Hoàn tất: ${state.result.pages} trang, ${state.result.chunks} đoạn.`; break; }
      if (state.status === 'failed') throw new Error(state.error);
      $('msg').textContent = `Đang lập chỉ mục… bắt đầu lúc ${new Date(state.startedAt).toLocaleTimeString()}`;
    }
  }
  catch (error) { $('msg').className = 'err'; $('msg').textContent = error.message; }
  finally { $('reindex').disabled = false; }
};
$('copy').onclick = async () => { await navigator.clipboard.writeText($('snippet').value); $('copy').textContent = 'Đã copy'; };
['title', 'color'].forEach(id => $(id).oninput = updateSnippet);
