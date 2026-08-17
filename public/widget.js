(async () => {
  const script = document.currentScript;
  const api = (script.dataset.apiUrl || new URL(script.src).origin).replace(/\/$/, '');
  let title = script.dataset.title || 'Trợ lý tư vấn';
  let color = script.dataset.color || '#111827';
  let welcomeMessage = 'Xin chào! Tôi có thể giúp gì cho bạn?';
  let commands = [], iconUrl = '', zaloUrl = '', messengerUrl = '', contactIconUrls = {};
  let contactVisibility = { zalo: true, messenger: true, assistant: true };
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
      if (remote.contactVisibility && typeof remote.contactVisibility === 'object') contactVisibility = { zalo: remote.contactVisibility.zalo !== false, messenger: remote.contactVisibility.messenger !== false, assistant: remote.contactVisibility.assistant !== false };
      if (remote.contactIconUrls && typeof remote.contactIconUrls === 'object') contactIconUrls = Object.fromEntries(Object.entries(remote.contactIconUrls).map(([key, value]) => [key, typeof value === 'string' && value ? (value.startsWith('/') ? `${api}${value}` : value) : '']));
      if (typeof remote.iconUrl === 'string' && remote.iconUrl) iconUrl = remote.iconUrl.startsWith('/') ? `${api}${remote.iconUrl}` : remote.iconUrl;
    }
  } catch {}

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,sans-serif';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    *{box-sizing:border-box}button,a,input{font:inherit}.launcher,.contact{border:0;display:flex;align-items:center;justify-content:flex-start;cursor:pointer;overflow:hidden}.launcher{background:#050505;color:#fff;padding:0;box-shadow:0 6px 18px #0003;transition:opacity .18s,transform .18s}.contact-menu{display:flex;position:absolute;right:0;bottom:0;flex-direction:column;gap:10px;align-items:flex-end;visibility:hidden;opacity:0;pointer-events:none;transition:opacity .2s,visibility 0s linear .28s}.contact-menu.show{visibility:visible;opacity:1;pointer-events:auto;transition-delay:0s}.contact-row{display:flex;align-items:center;justify-content:flex-end;width:150px;opacity:0;transform:translateY(12px) scale(.88);transform-origin:right center;transition:opacity .22s,transform .28s cubic-bezier(.2,.8,.2,1)}.contact-menu.show .contact-row{opacity:1;transform:translateY(0) scale(1)}.contact-menu.show .contact-row:nth-child(3){transition-delay:.03s}.contact-menu.show .contact-row:nth-child(2){transition-delay:.08s}.contact-menu.show .contact-row:nth-child(1){transition-delay:.13s}.contact{position:relative;width:45px;height:45px;border-radius:50%;padding:0;text-decoration:none;color:#fff;box-shadow:2px 2px 10px #0003;transition:width .3s,border-radius .3s,transform .1s}.contact:hover{width:150px;border-radius:40px}.contact:active{transform:translate(2px,2px)}.contact.disabled{opacity:.42;cursor:not-allowed}.contact-sign{width:45px;min-width:45px;height:45px;display:flex;align-items:center;justify-content:center;transition:.3s}.contact:hover .contact-sign{width:45px;min-width:45px;padding-left:5px}.contact-sign svg{width:25px;height:25px}.contact-sign svg path{fill:currentColor}.contact-sign img{display:block;width:31px;height:31px;object-fit:contain}.contact-text{position:absolute;right:0;width:0;opacity:0;overflow:hidden;color:#fff;font-size:14px;font-weight:600;white-space:nowrap;text-align:center;transition:.3s}.contact:hover .contact-text{opacity:1;width:105px;padding-right:9px}.zalo{background:#0878d1}.messenger{background:#0084ff}.assistant{background:${color}}.box{display:none;width:min(390px,calc(100vw - 24px));height:min(590px,calc(100vh - 90px));background:#fff;border:0;border-radius:12px;box-shadow:0 18px 50px #0003;overflow:hidden}.head{height:64px;padding:0 16px;background:#fff;color:#171717;font-weight:700;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e8e8e8}.head-icon{width:25px;height:25px;flex:none}.head-title{flex:1;font-size:16px}.close{width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#555;font-size:24px;line-height:1;cursor:pointer}.close:hover{background:#f1f1f1}.msgs{height:calc(100% - 124px);padding:16px;overflow:auto;background:#fff}.m-wrap{display:flex;flex-direction:column;margin:10px 0}.m-wrap.u-wrap{align-items:flex-end}.m-wrap.a-wrap{align-items:flex-start}.time{font-size:11px;color:#777;margin:0 4px 3px}.m{max-width:84%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;line-height:1.4;font-size:14px}.u{background:${color};color:#fff;border-bottom-right-radius:4px}.a{background:#f3f3f5;color:#222;border-bottom-left-radius:4px}.a a{color:#075cc9;text-decoration:underline;overflow-wrap:anywhere}.commands{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.commands a{display:inline-block;padding:8px 10px;border:1px solid ${color};border-radius:999px;color:${color};text-decoration:none;font-size:13px;background:#fff}.form{height:60px;display:flex;align-items:center;padding:8px 10px;border-top:1px solid #e8e8e8;background:#f7f7f8}.form input{flex:1;border:0;outline:0;background:transparent;padding:10px 4px;min-width:0}.form button{width:40px;height:40px;border:0;background:transparent;color:${color};padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}.form button svg{width:25px;height:25px}
  </style><style>
    .launcher{position:relative;width:60px;min-width:60px;height:60px;min-height:60px;border-radius:50%;background:#050505;padding:0;color:#fff;justify-content:center}
    .launcher .contact-mark{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .launcher .contact-mark svg{width:29px;height:29px}
    .zalo .contact-sign svg path,.assistant .contact-sign svg path{fill:none}
    .assistant{background:transparent;box-shadow:none;color:${color}}
    .assistant .contact-sign img{width:45px;height:45px}
    .assistant:hover{background:#fff;box-shadow:2px 2px 10px #0003;color:#171717}
    .assistant:hover .contact-text{color:#171717}
  </style>
  <div class="contact-menu" aria-label="Kênh liên hệ">
    <div class="contact-row" data-channel="zalo"><a class="contact zalo" aria-label="Liên hệ qua Zalo" target="_blank" rel="noopener noreferrer"><span class="contact-sign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5h14v11H9l-4 3V5z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="contact-text">Zalo</span></a></div>
    <div class="contact-row" data-channel="messenger"><a class="contact messenger" aria-label="Liên hệ qua Messenger" target="_blank" rel="noopener noreferrer"><span class="contact-sign"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.92 1.46 5.52 3.74 7.22V22l3.42-1.88c.9.25 1.86.39 2.84.39 5.52 0 10-4.15 10-9.24S17.52 2 12 2zm1 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.62 2.72 4.91-2.72L13 14.48z"/></svg></span><span class="contact-text">Messenger</span></a></div>
    <div class="contact-row" data-channel="assistant"><button class="contact assistant" aria-label="Mở Trợ lý AI"><span class="contact-sign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v12H9l-5 4V5z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg></span><span class="contact-text">Trợ lý AI</span></button></div>
  </div>
  <button class="launcher" aria-label="Mở menu Liên hệ" title="Liên hệ"><span class="contact-mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.2.6 3.4.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.5 21 3 13.5 3 4.2c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.3.6 3.4.1.4 0 .8-.2 1l-2.3 2.2z"/></svg></span></button>
  <section class="box" aria-label="Chatbot"><div class="head"><svg class="head-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v13H9l-5 4V4z"/><path d="M8 9h.01M12 9h.01M16 9h.01"/></svg><span class="head-title"></span><button class="close" aria-label="Đóng">×</button></div><div class="msgs" aria-live="polite"></div><form class="form"><input maxlength="1000" placeholder="Nhập tin nhắn..." aria-label="Câu hỏi"><button aria-label="Gửi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V4M5 11l7-7 7 7"/></svg></button></form></section>`;

  const launcher = shadow.querySelector('.launcher'), menu = shadow.querySelector('.contact-menu'), box = shadow.querySelector('.box');
  const msgs = shadow.querySelector('.msgs'), form = shadow.querySelector('form'), input = shadow.querySelector('input');
  const zalo = shadow.querySelector('.zalo'), messenger = shadow.querySelector('.messenger'), assistant = shadow.querySelector('.assistant');
  for (const [channel, visible] of Object.entries(contactVisibility)) if (!visible) shadow.querySelector(`[data-channel="${channel}"]`)?.remove();
  if (!menu.querySelector('.contact-row')) launcher.style.display = 'none';
  shadow.querySelector('.head-title').textContent = title;
  const configureLink = (element, url) => { if (url) element.href = url; else { element.classList.add('disabled'); element.removeAttribute('href'); element.title = 'Chưa cấu hình URL trong trang admin'; } };
  configureLink(zalo, zaloUrl); configureLink(messenger, messengerUrl);
  const replaceContactIcon = (element, url) => { if (!url) return; const sign = element.querySelector('.contact-sign'); const img = document.createElement('img'); img.src = url; img.alt = ''; sign.textContent = ''; sign.append(img); };
  if (iconUrl) replaceContactIcon(assistant, iconUrl);
  const setContactIcon = replaceContactIcon;
  setContactIcon(zalo, contactIconUrls.zalo); setContactIcon(messenger, contactIconUrls.messenger);

  let history = [], greeted = false;
  const plainText = value => String(value || '').replace(/\*\*(.*?)\*\*/gs, '$1').replace(/__(.*?)__/gs, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/`([^`]+)`/g, '$1');
  const renderWithLinks = (element, value) => {
    const text = plainText(value); element.textContent = ''; const pattern = /https?:\/\/[^\s<>"']+/gi; let cursor = 0;
    for (const match of text.matchAll(pattern)) { element.append(document.createTextNode(text.slice(cursor, match.index))); let href = match[0], trailing = ''; while (/[.,;:!?)]$/.test(href)) { trailing = href.slice(-1) + trailing; href = href.slice(0, -1); } const link = document.createElement('a'); link.href = href; link.textContent = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; element.append(link, document.createTextNode(trailing)); cursor = match.index + match[0].length; }
    element.append(document.createTextNode(text.slice(cursor))); return text;
  };
  const add = (text, cls) => { const wrap = document.createElement('div'); wrap.className = `m-wrap ${cls}-wrap`; const time = document.createElement('span'); time.className = 'time'; time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const el = document.createElement('div'); el.className = `m ${cls}`; el.textContent = text; wrap.append(time, el); msgs.append(wrap); msgs.scrollTop = msgs.scrollHeight; return el; };
  const addCommands = () => { if (!commands.length) return; const wrap = document.createElement('div'); wrap.className = 'commands'; for (const command of commands) { if (!command?.label || !/^https:\/\//i.test(command.url || '')) continue; const link = document.createElement('a'); link.textContent = command.label; link.href = command.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; wrap.append(link); } msgs.append(wrap); };
  const closeMenu = () => { menu.classList.remove('show'); launcher.style.visibility = 'visible'; launcher.style.opacity = '1'; launcher.style.transform = 'scale(1)'; launcher.setAttribute('aria-expanded', 'false'); };
  launcher.onclick = () => { menu.classList.add('show'); launcher.style.visibility = 'hidden'; launcher.style.opacity = '0'; launcher.style.transform = 'scale(.85)'; launcher.setAttribute('aria-expanded', 'true'); };
  assistant.onclick = () => { closeMenu(); launcher.style.display = 'none'; box.style.display = 'block'; if (!greeted) { greeted = true; if (welcomeMessage) add(welcomeMessage, 'a'); addCommands(); } input.focus(); };
  shadow.querySelector('.close').onclick = () => { box.style.display = 'none'; launcher.style.display = 'flex'; closeMenu(); };
  document.addEventListener('click', event => { if (!event.composedPath().includes(host) && menu.classList.contains('show')) closeMenu(); });
  form.onsubmit = async event => {
    event.preventDefault(); const question = input.value.trim(); if (!question) return; input.value = ''; add(question, 'u'); const wait = add('Đang tìm thông tin…', 'a');
    try { const response = await fetch(`${api}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, history }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); const answer = renderWithLinks(wait, data.answer); history = [...history, { role: 'user', content: question }, { role: 'assistant', content: answer }].slice(-6); }
    catch (error) { wait.textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  };
  document.body.append(host);
})();
