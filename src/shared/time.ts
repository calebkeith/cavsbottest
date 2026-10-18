const easternOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'shortOffset',
});

export const parseEasternTime = (value: string) => {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!match) return new Date(value);

  const [, year, month, day, hour = '00', minute = '00', second = '00', milliseconds = '0'] = match;
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(milliseconds.padEnd(3, '0')),
  );
  const offset = easternOffset.formatToParts(new Date(wallClock)).find((part) => part.type === 'timeZoneName')?.value;
  const offsetMatch = offset?.match(/^GMT(?:(-|\+)(\d{1,2})(?::(\d{2}))?)?$/);
  const offsetMinutes = offsetMatch?.[1] === '-'
    ? -(Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] ?? 0))
    : Number(offsetMatch?.[2] ?? 0) * 60 + Number(offsetMatch?.[3] ?? 0);

  return new Date(wallClock - offsetMinutes * 60_000);
};
