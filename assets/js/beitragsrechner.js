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
  function calculate({ childAgeType, netIncome, siblingsCount, careHours }) {
    // Kindergarten (≥3 Jahre) ist beitragsfrei
    if (childAgeType === 'kindergarten') {
      return {
        fee: 0,
        baseFee: 0,
      info: `<strong>Beitragsfrei (Alter >= ${META.KIGA_AGE_THRESHOLD} Jahre):</strong> Für Kinder ab ${META.KIGA_AGE_THRESHOLD} Jahren ist die Betreuung in Brandenburg beitragsfrei.`,
        showEntlastung: false
      };
    }

    // Krippe (<3 Jahre)
    // 7+ Kinder: beitragsfrei
    if (siblingsCount >= META.SIBLINGS_FREE_THRESHOLD) {
      return {
        fee: 0,
        baseFee: 0,
      info: `<strong>Beitragsfrei (Kinderanzahl >= ${META.SIBLINGS_FREE_THRESHOLD}):</strong> Bei ${siblingsCount} unterhaltsberechtigten Kindern entfällt der Elternbeitrag für Krippenkinder.`,
        showEntlastung: false
      };
    }

    // Einkommen <= 35k: beitragsfrei
    if (netIncome <= LIMITS.MIN_INCOME_FREE_U3) {
      return {
        fee: 0,
        baseFee: 0,
      info: `<strong>Beitragsfrei (Einkommen <= 35.000 EUR):</strong> Bei einem Jahreshaushaltsnettoeinkommen bis ${formatPrice(LIMITS.MIN_INCOME_FREE_U3)} sind Eltern von Krippenkindern von Beiträgen befreit (gemäß Elternbeitragsentlastungsgesetz).`,
        showEntlastung: true
      };
    }

    // Entlastungsbereich 35.000,01 - 55.000,00 (kein Geschwisterrabatt)
    if (netIncome >= LIMITS.MIN_INCOME_ENTLASTUNG_U3 && netIncome <= LIMITS.MAX_INCOME_ENTLASTUNG_U3) {
      const base = findRate(feeTableKrippeEntlastung, netIncome, careHours);
      return {
        fee: base,
        baseFee: base,
        info: `<strong>Reduzierter Beitrag (Einkommen U3 Entlastung):</strong> Bei ${formatPrice(netIncome)} Einkommen und ${careHours} Std./Woche beträgt der Beitrag ${formatPrice(base)} (gemäß Elternbeitragsentlastungsgesetz). <strong>Kein zusätzlicher Geschwisterrabatt in diesem Einkommensbereich.</strong>`,
        showEntlastung: true
      };
    }

    // Satzung (>= 55.000,01) + möglicher Geschwisterrabatt
    if (netIncome >= LIMITS.MIN_INCOME_SATZUNG_U3) {
      const base = findRate(feeTableKrippeSatzung, netIncome, careHours);
      const discountKey = clamp(siblingsCount, 1, META.MAX_SIBLINGS_FOR_DISCOUNT);
      const factor = SIBLING_DISCOUNT[discountKey] ?? 1.0;
      const fee = base * factor;

      let info = `<strong>Regulärer Beitrag (Einkommen U3 Satzung):</strong> Bei ${formatPrice(netIncome)} Einkommen und ${careHours} Std./Woche beträgt der Basisbeitrag ${formatPrice(base)} (gemäß Beitragssatzung).`;
      if (siblingsCount > 1 && factor < 1) {
        const percent = (100 - factor * 100).toFixed(0);
        info += ` <strong>Geschwisterermäßigung angewendet:</strong> Bei ${siblingsCount} Kindern (${percent}% Rabatt) reduziert sich der Beitrag auf ${formatPrice(fee)}.`;
      } else {
        info += ` Kein Geschwisterrabatt bei einem Kind.`;
      }

      return { fee, baseFee: base, info, showEntlastung: false };
    }

    // Fallback (sollte praktisch nicht auftreten, abgedeckt durch <=35k)
    return {
      fee: 0,
      baseFee: 0,
      info: `<strong>Beitragsfrei (Einkommen U3 < 35k):</strong> Das Einkommen liegt unter ${formatPrice(LIMITS.MIN_INCOME_FREE_U3)}.`,
      showEntlastung: true
    };
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
      careHours: parseInt($('careHours').value, 10) || 30
    };
  }

  function render(result, input) {
    const fee = Math.max(0, Number(result.fee) || 0);
    const total = fee + MONEY.FOOD_COST;

    $('feeResult').textContent = formatPrice(fee);
    $('totalCost').textContent = formatPrice(total);
    $('feeExplanation').innerHTML = result.info;

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
      if (saved.careHours) $('careHours').value = String(saved.careHours);
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

    // Radios: childAge & siblings
    document.querySelectorAll('input[name="childAge"], input[name="siblings"]').forEach(el => {
      el.addEventListener('change', maybeRecalc);
    });
    // netIncome tippen/schreiben
    $('netIncome').addEventListener('input', maybeRecalc);
    // careHours select
    $('careHours').addEventListener('change', maybeRecalc);

    // Keine Initialberechnung – erst auf Button-Klick
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
