/* ============================================================
   KAMERAAD HAARSNIJDER — i18n
   Five languages: Leuvens (local dialect), Nederlands, English,
   Français, Español.
   ------------------------------------------------------------
   ⚠ LEUVENS: Adil levert de definitieve Leuvense vertaling.
   De strings hieronder zijn een eerste benadering — laat Adil
   ze nakijken en verfijnen.
   ------------------------------------------------------------
   Usage:
     <element data-i18n="key">            → textContent
     <element data-i18n-html="key">        → innerHTML (mag opmaak)
     <input  data-i18n-ph="key">           → placeholder
   API (window.KH):
     KH.lang            huidige taalcode
     KH.t(key)          vertaalde string (val terug op NL → key)
     KH.list(key)       array-waarde (dow / mon)
     KH.setLang(code)   wissel taal + persisteer + notify
     KH.onChange(fn)    abonneer op taalwissels
   ============================================================ */
(function () {
  var DICT = {
    /* ----------------------------- NEDERLANDS ----------------------------- */
    nl: {
      'nav.about': 'Over ons', 'nav.services': 'Diensten', 'nav.products': 'Producten',
      'nav.contact': 'Contact', 'nav.book': 'Boek nu', 'nav.book_arrow': 'Boek nu →',
      'badge.walkin': 'Walk-ins — altijd welkom', 'badge.walkin_short': 'Walk-ins welkom',
      'hero.title': '<span class="accent">Stille</span> klasse.<br />Tijdloos vakmanschap.',

      'book.eyebrow': 'Reserveer', 'book.title': 'Boek je stoel.', 'book.open': 'Boek je stoel →',
      'book.lead': 'Eerst je dienst, dan de barbier die ze uitvoert, dan een moment dat past. Stap voor stap — de rest doen wij.',
      'book.hours_k': 'Uren', 'book.hours_v': 'Di–Zo · 10:00–20:00', 'book.place_k': 'Plek',
      'book.walkin': '<strong>Walk-ins welkom.</strong> Geen afspraak? Spring gewoon binnen — Di–Za, 10:00–20:00.',
      'book.s_service': 'Dienst', 'book.s_barber': 'Barbier', 'book.s_date': 'Datum', 'book.s_time': 'Tijd',
      'svc.knippen': 'Knippen', 'svc.baard': 'Baard', 'svc.combo': 'Knippen + Baard', 'svc.kind': 'Kind (–12 j.)',
      'book.barber_note': 'Beschikbaar voor je dienst:',
      'book.summary_start': 'Kies een dienst om te beginnen.',
      'book.confirm': 'Bevestig afspraak', 'book.done_h': 'Tot snel, kameraad.', 'book.reset': 'Nieuwe afspraak',
      'book.no_pref': 'Geen voorkeur', 'book.no_pref_low': 'geen voorkeur',
      'book.at': 'bij', 'book.on': 'op', 'book.at_time': 'om',
      'book.choose_more': 'Kies nog een', 'book.l_barber': 'barbier', 'book.l_date': 'datum', 'book.l_time': 'tijd',
      'book.with': 'met', 'book.your_barber': 'je barbier', 'book.confirm_msg': 'We sturen je een bevestiging.',
      'book.dow': ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
      'book.mon': ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],

      'ritual.eyebrow': 'Intro — Het Ritueel',
      'ritual.heading': 'De laatste <em>herenretraite</em>',
      'ritual.copy1': 'Kameraad Haarsnijder ontstond uit het idee dat er niet zoiets bestond als een herenretraite. Vandaag is Kameraad veruit de laatste retraite voor mannen van alle leeftijden. Zelfs wie geen dienst afneemt, is altijd welkom om even te ontsnappen aan de dagelijkse drukte.',
      'ritual.copy2': 'En het stopt niet bij de stoel. Kameraad verhuurt ook zijn eigen bakfietsen — de zwarte, de blauwe en de rode — om Leuven op je eigen tempo te verkennen. Spring binnen voor een knip, rol weer buiten op twee wielen.',

      'comf.eyebrow': 'Onder ons', 'comf.title': 'Het huis <em>trakteert</em>',
      'comf.lead': 'Ga zitten, blijf even. Een vers jatteke kaffe, een vinger whiskey of rum, de krant van vandaag — bij Kameraad mag je vertragen, met of zonder afspraak.',
      'comf.coffee': 'Jatteke kaffe', 'comf.coffee_m': 'vers gezet',
      'comf.whiskey': 'Whiskey', 'comf.whiskey_m': 'een vinger, neat',
      'comf.rum': 'Rum', 'comf.rum_m': 'voor de liefhebber',
      'comf.papers': 'Kranten', 'comf.papers_m': 'de dag bijgepraat',
      'comf.foam': 'Warm scheerschuim', 'comf.foam_m': 'de echte scheerbeurt',

      'craft.eyebrow': 'Vakmanschap voorop',
      'craft.title': 'We volgen geen trends blindelings. We kiezen ze — <em>met zorg</em>.',
      'craft.copy': 'Onze barbiers — Avraz, Adil, Simar en Bas — zijn vaklui met diep respect voor het métier. Elk brengt zijn eigen blik, verenigd door één maatstaf: kwaliteit zonder compromis.',

      'prod.eyebrow': 'Producten — 02', 'prod.title': 'Alleen wat werkt',
      'prod.intro': 'We gebruiken en verkopen een zorgvuldig samengestelde selectie — Reuzel, Layrite en klassieke barbierproducten. Gekozen om hun prestatie, niet om de hype. Eerlijke formules, eerlijk resultaat.',
      'prod.local': 'Lokale ambacht', 'prod.chair': 'De stoel', 'prod.chair_m': 'Ga zitten & ontspan',

      'foot.masked': 'Kom langs',
      'foot.pitch': 'Boek je moment. Stap binnen in een plek waar de tijd vertraagt en details ertoe doen.',
      'foot.email': 'je e-mailadres…', 'foot.hours_h': 'Openingsuren',
      'foot.hours': 'Di–Zo · 10:00 – 20:00<br />Ma · gesloten<br />Feestdagen · <span class="muted">check Instagram</span>',
      'foot.addr_h': 'Adres', 'foot.privacy': 'Privacybeleid', 'foot.terms': 'Algemene voorwaarden'
    },

    /* ------------------------------- LEUVENS ------------------------------ */
    /* ⚠ Eerste benadering — Adil verfijnt. */
    leuvens: {
      'nav.about': 'Over ons', 'nav.services': 'Diensten', 'nav.products': 'Spul',
      'nav.contact': 'Contact', 'nav.book': 'Boek na', 'nav.book_arrow': 'Boek na →',
      'badge.walkin': 'Walk-ins — altij welkom', 'badge.walkin_short': 'Walk-ins welkom',
      'hero.title': '<span class="accent">Stille</span> klas.<br />Echt mêesterschap.',

      'book.eyebrow': 'Reserveire', 'book.title': 'Boek a stoeleke.', 'book.open': 'Boek a stoeleke →',
      'book.lead': 'Êest a dienst, dan de barbier dieje da doet, en dan een momentsje da past. Stap veu stap — de res doeme wij.',
      'book.hours_k': 'Ure', 'book.hours_v': 'Di–Zo · 10:00–20:00', 'book.place_k': 'Plek',
      'book.walkin': '<strong>Walk-ins zen welkom.</strong> Gên afsprak? Komt gewoêon binne — Di–Za, 10:00–20:00.',
      'book.s_service': 'Dienst', 'book.s_barber': 'Barbier', 'book.s_date': 'Datum', 'book.s_time': 'Ier',
      'svc.knippen': 'Knippe', 'svc.baard': 'Boord', 'svc.combo': 'Knippe + Boord', 'svc.kind': 'Manneke (–12 j.)',
      'book.barber_note': 'Te kreige veu a dienst:',
      'book.summary_start': 'Kiest êest a dienst.',
      'book.confirm': 'Bevestig afsprak', 'book.done_h': 'Tot subiet, kameraad.', 'book.reset': 'Nieiw afsprak',
      'book.no_pref': 'Maakt ni uit', 'book.no_pref_low': 'maakt ni uit',
      'book.at': 'bij', 'book.on': 'op', 'book.at_time': 'om',
      'book.choose_more': 'Kiest nog ne', 'book.l_barber': 'barbier', 'book.l_date': 'datum', 'book.l_time': 'ier',
      'book.with': 'me', 'book.your_barber': 'a barbier', 'book.confirm_msg': 'We sture a een bevestiging.',
      'book.dow': ['Zo', 'Mo', 'Di', 'Wo', 'Do', 'Vr', 'Zo'],
      'book.mon': ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],

      'ritual.eyebrow': 'Intro — Het Ritueel',
      'ritual.heading': 'De leste <em>mannekesretraite</em>',
      'ritual.copy1': 'Kameraad Haarsnijder is ontstoon uit het idee dat er zoiet as een mannekesretraite ni bestond. Vandoog is Kameraad veruit de leste retraite veu manne van alle leeftijde. Zelfs as ge niks komt hoole, zijde altij welkom veu efkes te ontsnappe aan de drukte.',
      'ritual.copy2': 'En het stopt ni bij de stoel. Kameraad verhuurt ook zen eige bakfietse — de zwarte, de blaa en de rooj — veu Leuve op a eige tempo te ontdekke. Komt binne veu a knip, rolt buite op twei wiele.',

      'comf.eyebrow': 'Onder ons', 'comf.title': 'Het hois <em>trakteert</em>',
      'comf.lead': 'Goa zitte, blijf efkes. E vers jatteke kaffe, e vingerke whiskey of rum, de gazet van vandoog — bij Kameraad meugde vertroge, me of zonder afsprak.',
      'comf.coffee': 'Jatteke kaffe', 'comf.coffee_m': 'vers gezet',
      'comf.whiskey': 'Whiskey', 'comf.whiskey_m': 'e vingerke, puur',
      'comf.rum': 'Rum', 'comf.rum_m': 'veu de liefhebber',
      'comf.papers': 'Gazette', 'comf.papers_m': 'de dag bijgeproot',
      'comf.foam': 'Warm scheerschoim', 'comf.foam_m': 'de echte scheerbeurt',

      'craft.eyebrow': 'Mêesterschap veurop',
      'craft.title': 'We volge gên trends zomar. We kieze ze — <em>me zorg</em>.',
      'craft.copy': 'Os barbiers — Avraz, Adil, Simar en Bas — zen vakmanne me respect veu hun stiel. Elk brengt zen eige blik, mor allemoal me dezelfde lat: kwaliteit zonder compromis.',

      'prod.eyebrow': 'Spul — 02', 'prod.title': 'Alleen wa werkt',
      'prod.intro': 'We gebruike en verkoêpe e zorgvuldig gekoze selectie — Reuzel, Layrite en klassiek barbierspul. Gekoze veu wa ze doen, ni veu de hype. Eerlijk spul, eerlijk resultaat.',
      'prod.local': 'Lokaal ambacht', 'prod.chair': 'De stoel', 'prod.chair_m': 'Ga zitte & ontspant',

      'foot.masked': 'Komt langs',
      'foot.pitch': 'Boek a momentsje. Komt binne in e plek woe de tij vertroogt en de details tellen.',
      'foot.email': 'a e-mailadres…', 'foot.hours_h': 'Opene',
      'foot.hours': 'Di–Zo · 10:00 – 20:00<br />Mo · geslote<br />Feestdoge · <span class="muted">checkt Instagram</span>',
      'foot.addr_h': 'Adres', 'foot.privacy': 'Privacy', 'foot.terms': 'Voorwoorde'
    },

    /* ------------------------------- ENGLISH ------------------------------ */
    en: {
      'nav.about': 'About', 'nav.services': 'Services', 'nav.products': 'Products',
      'nav.contact': 'Contact', 'nav.book': 'Book now', 'nav.book_arrow': 'Book now →',
      'badge.walkin': 'Walk-ins — always welcome', 'badge.walkin_short': 'Walk-ins welcome',
      'hero.title': '<span class="accent">Quiet</span> class.<br />Timeless craft.',

      'book.eyebrow': 'Reserve', 'book.title': 'Book your chair.', 'book.open': 'Book your chair →',
      'book.lead': 'First your service, then the barber who performs it, then a moment that fits. Step by step — we handle the rest.',
      'book.hours_k': 'Hours', 'book.hours_v': 'Tue–Sun · 10:00–20:00', 'book.place_k': 'Where',
      'book.walkin': '<strong>Walk-ins welcome.</strong> No appointment? Just step in — Tue–Sat, 10:00–20:00.',
      'book.s_service': 'Service', 'book.s_barber': 'Barber', 'book.s_date': 'Date', 'book.s_time': 'Time',
      'svc.knippen': 'Haircut', 'svc.baard': 'Beard', 'svc.combo': 'Cut + Beard', 'svc.kind': 'Child (–12 yrs)',
      'book.barber_note': 'Available for your service:',
      'book.summary_start': 'Choose a service to begin.',
      'book.confirm': 'Confirm booking', 'book.done_h': 'See you soon, kameraad.', 'book.reset': 'New booking',
      'book.no_pref': 'No preference', 'book.no_pref_low': 'no preference',
      'book.at': 'with', 'book.on': 'on', 'book.at_time': 'at',
      'book.choose_more': 'Still choose a', 'book.l_barber': 'barber', 'book.l_date': 'date', 'book.l_time': 'time',
      'book.with': 'with', 'book.your_barber': 'your barber', 'book.confirm_msg': "We'll send you a confirmation.",
      'book.dow': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      'book.mon': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

      'ritual.eyebrow': 'Intro — The Ritual',
      'ritual.heading': 'The last <em>gentlemen\u2019s retreat</em>',
      'ritual.copy1': 'Kameraad Haarsnijder grew out of the idea that there was no such thing as a gentlemen\u2019s retreat. Today it is by far the last retreat for men of all ages. Even those who don\u2019t book a service are always welcome to take a break from everyday life.',
      'ritual.copy2': 'And it doesn\u2019t stop at the chair. Kameraad also rents out its own cargo bikes — the black, the blue and the red — to explore Leuven at your own pace. Step in for a cut, roll back out on two wheels.',

      'comf.eyebrow': 'Among us', 'comf.title': 'The house <em>treats you</em>',
      'comf.lead': 'Sit down, stay a while. A fresh cup of coffee, a finger of whiskey or rum, today\u2019s paper — at Kameraad you\u2019re allowed to slow down, with or without an appointment.',
      'comf.coffee': 'Cup of coffee', 'comf.coffee_m': 'freshly brewed',
      'comf.whiskey': 'Whiskey', 'comf.whiskey_m': 'a finger, neat',
      'comf.rum': 'Rum', 'comf.rum_m': 'for the connoisseur',
      'comf.papers': 'Newspapers', 'comf.papers_m': 'caught up on the day',
      'comf.foam': 'Warm shaving foam', 'comf.foam_m': 'the real shave',

      'craft.eyebrow': 'Craft first',
      'craft.title': 'We don\u2019t follow trends blindly. We choose them — <em>with care</em>.',
      'craft.copy': 'Our barbers — Avraz, Adil, Simar and Bas — are craftsmen with deep respect for the trade. Each brings his own eye, united by one standard: quality without compromise.',

      'prod.eyebrow': 'Products — 02', 'prod.title': 'Only what works',
      'prod.intro': 'We use and sell a carefully curated selection — Reuzel, Layrite and classic barber products. Chosen for performance, not hype. Honest formulas, honest results.',
      'prod.local': 'Local craft', 'prod.chair': 'The chair', 'prod.chair_m': 'Take a seat & relax',

      'foot.masked': 'Drop by',
      'foot.pitch': 'Book your moment. Step into a place where time slows down and details matter.',
      'foot.email': 'your email…', 'foot.hours_h': 'Opening hours',
      'foot.hours': 'Tue–Sun · 10:00 – 20:00<br />Mon · closed<br />Holidays · <span class="muted">check Instagram</span>',
      'foot.addr_h': 'Address', 'foot.privacy': 'Privacy policy', 'foot.terms': 'Terms & conditions'
    },

    /* ------------------------------- FRANÇAIS ----------------------------- */
    fr: {
      'nav.about': 'À propos', 'nav.services': 'Services', 'nav.products': 'Produits',
      'nav.contact': 'Contact', 'nav.book': 'Réserver', 'nav.book_arrow': 'Réserver →',
      'badge.walkin': 'Sans rendez-vous — toujours bienvenu', 'badge.walkin_short': 'Sans rendez-vous',
      'hero.title': '<span class="accent">Classe</span> discrète.<br />Savoir-faire intemporel.',

      'book.eyebrow': 'Réserver', 'book.title': 'Réservez votre fauteuil.', 'book.open': 'Réserver →',
      'book.lead': 'D\u2019abord votre service, puis le barbier qui l\u2019exécute, puis un moment qui vous convient. Étape par étape — on s\u2019occupe du reste.',
      'book.hours_k': 'Heures', 'book.hours_v': 'Mar–Dim · 10:00–20:00', 'book.place_k': 'Lieu',
      'book.walkin': '<strong>Sans rendez-vous, bienvenue.</strong> Pas de rendez-vous ? Entrez simplement — Mar–Sam, 10:00–20:00.',
      'book.s_service': 'Service', 'book.s_barber': 'Barbier', 'book.s_date': 'Date', 'book.s_time': 'Heure',
      'svc.knippen': 'Coupe', 'svc.baard': 'Barbe', 'svc.combo': 'Coupe + Barbe', 'svc.kind': 'Enfant (–12 ans)',
      'book.barber_note': 'Disponible pour votre service :',
      'book.summary_start': 'Choisissez un service pour commencer.',
      'book.confirm': 'Confirmer le rendez-vous', 'book.done_h': 'À bientôt, kameraad.', 'book.reset': 'Nouveau rendez-vous',
      'book.no_pref': 'Sans préférence', 'book.no_pref_low': 'sans préférence',
      'book.at': 'avec', 'book.on': 'le', 'book.at_time': 'à',
      'book.choose_more': 'Choisissez encore', 'book.l_barber': 'un barbier', 'book.l_date': 'une date', 'book.l_time': 'une heure',
      'book.with': 'avec', 'book.your_barber': 'votre barbier', 'book.confirm_msg': 'Nous vous enverrons une confirmation.',
      'book.dow': ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
      'book.mon': ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],

      'ritual.eyebrow': 'Intro — Le Rituel',
      'ritual.heading': 'Le dernier <em>refuge d\u2019hommes</em>',
      'ritual.copy1': 'Kameraad Haarsnijder est né de l\u2019idée qu\u2019un refuge pour hommes n\u2019existait pas. Aujourd\u2019hui, c\u2019est de loin le dernier refuge pour les hommes de tout âge. Même ceux qui ne prennent aucun service sont toujours les bienvenus pour échapper un instant au quotidien.',
      'ritual.copy2': 'Et cela ne s\u2019arrête pas au fauteuil. Kameraad loue aussi ses propres vélos-cargos — le noir, le bleu et le rouge — pour explorer Louvain à votre rythme. Entrez pour une coupe, repartez sur deux roues.',

      'comf.eyebrow': 'Entre nous', 'comf.title': 'La maison <em>vous régale</em>',
      'comf.lead': 'Asseyez-vous, restez un moment. Un café fraîchement préparé, un doigt de whiskey ou de rhum, le journal du jour — chez Kameraad, on a le droit de ralentir, avec ou sans rendez-vous.',
      'comf.coffee': 'Tasse de café', 'comf.coffee_m': 'fraîchement préparé',
      'comf.whiskey': 'Whiskey', 'comf.whiskey_m': 'un doigt, sec',
      'comf.rum': 'Rhum', 'comf.rum_m': 'pour les amateurs',
      'comf.papers': 'Journaux', 'comf.papers_m': 'au fait de l\u2019actu',
      'comf.foam': 'Mousse à raser chaude', 'comf.foam_m': 'le vrai rasage',

      'craft.eyebrow': 'Le métier d\u2019abord',
      'craft.title': 'On ne suit pas les tendances aveuglément. On les choisit — <em>avec soin</em>.',
      'craft.copy': 'Nos barbiers — Avraz, Adil, Simar et Bas — sont des artisans au profond respect du métier. Chacun apporte son regard, unis par une exigence : la qualité sans compromis.',

      'prod.eyebrow': 'Produits — 02', 'prod.title': 'Seulement ce qui marche',
      'prod.intro': 'Nous utilisons et vendons une sélection soigneusement choisie — Reuzel, Layrite et des produits de barbier classiques. Choisis pour leur efficacité, pas pour le buzz. Des formules honnêtes, des résultats honnêtes.',
      'prod.local': 'Artisanat local', 'prod.chair': 'Le fauteuil', 'prod.chair_m': 'Asseyez-vous & détendez-vous',

      'foot.masked': 'Passez nous voir',
      'foot.pitch': 'Réservez votre moment. Entrez dans un lieu où le temps ralentit et où les détails comptent.',
      'foot.email': 'votre e-mail…', 'foot.hours_h': 'Heures d\u2019ouverture',
      'foot.hours': 'Mar–Dim · 10:00 – 20:00<br />Lun · fermé<br />Jours fériés · <span class="muted">voir Instagram</span>',
      'foot.addr_h': 'Adresse', 'foot.privacy': 'Confidentialité', 'foot.terms': 'Conditions générales'
    },

    /* ------------------------------- ESPAÑOL ------------------------------ */
    es: {
      'nav.about': 'Nosotros', 'nav.services': 'Servicios', 'nav.products': 'Productos',
      'nav.contact': 'Contacto', 'nav.book': 'Reservar', 'nav.book_arrow': 'Reservar →',
      'badge.walkin': 'Sin cita — siempre bienvenido', 'badge.walkin_short': 'Sin cita',
      'hero.title': '<span class="accent">Clase</span> serena.<br />Oficio atemporal.',

      'book.eyebrow': 'Reservar', 'book.title': 'Reserva tu silla.', 'book.open': 'Reservar →',
      'book.lead': 'Primero tu servicio, luego el barbero que lo realiza, después un momento que te encaje. Paso a paso — del resto nos encargamos nosotros.',
      'book.hours_k': 'Horario', 'book.hours_v': 'Mar–Dom · 10:00–20:00', 'book.place_k': 'Lugar',
      'book.walkin': '<strong>Sin cita, bienvenido.</strong> ¿Sin cita? Entra sin más — Mar–Sáb, 10:00–20:00.',
      'book.s_service': 'Servicio', 'book.s_barber': 'Barbero', 'book.s_date': 'Fecha', 'book.s_time': 'Hora',
      'svc.knippen': 'Corte', 'svc.baard': 'Barba', 'svc.combo': 'Corte + Barba', 'svc.kind': 'Niño (–12 años)',
      'book.barber_note': 'Disponible para tu servicio:',
      'book.summary_start': 'Elige un servicio para empezar.',
      'book.confirm': 'Confirmar cita', 'book.done_h': 'Hasta pronto, kameraad.', 'book.reset': 'Nueva cita',
      'book.no_pref': 'Sin preferencia', 'book.no_pref_low': 'sin preferencia',
      'book.at': 'con', 'book.on': 'el', 'book.at_time': 'a las',
      'book.choose_more': 'Elige aún', 'book.l_barber': 'un barbero', 'book.l_date': 'una fecha', 'book.l_time': 'una hora',
      'book.with': 'con', 'book.your_barber': 'tu barbero', 'book.confirm_msg': 'Te enviaremos una confirmación.',
      'book.dow': ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      'book.mon': ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],

      'ritual.eyebrow': 'Intro — El Ritual',
      'ritual.heading': 'El último <em>refugio de caballeros</em>',
      'ritual.copy1': 'Kameraad Haarsnijder nació de la idea de que no existía algo así como un refugio de caballeros. Hoy es, con diferencia, el último refugio para hombres de todas las edades. Incluso quien no contrata ningún servicio es siempre bienvenido para tomarse un respiro de la rutina.',
      'ritual.copy2': 'Y no termina en la silla. Kameraad también alquila sus propias bicicletas de carga — la negra, la azul y la roja — para descubrir Lovaina a tu ritmo. Entra para un corte, sal de nuevo sobre dos ruedas.',

      'comf.eyebrow': 'Entre nosotros', 'comf.title': 'La casa <em>invita</em>',
      'comf.lead': 'Siéntate, quédate un rato. Un café recién hecho, un dedo de whiskey o ron, el periódico de hoy — en Kameraad puedes ir más despacio, con o sin cita.',
      'comf.coffee': 'Taza de café', 'comf.coffee_m': 'recién hecho',
      'comf.whiskey': 'Whiskey', 'comf.whiskey_m': 'un dedo, solo',
      'comf.rum': 'Ron', 'comf.rum_m': 'para el aficionado',
      'comf.papers': 'Periódicos', 'comf.papers_m': 'al día con la actualidad',
      'comf.foam': 'Espuma de afeitar caliente', 'comf.foam_m': 'el afeitado de verdad',

      'craft.eyebrow': 'El oficio primero',
      'craft.title': 'No seguimos las tendencias a ciegas. Las elegimos — <em>con cuidado</em>.',
      'craft.copy': 'Nuestros barberos — Avraz, Adil, Simar y Bas — son artesanos con profundo respeto por el oficio. Cada uno aporta su mirada, unidos por un mismo criterio: calidad sin concesiones.',

      'prod.eyebrow': 'Productos — 02', 'prod.title': 'Solo lo que funciona',
      'prod.intro': 'Usamos y vendemos una selección cuidada — Reuzel, Layrite y productos clásicos de barbería. Elegidos por su rendimiento, no por la moda. Fórmulas honestas, resultados honestos.',
      'prod.local': 'Oficio local', 'prod.chair': 'La silla', 'prod.chair_m': 'Toma asiento y relájate',

      'foot.masked': 'Pásate',
      'foot.pitch': 'Reserva tu momento. Entra en un lugar donde el tiempo se ralentiza y los detalles importan.',
      'foot.email': 'tu correo…', 'foot.hours_h': 'Horario',
      'foot.hours': 'Mar–Dom · 10:00 – 20:00<br />Lun · cerrado<br />Festivos · <span class="muted">ver Instagram</span>',
      'foot.addr_h': 'Dirección', 'foot.privacy': 'Privacidad', 'foot.terms': 'Términos y condiciones'
    }
  };

  var LABELS = { leuvens: 'LEU', nl: 'NL', en: 'EN', fr: 'FR', es: 'ES' };
  var SUPPORTED = ['leuvens', 'nl', 'en', 'fr', 'es'];
  var subscribers = [];

  function detect() {
    try {
      var saved = localStorage.getItem('kh_lang');
      if (saved && DICT[saved]) return saved;
    } catch (e) {}
    return 'nl';
  }

  var KH = {
    lang: detect(),
    t: function (key) {
      var d = DICT[this.lang] || DICT.nl;
      var v = d[key];
      if (v == null) v = DICT.nl[key];
      return v == null ? key : v;
    },
    list: function (key) {
      var v = this.t(key);
      return Array.isArray(v) ? v : [];
    },
    onChange: function (fn) { subscribers.push(fn); },
    applyStatic: function () {
      var self = this;
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = self.t(el.getAttribute('data-i18n'));
      });
      document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
        el.innerHTML = self.t(el.getAttribute('data-i18n-html'));
      });
      document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
        el.setAttribute('placeholder', self.t(el.getAttribute('data-i18n-ph')));
      });
      document.documentElement.setAttribute('lang', this.lang === 'leuvens' ? 'nl' : this.lang);
      var cur = document.getElementById('langCur');
      if (cur) cur.textContent = LABELS[this.lang] || this.lang.toUpperCase();
      var menu = document.getElementById('langMenu');
      if (menu) menu.querySelectorAll('[data-lang]').forEach(function (li) {
        li.setAttribute('aria-selected', li.getAttribute('data-lang') === self.lang ? 'true' : 'false');
      });
    },
    setLang: function (code) {
      if (!DICT[code]) return;
      this.lang = code;
      try { localStorage.setItem('kh_lang', code); } catch (e) {}
      this.applyStatic();
      subscribers.forEach(function (fn) { try { fn(code); } catch (e) {} });
    },
    supported: SUPPORTED
  };

  window.KH = KH;

  // Wire the dock switcher + apply on load.
  function init() {
    KH.applyStatic();
    var btn = document.getElementById('langBtn');
    var menu = document.getElementById('langMenu');
    if (btn && menu) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menu.hidden;
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', function (e) {
        var li = e.target.closest('[data-lang]'); if (!li) return;
        KH.setLang(li.getAttribute('data-lang'));
        menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('click', function () {
        if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
