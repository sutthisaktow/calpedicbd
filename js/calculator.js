// calculator.js — Pure calculation functions

/**
 * Calculate IBW for pediatric patients
 * @param {number} ageMonths
 * @returns {number|null}
 */
function getIBW(ageMonths) {
  if (ageMonths < 3) return null;
  if (ageMonths <= 11) return (ageMonths + 9) / 2;
  const y = ageMonths / 12;
  if (y < 7)  return 2 * y + 8;
  if (y < 13) return (7 * y - 5) / 2;
  return null;
}

function getDosingWeight(actual, ibw, useIBW) {
  if (!useIBW || ibw === null) return actual;
  return Math.min(actual, ibw);
}

/**
 * Calculate oral drug dose
 */
function calcOralDose(drug, weight, ibw) {
  if (drug.type === 'bracket') return calcBracketDose(drug, weight);

  const w = getDosingWeight(weight, ibw, drug.useIBW);
  const { mg, ml } = drug.concentration;
  const mlPerMg = ml / mg;

  let minDose = drug.min * w;
  let maxDose = drug.max ? drug.max * w : minDose;

  if (drug.maxDay) {
    const cap = drug.maxDay / drug.freq;
    minDose = Math.min(minDose, cap);
    maxDose = Math.min(maxDose, cap);
  }

  return {
    type: 'standard',
    weight: w,
    usedIBW: drug.useIBW && ibw !== null && ibw < weight,
    minMg: r1(minDose),
    maxMg: r1(maxDose),
    minML: r1(minDose * mlPerMg),
    maxML: r1(maxDose * mlPerMg),
    freq: drug.freq,
    remark: drug.remark,
    maxDay: drug.maxDay
  };
}

function calcBracketDose(drug, weight) {
  let bracket = drug.brackets[drug.brackets.length - 1];
  for (const b of drug.brackets) {
    if (weight >= b.minWeight) { bracket = b; break; }
  }

  const dose = bracket.formula === 'mg/kg'
    ? r2(bracket.dosePerKg * weight)
    : bracket.dose;

  return {
    type: 'bracket',
    label: bracket.label,
    dose,
    freq: drug.freq,
    remark: drug.remark
  };
}

/**
 * Calculate injection drug dose (mg/kg/day)
 */
function calcInjDose(drug, weight, ibw) {
  if (drug.type === 'subcondition') {
    return {
      type: 'subcondition',
      conditions: drug.conditions.map(c => {
        const w = getDosingWeight(weight, ibw, c.useIBW || false);
        let minDay = c.min * w;
        let maxDay = c.max ? c.max * w : null;
        if (c.maxDay) {
          minDay = Math.min(minDay, c.maxDay);
          if (maxDay) maxDay = Math.min(maxDay, c.maxDay);
        }
        return { label: c.label, minDay: r2(minDay), maxDay: r2(maxDay), manage: c.manage };
      })
    };
  }

  // Special: mg/dose unit (not mg/kg/day)
  if (drug.unit === 'mg/dose') {
    const minDay = drug.min * weight;
    const maxDay = drug.max ? drug.max * weight : null;
    const effectMin = drug.maxDay ? Math.min(minDay, drug.maxDay) : minDay;
    const effectMax = maxDay ? (drug.maxDay ? Math.min(maxDay, drug.maxDay) : maxDay) : null;
    return { type: 'standard', weight, minDay: r2(effectMin), maxDay: r2(effectMax), manage: drug.manage, maxDayCap: drug.maxDay, unit: 'mg/dose' };
  }

  if (drug.unit === 'units/kg/day') {
    return {
      type: 'units',
      minDay: Math.round(drug.min * weight),
      maxDay: drug.max ? Math.round(drug.max * weight) : null,
      manage: drug.manage
    };
  }

  const w = getDosingWeight(weight, ibw, drug.useIBW || false);
  let minDay = drug.min * w;
  let maxDay = drug.max ? drug.max * w : null;
  if (drug.maxDay) {
    minDay = Math.min(minDay, drug.maxDay);
    if (maxDay) maxDay = Math.min(maxDay, drug.maxDay);
  }

  return { type: 'standard', weight: w, minDay: r2(minDay), maxDay: r2(maxDay), manage: drug.manage, maxDayCap: drug.maxDay };
}

/**
 * Calculate TB drug dose (tablets)
 */
function calcTBDose(drug, weight, age) {
  let minDose = drug.min * weight;
  let maxDose = drug.max ? drug.max * weight : minDose;

  let maxDayLimit = drug.maxDay;
  if (drug.maxDayType === 'age_based') {
    maxDayLimit = age >= drug.elderlyAge ? drug.maxDayElderly : drug.maxDayYoung;
  }

  if (maxDayLimit) {
    minDose = Math.min(minDose, maxDayLimit);
    maxDose = Math.min(maxDose, maxDayLimit);
  }

  return {
    minDose: r2(minDose),
    maxDose: r2(maxDose),
    minTab: rHalf(minDose / drug.strength),
    maxTab: rHalf(maxDose / drug.strength),
    strength: drug.strength,
    maxDay: maxDayLimit,
    remark: drug.remark
  };
}

/**
 * Calculate CrCl via Cockcroft-Gault with AjBW
 */
function calcCrCl(age, weight, height, cr, isMale) {
  const base = isMale ? 50 : 45.5;
  const ibw = height >= 152.4
    ? base + 0.91 * (height - 152.4)
    : base - (0.833 * (152.4 - height) / 2.54);

  let ajbw;
  if (weight <= ibw) {
    ajbw = weight;
  } else if ((weight - ibw) > 0.3 * ibw) {
    ajbw = ibw + 0.4 * (weight - ibw);
  } else {
    ajbw = ibw;
  }

  const crcl = (140 - age) * weight * (isMale ? 1 : 0.85) / (72 * cr);
  return { crcl: r1(Math.max(crcl, 0)), ibw: r1(ibw), ajbw: r1(ajbw) };
}

// Helpers
function r2(n)    { return n === null ? null : Math.round(n * 100) / 100; }
function r1(n)    { return Math.round(n * 10) / 10; }
function rHalf(n) {
  const num = Math.floor(n);
  const dec = n - num;
  if (dec > 0.5) return num + 1;
  if (dec > 0)   return num + 0.5;
  return n;
}
