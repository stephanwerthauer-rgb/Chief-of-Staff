/* Haven — UI. Gentle by design: one thing at a time, soft words, no red alerts. */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const overlay = $('#overlay');
  const sheet = $('#sheet');
  const focusEl = $('#focus');
  const toastEl = $('#toast');

  let currentScreen = 'today';
  let focusTimer = null;

  /* ================= helpers ================= */

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtMin(min) {
    if (!min || min <= 0) return '';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function fmtDayLabel(dateStr) {
    const today = Store.todayStr();
    if (dateStr === today) return 'Today';
    if (dateStr === Store.todayStr(1)) return 'Tomorrow';
    const d = Store.fromDateStr(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function fmtDeadline(dateStr) {
    const today = Store.todayStr();
    if (dateStr < today) return 'was due ' + fmtDayLabel(dateStr).toLowerCase();
    if (dateStr === today) return 'due today';
    if (dateStr === Store.todayStr(1)) return 'due tomorrow';
    const d = Store.fromDateStr(dateStr);
    return 'due ' + d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function deadlineUrgent(dateStr) {
    return dateStr <= Store.todayStr(1);
  }

  function fmtTime(t) {
    // "14:30" -> localized-ish simple display
    const [h, m] = t.split(':').map(Number);
    const am = h < 12;
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')}${am ? 'am' : 'pm'}`;
  }

  let toastTimeout = null;
  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  const encouragements = [
    'Lovely. One less thing. 🌿',
    'Done and dusted. Well done. ✨',
    'That’s real progress.',
    'Nice — it’s off your mind now.',
    'One gentle step at a time. 🍃',
    'You did the thing. 💛'
  ];
  function cheer() { toast(encouragements[Math.floor(Math.random() * encouragements.length)]); }

  /* ================= navigation ================= */

  function goto(screen) {
    currentScreen = screen;
    $$('.screen').forEach(s => { s.hidden = s.dataset.screen !== screen; });
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === screen));
    window.scrollTo({ top: 0 });
    render();
  }

  $('#tabbar').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) goto(tab.dataset.goto);
  });

  /* ================= sheets ================= */

  function openSheet(html) {
    sheet.innerHTML = html;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    overlay.hidden = true;
    sheet.innerHTML = '';
    document.body.style.overflow = '';
  }
  $('#overlay-backdrop').addEventListener('click', closeSheet);

  /* ================= render root ================= */

  function render() {
    Planner.replan();
    renderBadge();
    if (currentScreen === 'today') renderToday();
    if (currentScreen === 'plan') renderPlan();
    if (currentScreen === 'inbox') renderInbox();
    if (currentScreen === 'settings') renderSettings();
  }

  function renderBadge() {
    const n = Store.state.inbox.length;
    const badge = $('#inbox-badge');
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? '9+' : n;
  }

  /* ================= TODAY ================= */

  function greetingText() {
    const h = new Date().getHours();
    const name = Store.state.settings.name;
    const nm = name ? `, ${name}` : '';
    if (h < 12) return `Good morning${nm}`;
    if (h < 17) return `Good afternoon${nm}`;
    return `Good evening${nm}`;
  }

  function renderToday() {
    const today = Store.todayStr();
    const tasks = Planner.tasksOn(today);
    const doneToday = Planner.doneOn(today);
    const events = Store.eventsOn(today);
    const totalMin = Planner.plannedMinutesOn(today);

    $('#today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#greeting').textContent = greetingText();

    // "too much" calm mode: the whole day shrinks to one small thing
    const calm = Store.state.calm;
    if (calm && calm.date === today) {
      const t = Store.getTask(calm.taskId);
      if (t && !t.done) {
        $('#day-summary').textContent = 'The rest of the day is on pause. Only this exists right now.';
        $('#checkin-slot').innerHTML = '';
        $('#capacity-wrap').hidden = true;
        const step = (t.steps || []).find(s => !s.done);
        $('#now-slot').innerHTML = `
          <div class="now-card">
            <div class="card-label">One small thing</div>
            <div class="now-title">${esc(t.title)}</div>
            ${step ? `<p class="now-step-hint">Just the first bit: <strong>${esc(step.title)}</strong></p>` : ''}
            <div class="now-meta"><span class="chip time">⏱ ${fmtMin(Planner.remainingMinutes(t)) || '—'}</span></div>
            <div class="now-actions">
              <button class="btn btn-primary" data-act="focus" data-id="${t.id}">Begin gently</button>
              <button class="btn btn-soft" data-act="done" data-id="${t.id}">Done ✓</button>
            </div>
          </div>`;
        $('#today-list').innerHTML = '';
        $('#today-events').innerHTML = '';
        $('#day-actions').innerHTML = `<button class="btn btn-ghost btn-block" data-act="calm-exit">Show the whole day again</button>`;
        return;
      }
      Store.state.calm = null;
      Store.save();
    }

    // morning energy check-in shapes the day's capacity
    const checkin = Store.state.checkins[today];
    if (!checkin && (tasks.length || events.length)) {
      $('#checkin-slot').innerHTML = `
        <div class="card checkin-card">
          <div class="card-label">Before anything else</div>
          <p style="font-weight:600; margin-bottom:12px">How's your energy today?</p>
          <div class="triage-grid cols-3">
            <button class="triage-btn" data-act="checkin" data-mood="low"><span class="t-icon">🌧️</span>Running low</button>
            <button class="triage-btn" data-act="checkin" data-mood="ok"><span class="t-icon">😌</span>Okay</button>
            <button class="triage-btn" data-act="checkin" data-mood="good"><span class="t-icon">☀️</span>Good</button>
          </div>
        </div>`;
    } else if (checkin) {
      const icon = { low: '🌧️', ok: '😌', good: '☀️' }[checkin];
      const note = { low: 'A gentle day — the plan is keeping it light.', ok: 'A steady day.', good: 'A bright one.' }[checkin];
      $('#checkin-slot').innerHTML = `
        <button class="chip checkin-chip" data-act="checkin-open">${icon} ${note} <span style="opacity:.55">change</span></button>`;
    } else {
      $('#checkin-slot').innerHTML = '';
    }

    // summary line
    const parts = [];
    if (tasks.length === 0 && doneToday.length === 0 && events.length === 0) {
      $('#day-summary').textContent = 'A clear day. Add something when you’re ready — or just enjoy the space.';
    } else if (tasks.length === 0 && doneToday.length === 0) {
      $('#day-summary').textContent = 'Nothing on the list — just your calendar. The space in between is yours.';
    } else if (tasks.length === 0) {
      $('#day-summary').textContent = 'Everything on today’s list is done. Genuinely — you’re finished.';
    } else {
      parts.push(`${tasks.length} thing${tasks.length === 1 ? '' : 's'} today`);
      if (totalMin) parts.push(`about ${fmtMin(totalMin)} of doing`);
      const feel = totalMin <= 90 ? 'Very doable.' : totalMin <= 180 ? 'Steady does it.' : 'We’ll take it one step at a time.';
      $('#day-summary').textContent = parts.join(' · ') + '. ' + feel;
    }

    // capacity bar
    const cap = Planner.dayBudget(today) + doneToday.reduce((a, t) => a + (t.estimateMin || 30), 0);
    const used = doneToday.reduce((a, t) => a + (t.estimateMin || 30), 0);
    const capWrap = $('#capacity-wrap');
    if (tasks.length || doneToday.length) {
      capWrap.hidden = false;
      const denom = Math.max(cap, used + totalMin, 1);
      const pct = Math.min(100, Math.round((used / denom) * 100));
      $('#capacity-fill').style.width = pct + '%';
      $('#capacity-fill').classList.toggle('full', pct >= 100);
      $('#capacity-label').textContent = used
        ? `${fmtMin(used)} already done today. 🎉`
        : `Today holds about ${fmtMin(denom)} of doing — that’s the whole plan.`;
    } else {
      capWrap.hidden = true;
    }

    // NOW card
    const nowSlot = $('#now-slot');
    if (tasks.length > 0) {
      const t = tasks[0];
      const step = (t.steps || []).find(s => !s.done);
      nowSlot.innerHTML = `
        <div class="now-card">
          <div class="card-label">Just this, for now</div>
          <div class="now-title">${esc(t.title)}</div>
          ${step ? `<p class="now-step-hint">Next tiny step: <strong>${esc(step.title)}</strong></p>` : ''}
          <div class="now-meta">
            <span class="chip time">⏱ ${fmtMin(Planner.remainingMinutes(t)) || '—'}</span>
            ${t.deadline ? `<span class="chip deadline ${deadlineUrgent(t.deadline) ? 'urgent' : ''}">${fmtDeadline(t.deadline)}</span>` : ''}
            ${t.important ? `<span class="chip important">matters to you</span>` : ''}
          </div>
          <div class="now-actions">
            <button class="btn btn-primary" data-act="focus" data-id="${t.id}">Begin gently</button>
            <button class="btn btn-soft" data-act="done" data-id="${t.id}">Done ✓</button>
            <button class="btn btn-ghost btn-sm" data-act="detail" data-id="${t.id}">More…</button>
          </div>
        </div>`;
    } else if (doneToday.length > 0) {
      nowSlot.innerHTML = `
        <div class="done-card">
          <div class="big">🌸</div>
          <h2>That’s everything.</h2>
          <p>You finished ${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} today. The rest of the day is yours — you’ve earned the pause.</p>
        </div>`;
    } else {
      nowSlot.innerHTML = '';
    }

    // rest of today's tasks
    const rest = tasks.slice(1);
    const listEl = $('#today-list');
    let listHtml = '';
    if (rest.length) {
      listHtml += `<p class="section-title">Then, when you’re ready</p>`;
      listHtml += rest.map(taskRow).join('');
    }
    if (doneToday.length) {
      listHtml += `<p class="section-title">Done today 🌿</p>`;
      listHtml += doneToday.map(taskRow).join('');
    }
    listEl.innerHTML = listHtml;

    // events
    const evEl = $('#today-events');
    evEl.innerHTML = events.length
      ? `<p class="section-title">On the calendar</p>` + events.map(eventRow).join('')
      : '';

    // close-day, "too much", Sunday look-back
    const actions = $('#day-actions');
    let actionsHtml = '';
    const evening = new Date().getHours() >= 17;
    if ((evening || tasks.length === 0) && (tasks.length > 0 || doneToday.length > 0)) {
      actionsHtml += `<button class="btn btn-soft btn-block" data-act="close-day">Close the day 🌙</button>`;
    }
    if (tasks.length > 0) {
      actionsHtml += `<button class="btn btn-ghost btn-block" data-act="too-much">Feeling like too much? 🌊</button>`;
    }
    if (new Date().getDay() === 0 && weekDone().length > 0) {
      actionsHtml += `<button class="btn btn-ghost btn-block" data-act="look-back">Your week, gently 🌿</button>`;
    }
    actions.innerHTML = actionsHtml;
  }

  function taskRow(t) {
    const stepsTotal = (t.steps || []).length;
    const stepsDone = (t.steps || []).filter(s => s.done).length;
    return `
      <div class="task-row ${t.done ? 'done' : ''}" data-id="${t.id}">
        <button class="task-check ${t.done ? 'checked' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Mark done">${t.done ? '✓' : ''}</button>
        <div class="task-body" data-act="detail" data-id="${t.id}">
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">
            ${!t.done ? `<span class="chip time">⏱ ${fmtMin(Planner.remainingMinutes(t)) || '—'}</span>` : ''}
            ${t.deadline && !t.done ? `<span class="chip deadline ${deadlineUrgent(t.deadline) ? 'urgent' : ''}">${fmtDeadline(t.deadline)}</span>` : ''}
            ${t.important && !t.done ? `<span class="chip important">matters</span>` : ''}
            ${t.repeat && !t.done ? `<span class="chip">↻ ${t.repeat}</span>` : ''}
            ${t.atRisk && !t.done ? `<span class="chip risk">needs a rethink</span>` : ''}
          </div>
          ${stepsTotal ? `<div class="task-steps-note">${stepsDone}/${stepsTotal} small steps done</div>` : ''}
        </div>
        <button class="task-more" data-act="detail" data-id="${t.id}" aria-label="Details">›</button>
      </div>`;
  }

  function eventRow(e) {
    return `
      <div class="event-row" data-id="${e.id}">
        <span class="event-time">${e.allDay ? 'All day' : fmtTime(e.start)}</span>
        <span class="event-title">${esc(e.title)}</span>
        ${e.allDay ? '' : `<span class="chip time">${fmtMin(e.durationMin)}</span>`}
        ${e.source === 'google'
          ? `<span class="chip" title="From Google Calendar">🗓</span>`
          : `<button class="event-del" data-act="del-event" data-id="${e.id}" aria-label="Remove">×</button>`}
      </div>`;
  }

  /* ================= PLAN ================= */

  function renderPlan() {
    // deadline reassurance / soft warnings
    const risk = Planner.atRiskTasks();
    const notes = $('#deadline-notes');
    const withDeadline = Store.state.tasks.filter(t => !t.done && !t.someday && t.deadline);
    if (risk.length) {
      notes.innerHTML = `
        <div class="note-card">
          <strong>A gentle heads-up.</strong> ${risk.length === 1 ? 'One thing is' : `${risk.length} things are`} tight against ${risk.length === 1 ? 'its' : 'their'} deadline.
          It might help to break ${risk.length === 1 ? 'it' : 'them'} into smaller steps, shorten the estimate, or let something else wait. Tap ${risk.length === 1 ? 'it' : 'one'} below to adjust.
        </div>`;
    } else if (withDeadline.length) {
      notes.innerHTML = `
        <div class="note-card calm">
          <strong>All deadlines are covered.</strong> Everything with a due date has a day reserved before it’s due. You don’t need to hold any of this in your head.
        </div>`;
    } else {
      notes.innerHTML = '';
    }
    const load = Planner.weekLoad();
    if (load.ratio >= 0.9 && !risk.length) {
      notes.innerHTML += `
        <div class="note-card">
          <strong>This week is holding a lot.</strong> About ${fmtMin(load.planned)} of doing across the next seven days.
          If anything can wait, tapping it and choosing “Not today” will let the week breathe.
        </div>`;
    }

    // 14-day view
    const weekEl = $('#week-list');
    let html = '';
    for (let i = 0; i < 14; i++) {
      const dateStr = Store.todayStr(i);
      const tasks = Planner.tasksOn(dateStr);
      const events = Store.eventsOn(dateStr);
      const load = Planner.plannedMinutesOn(dateStr);
      if (i > 6 && tasks.length === 0 && events.length === 0) continue; // keep far-future quiet unless used
      html += `
        <div class="day-block">
          <div class="day-block-head">
            <h2>${fmtDayLabel(dateStr)}</h2>
            ${load ? `<span class="load">about ${fmtMin(load)} of doing</span>` : ''}
          </div>
          ${events.map(eventRow).join('')}
          ${tasks.map(taskRow).join('')}
          ${(!tasks.length && !events.length) ? `<p class="day-empty">Nothing planned. Space is allowed. 🕊️</p>` : ''}
        </div>`;
    }
    weekEl.innerHTML = html;

    // someday
    const someday = Store.state.tasks.filter(t => !t.done && t.someday);
    $('#someday-list').innerHTML = (someday.length
      ? `<p class="section-title">Someday, no pressure</p>` + someday.map(taskRow).join('')
      : '') +
      `<button class="btn btn-ghost btn-block" data-act="look-back" style="margin-top:14px">Everything you’ve done 🌿</button>`;
  }

  /* ================= INBOX ================= */

  function renderInbox() {
    const items = Store.state.inbox;
    const listEl = $('#inbox-list');
    const syncBtn = Connect.isConnected()
      ? `<button class="btn btn-soft btn-block" data-act="sync-now" style="margin-bottom:16px">Check mail &amp; calendar 🔄</button>`
      : '';
    if (!items.length) {
      listEl.innerHTML = syncBtn + `<p class="empty-note">Nothing waiting here. Your head is clear. 🌤️</p>`;
      return;
    }
    listEl.innerHTML = syncBtn + `
      <button class="btn btn-primary btn-block" data-act="triage" style="margin-bottom:16px">
        Sort these together — one at a time (${items.length})
      </button>
      ${items.map(i => `
        <div class="inbox-item">
          <p>${esc(i.text)}${i.link ? ` <a href="${esc(i.link)}" target="_blank" rel="noopener" style="color:var(--sage-deep);font-weight:600;white-space:nowrap">open&nbsp;↗</a>` : ''}</p>
          <button class="event-del" data-act="del-inbox" data-id="${i.id}" aria-label="Remove">×</button>
        </div>`).join('')}`;
  }

  $('#inbox-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#inbox-input');
    const lines = input.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return;
    lines.forEach(l => Store.addInbox(l));
    input.value = '';
    toast(lines.length === 1 ? 'Got it. It’s safe here now.' : `Got all ${lines.length}. They’re safe here now.`);
    render();
  });

  /* ---- triage flow: one item at a time ---- */

  function startTriage() {
    const items = Store.state.inbox;
    if (!items.length) { closeSheet(); render(); toast('All sorted. Lovely. 🌿'); return; }
    const item = items[0];
    openSheet(`
      <p class="triage-count">${items.length} to sort — one at a time, no rush</p>
      <div class="triage-card">${esc(item.text)}${item.link ? `<br><a href="${esc(item.link)}" target="_blank" rel="noopener" style="color:var(--sage-deep);font-size:0.9rem">open the email ↗</a>` : ''}</div>
      <div class="triage-grid">
        <button class="triage-btn" data-act="tri-today" data-id="${item.id}"><span class="t-icon">☀️</span>Today<small>if it truly fits</small></button>
        <button class="triage-btn" data-act="tri-plan" data-id="${item.id}"><span class="t-icon">🗓️</span>Give it a day<small>we’ll find room</small></button>
        <button class="triage-btn" data-act="tri-someday" data-id="${item.id}"><span class="t-icon">🌱</span>Someday<small>parked, not lost</small></button>
        <button class="triage-btn" data-act="tri-drop" data-id="${item.id}"><span class="t-icon">🍂</span>Let it go<small>permission granted</small></button>
        ${Store.state.settings.partnerName ? `<button class="triage-btn" data-act="tri-hand" data-id="${item.id}" style="grid-column:1 / -1"><span class="t-icon">🤝</span>Hand it to ${esc(Store.state.settings.partnerName)}<small>you don’t have to carry everything</small></button>` : ''}
      </div>
      <div class="sheet-actions"><button class="btn btn-ghost" data-act="sheet-close">Pause sorting</button></div>
    `);
  }

  function triageToTask(itemId, opts) {
    const item = Store.state.inbox.find(i => i.id === itemId);
    if (!item) { startTriage(); return; }
    // ask for the details that make the plan work: estimate (+ deadline if scheduling)
    const suggested = item.suggestMin
      ? ESTIMATES.reduce((best, m) => Math.abs(m - item.suggestMin) < Math.abs(best - item.suggestMin) ? m : best, ESTIMATES[0])
      : 30;
    openTaskSheet({
      title: item.text.length > 120 ? item.text.slice(0, 117) + '…' : item.text,
      estimateMin: suggested,
      someday: !!opts.someday,
      pinnedDate: opts.today ? Store.todayStr() : null
    }, () => {
      Store.removeInbox(itemId);
      startTriage();
    }, opts.someday ? 'Parked in “someday” — safe and out of your head.' : null);
  }

  /* ================= ADD sheets ================= */

  function openAddChooser() {
    openSheet(`
      <h2>Add something</h2>
      <p class="sheet-sub">Whatever it is, it only needs a home — not your memory.</p>
      <div class="triage-grid">
        <button class="triage-btn" data-act="add-task"><span class="t-icon">✅</span>A task<small>something to do</small></button>
        <button class="triage-btn" data-act="add-event"><span class="t-icon">📅</span>Calendar<small>appointment or plan</small></button>
        <button class="triage-btn" data-act="add-thought" style="grid-column: 1 / -1"><span class="t-icon">🌤️</span>Just get it out of my head<small>sort it later — that’s fine</small></button>
      </div>
    `);
  }

  const ESTIMATES = [10, 20, 30, 45, 60, 90, 120];
  const REPEATS = [[null, 'Never'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];

  function repeatChips(id, current) {
    return `<div class="chip-row" id="${id}">
      ${REPEATS.map(([v, l]) => `<button type="button" class="chip-pick ${v === current ? 'selected' : ''}" data-rep="${v || ''}">${l}</button>`).join('')}
    </div>`;
  }

  function wireChipRow(rowId) {
    $('#' + rowId).addEventListener('click', e => {
      const c = e.target.closest('.chip-pick');
      if (!c) return;
      $$('#' + rowId + ' .chip-pick').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
    });
  }

  function openTaskSheet(prefill = {}, onSaved = null, savedMsg = null) {
    const p = Object.assign({ title: '', estimateMin: 30, deadline: '', important: false, someday: false, pinnedDate: null, repeat: null }, prefill);
    openSheet(`
      <h2>${p.someday ? 'Park it for someday' : 'A new task'}</h2>
      <p class="sheet-sub">${p.someday ? 'No dates, no pressure. It’ll be waiting when you want it.' : 'A rough time guess is enough — it helps the plan protect your day.'}</p>
      <div class="field">
        <label for="tsk-title">What is it?</label>
        <input type="text" id="tsk-title" value="${esc(p.title)}" placeholder="e.g. Reply to the dentist" autocomplete="off">
      </div>
      <div class="field">
        <label>Roughly how long?</label>
        <div class="chip-row" id="tsk-est">
          ${ESTIMATES.map(m => `<button type="button" class="chip-pick ${m === p.estimateMin ? 'selected' : ''}" data-est="${m}">${fmtMin(m)}</button>`).join('')}
        </div>
      </div>
      ${p.someday ? '' : `
      <div class="field">
        <label for="tsk-deadline">Does it have a deadline? <span style="font-weight:400">(leave empty if not)</span></label>
        <input type="date" id="tsk-deadline" value="${esc(p.deadline || '')}" min="${Store.todayStr()}">
      </div>
      <div class="field">
        <label>Does it come back? <span style="font-weight:400">(laundry, bills, watering plants…)</span></label>
        ${repeatChips('tsk-repeat', p.repeat)}
      </div>
      <div class="toggle-row" id="tsk-important-row"><span>This one really matters</span><div class="switch ${p.important ? 'on' : ''}" id="tsk-important"></div></div>
      <div class="toggle-row" id="tsk-today-row"><span>Do it today</span><div class="switch ${p.pinnedDate ? 'on' : ''}" id="tsk-today"></div></div>
      `}
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-act="sheet-close">Not now</button>
        <button class="btn btn-primary" id="tsk-save">Add it</button>
      </div>
    `);

    wireChipRow('tsk-est');
    if ($('#tsk-repeat')) wireChipRow('tsk-repeat');
    const impEl = $('#tsk-important'), todEl = $('#tsk-today');
    if (impEl) $('#tsk-important-row').addEventListener('click', () => impEl.classList.toggle('on'));
    if (todEl) $('#tsk-today-row').addEventListener('click', () => todEl.classList.toggle('on'));

    $('#tsk-save').addEventListener('click', () => {
      const title = $('#tsk-title').value.trim();
      if (!title) { $('#tsk-title').focus(); return; }
      const est = Number($('#tsk-est .chip-pick.selected')?.dataset.est || 30);
      const deadline = p.someday ? null : ($('#tsk-deadline').value || null);
      const important = impEl ? impEl.classList.contains('on') : false;
      const doToday = todEl ? todEl.classList.contains('on') : false;
      const repeat = $('#tsk-repeat')?.querySelector('.chip-pick.selected')?.dataset.rep || null;
      const task = Store.addTask({
        title, estimateMin: est, deadline, important, repeat: repeat || null,
        someday: p.someday, pinnedDate: doToday ? Store.todayStr() : null
      });
      Planner.replan();
      closeSheet();
      if (onSaved) { onSaved(task); }
      render();
      if (savedMsg) { toast(savedMsg); return; }
      if (task.someday) { toast('Parked for someday. Out of your head, kept safe.'); }
      else {
        const when = fmtDayLabel(task.plannedDate);
        toast(task.atRisk
          ? 'Added — the deadline looks tight, so it’s scheduled as soon as possible.'
          : `Planned for ${when === 'Today' ? 'today' : when}. You can let it go now. 🌿`);
      }
      if (est >= 60 && !p.someday) {
        setTimeout(() => offerBreakdown(task.id), 900);
      } else if (!onSaved && !p.someday) {
        maybeWeekFullNote();
      }
    });
    setTimeout(() => $('#tsk-title')?.focus(), 250);
  }

  /* Gentle guardrail: speak up when the coming week is nearly full. */
  function maybeWeekFullNote() {
    const load = Planner.weekLoad();
    if (load.ratio < 0.9) return;
    setTimeout(() => openSheet(`
      <h2>A gentle heads-up 🌾</h2>
      <p class="sheet-sub">
        The next seven days are now holding about ${fmtMin(load.planned)} of doing — close to everything they can carry.
        Nothing is wrong, and it's all still planned. But if something could wait, letting it would give the week room to breathe.
      </p>
      <div class="sheet-actions">
        <button class="btn btn-soft" data-act="goto-plan">Show me the week</button>
        <button class="btn btn-primary" data-act="sheet-close">It's okay</button>
      </div>
    `), 700);
  }

  function openEventSheet() {
    openSheet(`
      <h2>On the calendar</h2>
      <p class="sheet-sub">Appointments, calls, plans — the day shapes itself around them.</p>
      <div class="field"><label for="ev-title">What is it?</label>
        <input type="text" id="ev-title" placeholder="e.g. Doctor’s appointment" autocomplete="off"></div>
      <div class="field"><label for="ev-date">Which day?</label>
        <input type="date" id="ev-date" value="${Store.todayStr()}" min="${Store.todayStr()}"></div>
      <div class="field"><label for="ev-start">What time?</label>
        <input type="time" id="ev-start" value="10:00"></div>
      <div class="field"><label>How long will it take, door to door?</label>
        <div class="chip-row" id="ev-dur">
          ${[30, 60, 90, 120, 180, 240].map(m => `<button type="button" class="chip-pick ${m === 60 ? 'selected' : ''}" data-est="${m}">${fmtMin(m)}</button>`).join('')}
        </div></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-act="sheet-close">Not now</button>
        <button class="btn btn-primary" id="ev-save">Add it</button>
      </div>
    `);
    $('#ev-dur').addEventListener('click', e => {
      const c = e.target.closest('.chip-pick');
      if (!c) return;
      $$('#ev-dur .chip-pick').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
    });
    $('#ev-save').addEventListener('click', () => {
      const title = $('#ev-title').value.trim();
      if (!title) { $('#ev-title').focus(); return; }
      Store.addEvent({
        title,
        date: $('#ev-date').value || Store.todayStr(),
        start: $('#ev-start').value || '10:00',
        durationMin: Number($('#ev-dur .chip-pick.selected')?.dataset.est || 60)
      });
      closeSheet();
      render();
      toast('On the calendar. The plan will make room around it.');
    });
    setTimeout(() => $('#ev-title')?.focus(), 250);
  }

  function openThoughtSheet() {
    openSheet(`
      <h2>Out of your head</h2>
      <p class="sheet-sub">Say it or type it — a worry, an email to answer, a half-formed thing. Sorting can wait.</p>
      <div class="field"><textarea id="thought-text" rows="4" placeholder="One thing per line is fine…"></textarea></div>
      <div class="sheet-actions">
        <button type="button" class="mic-btn" id="thought-mic" aria-label="Speak instead of typing">🎤</button>
        <button class="btn btn-ghost" data-act="sheet-close">Not now</button>
        <button class="btn btn-primary" id="thought-save">Put it down</button>
      </div>
    `);
    attachMic('thought-mic', 'thought-text');
    $('#thought-save').addEventListener('click', () => {
      const lines = $('#thought-text').value.split('\n').map(s => s.trim()).filter(Boolean);
      lines.forEach(l => Store.addInbox(l));
      closeSheet();
      render();
      if (lines.length) toast('Safe here now. Your head can let it go. 🌤️');
    });
    setTimeout(() => $('#thought-text')?.focus(), 250);
  }

  /* ================= task detail & breakdown ================= */

  function openTaskDetail(id) {
    const t = Store.getTask(id);
    if (!t) return;
    const steps = t.steps || [];
    openSheet(`
      <h2>${esc(t.title)}</h2>
      <p class="sheet-sub">
        ${t.done ? 'Done. 🌿' : t.someday ? 'Parked for someday — no pressure attached.'
          : `Planned for ${fmtDayLabel(t.plannedDate).toLowerCase() === 'today' ? 'today' : fmtDayLabel(t.plannedDate)} · about ${fmtMin(Planner.remainingMinutes(t)) || '—'}${t.deadline ? ` · ${fmtDeadline(t.deadline)}` : ''}`}
        ${t.atRisk && !t.done ? '<br><br>⚠️ The deadline looks tight. Smaller steps, a shorter estimate, or letting something else wait would ease it.' : ''}
      </p>

      <div class="field">
        <label>Small steps ${steps.length ? `(${steps.filter(s => s.done).length}/${steps.length})` : ''}</label>
        ${steps.length ? steps.map(s => `
          <div class="step-row">
            <button class="task-check ${s.done ? 'checked' : ''}" data-act="step-toggle" data-id="${t.id}" data-step="${s.id}">${s.done ? '✓' : ''}</button>
            <p class="${s.done ? 'done' : ''}">${esc(s.title)}</p>
            <span class="chip time">${fmtMin(s.estimateMin)}</span>
          </div>`).join('')
        : `<p class="empty-note" style="padding:10px">Big things feel lighter in small pieces. Make the first step really tiny — “open the email” counts.</p>`}
        <div class="step-add">
          <input type="text" id="step-title" placeholder="A tiny first step…" autocomplete="off">
          <button class="btn btn-primary btn-sm" data-act="step-add" data-id="${t.id}">Add</button>
        </div>
        <div class="chip-row" id="step-est" style="margin-top:8px">
          ${[5, 10, 15, 30].map(m => `<button type="button" class="chip-pick ${m === 10 ? 'selected' : ''}" data-est="${m}">${fmtMin(m)}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label for="dt-deadline">Deadline</label>
        <input type="date" id="dt-deadline" value="${esc(t.deadline || '')}" min="${Store.todayStr()}">
      </div>

      <div class="field">
        <label>Repeats</label>
        ${repeatChips('dt-repeat', t.repeat)}
      </div>

      <div class="sheet-actions" style="flex-wrap:wrap">
        ${!t.done ? `<button class="btn btn-primary" data-act="focus" data-id="${t.id}">Begin gently</button>` : ''}
        ${!t.done && !t.someday ? `<button class="btn btn-soft" data-act="not-today" data-id="${t.id}">Not today</button>` : ''}
        ${t.someday ? `<button class="btn btn-soft" data-act="revive" data-id="${t.id}">Bring it back</button>` : ''}
        ${!t.done && Store.state.settings.partnerName ? `<button class="btn btn-soft" data-act="hand-over" data-id="${t.id}">Hand to ${esc(Store.state.settings.partnerName)} 🤝</button>` : ''}
        <button class="btn btn-ghost" data-act="task-delete" data-id="${t.id}">Let it go</button>
        <button class="btn btn-ghost" data-act="sheet-close">Close</button>
      </div>
    `);
    wireChipRow('dt-repeat');
    $('#dt-repeat').addEventListener('click', e => {
      const c = e.target.closest('.chip-pick');
      if (c) Store.updateTask(t.id, { repeat: c.dataset.rep || null });
    });

    $('#step-est').addEventListener('click', e => {
      const c = e.target.closest('.chip-pick');
      if (!c) return;
      $$('#step-est .chip-pick').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
    });
    $('#dt-deadline').addEventListener('change', e => {
      Store.updateTask(t.id, { deadline: e.target.value || null });
      Planner.replan();
      render();
    });
  }

  function offerBreakdown(id) {
    const t = Store.getTask(id);
    if (!t) return;
    openSheet(`
      <h2>Want to make it smaller?</h2>
      <p class="sheet-sub">“${esc(t.title)}” is a chunky one (${fmtMin(t.estimateMin)}). Things this size feel much lighter as a few tiny steps — and the first one can be as small as “open the laptop”.</p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-act="sheet-close">It’s fine as it is</button>
        <button class="btn btn-primary" data-act="detail" data-id="${t.id}">Break it down</button>
      </div>
    `);
  }

  /* ================= focus mode ================= */

  function startFocus(id) {
    const t = Store.getTask(id);
    if (!t) return;
    closeSheet();
    const step = (t.steps || []).find(s => !s.done);
    const startedAt = Date.now();
    focusEl.hidden = false;
    document.body.style.overflow = 'hidden';
    focusEl.innerHTML = `
      <div class="breath" aria-hidden="true"></div>
      <p class="focus-kicker">Breathe in… and out. Then just this:</p>
      <h2>${esc(step ? step.title : t.title)}</h2>
      ${step ? `<p class="focus-step">part of “${esc(t.title)}”</p>` : ''}
      <p class="focus-timer" id="focus-timer">just beginning</p>
      <div class="focus-actions">
        <button class="btn btn-primary btn-block" data-act="focus-done" data-id="${t.id}" data-step="${step ? step.id : ''}">${step ? 'This step is done ✓' : 'It’s done ✓'}</button>
        <button class="btn btn-soft btn-block" data-act="focus-exit">Pause — come back later</button>
      </div>
    `;
    focusTimer = setInterval(() => {
      const min = Math.floor((Date.now() - startedAt) / 60000);
      const el = $('#focus-timer');
      if (!el) return;
      el.textContent = min < 1 ? 'just beginning'
        : `${min} minute${min === 1 ? '' : 's'} in — no rush at all`;
    }, 15000);
  }

  function exitFocus() {
    clearInterval(focusTimer);
    focusTimer = null;
    focusEl.hidden = true;
    focusEl.innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ================= actions (event delegation) ================= */

  function nextOccurrence(t) {
    const today = Store.todayStr();
    const base = Store.fromDateStr(t.plannedDate && t.plannedDate > today ? t.plannedDate : today);
    if (t.repeat === 'daily') base.setDate(base.getDate() + 1);
    else if (t.repeat === 'weekly') base.setDate(base.getDate() + 7);
    else base.setMonth(base.getMonth() + 1);
    return Store.toDateStr(base);
  }

  function completeTask(id) {
    const t = Store.getTask(id);
    if (!t) return;
    if (t.done) {
      Store.updateTask(id, { done: false, doneAt: null });
      // undo the occurrence that completion spawned, if it's still untouched
      const spawned = t.spawnedNextId && Store.getTask(t.spawnedNextId);
      if (spawned && !spawned.done) Store.deleteTask(spawned.id);
      Store.updateTask(id, { spawnedNextId: null });
    } else {
      (t.steps || []).forEach(s => s.done = true);
      Store.updateTask(id, { done: true, doneAt: Date.now() });
      if (t.repeat) {
        const next = Store.addTask({
          title: t.title, estimateMin: t.estimateMin, important: t.important,
          repeat: t.repeat, pinnedDate: nextOccurrence(t),
          steps: (t.steps || []).map(s => ({ id: Store.uid(), title: s.title, estimateMin: s.estimateMin, done: false }))
        });
        Store.updateTask(id, { spawnedNextId: next.id });
        toast(`Done — it’ll come back ${fmtDayLabel(next.pinnedDate).toLowerCase() === 'today' ? 'today' : fmtDayLabel(next.pinnedDate)}. 🌿`);
      } else {
        cheer();
      }
    }
    render();
  }

  /* ---- everything she's done, filterable by time ---- */

  const LOOK_RANGES = [
    ['today', 'Today', 'today'],
    ['7', 'This week', 'this week'],
    ['30', 'This month', 'this month'],
    ['all', 'All time', 'so far']
  ];

  function doneWithin(range) {
    let cutoff = 0;
    if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); cutoff = d.getTime(); }
    else if (range === '7') cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    else if (range === '30') cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    return Store.state.tasks
      .filter(t => t.done && t.doneAt && t.doneAt >= cutoff)
      .sort((a, b) => b.doneAt - a.doneAt);
  }

  function weekDone() { return doneWithin('7'); }

  function openLookBack(range = '7') {
    const done = doneWithin(range);
    const label = LOOK_RANGES.find(r => r[0] === range)[2];
    const chips = `
      <div class="chip-row" style="justify-content:center; margin-bottom:18px">
        ${LOOK_RANGES.map(([v, l]) => `<button type="button" class="chip-pick ${v === range ? 'selected' : ''}" data-act="look-range" data-range="${v}">${l}</button>`).join('')}
      </div>`;

    if (!done.length) {
      openSheet(`
        ${chips}
        <div class="done-card" style="margin-bottom:0">
          <div class="big">🕊️</div>
          <h2>${range === 'today' ? 'Nothing yet — and that’s fine.' : 'A quiet stretch.'}</h2>
          <p>${range === 'today' ? 'The day isn’t a race. Whatever happens, happens gently.' : 'Rest counts too — it’s how the next stretch becomes possible.'}</p>
          <div style="margin-top:18px"><button class="btn btn-primary" data-act="sheet-close">Okay 💛</button></div>
        </div>`);
      return;
    }

    const totalMin = done.reduce((a, t) => a + (t.estimateMin || 30), 0);
    const met = done.filter(t => t.deadline && Store.toDateStr(new Date(t.doneAt)) <= t.deadline).length;
    const days = new Set(done.map(t => Store.toDateStr(new Date(t.doneAt)))).size;
    const SHOW = 30;
    openSheet(`
      ${chips}
      <div style="text-align:center; padding: 0 0 14px">
        <div style="font-size:2.4rem; margin-bottom:8px">🌿</div>
        <h2>Look what you did.</h2>
        <p class="sheet-sub" style="margin-top:6px">
          ${done.length} thing${done.length === 1 ? '' : 's'} finished ${label} — about ${fmtMin(totalMin)} of doing${days > 1 ? `, across ${days} days` : ''}.${met ? ` ${met} deadline${met === 1 ? '' : 's'} met with room to spare.` : ''}
          <br><br>That all happened because of you.
        </p>
      </div>
      ${done.slice(0, SHOW).map(t => `
        <div class="step-row">
          <span class="task-check checked" style="cursor:default">✓</span>
          <p>${esc(t.title)}</p>
          <span class="chip">${fmtDoneDate(t.doneAt)}</span>
        </div>`).join('')}
      ${done.length > SHOW ? `<p class="empty-note" style="padding:8px">…and ${done.length - SHOW} more. All of it counts.</p>` : ''}
      <div class="sheet-actions"><button class="btn btn-primary btn-block" data-act="sheet-close">That was me 💛</button></div>
    `);
  }

  function fmtDoneDate(ts) {
    const dateStr = Store.toDateStr(new Date(ts));
    if (dateStr === Store.todayStr()) return 'today';
    if (dateStr === Store.todayStr(-1)) return 'yesterday';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /* ---- "too much" rescue ---- */

  function openTooMuch() {
    const today = Store.todayStr();
    const tasks = Planner.tasksOn(today);
    const tiny = tasks.slice().sort((a, b) => Planner.remainingMinutes(a) - Planner.remainingMinutes(b))[0];
    openSheet(`
      <h2>It’s okay. Let’s shrink it.</h2>
      <p class="sheet-sub">You don’t have to do today all at once — or at all. Pick whatever feels possible.</p>
      <div class="sheet-actions" style="flex-direction:column">
        ${tiny ? `<button class="btn btn-primary btn-block" data-act="calm-enter" data-id="${tiny.id}">🍃 Just one tiny thing (${fmtMin(Planner.remainingMinutes(tiny))})</button>` : ''}
        <button class="btn btn-soft btn-block" data-act="day-to-tomorrow">🌙 Move today to tomorrow</button>
        <button class="btn btn-soft btn-block" data-act="breathe">🫧 Just breathe for a minute</button>
        <button class="btn btn-ghost btn-block" data-act="sheet-close">I’m okay, go back</button>
      </div>
    `);
  }

  function startBreathe() {
    closeSheet();
    focusEl.hidden = false;
    document.body.style.overflow = 'hidden';
    focusEl.innerHTML = `
      <div class="breath" aria-hidden="true"></div>
      <p class="focus-kicker">Nothing to do right now</p>
      <h2>In… and out.</h2>
      <p class="focus-timer" id="breathe-note">Follow the circle. The list can wait.</p>
      <div class="focus-actions">
        <button class="btn btn-soft btn-block" data-act="breathe-exit">I’m ready — or not, and that’s fine</button>
      </div>
    `;
    focusTimer = setTimeout(() => {
      const el = $('#breathe-note');
      if (el) el.textContent = 'Better? There’s no rush. Stay as long as you like.';
    }, 60000);
  }

  /* ---- voice capture ---- */

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  function attachMic(btnId, targetId) {
    const btn = $('#' + btnId), target = $('#' + targetId);
    if (!btn || !target) return;
    if (!SpeechRec) { btn.hidden = true; return; } // keyboard dictation still works
    let rec = null;
    btn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SpeechRec();
      rec.lang = navigator.language || 'en-GB';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const text = e.results[i][0].transcript.trim();
            if (text) target.value = (target.value ? target.value.trimEnd() + '\n' : '') + text;
          }
        }
      };
      rec.onend = () => { btn.classList.remove('listening'); rec = null; };
      rec.onerror = (e) => {
        btn.classList.remove('listening');
        rec = null;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          toast('The microphone isn’t allowed here — the keyboard’s mic works too.');
        }
      };
      try {
        rec.start();
        btn.classList.add('listening');
        toast('Listening… just talk. Tap again when you’re done.');
      } catch (err) { rec = null; }
    });
  }

  /* ---- handing a task over ---- */

  async function handOver(text, estimateMin) {
    const name = Store.state.settings.partnerName || 'someone';
    const msg = `Could you take this off my plate? 💛 ${text}${estimateMin ? ` (about ${fmtMin(estimateMin)})` : ''}`;
    if (navigator.share) {
      try { await navigator.share({ text: msg }); return true; }
      catch (e) { return false; /* she closed the share sheet — keep the task */ }
    }
    try {
      await navigator.clipboard.writeText(msg);
      toast(`Copied — paste it to ${name} wherever you chat. 💛`);
      return true;
    } catch (e) {
      toast('Couldn’t open sharing here — but the thought counts.');
      return false;
    }
  }

  function closeDay() {
    const today = Store.todayStr();
    const remaining = Planner.tasksOn(today);
    const doneToday = Planner.doneOn(today);
    remaining.forEach(t => {
      if (t.pinnedDate === today) Store.updateTask(t.id, { pinnedDate: null });
    });
    Store.state.closedDays[today] = true;
    Store.save();
    Planner.replan();
    openSheet(`
      <div class="done-card" style="margin-bottom:0">
        <div class="big">🌙</div>
        <h2>The day is closed.</h2>
        <p>
          ${doneToday.length ? `You finished ${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} today — that counts, and it’s enough.` : 'Some days are for resting, and that’s allowed.'}
          ${remaining.length ? `<br><br>The ${remaining.length === 1 ? 'one thing' : `${remaining.length} things`} left ${remaining.length === 1 ? 'has' : 'have'} already been given a new home in the plan. Nothing is lost, and nothing needs you tonight.` : ''}
        </p>
        <div style="margin-top:18px"><button class="btn btn-primary" data-act="sheet-close">Goodnight 💛</button></div>
      </div>
    `);
    render();
  }

  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;

    switch (act) {
      case 'sheet-close': closeSheet(); render(); break;
      case 'toggle': case 'done': completeTask(id); break;
      case 'detail': openTaskDetail(id); break;
      case 'focus': startFocus(id); break;
      case 'focus-exit': exitFocus(); render(); toast('Paused, not abandoned. It’ll be here.'); break;
      case 'focus-done': {
        const stepId = el.dataset.step;
        const t = Store.getTask(id);
        exitFocus();
        if (t && stepId) {
          const s = t.steps.find(s => s.id === stepId);
          if (s) s.done = true;
          if (t.steps.every(s => s.done)) { completeTask(id); }
          else { Store.save(); render(); toast('One small step done. That’s how it all happens. 🍃'); }
        } else {
          completeTask(id);
        }
        break;
      }
      case 'not-today': {
        Store.updateTask(id, { pinnedDate: Store.todayStr(1) });
        Planner.replan(); closeSheet(); render();
        toast('Moved to tomorrow. Today just got lighter.');
        break;
      }
      case 'revive': {
        Store.updateTask(id, { someday: false });
        Planner.replan(); closeSheet(); render();
        const t = Store.getTask(id);
        toast(t ? `Back in the plan — ${fmtDayLabel(t.plannedDate).toLowerCase()}.` : 'Back in the plan.');
        break;
      }
      case 'task-delete': {
        Store.deleteTask(id); closeSheet(); render();
        toast('Let go. Not everything needs doing. 🍂');
        break;
      }
      case 'del-event': Store.deleteEvent(id); render(); break;
      case 'del-inbox': Store.removeInbox(id); render(); break;
      case 'triage': startTriage(); break;
      case 'tri-today': triageToTask(id, { today: true }); break;
      case 'tri-plan': triageToTask(id, {}); break;
      case 'tri-someday': triageToTask(id, { someday: true }); break;
      case 'tri-drop': {
        Store.removeInbox(id);
        toast('Let go. Permission granted. 🍂');
        startTriage();
        break;
      }
      case 'sync-now': runSync(true); break;
      case 'checkin': {
        Store.state.checkins[Store.todayStr()] = el.dataset.mood;
        Store.save();
        Planner.replan();
        render();
        if (el.dataset.mood === 'low') toast('Let’s keep today light. The plan has made room. 🌿');
        if (el.dataset.mood === 'good') toast('Lovely. The day is yours. ☀️');
        break;
      }
      case 'checkin-open': {
        delete Store.state.checkins[Store.todayStr()];
        Store.save();
        Planner.replan();
        render();
        break;
      }
      case 'too-much': openTooMuch(); break;
      case 'calm-enter': {
        Store.state.calm = { date: Store.todayStr(), taskId: id };
        Store.save();
        closeSheet();
        render();
        break;
      }
      case 'calm-exit': {
        Store.state.calm = null;
        Store.save();
        render();
        break;
      }
      case 'day-to-tomorrow': {
        const tomorrow = Store.todayStr(1);
        Planner.tasksOn(Store.todayStr()).forEach(t => Store.updateTask(t.id, { pinnedDate: tomorrow }));
        Planner.replan();
        closeSheet();
        render();
        toast('Everything is tomorrow’s, kindly. Today is for resting. 🌙');
        break;
      }
      case 'breathe': startBreathe(); break;
      case 'breathe-exit': exitFocus(); render(); break;
      case 'look-back': openLookBack(); break;
      case 'look-range': openLookBack(el.dataset.range); break;
      case 'goto-plan': closeSheet(); goto('plan'); break;
      case 'hand-over': {
        const t = Store.getTask(id);
        if (t) handOver(t.title, Planner.remainingMinutes(t)).then(ok => {
          if (ok) {
            Store.deleteTask(id);
            closeSheet();
            render();
            toast(`Handed over. One less thing on your shoulders. 🤝`);
          }
        });
        break;
      }
      case 'tri-hand': {
        const item = Store.state.inbox.find(i => i.id === id);
        if (item) handOver(item.text.replace(/^📧\s*/, ''), item.suggestMin).then(ok => {
          if (ok) { Store.removeInbox(id); toast('Handed over. 🤝'); }
          startTriage();
        });
        break;
      }
      case 'add-task': openTaskSheet(); break;
      case 'add-event': openEventSheet(); break;
      case 'add-thought': openThoughtSheet(); break;
      case 'close-day': closeDay(); break;
      case 'step-toggle': {
        const t = Store.getTask(id);
        const s = t?.steps.find(s => s.id === el.dataset.step);
        if (s) { s.done = !s.done; Store.save(); }
        if (t && t.steps.length && t.steps.every(s => s.done)) { completeTask(id); closeSheet(); }
        else { openTaskDetail(id); render(); }
        break;
      }
      case 'step-add': {
        const input = $('#step-title');
        const title = input?.value.trim();
        if (!title) { input?.focus(); return; }
        const est = Number($('#step-est .chip-pick.selected')?.dataset.est || 10);
        const t = Store.getTask(id);
        if (t) {
          t.steps = t.steps || [];
          t.steps.push({ id: Store.uid(), title, estimateMin: est, done: false });
          Store.save();
          Planner.replan();
          openTaskDetail(id);
        }
        break;
      }
    }
  });

  $('#fab').addEventListener('click', openAddChooser);

  /* ================= SETTINGS ================= */

  function renderSettings() {
    const s = Store.state.settings;
    $('#settings-body').innerHTML = `
      <div class="settings-group">
        <h3>About you</h3>
        <div class="field"><label for="set-name">What should I call you?</label>
          <input type="text" id="set-name" value="${esc(s.name)}" placeholder="Your name" autocomplete="off"></div>
        <div class="field"><label for="set-partner">Who can you hand things to?</label>
          <input type="text" id="set-partner" value="${esc(s.partnerName)}" placeholder="e.g. Stephan" autocomplete="off"></div>
        <p class="screen-sub" style="margin-top:-6px">You don’t have to carry everything. Tasks can be handed over in one tap.</p>
      </div>
      <div class="settings-group">
        <h3>Your pace</h3>
        <div class="field">
          <label for="set-capacity">How much life admin fits around your day?</label>
          <select id="set-capacity">
            ${[[30, 'A calm half hour'], [45, 'Three-quarters of an hour'], [60, 'A steady hour (a good start)'], [90, 'An hour and a half'], [120, 'Two hours'], [180, 'Three hours'], [240, 'Four hours']]
              .map(([v, l]) => `<option value="${v}" ${v === s.capacityMin ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <p class="screen-sub" style="margin-top:-6px">Work already takes its eight hours. This is the space Haven may plan on top — for life, not more work — and it will never quietly pile on more. Nudge it up or down any time.</p>
      </div>
      <div class="settings-group">
        <h3>Connected accounts</h3>
        ${Connect.isConnected() ? `
          <div class="toggle-row"><span>🟢 ${esc(s.google.email)}</span>
            <button class="btn btn-ghost btn-sm" id="set-disconnect">Disconnect</button></div>
          <div class="toggle-row" id="set-cal-row"><span>Bring in my calendar</span>
            <div class="switch ${s.google.calendar ? 'on' : ''}" id="set-cal"></div></div>
          <div class="toggle-row" id="set-gmail-row"><span>Watch my email for things that need me</span>
            <div class="switch ${s.google.gmail ? 'on' : ''}" id="set-gmail"></div></div>
          <div class="field" style="margin-top:12px">
            <label for="set-lookback">How far back to look for email</label>
            <select id="set-lookback">
              ${[[1, 'Just today'], [3, 'The last 3 days'], [7, 'The last week']]
                .map(([v, l]) => `<option value="${v}" ${v === s.google.lookbackDays ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-soft btn-block" data-act="sync-now">Check now</button>
          <p class="screen-sub" style="margin-top:8px">${Store.state.lastSyncAt ? `Last checked ${new Date(Store.state.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Not checked yet.'}
          Only emails that truly need you make it in — spam, newsletters and noise never do.</p>
        ` : `
          <p class="screen-sub" style="margin-bottom:12px">Haven can watch your Gmail and Google Calendar — quietly, from this phone only. Appointments shape the plan; only emails that genuinely need <em>you</em> appear in Head space. Everything else stays out of sight.</p>
          <div class="field">
            <label for="set-gclient">Google client ID <span style="font-weight:400">(one-time setup — guide in the README)</span></label>
            <input type="text" id="set-gclient" value="${esc(s.google.clientId)}" placeholder="…apps.googleusercontent.com" autocomplete="off">
          </div>
          <button class="btn btn-primary btn-block" id="set-connect">Connect Google</button>
        `}
      </div>
      <div class="settings-group">
        <h3>Smart email filtering</h3>
        <div class="field">
          <label for="set-claude-key">Claude API key <span style="font-weight:400">(optional)</span></label>
          <input type="password" id="set-claude-key" value="${esc(s.anthropicKey)}" placeholder="sk-ant-…" autocomplete="off">
        </div>
        <p class="screen-sub" style="margin-top:-6px">With a key, Claude reads each email’s sender, subject and preview and lets through only what genuinely needs you — phrased as a small, kind task with a time guess. Without one, a simpler built-in filter is used. The key lives only on this phone.</p>
      </div>
      <div class="settings-group">
        <h3>Keeping it safe</h3>
        <button class="btn btn-soft btn-block" id="set-export" style="margin-bottom:10px">Save a backup</button>
        <button class="btn btn-soft btn-block" id="set-import">Restore from a backup</button>
        <input type="file" id="set-import-file" accept="application/json" hidden>
        <p class="screen-sub">Everything lives only on this phone. A backup file lets you move it or keep it safe.</p>
      </div>
      <div class="settings-group">
        <h3>A note</h3>
        <p class="screen-sub">Haven was made with love, to carry the weight of remembering so you don’t have to. Rest is productive too. 💛</p>
      </div>
    `;

    $('#set-name').addEventListener('change', e => { s.name = e.target.value.trim(); Store.save(); render(); });
    $('#set-partner').addEventListener('change', e => { s.partnerName = e.target.value.trim(); Store.save(); });
    $('#set-claude-key').addEventListener('change', e => {
      s.anthropicKey = e.target.value.trim(); Store.save();
      if (s.anthropicKey) toast('Smart filtering is on. Claude will guard the gate.');
    });
    const connectBtn = $('#set-connect');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        s.google.clientId = $('#set-gclient').value.trim();
        Store.save();
        if (!s.google.clientId) { toast('Add the Google client ID first — the README shows how.'); return; }
        connectBtn.textContent = 'Connecting…';
        try {
          const email = await Connect.connect();
          toast(`Connected as ${email}. 🌿`);
          renderSettings();
          runSync(true);
        } catch (err) {
          connectBtn.textContent = 'Connect Google';
          toast(err.message || 'That didn’t work — no harm done. Try again when ready.');
        }
      });
    }
    const discBtn = $('#set-disconnect');
    if (discBtn) discBtn.addEventListener('click', () => {
      Connect.disconnect(); Planner.replan(); render();
      toast('Disconnected. Everything synced so far stays put.');
    });
    const calRow = $('#set-cal-row'), gmailRow = $('#set-gmail-row');
    if (calRow) calRow.addEventListener('click', () => { $('#set-cal').classList.toggle('on'); s.google.calendar = $('#set-cal').classList.contains('on'); Store.save(); });
    if (gmailRow) gmailRow.addEventListener('click', () => { $('#set-gmail').classList.toggle('on'); s.google.gmail = $('#set-gmail').classList.contains('on'); Store.save(); });
    const lookback = $('#set-lookback');
    if (lookback) lookback.addEventListener('change', e => { s.google.lookbackDays = Number(e.target.value); Store.save(); });
    $('#set-capacity').addEventListener('change', e => { s.capacityMin = Number(e.target.value); Store.save(); Planner.replan(); toast('Pace adjusted. The plan will follow your lead.'); });
    $('#set-export').addEventListener('click', () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `haven-backup-${Store.todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('#set-import').addEventListener('click', () => $('#set-import-file').click());
    $('#set-import-file').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { Store.importJSON(reader.result); Planner.replan(); render(); toast('Restored. Everything’s back.'); }
        catch (err) { toast('Hmm, that file didn’t work — no changes made.'); }
      };
      reader.readAsText(f);
    });
  }

  /* ================= first-run welcome ================= */

  function maybeOnboard() {
    if (Store.state.settings.onboarded) return;
    openSheet(`
      <div style="text-align:center; padding: 8px 0 4px">
        <div style="font-size:2.6rem; margin-bottom:8px">🌿</div>
        <h2>Welcome to Haven</h2>
        <p class="sheet-sub" style="margin-top:8px">
          This is your gentle chief of staff. You put things down — tasks, dates, worries —
          and Haven decides when they’ll get done, keeps deadlines safe, and never lets a day overflow.<br><br>
          It plans about an hour of life admin around your working day — never more than feels right, and you can change it any time.<br><br>
          Your only job is the one small thing in front of you.
        </p>
      </div>
      <div class="field">
        <label for="ob-name">First — what should I call you?</label>
        <input type="text" id="ob-name" placeholder="Your name" autocomplete="off">
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary btn-block" id="ob-go">Let’s begin, gently</button>
      </div>
    `);
    $('#ob-go').addEventListener('click', () => {
      Store.state.settings.name = $('#ob-name').value.trim();
      Store.state.settings.onboarded = true;
      Store.save();
      closeSheet();
      render();
      toast('Welcome. Add one small thing whenever you’re ready.');
    });
  }

  /* ================= sync with connected accounts ================= */

  async function runSync(interactive = false) {
    if (!Connect.isConnected()) return;
    if (interactive) toast('Checking mail and calendar…', 8000);
    try {
      const out = await Connect.syncAll(interactive);
      if (!out) return;
      Planner.replan();
      render();
      if (out.emails > 0) {
        toast(out.emails === 1
          ? 'One email needs something from you — it’s waiting in Head space.'
          : `${out.emails} emails need something from you — they’re waiting in Head space.`, 4000);
      } else if (interactive) {
        toast(out.events > 0 ? 'Calendar updated. No email needs you. 🕊️' : 'All quiet. Nothing needs you right now. 🕊️');
      }
    } catch (err) {
      // silent syncs fail silently — never nag; interactive ones explain gently
      if (interactive) toast(err.message || 'Couldn’t check just now. It’ll try again later.');
    }
  }

  /* ================= boot ================= */

  // Android share target: text shared into Haven lands in Head space.
  // ?quick=capture (icon quick-action / iOS Shortcut) opens straight into a brain-dump.
  let quickCapture = false;
  (() => {
    const params = new URLSearchParams(location.search);
    quickCapture = params.get('quick') === 'capture';
    const shared = [params.get('title'), params.get('text'), params.get('url')]
      .filter(Boolean).join(' — ').trim();
    if (!shared && !quickCapture) return;
    history.replaceState(null, '', location.pathname);
    if (shared) {
      Store.addInbox(shared);
      toast('Got it — safe in Head space. 🌤️');
      goto('inbox');
    }
  })();

  Planner.replan();
  render();
  maybeOnboard();
  attachMic('inbox-mic', 'inbox-input');
  if (quickCapture && Store.state.settings.onboarded) {
    setTimeout(() => openThoughtSheet(), 250);
  }
  if (Connect.shouldAutoSync()) runSync(false);

  // re-render when the app returns to foreground (date may have rolled over)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      render();
      if (Connect.shouldAutoSync()) runSync(false);
    }
  });
})();
