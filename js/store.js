/* Haven — data store. Everything lives on the device, in localStorage. */

const Store = (() => {
  const KEY = 'haven-data-v1';

  const defaults = () => ({
    version: 1,
    settings: {
      name: '',
      dayStart: '09:00',
      dayEnd: '17:30',
      capacityMin: 240,      // how many minutes of "doing" feels right per day
      onboarded: false,
      google: {              // connected Google account (Gmail + Calendar)
        clientId: '',
        email: '',
        calendar: true,
        gmail: true,
        lookbackDays: 3
      },
      anthropicKey: ''       // optional: Claude-powered email triage
    },
    tasks: [],   // {id,title,estimateMin,deadline,important,someday,pinnedDate,plannedDate,atRisk,steps[],done,doneAt,createdAt}
    events: [],  // {id,title,date,start,durationMin,source?,gcalId?,allDay?}
    inbox: [],   // {id,text,createdAt,link?,source?,suggestMin?}
    closedDays: {}, // {'YYYY-MM-DD': true}
    processedEmails: {}, // gmail message id -> timestamp (never re-surface a message)
    lastSyncAt: 0
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      return merge(parsed);
    } catch (e) {
      return defaults();
    }
  }

  function merge(parsed) {
    const d = defaults();
    return Object.assign(d, parsed, {
      settings: Object.assign(d.settings, parsed.settings || {}, {
        google: Object.assign(d.settings.google, parsed.settings?.google || {})
      })
    });
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or private mode */ }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ----- dates ----- */
  function todayStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return toDateStr(d);
  }
  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fromDateStr(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /* ----- tasks ----- */
  function addTask(data) {
    const t = Object.assign({
      id: uid(),
      title: '',
      estimateMin: 30,
      deadline: null,
      important: false,
      someday: false,
      pinnedDate: null,
      plannedDate: null,
      atRisk: false,
      steps: [],
      done: false,
      doneAt: null,
      createdAt: Date.now()
    }, data);
    state.tasks.push(t);
    save();
    return t;
  }

  function updateTask(id, patch) {
    const t = state.tasks.find(t => t.id === id);
    if (t) { Object.assign(t, patch); save(); }
    return t;
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    save();
  }

  function getTask(id) { return state.tasks.find(t => t.id === id); }

  /* ----- events ----- */
  function addEvent(data) {
    const ev = Object.assign({ id: uid(), title: '', date: todayStr(), start: '09:00', durationMin: 60 }, data);
    state.events.push(ev);
    save();
    return ev;
  }
  function deleteEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    save();
  }
  function eventsOn(dateStr) {
    return state.events
      .filter(e => e.date === dateStr)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  /* ----- inbox ----- */
  function addInbox(text) {
    const item = { id: uid(), text: text.trim(), createdAt: Date.now() };
    if (item.text) { state.inbox.push(item); save(); }
    return item;
  }
  function removeInbox(id) {
    state.inbox = state.inbox.filter(i => i.id !== id);
    save();
  }

  /* ----- import / export ----- */
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
      throw new Error('That file doesn’t look like a Haven backup.');
    }
    state = merge(parsed);
    save();
  }

  return {
    get state() { return state; },
    save, uid, todayStr, toDateStr, fromDateStr,
    addTask, updateTask, deleteTask, getTask,
    addEvent, deleteEvent, eventsOn,
    addInbox, removeInbox,
    exportJSON, importJSON
  };
})();
