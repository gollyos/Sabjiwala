/**
 * Helper to calculate dynamic delivery day based on 7:50 PM cutoff rule (IST - Asia/Kolkata)
 * - Before 7:50 PM: Delivery Tomorrow (આવતીકાલે)
 * - After 7:50 PM: Delivery Day After Tomorrow (પરમદિવસે)
 */
export function getDeliveryScheduleInfo() {
  const now = new Date();
  
  // Explicitly calculate hour and minute in Indian Standard Time (Asia/Kolkata)
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const formatted = istFormatter.format(now);
  const [hourStr, minuteStr] = formatted.split(':');
  const currentHour = parseInt(hourStr, 10);
  const currentMinute = parseInt(minuteStr, 10);

  // 7:50 PM is 19:50 (19 * 60 + 50 = 1190 minutes)
  const currentTotalMinutes = (currentHour * 60) + currentMinute;
  const cutoffMinutes = (19 * 60) + 50; // 7:50 PM
  const isAfter750PM = currentTotalMinutes >= cutoffMinutes;

  // Calculate target delivery date
  const targetDate = new Date(now.getTime());
  // Add 1 day if before 7:50 PM, add 2 days if after 7:50 PM
  targetDate.setDate(targetDate.getDate() + (isAfter750PM ? 2 : 1));

  const dayNameEn = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(targetDate);

  const dateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(targetDate);

  if (isAfter750PM) {
    return {
      isAfterCutoff: true,
      cutoffTimeStr: '7:50 PM',
      labelShortEn: 'Day After Tomorrow',
      labelShortGu: 'પરમદિવસે',
      badgeTextMobile: '⚡ ડિલિવરી: પરમદિવસે',
      badgeTextDesktop: '⚡ ડિલિવરી: પરમદિવસે (Day After Tomorrow)',
      productCardTag: 'ડિલિવરી: પરમદિવસે',
      deliveryDateStr: `${dateFormatted} (${dayNameEn})`,
      bannerNotice: '🌙 Orders placed after 7:50 PM are scheduled for day after tomorrow.',
    };
  }

  return {
    isAfterCutoff: false,
    cutoffTimeStr: '7:50 PM',
    labelShortEn: 'Tomorrow',
    labelShortGu: 'આવતીકાલે',
    badgeTextMobile: '⚡ ડિલિવરી: આવતીકાલે',
    badgeTextDesktop: '⚡ ડિલિવરી: આવતીકાલે (Tomorrow)',
    productCardTag: 'ડિલિવરી: આવતીકાલે',
    deliveryDateStr: `${dateFormatted} (${dayNameEn})`,
    bannerNotice: '⚡ Orders placed before 7:50 PM delivered tomorrow morning.',
  };
}
