// app.js — Application logic

const data = { oral: [], injection: [], tb: [], renal: [] };

async function loadData() {
  try {
    const [oral, injection, tb, renal] = await Promise.all([
      fetch('data/oral.json').then(r => r.json()),
      fetch('data/injection.json').then(r => r.json()),
      fetch('data/tb.json').then(r => r.json()),
      fetch('data/renal.json').then(r => r.json()),
    ]);
    Object.assign(data, { oral, injection, tb, renal });
    showEmpty('oral-results', '💊', 'ใส่น้ำหนักและอายุ แล้วกด คำนวณ');
    showEmpty('inj-results', '💉', 'ใส่น้ำหนักและอายุ แล้วกด คำนวณ');
    showEmpty('tb-results', '🫁', 'ใส่น้ำหนักและอายุ แล้วกด คำนวณ');
    showEmpty('renal-results', '🫘', 'ใส่ข้อมูลผู้ป่วย แล้วกด คำนวณ');
  } catch (e) {
    console.error('Load error:', e);
  }
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ORAL ────────────────────────────────────────────────────────
function calcOral() {
  const weight = parseFloat(document.getElementById('oral-weight').value);
  const ageY   = parseInt(document.getElementById('oral-age-y').value)  || 0;
  const ageM   = parseInt(document.getElementById('oral-age-m').value)  || 0;
  if (!weight || weight <= 0) { toast('กรุณาใส่น้ำหนัก'); return; }

  const ageMonths = ageY * 12 + ageM;
  const ibw = getIBW(ageMonths);
  const ibwEl = document.getElementById('oral-ibw');
  if (ibw !== null) {
    ibwEl.className = 'ibw-badge';
    ibwEl.innerHTML = `IBW: <strong>${ibw} kg</strong>&nbsp;|&nbsp;น้ำหนักจริง: <strong>${weight} kg</strong>`
      + (weight > ibw ? ' <span class="warn-text">⚠ น้ำหนักเกิน IBW</span>' : '');
  } else {
    ibwEl.className = 'ibw-badge hidden';
  }

  const container = document.getElementById('oral-results');
  container.innerHTML = '';
  data.oral.forEach(drug => {
    const res = calcOralDose(drug, weight, ibw);
    container.appendChild(makeOralCard(drug, res));
  });
}

function makeOralCard(drug, res) {
  const d = document.createElement('div');
  d.className = 'drug-card oral';

  if (res.type === 'bracket') {
    const mlNote = '';  // bracket type gives mg, no concentration to convert
    d.innerHTML = `
      <div class="drug-name">${drug.name}</div>
      <div class="drug-dose">${res.dose} mg/dose</div>
      <div class="drug-detail">${res.label}</div>
      <span class="drug-freq">${freqLabel(res.freq)}</span>
      ${res.remark ? `<div class="drug-remark">${res.remark}</div>` : ''}
    `;
  } else {
    const doseRange = res.maxMg > res.minMg ? `${res.minMg}–${res.maxMg}` : `${res.minMg}`;
    const mlRange   = res.maxML > res.minML ? `${res.minML}–${res.maxML}` : `${res.minML}`;
    const ibwNote   = res.usedIBW ? '<small class="ibw-note"> (IBW)</small>' : '';
    d.innerHTML = `
      <div class="drug-name">${drug.name}</div>
      <div class="drug-dose">${mlRange} mL/dose</div>
      <div class="drug-detail">${doseRange} mg/dose${ibwNote}</div>
      <span class="drug-freq">${freqLabel(res.freq)}</span>
      ${res.remark ? `<div class="drug-remark">${res.remark}</div>` : ''}
      ${res.maxDay ? `<div class="drug-max">max ${res.maxDay} mg/day</div>` : ''}
    `;
  }
  return d;
}

// ── INJECTION ──────────────────────────────────────────────────
function calcInj() {
  const weight = parseFloat(document.getElementById('inj-weight').value);
  const ageY   = parseInt(document.getElementById('inj-age-y').value)  || 0;
  const ageM   = parseInt(document.getElementById('inj-age-m').value)  || 0;
  if (!weight || weight <= 0) { toast('กรุณาใส่น้ำหนัก'); return; }

  const ageMonths = ageY * 12 + ageM;
  const ibw = getIBW(ageMonths);
  const ibwEl = document.getElementById('inj-ibw');
  if (ibw !== null) {
    ibwEl.className = 'ibw-badge';
    ibwEl.innerHTML = `IBW: <strong>${ibw} kg</strong>&nbsp;|&nbsp;น้ำหนักจริง: <strong>${weight} kg</strong>`;
  } else {
    ibwEl.className = 'ibw-badge hidden';
  }

  const container = document.getElementById('inj-results');
  container.innerHTML = '';
  data.injection.forEach(drug => {
    const res = calcInjDose(drug, weight, ibw);
    container.appendChild(makeInjCard(drug, res));
  });
}

function makeInjCard(drug, res) {
  const d = document.createElement('div');
  d.className = 'drug-card inj';

  if (drug.type === 'empty') {
    d.innerHTML = `<div class="drug-name">${drug.name}</div><div class="drug-detail" style="color:#999">— ไม่มีข้อมูล —</div>`;
    return d;
  }

  if (res.type === 'subcondition') {
    const rows = res.conditions.map(c => {
      const dose = c.maxDay !== null
        ? `${c.minDay}–${c.maxDay} mg/day`
        : `${c.minDay} mg/day`;
      return `<div class="sub-item">
        <div class="sub-label">${c.label}</div>
        <div class="sub-dose">${dose}</div>
        ${c.manage ? `<div class="sub-manage">${c.manage}</div>` : ''}
      </div>`;
    }).join('');
    d.innerHTML = `<div class="drug-name">${drug.name}</div><div class="sub-grid">${rows}</div>`;
    return d;
  }

  if (res.type === 'units') {
    const dose = res.maxDay ? `${res.minDay.toLocaleString()}–${res.maxDay.toLocaleString()} units/day` : `${res.minDay.toLocaleString()} units/day`;
    d.innerHTML = `
      <div class="drug-name">${drug.name}</div>
      <div class="drug-dose" style="font-size:16px">${dose}</div>
      ${res.manage ? `<div class="drug-detail">${res.manage}</div>` : ''}
    `;
    return d;
  }

  const label = res.unit === 'mg/dose' ? 'mg/dose' : 'mg/day';
  const dose = res.maxDay !== null
    ? `${res.minDay}–${res.maxDay} ${label}`
    : `${res.minDay} ${label}`;
  d.innerHTML = `
    <div class="drug-name">${drug.name}</div>
    <div class="drug-dose">${dose}</div>
    ${res.manage ? `<div class="drug-detail">${res.manage}</div>` : ''}
    ${res.maxDayCap ? `<div class="drug-max">max ${res.maxDayCap} mg/day</div>` : ''}
    ${drug.note ? `<div class="drug-remark">${drug.note}</div>` : ''}
  `;
  return d;
}

// ── TB ─────────────────────────────────────────────────────────
function calcTB() {
  const weight = parseFloat(document.getElementById('tb-weight').value);
  const age    = parseInt(document.getElementById('tb-age').value) || 0;
  if (!weight || weight <= 0) { toast('กรุณาใส่น้ำหนัก'); return; }

  const container = document.getElementById('tb-results');
  container.innerHTML = '';
  data.tb.forEach(drug => {
    const res = calcTBDose(drug, weight, age);
    container.appendChild(makeTBCard(drug, res));
  });
}

function makeTBCard(drug, res) {
  const d = document.createElement('div');
  d.className = 'drug-card tb';
  const tabRange  = res.maxTab > res.minTab ? `${res.minTab}–${res.maxTab}` : `${res.minTab}`;
  const doseRange = res.maxDose > res.minDose ? `${res.minDose}–${res.maxDose}` : `${res.minDose}`;
  d.innerHTML = `
    <div class="drug-name">${drug.name}</div>
    <div class="drug-dose">${tabRange} เม็ด/วัน</div>
    <div class="drug-detail">${doseRange} mg/day | ${drug.strength}mg/${drug.unit}</div>
    ${res.maxDay ? `<div class="drug-max">max ${res.maxDay} mg/day</div>` : ''}
    ${res.remark ? `<div class="drug-remark">${res.remark}</div>` : ''}
  `;
  return d;
}

// ── RENAL ──────────────────────────────────────────────────────
function calcRenal() {
  const age    = parseInt(document.getElementById('renal-age').value);
  const cr     = parseFloat(document.getElementById('renal-cr').value);
  const height = parseFloat(document.getElementById('renal-height').value);
  const weight = parseFloat(document.getElementById('renal-weight').value);
  const egfr   = parseFloat(document.getElementById('renal-egfr').value) || null;
  const isMale = document.querySelector('input[name="renal-sex"]:checked').value === 'male';

  if (!age || !cr || !height || !weight) { toast('กรุณาใส่ข้อมูลให้ครบ'); return; }

  const { crcl, ibw, ajbw } = calcCrCl(age, weight, height, cr, isMale);
  const display = document.getElementById('renal-crcl-display');
  display.className = 'ibw-badge';
  display.innerHTML = `CrCl: <strong>${crcl} mL/min</strong>&nbsp;|&nbsp;IBW: <strong>${ibw} kg</strong>&nbsp;|&nbsp;AjBW: <strong>${ajbw} kg</strong>`
    + (egfr ? `&nbsp;|&nbsp;eGFR: <strong>${egfr}</strong>` : '');

  const container = document.getElementById('renal-results');
  container.innerHTML = '';
  data.renal.forEach(drug => {
    container.appendChild(makeRenalCard(drug, crcl, egfr));
  });
}

function makeRenalCard(drug, crcl, egfr) {
  const d = document.createElement('div');
  d.className = 'renal-card';

  const val = drug.useEGFR && egfr !== null ? egfr : crcl;

  let activeIdx = -1;
  if (drug.rules) {
    activeIdx = drug.rules.findIndex(r => {
      const lo = r.min !== undefined ? r.min : -Infinity;
      const hi = r.max !== undefined ? r.max : Infinity;
      return val >= lo && val < hi;
    });
  }

  if (activeIdx >= 0) {
    const s = drug.rules[activeIdx].status;
    d.classList.add(s === 'contraindicated' ? 'danger' : s === 'adjusted' ? 'caution' : 'safe');
  }

  const rows = (drug.rules || []).map((r, i) => {
    const active = i === activeIdx;
    return `<div class="renal-row ${active ? 'active-row' : ''}">
      <span class="renal-range">${r.range}</span>
      <span class="renal-dose">${r.dose}</span>
    </div>`;
  }).join('');

  d.innerHTML = `
    <div class="renal-name">
      ${drug.flag === '*' ? '<span class="flag">★</span>' : ''}
      ${drug.name}
      ${drug.maxText ? `<span class="max-text">${drug.maxText}</span>` : ''}
    </div>
    ${drug.normalDose ? `<div class="normal-dose">ปกติ: ${drug.normalDose}</div>` : ''}
    <div class="renal-rules">${rows}</div>
    ${drug.dialysis ? `<div class="dialysis-note">HD/PD: ${drug.dialysis}</div>` : ''}
    ${drug.remark ? `<div class="drug-remark">${drug.remark}</div>` : ''}
  `;
  return d;
}

// ── Helpers ────────────────────────────────────────────────────
function freqLabel(f) {
  return { 1: 'วันละ 1 ครั้ง', 2: 'วันละ 2 ครั้ง', 3: 'วันละ 3 ครั้ง', 4: 'วันละ 4 ครั้ง', 6: 'ทุก 4–6 ชม.' }[f] || `${f}×/วัน`;
}

function showEmpty(id, icon, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><div>${msg}</div></div>`;
}

function filterResults(containerId, query) {
  const q = query.trim().toLowerCase();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.drug-card, .renal-card').forEach(card => {
    const nameEl = card.querySelector('.drug-name, .renal-name');
    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
    card.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Enter key support ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.querySelector('.tab-content.active');
    if (!active) return;
    const btn = active.querySelector('.btn-calc');
    if (btn) btn.click();
  }
});

// Init
loadData();
