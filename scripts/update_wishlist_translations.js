const fs = require('fs');

const enPath = 'src/messages/en.json';
const arPath = 'src/messages/ar.json';

let en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
let ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

if (!en.dashboardWishlists) en.dashboardWishlists = {};
en.dashboardWishlists.detailEmptyTitle = 'This wishlist is empty';
en.dashboardWishlists.detailEmptyButton = 'Discover places to stay';

if (!ar.dashboardWishlists) ar.dashboardWishlists = {};
ar.dashboardWishlists.detailEmptyTitle = 'قائمة الأمنيات هذه فارغة';
ar.dashboardWishlists.detailEmptyButton = 'استكشف أماكن للإقامة';

en.wishlistModal = {
  title: 'Save to wishlist',
  description: 'Choose a wishlist to save "{listingTitle}"',
  saved: 'Saved',
  notSaved: 'Not saved',
  emptyTitle: "You don't have any wishlists yet.",
  emptyDesc: 'Create one below to save this listing.',
  nameLabel: 'Name your wishlist',
  namePlaceholder: 'e.g. Dream Vacations',
  cancel: 'Cancel',
  createAndSave: 'Create and save',
  createNew: 'Create new wishlist',
  toastRemoved: 'Removed from wishlist',
  toastSaved: 'Saved to wishlist',
  toastCreated: 'Wishlist created'
};

ar.wishlistModal = {
  title: 'حفظ في قائمة الأمنيات',
  description: 'اختر قائمة أمنيات لحفظ "{listingTitle}"',
  saved: 'تم الحفظ',
  notSaved: 'غير محفوظ',
  emptyTitle: 'ليس لديك أي قوائم أمنيات بعد.',
  emptyDesc: 'قم بإنشاء واحدة أدناه لحفظ هذا الإعلان.',
  nameLabel: 'اسم قائمة الأمنيات',
  namePlaceholder: 'مثال: عطلات الأحلام',
  cancel: 'إلغاء',
  createAndSave: 'إنشاء وحفظ',
  createNew: 'إنشاء قائمة أمنيات جديدة',
  toastRemoved: 'تمت الإزالة من قائمة الأمنيات',
  toastSaved: 'تم الحفظ في قائمة الأمنيات',
  toastCreated: 'تم إنشاء قائمة الأمنيات'
};

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));
console.log('Translations updated successfully.');
