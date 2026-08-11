let token = '';
const $ = id => document.getElementById(id);
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers } });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : { error: `Server trả về HTML thay vì JSON (HTTP ${response.status}). Kiểm tra URL backend hoặc log hosting.` };
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
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
    $('model').value = s.model; $('website').value = s.websiteUrl; $('origins').value = s.origins.join(','); $('title').value = s.botTitle; $('color').value = s.botColor; $('extraUrls').value = (s.extraUrls || []).join('\n'); $('customText').value = s.customText || ''; $('instructions').value = s.botInstructions || '';
    $('keyHint').textContent = s.hasApiKey ? `Đã lưu key: ${s.apiKeyHint}` : 'Chưa có API key'; updateSnippet();
  } catch (error) { $('loginMsg').className = 'err'; $('loginMsg').textContent = error.message; }
};
$('settings').onsubmit = async event => {
  event.preventDefault();
  try {
    await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ deepseekKey: $('apiKey').value, model: $('model').value, websiteUrl: $('website').value, origins: $('origins').value, botTitle: $('title').value, botColor: $('color').value, extraUrls: $('extraUrls').value, customText: $('customText').value, botInstructions: $('instructions').value }) });
    $('apiKey').value = ''; $('msg').className = 'ok'; $('msg').textContent = 'Đã lưu và mã hóa cấu hình.'; updateSnippet();
  } catch (error) { $('msg').className = 'err'; $('msg').textContent = error.message; }
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
