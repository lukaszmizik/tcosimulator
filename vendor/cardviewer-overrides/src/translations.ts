import { createContext, useContext, useState, createElement, type ReactNode } from 'react'

export type WorkWeekTranslations = {
  dayNames: [string, string, string, string, string, string, string]
  activityLabels: Record<string, string>
  activityTypes: Record<string, string>
  lastWithdrawal: string
  manualEntries: string
  places: string
  loadUnload: string
  none: string
  close: string
  resetLoadUnload: string
  noData: string
  weekGraphTitle: string
  prevWeek: string
  nextWeek: string
  card1: string
  card2: string
  manualEntryLabel: string
  resetLoadUnloadTitle: string
  warningsPanelTitle: string
  workShiftDuration: string
  workShiftRest: string
  recordedLocationsTitle: string
  manualRecordsTitle: string
  tachographRecordsTitle: string
  lastWithdrawalLabel: string
  lastWithdrawalInfo: string
  manualDataLabel: string
  shiftMarkerLabel: string
  loadUnloadSection: string
  ferryTrainSection: string
  outModeSection: string
  activation: string
  deactivation: string
  outModeStartMark: string
  outModeEndMark: string
  outModeLegendLine: string
  legendRest45h: string
  legendRest24h: string
  shiftSumLabel: string
  shiftSumRestPlaceholder: string
  shiftLengthLabel: string
  faultDrivingWithoutCard: string
  faultDrivingWithoutValidCard: string
  faultExcessSpeed: string
  recordedLocationTypes: Record<string, string>
  monthNames: [string, string, string, string, string, string, string, string, string, string, string, string]
  crewMode: string
  mostKmPerDay: string
  km: string
  openDay: string
  backToWeek: string
  previousDay: string
  nextDay: string
  swipeDay: string
  swipeWeek: string
  today: string
  todayTitle: string
  wholeCard: string
  shownInUtc: string
  shownInLocal: string
  graphTools: string
  showDetail: string
  showDetailTitle: string
  showShifts: string
  slotMarker: string
  registrationMark: string
  openInMaps: string
  openLocationInMaps: string
  drivingAssessment: string
  limit56h: string
  limit90h: string
  decisiveRests: string
  noCompensationDue: string
  timeScale: string
  timeScaleAria: string
  localTime: string
  noWeekRecord: string
  vehicleHistory: string
  vehicle: string
  from: string
  to: string
  traveledKm: string
  registrationCountry: string
  vinLabel: string
  odometerCounter: string
  events: string
  faults: string
  kind: string
  enteredLoads: string
  date: string
  odometer: string
  location: string
  loadNoun: string
  unloadNoun: string
  loadAndUnload: string
  driverCard: string
  driverCardTitle: string
  signature: string
  preferredLanguage: string
  issueDate: string
  licenceIssuedBy: string
  licenceCountry: string
  lastDownload: string
  cardCalendar: string
  calendarHint: string
  openWeekFrom: string
  timeScrub: string
  outMode: string
  vehicleWord: string
  deactivationMissing: string
  manualRecord: string
  hourUnit: string
  minuteUnit: string
  languageNames: Record<string, string>
  dayDriving: DayDrivingText
  weeklyDriving: WeeklyDrivingText
  fortnightDriving: FortnightDrivingText
  weeklyRest: WeeklyRestText
}

export type DayDrivingText = {
  safetyBreaks: string
  breakResult: string
  longestBetweenBreaks: string
  unreliable: string
  limit430Exceeded: string
  crewBreak: string
  crewDetail: string
  within430: string
  cycleOpen: string
  periodLabel: string
  unknownPeriod: string
  variantsDiffer: string
  unknownSpan: string
  fromTime: string
  soFarOpen: string
  regular: string
  extended: string
  exceeded: string
  upTo9h: string
  over9to10: string
  over10h: string
}

export type WeeklyDrivingText = {
  title: string
  overNote: string
  openNote: string
  fillNote: string
  limitValue: string
}

export type FortnightDrivingText = {
  title: string
  progressNote: string
  openNote: string
  over90: string
  cannotConfirm: string
  within90: string
  runningTotal: string
  incomplete: string
  limitValue: string
  weeksJoiner: string
}

export type WeeklyRestText = {
  title: string
  basisText: string
  historyNote: string
  emptyRests: string
  snapshotTitle: string
  snapshotNote: string
  snapshotEmpty: string
  outlookTitle: string
  noOutlook: string
  regular: string
  reduced: string
  noCompensation: string
  uncertainResult: string
  assignWeek: string
  weekJoiner: string
  compensationUndated: string
  compensationUntil: string
  localTimeHint: string
  takenLine: string
  reducedSummary: string
  remaining: string
  nearestDeadline: string
  attachment: string
  combination: string
  caution: string
  statusTaken: string
  statusOpen: string
  statusMissed: string
  statusUndecided: string
  recordIncomplete: string
  alternativeOutcomes: string
  obligationNotUnique: string
}

export type ViewerTranslations = {
  workWeek: WorkWeekTranslations
  manualEntry: {
    load: string
    unload: string
    loadUnload: string
  }
}

export const cs: ViewerTranslations = {
  workWeek: {
    dayNames: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
    activityLabels: {
      REST: 'odpočinek',
      WORK: 'práce',
      AVAILABILITY: 'pohotovost',
      DRIVING: 'řízení',
      UNKNOWN: 'neznámá činnost',
      START_COUNTRY: 'výchozí země',
      END_COUNTRY: 'cílová země',
    },
    activityTypes: {
      řízení: 'řízení',
      práce: 'práce',
      pohotovost: 'pohotovost',
      odpočinek: 'odpočinek',
      'odpočinek>24h': 'odpoč. 24h–45h',
      'odpočinek>45h': 'odpoč. ≥45h',
      neznámá: 'neznámá',
    },
    lastWithdrawal: 'Poslední vytažení',
    manualEntries: 'Manuální záznamy',
    places: 'Místa',
    loadUnload: 'nakládka/vykládka',
    none: 'žádné',
    close: 'Zavřít',
    resetLoadUnload: 'Reset nakládky/vykládky',
    noData: 'Žádná data k zobrazení',
    weekGraphTitle: 'Graf pracovního týdne',
    prevWeek: 'Předchozí týden',
    nextWeek: 'Následující týden',
    card1: 'Karta 1',
    card2: 'Karta 2',
    manualEntryLabel: 'manuální zadání',
    resetLoadUnloadTitle: 'Resetovat nakládky/vykládky',
    warningsPanelTitle: 'Výstrahy v paměti tachografu',
    workShiftDuration: 'Délka pracovní směny',
    workShiftRest: 'Odpočinek',
    recordedLocationsTitle: 'Zaznamenané lokace',
    manualRecordsTitle: 'Manuální záznamy',
    tachographRecordsTitle: 'Záznamy tachografu',
    lastWithdrawalLabel: 'Poslední vyjmutí:',
    lastWithdrawalInfo: 'Poslední vyjmutí',
    manualDataLabel: 'Manuálně zadaná data:',
    shiftMarkerLabel: '(značka směny)',
    loadUnloadSection: 'Nakládky/vykládky:',
    ferryTrainSection: 'Režim trajekt:',
    outModeSection: 'Režim OUT:',
    activation: 'aktivace',
    deactivation: 'deaktivace',
    outModeStartMark: 'out začátek',
    outModeEndMark: 'out konec',
    outModeLegendLine: 'režim OUT',
    legendRest45h: '≥ 45h',
    legendRest24h: '24h - 44h 59m',
    shiftSumLabel: 'Součet aktivit v probíhající směně:',
    shiftSumRestPlaceholder: '----',
    shiftLengthLabel: 'Délka aktuální směny:',
    faultDrivingWithoutCard: 'Jízda bez karty',
    faultDrivingWithoutValidCard: 'Jízda bez platné karty',
    faultExcessSpeed: '(39)(39) Příliš vysoká rychlost',
    recordedLocationTypes: {
      gps_3h: 'automatická detekce každé 3h',
      start_country: 'výchozí země',
      end_country: 'cílová země',
      end_country_card: 'cílová země (vytažení karty)',
      load: 'nakládka',
      unload: 'vykládka',
      load_unload: 'nakládka/vykládka',
      border_crossing: 'průjezd hranic',
    },
    monthNames: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
    crewMode: 'režim osádky',
    mostKmPerDay: 'Nejvíce km/den:',
    km: 'km',
    openDay: 'Otevřít den {date}',
    backToWeek: '← Zpět na týden',
    previousDay: '‹ Předchozí den',
    nextDay: 'Následující den ›',
    swipeDay: 'Přejeďte do stran na jiný den',
    swipeWeek: 'Přejeďte do stran na jiný týden',
    today: 'Dnes',
    todayTitle: 'Přejít na aktuální týden',
    wholeCard: 'Celý obsah karty',
    shownInUtc: 'Graf zobrazen v UTC',
    shownInLocal: 'Graf zobrazen v místním čase',
    graphTools: 'Nástroje grafu',
    showDetail: 'Zobrazit detail',
    showDetailTitle: 'Zobrazit druh aktivity a trvání nad segmentem',
    showShifts: 'Zobrazit směny',
    slotMarker: ' | slot {slot}',
    registrationMark: ' | RZ {plate}',
    openInMaps: 'Otevřít v Google Maps',
    openLocationInMaps: 'Otevřít lokaci {place} v Google Maps',
    drivingAssessment: 'Hodnocení řízení',
    limit56h: 'Limit 56 h',
    limit90h: 'Limit 90 h',
    decisiveRests: 'Rozhodné odpočinky',
    noCompensationDue: 'K závěru týdne nezbývá náhrada s určeným termínem.',
    timeScale: 'Časová osa',
    timeScaleAria: 'Zobrazení času v grafu',
    localTime: 'Místní čas',
    noWeekRecord: 'V tomto týdnu žádný záznam',
    vehicleHistory: 'Historie použitých vozidel',
    vehicle: 'Vozidlo',
    from: 'Od',
    to: 'Do',
    traveledKm: 'Najel km',
    registrationCountry: 'Stát registrace {value}',
    vinLabel: 'VIN {value}',
    odometerCounter: 'Počítadlo {from} – {to}',
    events: 'Události',
    faults: 'Závady',
    kind: 'Typ',
    enteredLoads: 'Zadané nakládky a vykládky',
    date: 'Datum',
    odometer: 'Stav km',
    location: 'Lokace',
    loadNoun: 'Nakládka',
    unloadNoun: 'Vykládka',
    loadAndUnload: 'Nakládka a vykládka',
    driverCard: 'Karta řidiče',
    driverCardTitle: 'KARTA ŘIDIČE',
    signature: 'Podpis',
    preferredLanguage: 'Preferovaný jazyk',
    issueDate: 'Datum vydání',
    licenceIssuedBy: 'Průkaz vydal',
    licenceCountry: 'Stát průkazu',
    lastDownload: 'Poslední stažení',
    cardCalendar: 'Kalendář záznamů karty',
    calendarHint: 'Zelený kroužek označuje den s řízením. Klepněte na řádek týdne.',
    openWeekFrom: 'Otevřít týden od {day}.',
    timeScrub: 'Posun v čase',
    outMode: 'režim OUT',
    vehicleWord: 'vozidlo',
    deactivationMissing: 'deaktivace nezaznamenána',
    manualRecord: 'manuální záznam',
    hourUnit: 'h',
    minuteUnit: 'min',
    languageNames: {
      bg: 'bulharština', cs: 'čeština', da: 'dánština', de: 'němčina', el: 'řečtina', en: 'angličtina', es: 'španělština', et: 'estonština', fi: 'finština', fr: 'francouzština', hr: 'chorvatština', hu: 'maďarština', it: 'italština', lt: 'litevština', lv: 'lotyština', nl: 'nizozemština', pl: 'polština', pt: 'portugalština', ro: 'rumunština', sk: 'slovenština', sl: 'slovinština', sv: 'švédština',
    },
    dayDriving: {
      safetyBreaks: 'Bezpečnostní přestávky',
      breakResult: 'Výsledek přestávek v řízení',
      longestBetweenBreaks: 'Nejdelší úsek řízení mezi přestávkami',
      unreliable: 'Nelze spolehlivě vyhodnotit.',
      limit430Exceeded: 'Limit 4 h 30 min překročen.',
      crewBreak: 'Podmíněně uznáno',
      crewDetail: 'Přestávka je uznatelná za předpokladu, že vozidlo řídil druhý řidič a odpočívající řidič mu během této doby nepomáhal při řízení.',
      within430: 'V limitu 4 h 30 min.',
      cycleOpen: 'Cyklus řízení není uzavřen.',
      periodLabel: 'Doba řízení v pracovním období',
      unknownPeriod: 'Nelze určit',
      variantsDiffer: 'Varianty nemají stejnou délkovou kategorii. {lines}.',
      unknownSpan: 'Přesný rozsah součtů nelze určit, protože některá varianta obsahuje neznámý úsek.',
      fromTime: 'od {time}',
      soFarOpen: '{range}. Dosavadní stav. Období není uzavřeno.',
      regular: 'Běžná',
      extended: 'Prodloužená',
      exceeded: 'Překročení',
      upTo9h: 'do 9 h včetně',
      over9to10: 'nad 9 h a do 10 h včetně',
      over10h: 'nad 10 h',
    },
    weeklyDriving: {
      title: 'Týdenní doba řízení',
      overNote: 'Překročení limitu 56 h.',
      openNote: 'Součet nemusí být konečný.',
      fillNote: 'Ukazatel vyjadřuje jen podíl vůči limitu 56 h.',
      limitValue: '{duration} / 56 h',
    },
    fortnightDriving: {
      title: 'Doba řízení za dva po sobě jdoucí týdny',
      progressNote: 'Průběžný součet do konce vybraného dne. Období dvou týdnů není uzavřeno.',
      openNote: 'Součet nemusí být konečný.',
      over90: 'Překročení limitu 90 h.',
      cannotConfirm: 'Dodržení limitu nelze potvrdit.',
      within90: 'V limitu 90 h.',
      runningTotal: 'Průběžný součet.',
      incomplete: 'Údaj není úplný.',
      limitValue: '{duration} / 90 h',
      weeksJoiner: 'a',
    },
    weeklyRest: {
      title: 'Týdenní odpočinky a náhrady',
      basisText: 'Týden a termín náhrady se počítají od pondělí 00:00 UTC. Časy odpočinku jsou ve stejném režimu jako graf.',
      historyNote: 'Splnění náhrady se posuzuje z celého dostupného záznamu, včetně doby po tomto týdnu.',
      emptyRests: 'V tomto týdnu není rozhodný týdenní odpočinek.',
      snapshotTitle: 'Stav k závěru vybraného týdne',
      snapshotNote: 'Jen údaje dostupné do {time}. Pozdější záznam se sem nepočítá.',
      snapshotEmpty: 'K závěru týdne není evidovaná náhrada.',
      outlookTitle: 'Orientačně k vybranému okamžiku',
      noOutlook: 'K závěru týdne nezbývá náhrada s určeným termínem.',
      regular: 'Běžný',
      reduced: 'Zkrácený',
      noCompensation: 'Náhrada nevzniká.',
      uncertainResult: 'Výsledek není jednoznačný.',
      assignWeek: 'Lze přiřadit k týdnu od {weeks} UTC, jen k jednomu z nich.',
      weekJoiner: ' nebo od ',
      compensationUndated: 'Náhrada {duration}. Termín není jednoznačný.',
      compensationUntil: 'Náhrada {duration} do {deadline}.',
      localTimeHint: '{utc} ({local} místního času)',
      takenLine: 'Čerpání {duration}, {range}',
      reducedSummary: 'Zkrácený {duration}, {range}',
      remaining: 'K závěru týdne zbývá nahradit {duration}.',
      nearestDeadline: 'Nejbližší termín je {deadline}.',
      attachment: 'Náhradu lze připojit k jinému odpočinku nejméně 9 hodin.',
      combination: 'Hostitelský odpočinek 9 h a náhrada {compensation} vycházejí orientačně na {total}.',
      caution: 'Tento součet nepotvrzuje, že je konkrétní navazující odpočinek právně přípustný.',
      statusTaken: 'Splněno (taken)',
      statusOpen: 'Otevřeno (open)',
      statusMissed: 'Nesplněno v termínu (missed)',
      statusUndecided: 'Nelze rozhodnout (undecided)',
      recordIncomplete: 'Záznam do termínu není úplný. Splnění ani nesplnění z něj nevyplývá.',
      alternativeOutcomes: 'Je více přípustných rozdělení a nemají stejný výsledek.',
      obligationNotUnique: 'Týden odpočinku není jednoznačný, proto není jediný termín.',
    },
  },
  manualEntry: {
    load: 'nakládka',
    unload: 'vykládka',
    loadUnload: 'nakládka/vykládka',
  },
}

export const ru: ViewerTranslations = {
  workWeek: {
    dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    activityLabels: {
      REST: 'отдых',
      WORK: 'работа',
      AVAILABILITY: 'готовность',
      DRIVING: 'управление',
      UNKNOWN: 'неизвестная деятельность',
      START_COUNTRY: 'страна начала',
      END_COUNTRY: 'страна окончания',
    },
    activityTypes: {
      řízení: 'управление',
      práce: 'работа',
      pohotovost: 'готовность',
      odpočinek: 'отдых',
      'odpočinek>24h': 'отдых 24–45 ч',
      'odpočinek>45h': 'отдых ≥45 ч',
      neznámá: 'неизвестная',
    },
    lastWithdrawal: 'Последнее извлечение',
    manualEntries: 'Ручные записи',
    places: 'Места',
    loadUnload: 'погрузка/разгрузка',
    none: 'нет',
    close: 'Закрыть',
    resetLoadUnload: 'Сбросить погрузку/разгрузку',
    noData: 'Нет данных для отображения',
    weekGraphTitle: 'График рабочей недели',
    prevWeek: 'Предыдущая неделя',
    nextWeek: 'Следующая неделя',
    card1: 'Карта 1',
    card2: 'Карта 2',
    manualEntryLabel: 'ручной ввод',
    resetLoadUnloadTitle: 'Сбросить погрузки и разгрузки',
    warningsPanelTitle: 'Предупреждения в памяти тахографа',
    workShiftDuration: 'Длительность рабочей смены',
    workShiftRest: 'Отдых',
    recordedLocationsTitle: 'Записанные местоположения',
    manualRecordsTitle: 'Ручные записи',
    tachographRecordsTitle: 'Записи тахографа',
    lastWithdrawalLabel: 'Последнее извлечение:',
    lastWithdrawalInfo: 'Последнее извлечение',
    manualDataLabel: 'Данные, введенные вручную:',
    shiftMarkerLabel: '(отметка смены)',
    loadUnloadSection: 'Погрузки/разгрузки:',
    ferryTrainSection: 'Режим парома:',
    outModeSection: 'Режим OUT:',
    activation: 'включение',
    deactivation: 'выключение',
    outModeStartMark: 'начало OUT',
    outModeEndMark: 'конец OUT',
    outModeLegendLine: 'режим OUT',
    legendRest45h: '≥ 45 ч',
    legendRest24h: '24 ч – 44 ч 59 мин',
    shiftSumLabel: 'Сумма активностей текущей смены:',
    shiftSumRestPlaceholder: '----',
    shiftLengthLabel: 'Длительность текущей смены:',
    faultDrivingWithoutCard: 'Вождение без карты',
    faultDrivingWithoutValidCard: 'Вождение без действительной карты',
    faultExcessSpeed: '(39)(39) Слишком высокая скорость',
    recordedLocationTypes: {
      gps_3h: 'автоматическое определение каждые 3 ч',
      start_country: 'страна начала',
      end_country: 'страна окончания',
      end_country_card: 'страна окончания (извлечение карты)',
      load: 'погрузка',
      unload: 'разгрузка',
      load_unload: 'погрузка/разгрузка',
      border_crossing: 'пересечение границы',
    },
    monthNames: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    crewMode: 'режим экипажа',
    mostKmPerDay: 'Больше всего км/день:',
    km: 'км',
    openDay: 'Открыть день {date}',
    backToWeek: '← Назад к неделе',
    previousDay: '‹ Предыдущий день',
    nextDay: 'Следующий день ›',
    swipeDay: 'Проведите в сторону, чтобы сменить день',
    swipeWeek: 'Проведите в сторону, чтобы сменить неделю',
    today: 'Сегодня',
    todayTitle: 'Перейти к текущей неделе',
    wholeCard: 'Все содержимое карты',
    shownInUtc: 'График показан в UTC',
    shownInLocal: 'График показан в местном времени',
    graphTools: 'Инструменты графика',
    showDetail: 'Показать подробности',
    showDetailTitle: 'Показать вид активности и длительность над отрезком',
    showShifts: 'Показать смены',
    slotMarker: ' | слот {slot}',
    registrationMark: ' | номер {plate}',
    openInMaps: 'Открыть в Google Maps',
    openLocationInMaps: 'Открыть место {place} в Google Maps',
    drivingAssessment: 'Оценка вождения',
    limit56h: 'Предел 56 ч',
    limit90h: 'Предел 90 ч',
    decisiveRests: 'Определяющие отдыхи',
    noCompensationDue: 'К концу недели не осталось компенсации с назначенным сроком.',
    timeScale: 'Шкала времени',
    timeScaleAria: 'Отображение времени на графике',
    localTime: 'Местное время',
    noWeekRecord: 'На этой неделе нет записей',
    vehicleHistory: 'История использованных транспортных средств',
    vehicle: 'Транспорт',
    from: 'С',
    to: 'По',
    traveledKm: 'Пробег, км',
    registrationCountry: 'Страна регистрации {value}',
    vinLabel: 'VIN {value}',
    odometerCounter: 'Одометр {from} – {to}',
    events: 'События',
    faults: 'Неисправности',
    kind: 'Тип',
    enteredLoads: 'Введенные погрузки и разгрузки',
    date: 'Дата',
    odometer: 'Пробег',
    location: 'Место',
    loadNoun: 'Погрузка',
    unloadNoun: 'Разгрузка',
    loadAndUnload: 'Погрузка и разгрузка',
    driverCard: 'Карта водителя',
    driverCardTitle: 'КАРТА ВОДИТЕЛЯ',
    signature: 'Подпись',
    preferredLanguage: 'Предпочитаемый язык',
    issueDate: 'Дата выдачи',
    licenceIssuedBy: 'Удостоверение выдано',
    licenceCountry: 'Страна удостоверения',
    lastDownload: 'Последняя загрузка',
    cardCalendar: 'Календарь записей карты',
    calendarHint: 'Зеленый кружок отмечает день с вождением. Нажмите на строку недели.',
    openWeekFrom: 'Открыть неделю с {day}.',
    timeScrub: 'Сдвиг по времени',
    outMode: 'режим OUT',
    vehicleWord: 'транспорт',
    deactivationMissing: 'выключение не записано',
    manualRecord: 'ручная запись',
    hourUnit: 'ч',
    minuteUnit: 'мин',
    languageNames: {
      bg: 'болгарский', cs: 'чешский', da: 'датский', de: 'немецкий', el: 'греческий', en: 'английский', es: 'испанский', et: 'эстонский', fi: 'финский', fr: 'французский', hr: 'хорватский', hu: 'венгерский', it: 'итальянский', lt: 'литовский', lv: 'латышский', nl: 'нидерландский', pl: 'польский', pt: 'португальский', ro: 'румынский', sk: 'словацкий', sl: 'словенский', sv: 'шведский',
    },
    dayDriving: {
      safetyBreaks: 'Перерывы для безопасности',
      breakResult: 'Результат перерывов в вождении',
      longestBetweenBreaks: 'Самый длинный отрезок вождения между перерывами',
      unreliable: 'Нельзя надежно оценить.',
      limit430Exceeded: 'Предел 4 ч 30 мин превышен.',
      crewBreak: 'Учтено условно',
      crewDetail: 'Перерыв можно учесть, если транспортным средством управлял второй водитель, а отдыхающий водитель в это время не помогал ему с управлением.',
      within430: 'В пределах 4 ч 30 мин.',
      cycleOpen: 'Цикл вождения не закрыт.',
      periodLabel: 'Время вождения в рабочем периоде',
      unknownPeriod: 'Нельзя определить',
      variantsDiffer: 'Варианты относятся к разным категориям длительности. {lines}.',
      unknownSpan: 'Точный диапазон сумм нельзя определить, потому что один из вариантов содержит неизвестный отрезок.',
      fromTime: 'с {time}',
      soFarOpen: '{range}. Текущее состояние. Период не закрыт.',
      regular: 'Обычная',
      extended: 'Продленная',
      exceeded: 'Превышение',
      upTo9h: 'до 9 ч включительно',
      over9to10: 'более 9 ч и до 10 ч включительно',
      over10h: 'более 10 ч',
    },
    weeklyDriving: {
      title: 'Недельное время вождения',
      overNote: 'Превышение предела 56 ч.',
      openNote: 'Сумма может быть не окончательной.',
      fillNote: 'Индикатор показывает только долю относительно предела 56 ч.',
      limitValue: '{duration} / 56 ч',
    },
    fortnightDriving: {
      title: 'Время вождения за две последовательные недели',
      progressNote: 'Промежуточная сумма до конца выбранного дня. Двухнедельный период не закрыт.',
      openNote: 'Сумма может быть не окончательной.',
      over90: 'Превышение предела 90 ч.',
      cannotConfirm: 'Соблюдение предела нельзя подтвердить.',
      within90: 'В пределах 90 ч.',
      runningTotal: 'Промежуточная сумма.',
      incomplete: 'Данные неполные.',
      limitValue: '{duration} / 90 ч',
      weeksJoiner: 'и',
    },
    weeklyRest: {
      title: 'Недельные отдыхи и компенсации',
      basisText: 'Неделя и срок компенсации считаются от понедельника 00:00 UTC. Время отдыха показано в том же режиме, что и график.',
      historyNote: 'Выполнение компенсации оценивается по всей доступной записи, включая время после этой недели.',
      emptyRests: 'На этой неделе нет определяющего недельного отдыха.',
      snapshotTitle: 'Состояние к концу выбранной недели',
      snapshotNote: 'Только данные, доступные до {time}. Более поздняя запись сюда не входит.',
      snapshotEmpty: 'К концу недели компенсация не числится.',
      outlookTitle: 'Ориентировочно к выбранному моменту',
      noOutlook: 'К концу недели не осталось компенсации с назначенным сроком.',
      regular: 'Обычный',
      reduced: 'Сокращенный',
      noCompensation: 'Компенсация не возникает.',
      uncertainResult: 'Результат неоднозначен.',
      assignWeek: 'Можно отнести к неделе с {weeks} UTC, только к одной из них.',
      weekJoiner: ' или с ',
      compensationUndated: 'Компенсация {duration}. Срок неоднозначен.',
      compensationUntil: 'Компенсация {duration} до {deadline}.',
      localTimeHint: '{utc} ({local} местного времени)',
      takenLine: 'Использование {duration}, {range}',
      reducedSummary: 'Сокращенный {duration}, {range}',
      remaining: 'К концу недели остается компенсировать {duration}.',
      nearestDeadline: 'Ближайший срок: {deadline}.',
      attachment: 'Компенсацию можно присоединить к другому отдыху не менее 9 часов.',
      combination: 'Отдых 9 ч и компенсация {compensation} ориентировочно дают {total}.',
      caution: 'Эта сумма не подтверждает, что конкретный следующий отдых юридически допустим.',
      statusTaken: 'Выполнено (taken)',
      statusOpen: 'Открыто (open)',
      statusMissed: 'Не выполнено в срок (missed)',
      statusUndecided: 'Нельзя решить (undecided)',
      recordIncomplete: 'Запись до срока неполна. Из нее не следует ни выполнение, ни невыполнение.',
      alternativeOutcomes: 'Есть несколько допустимых распределений, и результат у них разный.',
      obligationNotUnique: 'Неделя отдыха неоднозначна, поэтому нет единственного срока.',
    },
  },
  manualEntry: {
    load: 'погрузка',
    unload: 'разгрузка',
    loadUnload: 'погрузка/разгрузка',
  },
}

export type ViewerLanguage = 'cs' | 'ru'

export const VIEWER_TRANSLATIONS: Record<ViewerLanguage, ViewerTranslations> = { cs, ru }

export function viewerLocale(language: ViewerLanguage): string {
  return language === 'ru' ? 'ru-RU' : 'cs-CZ'
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

export function formatDuration(durationMs: number, hourUnit: string, minuteUnit: string): string {
  const total = Math.max(0, Math.round(durationMs / 60_000))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} ${minuteUnit}`
  if (minutes === 0) return `${hours} ${hourUnit}`
  return `${hours} ${hourUnit} ${minutes} ${minuteUnit}`
}

type LanguageContextValue = {
  language: ViewerLanguage
  setLanguage: (language: ViewerLanguage) => void
  locale: string
  t: ViewerTranslations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children, language: controlledLanguage }: { children: ReactNode, language?: ViewerLanguage }) {
  const [ownLanguage, setLanguage] = useState<ViewerLanguage>('cs')
  const language = controlledLanguage ?? ownLanguage
  const value = {
    language,
    setLanguage,
    locale: viewerLocale(language),
    t: VIEWER_TRANSLATIONS[language],
  }
  return createElement(LanguageContext.Provider, { value }, children)
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
