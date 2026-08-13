(async () => {
  const script = document.currentScript;
  const api = (script.dataset.apiUrl || new URL(script.src).origin).replace(/\/$/, '');
  let title = script.dataset.title || 'Trợ lý tư vấn';
  let color = script.dataset.color || '#111827';
  let welcomeMessage = 'Xin chào! Tôi có thể giúp gì cho bạn?';
  let commands = [], iconUrl = '', zaloUrl = '', messengerUrl = '', contactIconUrls = {};
  try {
    const response = await fetch(`${api}/api/widget-config`, { cache: 'no-store' });
    if (response.ok) {
      const remote = await response.json();
      if (typeof remote.title === 'string' && remote.title) title = remote.title;
      if (/^#[0-9a-f]{6}$/i.test(remote.color || '')) color = remote.color;
      if (typeof remote.welcomeMessage === 'string') welcomeMessage = remote.welcomeMessage;
      if (Array.isArray(remote.commands)) commands = remote.commands;
      if (/^https:\/\//i.test(remote.zaloUrl || '')) zaloUrl = remote.zaloUrl;
      if (/^https:\/\//i.test(remote.messengerUrl || '')) messengerUrl = remote.messengerUrl;
      if (remote.contactIconUrls && typeof remote.contactIconUrls === 'object') contactIconUrls = Object.fromEntries(Object.entries(remote.contactIconUrls).map(([key, value]) => [key, typeof value === 'string' && value ? (value.startsWith('/') ? `${api}${value}` : value) : '']));
      if (typeof remote.iconUrl === 'string' && remote.iconUrl) iconUrl = remote.iconUrl.startsWith('/') ? `${api}${remote.iconUrl}` : remote.iconUrl;
    }
  } catch {}

  if (!document.getElementById('chatbot-hide-old-contact')) {
    const style = document.createElement('style');
    style.id = 'chatbot-hide-old-contact';
    style.textContent = '.boo-support-sticky{display:none!important}';
    document.head.append(style);
  }

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,sans-serif';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    *{box-sizing:border-box}button,a{font:inherit}.launcher,.contact{width:62px;height:62px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px #0003;overflow:hidden}.launcher{flex-direction:column;background:#050505;color:#fff;padding:5px;font-weight:700}.launcher svg{width:25px;height:25px}.launcher span{font-size:10px;line-height:1}.launcher img,.contact img{width:100%;height:100%;object-fit:contain}.launcher.custom{background:transparent;padding:0;box-shadow:none}.launcher .x{display:none;font-size:31px;font-weight:300;line-height:1}.launcher.expanded{background:#050505;box-shadow:0 6px 18px #0003}.launcher.expanded .contact-mark{display:none}.launcher.expanded .x{display:block}.contact-menu{display:none;position:absolute;right:0;bottom:72px;flex-direction:column;gap:10px;align-items:flex-end}.contact-menu.show{display:flex}.contact-row{display:flex;align-items:center;gap:9px}.contact-label{background:#fff;color:#222;border:1px solid #ddd;border-radius:7px;padding:6px 9px;font-size:12px;font-weight:650;box-shadow:0 3px 12px #0002;white-space:nowrap}.contact{padding:0;text-decoration:none;color:#fff}.contact.disabled{opacity:.42;cursor:not-allowed}.zalo{background:#0878d1;font-weight:800;font-size:15px}.messenger{background:#2864dc}.messenger svg{width:29px}.assistant{background:#fff}.assistant .fallback{color:${color};font-size:27px}.box{display:none;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 100px));background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 18px 50px #0003;overflow:hidden}.head{padding:15px;background:${color};color:#fff;font-weight:700;display:flex;justify-content:space-between}.close{border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer}.msgs{height:calc(100% - 116px);padding:14px;overflow:auto;background:#f7f7f8}.m{margin:8px 0;padding:10px 12px;border-radius:10px;white-space:pre-wrap;line-height:1.4;font-size:14px}.u{background:${color};color:#fff;margin-left:15%}.a{background:#fff;border:1px solid #ddd;margin-right:10%}.a a{color:#075cc9;text-decoration:underline;overflow-wrap:anywhere}.commands{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.commands a{display:inline-block;padding:8px 10px;border:1px solid ${color};border-radius:999px;color:${color};text-decoration:none;font-size:13px;background:#fff}.form{height:60px;display:flex;padding:9px;gap:7px;border-top:1px solid #ddd}.form input{flex:1;border:1px solid #ccc;border-radius:8px;padding:10px;min-width:0}.form button{border:0;border-radius:8px;background:${color};color:#fff;padding:0 14px;cursor:pointer}@media(max-width:600px){.contact-label{display:none}}
  </style><style>.launcher .contact-mark{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}</style>
  <div class="contact-menu" aria-label="Kênh liên hệ">
    <div class="contact-row"><span class="contact-label">Zalo</span><a class="contact zalo" aria-label="Liên hệ qua Zalo" target="_blank" rel="noopener noreferrer">Zalo</a></div>
    <div class="contact-row"><span class="contact-label">Messenger</span><a class="contact messenger" aria-label="Liên hệ qua Messenger" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.92 1.46 5.52 3.74 7.22V22l3.42-1.88c.9.25 1.86.39 2.84.39 5.52 0 10-4.15 10-9.24S17.52 2 12 2zm1 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.62 2.72 4.91-2.72L13 14.48z"/></svg></a></div>
    <div class="contact-row"><span class="contact-label">Trợ lý AI</span><button class="contact assistant" aria-label="Mở Trợ lý AI"><span class="fallback">💬</span></button></div>
  </div>
  <button class="launcher" aria-label="Mở menu Liên hệ"><span class="contact-mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.2.6 3.4.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.5 21 3 13.5 3 4.2c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.3.6 3.4.1.4 0 .8-.2 1l-2.3 2.2z"/></svg><span>Liên hệ</span></span><span class="x">×</span></button>
  <section class="box" aria-label="Chatbot"><div class="head"><span></span><button class="close" aria-label="Đóng">×</button></div><div class="msgs" aria-live="polite"></div><form class="form"><input maxlength="1000" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi"><button>Gửi</button></form></section>`;

  const launcher = shadow.querySelector('.launcher'), menu = shadow.querySelector('.contact-menu'), box = shadow.querySelector('.box');
  const msgs = shadow.querySelector('.msgs'), form = shadow.querySelector('form'), input = shadow.querySelector('input');
  const zalo = shadow.querySelector('.zalo'), messenger = shadow.querySelector('.messenger'), assistant = shadow.querySelector('.assistant');
  shadow.querySelector('.head span').textContent = title;
  const configureLink = (element, url) => { if (url) element.href = url; else { element.classList.add('disabled'); element.removeAttribute('href'); element.title = 'Chưa cấu hình URL trong trang admin'; } };
  configureLink(zalo, zaloUrl); configureLink(messenger, messengerUrl);
  if (iconUrl) { const img = document.createElement('img'); img.src = iconUrl; img.alt = ''; assistant.textContent = ''; assistant.append(img); }
  const setContactIcon = (element, url) => { if (!url) return; const img = document.createElement('img'); img.src = url; img.alt = ''; element.textContent = ''; element.append(img); };
  setContactIcon(zalo, contactIconUrls.zalo); setContactIcon(messenger, contactIconUrls.messenger);
  if (contactIconUrls.launcher) { const mark = shadow.querySelector('.contact-mark'); setContactIcon(mark, contactIconUrls.launcher); launcher.classList.add('custom'); }

  let history = [], greeted = false;
  const plainText = value => String(value || '').replace(/\*\*(.*?)\*\*/gs, '$1').replace(/__(.*?)__/gs, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/`([^`]+)`/g, '$1');
  const renderWithLinks = (element, value) => {
    const text = plainText(value); element.textContent = ''; const pattern = /https?:\/\/[^\s<>"']+/gi; let cursor = 0;
    for (const match of text.matchAll(pattern)) { element.append(document.createTextNode(text.slice(cursor, match.index))); let href = match[0], trailing = ''; while (/[.,;:!?)]$/.test(href)) { trailing = href.slice(-1) + trailing; href = href.slice(0, -1); } const link = document.createElement('a'); link.href = href; link.textContent = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; element.append(link, document.createTextNode(trailing)); cursor = match.index + match[0].length; }
    element.append(document.createTextNode(text.slice(cursor))); return text;
  };
  const add = (text, cls) => { const el = document.createElement('div'); el.className = `m ${cls}`; el.textContent = text; msgs.append(el); msgs.scrollTop = msgs.scrollHeight; return el; };
  const addCommands = () => { if (!commands.length) return; const wrap = document.createElement('div'); wrap.className = 'commands'; for (const command of commands) { if (!command?.label || !/^https:\/\//i.test(command.url || '')) continue; const link = document.createElement('a'); link.textContent = command.label; link.href = command.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; wrap.append(link); } msgs.append(wrap); };
  const closeMenu = () => { menu.classList.remove('show'); launcher.classList.remove('expanded'); launcher.setAttribute('aria-expanded', 'false'); };
  launcher.onclick = () => { const show = !menu.classList.contains('show'); menu.classList.toggle('show', show); launcher.classList.toggle('expanded', show); launcher.setAttribute('aria-expanded', String(show)); };
  assistant.onclick = () => { closeMenu(); launcher.style.display = 'none'; box.style.display = 'block'; if (!greeted) { greeted = true; if (welcomeMessage) add(welcomeMessage, 'a'); addCommands(); } input.focus(); };
  shadow.querySelector('.close').onclick = () => { box.style.display = 'none'; launcher.style.display = 'flex'; closeMenu(); };
  document.addEventListener('click', event => { if (!event.composedPath().includes(host)) closeMenu(); });
  form.onsubmit = async event => {
    event.preventDefault(); const question = input.value.trim(); if (!question) return; input.value = ''; add(question, 'u'); const wait = add('Đang tìm thông tin…', 'a');
    try { const response = await fetch(`${api}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, history }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); const answer = renderWithLinks(wait, data.answer); history = [...history, { role: 'user', content: question }, { role: 'assistant', content: answer }].slice(-6); }
    catch (error) { wait.textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  };
  document.body.append(host);
})();
