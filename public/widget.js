(async () => {
  const script = document.currentScript;
  const api = (script.dataset.apiUrl || new URL(script.src).origin).replace(/\/$/, '');
  let title = script.dataset.title || 'Trợ lý tư vấn';
  let color = script.dataset.color || '#111827';
  let welcomeMessage = 'Xin chào! Tôi có thể giúp gì cho bạn?';
  let commands = [];
  let iconUrl = '';
  try {
    const response = await fetch(`${api}/api/widget-config`, { cache: 'no-store' });
    if (response.ok) {
      const remote = await response.json();
      if (typeof remote.title === 'string' && remote.title) title = remote.title;
      if (/^#[0-9a-f]{6}$/i.test(remote.color || '')) color = remote.color;
      if (typeof remote.welcomeMessage === 'string') welcomeMessage = remote.welcomeMessage;
      if (Array.isArray(remote.commands)) commands = remote.commands;
      if (typeof remote.iconUrl === 'string' && remote.iconUrl) iconUrl = remote.iconUrl.startsWith('/') ? `${api}${remote.iconUrl}` : remote.iconUrl;
    }
  } catch {}
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,sans-serif';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>*{box-sizing:border-box}button{cursor:pointer}.open{width:62px;height:62px;border:0;border-radius:50%;background:${color};color:white;font-size:24px;box-shadow:0 8px 30px #0003;overflow:hidden;padding:0}.open.has-icon{background:transparent;box-shadow:none}.open img{width:100%;height:100%;object-fit:contain}.box{display:none;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 100px));background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 18px 50px #0003;overflow:hidden}.head{padding:15px;background:${color};color:#fff;font-weight:700;display:flex;justify-content:space-between}.close{border:0;background:transparent;color:#fff;font-size:20px}.msgs{height:calc(100% - 116px);padding:14px;overflow:auto;background:#f7f7f8}.m{margin:8px 0;padding:10px 12px;border-radius:10px;white-space:pre-wrap;line-height:1.4;font-size:14px}.u{background:${color};color:#fff;margin-left:15%}.a{background:#fff;border:1px solid #ddd;margin-right:10%}.a a{color:#075cc9;text-decoration:underline;overflow-wrap:anywhere}.commands{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.commands a{display:inline-block;padding:8px 10px;border:1px solid ${color};border-radius:999px;color:${color};text-decoration:none;font-size:13px;background:#fff}.form{height:60px;display:flex;padding:9px;gap:7px;border-top:1px solid #ddd}.form input{flex:1;border:1px solid #ccc;border-radius:8px;padding:10px;min-width:0}.form button{border:0;border-radius:8px;background:${color};color:#fff;padding:0 14px}</style><button class="open" aria-label="Mở chatbot">💬</button><section class="box" aria-label="Chatbot"><div class="head"><span></span><button class="close" aria-label="Đóng">×</button></div><div class="msgs" aria-live="polite"></div><form class="form"><input maxlength="1000" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi"><button>Gửi</button></form></section>`;
  shadow.querySelector('.head span').textContent = title;
  const open = shadow.querySelector('.open'), box = shadow.querySelector('.box'), msgs = shadow.querySelector('.msgs'), form = shadow.querySelector('form'), input = shadow.querySelector('input');
  if (iconUrl) { const img = document.createElement('img'); img.src = iconUrl; img.alt = ''; open.classList.add('has-icon'); open.textContent = ''; open.append(img); }
  let history = [];
  let greeted = false;
  const plainText = value => String(value || '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1');
  const renderWithLinks = (element, value) => {
    const text = plainText(value);
    element.textContent = '';
    const urlPattern = /https?:\/\/[^\s<>"']+/gi;
    let cursor = 0;
    for (const match of text.matchAll(urlPattern)) {
      element.append(document.createTextNode(text.slice(cursor, match.index)));
      let href = match[0];
      let trailing = '';
      while (/[.,;:!?)]$/.test(href)) { trailing = href.slice(-1) + trailing; href = href.slice(0, -1); }
      const link = document.createElement('a');
      link.href = href; link.textContent = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      element.append(link, document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }
    element.append(document.createTextNode(text.slice(cursor)));
    return text;
  };
  const add = (text, cls) => { const el = document.createElement('div'); el.className = `m ${cls}`; el.textContent = text; msgs.append(el); msgs.scrollTop = msgs.scrollHeight; return el; };
  const addCommands = () => { if (!commands.length) return; const wrap = document.createElement('div'); wrap.className = 'commands'; for (const command of commands) { if (!command?.label || !/^https:\/\//i.test(command.url || '')) continue; const link = document.createElement('a'); link.textContent = command.label; link.href = command.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; wrap.append(link); } msgs.append(wrap); };
  open.onclick = () => { open.style.display='none'; box.style.display='block'; if (!greeted) { greeted = true; if (welcomeMessage) add(welcomeMessage, 'a'); addCommands(); } input.focus(); };
  shadow.querySelector('.close').onclick = () => { box.style.display='none'; open.style.display='block'; };
  form.onsubmit = async e => {
    e.preventDefault(); const question = input.value.trim(); if (!question) return;
    input.value=''; add(question,'u'); const wait = add('Đang tìm thông tin…','a');
    try {
      const response = await fetch(`${api}/api/chat`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question,history}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const displayedAnswer = renderWithLinks(wait, data.answer); history = [...history,{role:'user',content:question},{role:'assistant',content:displayedAnswer}].slice(-6);
    } catch (err) { wait.textContent = err.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  };
  document.body.append(host);
})();
