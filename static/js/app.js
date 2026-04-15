let currentChatId   = null;
let currentModel    = 'flash';
if (!localStorage.getItem('averon-search-reset-v2')) {
  localStorage.setItem('averon-search', 'false');
  localStorage.setItem('averon-search-reset-v2', '1');
}
let searchOn        = localStorage.getItem('averon-search') === 'true';
let docsOn          = localStorage.getItem('averon-docs') === 'true';
let allChats        = [];
let ctxChatId       = null;
let streaming       = false;
let abortController = null;
let attachedFiles   = [];
let lastSearchResults = null;

const main       = document.getElementById('main');
const messages   = document.getElementById('messages');
const welcome    = document.getElementById('welcome');
const bottomBar  = document.getElementById('bottomBar');
const scrollArea = document.getElementById('scrollArea');
const msgInputW  = document.getElementById('msgInputW');
const msgInput   = document.getElementById('msgInput');
const sendBtnW   = document.getElementById('sendBtnW');
const sendBtn    = document.getElementById('sendBtn');
const stopBtn    = document.getElementById('stopBtn');
const userMenu   = document.getElementById('userMenu');
const ctxMenu    = document.getElementById('ctxMenu');
const modelDropTopbar = document.getElementById('modelDropTopbar');
const modelLabelTopbar = document.getElementById('modelLabelTopbar');
const modelDropTopbarMobile = document.getElementById('modelDropTopbarMobile');
const modelLabelTopbarMobile = document.getElementById('modelLabelTopbarMobile');
const searchStrip  = document.getElementById('searchStrip');
const searchStripW = document.getElementById('searchStripW');
const docsStrip    = document.getElementById('docsStrip');
const docsStripW   = document.getElementById('docsStripW');

const isGuest = !!window.AVERON_GUEST;

const MODEL_NAMES = { flash: 'Flash', codex: 'Codex', heavy: 'Heavy' };
const PLACEHOLDERS = [
  'Спросите что угодно',
  'Напиши код на Python',
  'Объясни нейросети',
  'Помоги с домашкой',
  'Создай SQL запрос',
  'Проанализируй данные',
  'Напиши историю',
  'Решите задачу по математике',
  'Оптимизируй алгоритм',
  'Сделай README для проекта',
  'Переведи текст',
  'Придумай идею для стартапа',
  'Сравни две технологии',
  'Найди ошибку в коде'
];
let placeholderInterval = null;
let placeholderIndex = 0;

const TOKEN_LIMITS = { flash: 8000, codex: 4000 };
function estimateTokens(text) {
  return Math.ceil((text || '').length / 3.5);
}
function updateTokenCounter(inputEl) {
  const counters = document.querySelectorAll('.token-counter-wrap');
  if (!counters.length) return;
  const text = inputEl ? inputEl.value : '';
  const tokens = estimateTokens(text);
  const limit = TOKEN_LIMITS[currentModel] || 8000;
  const pct = Math.min(tokens / limit, 1);
  const color = pct > 0.9 ? '#ef4444' : pct > 0.7 ? '#f59e0b' : 'var(--accent)';
  const r = 10, circ = 2 * Math.PI * r;
  const dash = circ * pct;
  counters.forEach(wrap => {
    const ring = wrap.querySelector('.tc-ring');
    const label = wrap.querySelector('.tc-label');
    if (!ring || !label) return;
    ring.style.strokeDasharray = `${dash.toFixed(2)} ${circ.toFixed(2)}`;
    ring.style.stroke = color;
    wrap.dataset.tokens = tokens;
    wrap.dataset.limit = limit;
    label.textContent = tokens > 999 ? Math.round(tokens/1000)+'k' : tokens;
    label.style.color = color;
    wrap.style.opacity = tokens > 0 ? '1' : '0.35';
  });
}

const GUEST_MSG_LIMIT = 10;
let guestMsgCount = parseInt(localStorage.getItem('averon-guest-msgs') || '0', 10);
function incrementGuestMsgCount() {
  guestMsgCount++;
  localStorage.setItem('averon-guest-msgs', guestMsgCount);
}
function showGuestLimitModal() {
  const existing = document.getElementById('guestLimitModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'guestLimitModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
    display:flex;align-items:center;justify-content:center;padding:20px;
    animation:fadeIn .2s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--bg2);border:1px solid var(--border2);
      border-radius:20px;padding:40px 36px;max-width:420px;width:100%;
      box-shadow:0 24px 80px rgba(0,0,0,0.6);
      text-align:center;animation:modalIn .25s cubic-bezier(.34,1.3,.64,1) both;
    ">
      <div style="
        width:64px;height:64px;border-radius:50%;
        background:var(--accent-dim);border:2px solid var(--accent);
        display:flex;align-items:center;justify-content:center;
        margin:0 auto 20px;font-size:28px;
      ">✨</div>
      <h2 style="font-size:22px;font-weight:700;color:var(--text);margin:0 0 10px;">Лимит исчерпан</h2>
      <p style="font-size:14px;color:var(--text3);line-height:1.6;margin:0 0 28px;">
        Вы использовали все <strong style="color:var(--text)">${GUEST_MSG_LIMIT} бесплатных сообщений</strong>.
        Создайте аккаунт — это бесплатно и займёт 30 секунд.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button onclick="window.location.href='/register'" style="
          width:100%;padding:14px;background:var(--accent);
          color:#fff;border:none;border-radius:12px;
          font-size:15px;font-weight:600;cursor:pointer;
          transition:opacity .15s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          Создать аккаунт — бесплатно
        </button>
        <button onclick="window.location.href='/login'" style="
          width:100%;padding:13px;background:transparent;
          color:var(--text2);border:1px solid var(--border2);
          border-radius:12px;font-size:14px;cursor:pointer;
          transition:all .15s;
        " onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
          Войти в аккаунт
        </button>
      </div>
      <p style="font-size:12px;color:var(--text3);margin:16px 0 0;">
        После регистрации — безлимитный доступ к Flash
      </p>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

marked.use({
  breaks: true,
  gfm: true
});
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((res, rej) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy') ? res() : rej(); } catch(e) { rej(e); }
    document.body.removeChild(ta);
  });
}
async function init() {
  applyStoredTheme();
  initReasoningButton();
  if (!isGuest) {
    await loadSettings();
    await loadChats();
    await loadModelsInfo();
    await pruneEmptyChats();
  } else {
    const el = document.getElementById('chatsList');
    if (el) {
      el.innerHTML = '<div style="text-align:center;padding:24px 8px;color:var(--text3);font-size:13px;">Чтобы видеть ваши чаты — войдите</div>';
    }
  }
  bindEvents();
  handleRouting();
  window.addEventListener('popstate', handleRouting);

  // Render MathJax for all messages after page load
  const renderMathJax = () => {
    if (window.MathJax && window.MathJax.typesetPromise && window._mathJaxReady) {
      window.MathJax.typesetPromise([document.getElementById('messages')]).catch(() => {});
    }
  };
  setTimeout(renderMathJax, 500);
  setTimeout(renderMathJax, 1000);
  setTimeout(renderMathJax, 2000);
  setTimeout(renderMathJax, 3000);

  if (isGuest) {
    setupGuestUI();
  }

  const smokeEnabled = localStorage.getItem('averon-smoke') !== 'false';
  applySmokeSetting(smokeEnabled);

  setTimeout(() => {
    startPlaceholderAnimation();
  }, 100);
}

function setupGuestUI() {
  const goLogin = () => { window.location.href = '/login'; };

  [msgInputW, msgInput].forEach(inp => {
    if (!inp) return;
    inp.disabled = true;
  });

  ['attachBtnW', 'attachBtnChat', 'searchToggleW', 'searchToggle', 'newChatBtn', 'newChatBtnMobile', 'searchNavBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'none';
  });

  [sendBtnW, sendBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.add('active');
    btn.style.width = 'auto';
    btn.style.padding = '0 14px';
    btn.style.borderRadius = '999px';
    btn.innerHTML = 'Войти';
    btn.addEventListener('click', goLogin);
  });
}

function initReasoningButton() {
  window.reasoningEnabled = false;
  const btn = document.getElementById('reasoningToggle');
  const btnW = document.getElementById('reasoningToggleW');
  
  [btn, btnW].forEach(button => {
    if (!button) return;
    button.addEventListener('click', () => {
      window.reasoningEnabled = !window.reasoningEnabled;
      button.classList.toggle('deepthink-active', window.reasoningEnabled);
      [btn, btnW].forEach(b => {
        if (b && b !== button) {
          b.classList.toggle('deepthink-active', window.reasoningEnabled);
        }
      });
      localStorage.setItem('averon-reasoning', window.reasoningEnabled);
    });
  });

  window.updateReasoningButton = function(model) {
    if (model !== 'codex') {};
    [btn, btnW].forEach(button => {
      if (button) {
        if (model === 'codex') {
          button.style.setProperty('display', 'none', 'important');
        } else {
          button.style.removeProperty('display');
        }
      }
    });
    window.reasoningEnabled = localStorage.getItem('averon-reasoning') === 'true';
    [btn, btnW].forEach(button => {
      if (button && model !== 'codex') {
        button.classList.toggle('deepthink-active', window.reasoningEnabled);
      }
    });
  };

  // Safeguard: re-apply every 300ms if codex is selected
  setInterval(() => {
    if (currentModel === 'codex') {
      [btn, btnW].forEach(button => {
        if (button && button.style.display !== 'none') {
          button.style.setProperty('display', 'none', 'important');
        }
      });
    }
  }, 300);
  window.updateReasoningButton(currentModel);
}
function applyStoredTheme() {
  (function(){
    const saved = localStorage.getItem('averon-theme') || 'system'; 
    applyTheme(saved);
    const accent = localStorage.getItem('averon-accent');
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.12)`);
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === accent));
    }
    const csTheme = document.getElementById('csTheme');
    if (csTheme) {
      const label = csTheme.querySelector('.cs-label');
      const input = csTheme.querySelector('input[type="hidden"]');
      if (saved === 'system') {
        label.textContent = 'Системный';
        input.value = 'system';
      } else if (saved === 'dark') {
        label.textContent = 'Тёмная';
        input.value = 'dark';
      } else if (saved === 'light') {
        label.textContent = 'Светлая';
        input.value = 'light';
      }
    }
  })();
}
function showReasoning(msgEl, delta) {
  if (!msgEl) return;
  const msgText = msgEl.querySelector('.msg-text');
  if (!msgText) return;

  let section = msgEl.querySelector('.reasoning-section');

  if (!section) {
    section = document.createElement('div');
    section.className = 'reasoning-section streaming';
    section.innerHTML = `
      <div class="reasoning-header open" onclick="toggleReasoningSection(this)">
        <svg class="thinking-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="shimmer-grad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stop-color="#6b7bff" stop-opacity="0.3"/>
              <stop offset="50%"  stop-color="#c0c8ff" stop-opacity="1"/>
              <stop offset="100%" stop-color="#6b7bff" stop-opacity="0.3"/>
              <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="1.4s" repeatCount="indefinite"/>
            </linearGradient>
          </defs>
          <path fill="url(#shimmer-grad)" fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z"/>
        </svg>
        <span class="reasoning-label">Размышление</span>
        <svg class="reasoning-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
      <div class="reasoning-body open">
        <div class="reasoning-text-wrap">
          <div class="reasoning-text"></div>
        </div>
      </div>
    `;
    msgEl.insertBefore(section, msgText);
    section._startTime = Date.now();
    section._stepCount = 0;
  }
  section._stepCount = (section._stepCount || 0) + 1;
  const labelEl = section.querySelector('.reasoning-label');
  const textEl = section.querySelector('.reasoning-text');
  if (labelEl) {
    const elapsedMs = section._startTime ? (Date.now() - section._startTime) : 0;
    const elapsedSec = Math.round(elapsedMs / 1000);
    const timeLabel = elapsedSec === 1 
      ? '1 секунд' 
      : elapsedSec < 60 
        ? `${elapsedSec} секунд` 
        : `${Math.floor(elapsedSec / 60)}м ${elapsedSec % 60}с`;
    labelEl.textContent = `Думал ${timeLabel}`;
  }
  if (textEl && delta) {
    textEl.textContent += delta;
  }
}
function finalizeReasoning(msgEl, reasoningTimeMs = null) {
  if (!msgEl) return;
  const section = msgEl.querySelector('.reasoning-section');
  if (!section) return;

  section.classList.remove('streaming');
  const elapsedMs = reasoningTimeMs !== null ? reasoningTimeMs : (section._startTime ? (Date.now() - section._startTime) : 0);
  const elapsedSec = Math.round(elapsedMs / 1000);
  const timeLabel = elapsedSec === 1 
    ? '1 секунд' 
    : elapsedSec < 60 
      ? `${elapsedSec} секунд` 
      : `${Math.floor(elapsedSec / 60)}м ${elapsedSec % 60}с`;
  const labelEl = section.querySelector('.reasoning-label');
  if (labelEl) {
    labelEl.textContent = `Думал ${timeLabel}`;
  }
  const brainIcon = section.querySelector('.reasoning-brain-icon');
  if (brainIcon) {
    brainIcon.classList.remove('pulse');
  }
  section.dataset.finalized = '1';

  // Collapse the body after finalization
  const body = section.querySelector('.reasoning-body');
  const header = section.querySelector('.reasoning-header');
  if (body && header) {
    header.classList.remove('open');
    body.classList.remove('open');
    body.style.maxHeight = '0';
  }
}

window.toggleReasoningSection = function(header) {
  const section = header.closest('.reasoning-section');
  if (!section || (!section.dataset.finalized && section.classList.contains('streaming'))) return;

  const body = section.querySelector('.reasoning-body');
  if (!body) return;
  
  const isOpen = body.classList.contains('open');
  
  if (isOpen) {
    header.classList.remove('open');
    body.classList.remove('open');
    body.style.maxHeight = '0';
  } else {
    header.classList.add('open');
    body.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    header.classList.add('open');
  }
};
function handleRouting() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  let id = null;

  if (window.INITIAL_CHAT_ID && window.INITIAL_CHAT_ID !== 'None' && window.INITIAL_CHAT_ID !== 'null') {
    id = window.INITIAL_CHAT_ID;
    window.INITIAL_CHAT_ID = null;
  } else if (path.startsWith('/c/')) {
    id = path.slice(3).split('/')[0];
  } else if (hash.startsWith('#/chat/')) {
    id = hash.slice(7);
  }

  if (id && id !== 'None' && id !== 'null') {
    openChat(id, true);
    return;
  }
  
  showWelcome();
}

function setChatUrl(id, title) {
  history.pushState({ chatId: id }, title || 'Averon AI', `/c/${id}`);
  document.title = title ? `${title} — Averon AI` : 'Averon AI';
}
function updatePageTitle(title) {
  document.title = title ? `${title} — Averon AI` : 'Averon AI';
  const el = document.getElementById('topbarTitle');
  if (el) el.textContent = title || 'Averon AI';
  
  const chatTitleDisplay = document.getElementById('chatTitleDisplay');
  const chatTitleText = document.getElementById('chatTitleText');
  const chatTitleShimmer = document.getElementById('chatTitleShimmer');
  const modelPickTopbar = document.getElementById('modelPickTopbar');
  
  if (chatTitleDisplay && chatTitleText && modelPickTopbar) {
    chatTitleDisplay.classList.remove('chat-title-shimmer-mode', 'chat-title-shimmer-exit');
    chatTitleShimmer?.classList.remove('visible');
    chatTitleText.style.cssText = '';
    if (title && title !== 'Averon AI') {
      chatTitleText.textContent = title;
      chatTitleDisplay.style.display = 'flex';
      modelPickTopbar.style.margin = '0';
    } else {
      chatTitleDisplay.style.display = 'none';
      modelPickTopbar.style.margin = '0 auto';
    }
  }
}

function clearAllChatTitleShimmers() {
  document.querySelectorAll('.chat-item-name.chat-item-name-shimmer').forEach(nameEl => {
    nameEl.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
    const prev = nameEl.dataset.prevTitle;
    if (prev !== undefined && prev !== 'Новый чат') {
      nameEl.textContent = prev;
    } else {
      nameEl.textContent = nameEl.textContent || 'Новый чат';
    }
    delete nameEl.dataset.prevTitle;
  });
  const topDisplay = document.getElementById('chatTitleDisplay');
  const shimmerBar = document.getElementById('chatTitleShimmer');
  const chatTitleText = document.getElementById('chatTitleText');
  if (topDisplay?.classList.contains('chat-title-shimmer-mode')) {
    topDisplay.classList.remove('chat-title-shimmer-mode', 'chat-title-shimmer-exit');
    shimmerBar?.classList.remove('visible');
    if (chatTitleText) chatTitleText.style.cssText = '';
  }
}

function setChatTitleGenerating(chatId, active) {
  const nameEl = document.querySelector(`.chat-item[data-id="${chatId}"] .chat-item-name`);
  const topDisplay = document.getElementById('chatTitleDisplay');
  const shimmerBar = document.getElementById('chatTitleShimmer');
  const chatTitleText = document.getElementById('chatTitleText');
  const modelPickTopbar = document.getElementById('modelPickTopbar');
  if (active) {
    if (nameEl) {
      nameEl.dataset.prevTitle = nameEl.textContent;
      nameEl.textContent = '';
      nameEl.classList.add('chat-item-name-shimmer');
      nameEl.classList.remove('chat-item-name-shimmer-exit');
    }
    if (currentChatId === chatId && topDisplay && chatTitleText) {
      topDisplay.style.display = 'flex';
      chatTitleText.textContent = '';
      chatTitleText.style.cssText = '';
      shimmerBar?.classList.add('visible');
      topDisplay.classList.add('chat-title-shimmer-mode');
      topDisplay.classList.remove('chat-title-shimmer-exit');
      if (modelPickTopbar) modelPickTopbar.style.margin = '0';
    }
  } else {
    if (nameEl) {
      nameEl.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
      const chat = allChats.find(c => c.id === chatId);
      nameEl.textContent = chat?.title || 'Новый чат';
      delete nameEl.dataset.prevTitle;
    }
    if (currentChatId === chatId && topDisplay) {
      topDisplay.classList.remove('chat-title-shimmer-mode', 'chat-title-shimmer-exit');
      shimmerBar?.classList.remove('visible');
      if (chatTitleText) {
        chatTitleText.style.cssText = '';
        const chat = allChats.find(c => c.id === chatId);
        chatTitleText.textContent = chat?.title || 'Новый чат';
      }
    }
  }
}

function typeTextIntoElements(elements, text, msPerChar) {
  const list = elements.filter(Boolean);
  return new Promise(resolve => {
    let i = 0;
    function tick() {
      const slice = text.slice(0, i);
      list.forEach(el => { el.textContent = slice; });
      if (i < text.length) {
        i++;
        setTimeout(tick, msPerChar);
      } else {
        resolve();
      }
    }
    tick();
  });
}

async function fadeOutTitleShimmerThenType(chatId, title) {
  const nameEl = document.querySelector(`.chat-item[data-id="${chatId}"] .chat-item-name`);
  const topDisplay = document.getElementById('chatTitleDisplay');
  const shimmerBar = document.getElementById('chatTitleShimmer');
  const chatTitleText = document.getElementById('chatTitleText');
  nameEl?.classList.add('chat-item-name-shimmer-exit');
  topDisplay?.classList.add('chat-title-shimmer-exit');
  await new Promise(r => setTimeout(r, 400));
  nameEl?.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
  if (nameEl) delete nameEl.dataset.prevTitle;
  topDisplay?.classList.remove('chat-title-shimmer-mode', 'chat-title-shimmer-exit');
  shimmerBar?.classList.remove('visible');
  if (chatTitleText) chatTitleText.style.cssText = '';
  const toType = [];
  if (nameEl) toType.push(nameEl);
  if (currentChatId === chatId && chatTitleText) toType.push(chatTitleText);
  const ms = Math.min(42, Math.max(14, Math.floor(480 / Math.max(title.length, 1))));
  await typeTextIntoElements(toType, title, ms);
  if (currentChatId === chatId) {
    document.title = `${title} — Averon AI`;
    const tb = document.getElementById('topbarTitle');
    if (tb) tb.textContent = title;
  }
}
let progressTimer = null, progressVal = 0;
function startProgress() {
  const bar = document.querySelector('.stream-progress');
  if (!bar) return;
  bar.classList.add('active');
  progressVal = 0; bar.style.width = '0%';
  progressTimer = setInterval(() => {
    progressVal += (100 - progressVal) * 0.04;
    bar.style.width = Math.min(progressVal, 92) + '%';
  }, 150);
}
function finishProgress() {
  const bar = document.querySelector('.stream-progress');
  if (!bar) return;
  clearInterval(progressTimer);
  bar.style.width = '100%';
  bar.style.transition = 'width 0.3s ease';
  setTimeout(() => { bar.classList.remove('active'); bar.style.width = '0%'; bar.style.transition = ''; }, 400);
}
function setupDragAndDrop() {
  if (isGuest) return;
  const dropZone = document.getElementById('main') || document.body;
  let dragCounter = 0;

  const overlay = document.createElement('div');
  overlay.id = 'dndOverlay';
  overlay.innerHTML = `
    <div class="dnd-inner">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p>Перетащите файлы сюда</p>
      <span>Изображения, PDF, текст, код</span>
    </div>
  `;
  document.body.appendChild(overlay);

  dropZone.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) overlay.classList.add('active');
  });
  dropZone.addEventListener('dragleave', e => {
    dragCounter--;
    if (dragCounter === 0) overlay.classList.remove('active');
  });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const allowed = ['image/', 'text/', 'application/pdf', 'application/json'];
    const valid = files.filter(f => allowed.some(t => f.type.startsWith(t)) || f.name.match(/\.(py|js|ts|css|html|md|sql|sh|yaml|yml|xml|csv|txt|json|pdf)$/i));
    if (!valid.length) { showToast('toastDeleted', 'Неподдерживаемый формат'); return; }
    valid.forEach(f => {
      attachedFiles.push(f);
    });
    updateAttachmentUI();
    showToast('toastMemory', `Добавлено файлов: ${valid.length}`);
    validateInput();
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  const expandBtn = document.getElementById('topbarExpandBtn');
  if (expandBtn) expandBtn.style.display = isCollapsed ? 'flex' : 'none';
}

function bindEvents() {
  const sidebar = document.getElementById('sidebar');
  const topbar  = document.getElementById('topbar');
  const overlay = document.getElementById('sidebarOverlay');
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('topbarExpandBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('visible', sidebar.classList.contains('open'));
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });

  if (!isGuest) {
    document.getElementById('newChatBtn')?.addEventListener('click', createNewChat);
    document.getElementById('newChatBtnMobile')?.addEventListener('click', createNewChat);
  }
  document.getElementById('searchNavBtn')?.addEventListener('click', async () => {
    if (isGuest) { window.location.href = '/login'; return; }
    const q = await showDialog({ title: 'Поиск в чатах', msg: '', type: 'info', input: true, inputPlaceholder: 'Введите запрос…', buttons: [{ label: 'Отмена', value: null }, { label: 'Найти', value: true, primary: true }] });
    if (q !== null && q !== true) filterChats(q);
    else if (q === null) filterChats('');
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      if (!isGuest) createNewChat();
      return;
    }
    
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      const activeInput = document.activeElement === msgInput ? msgInputW : msgInput;
      activeInput?.focus();
      return;
    }
    
    if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      stopGeneration();
      return;
    }
    
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const activeInput = document.activeElement === msgInput ? msgInput : msgInputW;
      if (activeInput && activeInput.value.trim() === '' && !e.target.closest('.modal')) {
        e.preventDefault();
        const lastMsg = _lastUserMsg;
        if (lastMsg && activeInput) {
          activeInput.value = lastMsg;
          validateInput();
          activeInput.select();
        }
      }
    }
  });

  [[msgInputW, sendBtnW],[msgInput, sendBtn]].forEach(([inp, btn]) => {
    inp.addEventListener('input', () => { validateInput(); autoH(inp); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isGuest) return;
        if (!btn.disabled) sendMsg(inp);
      }
    });
  });
  if (!isGuest) {
    sendBtnW.addEventListener('click', () => sendMsg(msgInputW));
    sendBtn.addEventListener('click', () => sendMsg(msgInput));
  }
  stopBtn.addEventListener('click', stopGeneration);
  if (!isGuest) {
    document.getElementById('attachBtnW')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('attachBtnChat')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('fileInput')?.addEventListener('change', handleFileSelect);
    document.getElementById('searchToggleW')?.addEventListener('click', toggleSearch);
    document.getElementById('searchToggle')?.addEventListener('click', toggleSearch);
  }
  if (!isGuest) {
    document.getElementById('docsToggleW')?.addEventListener('click', toggleDocs);
    document.getElementById('docsToggle')?.addEventListener('click', toggleDocs);
    document.getElementById('imageGenBtn')?.addEventListener('click', handleImageGeneration);
    document.getElementById('ttsBtn')?.addEventListener('click', handleTTS);
    document.getElementById('codeRunBtn')?.addEventListener('click', handleCodeExecution);
  }
  if (docsOn) {
    ['docsToggleW','docsToggle'].forEach(id => document.getElementById(id)?.classList.add('active'));
    docsStrip?.classList.add('show');
    docsStripW?.classList.add('show');
  }
  if (searchOn) {
    ['searchToggleW','searchToggle'].forEach(id => document.getElementById(id)?.classList.add('active'));
    searchStrip?.classList.add('show');
    searchStripW?.classList.add('show');
  }
  function openModelDrop(dropEl) {
    if (!dropEl) return;
    const isOpen = dropEl.classList.contains('open');
    document.querySelectorAll('.model-dropdown').forEach(d => {
      d.classList.remove('open');
      d.style.display = 'none';
    });
    if (isOpen) return;
    dropEl.classList.add('open');
    dropEl.style.display = 'block';
  }
  document.getElementById('modelPickBtnTopbar')?.addEventListener('click', e => { 
    e.stopPropagation(); 
    openModelDrop(modelDropTopbar); 
  });
  
  document.getElementById('modelPickBtnTopbarMobile')?.addEventListener('click', e => { 
    e.stopPropagation(); 
    openModelDrop(modelDropTopbarMobile); 
  });
  document.querySelectorAll('.model-dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => { 
      setModel(btn.dataset.model); 
      document.querySelectorAll('.model-dropdown').forEach(d=>d.classList.remove('open')); 
    });
  });

  if (!isGuest) {
    document.getElementById('userMenuBtn')?.addEventListener('click', e => { e.stopPropagation(); userMenu.classList.toggle('open'); });
    document.getElementById('settingsMenuBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSettings(); });
    document.getElementById('memoryMenuBtn')?.addEventListener('click', e => { e.stopPropagation(); openMemory(); });
  }

  [msgInputW, msgInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => updateTokenCounter(inp));
    inp.addEventListener('focus', () => updateTokenCounter(inp));
  });
  updateTokenCounter(msgInputW || msgInput);

  setupDragAndDrop();
  document.addEventListener('click', e => {
    const clickedInsideDesktopDropdown = modelDropTopbar && modelDropTopbar.contains(e.target);
    const clickedDesktopButton = e.target.closest('#modelPickBtnTopbar');
    const clickedInsideMobileDropdown = modelDropTopbarMobile && modelDropTopbarMobile.contains(e.target);
    const clickedMobileButton = e.target.closest('#modelPickBtnTopbarMobile');
    
    if (!clickedInsideDesktopDropdown && !clickedDesktopButton && modelDropTopbar) {
      modelDropTopbar.classList.remove('open');
      modelDropTopbar.style.display = 'none';
    }
    if (!clickedInsideMobileDropdown && !clickedMobileButton && modelDropTopbarMobile) {
      modelDropTopbarMobile.classList.remove('open');
      modelDropTopbarMobile.style.display = 'none';
    }
    
    if (ctxMenu && !ctxMenu.contains(e.target)) hideCtx();
    if (userMenu && !userMenu.contains(e.target) && !document.getElementById('userMenuBtn')?.contains(e.target)) userMenu.classList.remove('open');
    if (settingsModal && !settingsModal.contains(e.target) && !document.getElementById('settingsMenuBtn')?.contains(e.target)) closeModal('settingsModal');
    if (memoryModal && !memoryModal.contains(e.target) && !document.getElementById('memoryMenuBtn')?.contains(e.target)) closeModal('memoryModal');
  });
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));
  document.addEventListener('paste', e => {
    const imgs = [...(e.clipboardData?.items||[])].filter(i => i.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    imgs.forEach(item => {
      const f = item.getAsFile(); if (!f) return;
      attachedFiles.push(new File([f], `clipboard-${Date.now()}.${f.type.split('/')[1]||'png'}`, {type:f.type}));
    });
    updateAttachmentUI(); validateInput();
  });
  document.querySelectorAll('.input-box').forEach(box => {
    box.addEventListener('dragover', e => { e.preventDefault(); box.style.borderColor = 'var(--accent)'; });
    box.addEventListener('dragleave', () => { box.style.borderColor = ''; });
    box.addEventListener('drop', e => {
      e.preventDefault(); box.style.borderColor = '';
      const files = [...(e.dataTransfer?.files||[])]; if (!files.length) return;
      attachedFiles = attachedFiles.concat(files); updateAttachmentUI(); validateInput();
    });
  });
}

function autoH(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function toggleSearch() {
  searchOn = !searchOn;
  localStorage.setItem('averon-search', searchOn ? 'true' : 'false');
  ['searchToggleW','searchToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active', searchOn);
    }
  });
  searchStrip?.classList.toggle('show', searchOn);
  searchStripW?.classList.toggle('show', searchOn);
}

function validateInput() {
  if (isGuest) return;
  const hasText  = !!(msgInputW?.value.trim() || msgInput?.value.trim());
  const hasFiles = attachedFiles.length > 0;
  const canSend  = (hasText || hasFiles) && !streaming;
  [sendBtn, sendBtnW].forEach(b => { if(!b) return; b.disabled = !canSend; b.classList.toggle('active', canSend); });
  [msgInput, msgInputW].forEach(i => { if(i) i.disabled = streaming; });
  if (stopBtn) stopBtn.style.display = streaming ? 'flex' : 'none';

  if (streaming) {
    stopPlaceholderAnimation();
  } else {
  }
}

function startPlaceholderAnimation() {
  if (placeholderInterval) return;
  
  [msgInputW, msgInput].forEach(inp => {
    if (inp) {
      inp.style.transition = 'opacity 0.3s ease';
    }
  });

  const updatePlaceholder = () => {
    const ph = PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];
    [msgInputW, msgInput].forEach(inp => {
      if (inp && !inp.value) {
        inp.style.opacity = '0';
        setTimeout(() => {
          inp.placeholder = ph;
          inp.style.opacity = '1';
        }, 150);
      }
    });
    placeholderIndex++;
  };
  updatePlaceholder();
  placeholderInterval = setInterval(updatePlaceholder, 1000);
}

function stopPlaceholderAnimation() {
  if (placeholderInterval) {
    clearInterval(placeholderInterval);
    placeholderInterval = null;
  }
  [msgInputW, msgInput].forEach(inp => {
    if (inp && !inp.value && !inp.disabled) {
      inp.placeholder = 'Спросите что угодно';
    }
  });
}
async function loadChats() {
  if (isGuest) return;
  const res = await fetch('/api/chats'); if (!res.ok) return;
  allChats = await res.json(); renderChats(allChats);
}

let _collapsedGroups = new Set();
function renderChats(list) {
  const el = document.getElementById('chatsList'); if (!el) return;
  el.innerHTML = '';
  if (!list?.length) { el.innerHTML = '<div style="text-align:center;padding:24px 8px;color:var(--text3);font-size:13px;">Нет чатов</div>'; return; }
  const g = groupByDate(list);
  const hasHeader = !document.querySelector('.chats-section-header');
  if (hasHeader) {
    const header = document.createElement('div');
    header.className = 'chats-section-header';
    header.innerHTML = `<span>Ваши чаты</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    let hidden = false;
    header.addEventListener('click', () => {
      hidden = !hidden;
      header.querySelector('svg').style.transform = hidden ? 'rotate(-90deg)' : '';
      el.querySelectorAll('.chat-group-body').forEach(g => g.style.display = hidden ? 'none' : '');
      el.querySelectorAll('.chats-group-label').forEach(l => l.style.display = hidden ? 'none' : '');
    });
    el.appendChild(header);
  }
  for (const [name, items] of Object.entries(g)) {
    if (!items.length) continue;
    const label = document.createElement('div');
    label.className = 'chats-group-label';
    label.textContent = name;
    el.appendChild(label);
    const body = document.createElement('div');
    body.className = 'chat-group-body';
    items.forEach(c => body.appendChild(buildChatItem(c)));
    el.appendChild(body);
  }
}

function groupByDate(list) {
  const td = day(new Date()), yd = td-864e5, wk = td-7*864e5, mo = td-30*864e5;
  const g = {'Сегодня':[],'Вчера':[],'7 дней':[],'30 дней':[],'Раньше':[]};
  list.forEach(c => {
    const d = new Date(c.updated_at||c.created_at).getTime();
    if(d>=td) g['Сегодня'].push(c); else if(d>=yd) g['Вчера'].push(c);
    else if(d>=wk) g['7 дней'].push(c); else if(d>=mo) g['30 дней'].push(c); else g['Раньше'].push(c);
  });
  return g;
}
function day(d) { return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); }

function buildChatItem(chat) {
  const div = document.createElement('div');
  const isActive = currentChatId === chat.id;
  div.className = 'chat-item' + (isActive ? ' active' : '');
  if (isActive) {
    div.style.borderLeft = 'none';
    div.style.boxShadow = 'none';
  }
  div.dataset.id = chat.id;
  div.innerHTML = `
    <span class="chat-item-name">${esc(chat.title)}</span>
    <button class="chat-item-dots" data-id="${chat.id}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
      </svg>
    </button>`;
  div.addEventListener('click', () => openChat(chat.id));
  div.querySelector('.chat-item-dots').addEventListener('click', e => { e.stopPropagation(); showCtx(e, chat.id); });
  
  return div;
}

function filterChats(q) {
  if (!q?.trim()) { renderChats(allChats); return; }
  renderChats(allChats.filter(c => c.title.toLowerCase().includes(q.toLowerCase())));
}
async function createNewChat() {
  if (isGuest) { window.location.href = '/login'; return; }
  document.querySelectorAll('.chat-item-name.chat-item-name-shimmer-exit').forEach(nameEl => {
    nameEl.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
  });
  await pruneEmptyChats();
  currentChatId = null;
  history.pushState({}, 'Averon AI', '/');
  updatePageTitle('Averon AI');
  showWelcome();
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.remove('active');
    el.style.borderLeft = '';
    el.style.boxShadow = '';
  });
}
window.createNewChat = createNewChat;

async function openChat(id, skipPush) {
  if (currentChatId === id && messages.children.length > 0) return;
  document.querySelectorAll('.chat-item-name.chat-item-name-shimmer-exit').forEach(nameEl => {
    nameEl.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
  });
  currentChatId = id;

  welcome.style.setProperty('display', 'none', 'important');
  main.classList.add('has-messages');
  messages.innerHTML = '';
  scrollArea.style.opacity = '0';

  const chat = allChats.find(c => c.id === id);
  if (chat) {
    currentModel = chat.model || 'flash';
    setModelUI(currentModel);
    if (!skipPush) setChatUrl(id, chat.title);
    else updatePageTitle(chat.title);
  }
  document.querySelectorAll('.chat-item').forEach(el => {
    const isActive = el.dataset.id === id;
    el.classList.toggle('active', isActive);
    if (isActive) {
      el.style.borderLeft = 'none';
      el.style.boxShadow = 'none';
    } else {
      el.style.borderLeft = '';
      el.style.boxShadow = '';
    }
  });

  setTimeout(async () => {
    try {
      const msgsRes = await fetch(`/api/chats/${id}/messages`);
      if (msgsRes.status === 404) {
        showWelcome();
        currentChatId = null;
        history.pushState({}, 'Averon AI', '/');
        scrollArea.style.opacity = '1';
        return;
      }
      const msgs = await msgsRes.json();
      if (!msgs?.length) {
        showWelcome();
      } else {
        showChat();
        messages.innerHTML = '';
        msgs.forEach(m => appendMsg(m.role, m.content, m.reasoning_content, m.id, m.reasoning_time));
        scrollBotForce();
        // Render MathJax and graphs for loaded messages
        setTimeout(() => {
          msgs.forEach((m) => {
            if (m.role === 'assistant' && m.content) {
              const msgEl = document.querySelector(`.msg[data-message-id="${m.id}"]`);
              const msgText = msgEl?.querySelector('.msg-text');
              if (msgText && window.renderMD) {
                // Reset pending blocks and re-render markdown
                window._pendingGraphBlocks = [];
                msgText.innerHTML = window.renderMD(m.content);
                // Resolve graph placeholders
                if (window._resolveGraphPlaceholders) window._resolveGraphPlaceholders(msgText);
                // Highlight code blocks
                msgText.querySelectorAll('pre code').forEach(b => {
                  try { if (window.hljs) window.hljs.highlightElement(b); } catch(_) {}
                });
                // Render MathJax
                if (window.renderMathInElement) window.renderMathInElement(msgText);
                // Check for incomplete response and show continue button
                if (msgEl && isIncompleteResponse(m.content)) {
                  showContinueButton(msgEl, m.id, id);
                }
              }
            }
          });
        }, 100);
      }
    } catch (error) { 
      showWelcome(); 
    }
    scrollArea.style.opacity = '1';
    scrollArea.style.transition = 'opacity 0.15s ease';
  }, 80);
}

function showWelcome() {
  welcome.style.setProperty('display', 'flex', 'important'); 
  bottomBar.style.setProperty('display', 'none', 'important');
  messages.innerHTML = ''; 
  updatePageTitle('Averon AI');
  main.classList.remove('has-messages');
}

function showChat() {
  welcome.style.setProperty('display', 'none', 'important'); 
  bottomBar.style.setProperty('display', 'flex', 'important');
  main.classList.add('has-messages');
}
const _copyIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const _speakIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const _stopSpeakIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`;
const _regenIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>`;

function appendMsg(role, content, reasoning, messageId = null, reasoningTime = null) {
  if (!messages) {
    return;
  }
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (messageId) {
    div.dataset.messageId = messageId;
  }
  if (role === 'user') {
    div.innerHTML = `
      <div class="msg-content-wrapper">
        <div class="msg-content"></div>
        <div class="msg-actions user-actions">
          <button class="msg-action-btn" title="Копировать" onclick="copyUserMsg(this)">${_copyIcon}</button>
          <button class="msg-action-btn" title="Озвучить" onclick="speakMsg(this, 'user')">${_speakIcon}</button>
        </div>
      </div>`;
    div.querySelector('.msg-content').textContent = content || '';
    messages.appendChild(div);
  } else {
    div.dataset.fullContent = content || '';
    div.innerHTML = `
      <div class="msg-avatar">
        <img src="/static/logo.png" width="28" height="28" alt="Averon AI Logo" style="border-radius: 50%;">
      </div>
      <div class="msg-text">${content ? renderMD(content) : thinkingHTML()}</div>
      <div class="msg-actions ai-actions">
        <button class="msg-action-btn" title="Повторить" onclick="regenerateMsg(this, '${messageId || ''}')">${_regenIcon}</button>
        <button class="msg-action-btn" title="Копировать" onclick="copyMsgText(this)">${_copyIcon}</button>
        <button class="msg-action-btn" title="Озвучить" onclick="speakMsg(this, 'ai')">${_speakIcon}</button>
      </div>`;
    
    // Add reasoning section separately if provided (for chat history)
    if (reasoning && reasoning.length > 0) {
      const timeLabel = reasoningTime ? `${Math.round(reasoningTime / 1000)}с` : '';
      const reasoningSection = document.createElement('div');
      reasoningSection.className = 'reasoning-section';
      reasoningSection.dataset.finalized = '1';
      reasoningSection.innerHTML = `
        <div class="reasoning-header" onclick="toggleReasoningSection(this)">
          <svg class="thinking-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="shimmer-grad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                <stop offset="0%"   stop-color="#6b7bff" stop-opacity="0.3"/>
                <stop offset="50%"  stop-color="#c0c8ff" stop-opacity="1"/>
                <stop offset="100%" stop-color="#6b7bff" stop-opacity="0.3"/>
                <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="1.4s" repeatCount="indefinite"/>
              </linearGradient>
            </defs>
            <path fill="url(#shimmer-grad)" fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z"/>
          </svg>
          <span class="reasoning-label">Думал ${timeLabel}</span>
          <svg class="reasoning-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
        <div class="reasoning-body">
          <div class="reasoning-text-wrap">
            <div class="reasoning-text">${reasoning}</div>
          </div>
        </div>
      `;
      div.insertBefore(reasoningSection, div.querySelector('.msg-text'));
    }
  }
  messages.appendChild(div);
  return div;
  if (role === 'assistant' && content) {
    const msgText = div.querySelector('.msg-text');
    if (msgText) {
      requestAnimationFrame(() => {
        if (window._resolveGraphPlaceholders) window._resolveGraphPlaceholders(msgText);
        if (window.renderMathInElement) window.renderMathInElement(msgText);
        if (typeof _tryInjectGraphFallback === 'function') {
          const msgs = Array.from(messages.querySelectorAll('.msg'));
          const idx = msgs.indexOf(div);
          const prevUser = idx > 0 ? msgs.slice(0, idx).reverse().find(m => m.classList.contains('user')) : null;
          const userText = prevUser ? (prevUser.querySelector('.msg-content')?.textContent || '') : '';
          _tryInjectGraphFallback(msgText, content, userText);
        }
      });
    }
  }
}

window.regenerateMsg = async function(btn, messageId) {
  if (streaming) return;
  if (!currentChatId) return;

  const msgEl = btn.closest('.msg.assistant');
  if (!msgEl) return;
  let prev = msgEl.previousElementSibling;
  while (prev && !prev.classList.contains('user')) prev = prev.previousElementSibling;
  const userText = prev?.querySelector('.msg-content')?.textContent?.trim();
  if (!userText) return;

  const delRes = await fetch(`/api/chats/${currentChatId}/messages/last-assistant`, {
    method: 'DELETE'
  });
  if (!delRes.ok) {
    showToast('toastDeleted', 'Ошибка регенерации');
    return;
  }

  msgEl.style.transition = 'opacity 0.18s, transform 0.18s';
  msgEl.style.opacity = '0';
  msgEl.style.transform = 'translateY(6px)';
  await new Promise(r => setTimeout(r, 180));
  msgEl.remove();

  streaming = true;
  validateInput();
  startProgress();

  const aiMsgEl = appendMsg('assistant', '');
  const aiEl = aiMsgEl?.querySelector('.msg-text');

  const fd = new FormData();
  fd.append('message', userText);
  fd.append('use_search', searchOn ? 'true' : 'false');
  fd.append('use_docs', docsOn ? 'true' : 'false');
  fd.append('model', currentModel);
  fd.append('reasoning', window.reasoningEnabled ? 'true' : 'false');
  fd.append('regenerate', 'true');

  abortController = new AbortController();

  try {
    const resp = await fetch(`/api/chats/${currentChatId}/stream`, {
      method: 'POST',
      body: fd,
      signal: abortController.signal
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 429 && err.upgrade) { showUpgradeModal(err); streaming = false; finishProgress(); validateInput(); return; }
      setAI(aiEl, `<span style="color:#f87171;">${err.message || 'Ошибка ' + resp.status}</span>`);
      streaming = false; finishProgress(); validateInput();
      return;
    }
    return handleStreamResponse(resp, aiEl, aiMsgEl, userText, []);
  } catch (e) {
    if (e.name === 'AbortError') setAI(aiEl, '<span style="color:var(--text3);">Остановлено</span>');
    else setAI(aiEl, '<span style="color:#f87171;">Ошибка соединения</span>');
    streaming = false; finishProgress(); validateInput();
  }
};

window.copyMsgText = function(btn) {
  const text = btn.closest('.msg')?.querySelector('.msg-text')?.innerText || '';
  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  
  btn.classList.add('clicked');
  
  copyToClipboard(text).then(() => {
    const orig = btn.innerHTML;
    btn.classList.add('copied'); 
    btn.innerHTML = checkIcon;
    setTimeout(() => { 
      btn.classList.remove('copied', 'clicked'); 
      btn.innerHTML = orig; 
    }, 2000);
  }).catch(() => {
    btn.classList.remove('clicked');
    showToast('toastDeleted','Ошибка копирования');
  });
};

function _cleanTextForTTS(raw) {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+>]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/[_~|]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

window.copyUserMsg = function(btn) {
  const text = btn.closest('.msg-content-wrapper')?.querySelector('.msg-content')?.innerText || '';
  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  copyToClipboard(text).then(() => {
    const orig = btn.innerHTML;
    btn.classList.add('copied'); btn.innerHTML = checkIcon;
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
  }).catch(() => showToast('toastDeleted','Ошибка копирования'));
};
(function setupCodeRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = function(code, lang) {
    if (typeof code === 'object' && code !== null) {
      lang = code.lang || '';
      code = code.text || '';
    }
    const language = lang || 'plaintext';

    let highlighted;
    try {
      if (window.hljs) {
        const validLang = hljs.getLanguage(language) ? language : 'plaintext';
        highlighted = hljs.highlight(code, { language: validLang, ignoreIllegals: true }).value;
      } else {
        highlighted = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
    } catch(_) {
      highlighted = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    const rawEscaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const copyIcon = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="2"/><path d="M11 5V3a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 2 3v6A1.5 1.5 0 0 0 3.5 10.5H5"/></svg>`;
    // Trim trailing empty lines to prevent empty line numbers during streaming
    let lines = code.split('\n');
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
    const lineNums = lines.map((_, i) => `<span>${i + 1}</span>`).join('\n');
    let hlLines = highlighted.split('\n');
    while (hlLines.length > lines.length) hlLines.pop();
    const codeBody = hlLines.map(line => line === '' ? '<span>&ZeroWidthSpace;</span>' : `<span>${line}</span>`).join('\n');
    return `<div class="code-wrap" data-code="${rawEscaped}">
  <div class="code-header">
    <span class="lang-badge">${language}</span>
    <button class="copy-btn" onclick="copyCodeBlock(this)">
      ${copyIcon}
      <span class="copy-text">copy</span>
    </button>
  </div>
  <pre><div class="line-nums"><div class="nums">${lineNums}</div><div class="code-body">${codeBody}</div></div></pre>
</div>`;
  };
  marked.use({ renderer });
})();

function _decodeEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function renderMD(text) {
  if (window.renderMDFromMath && window.renderMDFromMath !== renderMD) {
    return window.renderMDFromMath(_decodeEntities(text));
  }
  return marked.parse(_decodeEntities(text));
}

window.copyCodeBlock = function(btn) {
  const block = btn.closest('.code-wrap');
  const code = block?.dataset?.code || '';
  const plainCode = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  copyToClipboard(plainCode).then(() => {
    const textEl = btn.querySelector('.copy-text');
    if (textEl) {
      textEl.textContent = 'copied!';
      setTimeout(() => textEl.textContent = 'copy', 1800);
    }
  }).catch(() => showToast('toastDeleted', 'Ошибка копирования'));
};

function copyGraphCode(btn) {
  const codeBlock = btn.closest('.graph-code-block').querySelector('code');
  const code = codeBlock.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✅ Скопировано!';
    setTimeout(() => btn.textContent = originalText, 2000);
  });
}
function setModel(key) {
  currentModel = key; setModelUI(key);
  if (currentChatId) {
    fetch(`/api/chats/${currentChatId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:key})});
    const c=allChats.find(c=>c.id===currentChatId); if(c) c.model=key;
  }
  if (!isGuest) {
    fetch('/api/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({default_model: key})
    }).then(() => {
      window.currentSettings = {...(window.currentSettings || {}), default_model: key};
    }).catch(() => {});
  }
  const modelMsg = key === 'codex' ? 'Модель изменена на Codex. ' : `Модель: ${MODEL_NAMES[key]||key}`;
  showToast('toastModel', modelMsg);
  trackModelSwitch(key);
  const activeInput = document.getElementById('msgInput') || document.getElementById('msgInputW');
  updateTokenCounter(activeInput);
}

function setModelUI(key) {
  const label = MODEL_NAMES[key]||key;
  if(modelLabelTopbar) modelLabelTopbar.textContent=label;
  if(modelLabelTopbarMobile) modelLabelTopbarMobile.textContent=label;
  document.querySelectorAll('.model-dropdown-item').forEach(b => b.classList.toggle('active', b.dataset.model===key));
  document.body.setAttribute('data-current-model', key);
  if(window.updateReasoningButton) window.updateReasoningButton(key);
}

async function trackModelSwitch(model) {
  try {
    await fetch('/api/models/'+model+'/info').then(r => r.json());
  } catch(e) {}
}

async function loadModelsInfo() {
  try {
    const res = await fetch('/api/models');
    if(res.ok) {
      const models = await res.json();
      window.modelsInfo = models;
    }
  } catch(e) {
  }
}
function handleFileSelect(e) { attachedFiles=attachedFiles.concat(Array.from(e.target.files)); updateAttachmentUI(); e.target.value=''; }
function _isImage(f) { return f.type.startsWith('image/')||/\.(png|jpg|jpeg|gif|webp)$/i.test(f.name); }

function updateAttachmentUI() {
  const previews = [
    document.getElementById('attachmentsPreviewW'),
    document.getElementById('attachmentsPreview')
  ];
  
  previews.forEach(preview => {
    if (!preview) return;
    
    if (!attachedFiles.length) {
      preview.innerHTML = '';
      return;
    }
    
    preview.innerHTML = attachedFiles.map((file, index) => {
      const fileSize = formatFileSize(file.size);
      
      return `
        <div class="attachment-item">
          <div class="attachment-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div class="attachment-info">
            <div class="attachment-name" title="${file.name}">${file.name}</div>
            <div class="attachment-size">${fileSize}</div>
          </div>
          <button class="attachment-remove" onclick="removeFile(${index})" title="Удалить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
window.removeFile = i => { attachedFiles.splice(i,1); updateAttachmentUI(); validateInput(); };
function clearAttachments() { attachedFiles=[]; updateAttachmentUI(); }
function showImagePreview(imageSrc, fileName) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  `;
  
  const img = document.createElement('img');
  img.src = imageSrc;
  img.style.cssText = `
    max-width: 90vw; max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  `;
  
  const info = document.createElement('div');
  info.textContent = fileName;
  info.style.cssText = `
    position: absolute; top: 20px; left: 50%;
    transform: translateX(-50%);
    color: white; font-size: 14px; background: rgba(0,0,0,0.7);
    padding: 8px 16px; border-radius: 20px;
  `;
  
  modal.appendChild(img);
  modal.appendChild(info);
  modal.onclick = () => document.body.removeChild(modal);
  document.body.appendChild(modal);
}

window.showImagePreview = showImagePreview;
function stopGeneration() { 
  abortController?.abort(); 
  abortController=null; 
  streaming=false; 
  window._sending = false;
  finishProgress(); 
  validateInput();
  _resetStream();
  showToast('toastModel', 'Генерация остановлена');
}
async function loadChat(chatId) {
  const res = await fetch(`/api/chats/${chatId}`);
  if (!res.ok) return;
  const chatData = await res.json();
  document.querySelectorAll('.chat-item-name.chat-item-name-shimmer-exit').forEach(nameEl => {
    nameEl.classList.remove('chat-item-name-shimmer', 'chat-item-name-shimmer-exit');
  });
  currentChatId = chatId;
  currentModel = chatData.model || 'flash';
  setModelUI(currentModel);
  document.querySelectorAll('.chat-item').forEach(el => {
    const isActive = el.dataset.id === chatId;
    el.classList.toggle('active', isActive);
    if (isActive) {
      el.style.borderLeft = 'none';
      el.style.boxShadow = 'none';
    } else {
      el.style.borderLeft = '';
      el.style.boxShadow = '';
    }
  });
  setChatUrl(chatId, chatData.title);
  updatePageTitle(chatData.title);
}

function renderMessages(msgList) {
  messages.innerHTML = '';
  msgList.forEach(m => {
    const reasoning = m.reasoning_content || m.reasoning || null;
    const reasoningTime = m.reasoning_time || null;
    appendMsg(m.role, m.content, reasoning, m.id, reasoningTime);
  });
  scrollBotForce();
  if (msgList.length > 0) {
    showChat();
  } else {
    showWelcome();
  }
}

async function loadChatSearchHistory(chatId) {
  try {
    const res = await fetch(`/api/search-info/${chatId}`);
    if (!res.ok) return;
    const searchHistory = await res.json();
    
    searchHistory.forEach(searchInfo => {
      const msgEl = document.querySelector(`.msg[data-message-id="${searchInfo.message_id}"]`);
      if (msgEl && searchInfo.search_enabled) {
        msgEl.dataset.searchEnabled = 'true';
        msgEl.dataset.searchQueries = JSON.stringify(searchInfo.search_queries || []);
        msgEl.dataset.searchResults = JSON.stringify(searchInfo.search_results || []);
      }
    });
  } catch (e) {
  }
}

function showUpgradeModal(errorData) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: rgba(45, 45, 45, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 40px;
    max-width: 520px;
    width: 90%;
    text-align: center;
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 0 0 1px rgba(255, 255, 255, 0.05);
  `;
  
  content.innerHTML = `
    <div style="
      font-size: 28px; 
      font-weight: 700; 
      color: var(--text); 
      margin-bottom: 20px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      background: linear-gradient(135deg, #ffffff 0%, #c5c5c5 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">
      Продолжи общаться с Averon 4 Codex
    </div>
    <div style="
      font-size: 17px; 
      color: rgba(255, 255, 255, 0.8); 
      line-height: 1.6; 
      margin-bottom: 28px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">
      С Averon 4 Codex ты можешь:
    </div>
    <div style="
      text-align: left; 
      margin-bottom: 28px; 
      color: rgba(255, 255, 255, 0.75); 
      font-size: 15px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    ">
      <div style="margin-bottom: 14px; display: flex; align-items: center;">
        <span style="
          width: 8px; 
          height: 8px; 
          background: var(--accent); 
          border-radius: 50%; 
          margin-right: 12px;
          box-shadow: 0 0 8px rgba(25, 195, 125, 0.5);
        "></span>
        Писать и отлаживать код на 80+ языках программирования
      </div>
      <div style="margin-bottom: 14px; display: flex; align-items: center;">
        <span style="
          width: 8px; 
          height: 8px; 
          background: var(--accent); 
          border-radius: 50%; 
          margin-right: 12px;
          box-shadow: 0 0 8px rgba(25, 195, 125, 0.5);
        "></span>
        Анализировать и исправлять ошибки в твоем коде
      </div>
      <div style="margin-bottom: 14px; display: flex; align-items: center;">
        <span style="
          width: 8px; 
          height: 8px; 
          background: var(--accent); 
          border-radius: 50%; 
          margin-right: 12px;
          box-shadow: 0 0 8px rgba(25, 195, 125, 0.5);
        "></span>
        Создавать алгоритмы и оптимизировать производительность
      </div>
      <div style="margin-bottom: 14px; display: flex; align-items: center;">
        <span style="
          width: 8px; 
          height: 8px; 
          background: var(--accent); 
          border-radius: 50%; 
          margin-right: 12px;
          box-shadow: 0 0 8px rgba(25, 195, 125, 0.5);
        "></span>
        Генерировать unit-тесты и документацию
      </div>
      <div style="display: flex; align-items: center;">
        <span style="
          width: 8px; 
          height: 8px; 
          background: var(--accent); 
          border-radius: 50%; 
          margin-right: 12px;
          box-shadow: 0 0 8px rgba(25, 195, 125, 0.5);
        "></span>
        Объяснять сложный код простыми словами
      </div>
    </div>
    <div style="
      font-size: 14px; 
      color: rgba(255, 255, 255, 0.6); 
      margin-bottom: 28px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    ">
      Использовано ${errorData.used || 0} из ${errorData.limit || 20} запросов сегодня
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button onclick="window.open('/pricing', '_blank')" style="
        background: linear-gradient(135deg, var(--accent) 0%, #16a34a 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 14px 28px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 
          0 4px 16px rgba(25, 195, 125, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      " onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(25, 195, 125, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 16px rgba(25, 195, 125, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'">
        Оформить подписку Pro
      </button>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 14px 28px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.transform='translateY(0)'">
        Позже
      </button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => modal.remove(), 300);
    }
  });
}

async function sendMsg(sourceInput) {
  if (isGuest) {
    if (guestMsgCount >= GUEST_MSG_LIMIT) {
      showGuestLimitModal();
      return;
    }
    incrementGuestMsgCount();
    if (guestMsgCount >= GUEST_MSG_LIMIT - 1) {
      showToast('toastModel', `Осталось ${GUEST_MSG_LIMIT - guestMsgCount} бесплатных сообщений`);
    }
    window.location.href = '/login'; return;
  }
  const text = sourceInput.value.trim();
  const hasFiles = attachedFiles.length>0;
  if (!text && !hasFiles) return;
  if (streaming) return;
  if (window._sending) return; // Prevent duplicate sends
  window._sending = true;
  
  if (!currentChatId) {
    const s = await fetch('/api/settings').then(r=>r.json()).catch(()=>({}));
    const res = await fetch('/api/chats', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model: s.default_model || currentModel})});
    if (!res.ok) { showToast('toastDeleted', 'Ошибка создания чата'); window._sending = false; return; }
    const chat = await res.json();
    currentChatId = chat.id;
    currentModel = chat.model || currentModel;
    setModelUI(currentModel);
    allChats.unshift(chat);
    renderChats(allChats);
    setChatUrl(chat.id, 'Новый чат');
  }
  
  showChat();
  
  _lastUserMsg = text;
  const userEl = appendMsg('user', text);
  scrollBotForce();
  const filesToSend = [...attachedFiles];
  if (filesToSend.length) {
    const strip=document.createElement('div'); strip.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    filesToSend.forEach(f => {
      if (_isImage(f)) {
        const img=document.createElement('img'); img.src=URL.createObjectURL(f);
        img.style.cssText='max-width:200px;max-height:160px;border-radius:8px;object-fit:cover;'; strip.appendChild(img);
      } else {
        const chip=document.createElement('div'); chip.className='file-preview-chip';
        chip.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(f.name)}`;
        strip.appendChild(chip);
      }
    });
    userEl?.querySelector('.msg-content')?.before(strip);
  }

  clearAttachments();
  sourceInput.value=''; 
  sourceInput.style.height = '26px'; // reset to min-height explicitly
  streaming=true; 
  validateInput(); 
  startProgress();

  const aiMsgEl = appendMsg('assistant','');
  const aiEl    = aiMsgEl?.querySelector('.msg-text');

  const fd = new FormData();
  fd.append('message', text); 
  fd.append('use_search', searchOn ? 'true' : 'false'); 
  fd.append('use_docs', docsOn ? 'true' : 'false');
  fd.append('model', currentModel);
  fd.append('reasoning', window.reasoningEnabled ? 'true' : 'false');
  filesToSend.forEach(f => fd.append('file', f));
  

  abortController = new AbortController();
  let msgSearchResults = null;

  try {
    const resp=await fetch(`/api/chats/${currentChatId}/stream`,{method:'POST',body:fd,signal:abortController.signal});
    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      if(resp.status===404 && err.error==='not found'){
        const s = await fetch('/api/settings').then(r=>r.json()).catch(()=>({}));
        const newChatRes = await fetch('/api/chats', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model: s.default_model || currentModel})});
        if(newChatRes.ok){
          const chat = await newChatRes.json();
          currentChatId = chat.id;
          currentModel = chat.model || currentModel;
          setModelUI(currentModel);
          allChats.unshift(chat);
          renderChats(allChats);
          setChatUrl(chat.id, 'Новый чат');
          const fd2 = new FormData();
          fd2.append('message', text); 
          fd2.append('use_search', searchOn ? 'true' : 'false'); 
          fd2.append('use_docs', docsOn ? 'true' : 'false');
          fd2.append('model', currentModel);
          fd2.append('reasoning', window.reasoningEnabled ? 'true' : 'false');
          filesToSend.forEach(f => fd2.append('file', f));
          const resp2 = await fetch(`/api/chats/${currentChatId}/stream`,{method:'POST',body:fd2,signal:abortController.signal});
          if(!resp2.ok){
            const err2 = await resp2.json().catch(()=>({}));
            if(resp2.status === 429 && err2.error === 'limit_reached' && err2.upgrade){
              showUpgradeModal(err2);
              streaming=false; finishProgress(); validateInput(); window._sending = false; return;
            }
            setAI(aiEl,`<span style="color:#f87171;">${err2.message||'Ошибка '+resp2.status}</span>`);
            streaming=false; finishProgress(); validateInput(); window._sending = false; return;
          }
          return handleStreamResponse(resp2, aiEl, aiMsgEl, text, filesToSend);
        }
      }
      if(resp.status === 429 && err.error === 'limit_reached' && err.upgrade){
        showUpgradeModal(err);
        streaming=false; finishProgress(); validateInput(); window._sending = false; return;
      }
      setAI(aiEl,`<span style="color:#f87171;">${err.message||'Ошибка '+resp.status}</span>`);
      streaming=false; finishProgress(); validateInput(); window._sending = false; return;
    }

    return handleStreamResponse(resp, aiEl, aiMsgEl, text, filesToSend);
  } catch(e){
    window._sending = false;
    if(e.name==='AbortError') setAI(aiEl,'<span style="color:var(--text3);">Остановлено</span>');
    else setAI(aiEl,'<span style="color:#f87171;">Ошибка соединения</span>');
    streaming=false; finishProgress(); validateInput();
  }
}

async function handleStreamResponse(resp, aiEl, aiMsgEl, text, filesToSend) {
  let msgSearchResults = null;
  const reader=resp.body.getReader(); let full='',buf='';
  while(true){
    const {value,done}=await reader.read();
    if(value){
      buf+=new TextDecoder().decode(value);
      const lines=buf.split('\n'); buf=lines.pop()||'';
      for(const line of lines){
        if(!line.startsWith('data: ')) continue;
        try{
          const data=JSON.parse(line.slice(6));
          if(data.err){setAI(aiEl,`<span style="color:#f87171;">Ошибка: ${data.err}</span>`);streaming=false;finishProgress();validateInput();return;}
          if(data.reading_docs){
            showDocsIndicator(aiMsgEl, data.reading_docs);
          }
          if(data.smart_context){
            showSmartContextIndicator(aiMsgEl, data.smart_context);
          }
          if(data.searching){
            msgSearchResults=data.search_results||null;
            const userMsgEl = aiMsgEl?.previousElementSibling;
            if (userMsgEl && userMsgEl.classList.contains('user')) {
              showSearchIndicator(userMsgEl, data.search_queries||null, msgSearchResults);
            }
            
            if(aiMsgEl){
              aiMsgEl.dataset.searchEnabled = 'true';
              aiMsgEl.dataset.searchQueries = JSON.stringify(data.search_queries||[]);
              aiMsgEl.dataset.searchResults = JSON.stringify(msgSearchResults||[]);
            }
            // Показываем индикатор количества страниц на сообщении пользователя
            if(msgSearchResults?.length && userMsgEl) {
              showSearchSourcesChip(userMsgEl, msgSearchResults);
            }
          }
          if(data.reasoning){
            showReasoning(aiMsgEl, data.reasoning);
          }
          if(data.content!==undefined){full+=data.content;updateAI(aiEl,full);}
          if(data.done){
            streaming=false; finishProgress(); validateInput(); scrollBotForce();
            window._sending = false; // Reset sending flag
            finalizeReasoning(aiMsgEl, data.reasoning_time);
            if(msgSearchResults?.length) showSearchSourcesChip(aiMsgEl, msgSearchResults);
            const mm=full.match(/\[ЗАПОМНИЛОСЬ:\s*(.+?)\]/i);
            if(mm) showToast('toastMemory',`Память обновлена`);
            if(data.message_id && aiMsgEl) {
              const mid = data.message_id;
              aiMsgEl.dataset.messageId = mid;
              const rd = aiMsgEl.querySelector('[data-message-id]');
              if(rd) rd.dataset.messageId = mid;
              const regenBtn = aiMsgEl.querySelector('.msg-action-btn[onclick*="regenerateMsg"]');
              if(regenBtn)   regenBtn.setAttribute('onclick',   `regenerateMsg(this,'${mid}')`);
            }
            if(currentChatId) {
              const chatMeta = allChats.find(c => c.id === currentChatId);
              if (chatMeta && (chatMeta.title === 'Новый чат' || !chatMeta.title)) {
                await generateChatTitle(currentChatId, text);
              } else {
                loadChats();
              }
            }
            if(!full.trim() || full.trim().length < 3) {
              if(aiEl) {
                _tryInjectGraphFallback(aiEl, '', _lastUserMsg);
                if(!aiEl.querySelector('.averon-plotly-wrap'))
                  aiEl.innerHTML = '<span style="color:var(--text3);font-size:13px;">Нет ответа — попробуй ещё раз</span>';
              }
            }
            finalizeAI(aiEl, full);
            // Show download button for multi-file projects
            if(data.has_project && currentChatId) {
              showDownloadButton(aiMsgEl, currentChatId);
            }
            // Check for incomplete response and show continue button
            // If finish_reason is 'length', response was truncated - show continue button
            const mid = data.message_id || aiMsgEl?.dataset.messageId;
            if(data.finish_reason === 'length' || (data.finish_reason !== 'stop' && isIncompleteResponse(full))) {
              if(mid && currentChatId) {
                showContinueButton(aiMsgEl, mid, currentChatId);
              }
            }
          }
        }catch(_){}
      }
    }
    if(done) break;
  }
}

function isIncompleteResponse(text) {
  if (!text || text.length < 10) return false;
  const trimmed = text.trim();
  const lastChar = trimmed.slice(-1);
  // Common sentence endings
  const sentenceEnders = '.!?。！？…';
  // Check for unclosed code blocks
  const codeBlocks = (text.match(/```/g) || []).length;
  if (codeBlocks % 2 !== 0) return true;
  // Check for unclosed inline code
  const inlineCodes = (text.match(/`/g) || []).length;
  if (inlineCodes % 2 !== 0) return true;
  // Ends with ... (truncation indicator)
  if (trimmed.endsWith('...')) return true;
  // Check for unclosed parentheses, brackets, braces
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens !== closeParens) return true;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) return true;
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) return true;
  // Check for HTML-like unclosed tags
  const openTags = (text.match(/<[a-zA-Z][^>]*>/g) || []).length;
  const closeTags = (text.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
  if (openTags !== closeTags) return true;
  // If response ends with code block (```) - check if it's complete
  // Find all code blocks and check if there's content after the last one
  const codeBlockRegex = /```[\s\S]*?```/g;
  const blocks = [...trimmed.matchAll(codeBlockRegex)];
  if (blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1];
    const lastBlockEnd = lastBlock.index + lastBlock[0].length;
    const contentAfter = trimmed.slice(lastBlockEnd).trim();
    // If nothing after code block, it might be incomplete (unless it's a short code-only response)
    if (!contentAfter && trimmed.length > 500) {
      return true;
    }
  }
  // If last character is not a sentence ender, likely incomplete
  // But only for longer texts that look like they should end
  if (text.length > 200 && !sentenceEnders.includes(lastChar)) {
    // Check last 50 chars for any ending punctuation
    const lastChunk = trimmed.slice(-50);
    const hasEnding = /[.!?。！？…][\s\n]*$/.test(lastChunk);
    if (!hasEnding) return true;
  }
  return false;
}

function showContinueButton(msgEl, messageId, chatId) {
  if (!msgEl) return;
  // Check if button already exists
  if (msgEl.querySelector('.continue-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'continue-btn';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v12M2 8l6 6 6-6"/></svg> Продолжить';
  btn.onclick = () => continueMessage(msgEl, messageId, chatId);
  btn.style.cssText = 'margin-top:12px;padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;opacity:0.9;transition:opacity 0.15s;';
  btn.onmouseover = () => btn.style.opacity = '1';
  btn.onmouseout = () => btn.style.opacity = '0.9';
  msgEl.appendChild(btn);
}

function showDownloadButton(msgEl, chatId) {
  if (!msgEl || !chatId) return;
  // Check if button already exists
  if (msgEl.querySelector('.download-zip-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'download-zip-btn';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 8l4 4 4-4M2 13h12"/></svg> Скачать проект (ZIP)';
  btn.onclick = async () => {
    try {
      btn.disabled = true;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 8l4 4 4-4M2 13h12"/></svg> Загрузка...';
      const response = await fetch(`/api/chats/${chatId}/export-zip`, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка загрузки');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${chatId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 8l4 4 4-4M2 13h12"/></svg> Скачать проект (ZIP)';
      btn.disabled = false;
    } catch (error) {
      console.error('Download error:', error);
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 8l4 4 4-4M2 13h12"/></svg> Ошибка';
      setTimeout(() => {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 8l4 4 4-4M2 13h12"/></svg> Скачать проект (ZIP)';
        btn.disabled = false;
      }, 2000);
    }
  };
  btn.style.cssText = 'margin-top:8px;padding:6px 14px;background:var(--pro);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;opacity:0.9;transition:opacity 0.15s;';
  btn.onmouseover = () => btn.style.opacity = '1';
  btn.onmouseout = () => btn.style.opacity = '0.9';
  msgEl.appendChild(btn);
}

async function continueMessage(msgEl, messageId, chatId) {
  if (!msgEl || !messageId || !chatId) return;
  // Remove the continue button
  const btn = msgEl.querySelector('.continue-btn');
  if (btn) btn.remove();
  // Show thinking indicator
  const aiEl = msgEl.querySelector('.msg-text');
  if (!aiEl) return;
  const thinking = document.createElement('div');
  thinking.className = 'thinking-indicator';
  thinking.innerHTML = '<div class="dots"><span></span><span></span><span></span></div><span>Продолжаю...</span>';
  thinking.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--text3);font-size:13px;';
  aiEl.appendChild(thinking);
  try {
    const resp = await fetch(`/api/chats/${chatId}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId })
    });
    if (!resp.ok) {
      thinking.remove();
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 429 && err.upgrade) {
        showUpgradeModal(err);
      } else {
        showToast('toastError', err.message || 'Ошибка продолжения');
        // Restore button on error
        showContinueButton(msgEl, messageId, chatId);
      }
      return;
    }
    // Handle continuation stream
    const reader = resp.body.getReader();
    const originalContent = msgEl.dataset.fullContent || '';
    let newContent = ''; // Only tracks new content from this stream
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buf += new TextDecoder().decode(value);
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.err) {
              thinking.remove();
              showToast('toastError', 'Ошибка: ' + data.err);
              showContinueButton(msgEl, messageId, chatId);
              return;
            }
            if (data.content) {
              newContent += data.content;
              // Combine original + new content for display
              const combined = originalContent + newContent;
              aiEl.innerHTML = renderMD(combined);
              msgEl.dataset.fullContent = combined;
              scrollBot();
            }
            if (data.done) {
              thinking.remove();
              // Final render with all content
              const finalContent = originalContent + newContent;
              aiEl.innerHTML = renderMD(finalContent);
              msgEl.dataset.fullContent = finalContent;
              // Check if still incomplete
              if (isIncompleteResponse(finalContent)) {
                showContinueButton(msgEl, messageId, chatId);
              }
              // Highlight code blocks
              aiEl.querySelectorAll('pre code').forEach(el => {
                try { hljs.highlightElement(el); } catch(_) {}
              });
              renderMathInElement(aiEl);
              return; // Exit function when done
            }
          } catch (_) {}
        }
      }
      if (done) {
        // Stream ended - finalize if not already done
        thinking.remove();
        const finalContent = originalContent + newContent;
        aiEl.innerHTML = renderMD(finalContent);
        msgEl.dataset.fullContent = finalContent;
        if (isIncompleteResponse(finalContent)) {
          showContinueButton(msgEl, messageId, chatId);
        }
        aiEl.querySelectorAll('pre code').forEach(el => {
          try { hljs.highlightElement(el); } catch(_) {}
        });
        renderMathInElement(aiEl);
        break;
      }
    }
  } catch (e) {
    thinking.remove();
    showToast('toastError', 'Ошибка соединения');
    showContinueButton(msgEl, messageId, chatId);
  }
}

function showDocsIndicator(msgEl, docsMessage) {
  if (!msgEl) return;
  msgEl.querySelectorAll('.docs-badge-live').forEach(b=>b.remove());
  const badge = document.createElement('div');
  badge.className = 'docs-badge-live';
  badge.style.cssText = `
    display: flex; 
    align-items: center; 
    gap: 8px; 
    padding: 6px 12px; 
    background: linear-gradient(135deg, rgba(25, 195, 125, 0.1), rgba(34, 197, 94, 0.1)); 
    border: 1px solid rgba(25, 195, 125, 0.2); 
    border-radius: 8px; 
    font-size: 11px; 
    color: #19c37d; 
    margin-bottom: 8px; 
    width: fit-content; 
    max-width: 320px;
    opacity: 0.9;
  `;
  const spinner = `<span style="width:12px;height:12px;border:1.5px solid rgba(25, 195, 125, 0.2);border-top-color:#19c37d;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;flex-shrink:0;"></span>`;
  badge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#19c37d" stroke-width="1.5" style="flex-shrink:0;">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
    <span style="font-weight: 500; flex: 1; min-width: 0;">${docsMessage}</span>
    ${spinner}
  `;
  const textEl = msgEl.querySelector('.msg-text');
  if (textEl) textEl.before(badge);
  setTimeout(() => badge.remove(), 4000);
}

function showSmartContextIndicator(msgEl, type) {
  if (!msgEl) return;
  msgEl.querySelectorAll('.smart-ctx-badge').forEach(b=>b.remove());
  const cfg = {
    weather:  { icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`, label: 'Получаю погоду…', color: '#3b82f6' },
    time:     { icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, label: 'Проверяю время…', color: '#8b5cf6' },
    currency: { icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, label: 'Получаю курсы валют…', color: '#f59e0b' },
  };
  const { icon, label, color } = cfg[type] || cfg.time;
  const spinner = `<span style="width:10px;height:10px;border:1.5px solid rgba(0,0,0,.1);border-top-color:${color};border-radius:50%;animation:spin .7s linear infinite;display:inline-block;flex-shrink:0;"></span>`;
  const badge = document.createElement('div');
  badge.className = 'smart-ctx-badge';
  badge.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:99px;font-size:12px;color:${color};margin-bottom:8px;width:fit-content;`;
  badge.innerHTML = `${icon}<span>${label}</span>${spinner}`;
  const textEl = msgEl.querySelector('.msg-text');
  if (textEl) textEl.before(badge);
  setTimeout(() => badge.remove(), 5000);
}
function _genSearchChips(userMsg) {
  if (!userMsg) return [];
  const q = userMsg.trim();
  const chips = [q];
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const stopwords = new Set(['это','что','как','где','кто','для','при','или','про','без','над','под','между','через','который','которая','которое','какой','какая','такой','такое','такая','чем','кого','чего','кому','чему']);
  const meaningful = words.filter(w => !stopwords.has(w));
  if (meaningful.length >= 2) {
    chips.push(meaningful.slice(0, 3).join(' '));
  }
  if (meaningful.length >= 1) {
    chips.push(meaningful[0] + ' отзывы');
  }
  return [...new Set(chips)].slice(0, 3);
}

function showSearchIndicator(msgEl, queries, results) {
  if (!msgEl) return;
  msgEl.querySelectorAll('.search-badge-live').forEach(b=>b.remove());
  const badge = document.createElement('div');
  badge.className = 'search-badge-live';
  badge.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:4px 0 10px;font-size:13px;';

  let chips;
  if (queries && Array.isArray(queries) && queries.length) {
    chips = queries.slice(0, 3);
  } else {
    const userText = msgEl.querySelector('.msg-content')?.innerText || _lastUserMsg || '';
    chips = _genSearchChips(userText);
  }

  const chipsHtml = chips.length
    ? chips.map(q => `<span class="search-query-chip">${esc(String(q).substring(0, 45))}</span>`).join('')
    : `<span class="search-query-chip">поиск<span class="search-spinner-inline"></span></span>`;

  badge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--accent);margin-top:1px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span style="color:var(--accent);font-size:13px;white-space:nowrap;flex-shrink:0;">Searching for</span>
    <span style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${chipsHtml}</span>`;

  const wrapper = msgEl.querySelector('.msg-content-wrapper');
  if (wrapper) {
    wrapper.appendChild(badge);
  } else {
    const textEl = msgEl.querySelector('.msg-text');
    if (textEl) textEl.before(badge);
  }
}

function showSearchSourcesChip(msgEl, sources) {
  if (!msgEl || !sources?.length) return;
  msgEl.querySelectorAll('.search-badge-live').forEach(b=>b.remove());
  const count = sources.length;
  const uid = 'src-'+Math.random().toString(36).substr(2,6);
  const chip=document.createElement('div');
  chip.className='search-results-chip';
  chip.setAttribute('onclick',`toggleSourcesPanel('${uid}')`);
  chip.innerHTML=`
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span>${count} ${count===1?'страница':'страниц'} проанализировано</span>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" id="srcChevron-${uid}"><polyline points="6 9 12 15 18 9"/></svg>`;

  const panel=document.createElement('div');
  panel.className='search-sources-panel'; panel.id=uid;
  sources.forEach(s=>{
    const domain=s.url?(new URL(s.url.startsWith('http')?s.url:'https://'+s.url)).hostname:'';
    const item=document.createElement('div'); item.className='search-source-item';
    item.innerHTML=`
      <img class="search-source-favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=16" onerror="this.style.display='none'" alt="">
      <div style="flex:1;min-width:0;">
        <div class="search-source-title">${esc(s.title||domain)}</div>
        <div class="search-source-url">${esc(domain)}</div>
      </div>
      ${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener" class="search-source-link" onclick="event.stopPropagation()">↗</a>`:''}`;
    panel.appendChild(item);
  });

  const wrapper = msgEl.querySelector('.msg-content-wrapper');
  if (wrapper) {
    wrapper.appendChild(chip);
    wrapper.appendChild(panel);
  } else {
    const textEl=msgEl.querySelector('.msg-text');
    if(textEl){textEl.before(chip);textEl.before(panel);}
  }
}

window.toggleSourcesPanel=function(uid){
  const panel=document.getElementById(uid); if(!panel) return;
  const chevron=document.getElementById('srcChevron-'+uid);
  const isOpen=panel.classList.toggle('open');
  if(chevron) chevron.style.transform=isOpen?'rotate(180deg)':'';
};

const CHAR_PER_TICK=5, TICK_MS=15;
function _ms(){return{el:null,committed:'',queue:[],timer:null,done:false};}
let _stream=_ms();
function _resetStream(){if(_stream.timer)clearTimeout(_stream.timer);_stream=_ms();}

function _tick(){
  const s=_stream; if(!s.el) return;
  if(!s.queue.length){s.timer=null;if(s.done)_finishStream();return;}
  const burst=s.done?s.queue.length:Math.min(CHAR_PER_TICK,s.queue.length);
  s.committed+=s.queue.splice(0,burst).join('');
  s.el.innerHTML=renderMD(s.committed)+(s.done?'':'<span class="stream-cursor"></span>');
  s.el.querySelectorAll('pre code:not(.hljs)').forEach(el => { try { hljs.highlightElement(el); } catch(_){} });
  if (!s.done) renderMathInElement(s.el);
  s.timer=setTimeout(_tick,TICK_MS);
}
let _lastUserMsg = '';

function _extractFnFromRequest(userMsg) {
  if (!userMsg) return null;
  if (!/\u0433\u0440\u0430\u0444\u0438\u043a|\u043d\u0430\u0440\u0438\u0441\u0443\u0439|\u043f\u043e\u0441\u0442\u0440\u043e\u0439|\u043f\u043e\u043a\u0430\u0436\u0438|plot|graph|\u0444\u0443\u043d\u043a\u0446\u0438/i.test(userMsg)) return null;

  const cleanParams = s => s
    .replace(/\u03c0/g, 'pi')
    .replace(/(?<![a-zA-Z0-9.])([a-df-wyz])(?![a-zA-Z0-9.(])/g, '1');

  const normalize = (typeof _normalizeExpr === 'function')
    ? s => _normalizeExpr(cleanParams(s))
    : s => cleanParams(s).replace(/\^/g,'**').replace(/(\d)(x)/g,'$1*$2');

  const extractRHS = raw => {
    raw = raw.replace(/^[a-zA-Z_]\w*\s*=\s*/, '').trim();
    raw = raw.replace(/[.!?\s]+$/, '');
    return raw;
  };

  const pats = [
    /y\s*=\s*(.+)/i,
    /(?:\u0444\u0443\u043d\u043a\u0446\u0438[\u044e\u0438]|\u0433\u0440\u0430\u0444\u0438\u043a|graph|plot)\s+(?:y\s*=\s*)?(.+)/i,
    /\b((?:cos|sin|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log|sqrt|cbrt|abs)\s*\([^)]+\).*)/i,
  ];

  for (const pat of pats) {
    const m = userMsg.match(pat);
    if (!m) continue;
    const captured = (m[1]||m[0]).trim();
    const raw = extractRHS(captured);
    if (!raw.toLowerCase().includes('x')) continue;
    let fn;
    try { fn = normalize(raw); } catch(_) { continue; }
    try {
      const v = new Function('x', '"use strict"; return (' + fn + ');')(1);
      if (!isFinite(v)) continue;
    } catch(_) { continue; }
    const isTrig = /cos|sin|tan/i.test(raw);
    return { fn, raw, xRange: isTrig ? [-2*Math.PI, 2*Math.PI] : [-10, 10] };
  }
  return null;
}
function _tryInjectGraphFallback(el, aiText, userMsg) {
  try {
    if (!el) return;
    if (el.querySelector('.averon-plotly-wrap')) return;
    if (/```python/i.test(aiText)) return;
    const parsed = _extractFnFromRequest(userMsg);
    if (!parsed) return;
    if (typeof renderPlotlyGraph !== 'function') return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:10px 0;';
    renderPlotlyGraph(wrap, {
      exprs: [{ fn: parsed.fn, label: null }],
      title: 'График функции',
      xRange: parsed.xRange
    });
    el.appendChild(wrap);
  } catch(e) {}
}

function _finishStream(){
  const s=_stream;
  if(!s.el) return;
  s.el.innerHTML=renderMD(s.committed);
  s.el.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch(_){} });
  renderMathInElement(s.el);
  if (window._resolveGraphPlaceholders) window._resolveGraphPlaceholders(s.el);
  _tryInjectGraphFallback(s.el, s.committed, _lastUserMsg);
  // Store full content in parent message element dataset
  const msgEl = s.el.closest('.msg');
  if (msgEl) msgEl.dataset.fullContent = s.committed;
  _resetStream();
}

function updateAI(el,full){
  if(!el)return;
  if(_stream.el&&_stream.el!==el)_resetStream();
  _stream.el=el;_stream.done=false;
  const n=full.slice(_stream.committed.length+_stream.queue.length).split('');
  if(n.length)_stream.queue.push(...n);
  if(!_stream.timer)_stream.timer=setTimeout(_tick,0);
}
function finalizeAI(el,full){if(!el)return;_stream.el=el;_stream.done=true;if(!_stream.queue.length)_finishStream();}


function thinkingHTML(){return`<div class="thinking"><div class="dots"><span></span><span></span><span></span></div><span style="color:var(--text3);font-size:13px;margin-left:6px;">Думаю…</span></div>`;}
function scrollBot(){
  requestAnimationFrame(() => {
    const isNearBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 100;
    if (isNearBottom) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  });
}

function scrollBotForce(){
  requestAnimationFrame(() => {
    scrollArea.scrollTop = scrollArea.scrollHeight;
  });
}
function showCtx(e,id){
  ctxChatId=id;
  const x=Math.min(e.clientX+4,window.innerWidth-180), y=Math.min(e.clientY,window.innerHeight-100);
  ctxMenu.style.left=x+'px'; ctxMenu.style.top=y+'px'; ctxMenu.classList.add('open');
}
function hideCtx(){ctxMenu.classList.remove('open');ctxChatId=null;}

window.ctxRename=async()=>{
  const id=ctxChatId; hideCtx();
  const chat=allChats.find(c=>c.id===id); if(!chat) return;
  const t=await showDialog({title:'Переименовать чат',msg:'',type:'info',input:true,inputDefault:chat.title,inputPlaceholder:'Название чата',buttons:[{label:'Отмена',value:null},{label:'Сохранить',value:true,primary:true}]});
  if(t&&t!==true){
    await fetch(`/api/chats/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t})});
    chat.title=t; renderChats(allChats); if(currentChatId===id)updatePageTitle(t);
  }
};
window.ctxDelete=async()=>{
  const id=ctxChatId; hideCtx();
  const ok=await showDialog({title:'Удалить чат',msg:'Это действие нельзя отменить.',type:'danger',buttons:[{label:'Отмена',value:false},{label:'Удалить',value:true,danger:true}]});
  if(!ok) return;
  await fetch(`/api/chats/${id}`,{method:'DELETE'});
  if(currentChatId===id){currentChatId=null;showWelcome();}
  allChats=allChats.filter(c=>c.id!==id); renderChats(allChats);
};

window.applyTheme=function(mode){
  const prefer=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  document.documentElement.setAttribute('data-theme', prefer);
};
window.setAccentColor=function(color,el){
  document.documentElement.style.setProperty('--accent',color);
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-dim',`rgba(${r},${g},${b},0.12)`);
  localStorage.setItem('averon-accent',color);
  if(el){
    document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
    el.classList.add('active');
  }
};
window.switchSettingsTab=async(btn, tab)=>{
  document.querySelectorAll('.settings-nav-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  
  const content = document.querySelector('.settings-content');
  if(!content) return;
  content.innerHTML = '';
  
  if(tab === 'profile') showProfileTab();
  else if(tab === 'general') showGeneralTab();
  else if(tab === 'personality') showPersonalityTab();
  else if(tab === 'data') showDataTab();
  else if(tab === 'subscription') showSubscriptionTab();
};

function showProfileTab(){
  const content = document.querySelector('.settings-content');
  content.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title"> Основная информация</h3>
      <div class="settings-card highlight">
        <div class="settings-group">
          <label>Имя</label>
          <input type="text" class="settings-input" id="userName" placeholder="Как тебя зовут?">
          <div class="settings-group-desc">Используется для персонализации</div>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h3 class="settings-section-title">Профессиональные данные</h3>
      <div class="settings-card">
        <div class="settings-group">
          <label>Должность/Роль</label>
          <input type="text" class="settings-input" id="userRole" placeholder="Разработчик, дизайнер, e.t.c">
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-group">
          <label>Возраст</label>
          <input type="text" class="settings-input" id="userAge" placeholder="Опционально">
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Инструкции о себе</h3>
      <div class="settings-card highlight">
        <div class="settings-group">
          <label>Расскажите о себе</label>
          <textarea class="settings-input" id="selfInstructions" rows="4" placeholder="Напишите о себе, своих предпочтениях, стиле общения и т.д."></textarea>
          <div class="settings-group-desc">Эта информация поможет AI лучше адаптировать ответы под вас</div>
        </div>
      </div>
    </div>
  `;
  loadCurrentSettings();
}

function showGeneralTab(){
  const content = document.querySelector('.settings-content');
  const savedAccent = localStorage.getItem('averon-accent') || '#19c37d';
  const smokeEnabled = localStorage.getItem('averon-smoke') !== 'false';
  const accentColors = [
    { val: '#19c37d', name: 'Зелёный' },
    { val: '#ff8c00', name: 'Оранжевый' },
    { val: '#3b82f6', name: 'Синий' },
    { val: '#8b5cf6', name: 'Фиолетовый' },
    { val: '#ef4444', name: 'Красный' },
    { val: '#ec4899', name: 'Розовый' },
    { val: '#06b6d4', name: 'Голубой' },
    { val: '#f59e0b', name: 'Жёлтый' },
  ];
  const curAccentName = accentColors.find(c => c.val === savedAccent)?.name || 'Зелёный';
  content.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">Общее</h3>
        <div class="settings-row">
          <div class="settings-row-label">Акцентный цвет</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="display:flex;gap:6px;">
              ${accentColors.map(c => `<button class="color-swatch ${savedAccent===c.val?'active':''}" data-color="${c.val}" title="${c.name}" onclick="setAccentColor('${c.val}',this);showGeneralTab();" style="background:${c.val};width:20px;height:20px;border-radius:50%;border:2px solid ${savedAccent===c.val?'var(--text)':'transparent'};cursor:pointer;transition:border-color .15s;flex-shrink:0;"></button>`).join('')}
            </div>
            <span style="font-size:13px;color:var(--text2);">${curAccentName}</span>
          </div>
        </div>
        <div class="settings-row" style="border-top:1px solid var(--border);margin-top:0;padding-top:14px;">
          <div class="settings-row-label">Язык</div>
          <div class="custom-select" id="csLang">
            <button class="custom-select-btn" onclick="toggleCustomSelect('csLang')">
              <span class="cs-label" id="langLabel">Автоматически определять</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <input type="hidden" id="language" value="auto">
            <div class="custom-select-drop">
              <div class="custom-select-option selected" data-value="auto" onclick="selectOption('csLang','auto','Автоматически определять');document.getElementById('language').value='auto';">Автоматически определять</div>
              <div class="custom-select-option" data-value="russian" onclick="selectOption('csLang','russian','Русский');document.getElementById('language').value='russian';">Русский</div>
              <div class="custom-select-option" data-value="english" onclick="selectOption('csLang','english','English');document.getElementById('language').value='english';">English</div>
            </div>
          </div>
        </div>
        <div class="settings-row" style="border-top:1px solid var(--border);margin-top:0;padding-top:14px;">
          <div class="settings-row-label">
            Разговорный язык
            <div style="font-size:12px;color:var(--text3);font-weight:400;margin-top:2px;max-width:240px;line-height:1.4;">Для достижения наилучших результатов выберите язык, на котором вы в основном говорите.</div>
          </div>
          <div class="custom-select" id="csSpeechLang">
            <button class="custom-select-btn" onclick="toggleCustomSelect('csSpeechLang')">
              <span class="cs-label">Автоматически определять</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <input type="hidden" value="auto">
            <div class="custom-select-drop">
              <div class="custom-select-option selected" data-value="auto" onclick="selectOption('csSpeechLang','auto','Автоматически определять');">Автоматически определять</div>
              <div class="custom-select-option" data-value="ru" onclick="selectOption('csSpeechLang','ru','Русский');">Русский</div>
              <div class="custom-select-option" data-value="en" onclick="selectOption('csSpeechLang','en','English');">English</div>
            </div>
          </div>
        </div>
        <div class="settings-row" style="border-top:1px solid var(--border);margin-top:0;padding-top:14px;">
          <div class="settings-row-label">Голос озвучки</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn-secondary" id="voicePreviewBtn" style="padding:6px 12px;font-size:12.5px;display:flex;align-items:center;gap:6px;flex-shrink:0;" onclick="previewVoice(this)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Слушать
            </button>
            <div class="custom-select" id="csVoice" style="min-width:160px;">
              <button class="custom-select-btn" onclick="toggleCustomSelect('csVoice')">
                <span class="cs-label" id="csVoiceLabel">${({'default':'Светлана','dmitry':'Дмитрий','dariya':'Дарья'})[localStorage.getItem('averon-tts-voice')||'default']||'Светлана'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <input type="hidden" id="ttsVoiceInput" value="${localStorage.getItem('averon-tts-voice')||'default'}">
              <div class="custom-select-drop">
                <div class="custom-select-option${(localStorage.getItem('averon-tts-voice')||'default')==='default'?' selected':''}" data-value="default" onclick="selectOption('csVoice','default','Светлана');setTtsVoice('default');">
                  Светлана <span style="font-size:11px;color:var(--text3);margin-left:4px;">женский</span>
                </div>
                <div class="custom-select-option${localStorage.getItem('averon-tts-voice')==='dmitry'?' selected':''}" data-value="dmitry" onclick="selectOption('csVoice','dmitry','Дмитрий');setTtsVoice('dmitry');">
                  Дмитрий <span style="font-size:11px;color:var(--text3);margin-left:4px;">мужской</span>
                </div>
                <div class="custom-select-option${localStorage.getItem('averon-tts-voice')==='dariya'?' selected':''}" data-value="dariya" onclick="selectOption('csVoice','dariya','Дарья');setTtsVoice('dariya');">
                  Дарья <span style="font-size:11px;color:var(--text3);margin-left:4px;">женский</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  loadCurrentSettings();
}
function loadCurrentSettings(){
  const s=window.currentSettings || {};
  if(s.default_model){currentModel=s.default_model;setModelUI(s.default_model);}
  searchOn = s.search_enabled === 'true';
  localStorage.setItem('averon-search', searchOn ? 'true' : 'false');
  ['searchToggleW','searchToggle'].forEach(id => document.getElementById(id)?.classList.toggle('active', searchOn));
  searchStrip?.classList.toggle('show', searchOn);
  searchStripW?.classList.toggle('show', searchOn);
  const smokeEnabled = s.smoke_enabled !== 'false';
  localStorage.setItem('averon-smoke', smokeEnabled ? 'true' : 'false');
  applySmokeSetting(smokeEnabled);
  const savedAccent = s.accent_color || localStorage.getItem('averon-accent') || '#19c37d';
  if(savedAccent) {
    document.documentElement.style.setProperty('--accent', savedAccent);
    const r = parseInt(savedAccent.slice(1,3),16), g = parseInt(savedAccent.slice(3,5),16), b = parseInt(savedAccent.slice(5,7),16);
    document.documentElement.style.setProperty('--accent-dim',`rgba(${r},${g},${b},0.12)`);
  }
}

window.previewVoice = async function(btn) {
  const origHTML = btn.innerHTML;
  const stopHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Стоп';
  if (btn.dataset.playing === '1') {
    _stopCurrentAudio();
    btn.innerHTML = origHTML;
    btn.dataset.playing = '';
    return;
  }
  btn.innerHTML = stopHTML;
  btn.dataset.playing = '1';
  const sampleText = 'Привет! Я Averon — твой умный помощник. Это звучит вот так.';
  try {
    const ok = await _speakViaBackend(sampleText, { classList:{add:()=>{},remove:()=>{}}, innerHTML:'', title:'' });
    if (!ok) {
      const utter = new SpeechSynthesisUtterance(sampleText);
      utter.lang = 'ru-RU'; utter.rate = 0.95;
      utter.onend = () => { btn.innerHTML = origHTML; btn.dataset.playing = ''; };
      window.speechSynthesis.speak(utter);
      return;
    }
  } catch(e) {}
  setTimeout(() => { btn.innerHTML = origHTML; btn.dataset.playing = ''; }, 4000);
};

function showPersonalityTab(){
  const content = document.querySelector('.settings-content');
  const savedAccent = localStorage.getItem('averon-accent') || '#19c37d';
  
  content.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">Акцентный цвет</h3>
      <div class="settings-card">
        <div class="accent-colors">
          <button class="color-swatch ${savedAccent === '#19c37d' ? 'active' : ''}" data-color="#19c37d" onclick="setAccentColor('#19c37d',this); showPersonalityTab();" style="background:#19c37d"></button>
          <button class="color-swatch ${savedAccent === '#3b82f6' ? 'active' : ''}" data-color="#3b82f6" onclick="setAccentColor('#3b82f6',this); showPersonalityTab();" style="background:#3b82f6"></button>
          <button class="color-swatch ${savedAccent === '#8b5cf6' ? 'active' : ''}" data-color="#8b5cf6" onclick="setAccentColor('#8b5cf6',this); showPersonalityTab();" style="background:#8b5cf6"></button>
          <button class="color-swatch ${savedAccent === '#f59e0b' ? 'active' : ''}" data-color="#f59e0b" onclick="setAccentColor('#f59e0b',this); showPersonalityTab();" style="background:#f59e0b"></button>
          <button class="color-swatch ${savedAccent === '#ef4444' ? 'active' : ''}" data-color="#ef4444" onclick="setAccentColor('#ef4444',this); showPersonalityTab();" style="background:#ef4444"></button>
          <button class="color-swatch ${savedAccent === '#ec4899' ? 'active' : ''}" data-color="#ec4899" onclick="setAccentColor('#ec4899',this); showPersonalityTab();" style="background:#ec4899"></button>
          <button class="color-swatch ${savedAccent === '#06b6d4' ? 'active' : ''}" data-color="#06b6d4" onclick="setAccentColor('#06b6d4',this); showPersonalityTab();" style="background:#06b6d4"></button>
          <button class="color-swatch ${savedAccent === '#6366f1' ? 'active' : ''}" data-color="#6366f1" onclick="setAccentColor('#6366f1',this); showPersonalityTab();" style="background:#6366f1"></button>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h3 class="settings-section-title">Модель AI</h3>
      <div class="settings-card">
        <div class="settings-group">
          <label>Модель по умолчанию</label>
          <select class="settings-select" id="defaultModel" onchange="if(typeof triggerAutoSave==='function')triggerAutoSave();">
            <option value="flash">Flash - Быстрая и лёгкая</option>
            <option value="codex">Codex - Для кода</option>
          </select>
          <div class="settings-group-desc">Какую модель использовать по умолчанию</div>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h3 class="settings-section-title">Память и контекст</h3>
      <div class="settings-card">
        <label class="settings-toggle">
          <input type="checkbox" id="memoryEnabled">
          <span class="settings-toggle-switch"></span>
          <span>Сохранять память между сеансами</span>
        </label>
        <div class="settings-group-desc" style="margin-left:56px">AI будет помнить важные детали о тебе</div>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Стиль общения</h3>
      <div class="settings-card">
        <div class="settings-group">
          <label>Стиль разговора</label>
          <select class="settings-select" id="conversationStyle" onchange="if(typeof triggerAutoSave==='function')triggerAutoSave();">
            <option value="friend">Друг — дружелюбный, неформальный</option>
            <option value="bro">Брат — братский, поддерживающий</option>
            <option value="mate">Кент — уличный, честный</option>
            <option value="teacher">Учитель — мудрый, объясняющий</option>
            <option value="zek">Зек — тюремный жаргон, прямой</option>
          </select>
          <div class="settings-group-desc">Как AI будет общаться с тобой</div>
        </div>
      </div>
    </div>
  `;
  loadCurrentSettings();
}

function showDataTab(){
  const content = document.querySelector('.settings-content');
  content.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">Управление данными</h3>
      <div class="settings-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span>Здесь ты можешь управлять сохранённой информацией</span>
      </div>
    </div>
    
    <div class="settings-section">
      <h3 class="settings-section-title">🧹 Очистка</h3>
      <div class="settings-card">
        <div class="settings-group">
          <label>Очистить память</label>
          <button class="settings-btn" onclick="clearAllMemory()" style="max-width:200px">🗑️ Очистить память AI</button>
          <div class="settings-group-desc">Удаляет только сохранённые факты о тебе</div>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-group">
          <label>Полная очистка</label>
          <button class="settings-btn danger" onclick="if(confirm('Уверен? Это удалит ВСЕ данные!')) clearAllData()" style="max-width:200px">🚨 Удалить всё</button>
          <div class="settings-group-desc">Удаляет все чаты, память и данные (необратимо!)</div>
        </div>
      </div>
    </div>
  `;
}

function loadCurrentSettings(){
  const s = window.currentSettings || {};
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAge = document.getElementById('userAge');
  const selfInstructions = document.getElementById('selfInstructions');
  const language = document.getElementById('language');
  const tone = document.getElementById('tone');
  const defaultModel = document.getElementById('defaultModel');
  const memoryEnabled = document.getElementById('memoryEnabled');
  const personality = document.getElementById('personality');
  const verbosity = document.getElementById('verbosity');
  const searchEnabled = document.getElementById('searchEnabled');
  const conversationStyle = document.getElementById('conversationStyle');

  if(userName) userName.value = s.user_name || '';
  if(userRole) userRole.value = s.user_role || '';
  if(userAge) userAge.value = s.user_age || '';
  if(selfInstructions) selfInstructions.value = s.self_instructions || '';
  if(language) language.value = s.language || 'russian';
  if(tone) tone.value = s.tone || 'casual';
  if(defaultModel) defaultModel.value = s.default_model || 'flash';
  if(memoryEnabled) memoryEnabled.checked = s.memory_enabled !== 'false';
  if(personality) personality.value = s.personality || 'default';
  if(verbosity) verbosity.value = s.verbosity || 'normal';
  if(searchEnabled) searchEnabled.checked = s.search_enabled === 'true';
  if(conversationStyle) conversationStyle.value = s.conversation_style || 'friend';
}
let _subInvoiceId = null;
let _subCheckTimer = null;

async function showSubscriptionTab() {
  const content = document.querySelector('.settings-content');
  if (!content) return;
  content.innerHTML = `
    <div style="padding:8px 0">
      <div style="height:80px;background:var(--bg3);border-radius:12px;margin-bottom:16px;animation:pulse 1.5s ease infinite"></div>
      <div style="height:120px;background:var(--bg3);border-radius:10px;animation:pulse 1.5s ease infinite"></div>
    </div>`;

  let sub = null;
  try {
    const r = await fetch('/api/subscription/status');
    if (r.ok) sub = await r.json();
  } catch(_) {}

  _subInvoiceId = null;
  clearInterval(_subCheckTimer);
  _renderSubTab(content, sub);
}

function _daysLeft(expiresAt) {
  if (!expiresAt) return 0;
  const now = new Date();
  const exp = new Date(expiresAt);
  const ms = exp - now;
  return Math.max(0, Math.ceil(ms / 86400000));
}

function _renderSubTab(content, sub) {
  const active    = sub?.active;
  const plan      = sub?.plan || 'pro';
  const expiresAt = sub?.expires_at || null;
  const daysLeft  = _daysLeft(expiresAt);
  const expDate   = expiresAt ? new Date(expiresAt).toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'}) : null;
  const used      = sub?.codex_used  ?? 0;
  const limit     = sub?.codex_limit ?? 20;
  const pct       = Math.min(100, Math.round((used / limit) * 100));
  const barClass  = pct >= 90 ? 'danger' : pct >= 65 ? 'warn' : '';
  const urgentDays = daysLeft <= 3 && active;
  const planName = plan === 'heavy' ? 'Heavy' : 'Pro';
  const planColor = plan === 'heavy' ? '#9b59b6' : '#3b82f6';

  content.innerHTML = `
    <div style="padding:4px 0">

      ${active ? `
      <div class="sub-hero">
        <div class="sub-hero-icon" style="background:${plan === 'heavy' ? 'rgba(155,89,182,.15)' : ''};color:${planColor}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div class="sub-hero-text">
          <div class="sub-active-badge" style="background:${plan === 'heavy' ? 'rgba(155,89,182,.1)' : ''};border-color:${plan === 'heavy' ? 'rgba(155,89,182,.3)' : ''};color:${planColor}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            ${planName} активна
          </div>
          <div class="sub-expires" style="${urgentDays ? 'color:#f87171;font-weight:600;' : ''}">
            ${urgentDays
              ? `⚠ Истекает через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
              : `Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} · до ${expDate}`
            }
          </div>
        </div>
      </div>

      <div class="sub-streak-block">
        <div class="sub-streak-bar">
          <div class="sub-streak-fill" style="width:${Math.min(100, (daysLeft / 30) * 100).toFixed(1)}%"></div>
        </div>
        <div class="sub-streak-labels">
          <span style="color:var(--text3);font-size:12px;">Сегодня</span>
          <span style="color:var(--text3);font-size:12px;">${expDate}</span>
        </div>
      </div>` : `
      <div class="sub-hero">
        <div class="sub-hero-icon" style="background:rgba(255,255,255,.06);color:var(--text3)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div class="sub-hero-text">
          <h3>Averon Pro</h3>
          <p>Безлимитный Codex, приоритетный доступ</p>
        </div>
      </div>`}

      ${!active ? `
      <div class="sub-usage">
        <div class="sub-usage-row">
          <span class="sub-usage-label">Codex сегодня</span>
          <span class="sub-usage-val">${used} / ${limit}</span>
        </div>
        <div class="sub-progress">
          <div class="sub-progress-bar ${barClass}" style="width:${pct}%"></div>
        </div>
      </div>` : ''}

      <div class="sub-features">
        <div class="sub-feature"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Flash — безлимит</div>
        <div class="sub-feature"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Raw — безлимит</div>
        <div class="sub-feature ${active ? '' : 'locked'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${active ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg>
          Codex — ${active ? 'безлимит' : '20 запросов/день'}
        </div>
        <div class="sub-feature ${active ? '' : 'locked'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${active ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg>
          Приоритетный доступ
        </div>
      </div>

      <div id="subActionArea">
        ${active ? `
          <button class="sub-buy-btn" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);margin-top:4px;" onclick="subStartPayment()">
            Продлить подписку →
          </button>` : `
          <div class="sub-status-msg" id="subStatusMsg"></div>
          <button class="sub-buy-btn" id="subBuyBtn" onclick="subStartPayment()">
            Оформить Pro — $20/мес →
          </button>
          <p class="sub-note">Оплата через CryptoBot · USDT, TON, BTC, ETH</p>`}
      </div>
    </div>`;
}

window.subStartPayment = async function(plan = 'pro') {
  const btn       = document.getElementById('subBuyBtn');
  const actionArea = document.getElementById('subActionArea');
  const statusMsg  = document.getElementById('subStatusMsg');
  if (btn) { btn.disabled = true; btn.textContent = 'Создаю счёт…'; }

  try {
    const r    = await fetch('/api/subscription/create-invoice', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ plan: plan })
    });
    const data = await r.json();

    if (data.error === 'already_subscribed') {
      _showSubStatus('✓ Подписка уже активна — обновляю…', 'paid');
      setTimeout(() => showSubscriptionTab(), 1500);
      return;
    }
    if (data.error || !data.pay_url) {
      _showSubStatus(data.error === 'payment_unavailable'
        ? 'Оплата временно недоступна. Попробуй позже.'
        : 'Ошибка. Попробуй ещё раз.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Оформить Pro — $20/мес →'; }
      return;
    }

    const price = plan === 'heavy' ? '$20' : '$5';
    _subInvoiceId = data.invoice_id;
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="sub-status-msg" id="subStatusMsg"></div>
        <a href="${data.pay_url}" target="_blank" rel="noopener" class="sub-pay-link">
          💎 Оплатить ${price} в CryptoBot →
        </a>
        <button class="sub-check-btn" onclick="subCheckPayment()">
          Проверить оплату
        </button>`;
    }
    clearInterval(_subCheckTimer);
    _subCheckTimer = setInterval(subCheckPayment, 7000);
  } catch(_) {
    _showSubStatus('Ошибка соединения. Проверь интернет.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Оформить Pro — $20/мес →'; }
  }
};

window.startPaymentFromSettings = function(plan) {
  subStartPayment(plan);
};

window.subCheckPayment = async function() {
  if (!_subInvoiceId) return;
  try {
    const r    = await fetch('/api/subscription/check-payment', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({invoice_id: _subInvoiceId})});
    const data = await r.json();

    if (data.status === 'paid') {
      clearInterval(_subCheckTimer);
      _showSubStatus('✓ Оплата получена! Подписка активирована.', 'paid');
      setTimeout(() => showSubscriptionTab(), 1800);
    } else if (data.status === 'expired') {
      clearInterval(_subCheckTimer);
      _showSubStatus('Счет истек. Сделай новый', 'error');
      const area = document.getElementById('subActionArea');
      if (area) area.innerHTML = `
        <div class="sub-status-msg error" id="subStatusMsg">Счёт истёк</div>
        <button class="sub-buy-btn" onclick="subStartPayment()">Создать новый счёт</button>`;
    } else {
      _showSubStatus('Ожидание оплату…', 'pending');
    }
  } catch(_) {}
};

function _showSubStatus(msg, type) {
  const el = document.getElementById('subStatusMsg');
  if (!el) return;
  el.textContent  = msg;
  el.className    = `sub-status-msg ${type}`;
}

window.openSettings=async function(){
  if(userMenu) userMenu.classList.remove('open');
  openModal('settingsModal');
  try {
    const s=await fetch('/api/settings').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}).catch(()=>({}));
    window.currentSettings = s;
    const firstTab = document.querySelector('.settings-nav-btn');
    if(firstTab) switchSettingsTab(firstTab, 'profile');
  } catch(e) {
    const firstTab = document.querySelector('.settings-nav-btn');
    if(firstTab) switchSettingsTab(firstTab, 'profile');
  }
};

window.saveSettings=async()=>{
  const data = {
    user_name: (document.getElementById('userName') || {value:''}).value,
    user_role: (document.getElementById('userRole') || {value:''}).value,
    user_age: (document.getElementById('userAge') || {value:''}).value,
    language: (document.getElementById('language') || {value:'russian'}).value || 'russian',
    tone: (document.getElementById('tone') || {value:'casual'}).value || 'casual',
    default_model: (document.getElementById('defaultModel') || {value:'flash'}).value || 'flash',
    memory_enabled: ((document.getElementById('memoryEnabled') || {checked:true}).checked ? 'true' : 'false'),
    personality: (document.getElementById('personality') || {value:'default'}).value || 'default',
    verbosity: (document.getElementById('verbosity') || {value:'normal'}).value || 'normal',
    search_enabled: ((document.getElementById('searchEnabled') || {checked:false}).checked ? 'true' : 'false'),
    smoke_enabled: ((document.getElementById('smokeEnabled') || {checked:true}).checked ? 'true' : 'false'),
    ai_tone: document.querySelector('#csTone input')?.value || 'friendly',
    self_instructions: (document.getElementById('selfInstructions') || {value:''}).value,
    conversation_style: (document.getElementById('conversationStyle') || {value:'friend'}).value || 'friend'
  };

  try {
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if(r.ok) {
      window.currentSettings = {...window.currentSettings, ...data};
      showToast('toastModel', 'Настройки сохранены');
      if(data.default_model && data.default_model !== currentModel) {
        currentModel = data.default_model;
        setModelUI(currentModel);
      }
      searchOn = data.search_enabled === 'true';
      localStorage.setItem('averon-search', searchOn ? 'true' : 'false');
      ['searchToggleW','searchToggle'].forEach(id => document.getElementById(id)?.classList.toggle('active', searchOn));
      searchStrip?.classList.toggle('show', searchOn);
      searchStripW?.classList.toggle('show', searchOn);
      const smokeEnabled = data.smoke_enabled !== 'false';
      localStorage.setItem('averon-smoke', smokeEnabled ? 'true' : 'false');
      applySmokeSetting(smokeEnabled);
    } else {
      showToast('toastError', 'Ошибка при сохранении');
    }
  } catch(e) {
    showToast('toastError', 'Ошибка при сохранении');
  }
};
window.clearAllChats=async()=>{
  const ok=await showDialog({title:'Удалить все чаты',msg:'Это действие удалит ВСЮ историю чатов. Нельзя отменить.',type:'danger',buttons:[{label:'Отмена',value:false},{label:'Удалить всё',value:true,danger:true}]});
  if(!ok) return;
  const r=await fetch('/api/chats/delete-all',{method:'DELETE'});
  if(r.ok){allChats=[];renderChats([]);currentChatId=null;showWelcome();showToast('toastDeleted','Все чаты удалены');}
};
window.clearAllMemory=async()=>{
  const ok=await showDialog({title:'Удалить память',msg:'Вся сохранённая память будет удалена.',type:'warn',buttons:[{label:'Отмена',value:false},{label:'Удалить',value:true,danger:true}]});
  if(!ok) return;
  const r=await fetch('/api/memory/clear-all',{method:'DELETE'});
  if(r.ok){showToast('toastDeleted','Память очищена');await renderMemory();}
};
window.clearAllData=async()=>{
  const ok=await showDialog({title:'Полная очистка данных',msg:'Будут удалены все чаты, память и паттерны. Это необратимо.',type:'danger',buttons:[{label:'Отмена',value:false},{label:'Удалить всё',value:true,danger:true}]});
  if(!ok) return;
  const ok2=await showDialog({title:'Вы уверены?',msg:'Последнее предупреждение. После этого данные не восстановить.',type:'danger',buttons:[{label:'Отмена',value:false},{label:'Да, удалить',value:true,danger:true}]});
  if(!ok2) return;
  const r=await fetch('/api/data/clear-all',{method:'DELETE'});
  if(r.ok){allChats=[];renderChats([]);currentChatId=null;showWelcome();closeModal('settingsModal');showToast('toastDeleted','Все данные удалены');}
};
window.openMemory=async function(){
  userMenu.classList.remove('open'); await renderMemory(); openModal('memoryModal');
};
async function renderMemory(){
  const items=await fetch('/api/memory').then(r=>r.json()).catch(()=>[]);
  const list=document.getElementById('memList');
  if(!items.length){list.innerHTML='<div class="mem-empty">Память пуста.</div>';return;}
  list.innerHTML=items.map(m=>`
    <div class="mem-item">
      <span class="mem-text">${esc(m.content)}</span>
      <button class="mem-del" onclick="delMemory('${m.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
    </div>`).join('');
}
window.addMemory=async()=>{
  const inp=document.getElementById('memInput'),c=inp.value.trim(); if(!c) return;
  await fetch('/api/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c})});
  inp.value=''; await renderMemory();
};
window.delMemory=async id=>{await fetch(`/api/memory/${id}`,{method:'DELETE'});await renderMemory();};
window.openModal  = id => document.getElementById(id)?.classList.add('open');
window.closeModal = id => {
  document.getElementById(id)?.classList.remove('open');
  if (id === 'settingsModal') { clearInterval(_subCheckTimer); _subInvoiceId = null; }
};

window.showDialog = window.showDialog || function({title,msg,type='warn',input=false,inputDefault='',inputPlaceholder='',buttons}){
  return new Promise(resolve=>{
    const overlay=document.getElementById('dialogOverlay');
    if(!overlay){resolve(null);return;}
    document.getElementById('dialogTitle').textContent=title;
    document.getElementById('dialogMsg').textContent=msg||'';
    const icon=document.getElementById('dialogIcon');
    icon.className=`dialog-icon ${type}`;
    const icons={warn:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,danger:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,info:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`};
    icon.innerHTML=icons[type]||icons.warn;
    const inp=document.getElementById('dialogInput');
    if(input){inp.style.display='block';inp.value=inputDefault||'';inp.placeholder=inputPlaceholder||'';setTimeout(()=>inp.focus(),100);}else inp.style.display='none';
    const btns=document.getElementById('dialogBtns');btns.innerHTML='';
    (buttons||[{label:'OK',value:true,primary:true}]).forEach(b=>{
      const el=document.createElement('button');
      el.className=b.danger?'dialog-btn-ok danger':b.primary?'dialog-btn-ok primary':'dialog-btn-cancel';
      el.style.flex='1';el.textContent=b.label;
      el.onclick=()=>{overlay.classList.remove('open');resolve(input?inp.value.trim():b.value);};
      btns.appendChild(el);
    });
    overlay.classList.add('open');
    inp.onkeydown=e=>{if(e.key==='Enter'){overlay.classList.remove('open');resolve(inp.value.trim());}};
    overlay.onclick=e=>{if(e.target===overlay){overlay.classList.remove('open');resolve(null);}};
  });
};
window.useChip=text=>{msgInputW.value=text;sendBtnW.disabled=false;sendBtnW.classList.add('active');msgInputW.focus();autoH(msgInputW);};
async function loadSettings(){
  const s=await fetch('/api/settings').then(r=>r.json()).catch(()=>({}));
  window.currentSettings = s; // Сохраняем настройки для использования в UI
  if(s.default_model){currentModel=s.default_model;setModelUI(s.default_model);}
  searchOn = s.search_enabled === 'true';
  localStorage.setItem('averon-search', searchOn ? 'true' : 'false');
  ['searchToggleW','searchToggle'].forEach(id => document.getElementById(id)?.classList.toggle('active', searchOn));
  searchStrip?.classList.toggle('show', searchOn);
  searchStripW?.classList.toggle('show', searchOn);
  const smokeEnabled = s.smoke_enabled !== 'false';
  localStorage.setItem('averon-smoke', smokeEnabled ? 'true' : 'false');
  applySmokeSetting(smokeEnabled);
}
async function pruneEmptyChats(){
  const empties=allChats.filter(c=>c.title==='Новый чат');
  await Promise.all(empties.map(async c=>{
    try{const m=await fetch(`/api/chats/${c.id}/messages`).then(r=>r.json());if(!m.length){await fetch(`/api/chats/${c.id}`,{method:'DELETE'});allChats=allChats.filter(x=>x.id!==c.id);}}catch(_){}
  }));
  if(empties.length)renderChats(allChats);
}
async function generateChatTitle(chatId, firstMessage) {
  setChatTitleGenerating(chatId, true);
  try {
    const res = await fetch(`/api/chats/${chatId}/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: firstMessage })
    });
    if (!res.ok) {
      setChatTitleGenerating(chatId, false);
      return;
    }
    const data = await res.json();
    if (!data.title) {
      setChatTitleGenerating(chatId, false);
      return;
    }
    const chat = allChats.find(c => c.id === chatId);
    if (chat) {
      chat.title = data.title;
    }
    setChatTitleGenerating(chatId, false);
    await fadeOutTitleShimmerThenType(chatId, data.title);
    if (currentChatId === chatId) {
      history.replaceState({ chatId }, data.title, `/c/${chatId}`);
    }
  } catch (error) {
    setChatTitleGenerating(chatId, false);
  }
}








function showToast(id,text){
  const el=document.getElementById(id);if(!el)return;
  const span=el.querySelector('span');if(span)span.textContent=text;
  el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000);
}
function esc(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function getExt(l){return({python:'py',javascript:'js',typescript:'ts',html:'html',css:'css',java:'java',cpp:'cpp',go:'go',rust:'rs',ruby:'rb',php:'php',sql:'sql',bash:'sh',json:'json',xml:'xml',yaml:'yml',markdown:'md'})[l]||'txt';}
function toggleDocs() {
  docsOn = !docsOn;
  localStorage.setItem('averon-docs', docsOn ? 'true' : 'false');
  ['docsToggleW','docsToggle'].forEach(id => document.getElementById(id)?.classList.toggle('active', docsOn));
  docsStrip?.classList.toggle('show', docsOn);
  docsStripW?.classList.toggle('show', docsOn);
}

function applySmokeSetting(enabled) {
  const canvas = document.getElementById('smokeCanvas');
  const blurOverlay = document.querySelector('div[style*="backdrop-filter:blur"]');
  
  if (enabled) {
    canvas.style.display = 'block';
    if (blurOverlay) blurOverlay.style.display = 'block';
  } else {
    canvas.style.display = 'none';
    if (blurOverlay) blurOverlay.style.display = 'none';
  }
}

function toggleSmokeSetting() {
  const smokeEnabled = document.getElementById('smokeEnabled')?.checked ?? true;
  localStorage.setItem('averon-smoke', smokeEnabled ? 'true' : 'false');
  applySmokeSetting(smokeEnabled);
}

async function handleImageGeneration() {
  const prompt = prompt('Введите описание для генерации изображения:');
  if (!prompt) return;
  
  const activeInput = msgInputW.value ? msgInputW : msgInput;
  if (!activeInput) return;
  
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: 'flux' })
    });
    const data = await res.json();
    if (data.error) {
      alert('Ошибка: ' + data.error);
      return;
    }
    if (data.image) {
      activeInput.value += `\n![Generated Image](${data.image})`;
      validateInput();
    }
  } catch (error) {
    alert('Ошибка генерации: ' + error.message);
  }
}

async function handleTTS() {
  const activeInput = msgInputW.value ? msgInputW : msgInput;
  if (!activeInput) return;
  
  const text = activeInput.value.trim() || prompt('Введите текст для озвучивания:');
  if (!text) return;
  
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 1000) })
    });
    const data = await res.json();
    if (data.error) {
      alert('Ошибка: ' + data.error);
      return;
    }
    if (data.audio) {
      const audio = new Audio(data.audio);
      audio.play();
    }
  } catch (error) {
    alert('Ошибка TTS: ' + error.message);
  }
}

async function handleCodeExecution() {
  const activeInput = msgInputW.value ? msgInputW : msgInput;
  if (!activeInput) return;
  
  const code = activeInput.value.trim() || prompt('Введите код для выполнения:');
  if (!code) return;
  
  const language = prompt('Язык (python, js, cpp, c, bash):', 'python');
  if (!language) return;
  
  try {
    const res = await fetch('/api/run-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: language.toLowerCase() })
    });
    const data = await res.json();
    if (data.error) {
      alert('Ошибка: ' + data.error);
      return;
    }
    alert(`Выход:\n${data.output}\n\nКод выхода: ${data.exit_code}`);
  } catch (error) {
    alert('Ошибка выполнения: ' + error.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}