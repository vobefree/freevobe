const LOCALES = [
  'en',
  'sv',
  'nb',
  'da',
  'fi',
  'de',
  'es',
  'fr',
  'pl',
  'ru',
  'zh-Hans',
  'zh-Hant',
] as const;

/**
 * Språkvalsomdirigering utan server.
 *
 * Sidan är statiskt exporterad, så det finns ingen middleware som kan läsa `Accept-Language`.
 * I stället gör den här sidan samma sak i webbläsaren, i den ordning användaren förväntar sig:
 * sparat val (cookien `NEXT_LOCALE`), sedan webbläsarens språklista, sedan engelska.
 */
const redirectScript = `
(function () {
  var supported = ${JSON.stringify(LOCALES)};
  function match(tag) {
    if (!tag) return null;
    var lower = String(tag).toLowerCase();
    if (lower.indexOf('zh') === 0) {
      if (lower.indexOf('hant') !== -1 || lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo') return 'zh-Hant';
      return 'zh-Hans';
    }
    var base = lower.split('-')[0];
    if (base === 'no' || base === 'nn') return 'nb';
    for (var i = 0; i < supported.length; i += 1) {
      if (supported[i].toLowerCase() === lower || supported[i].toLowerCase() === base) return supported[i];
    }
    return null;
  }
  var cookie = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  var saved = cookie ? match(decodeURIComponent(cookie[1])) : null;
  var candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  var detected = null;
  for (var j = 0; j < candidates.length && !detected; j += 1) detected = match(candidates[j]);
  var locale = saved || detected || 'en';
  location.replace('/' + locale + '/');
})();
`;

export default function LocaleRedirect() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <main>
        <ul>
          {LOCALES.map((locale) => (
            <li key={locale}>
              <a href={`/${locale}/`} hrefLang={locale}>
                {locale}
              </a>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
