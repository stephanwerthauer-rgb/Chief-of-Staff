/* Haven — the planning engine.
   Decides *when* things get done, so she doesn't have to hold it in her head.
   Rules:
   - Each day has a gentle capacity (default 4h of "doing").
   - Calendar events reduce that day's capacity.
   - Tasks with deadlines are placed so they finish before the deadline,
     with the most urgent handled first.
   - If something genuinely can't fit before its deadline, it is still
     scheduled as early as possible and softly flagged — never shouted about.
*/

const Planner = (() => {
  const HORIZON_DAYS = 21;

  function remainingMinutes(task) {
    const openSteps = (task.steps || []).filter(s => !s.done);
    if ((task.steps || []).length > 0) {
      if (task.done) return 0;
      const sum = openSteps.reduce((a, s) => a + (s.estimateMin || 0), 0);
      return sum > 0 ? sum : Math.max(10, Math.round((task.estimateMin || 30) / (task.steps.length + 1)));
    }
    return task.done ? 0 : (task.estimateMin || 30);
  }

  function eventMinutesOn(dateStr) {
    return Store.eventsOn(dateStr).reduce((a, e) => a + (e.durationMin || 0), 0);
  }

  /* Free "doing" minutes for a given day, before any tasks are placed. */
  function dayBudget(dateStr) {
    const cap = Store.state.settings.capacityMin || 240;
    const budget = cap - eventMinutesOn(dateStr);
    return Math.max(0, budget);
  }

  function urgencySort(a, b) {
    // deadline first (earlier = more urgent), tasks without deadlines after
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.important !== b.important) return a.important ? -1 : 1;
    return a.createdAt - b.createdAt;
  }

  /* Recompute plannedDate for every open task. Called after any change. */
  function replan() {
    const today = Store.todayStr();
    const days = [];
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const d = Store.todayStr(i);
      days.push({ date: d, free: dayBudget(d) });
    }

    // Minutes already completed today still "count" toward today's fullness,
    // so finishing things doesn't invite the plan to pile more on.
    const doneTodayMin = Store.state.tasks
      .filter(t => t.done && t.doneAt && Store.toDateStr(new Date(t.doneAt)) === today)
      .reduce((a, t) => a + (t.estimateMin || 30), 0);
    days[0].free = Math.max(0, days[0].free - doneTodayMin);

    const open = Store.state.tasks.filter(t => !t.done && !t.someday);

    // 1) Pinned tasks claim their day first (she chose the day; honour it).
    open.filter(t => t.pinnedDate).sort(urgencySort).forEach(t => {
      let pin = t.pinnedDate < today ? today : t.pinnedDate; // pins in the past roll forward
      const day = days.find(d => d.date === pin);
      t.plannedDate = pin;
      t.atRisk = !!(t.deadline && pin > t.deadline);
      if (day) day.free -= remainingMinutes(t); // may go conceptually negative; clamp below
      if (day && day.free < 0) day.free = 0;
    });

    // 2) Everything else flows into the earliest day it fits, before its deadline.
    open.filter(t => !t.pinnedDate).sort(urgencySort).forEach(t => {
      const need = remainingMinutes(t);
      let placed = null;

      const lastAllowed = t.deadline && t.deadline >= today ? t.deadline : null;
      const candidates = lastAllowed ? days.filter(d => d.date <= lastAllowed) : days;

      // earliest day with room
      placed = candidates.find(d => d.free >= need) || null;

      // a task bigger than any single day's space: put it on the roomiest allowed day
      if (!placed && candidates.length) {
        placed = candidates.reduce((best, d) => (d.free > best.free ? d : best), candidates[0]);
      }

      // deadline already passed, or no room before it: schedule ASAP and flag softly
      let atRisk = false;
      if (!placed || (t.deadline && placed.date > t.deadline)) {
        placed = days.find(d => d.free >= need) || days.reduce((best, d) => (d.free > best.free ? d : best), days[0]);
        atRisk = !!t.deadline;
      }
      if (t.deadline && t.deadline < today) atRisk = true;

      t.plannedDate = placed.date;
      t.atRisk = atRisk;
      placed.free = Math.max(0, placed.free - need);
    });

    Store.save();
  }

  function tasksOn(dateStr) {
    return Store.state.tasks
      .filter(t => !t.someday && !t.done && t.plannedDate === dateStr)
      .sort(urgencySort);
  }

  function doneOn(dateStr) {
    return Store.state.tasks.filter(t =>
      t.done && t.doneAt && Store.toDateStr(new Date(t.doneAt)) === dateStr);
  }

  function plannedMinutesOn(dateStr) {
    return tasksOn(dateStr).reduce((a, t) => a + remainingMinutes(t), 0);
  }

  /* Tasks whose deadline can't comfortably be met. */
  function atRiskTasks() {
    return Store.state.tasks.filter(t => !t.done && !t.someday && t.atRisk);
  }

  return { replan, tasksOn, doneOn, remainingMinutes, plannedMinutesOn, dayBudget, atRiskTasks, HORIZON_DAYS };
})();
