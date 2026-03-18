export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  slotDurationMin: number
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  let currentMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  while (currentMinutes + slotDurationMin <= closeMinutes) {
    const startH = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
    const startM = String(currentMinutes % 60).padStart(2, '0');
    const endMinutes = currentMinutes + slotDurationMin;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');

    slots.push({ start: `${startH}:${startM}`, end: `${endH}:${endM}` });
    currentMinutes += slotDurationMin;
  }

  return slots;
}