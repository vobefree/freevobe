import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

/**
 * Hämtar en mediafil med token i huvudet och gör en blob-URL av den. `<img src>` kan inte skicka
 * headern, så filen måste hämtas först – den lämnar aldrig datorn.
 */
export function useMediaObjectUrl(path: string | null): string | null {
  const client = useAppStore((state) => state.client);
  const projectId = useAppStore((state) => state.project?.id ?? null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!client || !projectId || !path) return;
    if (typeof URL.createObjectURL !== 'function') return;

    let active = true;
    let created: string | null = null;
    void client
      .blob(
        `/api/projects/${encodeURIComponent(projectId)}/media/file?path=${encodeURIComponent(path)}`,
      )
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [client, projectId, path]);

  return url;
}
