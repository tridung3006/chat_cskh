let token = '';
const $ = id => document.getElementById(id);
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}
function updateSnippet() {
  const base = location.origin;
  $('snippet').value = `<script src="${base}/widget.js?v=2" data-api-url="${base}" defer><\/script>`;
}
$('loginBtn').onclick = async () => {
  token = $('token').value.trim();
  try {
    const s = await api('/api/admin/settings');
    $('login').style.display = 'none'; $('panel').style.display = 'block';
    $('model').value = s.model; $('website').value = s.websiteUrl; $('origins').value = s.origins.join(','); $('title').value = s.botTitle; $('color').value = s.botColor;
    $('keyHint').textContent = s.hasApiKey ? `Đã lưu key: ${s.apiKeyHint}` : 'Chưa có API key'; updateSnippet();
  } catch (error) { $('loginMsg').className = 'err'; $('loginMsg').textContent = error.message; }
};
$('settings').onsubmit = async event => {
  event.preventDefault();
  try {
    await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ deepseekKey: $('apiKey').value, model: $('model').value, websiteUrl: $('website').value, origins: $('origins').value, botTitle: $('title').value, botColor: $('color').value }) });
    $('apiKey').value = ''; $('msg').className = 'ok'; $('msg').textContent = 'Đã lưu và mã hóa cấu hình.'; updateSnippet();
  } catch (error) { $('msg').className = 'err'; $('msg').textContent = error.message; }
};
$('reindex').onclick = async () => {
  try { $('msg').textContent = 'Đang lập chỉ mục…'; const d = await api('/api/admin/reindex', { method: 'POST' }); $('msg').className = 'ok'; $('msg').textContent = `Hoàn tất: ${d.pages} trang, ${d.chunks} đoạn.`; }
  catch (error) { $('msg').className = 'err'; $('msg').textContent = error.message; }
};
$('copy').onclick = async () => { await navigator.clipboard.writeText($('snippet').value); $('copy').textContent = 'Đã copy'; };
['title', 'color'].forEach(id => $(id).oninput = updateSnippet);
