import { mediaKindFromPath, type MediaAsset } from '@freevobe/protocol';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { MediaTile } from '../media/MediaTile';

/**
 * Media som en verktygskörning just skapade, inne i chatten. Filerna hämtas ur projektets
 * media-mapp; ligger de inte i listan ännu visas kortet ändå med rätt sorts förhandsvisning.
 */
export function MediaStrip({ files }: { files: string[] }) {
  const { t } = useTranslation();
  const assets = useAppStore((state) => state.mediaAssets);

  if (files.length === 0) return null;

  return (
    <section className="vf-panel p-2" data-testid="media-strip">
      <header className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          {t('chat.mediaTitle')}
        </span>
        <span className="text-[10px] text-slate-600">{t('media.count', { count: files.length })}</span>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {files.map((file) => {
          const known = assets.find((asset) => asset.path === file);
          const asset: MediaAsset = known ?? {
            path: file,
            kind: mediaKindFromPath(file),
            mime: '',
            bytes: 0,
            createdAt: 0,
          };
          return <MediaTile key={file} asset={asset} />;
        })}
      </div>
    </section>
  );
}
