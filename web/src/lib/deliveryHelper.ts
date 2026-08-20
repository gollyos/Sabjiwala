/**
 * Helper to calculate dynamic delivery day based on 10:00 PM cutoff rule (IST)
 * - Before 10:00 PM: Delivery Tomorrow (આવતીકાલે)
 * - After 10:00 PM: Delivery Day After Tomorrow (પરમદિવસે)
 */
export function getDeliveryScheduleInfo() {
  const now = new Date();
  
  // Calculate current hour in Indian Standard Time (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
  const currentHour = istTime.getHours();

  // 10:00 PM is 22:00
  const isAfter10PM = currentHour >= 22;

  // Calculate target delivery date
  const deliveryDate = new Date(istTime);
  deliveryDate.setDate(deliveryDate.getDate() + (isAfter10PM ? 2 : 1));

  const dayNameEn = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short' });
  const dateFormatted = deliveryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

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
