// Beitragsrechner – ausgelagertes und aufgeräumtes Skript
// Verantwortlich für: Lesen der Formwerte, Beitragslogik, Rendering der Ergebnisse

(function () {
  'use strict';

  // -----------------------------
  // Konstanten & Konfiguration
  // -----------------------------
  const MONEY = Object.freeze({
    FOOD_COST: 45.40
  });

  const LIMITS = Object.freeze({
    MIN_INCOME_FREE_U3: 35000.0, // beitragsfrei U3
    MIN_INCOME_ENTLASTUNG_U3: 35000.01,
    MAX_INCOME_ENTLASTUNG_U3: 55000.0,
    MIN_INCOME_SATZUNG_U3: 55000.01
  });

  const META = Object.freeze({
    KIGA_AGE_THRESHOLD: 3,
    MAX_SIBLINGS_FOR_DISCOUNT: 6,
    SIBLINGS_FREE_THRESHOLD: 7
  });

  // Tabellen: aufsteigend nach minIncome, Raten für [30,35,40,45,50,55]
  const feeTableKrippeSatzung = [
    { minIncome: 20000.01, rates: [55.52, 62.46, 69.40, 76.34, 83.28, 90.22] },
    { minIncome: 22000.0, rates: [77.73, 87.44, 97.16, 106.88, 116.59, 126.31] },
    { minIncome: 25000.0, rates: [107.25, 120.66, 134.07, 147.48, 160.88, 174.29] },
    { minIncome: 28000.0, rates: [141.32, 158.99, 176.65, 194.32, 211.99, 229.65] },
    { minIncome: 31000.0, rates: [156.47, 176.02, 195.58, 215.14, 234.70, 254.26] },
    { minIncome: 34000.0, rates: [171.61, 193.06, 214.51, 235.96, 257.41, 278.86] },
    { minIncome: 37000.0, rates: [186.75, 210.09, 233.44, 256.78, 280.12, 303.47] },
    { minIncome: 40000.0, rates: [201.89, 227.13, 252.36, 277.60, 302.84, 328.07] },
    { minIncome: 43000.0, rates: [217.03, 244.16, 271.29, 298.42, 325.55, 352.68] },
    { minIncome: 46000.0, rates: [232.17, 261.20, 290.22, 319.24, 348.26, 377.28] },
    { minIncome: 49000.0, rates: [247.32, 278.23, 309.15, 340.06, 370.97, 401.89] },
    { minIncome: 52000.0, rates: [262.46, 295.27, 328.07, 360.88, 393.69, 426.49] },
    { minIncome: 55000.01, rates: [277.60, 312.30, 347.00, 381.70, 416.40, 451.10] }
  ];

  const feeTableKrippeEntlastung = [
    { minIncome: 35000.01, rates: [48.0, 54.0, 60.0, 66.0, 72.0, 78.0] },
    { minIncome: 40000.01, rates: [80.0, 90.0, 100.0, 110.0, 120.0, 130.0] },
    { minIncome: 45000.01, rates: [120.0, 135.0, 150.0, 165.0, 180.0, 195.0] },
    { minIncome: 50000.01, rates: [168.0, 189.0, 210.0, 231.0, 252.0, 273.0] }
  ];


  const SIBLING_DISCOUNT = Object.freeze({
    1: 1.0,
    2: 0.9,
    3: 0.8,
    4: 0.65,
    5: 0.45,
    6: 0.25
  });

  // -----------------------------
  // Utilities
  // -----------------------------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) return '-- EUR';
    const rounded = Math.round(price * 100) / 100;
    return Number.isInteger(rounded)
      ? `${rounded.toFixed(0)} EUR`
      : `${rounded.toFixed(2).replace('.', ',')} EUR`;
  }

  function hoursToIndex(hours) {
    // maps 30,35,40,45,50,55 to indices 0..5 robustly
    return clamp(Math.round((Number(hours) - 30) / 5), 0, 5);
  }

  function findRate(table, income, hours) {
    const idx = hoursToIndex(hours);
    // find last bracket whose minIncome <= income
    for (let i = table.length - 1; i >= 0; i--) {
      const row = table[i];
      if (income >= row.minIncome) {
        return row.rates[idx] ?? 0;
      }
    }
    // below lowest bracket
    return 0;
  }

  // -----------------------------
  // Berechnungskern
  // -----------------------------
  function calculate({ childAgeType, netIncome, siblingsCount, careHours, highestRate }) {
    // Kindergarten (≥3 Jahre) ist beitragsfrei
    if (childAgeType === 'kindergarten') {
      return {
        fee: 0,
        baseFee: 0,
        info: '',
        showEntlastung: false,
        meta: {
          rule: `Beitragsfrei (ab ${META.KIGA_AGE_THRESHOLD} Jahren)`,
          notes: ['Die Betreuung im Kindergartenalter ist in Brandenburg beitragsfrei.']
        }
      };
    }

    // Krippe (<3 Jahre)
    // 7+ Kinder: beitragsfrei
    if (siblingsCount >= META.SIBLINGS_FREE_THRESHOLD) {
      return {
        fee: 0,
        baseFee: 0,
        info: '',
        showEntlastung: false,
        meta: {
          rule: `Beitragsfrei (≥ ${META.SIBLINGS_FREE_THRESHOLD} Kinder)`,
          notes: ['Bei 7 oder mehr unterhaltsberechtigten Kindern entfällt der Elternbeitrag.']
        }
      };
    }

    // Höchstsatz freiwillig zahlen (Einkommensprüfung entfällt, Geschwisterrabatt wird berücksichtigt)
  if (highestRate === true) {
      const lastRow = feeTableKrippeSatzung[feeTableKrippeSatzung.length - 1];
      const base = lastRow.rates[hoursToIndex(careHours)] || 0;
      const discountKey = clamp(siblingsCount, 1, META.MAX_SIBLINGS_FOR_DISCOUNT);
      const factor = SIBLING_DISCOUNT[discountKey] ?? 1.0;
      const fee = base * factor;

      let info = `<strong>Höchstsatz gewählt:</strong> Es wird der höchste Beitragssatz gemäß Beitragssatzung angesetzt (Einkommensprüfung entfällt). Basis für ${careHours} Std./Woche: ${formatPrice(base)}.`;
      if (siblingsCount > 1 && factor < 1) {
        const percent = (100 - factor * 100).toFixed(0);
        info += ` <strong>Geschwisterermäßigung berücksichtigt:</strong> Bei ${siblingsCount} Kindern (${percent}% Rabatt) ergibt sich ${formatPrice(fee)}.`;
      }

      return {
        fee,
        baseFee: base,
        info,
        showEntlastung: false,
        meta: {
          rule: 'Höchstsatz (Satzung U3)',
          highestRate: true,
          discountFactor: factor,
          discountPercent: Math.max(0, Math.round((1 - factor) * 100)),
          notes: []
        }
      };
    }

    // Einkommen <= 35k: beitragsfrei
    if (netIncome <= LIMITS.MIN_INCOME_FREE_U3) {
      return {
        fee: 0,
        baseFee: 0,
        info: '',
        showEntlastung: true,
        meta: {
          rule: 'Beitragsfrei (Einkommen ≤ 35.000 EUR)',
          notes: ['Gemäß Elternbeitragsentlastungsgesetz.']
        }
      };
    }

    // Entlastungsbereich 35.000,01 - 55.000,00 (kein Geschwisterrabatt)
    if (netIncome >= LIMITS.MIN_INCOME_ENTLASTUNG_U3 && netIncome <= LIMITS.MAX_INCOME_ENTLASTUNG_U3) {
      const base = findRate(feeTableKrippeEntlastung, netIncome, careHours);
      return {
        fee: base,
        baseFee: base,
        info: '',
        showEntlastung: true,
        meta: {
          rule: 'Reduzierter Beitrag (Entlastung U3)',
          discountFactor: 1,
          notes: ['Kein zusätzlicher Geschwisterrabatt in diesem Einkommensbereich.', 'Rechtsgrundlage: Elternbeitragsentlastungsgesetz.']
        }
      };
    }

    // Satzung (>= 55.000,01) + möglicher Geschwisterrabatt
    if (netIncome >= LIMITS.MIN_INCOME_SATZUNG_U3) {
      const base = findRate(feeTableKrippeSatzung, netIncome, careHours);
      const discountKey = clamp(siblingsCount, 1, META.MAX_SIBLINGS_FOR_DISCOUNT);
      const factor = SIBLING_DISCOUNT[discountKey] ?? 1.0;
      const fee = base * factor;

      const percent = Math.max(0, Math.round((1 - factor) * 100));
      const meta = {
        rule: 'Regulärer Beitrag (Satzung U3)',
        discountFactor: factor,
        discountPercent: percent,
        notes: []
      };
      if (siblingsCount > 1 && factor < 1) {
        meta.notes.push(`Geschwisterermäßigung: ${percent}% Rabatt bei ${siblingsCount} Kindern.`);
      }
      return { fee, baseFee: base, info: '', showEntlastung: false, meta };
    }

    // Fallback (sollte praktisch nicht auftreten, abgedeckt durch <=35k)
    return {
      fee: 0,
      baseFee: 0,
      info: '',
      showEntlastung: true,
      meta: { rule: 'Beitragsfrei (Einkommen U3 < 35k)', notes: [] }
    };
  }

  // Baue strukturierte Erklärung
  function buildExplanation(result, input) {
    const { fee, baseFee, meta } = result;
    const discountApplied = typeof meta?.discountFactor === 'number' && meta.discountFactor < 1;
    const discountPercent = discountApplied
      ? (typeof meta.discountPercent === 'number' ? `${meta.discountPercent}%` : `${(100 - meta.discountFactor * 100).toFixed(0)}%`)
      : '';

    const incomeText = input.childAgeType === 'kindergarten' ? '–' : formatPrice(input.netIncome);
    const siblingsText = String(input.siblingsCount);
    const hoursText = `${input.careHours} h/Woche`;

    const notes = (meta?.notes || [])
      .map(n => `<li>${n}</li>`)
      .join('');

    // Build rows dynamically
    const rows = [
      [meta?.highestRate ? 'Tarif' : 'Einkommen', meta?.highestRate ? 'Höchstsatz (Satzung)' : incomeText],
      ['Kinder', siblingsText],
      ['Betreuung', hoursText]
    ];
    if (discountApplied) {
      rows.push(['Basisbeitrag', formatPrice(baseFee)]);
      rows.push(['Geschwisterrabatt', discountPercent]);
    }

    const grid = rows
      .map(([l, v]) => `<div class="label">${l}</div><div class="value">${v}</div>`)
      .join('');

    return `
      <div class="explain-title"><strong>${meta?.rule || 'Zusammensetzung'}</strong></div>
      <div class="explain-grid">${grid}</div>
      ${notes ? `<ul class="explain-notes">${notes}</ul>` : ''}
    `;
  }

  // -----------------------------
  // DOM-Integration
  // -----------------------------
  function $(id) { return document.getElementById(id); }

  function getCheckedValue(name, fallback = null) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : fallback;
  }

  const STORAGE_KEY = 'beitragsrechnerState.v1';

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function readForm() {
    return {
  childAgeType: getCheckedValue('childAge', 'krippe'),
  netIncome: parseFloat($('netIncome').value) || 0,
  siblingsCount: parseInt(getCheckedValue('siblings', '1'), 10) || 1,
      careHours: parseInt(getCheckedValue('careHours', '30'), 10) || 30,
      highestRate: !!($('highestRate') && $('highestRate').checked)
    };
  }

  function render(result, input) {
    const fee = Math.max(0, Number(result.fee) || 0);
    const total = fee + MONEY.FOOD_COST;

    $('feeResult').textContent = formatPrice(fee);
    $('totalCost').textContent = formatPrice(total);
  $('feeExplanation').innerHTML = buildExplanation(result, input);

    const entlastungsLink = $('entlastungsLink');
    if (input.childAgeType === 'krippe' && result.showEntlastung) entlastungsLink.classList.remove('hidden');
    else entlastungsLink.classList.add('hidden');

    const resultSection = $('resultSection');
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function recalc() {
    const input = readForm();
    saveState(input);
    const result = calculate(input);
    render(result, input);
  }

  function init() {
    // DOM vorhanden
    const btn = $('calculateButton');
    const foodCostDisplay = $('foodCostDisplay');
    if (foodCostDisplay) foodCostDisplay.textContent = formatPrice(MONEY.FOOD_COST);

    // Saved state anwenden
    const saved = loadState();
    if (saved) {
      // childAge radios
      const ageEl = document.querySelector(`input[name="childAge"][value="${saved.childAgeType}"]`);
      if (ageEl) ageEl.checked = true;
      // siblings radios
      const sibEl = document.querySelector(`input[name="siblings"][value="${saved.siblingsCount}"]`);
      if (sibEl) sibEl.checked = true;
      // income and hours
      if (typeof saved.netIncome === 'number' && !Number.isNaN(saved.netIncome)) $('netIncome').value = saved.netIncome;
      if (saved.careHours) {
        const ch = document.querySelector(`input[name="careHours"][value="${saved.careHours}"]`);
        if (ch) ch.checked = true;
      }
      if (typeof saved.highestRate === 'boolean') {
        const hr = $('highestRate');
        if (hr) hr.checked = saved.highestRate;
      }
    }

    // Events
    btn && btn.addEventListener('click', recalc);

    const resultSection = $('resultSection');
    const maybeRecalc = () => {
      // erste Berechnung nur via Button: erst wenn sichtbar, dann live nachrechnen
      const visible = !resultSection.classList.contains('hidden');
      const input = readForm();
      saveState(input);
      if (visible) {
        const result = calculate(input);
        render(result, input);
      }
    };

    // Radios: childAge & siblings & careHours
    document.querySelectorAll('input[name="childAge"], input[name="siblings"], input[name="careHours"]').forEach(el => {
      el.addEventListener('change', maybeRecalc);
    });
    // netIncome tippen/schreiben
    const incomeEl = $('netIncome');
    incomeEl.addEventListener('input', maybeRecalc);
    // Klick ins Einkommen-Feld deaktiviert Höchstsatz
    incomeEl.addEventListener('focus', () => {
      const hr = $('highestRate');
      if (hr && hr.checked) {
        hr.checked = false;
        maybeRecalc();
      }
    });
    // Höchstsatz Checkbox
    const hr = $('highestRate');
    if (hr) {
      hr.addEventListener('change', maybeRecalc);
    }

  // Keine Initialberechnung – erst auf Button-Klick

    // Info-Popover für Höchstsatz
    const infoBtn = document.querySelector('.highest-option .info-icon');
    const infoPop = document.getElementById('highestRateInfo');
    if (infoBtn && infoPop) {
      const closeAll = () => {
        infoPop.classList.remove('show');
        infoBtn.setAttribute('aria-expanded', 'false');
      };
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = infoPop.classList.toggle('show');
        infoBtn.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', (e) => {
        // Schließen bei Klick außerhalb
        if (!infoPop.contains(e.target) && e.target !== infoBtn) closeAll();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
