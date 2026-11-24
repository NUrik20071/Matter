import { commerceConfig } from './commerce-config.js';

const SERVICES = ['Интерактивный сайт', 'Портфолио', 'Моушн и визуальный дизайн'];
const clean = value => String(value ?? '').trim();

export function buildBrief(values = {}) {
  const rows = [
    'MATTER / БРИФ ПРОЕКТА',
    '',
    `Направление: ${clean(values.service) || SERVICES[0]}`,
    '',
    'Задача:',
    clean(values.description),
    '',
    `Сроки: ${clean(values.deadline) || 'Обсудим'}`,
    `Бюджет: ${clean(values.budget) || 'Обсудим'}`,
    '',
    `Имя: ${clean(values.name) || 'Не указано'}`,
    `Контакт для ответа: ${clean(values.contact) || 'Не указан'}`,
  ];
  return rows.join('\n');
}

export function resolveCommerceConfig(input = {}) {
  const contactEmail = clean(input.contactEmail);
  const validEmail = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(contactEmail);
  const httpsUrl = (value, hosts) => {
    try {
      const parsed = new URL(clean(value));
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
      if (hosts && !hosts.includes(parsed.hostname.toLowerCase())) return '';
      return parsed.href;
    } catch { return ''; }
  };
  const telegramUrl = httpsUrl(input.telegramUrl, ['t.me', 'telegram.me', 'www.telegram.me']);
  const paymentOffering = clean(input.paymentOffering);
  return {
    contactEmail: validEmail ? contactEmail : '',
    telegramUrl,
    paymentOffering,
    paymentUrl: paymentOffering ? httpsUrl(input.paymentUrl) : '',
  };
}

export function initCommerce(overrides = {}) {
  const existing = document.getElementById('matter-brief-dialog');
  if (existing) return existing.matterCommerce;

  const config = resolveCommerceConfig({ ...commerceConfig, ...overrides });
  let mount = document.getElementById('commerce-root');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'commerce-root';
    document.body.append(mount);
  }
  if (!document.querySelector('link[data-matter-commerce]')) {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('./commerce.css', import.meta.url).href;
    sheet.dataset.matterCommerce = '';
    document.head.append(sheet);
  }
  mount.innerHTML = `
    <dialog class="mc-dialog" id="matter-brief-dialog" aria-labelledby="mc-title" aria-describedby="mc-intro">
      <div class="mc-layout">
        <aside class="mc-aside">
          <p class="mc-eyebrow">MATTER / НОВЫЙ ПРОЕКТ</p>
          <h2 id="mc-title">Начнём <br>с вашей <br><em>идеи.</em></h2>
          <p id="mc-intro">Несколько деталей, чтобы превратить замысел в понятную задачу.</p>
          <ol class="mc-progress" aria-label="Этапы брифа">
            <li aria-current="step"><span>01</span> Задача</li>
            <li><span>02</span> Детали</li>
            <li><span>03</span> Ваш бриф</li>
          </ol>
          <p class="mc-aside-note">От первого движения<br>до вашего сайта.</p>
        </aside>
        <div class="mc-main">
          <button class="mc-close" type="button" aria-label="Закрыть бриф">×</button>
          <form class="mc-form" novalidate>
            <section class="mc-step" data-mc-step="0" aria-labelledby="mc-step-0">
              <p class="mc-step-count">01 / 03</p>
              <h3 id="mc-step-0" tabindex="-1">Что создаём?</h3>
              <p class="mc-lead">Выберите направление. Детали и объём обсудим после брифа.</p>
              <fieldset class="mc-services">
                <legend class="mc-sr-only">Направление проекта</legend>
                <label class="mc-service">
                  <input type="radio" name="service" value="Интерактивный сайт" checked>
                  <span class="mc-service-body"><strong>Интерактивный сайт</strong><span>Сайт, в котором движение раскрывает идею.</span></span><span class="mc-radio-mark" aria-hidden="true">↗</span>
                </label>
                <label class="mc-service">
                  <input type="radio" name="service" value="Портфолио">
                  <span class="mc-service-body"><strong>Портфолио</strong><span>Личное пространство для ваших работ.</span></span><span class="mc-radio-mark" aria-hidden="true">↗</span>
                </label>
                <label class="mc-service">
                  <input type="radio" name="service" value="Моушн и визуальный дизайн">
                  <span class="mc-service-body"><strong>Моушн и визуальный дизайн</strong><span>Анимация, материалы и выразительные детали.</span></span><span class="mc-radio-mark" aria-hidden="true">↗</span>
                </label>
              </fieldset>
            </section>
            <section class="mc-step" data-mc-step="1" aria-labelledby="mc-step-1" hidden>
              <p class="mc-step-count">02 / 03</p>
              <h3 id="mc-step-1" tabindex="-1">О чём ваш проект?</h3>
              <p class="mc-lead">Можно своими словами: для кого он, что должен делать и какое чувство оставлять.</p>
              <label class="mc-field" for="mc-description"><span>Идея и задача <span class="mc-required">*</span></span>
                <textarea id="mc-description" name="description" rows="4" minlength="12" maxlength="4000" required placeholder="Хочу создать…" aria-describedby="mc-description-error"></textarea>
              </label>
              <p class="mc-error" id="mc-description-error" hidden></p>
              <div class="mc-field-pair">
                <label class="mc-field" for="mc-deadline"><span>Сроки <small>необязательно</small></span><input id="mc-deadline" name="deadline" maxlength="160" placeholder="Например, к осени"></label>
                <label class="mc-field" for="mc-budget"><span>Бюджет <small>необязательно</small></span><input id="mc-budget" name="budget" maxlength="160" placeholder="Диапазон и валюта"></label>
              </div>
            </section>
            <section class="mc-step" data-mc-step="2" aria-labelledby="mc-step-2" hidden>
              <p class="mc-step-count">03 / 03</p>
              <h3 id="mc-step-2" tabindex="-1">Ваша идея — в деталях.</h3>
              <div class="mc-field-pair">
                <label class="mc-field" for="mc-name"><span>Как к вам обращаться <span class="mc-required">*</span></span><input id="mc-name" name="name" autocomplete="name" maxlength="120" required aria-describedby="mc-name-error"></label>
                <label class="mc-field" for="mc-contact"><span>Контакт для ответа <span class="mc-contact-required"></span></span><input id="mc-contact" name="contact" maxlength="240" placeholder="Email или Telegram" aria-describedby="mc-contact-error"></label>
              </div>
              <p class="mc-error" id="mc-name-error" hidden></p>
              <p class="mc-error" id="mc-contact-error" hidden></p>
              <div class="mc-review" aria-label="Краткое содержание брифа">
                <span class="mc-review-label">ВАШ ПРОЕКТ</span>
                <h4 class="mc-review-service"></h4>
                <p class="mc-review-description"></p>
                <dl><div><dt>Сроки</dt><dd class="mc-review-deadline"></dd></div><div><dt>Бюджет</dt><dd class="mc-review-budget"></dd></div></dl>
              </div>
              <div class="mc-delivery-actions"></div>
              <p class="mc-privacy"></p>
              <div class="mc-copy-fallback" hidden><label for="mc-copy-text">Выделите и скопируйте бриф:</label><textarea id="mc-copy-text" rows="6" readonly></textarea></div>
            </section>
            <p class="mc-status" role="status" aria-live="polite"></p>
            <div class="mc-footer">
              <button class="mc-back" type="button" hidden>← Назад</button>
              <button class="mc-next mc-primary" type="submit">Дальше <span aria-hidden="true">↗</span></button>
            </div>
          </form>
        </div>
      </div>
    </dialog>`;

  const dialog = mount.querySelector('.mc-dialog');
  const form = dialog.querySelector('form');
  const steps = [...dialog.querySelectorAll('.mc-step')];
  const progress = [...dialog.querySelectorAll('.mc-progress li')];
  const next = dialog.querySelector('.mc-next');
  const back = dialog.querySelector('.mc-back');
  const status = dialog.querySelector('.mc-status');
  const fallback = dialog.querySelector('.mc-copy-fallback');
  const contact = form.elements.namedItem('contact');
  const hasDelivery = Boolean(config.contactEmail || config.telegramUrl);
  let step = 0;
  let previousFocus = null;
  let oldOverflow = '';

  contact.required = hasDelivery;
  dialog.querySelector('.mc-contact-required').innerHTML = hasDelivery ? '<span class="mc-required">*</span>' : '<small>необязательно</small>';
  dialog.querySelector('.mc-privacy').textContent = hasDelivery
    ? 'Сайт не отправляет введённые данные на сервер. Вы сами отправляете бриф через выбранный сервис.'
    : 'Бриф сохраняется на вашем устройстве; ничего не отправлено. Сайт не отправляет введённые данные на сервер.';

  const delivery = dialog.querySelector('.mc-delivery-actions');
  if (config.contactEmail) {
    const email = document.createElement('button');
    email.type = 'button'; email.className = 'mc-primary'; email.textContent = 'Открыть письмо ↗';
    email.addEventListener('click', () => {
      if (!validateContact()) return;
      const body = buildBrief(values());
      window.location.href = `mailto:${encodeURIComponent(config.contactEmail)}?subject=${encodeURIComponent(`Проект MATTER — ${values().service}`)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Открываем почтовое приложение с брифом. Письмо нужно отправить самостоятельно.';
    });
    delivery.append(email);
  }
  if (config.telegramUrl) {
    const telegram = document.createElement('a');
    telegram.className = config.contactEmail ? 'mc-secondary' : 'mc-primary';
    telegram.href = config.telegramUrl; telegram.target = '_blank'; telegram.rel = 'noopener noreferrer';
    telegram.textContent = 'Открыть Telegram ↗';
    telegram.addEventListener('click', event => {
      if (!validateContact()) { event.preventDefault(); return; }
      status.textContent = 'Скопируйте бриф кнопкой ниже и вставьте его в сообщение в Telegram.';
    });
    delivery.append(telegram);
  }
  const download = document.createElement('button');
  download.type = 'button'; download.className = hasDelivery ? 'mc-secondary' : 'mc-primary';
  download.textContent = 'Скачать бриф ↓';
  download.addEventListener('click', () => {
    if (!validateContact()) return;
    const url = URL.createObjectURL(new Blob(['\ufeff', buildBrief(values())], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'matter-project-brief.txt'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Файл брифа подготовлен для скачивания. Ничего не отправлено.';
  });
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'mc-secondary'; copy.textContent = 'Скопировать бриф';
  copy.addEventListener('click', async () => {
    if (!validateContact()) return;
    const brief = buildBrief(values());
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(brief);
      fallback.hidden = true;
      status.textContent = 'Бриф скопирован. Можно вставить его в письмо или сообщение.';
    } catch {
      fallback.hidden = false;
      const textarea = fallback.querySelector('textarea');
      textarea.value = brief; textarea.focus(); textarea.select();
      status.textContent = 'Автокопирование недоступно. Скопируйте выделенный текст вручную.';
    }
  });
  delivery.append(download, copy);
  if (config.paymentUrl) {
    const payment = document.createElement('a');
    payment.href = config.paymentUrl; payment.target = '_blank'; payment.rel = 'noopener noreferrer';
    payment.className = 'mc-payment-link'; payment.textContent = `${config.paymentOffering} ↗`;
    delivery.append(payment);
  }

  function values() {
    return Object.fromEntries(new FormData(form).entries());
  }
  function setError(name, text) {
    const field = form.elements.namedItem(name);
    const error = dialog.querySelector(`#mc-${name}-error`);
    field.setAttribute('aria-invalid', text ? 'true' : 'false');
    error.textContent = text; error.hidden = !text;
    return !text;
  }
  function validateDescription() {
    const valid = setError('description', clean(values().description).length < 12 ? 'Добавьте немного деталей о задаче — хотя бы 12 символов.' : '');
    if (!valid) form.elements.namedItem('description').focus();
    return valid;
  }
  function validateContact() {
    const data = values();
    const nameValid = setError('name', clean(data.name) ? '' : 'Укажите, как к вам обращаться.');
    const contactValid = setError('contact', hasDelivery && !clean(data.contact) ? 'Оставьте email или Telegram, чтобы вам могли ответить.' : '');
    if (!nameValid) form.elements.namedItem('name').focus();
    else if (!contactValid) contact.focus();
    return nameValid && contactValid;
  }
  function review() {
    const data = values();
    dialog.querySelector('.mc-review-service').textContent = data.service;
    dialog.querySelector('.mc-review-description').textContent = clean(data.description);
    dialog.querySelector('.mc-review-deadline').textContent = clean(data.deadline) || 'Обсудим';
    dialog.querySelector('.mc-review-budget').textContent = clean(data.budget) || 'Обсудим';
  }
  function showStep(index, focus = true) {
    step = Math.max(0, Math.min(2, index));
    steps.forEach((item, i) => { item.hidden = i !== step; });
    progress.forEach((item, i) => {
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.classList.toggle('mc-complete', i < step);
    });
    back.hidden = step === 0;
    next.hidden = step === 2;
    next.innerHTML = step === 1 ? 'Собрать бриф <span aria-hidden="true">↗</span>' : 'Дальше <span aria-hidden="true">↗</span>';
    status.textContent = '';
    if (step === 2) review();
    if (focus) {
      steps[step].querySelector('h3').focus({ preventScroll: true });
      dialog.scrollTop = 0;
      dialog.querySelector('.mc-main').scrollTop = 0;
    }
  }
  function open(event) {
    if (dialog.open) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const service = event?.detail?.service;
    if (SERVICES.includes(service)) {
      [...form.querySelectorAll('input[name="service"]')].forEach(input => { input.checked = input.value === service; });
    }
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    showStep(step);
    document.dispatchEvent(new CustomEvent('matter:brief-state', { detail: { open: true } }));
  }
  function close() { dialog.close(); }
  const onClose = () => {
    document.body.style.overflow = oldOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('matter:brief-state', { detail: { open: false } }));
  };
  dialog.addEventListener('close', onClose);
  dialog.querySelector('.mc-close').addEventListener('click', close);
  back.addEventListener('click', () => showStep(step - 1));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step === 1 && !validateDescription()) return;
    if (step < 2) showStep(step + 1);
  });
  form.addEventListener('input', event => {
    if (['description', 'name', 'contact'].includes(event.target.name)) setError(event.target.name, '');
  });
  document.addEventListener('matter:brief', open);
  const api = {
    open,
    close,
    destroy() {
      if (dialog.open) close();
      document.removeEventListener('matter:brief', open);
      dialog.remove();
    },
  };
  dialog.matterCommerce = api;
  return api;
}
