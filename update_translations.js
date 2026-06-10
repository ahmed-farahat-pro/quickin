const fs = require('fs');
const enPath = 'src/messages/en.json';
const arPath = 'src/messages/ar.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

en.dashboardListingCreate = {
  title: 'Create Listing',
  steps: {
    type: 'Type',
    vibe: 'Vibe',
    basics: 'Basics',
    location: 'Location',
    photos: 'Photos',
    details: 'Details',
    pricing: 'Pricing',
    review: 'Review'
  },
  errors: {
    propertyType: 'Please select a property type',
    tagsMin: 'Please select at least 1 tag',
    tagsMax: 'You can select up to 2 tags',
    titleMin: 'Title must be at least 5 characters',
    titleMax: 'Title must be less than 100 characters',
    descMin: 'Description must be at least 20 characters',
    addressReq: 'Address is required',
    countryReq: 'Country is required',
    cityReq: 'City is required',
    latInvalid: 'Invalid Latitude',
    lngInvalid: 'Invalid Longitude',
    photosMin: 'Please add at least 1 photo',
    loginReq: 'You must be logged in',
    uploadFailed: 'Image Upload Failed',
    creationFailed: 'Listing Creation Failed'
  },
  actions: {
    back: 'Back',
    next: 'Next',
    publish: 'Publish',
    login: 'Log In',
    retry: 'Retry',
    viewListing: 'View Listing',
    stepXofY: 'Step {step} of {total}'
  },
  stepType: {
    question: 'First, what kind of place are you listing?',
    homeTitle: 'Home',
    homeDesc: 'A space like a house, apartment, or room.',
    serviceTitle: 'Service',
    serviceDesc: 'An experience, yacht, or event space.',
    describeQuestion: 'Which of these best describes your {type}?'
  },
  stepVibe: {
    title: 'Describe the vibe',
    subtitle: 'Select up to 2 tags that best fit your listing.',
    selected: 'Selected {count}/2',
    maxReached: 'Maximum 2 tags selected'
  },
  stepBasics: {
    title: "Let's give your place a name and description",
    titleEn: 'Title (English)',
    titleEnPlaceholder: 'e.g. Cozy Cabin with Mountain View',
    titleAr: 'Title (Arabic / بالعربية)',
    titleArPlaceholder: 'مثال: كابينة مريحة مع إطلالة على الجبل',
    descEn: 'Description (English)',
    descEnPlaceholder: 'Describe your place...',
    descAr: 'Description (Arabic / بالعربية)',
    descArPlaceholder: 'صف مكانك...',
    conditionsTitle: 'Listing Conditions / House Rules',
    conditionsPlaceholder: 'Select conditions or type to create...',
    conditionsEmpty: 'No conditions found.',
    conditionsHelp: 'Add specific rules like "No Smoking", "No Parties", etc.'
  },
  stepLocation: {
    title: 'Where is your place located?',
    pasteGoogle: 'Paste Google Maps Link',
    pastePlaceholder: 'Paste link to auto-fill',
    lat: 'Lat',
    lng: 'Lng',
    address: 'Address',
    extracted: 'Coordinates extracted!'
  },
  stepPhotos: {
    title: 'Add some photos'
  },
  stepDetails: {
    title: 'Share some basics about your {type}',
    guests: 'Guests',
    bedrooms: 'Bedrooms',
    beds: 'Beds',
    bathrooms: 'Bathrooms',
    minDuration: 'Min Duration'
  },
  stepPricing: {
    title: 'Set your price',
    currency: 'Currency',
    currencyPlaceholder: 'Select currency',
    pricePerNight: 'Price per night',
    cleaningFee: 'Cleaning Fee'
  },
  stepReview: {
    title: 'Review and Publish',
    listingTitle: 'Title:',
    location: 'Location:',
    price: 'Price:',
    conditions: 'Conditions:',
    success: 'Listing created successfully!'
  }
};

ar.dashboardListingCreate = {
  title: 'إنشاء إعلان',
  steps: {
    type: 'النوع',
    vibe: 'الأجواء',
    basics: 'الأساسيات',
    location: 'الموقع',
    photos: 'الصور',
    details: 'التفاصيل',
    pricing: 'التسعير',
    review: 'مراجعة'
  },
  errors: {
    propertyType: 'يرجى اختيار نوع العقار',
    tagsMin: 'يرجى اختيار إشارة واحدة على الأقل',
    tagsMax: 'يمكنك اختيار إشارتين كحد أقصى',
    titleMin: 'يجب أن يكون العنوان 5 أحرف على الأقل',
    titleMax: 'يجب أن يكون العنوان أقل من 100 حرف',
    descMin: 'يجب أن يكون الوصف 20 حرفاً على الأقل',
    addressReq: 'العنوان مطلوب',
    countryReq: 'البلد مطلوب',
    cityReq: 'المدينة مطلوبة',
    latInvalid: 'خط عرض غير صالح',
    lngInvalid: 'خط طول غير صالح',
    photosMin: 'يرجى إضافة صورة واحدة على الأقل',
    loginReq: 'يجب تسجيل الدخول',
    uploadFailed: 'فشل تحميل الصورة',
    creationFailed: 'فشل إنشاء الإعلان'
  },
  actions: {
    back: 'السابق',
    next: 'التالي',
    publish: 'نشر',
    login: 'تسجيل الدخول',
    retry: 'إعادة المحاولة',
    viewListing: 'عرض الإعلان',
    stepXofY: 'الخطوة {step} من {total}'
  },
  stepType: {
    question: 'أولاً، ما هو نوع المكان الذي تعرضه؟',
    homeTitle: 'منزل',
    homeDesc: 'مساحة مثل منزل، شقة، أو غرفة.',
    serviceTitle: 'خدمة',
    serviceDesc: 'تجربة، يخت، أو مساحة للفعاليات.',
    describeQuestion: 'أي من هذه الخيارات يصف الـ {type} الخاص بك بشكل أفضل؟'
  },
  stepVibe: {
    title: 'صف الأجواء',
    subtitle: 'اختر حتى إشارتين تناسب إعلانك بشكل أفضل.',
    selected: 'تم اختيار {count}/2',
    maxReached: 'تم اختيار إشارتين كحد أقصى'
  },
  stepBasics: {
    title: 'دعنا نعطي مكانك اسماً ووصفاً',
    titleEn: 'العنوان (باللغة الإنجليزية)',
    titleEnPlaceholder: 'مثال: كابينة مريحة مع إطلالة على الجبل',
    titleAr: 'العنوان (بالعربية)',
    titleArPlaceholder: 'مثال: كابينة مريحة مع إطلالة على الجبل',
    descEn: 'الوصف (باللغة الإنجليزية)',
    descEnPlaceholder: 'صف مكانك...',
    descAr: 'الوصف (بالعربية)',
    descArPlaceholder: 'صف مكانك...',
    conditionsTitle: 'شروط الإعلان / القواعد',
    conditionsPlaceholder: 'اختر شروطاً أو اكتب لإنشاء...',
    conditionsEmpty: 'لم يتم العثور على شروط.',
    conditionsHelp: 'أضف قواعد محددة مثل "ممنوع التدخين"، "ممنوع إقامة حفلات"، إلخ.'
  },
  stepLocation: {
    title: 'أين يقع مكانك؟',
    pasteGoogle: 'لصق رابط خرائط جوجل',
    pastePlaceholder: 'لصق الرابط لملء البيانات تلقائياً',
    lat: 'خط العرض',
    lng: 'خط الطول',
    address: 'العنوان',
    extracted: 'تم استخراج الإحداثيات!'
  },
  stepPhotos: {
    title: 'أضف بعض الصور'
  },
  stepDetails: {
    title: 'شارك بعض الأساسيات حول الـ {type} الخاص بك',
    guests: 'الضيوف',
    bedrooms: 'غرف النوم',
    beds: 'الأسرة',
    bathrooms: 'الحمامات',
    minDuration: 'الحد الأدنى للمدة'
  },
  stepPricing: {
    title: 'حدد سعرك',
    currency: 'العملة',
    currencyPlaceholder: 'اختر العملة',
    pricePerNight: 'السعر في الليلة',
    cleaningFee: 'رسوم التنظيف'
  },
  stepReview: {
    title: 'مراجعة ونشر',
    listingTitle: 'العنوان:',
    location: 'الموقع:',
    price: 'السعر:',
    conditions: 'الشروط:',
    success: 'تم إنشاء الإعلان بنجاح!'
  }
};

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));
console.log("Done");
