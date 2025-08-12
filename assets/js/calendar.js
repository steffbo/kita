(function(){
  function qs(sel, el){ return (el||document).querySelector(sel); }
  function qsa(sel, el){ return Array.from((el||document).querySelectorAll(sel)); }
  // Format date as YYYY-MM-DD in local time (avoid UTC shift)
  function fmtDate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function addDays(date, n){ const d=new Date(date); d.setDate(d.getDate()+n); return d; }
  // Parse 'YYYY-MM-DD' as local date (no timezone shift)
  function parseYMD(s){
    if(!s) return null;
    const [y,m,d] = String(s).split('-').map(Number);
    return new Date(y, (m||1)-1, d||1);
  }

  function parseRanges(data){
    // data: { events: [{label, type, start, end?}] } OR array fallback
    const list = Array.isArray(data) ? data : (data && data.events) ? data.events : [];
    return (list||[]).map(e=>({
      label: e.label,
      type: e.type || 'event',
      start: parseYMD(e.start),
      end: e.end ? parseYMD(e.end) : parseYMD(e.start)
    }));
  }

  function monthRange(year, month){
    const first = new Date(year, month, 1);
    const last = new Date(year, month+1, 0);
    return {first, last};
  }

  function inRange(d, r){ return d >= r.start && d <= r.end; }

  function buildCalendar(container){
    const dataEl = qs('[data-events]', container);
    let closures = [];
    if(dataEl){
      try { closures = JSON.parse(dataEl.textContent); } catch(err){}
    }
    const ranges = parseRanges(closures);

    let today = new Date();
    today.setHours(0,0,0,0);
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

  // Header mit Titel links und Steuerungsgruppe rechts (‹ Heute ›)
  const header = document.createElement('div');
  header.className = 'cal-header';
  const title = document.createElement('div'); title.className='cal-title';
  const navGroup = document.createElement('div'); navGroup.className = 'cal-nav-group';
  const prev = document.createElement('button'); prev.type='button'; prev.className='cal-nav prev'; prev.setAttribute('aria-label','Vorheriger Monat'); prev.textContent='‹';
  const todayBtn = document.createElement('button'); todayBtn.type='button'; todayBtn.className='cal-nav today'; todayBtn.setAttribute('aria-label','Zum heutigen Monat springen'); todayBtn.textContent='Heute';
  const next = document.createElement('button'); next.type='button'; next.className='cal-nav next'; next.setAttribute('aria-label','Nächster Monat'); next.textContent='›';
  navGroup.append(prev, todayBtn, next);
  header.append(title, navGroup);

    const grid = document.createElement('div'); grid.className='cal-grid';
  const legend = document.createElement('div'); legend.className='cal-legend';
  legend.innerHTML = '<span class="badge closed"></span>Schließzeit <span class="badge festivity"></span>Fest <span class="badge event"></span>Termin';

    container.innerHTML='';
    container.append(header, grid, legend);

    function render(){
      const {first, last} = monthRange(viewYear, viewMonth);
      const monthName = first.toLocaleDateString('de-DE', { month:'long', year:'numeric' });
      title.textContent = monthName.charAt(0).toUpperCase()+monthName.slice(1);

      grid.innerHTML='';
      const dow = ['Mo','Di','Mi','Do','Fr','Sa','So'];
      dow.forEach(d=>{
        const h = document.createElement('div'); h.className='cal-cell cal-head'; h.textContent=d; grid.appendChild(h);
      });

      // Helper to create a day cell; mark outside-of-month if needed
    function createDayCell(d, isOutside){
        const cell = document.createElement('button');
        cell.type='button';
        cell.className='cal-cell cal-day' + (isOutside ? ' cal-out' : '');
        cell.setAttribute('data-date', fmtDate(d));
        cell.innerHTML = '<span class="num">'+ d.getDate() +'</span>';
        if(d.getDay()===0 || d.getDay()===6){ cell.classList.add('wknd'); }
        if(fmtDate(d)===fmtDate(today)) cell.classList.add('today');
        const hits = ranges.filter(r=>inRange(d,r));
        if(hits.length){
          // Precedence: closure > festivity > event
          let dayType = null;
          if(hits.some(h=>h.type==='closure')) dayType = 'closed'; // CSS uses .closed
          else if(hits.some(h=>h.type==='festivity')) dayType = 'festivity';
          else if(hits.some(h=>h.type==='event')) dayType = 'event';
          if(dayType) cell.classList.add(dayType);
          cell.title = hits.map(h=>h.label).join(' • ');
          cell.addEventListener('click', ()=> showDetails(d, hits));
        } else {
          cell.addEventListener('click', ()=> showDetails(d, []));
        }
        grid.appendChild(cell);
      }

      // start at Monday; render leading days from previous month instead of pads
      const firstWeekday = (first.getDay()+6)%7; // 0=Mo
      if(firstWeekday>0){
        const prevMonthLast = new Date(viewYear, viewMonth, 0); // last day of previous month
        const startDay = prevMonthLast.getDate() - firstWeekday + 1;
        for(let day=startDay; day<=prevMonthLast.getDate(); day++){
          const d = new Date(viewYear, viewMonth-1, day);
          createDayCell(d, true);
        }
      }

      // current month days
      for(let d=new Date(first); d<=last; d=addDays(d,1)){
        createDayCell(d, false);
      }

      // trailing days from next month to complete the final week (if needed)
      const lastWeekday = (last.getDay()+6)%7; // 0=Mo, 6=So
      if(lastWeekday<6){
        const need = 6 - lastWeekday;
        for(let i=1; i<=need; i++){
          const d = new Date(viewYear, viewMonth+1, i);
          createDayCell(d, true);
        }
      }
    }

    prev.addEventListener('click', ()=>{ viewMonth--; if(viewMonth<0){ viewMonth=11; viewYear--; } render(); });
    next.addEventListener('click', ()=>{ viewMonth++; if(viewMonth>11){ viewMonth=0; viewYear++; } render(); });
    todayBtn.addEventListener('click', ()=>{
      const now = new Date(); now.setHours(0,0,0,0);
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
      render();
      // Fokus auf heutigen Tag setzen, wenn sichtbar
      const todayCell = container.querySelector('.cal-day.today');
      if(todayCell) todayCell.focus();
    });

    const detailsEl = qs('.cal-details', container) || document.createElement('div');
    detailsEl.classList.add('cal-details');

    function showDetails(dateObj, items){
      if(!detailsEl.parentNode) container.appendChild(detailsEl);
      if(!items.length){
        detailsEl.innerHTML = '<div class="no-events">Keine besonderen Anlässe oder Schließzeiten an diesem Tag.</div>';
        return;
      }
      const d = new Date(dateObj);
      const header = d.toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' });
      const list = items.map(i => {
        let t;
        if(i.type==='closure') t = 'Geschlossen';
        else if(i.type==='festivity') t = 'Fest';
        else t = 'Termin';
        return `<li><span class="pill ${i.type}">${t}</span> ${i.label}</li>`;
      }).join('');
      detailsEl.innerHTML = `<div class="details-head">${header}</div><ul class="details-list">${list}</ul>`;
    }

    render();
  }

  function init(){
    qsa('[data-calendar]').forEach(buildCalendar);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
