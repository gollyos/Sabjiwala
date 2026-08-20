/**
 * Helper to calculate dynamic delivery day based on 10:00 PM cutoff rule (IST - Asia/Kolkata)
 * - Before 10:00 PM: Delivery Tomorrow (આવતીકાલે)
 * - After 10:00 PM: Delivery Day After Tomorrow (પરમદિવસે)
 */
export function getDeliveryScheduleInfo() {
  const now = new Date();
  
  // Explicitly calculate hour in Indian Standard Time (Asia/Kolkata)
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  });
  
  const currentHour = parseInt(istFormatter.format(now), 10);

  // 10:00 PM is 22:00
  const isAfter10PM = currentHour >= 22;

  // Calculate target delivery date
  const targetDate = new Date(now.getTime());
  // Add 1 day if before 10 PM, add 2 days if after 10 PM
  targetDate.setDate(targetDate.getDate() + (isAfter10PM ? 2 : 1));

  const dayNameEn = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(targetDate);

  const dateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(targetDate);

  if (isAfter10PM) {
    return {
      isAfter10PM: true,
      labelShortEn: 'Day After Tomorrow',
      labelShortGu: 'પરમદિવસે',
      badgeTextMobile: '⚡ ડિલિવરી: પરમદિવસે',
      badgeTextDesktop: '⚡ ડિલિવરી: પરમદિવસે (Day After Tomorrow)',
      productCardTag: 'ડિલિવરી: પરમદિવસે',
      deliveryDateStr: `${dateFormatted} (${dayNameEn})`,
      bannerNotice: '🌙 Orders placed after 10 PM are scheduled for day after tomorrow.',
    };
  }

  return {
    isAfter10PM: false,
    labelShortEn: 'Tomorrow',
    labelShortGu: 'આવતીકાલે',
    badgeTextMobile: '⚡ ડિલિવરી: આવતીકાલે',
    badgeTextDesktop: '⚡ ડિલિવરી: આવતીકાલે (Tomorrow)',
    productCardTag: 'ડિલિવરી: આવતીકાલે',
    deliveryDateStr: `${dateFormatted} (${dayNameEn})`,
    bannerNotice: '⚡ Orders placed before 10 PM delivered tomorrow morning.',
  };
}
