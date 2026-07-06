// Terms & Conditions content — the guest/tenant agreement, in English and Arabic
// (verbatim from the provided legal PDFs). Rendered by /terms. The Arabic text is
// the governing version (see its Article 16); English is provided for convenience.
import Link from 'next/link'

type Article = { n: string; title: string; paras: string[] }
type Section = { title: string; articles: Article[] }

const EN_SECTIONS: Section[] = [
  {
    title: 'General Provisions Governing the Relationship Between the Company and the Guest',
    articles: [
      {
        n: '1',
        title: 'Scope of the Relationship',
        paras: [
          'This Agreement governs the relationship between the Guest and the Company with respect to the use of the Platform, making Bookings, and benefiting from the services provided through it, in accordance with the provisions of this Agreement and the Policies and Annexes associated therewith.',
        ],
      },
      {
        n: '2',
        title: 'Role of the Company',
        paras: [
          '2.1 The Company acts as the operator and developer of an electronic Platform specialized in displaying Properties, facilitating Booking transactions, and managing payments between Hosts and Guests.',
          '2.2 The Company is not the owner, Host, or Guest of any of the Properties displayed through the Platform, nor does it undertake their management, operation, or direct supervision.',
          '2.3 The Company is not a party to any lease, usufruct, accommodation, or any agreement entered into between the Host and the Guest. All rights and obligations arising from such agreement shall arise directly between the Host and the Guest.',
        ],
      },
      {
        n: '3',
        title: "Limitation of the Company's Liability",
        paras: [
          "The Guest acknowledges that the Company's role is limited to operating the electronic Platform and providing the services associated therewith, and that the Company shall bear no liability for the Property, its condition, its suitability, its conformity with its description, the performance by the Host of the Host's obligations, or any dispute arising between the Host and the Guest, unless the law expressly provides otherwise.",
        ],
      },
    ],
  },
  {
    title: 'Guest Obligations',
    articles: [
      {
        n: '4',
        title: 'Obligation to Provide Accurate Information',
        paras: [
          '4.1 The Guest shall provide correct, accurate, and complete data and information when creating an Account, using the Platform, or making any Booking.',
          "4.2 The Guest shall update the Guest's information whenever any material change occurs.",
          '4.3 The Guest alone shall bear full legal responsibility for any incorrect, misleading, or incomplete data or information submitted through the Platform.',
        ],
      },
      {
        n: '5',
        title: 'Obligation to Comply with Booking Terms',
        paras: [
          '5.1 The Guest shall review the Property information, the Booking terms, and the financial consideration before completing the Booking.',
          '5.2 The Guest shall pay all amounts due in accordance with the procedures and Policies applicable on the Platform.',
          '5.3 The Guest shall perform all obligations arising from a confirmed Booking in accordance with the provisions of this Agreement and the associated Policies.',
        ],
      },
      {
        n: '6',
        title: 'Obligation to Use the Platform Lawfully',
        paras: [
          '6.1 The Guest shall use the Platform lawfully and in a manner that does not violate applicable laws, public morals, or the rights of others.',
          '6.2 The Guest shall not use the Platform for any unlawful purpose or submit any data or content that may cause harm to the Company, the Platform, or other users.',
        ],
      },
      {
        n: '7',
        title: 'Obligation to Comply with the Law',
        paras: [
          'The Guest shall use the Platform and the Property in compliance with the applicable laws, regulations, and decisions, and shall refrain from using the Property for any unlawful activity or any activity contrary to public order or public morals. The Guest alone shall bear all legal consequences arising from any violation thereof.',
        ],
      },
      {
        n: '8',
        title: 'Obligation to Comply with the Property Rules',
        paras: [
          'The Guest shall review the rules, instructions, and conditions applicable to the Property, as announced or provided by the Host or through the Platform, before or during the Booking, and shall comply therewith throughout the Booking period, without prejudice to the provisions of the law or this Agreement.',
        ],
      },
      {
        n: '9',
        title: 'Obligation Not to Circumvent the Platform',
        paras: [
          '9.1 The Guest shall not circumvent the Platform or the Booking systems, payment systems, fees, or commissions applied through the Platform, whether directly or indirectly.',
          '9.2 The Guest shall also not use the Platform to identify a Host and thereafter complete, or attempt to complete, a Booking, enter into a contract, or make payment outside the Platform for the purpose of avoiding the applicable fees, commissions, or Policies.',
        ],
      },
      {
        n: '10',
        title: 'Obligation to Notify of Problems or Disputes',
        paras: [
          'The Guest shall notify the Company within a reasonable period of any problem, complaint, or dispute relating to a Booking or the use of the Platform immediately upon becoming aware thereof, in accordance with the procedures applicable on the Platform.',
        ],
      },
    ],
  },
]

const AR_SECTIONS: Section[] = [
  {
    title: 'الأحكام العامة المنظمة للعلاقة بين الشركة والمستأجر',
    articles: [
      {
        n: '١',
        title: 'نطاق العلاقة',
        paras: [
          'تنظم هذه الاتفاقية العلاقة بين المستأجر والشركة فيما يتعلق باستخدام المنصة وإجراء الحجوزات والاستفادة من الخدمات المقدمة من خلالها، وذلك وفقًا لأحكام هذه الاتفاقية والسياسات والملحقات المرتبطة بها.',
        ],
      },
      {
        n: '٢',
        title: 'دور الشركة',
        paras: [
          '١- تعمل الشركة بصفتها مشغلًا ومطورًا لمنصة إلكترونية متخصصة في عرض الوحدات العقارية وتسهيل عمليات الحجز وإدارة المدفوعات بين المؤجرين والمستأجرين.',
          '٢- لا تعد الشركة مالكة أو مؤجرة أو مستأجرة لأي من الوحدات العقارية المعروضة عبر المنصة، كما لا تتولى إدارتها أو تشغيلها أو الإشراف المباشر عليها.',
          '٣- لا تعد الشركة طرفًا في أي عقد إيجار، أو انتفاع، أو إقامة، أو أي اتفاق يتم بين المؤجر والمستأجر، وتنشأ كافة الحقوق والالتزامات الناشئة عن ذلك العقد مباشرة بين المؤجر والمستأجر.',
        ],
      },
      {
        n: '٣',
        title: 'حدود مسؤولية الشركة',
        paras: [
          'يقر المستأجر بأن الشركة يقتصر دورها على تشغيل المنصة الإلكترونية وتقديم الخدمات المرتبطة بها، ولا تتحمل أي مسؤولية عن الوحدة العقارية، أو حالتها، أو صلاحيتها، أو مطابقتها للوصف أو عن تنفيذ التزامات المؤجر أو أي نزاع ينشأ بين المؤجر والمستأجر، وذلك ما لم ينص القانون صراحة على خلاف ذلك.',
        ],
      },
    ],
  },
  {
    title: 'التزامات المستأجر',
    articles: [
      {
        n: '٤',
        title: 'الالتزام بصحة البيانات',
        paras: [
          '٤.١- يلتزم المستأجر بتقديم بيانات ومعلومات صحيحة ودقيقة وكاملة عند إنشاء الحساب أو استخدام المنصة أو إجراء أي حجز.',
          '٤.٢- يلتزم المستأجر بتحديث بياناته متى طرأ عليها أي تغيير جوهري.',
          '٤.٣- يتحمل المستأجر وحده المسؤولية القانونية عن أي بيانات، أو معلومات غير صحيحة، أو مضللة، أو غير مكتملة يقدمها من خلال المنصة.',
        ],
      },
      {
        n: '٥',
        title: 'الالتزام بشروط الحجز',
        paras: [
          '٥.١- يلتزم المستأجر بمراجعة بيانات الوحدة العقارية وشروط الحجز والمقابل المالي قبل إتمام الحجز.',
          '٥.٢- يلتزم المستأجر بسداد المبالغ المستحقة وفقًا للإجراءات والسياسات المعمول بها على المنصة.',
          '٥.٣- يلتزم المستأجر بالوفاء بكافة الالتزامات المترتبة على الحجز المؤكد وفقًا لأحكام هذه الاتفاقية والسياسات المرتبطة بها.',
        ],
      },
      {
        n: '٦',
        title: 'الالتزام بالاستخدام المشروع للمنصة',
        paras: [
          '٦.١- يلتزم المستأجر باستخدام المنصة بصورة مشروعة وبما لا يخالف القوانين أو الآداب العامة أو حقوق الغير.',
          '٦.٢- يحظر على المستأجر استخدام المنصة لأي غرض غير مشروع أو تقديم أي بيانات أو محتوى من شأنه الإضرار بالشركة أو المنصة أو المستخدمين الآخرين.',
        ],
      },
      {
        n: '٧',
        title: 'الالتزام بالقوانين',
        paras: [
          'يلتزم المستأجر باستخدام المنصة والوحدة العقارية بما يتفق مع القوانين واللوائح والقرارات المعمول بها، كما يلتزم بعدم استخدام الوحدة في أي نشاط غير مشروع أو مخالف للنظام العام أو الآداب العامة، ويتحمل وحده كافة الآثار القانونية المترتبة على مخالفته لذلك.',
        ],
      },
      {
        n: '٨',
        title: 'الالتزام بقواعد الوحدة',
        paras: [
          'يلتزم المستأجر بالاطلاع على القواعد والتعليمات والشروط الخاصة بالوحدة العقارية والمعلنة أو المقدمة من قبل المؤجر أو من خلال المنصة قبل أو أثناء الحجز، والامتثال لها طوال مدة الحجز، وذلك دون إخلال بما تقرره القوانين أو هذه الاتفاقية.',
        ],
      },
      {
        n: '٩',
        title: 'الالتزام بعدم التحايل على المنصة',
        paras: [
          '٩.١- يحظر على المستأجر التحايل على المنصة أو على أنظمة الحجز، أو المدفوعات، أو الرسوم، أو العمولات المطبقة من خلالها بأي صورة مباشرة أو غير مباشرة.',
          '٩.٢- كما يحظر على المستأجر استخدام المنصة للتوصل إلى المؤجر ثم إتمام، أو محاولة إتمام الحجز، أو التعاقد، أو السداد خارج المنصة بقصد تفادي الرسوم أو العمولات أو السياسات المعمول بها.',
        ],
      },
      {
        n: '١٠',
        title: 'الالتزام بالإخطار عن المشكلات أو النزاعات',
        paras: [
          'يلتزم المستأجر بإخطار الشركة خلال مدة معقولة بأي مشكلة أو شكوى أو نزاع يتعلق بالحجز أو باستخدام المنصة فور علمه بها، وذلك وفقًا للإجراءات المعمول بها على المنصة.',
        ],
      },
    ],
  },
  {
    title: 'الجزاءات والمسؤولية التعاقدية',
    articles: [
      {
        n: '١١',
        title: 'الجزاءات التعاقدية',
        paras: [
          'يحق للشركة، في حال مخالفة المستأجر لأي حكم أو التزام وارد في هذه الاتفاقية أو السياسات أو الملحقات المرتبطة بها، اتخاذ ما تراه مناسبًا من إجراءات وفقًا لطبيعة المخالفة، بما في ذلك توجيه تنبيه، أو إنذار، أو تعليق الحجز، أو تعليق الحساب، أو تقييد بعض الخدمات، أو إنهاء الحساب، وذلك دون الإخلال بأي حقوق أخرى مقررة للشركة بموجب القانون أو هذه الاتفاقية.',
        ],
      },
      {
        n: '١٢',
        title: 'المسؤولية والتعويض',
        paras: [
          'يلتزم المستأجر بتعويض الشركة عن أي أضرار أو خسائر أو مصروفات مباشرة تترتب على مخالفته لأحكام هذه الاتفاقية أو السياسات أو الملحقات المرتبطة بها، وذلك دون الإخلال بحق الشركة في اتخاذ أي إجراءات أو جزاءات أخرى مقررة بموجب هذه الاتفاقية أو القانون.',
        ],
      },
      {
        n: '١٣',
        title: 'إلغاء الحجز واسترداد المبالغ',
        paras: [
          'تخضع عمليات إلغاء الحجز واسترداد المبالغ لسياسات الإلغاء والاسترداد المعمول بها على المنصة وقت إجراء الحجز. ويقر المستأجر بموافقته على تلك السياسات عند إتمام الحجز.',
          'وللشركة، عند معالجة طلبات الإلغاء أو الاسترداد، خصم، أو الاحتفاظ بالرسوم، أو العمولات، أو المبالغ غير القابلة للاسترداد وفقًا لسياسات المنصة المطبقة على الحجز محل الإلغاء، وذلك دون إخلال بأي حقوق أو التزامات أخرى مقررة بموجب هذه الاتفاقية أو القانون.',
        ],
      },
    ],
  },
  {
    title: 'الأحكام الختامية',
    articles: [
      {
        n: '١٤',
        title: 'الموافقة الإلكترونية',
        paras: [
          'يقر المستأجر بأن إتمام إجراءات التسجيل، أو إنشاء الحساب، أو استخدام المنصة، أو الضغط على خيار "موافق" أو أي وسيلة إلكترونية مماثلة مخصصة لإبداء القبول يعد قبولًا صريحًا وملزمًا لجميع أحكام هذه الاتفاقية والسياسات والملحقات المرتبطة بها، ويترتب عليه كافة الآثار القانونية المقررة قانونًا.',
        ],
      },
      {
        n: '١٥',
        title: 'السجلات الإلكترونية والإثبات',
        paras: [
          'يتفق الطرفان على الاعتداد بالسجلات والبيانات والرسائل والإشعارات الإلكترونية وسجلات العمليات المحفوظة لدى الشركة أو الصادرة من خلال المنصة كوسيلة معتبرة في إثبات استخدام المنصة وكافة العمليات والإجراءات والتصرفات التي تتم من خلال حساب المستأجر، وذلك ما لم يثبت خلاف ذلك بالطرق القانونية المقررة.',
        ],
      },
      {
        n: '١٦',
        title: 'اللغة المعتمدة',
        paras: [
          'تم تحرير هذه الاتفاقية باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض أو اختلاف أو تناقض بين النصين، تكون العبرة بالنص العربي ويعتد به باعتباره النص الحاكم في التفسير والتطبيق.',
        ],
      },
    ],
  },
]

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const T = {
  en: {
    title: 'Terms & Conditions',
    subtitle: 'Guest Agreement — general provisions governing the relationship between the Company and the Guest.',
    updated: 'Last updated: 6 July 2026',
    govNote:
      'This agreement is issued in Arabic and English. In the event of any conflict or discrepancy between the two texts, the Arabic text shall prevail and govern interpretation and application.',
    back: 'Back to Explore',
    toc: 'Contents',
  },
  ar: {
    title: 'الشروط والأحكام',
    subtitle: 'اتفاقية المستأجر — الأحكام العامة المنظمة للعلاقة بين الشركة والمستأجر.',
    updated: 'آخر تحديث: ٦ يوليو ٢٠٢٦',
    govNote:
      'تم تحرير هذه الاتفاقية باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض بين النصين، تكون العبرة بالنص العربي باعتباره النص الحاكم.',
    back: 'العودة إلى الاستكشاف',
    toc: 'المحتويات',
  },
}

export function TermsPage({ locale }: { locale: string }) {
  const isAr = locale === 'ar'
  const sections = isAr ? AR_SECTIONS : EN_SECTIONS
  const s = isAr ? T.ar : T.en
  const dir = isAr ? 'rtl' : 'ltr'
  const align = isAr ? 'right' : 'left'

  return (
    <article
      dir={dir}
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '48px 24px 80px',
        textAlign: align,
        fontFamily: isAr
          ? '"Noto Sans Arabic", "DM Sans", ui-sans-serif, system-ui, sans-serif'
          : '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: C.burgundy,
            background: 'rgba(91,15,22,0.07)',
            borderRadius: 999,
            padding: '6px 13px',
            marginBottom: 14,
          }}
        >
          {s.updated}
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: isAr ? 'inherit' : '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(30px, 5vw, 44px)',
            fontWeight: 800,
            letterSpacing: isAr ? 0 : '-0.02em',
            color: C.burgundy,
            lineHeight: 1.1,
          }}
        >
          {s.title}
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: C.muted, maxWidth: 640, marginInline: isAr ? '0 0' : undefined }}>
          {s.subtitle}
        </p>
      </div>

      {/* Governing-language note */}
      <div
        style={{
          background: C.cream,
          border: `1px solid ${C.tan}`,
          borderRadius: 14,
          padding: '14px 18px',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: C.ink,
          marginBottom: 30,
        }}
      >
        {s.govNote}
      </div>

      {/* Document */}
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          border: '1px solid rgba(42,34,32,0.07)',
          boxShadow: '0 8px 30px rgba(42,34,32,0.07)',
          padding: 'clamp(22px, 4vw, 40px)',
        }}
      >
        {sections.map((section, si) => (
          <section key={si} style={{ marginTop: si === 0 ? 0 : 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 20,
                flexDirection: isAr ? 'row-reverse' : 'row',
              }}
            >
              <span style={{ width: 30, height: 3, background: C.burgundy, borderRadius: 3, flex: '0 0 auto' }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(17px, 2.4vw, 21px)',
                  fontWeight: 800,
                  color: C.burgundy,
                  lineHeight: 1.35,
                }}
              >
                {section.title}
              </h2>
            </div>

            {section.articles.map((art, ai) => (
              <div
                key={art.n}
                style={{
                  padding: '18px 0',
                  borderTop: ai === 0 ? 'none' : '1px solid rgba(42,34,32,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    flexDirection: isAr ? 'row-reverse' : 'row',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 auto',
                      minWidth: 34,
                      height: 34,
                      padding: '0 9px',
                      borderRadius: 10,
                      background: C.burgundy,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {art.n}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: C.ink, lineHeight: 1.4 }}>
                    {art.title}
                  </h3>
                </div>
                {art.paras.map((p, pi) => (
                  <p
                    key={pi}
                    style={{
                      margin: pi === 0 ? '0' : '10px 0 0',
                      fontSize: 15,
                      lineHeight: 1.9,
                      color: '#3a3330',
                      textAlign: isAr ? 'right' : 'justify',
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Back link */}
      <div style={{ marginTop: 36 }}>
        <Link
          href={`/${locale}/explore`}
          style={{
            display: 'inline-block',
            background: C.burgundy,
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            borderRadius: 999,
            padding: '12px 28px',
          }}
        >
          {s.back}
        </Link>
      </div>
    </article>
  )
}
