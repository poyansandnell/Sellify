export const ISO_COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const currencyByCountry: Record<string, string> = {
  AU: "AUD", BR: "BRL", CA: "CAD", CH: "CHF", CN: "CNY", CZ: "CZK",
  DK: "DKK", GB: "GBP", HK: "HKD", HU: "HUF", ID: "IDR", IL: "ILS",
  IN: "INR", IS: "ISK", JP: "JPY", KR: "KRW", MX: "MXN", MY: "MYR",
  NO: "NOK", NZ: "NZD", PH: "PHP", PL: "PLN", RO: "RON", RU: "RUB",
  SE: "SEK", SG: "SGD", TH: "THB", TR: "TRY", TW: "TWD", UA: "UAH",
  US: "USD", ZA: "ZAR",
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR",
  FI: "EUR", FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR",
  LT: "EUR", LU: "EUR", LV: "EUR", MC: "EUR", ME: "EUR", MT: "EUR",
  NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR",
};

export function getCountryName(countryCode: string, locale = "en"): string {
  const code = countryCode.trim().toUpperCase();
  if (!code) return "";
  try {
    const DisplayNames = (Intl as unknown as {
      DisplayNames?: new (
        locales?: string | string[],
        options?: { type: "region" },
      ) => { of: (code: string) => string | undefined };
    }).DisplayNames;
    return DisplayNames ? new DisplayNames(locale, { type: "region" }).of(code) ?? code : code;
  } catch {
    return code;
  }
}

export function getCountryFromLocale(locale?: string): string {
  const normalizedLocale =
    locale ??
    (typeof navigator !== "undefined" ? navigator.language : "sv-SE");
  const region = normalizedLocale.replaceAll("_", "-").split("-").at(-1)?.toUpperCase();
  return region && ISO_COUNTRY_CODES.includes(region) ? region : "SE";
}

export function getDefaultCurrency(countryCode: string): string {
  return currencyByCountry[countryCode.trim().toUpperCase()] ?? "";
}