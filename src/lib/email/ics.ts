const CRLF = '\r\n'
const LOCATION = 'Parijsstraat 29, 3000 Leuven, België'
const ORGANIZER_EMAIL = 'afspraak@kameraadhaarsnijder.be'
const ORGANIZER_NAME = 'Kameraad Haarsnijder'

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

// RFC 5545 §3.1: fold lines exceeding 75 octets with CRLF + single space
function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line
  const segments: string[] = []
  let pos = 0
  let first = true
  while (pos < line.length) {
    const maxBytes = first ? 75 : 74
    let end = pos
    let bytes = 0
    while (end < line.length) {
      const cp = line.codePointAt(end)!
      const ch = String.fromCodePoint(cp)
      const chBytes = Buffer.byteLength(ch, 'utf8')
      if (bytes + chBytes > maxBytes) break
      bytes += chBytes
      end += ch.length
    }
    if (end === pos) end = pos + 1
    segments.push(line.slice(pos, end))
    pos = end
    first = false
  }
  return segments.join(CRLF + ' ')
}

function toIcsDateTime(isoString: string): string {
  const date = new Date(isoString)
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value
  const hour = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}${g('month')}${g('day')}T${hour}${g('minute')}${g('second')}`
}

const VTIMEZONE_LINES = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Brussels',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
]

export interface BuildIcsParams {
  method: 'REQUEST' | 'CANCEL'
  sequence: number
  uid: string
  summary: string
  dtstart: string
  dtend: string
}

export function buildIcs(params: BuildIcsParams): string {
  const { method, sequence, uid, summary, dtstart, dtend } = params

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kameraad Haarsnijder//Booking//NL',
    `METHOD:${method}`,
    ...VTIMEZONE_LINES,
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}@kameraadhaarsnijder.be`),
    `SEQUENCE:${sequence}`,
    foldLine(`DTSTART;TZID=Europe/Brussels:${toIcsDateTime(dtstart)}`),
    foldLine(`DTEND;TZID=Europe/Brussels:${toIcsDateTime(dtend)}`),
    foldLine(`SUMMARY:${escapeIcs(summary)}`),
    foldLine(`LOCATION:${escapeIcs(LOCATION)}`),
    foldLine(`ORGANIZER;CN="${ORGANIZER_NAME}":mailto:${ORGANIZER_EMAIL}`),
    ...(method === 'CANCEL' ? ['STATUS:CANCELLED'] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join(CRLF) + CRLF
}
