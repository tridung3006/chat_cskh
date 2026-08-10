(async () => {
  const script = document.currentScript;
  const api = (script.dataset.apiUrl || new URL(script.src).origin).replace(/\/$/, '');
  let title = script.dataset.title || 'Trợ lý tư vấn';
  let color = script.dataset.color || '#111827';
  try {
    const response = await fetch(`${api}/api/widget-config`, { cache: 'no-store' });
    if (response.ok) {
      const remote = await response.json();
      if (typeof remote.title === 'string' && remote.title) title = remote.title;
      if (/^#[0-9a-f]{6}$/i.test(remote.color || '')) color = remote.color;
    }
  } catch {}
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,sans-serif';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>*{box-sizing:border-box}button{cursor:pointer}.open{width:56px;height:56px;border:0;border-radius:50%;background:${color};color:white;font-size:24px;box-shadow:0 8px 30px #0003}.box{display:none;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 100px));background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 18px 50px #0003;overflow:hidden}.head{padding:15px;background:${color};color:#fff;font-weight:700;display:flex;justify-content:space-between}.close{border:0;background:transparent;color:#fff;font-size:20px}.msgs{height:calc(100% - 116px);padding:14px;overflow:auto;background:#f7f7f8}.m{margin:8px 0;padding:10px 12px;border-radius:10px;white-space:pre-wrap;line-height:1.4;font-size:14px}.u{background:${color};color:#fff;margin-left:15%}.a{background:#fff;border:1px solid #ddd;margin-right:10%}.form{height:60px;display:flex;padding:9px;gap:7px;border-top:1px solid #ddd}.form input{flex:1;border:1px solid #ccc;border-radius:8px;padding:10px;min-width:0}.form button{border:0;border-radius:8px;background:${color};color:#fff;padding:0 14px}</style><button class="open" aria-label="Mở chatbot">💬</button><section class="box" aria-label="Chatbot"><div class="head"><span></span><button class="close" aria-label="Đóng">×</button></div><div class="msgs" aria-live="polite"></div><form class="form"><input maxlength="1000" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi"><button>Gửi</button></form></section>`;
  shadow.querySelector('.head span').textContent = title;
  const open = shadow.querySelector('.open'), box = shadow.querySelector('.box'), msgs = shadow.querySelector('.msgs'), form = shadow.querySelector('form'), input = shadow.querySelector('input');
  let history = [];
  const add = (text, cls) => { const el = document.createElement('div'); el.className = `m ${cls}`; el.textContent = text; msgs.append(el); msgs.scrollTop = msgs.scrollHeight; return el; };
  open.onclick = () => { open.style.display='none'; box.style.display='block'; input.focus(); };
  shadow.querySelector('.close').onclick = () => { box.style.display='none'; open.style.display='block'; };
  form.onsubmit = async e => {
    e.preventDefault(); const question = input.value.trim(); if (!question) return;
    input.value=''; add(question,'u'); const wait = add('Đang tìm thông tin…','a');
    try {
      const response = await fetch(`${api}/api/chat`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question,history}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      wait.textContent = data.answer; history = [...history,{role:'user',content:question},{role:'assistant',content:data.answer}].slice(-6);
    } catch (err) { wait.textContent = err.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  };
  document.body.append(host);
})();
