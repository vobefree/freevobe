import { appUrl } from "@/lib/shopify";
import { envValue } from "./settings";

export type SocialProviderId = "google" | "facebook";

type ProviderConfig = {
  name: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scope: string;
  authorizeUrl: string;
  exchange: (code: string, redirectUri: string, clientId: string, clientSecret: string) => Promise<string>;
  profile: (accessToken: string) => Promise<{ email: string | null; name: string }>;
};

const PROVIDERS: Record<SocialProviderId, ProviderConfig> = {
  google: {
    name: "Google",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    scope: "openid email profile",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    async exchange(code, redirectUri, clientId, clientSecret) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as { access_token?: string; error_description?: string };
      if (!res.ok || !json.access_token) throw new Error(json.error_description || "google_token");
      return json.access_token;
    },
    async profile(accessToken) {
      const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { email?: string; name?: string; given_name?: string };
      if (!res.ok) throw new Error("google_profile");
      return { email: json.email ?? null, name: json.name || json.given_name || "Google-konto" };
    },
  },
  facebook: {
    name: "Facebook",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    scope: "email,public_profile",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    async exchange(code, redirectUri, clientId, clientSecret) {
      const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code });
      const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
      if (!res.ok || !json.access_token) throw new Error(json.error?.message || "facebook_token");
      return json.access_token;
    },
    async profile(accessToken) {
      const params = new URLSearchParams({ fields: "id,name,email", access_token: accessToken });
      const res = await fetch(`https://graph.facebook.com/me?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as { email?: string; name?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "facebook_profile");
      return { email: json.email ?? null, name: json.name || "Facebook-konto" };
    },
  },
};

export function socialProviderId(value: string): SocialProviderId | null {
  return value === "google" || value === "facebook" ? value : null;
}

export function socialProviderConfigured(id: SocialProviderId): boolean {
  const config = PROVIDERS[id];
  return Boolean(envValue(config.clientIdEnv) && envValue(config.clientSecretEnv));
}

export function configuredSocialProviders(): SocialProviderId[] {
  return (Object.keys(PROVIDERS) as SocialProviderId[]).filter(socialProviderConfigured);
}

export function socialProviderName(id: SocialProviderId): string {
  return PROVIDERS[id].name;
}

export function socialRedirectUri(id: SocialProviderId): string {
  return `${appUrl()}/api/auth/social/${id}/callback`;
}

export function socialAuthorizeUrl(id: SocialProviderId, state: string): string {
  const config = PROVIDERS[id];
  const params = new URLSearchParams({
    client_id: envValue(config.clientIdEnv),
    redirect_uri: socialRedirectUri(id),
    response_type: "code",
    scope: config.scope,
    state,
  });
  if (id === "google") params.set("prompt", "select_account");
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function socialProfile(id: SocialProviderId, code: string): Promise<{ email: string | null; name: string }> {
  const config = PROVIDERS[id];
  const clientId = envValue(config.clientIdEnv);
  const clientSecret = envValue(config.clientSecretEnv);
  if (!clientId || !clientSecret) throw new Error("not_configured");
  const token = await config.exchange(code, socialRedirectUri(id), clientId, clientSecret);
  return config.profile(token);
}
