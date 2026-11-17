import { calculate } from './math.js?v=2';

const $ = (id) => document.getElementById(id);
const form = $('calculator');
const fields = ['mode', 'length', 'degrees', 'minutes', 'seconds', 'slope', 'basis'];
const defaults = Object.fromEntries(fields.map((id) => [id, $(id).value]));
let angleMode = 'dms';
let current = null;
let currentInput = null;
let copyTimer;
const storageKey = 'svaya-calculator-v1';
const decimal = (value, places = 3) => Math.abs(value) >= 1e8
  ? value.toExponential(5).replace('.', ',')
  : value.toLocaleString('ru-RU', { minimumFractionDigits: places, maximumFractionDigits: places, useGrouping: false });
const metres = (value) => `${decimal(value)} м`;
function dms(value) {
  const ticks = Math.round(value * 3600 * 1000);
  const deg = Math.floor(ticks / 3600000);
  const min = Math.floor((ticks % 3600000) / 60000);
  const sec = (ticks % 60000) / 1000;
  const secondText = sec.toLocaleString('ru-RU', { maximumFractionDigits: 3, minimumIntegerDigits: 2, useGrouping: false });
  return `${deg}° ${String(min).padStart(2, '0')}′ ${secondText}″`;
}

function input() {
  return { ...Object.fromEntries(fields.map((id) => [id, $(id).value])), angleMode };
}

function setAngleMode(mode) {
  angleMode = mode;
  for (const method of ['dms', 'slope']) {
    $(`${method}-tab`).setAttribute('aria-pressed', String(method === mode));
    $(`${method}-panel`).hidden = method !== mode;
    for (const control of $(`${method}-panel`).querySelectorAll('input, select')) control.disabled = method !== mode;
  }
}

function updateDiagram(data) {
  // The angle is deliberately exaggerated at low inclinations for legibility.
  // The figure is explicitly marked schematic; the labels are the exact calculation.
  const visualAngle = data.angleDegrees === 0 ? 0 : Math.max(15, Math.min(40, data.angleDegrees));
  const x = 160 + Math.tan(visualAngle * Math.PI / 180) * 183;
  const line = `M160 36L${x} 219`;
  $('pile-line').setAttribute('d', line);
  $('pile-shadow').setAttribute('d', line);
  $('pile-end').setAttribute('cx', x);
  $('triangle-fill').setAttribute('d', `M160 36V219H${x}Z`);
  $('offset-line').setAttribute('d', `M160 219H${x}`);
  const arcX = 160 + 46 * Math.sin(visualAngle * Math.PI / 180);
  const arcY = 36 + 46 * Math.cos(visualAngle * Math.PI / 180);
  $('angle-arc').setAttribute('d', `M160 82A46 46 0 0 0 ${arcX} ${arcY}`);
  $('angle-arc').style.opacity = visualAngle === 0 ? '0' : '1';
  $('diagram-angle').textContent = `${decimal(data.angleDegrees, 4)}°`;
  $('diagram-height').textContent = metres(data.verticalLength);
  $('diagram-length').textContent = metres(data.pileLength);
  $('diagram-offset').textContent = metres(data.offset);
  $('diagram-offset').setAttribute('x', (160 + x) / 2);
  const labelX = Math.min(290, Math.max(225, 160 + (x - 160) * .5 + 25));
  $('diagram-length').setAttribute('x', labelX);
  $('diagram-pile-label').setAttribute('x', labelX);
  $('diagram-description').textContent = `Свая ${metres(data.pileLength)}. По вертикали ${metres(data.verticalLength)}. Смещение ${metres(data.offset)}. Угол от вертикали ${dms(data.angleDegrees)}. Схема условная, без масштаба.`;
  $('diagram').style.opacity = '1';
}

function update() {
  const value = input();
  const vertical = value.mode === 'vertical';
  $('length-label').textContent = vertical ? 'Длина вдоль сваи' : 'Длина по вертикали';
  $('length-hint').textContent = vertical ? 'фактическая' : 'известная';
  $('result-label').textContent = vertical ? 'Длина по вертикали' : 'Длина вдоль сваи';
  $('result-caption').textContent = vertical ? 'Вертикальная проекция участка сваи' : 'Длина наклонного участка сваи';
  $('difference-label').textContent = vertical ? 'Короче на' : 'Длиннее на';
  $('formula').textContent = vertical ? 'H = L × cos α' : 'L = H / cos α';
  const slopeValue = value.slope.trim() || '…';
  $('slope-help').textContent = `${slopeValue} мм в сторону на 1 м ${value.basis === 'vertical' ? 'по вертикали' : 'вдоль сваи'}.`;
  $('copy-fallback').hidden = true;
  $('copy-label').textContent = 'Скопировать расчёт';
  clearTimeout(copyTimer);
  try {
    current = calculate(value);
    currentInput = value;
    $('error').hidden = true;
    const resultText = decimal(current.result);
    $('result').textContent = resultText;
    $('result').style.fontSize = resultText.length > 10 ? '0.65em' : '';
    $('difference').textContent = metres(current.difference);
    $('offset').textContent = metres(current.offset);
    $('coefficient').textContent = decimal(current.coefficient);
    $('copy').disabled = false;
    updateDiagram(current);
  } catch (error) {
    current = null;
    currentInput = null;
    $('result').textContent = '—';
    $('difference').textContent = '—';
    $('offset').textContent = '—';
    $('coefficient').textContent = '—';
    $('error').textContent = error.message;
    $('error').hidden = false;
    $('copy').disabled = true;
    for (const id of ['diagram-height', 'diagram-length', 'diagram-offset', 'diagram-angle']) $(id).textContent = '—';
    $('diagram').style.opacity = '.45';
    $('diagram-description').textContent = 'Для построения схемы исправьте исходные данные.';
  }
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

function copyText() {
  if (!current || !currentInput) return '';
  const slopeDescription = `${currentInput.slope.trim()} мм на 1 м ${currentInput.basis === 'vertical' ? 'по вертикали' : 'вдоль сваи'}`;
  return [
    'Расчёт сваи с учётом наклона',
    `Длина вдоль сваи: ${metres(current.pileLength)}`,
    `Наклон от вертикали: ${dms(current.angleDegrees)}${angleMode === 'slope' ? ` (${slopeDescription})` : ''}`,
    `Длина по вертикали: ${metres(current.verticalLength)}`,
    `Горизонтальное смещение: ${metres(current.offset)}`,
    `Разница длин: ${metres(current.difference)}`,
    'Длины округлены до 0,001 м.',
    `Коэффициент сваи: ${decimal(current.coefficient)}`,
  ].join('\n');
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);
document.querySelectorAll('[data-angle]').forEach((button) => button.addEventListener('click', () => {
  setAngleMode(button.dataset.angle);
  update();
}));
$('reset').addEventListener('click', () => {
  for (const id of fields) $(id).value = defaults[id];
  setAngleMode('dms');
  update();
});
$('copy').addEventListener('click', async () => {
  const text = copyText();
  if (!text) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    $('copy-label').textContent = 'Расчёт скопирован ✓';
    $('copy-status').textContent = 'Расчёт скопирован в буфер обмена';
    copyTimer = setTimeout(() => { $('copy-label').textContent = 'Скопировать расчёт'; }, 2500);
  } catch {
    $('copy-text').value = text;
    $('copy-fallback').hidden = false;
    $('copy-text').focus();
    $('copy-text').select();
    $('copy-status').textContent = 'Скопируйте выделенный текст вручную';
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    for (const id of fields) if (typeof saved[id] === 'string' && saved[id].length < 100) $(id).value = saved[id];
    if (['dms', 'slope'].includes(saved.angleMode)) angleMode = saved.angleMode;
  }
} catch { /* Start with the example when storage is unavailable. */ }
setAngleMode(angleMode);
update();
