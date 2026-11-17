/** Parse a decimal number without thousands separators. */
export function parseDecimal(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') {
    throw new Error('Введите число, например 50,560.');
  }
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) {
    throw new Error('Введите число без пробелов и разделителей тысяч, например 50,560.');
  }
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number)) throw new Error('Введите конечное число.');
  return number;
}

function field(value, label, optional = false) {
  if (optional && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) return 0;
  try {
    return parseDecimal(value);
  } catch {
    throw new Error(`${label}: введите число, используя запятую или точку.`);
  }
}

/** All lengths are metres; inclination is measured from the vertical. */
export function calculate(input) {
  const { mode, angleMode, basis } = input;
  if (mode !== 'vertical' && mode !== 'pile') throw new Error('Выберите, какую длину нужно рассчитать.');
  const length = field(input.length, 'Длина');
  if (length <= 0) throw new Error('Длина должна быть больше нуля.');

  let angleDegrees;
  let angle;
  let cosine;
  let sine;
  if (angleMode === 'dms') {
    const degrees = field(input.degrees, 'Градусы');
    const minutes = field(input.minutes, 'Минуты', true);
    const seconds = field(input.seconds, 'Секунды', true);
    if (degrees < 0) throw new Error('Градусы должны быть неотрицательными.');
    if (minutes < 0 || minutes >= 60) throw new Error('Минуты должны быть от 0 до 59,999…');
    if (seconds < 0 || seconds >= 60) throw new Error('Секунды должны быть от 0 до 59,999…');
    angleDegrees = degrees + minutes / 60 + seconds / 3600;
    if (angleDegrees >= 90) throw new Error('Угол от вертикали должен быть меньше 90°.');
    angle = angleDegrees * Math.PI / 180;
    cosine = Math.cos(angle);
    sine = Math.sin(angle);
  } else if (angleMode === 'slope') {
    const slope = field(input.slope, 'Наклон в мм/м');
    if (slope < 0) throw new Error('Наклон в мм/м должен быть неотрицательным.');
    const ratio = slope / 1000;
    if (basis === 'vertical') {
      const hypotenuse = Math.hypot(1, ratio);
      cosine = 1 / hypotenuse;
      sine = ratio / hypotenuse;
      angle = Math.atan(ratio);
    } else if (basis === 'pile') {
      if (slope >= 1000) throw new Error('На метр вдоль сваи наклон должен быть меньше 1000 мм.');
      sine = ratio;
      cosine = Math.sqrt((1 - ratio) * (1 + ratio));
      angle = Math.asin(ratio);
    } else {
      throw new Error('Выберите, откуда отсчитывается метр: по вертикали или вдоль сваи.');
    }
    angleDegrees = angle * 180 / Math.PI;
    if (angleDegrees >= 90) throw new Error('Наклон слишком близок к 90°. Введите меньшее значение.');
  } else {
    throw new Error('Выберите способ ввода наклона.');
  }

  const pileLength = mode === 'vertical' ? length : length / cosine;
  const verticalLength = mode === 'vertical' ? length * cosine : length;
  const offset = pileLength * sine;
  // This identity retains small differences that subtraction could round to zero.
  const difference = pileLength * (2 * Math.sin(angle / 2) ** 2);
  const result = mode === 'vertical' ? verticalLength : pileLength;
  const output = {
    length,
    pileLength,
    verticalLength,
    coefficient: cosine,
    offset,
    difference,
    angleDegrees,
    slopePerVerticalMetre: (sine / cosine) * 1000,
    slopePerPileMetre: sine * 1000,
    result,
  };
  if (Object.values(output).some(value => !Number.isFinite(value))) {
    throw new Error('Результат слишком велик. Уменьшите длину или наклон.');
  }
  return output;
}
