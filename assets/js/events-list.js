(function(){
  function qs(sel, el){ return (el||document).querySelector(sel); }
  function qsa(sel, el){ return Array.from((el||document).querySelectorAll(sel)); }

  function parseYMD(s){
    if(!s) return null;
    const [y,m,d] = String(s).split('-').map(Number);
    return new Date(y, (m||1)-1, d||1);
  }

  function parseEvents(data){
    const list = Array.isArray(data) ? data : (data && data.events) ? data.events : [];
    return (list||[]).map(e=>({
      label: e.label,
      type: e.type || 'event',
      start: parseYMD(e.start),
      end: e.end ? parseYMD(e.end) : parseYMD(e.start)
    }));
  }

  function formatDateRange(start, end){
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if(start.getTime() === end.getTime()){
      return start.toLocaleDateString('de-DE', opts);
    }
    // Multi-day event
    const startStr = start.toLocaleDateString('de-DE', opts);
    const endStr = end.toLocaleDateString('de-DE', opts);
    return `${startStr} – ${endStr}`;
  }

  function buildEventsList(container){
    const dataEl = qs('[data-events]', container);
    let eventsData = [];
    if(dataEl){
      try { eventsData = JSON.parse(dataEl.textContent); } catch(err){}
    }
    const events = parseEvents(eventsData);

    // Sort events by start date
    events.sort((a, b) => a.start - b.start);

    // Filter: only future and current events
    const today = new Date();
    today.setHours(0,0,0,0);
    const upcoming = events.filter(e => e.end >= today);

    container.innerHTML = '';

    if(!upcoming.length){
      container.innerHTML = '<div class="no-events">Keine kommenden Termine oder Schließzeiten vorhanden.</div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'events-list';

    upcoming.forEach(event => {
      const item = document.createElement('div');
      item.className = `event-item ${event.type}`;

      const dateDiv = document.createElement('div');
      dateDiv.className = 'event-date';
      dateDiv.textContent = formatDateRange(event.start, event.end);

      const labelDiv = document.createElement('div');
      labelDiv.className = 'event-label';
      labelDiv.textContent = event.label;

      const typeDiv = document.createElement('div');
      typeDiv.className = `event-type pill ${event.type}`;
      let typeText;
      if(event.type === 'closure') typeText = 'Geschlossen';
      else if(event.type === 'festivity') typeText = 'Fest';
      else typeText = 'Termin';
      typeDiv.textContent = typeText;

      item.append(dateDiv, labelDiv, typeDiv);
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  function init(){
    qsa('[data-events-list]').forEach(buildEventsList);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

