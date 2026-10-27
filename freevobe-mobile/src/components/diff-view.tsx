import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { FileDiff } from '@/api/types';
import { mono, radius, spacing, terminalSurface, typography } from '@/constants/theme';
import { buildDiffRows, diffStats, formatStats, hunkHeader } from '@/lib/diff';
import { shortenPath } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Caption, Chip, Mono } from './ui';

/**
 * Diffs för telefon. Raderna är färgkodade (+ / −), koden rullar i sidled i stället för att radbrytas
 * (indrag betyder något), och långa diffar visas sida för sida eftersom en enda lång rullning är
 * svår att orientera sig i på en liten skärm.
 */

const LINES_PER_PAGE = 40;

export function DiffView({ diff, maxPages = 3 }: { diff: FileDiff; maxPages?: number }) {
  const theme = useTheme();
  const rows = buildDiffRows(diff);
  const stats = diffStats(diff);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.min(maxPages, Math.ceil(rows.length / LINES_PER_PAGE)));
  const visible = rows.slice(page * LINES_PER_PAGE, (page + 1) * LINES_PER_PAGE);
  const hidden = rows.length - pageCount * LINES_PER_PAGE;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: terminalSurface.border,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: terminalSurface.background,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: theme.cardStrong,
          borderBottomWidth: 1,
          borderBottomColor: terminalSurface.border,
        }}
      >
        <Mono style={{ flexShrink: 1 }}>{shortenPath(diff.path, 30)}</Mono>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Chip label={`+${stats.additions}`} tone="success" />
          <Chip label={`−${stats.deletions}`} tone="danger" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: '100%' }}>
          {visible.map((row, index) => (
            <View
              key={`${page}-${index}`}
              style={{
                flexDirection: 'row',
                backgroundColor:
                  row.kind === 'add'
                    ? 'rgba(74, 222, 128, 0.10)'
                    : row.kind === 'remove'
                      ? 'rgba(248, 113, 113, 0.10)'
                      : 'transparent',
              }}
            >
              <Text style={[lineNumberStyle, { color: theme.muted }]}>{row.oldLine ?? ''}</Text>
              <Text style={[lineNumberStyle, { color: theme.muted }]}>{row.newLine ?? ''}</Text>
              <Text
                style={{
                  fontFamily: mono,
                  fontSize: 12.5,
                  lineHeight: 20,
                  paddingHorizontal: spacing.sm,
                  color:
                    row.kind === 'add'
                      ? theme.diffAdd
                      : row.kind === 'remove'
                        ? theme.diffRemove
                        : row.kind === 'meta'
                          ? theme.accentSoft
                          : terminalSurface.text,
                }}
              >
                {row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}
                {row.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: terminalSurface.border,
          gap: spacing.sm,
        }}
      >
        <Caption>
          {pageCount > 1
            ? `Sida ${page + 1} av ${pageCount}`
            : `${rows.length} rader`}
          {hidden > 0 ? ` · ${hidden} rader dolda` : ''}
          {diff.binary ? ' · binär fil' : ''}
        </Caption>
        {pageCount > 1 ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Föregående sida"
              onPress={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              hitSlop={6}
            >
              <Chip label="← Bakåt" tone={page === 0 ? 'neutral' : 'accent'} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nästa sida"
              onPress={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={page >= pageCount - 1}
              hitSlop={6}
            >
              <Chip label="Framåt →" tone={page >= pageCount - 1 ? 'neutral' : 'accent'} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Rubrikraden `@@ -12,3 +12,3 @@` visas som en egen rad i diffen. */
export function DiffHunkHeader({ diff, index }: { diff: FileDiff; index: number }) {
  const hunk = diff.hunks[index];
  if (!hunk) return null;
  return <Mono>{hunkHeader(hunk)}</Mono>;
}

export function DiffSummaryLine({ diff }: { diff: FileDiff }) {
  const stats = diffStats(diff);
  return (
    <Caption>
      {diff.kind === 'create' ? 'Ny fil' : diff.kind === 'delete' ? 'Borttagen fil' : 'Ändrad fil'} ·{' '}
      {formatStats(stats)}
    </Caption>
  );
}

const lineNumberStyle = {
  ...typography.caption,
  fontFamily: mono,
  fontSize: 11.5,
  lineHeight: 20,
  paddingHorizontal: 4,
  minWidth: 30,
  textAlign: 'right' as const,
};
