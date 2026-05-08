import {getRequestConfig} from 'next-intl/server';
import {routing} from './i18n/routing';

export default getRequestConfig(async ({locale}) => {
  // locale 可能为 undefined（如静态构建时），此时使用默认 locale
  const safeLocale = locale && routing.locales.includes(locale as any)
    ? locale
    : routing.defaultLocale;

  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`)).default
  };
});
