import i18n from './i18n';

/**
 * Testerna är skrivna mot den svenska ytan (appen var helsvensk innan i18n infördes), så de körs
 * på svenska. Riktiga användare får engelska som default via språkdetekteringen i i18n/index.ts.
 */
void i18n.changeLanguage('sv');
