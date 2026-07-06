// Terms & Conditions source content — verbatim from the provided legal PDFs.
// Two audiences (Guest / Host) × two languages (English / Arabic governing).
// Backtick strings so apostrophes/quotes in the legal text need no escaping.

export type Article = { n: string; title: string; paras: string[] }
export type Section = { title: string; articles: Article[] }
export type Audience = 'guest' | 'host'

// ─────────────────────────── GUEST — English (10 articles) ───────────────────
export const GUEST_EN: Section[] = [
  {
    title: `General Provisions Governing the Relationship Between the Company and the Guest`,
    articles: [
      { n: `1`, title: `Scope of the Relationship`, paras: [
        `This Agreement governs the relationship between the Guest and the Company with respect to the use of the Platform, making Bookings, and benefiting from the services provided through it, in accordance with the provisions of this Agreement and the Policies and Annexes associated therewith.`,
      ] },
      { n: `2`, title: `Role of the Company`, paras: [
        `2.1 The Company acts as the operator and developer of an electronic Platform specialized in displaying Properties, facilitating Booking transactions, and managing payments between Hosts and Guests.`,
        `2.2 The Company is not the owner, Host, or Guest of any of the Properties displayed through the Platform, nor does it undertake their management, operation, or direct supervision.`,
        `2.3 The Company is not a party to any lease, usufruct, accommodation, or any agreement entered into between the Host and the Guest. All rights and obligations arising from such agreement shall arise directly between the Host and the Guest.`,
      ] },
      { n: `3`, title: `Limitation of the Company's Liability`, paras: [
        `The Guest acknowledges that the Company's role is limited to operating the electronic Platform and providing the services associated therewith, and that the Company shall bear no liability for the Property, its condition, its suitability, its conformity with its description, the performance by the Host of the Host's obligations, or any dispute arising between the Host and the Guest, unless the law expressly provides otherwise.`,
      ] },
    ],
  },
  {
    title: `Guest Obligations`,
    articles: [
      { n: `4`, title: `Obligation to Provide Accurate Information`, paras: [
        `4.1 The Guest shall provide correct, accurate, and complete data and information when creating an Account, using the Platform, or making any Booking.`,
        `4.2 The Guest shall update the Guest's information whenever any material change occurs.`,
        `4.3 The Guest alone shall bear full legal responsibility for any incorrect, misleading, or incomplete data or information submitted through the Platform.`,
      ] },
      { n: `5`, title: `Obligation to Comply with Booking Terms`, paras: [
        `5.1 The Guest shall review the Property information, the Booking terms, and the financial consideration before completing the Booking.`,
        `5.2 The Guest shall pay all amounts due in accordance with the procedures and Policies applicable on the Platform.`,
        `5.3 The Guest shall perform all obligations arising from a confirmed Booking in accordance with the provisions of this Agreement and the associated Policies.`,
      ] },
      { n: `6`, title: `Obligation to Use the Platform Lawfully`, paras: [
        `6.1 The Guest shall use the Platform lawfully and in a manner that does not violate applicable laws, public morals, or the rights of others.`,
        `6.2 The Guest shall not use the Platform for any unlawful purpose or submit any data or content that may cause harm to the Company, the Platform, or other users.`,
      ] },
      { n: `7`, title: `Obligation to Comply with the Law`, paras: [
        `The Guest shall use the Platform and the Property in compliance with the applicable laws, regulations, and decisions, and shall refrain from using the Property for any unlawful activity or any activity contrary to public order or public morals. The Guest alone shall bear all legal consequences arising from any violation thereof.`,
      ] },
      { n: `8`, title: `Obligation to Comply with the Property Rules`, paras: [
        `The Guest shall review the rules, instructions, and conditions applicable to the Property, as announced or provided by the Host or through the Platform, before or during the Booking, and shall comply therewith throughout the Booking period, without prejudice to the provisions of the law or this Agreement.`,
      ] },
      { n: `9`, title: `Obligation Not to Circumvent the Platform`, paras: [
        `9.1 The Guest shall not circumvent the Platform or the Booking systems, payment systems, fees, or commissions applied through the Platform, whether directly or indirectly.`,
        `9.2 The Guest shall also not use the Platform to identify a Host and thereafter complete, or attempt to complete, a Booking, enter into a contract, or make payment outside the Platform for the purpose of avoiding the applicable fees, commissions, or Policies.`,
      ] },
      { n: `10`, title: `Obligation to Notify of Problems or Disputes`, paras: [
        `The Guest shall notify the Company within a reasonable period of any problem, complaint, or dispute relating to a Booking or the use of the Platform immediately upon becoming aware thereof, in accordance with the procedures applicable on the Platform.`,
      ] },
    ],
  },
]

// ─────────────────────────── GUEST — Arabic (16 articles) ────────────────────
export const GUEST_AR: Section[] = [
  {
    title: `الأحكام العامة المنظمة للعلاقة بين الشركة والمستأجر`,
    articles: [
      { n: `١`, title: `نطاق العلاقة`, paras: [
        `تنظم هذه الاتفاقية العلاقة بين المستأجر والشركة فيما يتعلق باستخدام المنصة وإجراء الحجوزات والاستفادة من الخدمات المقدمة من خلالها، وذلك وفقًا لأحكام هذه الاتفاقية والسياسات والملحقات المرتبطة بها.`,
      ] },
      { n: `٢`, title: `دور الشركة`, paras: [
        `١- تعمل الشركة بصفتها مشغلًا ومطورًا لمنصة إلكترونية متخصصة في عرض الوحدات العقارية وتسهيل عمليات الحجز وإدارة المدفوعات بين المؤجرين والمستأجرين.`,
        `٢- لا تعد الشركة مالكة أو مؤجرة أو مستأجرة لأي من الوحدات العقارية المعروضة عبر المنصة، كما لا تتولى إدارتها أو تشغيلها أو الإشراف المباشر عليها.`,
        `٣- لا تعد الشركة طرفًا في أي عقد إيجار، أو انتفاع، أو إقامة، أو أي اتفاق يتم بين المؤجر والمستأجر، وتنشأ كافة الحقوق والالتزامات الناشئة عن ذلك العقد مباشرة بين المؤجر والمستأجر.`,
      ] },
      { n: `٣`, title: `حدود مسؤولية الشركة`, paras: [
        `يقر المستأجر بأن الشركة يقتصر دورها على تشغيل المنصة الإلكترونية وتقديم الخدمات المرتبطة بها، ولا تتحمل أي مسؤولية عن الوحدة العقارية، أو حالتها، أو صلاحيتها، أو مطابقتها للوصف أو عن تنفيذ التزامات المؤجر أو أي نزاع ينشأ بين المؤجر والمستأجر، وذلك ما لم ينص القانون صراحة على خلاف ذلك.`,
      ] },
    ],
  },
  {
    title: `التزامات المستأجر`,
    articles: [
      { n: `٤`, title: `الالتزام بصحة البيانات`, paras: [
        `٤.١- يلتزم المستأجر بتقديم بيانات ومعلومات صحيحة ودقيقة وكاملة عند إنشاء الحساب أو استخدام المنصة أو إجراء أي حجز.`,
        `٤.٢- يلتزم المستأجر بتحديث بياناته متى طرأ عليها أي تغيير جوهري.`,
        `٤.٣- يتحمل المستأجر وحده المسؤولية القانونية عن أي بيانات، أو معلومات غير صحيحة، أو مضللة، أو غير مكتملة يقدمها من خلال المنصة.`,
      ] },
      { n: `٥`, title: `الالتزام بشروط الحجز`, paras: [
        `٥.١- يلتزم المستأجر بمراجعة بيانات الوحدة العقارية وشروط الحجز والمقابل المالي قبل إتمام الحجز.`,
        `٥.٢- يلتزم المستأجر بسداد المبالغ المستحقة وفقًا للإجراءات والسياسات المعمول بها على المنصة.`,
        `٥.٣- يلتزم المستأجر بالوفاء بكافة الالتزامات المترتبة على الحجز المؤكد وفقًا لأحكام هذه الاتفاقية والسياسات المرتبطة بها.`,
      ] },
      { n: `٦`, title: `الالتزام بالاستخدام المشروع للمنصة`, paras: [
        `٦.١- يلتزم المستأجر باستخدام المنصة بصورة مشروعة وبما لا يخالف القوانين أو الآداب العامة أو حقوق الغير.`,
        `٦.٢- يحظر على المستأجر استخدام المنصة لأي غرض غير مشروع أو تقديم أي بيانات أو محتوى من شأنه الإضرار بالشركة أو المنصة أو المستخدمين الآخرين.`,
      ] },
      { n: `٧`, title: `الالتزام بالقوانين`, paras: [
        `يلتزم المستأجر باستخدام المنصة والوحدة العقارية بما يتفق مع القوانين واللوائح والقرارات المعمول بها، كما يلتزم بعدم استخدام الوحدة في أي نشاط غير مشروع أو مخالف للنظام العام أو الآداب العامة، ويتحمل وحده كافة الآثار القانونية المترتبة على مخالفته لذلك.`,
      ] },
      { n: `٨`, title: `الالتزام بقواعد الوحدة`, paras: [
        `يلتزم المستأجر بالاطلاع على القواعد والتعليمات والشروط الخاصة بالوحدة العقارية والمعلنة أو المقدمة من قبل المؤجر أو من خلال المنصة قبل أو أثناء الحجز، والامتثال لها طوال مدة الحجز، وذلك دون إخلال بما تقرره القوانين أو هذه الاتفاقية.`,
      ] },
      { n: `٩`, title: `الالتزام بعدم التحايل على المنصة`, paras: [
        `٩.١- يحظر على المستأجر التحايل على المنصة أو على أنظمة الحجز، أو المدفوعات، أو الرسوم، أو العمولات المطبقة من خلالها بأي صورة مباشرة أو غير مباشرة.`,
        `٩.٢- كما يحظر على المستأجر استخدام المنصة للتوصل إلى المؤجر ثم إتمام، أو محاولة إتمام الحجز، أو التعاقد، أو السداد خارج المنصة بقصد تفادي الرسوم أو العمولات أو السياسات المعمول بها.`,
      ] },
      { n: `١٠`, title: `الالتزام بالإخطار عن المشكلات أو النزاعات`, paras: [
        `يلتزم المستأجر بإخطار الشركة خلال مدة معقولة بأي مشكلة أو شكوى أو نزاع يتعلق بالحجز أو باستخدام المنصة فور علمه بها، وذلك وفقًا للإجراءات المعمول بها على المنصة.`,
      ] },
    ],
  },
  {
    title: `الجزاءات والمسؤولية التعاقدية`,
    articles: [
      { n: `١١`, title: `الجزاءات التعاقدية`, paras: [
        `يحق للشركة، في حال مخالفة المستأجر لأي حكم أو التزام وارد في هذه الاتفاقية أو السياسات أو الملحقات المرتبطة بها، اتخاذ ما تراه مناسبًا من إجراءات وفقًا لطبيعة المخالفة، بما في ذلك توجيه تنبيه، أو إنذار، أو تعليق الحجز، أو تعليق الحساب، أو تقييد بعض الخدمات، أو إنهاء الحساب، وذلك دون الإخلال بأي حقوق أخرى مقررة للشركة بموجب القانون أو هذه الاتفاقية.`,
      ] },
      { n: `١٢`, title: `المسؤولية والتعويض`, paras: [
        `يلتزم المستأجر بتعويض الشركة عن أي أضرار أو خسائر أو مصروفات مباشرة تترتب على مخالفته لأحكام هذه الاتفاقية أو السياسات أو الملحقات المرتبطة بها، وذلك دون الإخلال بحق الشركة في اتخاذ أي إجراءات أو جزاءات أخرى مقررة بموجب هذه الاتفاقية أو القانون.`,
      ] },
      { n: `١٣`, title: `إلغاء الحجز واسترداد المبالغ`, paras: [
        `تخضع عمليات إلغاء الحجز واسترداد المبالغ لسياسات الإلغاء والاسترداد المعمول بها على المنصة وقت إجراء الحجز. ويقر المستأجر بموافقته على تلك السياسات عند إتمام الحجز.`,
        `وللشركة، عند معالجة طلبات الإلغاء أو الاسترداد، خصم، أو الاحتفاظ بالرسوم، أو العمولات، أو المبالغ غير القابلة للاسترداد وفقًا لسياسات المنصة المطبقة على الحجز محل الإلغاء، وذلك دون إخلال بأي حقوق أو التزامات أخرى مقررة بموجب هذه الاتفاقية أو القانون.`,
      ] },
    ],
  },
  {
    title: `الأحكام الختامية`,
    articles: [
      { n: `١٤`, title: `الموافقة الإلكترونية`, paras: [
        `يقر المستأجر بأن إتمام إجراءات التسجيل، أو إنشاء الحساب، أو استخدام المنصة، أو الضغط على خيار "موافق" أو أي وسيلة إلكترونية مماثلة مخصصة لإبداء القبول يعد قبولًا صريحًا وملزمًا لجميع أحكام هذه الاتفاقية والسياسات والملحقات المرتبطة بها، ويترتب عليه كافة الآثار القانونية المقررة قانونًا.`,
      ] },
      { n: `١٥`, title: `السجلات الإلكترونية والإثبات`, paras: [
        `يتفق الطرفان على الاعتداد بالسجلات والبيانات والرسائل والإشعارات الإلكترونية وسجلات العمليات المحفوظة لدى الشركة أو الصادرة من خلال المنصة كوسيلة معتبرة في إثبات استخدام المنصة وكافة العمليات والإجراءات والتصرفات التي تتم من خلال حساب المستأجر، وذلك ما لم يثبت خلاف ذلك بالطرق القانونية المقررة.`,
      ] },
      { n: `١٦`, title: `اللغة المعتمدة`, paras: [
        `تم تحرير هذه الاتفاقية باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض أو اختلاف أو تناقض بين النصين، تكون العبرة بالنص العربي ويعتد به باعتباره النص الحاكم في التفسير والتطبيق.`,
      ] },
    ],
  },
]

// ─────────────────────────── HOST — English (27 articles) ────────────────────
export const HOST_EN: Section[] = [
  {
    title: `General Provisions Governing the Relationship Between the Company and the Host`,
    articles: [
      { n: `1`, title: `Scope of the Relationship`, paras: [
        `The Host acknowledges and agrees that this Agreement governs the legal relationship between the Host and the Company with respect to the use of the electronic Platform, the listing of Properties, the management of Booking requests, payments, and related services, in accordance with the terms and conditions set forth in this Agreement or in any Annex attached to this Agreement.`,
      ] },
      { n: `2`, title: `Role of the Company`, paras: [
        `2.1- The Company acts as the operator and developer of an electronic Platform specialized in displaying Properties, facilitating Booking transactions, and managing payments between Hosts and Guests.`,
        `2.2- The Company is not the owner, lessor or lessee of any Property displayed through the Platform, nor does it manage, operate, or directly supervise any such Property.`,
        `2.3- The Company is not a party to any lease, usufruct, accommodation, or any other agreement entered into between the Host and the Guest. All rights and obligations arising from such agreement shall arise directly between the Host and the Guest.`,
      ] },
      { n: `3`, title: `Independence of the Legal Relationship Between the Parties`, paras: [
        `3.1- The Host shall remain legally, financially, and administratively independent from the Company and shall bear sole responsibility for the Property listed by the Host and for all related data, information, and services.`,
        `3.2- This Agreement shall not create any form of partnership, joint venture, employment relationship, franchise relationship, administrative dependency, or financial dependency between the Company and the Host. Each party shall retain its independent legal personality and separate responsibility from the other party.`,
        `3.3- This Agreement does not grant either party the status of agent, representative, or authorized delegate of the other party. Neither party may enter into contracts, create obligations, provide undertakings, or make representations on behalf of the other party except to the extent expressly provided in this Agreement.`,
        `3.4- The Host shall not present, advertise, or act in any manner suggesting that the Host is a representative, agent, or authorized delegate of the Company, or authorized to contract or undertake obligations on its behalf before third parties.`,
      ] },
      { n: `4`, title: `Nature of the Platform Services`, paras: [
        `The Host acknowledges that the Company's services are limited to operating the electronic Platform and providing related technical and administrative services, including:`,
        `(a) Displaying Properties on the Platform;`,
        `(b) Receiving and managing Booking requests;`,
        `(c) Processing payments collected through the Platform;`,
        `(d) Holding collected amounts and transferring financial entitlements in accordance with the Platform Policies;`,
        `(e) Providing communication channels and technical support.`,
      ] },
      { n: `5`, title: `Host Responsibility for the Property and Data`, paras: [
        `5.1- The Host acknowledges that the Company does not own the Properties displayed on the Platform and does not manage, operate, or directly supervise them. The Company's role is limited to operating the electronic Platform and providing related services in accordance with this Agreement.`,
        `5.2- The Host shall bear sole responsibility for all obligations and liabilities relating to the Property listed by the Host, including its condition, suitability for use, quality of services provided through it, and its conformity with the description, images, and information published on the Platform.`,
        `5.3- The Host shall also bear sole responsibility for all legal, regulatory, technical, tax, and contractual obligations relating to the Property or its use or rental, without any liability on the Company, unless otherwise expressly required by law.`,
        `5.4- The Company shall not bear any liability arising from the inaccuracy, incorrectness, incompleteness, or insufficiency of any data, information, documents, or descriptions provided by the Host or published through the Host's Account on the Platform.`,
      ] },
      { n: `6`, title: `Company Right to Manage and Develop the Platform`, paras: [
        `6.1- The Company reserves the right to organize, manage, operate, and develop the Platform and to adopt any policies and operational procedures it deems appropriate to ensure operational integrity, protect users, and achieve its legitimate interests, in accordance with this Agreement and applicable laws.`,
        `6.2- The Company may, at any time, amend, develop, or update the Platform's operational mechanisms and procedures, Booking systems, payment systems, Property display methods, data verification processes, or any other services or operational Policies whenever business interests so require.`,
        `The Company shall not affect rights or obligations arising from confirmed Bookings made prior to the effective date of such amendments unless the amendment is required to comply with applicable law, a decision issued by a competent authority, or to address a material technical or security issue.`,
      ] },
      { n: `7`, title: `Company Right of Verification`, paras: [
        `7.1- The Company may, at any time, request any documents, data, or information it deems necessary to verify the Host's identity, the accuracy of Property-related information, and the Host's right to list or rent the Property. The Company may also request periodic updates of such documents whenever necessary.`,
        `7.2- The Host shall fully cooperate with the Company and provide the requested documents within the specified period. Failure or delay in providing such documents shall entitle the Company to suspend, restrict, or remove the Property or the Account without incurring any liability.`,
        `7.3- The Company may use governmental or private entities, systems, databases, or any technological means it deems appropriate to verify the accuracy of the data and documents provided by the Host.`,
      ] },
      { n: `8`, title: `Company Right to Accept, Reject, Suspend, or Remove Properties`, paras: [
        `The Company reserves its discretionary right, as it deems necessary to protect its legitimate interests, to accept, reject, suspend, or remove any Property, as well as any related content or information, whenever it determines that such action is necessary to protect the Platform, users, its interests, or to comply with applicable laws or internal Policies.`,
        `The exercise of this right shall not create any obligation on the Company to compensate the Host or disclose the reasons for its decision unless otherwise required by law.`,
      ] },
      { n: `9`, title: `Limitation of Company Liability Regarding Financial Consideration`, paras: [
        `The Host acknowledges that the Company's role is limited to providing and operating the electronic Platform and that the Company does not guarantee any minimum number of Bookings. The Company also does not guarantee the collection or payment of any amounts agreed between the Host and the Guest except to the extent of amounts actually collected through the Platform. The Company shall not bear any liability for decreased demand, reduced Bookings, market changes, competition, or any other factors beyond its control.`,
      ] },
      { n: `10`, title: `Company Right to Suspend Financial Transfers`, paras: [
        `The Company may temporarily suspend or delay the transfer of any amounts due to the Host in the event of a serious complaint or dispute relating to a Booking or the Property involved, or where there is suspicion of a violation of this Agreement or applicable laws, until the review is completed, the dispute is resolved, or the matter under complaint is verified. No liability shall arise on the Company as a result. Any decision taken by the Company in this regard shall be temporary and shall not constitute acknowledgment of the validity of any claim or dispute under review.`,
      ] },
    ],
  },
  {
    title: `Host Obligations`,
    articles: [
      { n: `11`, title: `Obligation to Provide Accurate Data and Documents`, paras: [
        `11.1- The Host shall provide accurate, correct, and complete data, information, and documents upon registration or when listing any Property on the Platform.`,
        `11.2- The Host warrants the accuracy of all data, information, documents, and images provided by the Host and shall bear sole legal responsibility for any inaccurate, misleading, or incomplete information.`,
        `11.3- The Host shall immediately notify the Company upon becoming aware of any error in, or change to, any data, documents, or information previously provided.`,
      ] },
      { n: `12`, title: `Obligation to Update Property Information`, paras: [
        `12.1- The Host shall continuously maintain updated information regarding the Property listed on the Platform.`,
        `12.2- The Host shall promptly update any material information relating to the Property, including prices, specifications, services, Property status, or any information that may affect a Booking decision.`,
        `12.3- The Host shall bear sole responsibility for any damages or claims arising from failure to update Property-related information.`,
      ] },
      { n: `13`, title: `Obligation Regarding the Right to Rent or Manage`, paras: [
        `13.1 The Host shall be the owner of the Property or legally authorized to manage, rent, or list it through the Platform.`,
        `13.2- The Host shall retain documents evidencing the right to list and rent the Property throughout the period of use of the Platform.`,
        `13.3 - The Host shall bear all legal consequences arising from the absence of the legal right required to list or rent the Property.`,
      ] },
      { n: `14`, title: `Obligation to Respond to Booking Requests`, paras: [
        `14.1- The Host shall review and respond to Booking requests received through the Platform within no more than twenty-four (24) hours from receipt of the request.`,
        `14.2- The Company may deem a Booking request automatically rejected or cancelled if the above period expires without a response from the Host.`,
        `14.3- The Company shall bear no liability toward the Host or the Guest resulting from cancellation of a Booking request due to failure to respond within the specified period.`,
      ] },
      { n: `15`, title: `Obligation to Fulfill Confirmed Bookings`, paras: [
        `15.1- The Host shall fulfill all Bookings confirmed in accordance with the procedures and Policies applicable on the Platform.`,
        `15.2- The Host may cancel a confirmed Booking in accordance with the Policies approved by the Company, while bearing all consequences arising therefrom under this Agreement.`,
        `15.3- The Host shall immediately notify the Company upon becoming aware of any circumstance that may affect the Host's ability to fulfill a Booking or perform obligations toward the Guest.`,
        `15.4- Cancellation of a Booking by the Host shall not prejudice the Company's right to take any measures or penalties it deems appropriate under this Agreement.`,
      ] },
      { n: `16`, title: `Obligation Regarding the Accuracy of Financial Consideration Displayed on the Platform`, paras: [
        `16.1- The Host shall list the actual rental value and all amounts payable by the Guest accurately and completely.`,
        `16.2- The Host is prohibited from providing, recording, or advertising any fictitious or inaccurate value, concealing any part of the financial consideration, or entering into any arrangements intended to circumvent, reduce, or avoid the Company's fees or commissions, whether directly or indirectly.`,
        `16.3- If such violation is established, the Company may recalculate the applicable fees and commissions based on the actual value of the transaction, without prejudice to its right to impose penalties or claim compensation under this Agreement.`,
      ] },
    ],
  },
  {
    title: `Contractual Penalties and Liability`,
    articles: [
      { n: `17`, title: `Contractual Penalties`, paras: [
        `In the event the Host breaches any provision, obligation, undertaking, or warranty contained in this Agreement or any related Policies or Annexes, the Company may take any measures or penalties it deems appropriate depending on the severity of the violation, including warning notices, suspension of the Property, suspension of the Account, restriction of certain services, or termination of the Agreement, without prejudice to any other rights available to the Company under applicable law or this Agreement. The Company shall determine the appropriate measure according to the nature and seriousness of the violation, provided that such measure does not conflict with applicable law.`,
      ] },
      { n: `18`, title: `Agreed Compensation`, paras: [
        `If the Host breaches any provision, obligation, undertaking, or warranty contained in this Agreement or any related Policies or Annexes, and such breach causes harm to the Company, the Platform, users, or the Company's legitimate interests, the Host shall pay agreed compensation equal to the total actual rental value of the Booking or transaction subject to the violation, without prejudice to the Company's right to impose any other penalties or measures available under this Agreement or applicable law, or to claim compensation for damages exceeding the value of the agreed compensation.`,
      ] },
    ],
  },
  {
    title: `Final Provisions`,
    articles: [
      { n: `19`, title: `Electronic Acceptance`, paras: [
        `The Host acknowledges that completing registration procedures, creating an Account, using the Platform, clicking "Agree," or using any similar electronic acceptance mechanism constitutes explicit and binding acceptance of all provisions of this Agreement and the related Policies and Annexes and shall produce all legal effects prescribed by law.`,
      ] },
      { n: `20`, title: `Electronic Records and Evidence`, paras: [
        `The parties agree that electronic records, data, messages, notifications, and transaction logs maintained by the Company or generated through the Platform shall constitute valid evidence of Platform usage and all transactions, procedures, and actions carried out through the Host's Account unless proven otherwise through legally recognized means.`,
      ] },
      { n: `21`, title: `Governing Language`, paras: [
        `This Agreement has been executed in both Arabic and English. In the event of any conflict, discrepancy, or inconsistency between the two versions, the Arabic version shall prevail and shall be regarded as the governing text for interpretation and application.`,
      ] },
      { n: `22`, title: `Governing Law`, paras: [
        `This Agreement and all related Policies and Annexes shall be governed, interpreted, enforced, and given legal effect in accordance with the laws in force in the Arab Republic of Egypt.`,
      ] },
      { n: `23`, title: `Jurisdiction`, paras: [
        `The courts of the Arab Republic of Egypt shall have jurisdiction over any dispute, claim, or disagreement arising out of or relating to this Agreement, its implementation, or its interpretation. Jurisdiction shall be vested in the court having subject-matter and territorial jurisdiction in accordance with applicable legal rules.`,
      ] },
      { n: `24`, title: `Force Majeure`, paras: [
        `Each party shall perform its obligations in accordance with this Agreement. Neither party shall be liable for non-performance or delay in performance where such non-performance or delay results from a cause beyond its control that could not be foreseen, prevented, or avoided, for the duration of such circumstances and to the extent of their effects.`,
      ] },
      { n: `25`, title: `Severability`, paras: [
        `If any provision of this Agreement is determined to be wholly or partially invalid, unlawful, or unenforceable, such determination shall not affect the validity or enforceability of the remaining provisions, which shall remain in full force and effect to the extent they do not conflict with the provision determined to be invalid or unenforceable.`,
      ] },
      { n: `26`, title: `Assignment of the Agreement`, paras: [
        `The Host may not assign this Agreement or any rights or obligations arising from it, in whole or in part, to any person or entity without obtaining the Company's prior written consent.`,
        `Nothing in the foregoing shall prejudice the Company's right to transfer, assign, or reorganize its rights or obligations relating to the Platform or its business activities to the extent permitted by applicable laws.`,
      ] },
      { n: `27`, title: `Policies and Annexes`, paras: [
        `All Policies, Annexes, forms, instructions, and operational procedures adopted by the Company, published on the Platform, or incorporated by reference into this Agreement shall constitute an integral part of this Agreement and shall supplement its provisions. The Host shall review and comply with all such Policies, Appendices, forms, instructions, and operational procedures.`,
        `The Company may amend or update such Policies or Appendices whenever required by the operation of the Platform or by legal, regulatory, or technical requirements. Such amendments or updates shall become effective from the date of their publication on the Platform or from such later date as may be specified by the Company, without prejudice to any rights or obligations that arose prior to their effective date, unless otherwise required by applicable law.`,
      ] },
    ],
  },
]

// ─────────────────────────── HOST — Arabic (27 articles) ─────────────────────
export const HOST_AR: Section[] = [
  {
    title: `الأحكام العامة المنظمة للعلاقة بين الشركة والمؤجر`,
    articles: [
      { n: `١`, title: `نطاق العلاقة`, paras: [
        `يقر المؤجر ويوافق على أن هذه الاتفاقية تنظم العلاقة القانونية بينه وبين الشركة فيما يتعلق باستخدام المنصة الإلكترونية وإدراج الوحدات العقارية وإدارة طلبات الحجز والمدفوعات والخدمات المرتبطة بها، وذلك وفقًا للشروط والأحكام الواردة في هذه الاتفاقية أو في أي ملحق تابع لهذا الاتفاق.`,
      ] },
      { n: `٢`, title: `دور الشركة`, paras: [
        `١) تعمل الشركة بصفتها مشغلًا ومطورًا لمنصة إلكترونية متخصصة في عرض الوحدات العقارية وتسهيل عمليات الحجز وإدارة المدفوعات بين المؤجرين والعملاء.`,
        `٢) لا تعد الشركة مالكة أو مؤجرة أو مستأجرة لأي من الوحدات العقارية المعروضة عبر المنصة، كما لا تتولى إدارتها أو تشغيلها أو الإشراف المباشر عليها.`,
        `٣) لا تعد الشركة طرفًا في أي عقد إيجار، أو انتفاع، أو إقامة، أو أي اتفاق يتم بين المؤجر والعميل، وتنشأ كافة الحقوق والالتزامات الناشئة عن ذلك العقد مباشرة بين المؤجر والعميل.`,
      ] },
      { n: `٣`, title: `استقلال العلاقة القانونية بين الطرفين`, paras: [
        `٣.١- يظل المؤجر شخصًا مستقلًا قانونيًا وماليًا وإداريًا عن الشركة، ويتحمل وحده المسؤولية الكاملة عن الوحدة العقارية المدرجة من قبله وكافة البيانات والمعلومات والخدمات المرتبطة بها.`,
        `٣.٢- لا يترتب على هذه الاتفاقية إنشاء أي شكل من أشكال الشراكة، أو المشروع المشترك، أو علاقة العمل، أو الامتياز التجاري، أو التبعية الإدارية، أو المالية بين الشركة والمؤجر، ويحتفظ كل طرف بشخصيته القانونية المستقلة ومسؤوليته المنفصلة عن الطرف الآخر.`,
        `٣.٣- لا تمنح هذه الاتفاقية لأي من الطرفين صفة الوكيل أو الممثل أو المفوض عن الطرف الآخر، ولا يجوز لأي منهما التعاقد، أو ترتيب التزامات، أو تقديم تعهدات، أو إقرارات باسم الطرف الآخر إلا في الحدود التي تنص عليها هذه الاتفاقية صراحة.`,
        `٣.٤- يلتزم المؤجر بعدم تقديم نفسه أو الإعلان أو التصرف بأي صورة توحي بأنه ممثل أو وكيل أو مفوض من قبل الشركة أو مخول بالتعاقد أو الالتزام باسمها أمام الغير.`,
      ] },
      { n: `٤`, title: `طبيعة خدمات المنصة`, paras: [
        `يقر المؤجر علمه بأن خدمات الشركة تقتصر على تشغيل المنصة الإلكترونية وما يرتبط بها من خدمات تقنية وإدارية، بما في ذلك:`,
        `أ) عرض الوحدات العقارية على المنصة`,
        `ب) استقبال وإدارة طلبات الحجز`,
        `ت) معالجة المدفوعات المحصلة عبر المنصة`,
        `ث) الاحتفاظ بالمبالغ المحصلة وتحويل المستحقات المالية وفقًا لسياسات المنصة`,
        `ج) توفير وسائل التواصل والدعم الفني`,
      ] },
      { n: `٥`, title: `مسؤولية المؤجر عن الوحدة والبيانات`, paras: [
        `٥.١- يقر المؤجر بأن الشركة لا تملك الوحدات العقارية المعروضة على المنصة، ولا تتولى إدارتها أو تشغيلها أو الإشراف المباشر عليها، ويقتصر دورها على تشغيل المنصة الإلكترونية وتقديم الخدمات المرتبطة بها وفقًا لأحكام هذه الاتفاقية.`,
        `٥.٢- يتحمل المؤجر وحده كافة المسؤوليات والالتزامات المتعلقة بالوحدة العقارية المدرجة من قبله، بما في ذلك حالتها وصلاحيتها للاستخدام وجودة الخدمات المقدمة من خلالها ومدى مطابقتها للوصف والصور والبيانات المنشورة على المنصة.`,
        `٥.٣- كما يتحمل المؤجر وحده جميع الالتزامات القانونية والتنظيمية والفنية والضريبية والتعاقدية المتعلقة بالوحدة أو باستغلالها أو تأجيرها، دون أدنى مسؤولية على الشركة، وذلك ما لم ينص القانون صراحة على خلاف ذلك.`,
        `٥.٤- ولا تتحمل الشركة أي مسؤولية ناشئة عن عدم صحة، أو دقة، أو اكتمال البيانات، أو المعلومات، أو المستندات، أو الأوصاف المقدمة من المؤجر أو المنشورة بواسطة حسابه على المنصة.`,
      ] },
      { n: `٦`, title: `حق الشركة في إدارة وتطوير المنصة`, paras: [
        `٦.١- تحتفظ الشركة بحقها في تنظيم وإدارة وتشغيل المنصة وتطويرها واتخاذ ما تراه مناسبًا من سياسات وإجراءات تشغيلية لضمان سلامة التشغيل وحماية المستخدمين وتحقيق مصالحها المشروعة، وذلك وفقًا لأحكام هذه الاتفاقية والقوانين المعمول بها.`,
        `٦.٢- يحق للشركة في أي وقت تعديل أو تطوير أو تحديث آليات وإجراءات تشغيل المنصة، وأنظمة الحجز، والمدفوعات، أو عرض الوحدات، أو التحقق من البيانات أو أي خدمات أو سياسات تشغيلية أخرى كلما اقتضت مصلحة العمل ذلك.`,
        `على أن تلتزم الشركة بعدم المساس بالحقوق والالتزامات الناشئة عن الحجوزات المؤكدة قبل تاريخ نفاذ تلك التعديلات، ما لم يكن التعديل لازمًا للامتثال لأحكام القانون أو لقرار صادر من جهة مختصة أو لمعالجة خلل تقني أو أمني جوهري.`,
      ] },
      { n: `٧`, title: `حق الشركة في التحقق`, paras: [
        `٧.١- يحق للشركة، في أي وقت، أن تطلب من المؤجر ما تراه لازمًا من مستندات أو بيانات أو معلومات للتحقق من هويته، وصحة البيانات المتعلقة بالوحدة، وأحقيته في عرضها أو تأجيرها. كما يحق لها أن تطلب تحديث هذه المستندات دوريًا أو كلما دعت الحاجة إلى ذلك.`,
        `٧.٢- يلتزم المؤجر بالتعاون الكامل مع الشركة وتقديم المستندات المطلوبة خلال المدة التي تحددها. ويترتب على امتناعه أو تأخره في تقديمها حق الشركة في تعليق الوحدة، أو الحساب، أو تقييدهما، أو إزالتهما، دون أن تتحمل أي مسؤولية نتيجة لذلك.`,
        `٧.٣- يجوز للشركة الاستعانة بجهات، أو أنظمة، أو قواعد بيانات حكومية، أو خاصة، أو أي وسائل تقنية تراها مناسبة للتحقق من صحة البيانات والمستندات المقدمة من المؤجر.`,
      ] },
      { n: `٨`, title: `حق الشركة في قبول الوحدات أو رفضها أو إزالتها`, paras: [
        `تحتفظ الشركة بحقها التقديري -وفقًا لما تراه ضروريًا لحماية مصالحها المشروعة- في قبول أي وحدة عقارية، أو رفضها، أو تعليقها، أو إزالتها، وكذلك أي محتوى أو بيانات مرتبطة بها، متى رأت أن ذلك لازم لحماية المنصة، أو المستخدمين، أو مصالحها، أو للامتثال للقوانين، أو السياسات الداخلية المعمول بها.`,
        `ولا يترتب على ممارسة الشركة لهذا الحق أي التزام بتعويض المؤجر أو بيان أسباب القرار، ما لم ينص القانون على خلاف ذلك.`,
      ] },
      { n: `٩`, title: `حدود مسؤولية الشركة عن المقابل المالي`, paras: [
        `يقر المؤجر بأن دور الشركة يقتصر على توفير وتشغيل المنصة الإلكترونية، وأن الشركة لا تضمن بأي حال من الأحوال تحقيق أي حد أدنى من الحجوزات، كما لا تضمن تحصيل أو سداد أي مستحقات مالية متفق عليها بين المؤجر والعميل إلا في حدود المبالغ التي تم تحصيلها فعليًا من خلال المنصة، ولا تتحمل أي مسؤولية عن انخفاض الطلب، أو تراجع الحجوزات، أو تغير ظروف السوق، أو المنافسة، أو أي عوامل أخرى خارجة عن إرادتها.`,
      ] },
      { n: `١٠`, title: `حق الشركة في تعليق التحويلات المالية`, paras: [
        `يحق للشركة تعليق أو تأجيل تحويل أي مبالغ مستحقة للمؤجر بصورة مؤقتة في حال وجود شكوى أو نزاع جدية يتعلق بالحجز أو الوحدة محل التعامل أو في حال الاشتباه في مخالفة أحكام هذه الاتفاقية أو القوانين المعمول بها، وذلك لحين انتهاء المراجعة أو تسوية النزاع أو التحقق من الواقعة محل الشكوى، دون أن يترتب على ذلك أي مسؤولية على الشركة، ويكون قرار الشركة في هذا الشأن قرارًا مؤقتًا لا يترتب عليه إقرار بصحة أي ادعاء أو نزاع محل المراجعة.`,
      ] },
    ],
  },
  {
    title: `التزامات المؤجر`,
    articles: [
      { n: `١١`, title: `الالتزام بصحة البيانات والمستندات`, paras: [
        `١١.١- يلتزم المؤجر بتقديم بيانات ومعلومات ومستندات صحيحة ودقيقة وكاملة عند التسجيل أو عند إدراج أي وحدة على المنصة.`,
        `١١.٢- يضمن المؤجر صحة كافة البيانات والمعلومات والمستندات والصور المقدمة منه، ويتحمل وحده المسؤولية القانونية الكاملة عن أي بيانات غير صحيحة أو مضللة أو ناقصة.`,
        `١١.٣- يلتزم المؤجر بإخطار الشركة فور علمه بأي خطأ أو تغيير يطرأ على البيانات أو المستندات أو المعلومات المقدمة منه.`,
      ] },
      { n: `١٢`, title: `الالتزام بتحديث بيانات الوحدة`, paras: [
        `١٢.١- يلتزم المؤجر بالمحافظة على تحديث جميع البيانات الخاصة بالوحدة العقارية المدرجة على المنصة بصورة مستمرة.`,
        `١٢.٢- يلتزم المؤجر بتحديث أي بيانات جوهرية تتعلق بالوحدة فور حدوثها، بما في ذلك الأسعار، أو المواصفات، أو الخدمات، أو حالة الوحدة، أو أي معلومات قد تؤثر على قرار الحجز.`,
        `١٢.٣- يتحمل المؤجر وحده المسؤولية عن أي أضرار أو مطالبات تنشأ نتيجة عدم تحديث البيانات أو المعلومات الخاصة بالوحدة.`,
      ] },
      { n: `١٣`, title: `الالتزام بحق التأجير أو الإدارة`, paras: [
        `١٣.١- يلتزم المؤجر بأن يكون مالكًا للوحدة أو مفوضًا قانونًا في إدارتها أو تأجيرها أو عرضها من خلال المنصة.`,
        `١٣.٢- يلتزم المؤجر بالاحتفاظ بالمستندات التي تثبت حقه في عرض الوحدة وتأجيرها طوال مدة استخدامه للمنصة.`,
        `١٣.٣- يتحمل المؤجر وحده كافة الآثار القانونية المترتبة على عدم توافر الحق القانوني اللازم لعرض الوحدة أو تأجيرها.`,
      ] },
      { n: `١٤`, title: `الالتزام بالرد على طلبات الحجز`, paras: [
        `١٤.١- يلتزم المؤجر بمراجعة طلبات الحجز الواردة إليه من خلال المنصة والرد عليها خلال مدة لا تجاوز أربعًا وعشرين (٢٤) ساعة من تاريخ استلام الطلب.`,
        `١٤.٢- يحق للشركة اعتبار طلب الحجز مرفوضًا أو ملغيًا تلقائيًا في حال انقضاء المدة المشار إليها دون رد من المؤجر.`,
        `١٤.٣- لا تتحمل الشركة أي مسؤولية تجاه المؤجر أو العميل نتيجة إلغاء طلب الحجز بسبب عدم الرد خلال المدة المحددة.`,
      ] },
      { n: `١٥`, title: `الالتزام بتنفيذ الحجوزات المؤكدة`, paras: [
        `١٥.١- يلتزم المؤجر بتنفيذ جميع الحجوزات التي تم تأكيدها وفقًا للإجراءات والسياسات المعمول بها على المنصة.`,
        `١٥.٢- يجوز للمؤجر إلغاء الحجز المؤكد وفقًا للسياسات المعتمدة من الشركة، مع تحمله كافة الآثار المترتبة على ذلك وفقًا لأحكام هذه الاتفاقية.`,
        `١٥.٣- يلتزم المؤجر بإخطار الشركة فور علمه بأي ظرف قد يؤثر على قدرته على تنفيذ الحجز أو الوفاء بالتزاماته تجاه العميل.`,
        `١٥.٤- لا يخل إلغاء الحجز من قبل المؤجر بحق الشركة في اتخاذ ما تراه مناسبًا من إجراءات أو جزاءات وفقًا لأحكام هذه الاتفاقية.`,
      ] },
      { n: `١٦`, title: `الالتزام بصحة المقابل المالي المعروض على المنصة`, paras: [
        `١٦.١- يلتزم المؤجر بإدراج القيمة الإيجارية الحقيقية وكافة المبالغ المستحقة من العميل بصورة صحيحة وكاملة.`,
        `١٦.٢- يحظر على المؤجر تقديم أو تسجيل أو الإعلان عن أي قيمة صورية أو غير حقيقية أو إخفاء أي جزء من المقابل المالي أو الاتفاق على أي ترتيبات يكون من شأنها التحايل على رسوم، أو عمولات الشركة، أو تقليلها، أو تفاديها، بصورة مباشرة أو غير مباشرة.`,
        `١٦.٣- في حال ثبوت مخالفة ذلك يحق للشركة إعادة احتساب الرسوم والعمولات المستحقة على أساس القيمة الفعلية للتعامل، وذلك دون الإخلال بحقها في تطبيق الجزاءات أو المطالبة بالتعويضات المقررة بموجب هذه الاتفاقية.`,
      ] },
    ],
  },
  {
    title: `الجزاءات والمسؤولية التعاقدية`,
    articles: [
      { n: `١٧`, title: `الجزاءات التعاقدية`, paras: [
        `يحق للشركة، في حال إخلال المؤجر بأي حكم، أو التزام، أو تعهد، أو ضمان وارد في هذه الاتفاقية أو أي من السياسات أو الملحقات المرتبطة بها، اتخاذ ما تراه مناسبًا من إجراءات أو جزاءات وفقًا لجسامة المخالفة، بما في ذلك الإنذار، أو تعليق الوحدة، أو تعليق الحساب، أو تقييد بعض الخدمات، أو إنهاء الاتفاقية، وذلك دون الإخلال بأي حقوق أخرى مقررة للشركة بموجب القانون أو هذه الاتفاقية، ويكون للشركة تقدير الإجراء المناسب بحسب طبيعة المخالفة وجسامتها وذلك بما لا يخالف أحكام القانون.`,
      ] },
      { n: `١٨`, title: `التعويض الاتفاقي`, paras: [
        `يلتزم المؤجر، في حال إخلاله بأي حكم، أو التزام، أو تعهد، أو ضمان وارد في هذه الاتفاقية أو السياسات أو الملحقات المرتبطة بها، وكان من شأن ذلك إلحاق ضرر بالشركة، أو المنصة، أو المستخدمين، أو مصالح الشركة المشروعة، بأداء تعويض اتفاقي يعادل إجمالي القيمة الإيجارية الحقيقية للحجز أو التعامل محل المخالفة، وذلك دون الإخلال بحق الشركة في اتخاذ أي جزاءات أو إجراءات أخرى مقررة بموجب هذه الاتفاقية أو القانون، أو المطالبة بالتعويض عن الأضرار التي تتجاوز قيمة التعويض الاتفاقي.`,
      ] },
    ],
  },
  {
    title: `الأحكام الختامية`,
    articles: [
      { n: `١٩`, title: `الموافقة الإلكترونية`, paras: [
        `يقر المؤجر بأن إتمام إجراءات التسجيل، أو إنشاء الحساب، أو استخدام المنصة، أو الضغط على خيار "موافق" أو أي وسيلة إلكترونية مماثلة مخصصة لإبداء القبول يعد قبولًا صريحًا وملزمًا لجميع أحكام هذه الاتفاقية والسياسات والملحقات المرتبطة بها، ويترتب عليه كافة الآثار القانونية المقررة قانونًا.`,
      ] },
      { n: `٢٠`, title: `السجلات الإلكترونية والإثبات`, paras: [
        `يتفق الطرفان على الاعتداد بالسجلات والبيانات والرسائل والإشعارات الإلكترونية وسجلات العمليات المحفوظة لدى الشركة أو الصادرة من خلال المنصة كوسيلة معتبرة في إثبات استخدام المنصة وكافة العمليات والإجراءات والتصرفات التي تتم من خلال حساب المؤجر، وذلك ما لم يثبت خلاف ذلك بالطرق القانونية المقررة.`,
      ] },
      { n: `٢١`, title: `اللغة المعتمدة`, paras: [
        `تم تحرير هذه الاتفاقية باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض أو اختلاف أو تناقض بين النصين، تكون العبرة بالنص العربي ويعتد به باعتباره النص الحاكم في التفسير والتطبيق.`,
      ] },
      { n: `٢٢`, title: `القانون الواجب التطبيق`, paras: [
        `تخضع هذه الاتفاقية وكافة السياسات والملحقات المرتبطة بها، من حيث التفسير والتنفيذ والآثار القانونية المترتبة عليها، لأحكام القوانين النافذة في جمهورية مصر العربية.`,
      ] },
      { n: `٢٣`, title: `الاختصاص القضائي`, paras: [
        `تختص محاكم جمهورية مصر العربية بالفصل في أي نزاع أو مطالبة أو خلاف ينشأ عن هذه الاتفاقية أو يرتبط بها أو بتنفيذها أو تفسيرها، ويكون الاختصاص للمحكمة المختصة نوعيًا ومحليًا وفقًا للقواعد المقررة قانونًا.`,
      ] },
      { n: `٢٤`, title: `القوة القاهرة`, paras: [
        `يلتزم كل طرف بتنفيذ التزاماته وفقًا لأحكام هذه الاتفاقية، ولا يعد أي منهما مسؤولًا عن عدم التنفيذ أو التأخر فيه إذا كان ذلك ناشئًا عن سبب خارج عن إرادته لا يمكن توقعه أو دفعه أو تلافي آثاره وذلك طوال مدة استمرار تلك الظروف وفي حدود آثارها.`,
      ] },
      { n: `٢٥`, title: `استقلال أحكام الاتفاقية`, paras: [
        `إذا تقرر بطلان أو عدم مشروعية أو عدم قابلية تنفيذ أي حكم من أحكام هذه الاتفاقية كليًا أو جزئيًا، فلا يترتب على ذلك بطلان أو عدم نفاذ باقي الأحكام، وتظل سارية ونافذة بالقدر الذي لا يتعارض مع الحكم الذي تقرر بطلانه أو عدم قابليته للتنفيذ.`,
      ] },
      { n: `٢٦`, title: `التنازل عن الاتفاقية`, paras: [
        `لا يجوز للمؤجر التنازل عن هذه الاتفاقية أو عن أي من الحقوق أو الالتزامات الناشئة عنها، كليًا أو جزئيًا، لأي شخص أو جهة أخرى، إلا بعد الحصول على موافقة كتابية مسبقة من الشركة. ولا يخل ذلك بحق الشركة في نقل، أو إحالة، أو إعادة تنظيم حقوقها، أو التزاماتها المرتبطة بالمنصة، أو بنشاطها وفقًا لما تسمح به القوانين المعمول بها.`,
      ] },
      { n: `٢٧`, title: `السياسات والملحقات`, paras: [
        `تعد جميع السياسات والملحقات والنماذج والتعليمات والإجراءات التشغيلية التي تعتمدها الشركة أو تنشرها على المنصة أو تحيل إليها هذه الاتفاقية جزءًا لا يتجزأ منها ومكملة لأحكامها، ويلتزم المؤجر بالاطلاع عليها والامتثال لها.`,
        `ويجوز للشركة تعديل أو تحديث تلك السياسات أو الملحقات كلما اقتضت طبيعة تشغيل المنصة، أو المتطلبات القانونية، أو التنظيمية، أو الفنية ذلك، وتكون هذه التعديلات نافذة من تاريخ نشرها على المنصة أو من التاريخ الذي تحدده الشركة، وذلك دون الإخلال بالحقوق أو الالتزامات الناشئة قبل نفاذها، ما لم يقتضِ القانون خلاف ذلك.`,
      ] },
    ],
  },
]

export function sectionsFor(audience: Audience, isAr: boolean): Section[] {
  if (audience === 'host') return isAr ? HOST_AR : HOST_EN
  return isAr ? GUEST_AR : GUEST_EN
}
