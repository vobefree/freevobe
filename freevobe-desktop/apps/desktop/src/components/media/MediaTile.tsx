import type { MediaAsset } from '@freevobe/protocol';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../lib/format';
import { useMediaObjectUrl } from './useMediaObjectUrl';

/** Ett mediaobjekt: förhandsvisning, filnamn och den metadata som finns kvar på disk. */
export function MediaTile({ asset }: { asset: MediaAsset }) {
  const { t } = useTranslation();
  const url = useMediaObjectUrl(asset.path);
  const name = asset.path.split('/').pop() ?? asset.path;
  const origin = [asset.provider, asset.model].filter(Boolean).join(' · ');

  return (
    <figure className="vf-panel overflow-hidden" data-testid="media-tile" data-kind={asset.kind}>
      <div className="flex h-32 items-center justify-center bg-anvil">
        {url && asset.kind === 'image' ? (
          <img src={url} alt={name} className="h-full w-full object-contain" />
        ) : url && asset.kind === 'video' ? (
          <video src={url} controls className="h-full w-full" data-testid="media-video" />
        ) : url && asset.kind === 'audio' ? (
          <audio src={url} controls className="w-full px-2" data-testid="media-audio" />
        ) : (
          <span className="text-[11px] text-slate-600">{t(`media.kind.${asset.kind}`)}</span>
        )}
      </div>
      <figcaption className="space-y-0.5 p-2">
        <p className="truncate font-mono text-[11px] text-slate-300" title={asset.path}>
          {name}
        </p>
        <p className="truncate text-[10px] text-slate-600" title={origin || asset.mime}>
          {origin || asset.mime}
        </p>
        <p className="text-[10px] text-slate-600">
          {t(`media.kind.${asset.kind}`)} · {formatBytes(asset.bytes)}
          {asset.costUsd !== undefined ? ` · $${asset.costUsd}` : ''}
        </p>
        {asset.prompt ? (
          <p className="truncate text-[10px] text-slate-500" title={asset.prompt}>
            {asset.prompt}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
