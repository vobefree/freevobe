import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Språkmedvetna versioner av Next:s navigering: `Link` och `useRouter` lägger själva på
 * `/sv/`, `/de/` osv., så att en länk aldrig tappar språket.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
