import { View } from 'react-native';

import { api, type Cooked } from '@/lib/api';
import { clockTime } from '@/lib/format';
import { useCooked, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { EmptyState, ListSkeleton, useToast } from './feedback';
import { Button, Card, IconTile, Pill, Text } from './primitives';
import { color, space } from './theme';

/** Cooked dishes with their finish-by time: the stricter of home habit and official guidance. */
export function CookedList({ compactEmpty }: { compactEmpty?: boolean }) {
  const { t } = useSettings();
  const toast = useToast();
  const cooked = useCooked();
  const move = useStockMutation((v: { id: number; storage: 'room' | 'fridge' }) => api.moveCooked(v.id, v.storage));
  const done = useStockMutation((v: { id: number; outcome: 'eaten' | 'thrown' }) => api.cookedDone(v.id, v.outcome));
  const onError = (e: unknown) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });

  if (cooked.isLoading) return <ListSkeleton rows={1} />;
  const rows = cooked.data?.rows ?? [];
  if (!rows.length)
    return compactEmpty ? (
      <Text tone="muted">{t('cooked.none')}</Text>
    ) : (
      <EmptyState icon="pot-steam-outline" title={t('cooked.emptyTitle')} body={t('cooked.emptyBody')} />
    );
  const now = Date.now();
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r: Cooked) => {
        const left = (Date.parse(r.finish_by) - now) / 3600000;
        const past = left < 0;
        const soon = !past && left <= 3;
        const when = past ? t('cooked.past') : left < 24 ? t('cooked.by', { time: clockTime(r.finish_by) }) : t('cooked.days', { n: Math.round(left / 24) });
        return (
          <Card key={r.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconTile name={r.storage === 'fridge' ? 'fridge-outline' : 'pot-steam-outline'} tone={past ? 'danger' : soon ? 'accent' : 'sage'} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{r.dish}</Text>
                <Text variant="caption" tone="muted">
                  {t('cooked.cookedAt', { time: clockTime(r.cooked_at) })} · {r.storage === 'fridge' ? t('storage.fridge') : t('storage.room')}
                </Text>
              </View>
              <Pill
                small
                label={when}
                icon={past ? 'alert-circle-outline' : 'timer-sand'}
                tone={past ? 'danger' : soon ? 'accent' : 'sage'}
              />
            </View>
            {r.official ? (
              <Text variant="caption" tone="muted">
                {r.official}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {r.storage === 'room' && !past ? (
                <Button compact kind="secondary" icon="fridge-outline" label={t('cooked.toFridge')}
                  onPress={() => move.mutate({ id: r.id, storage: 'fridge' }, { onError, onSuccess: () => toast({ message: t('cooked.moved') }) })} />
              ) : null}
              <Button compact kind="secondary" icon="check-circle-outline" label={t('cooked.eaten')}
                onPress={() => done.mutate({ id: r.id, outcome: 'eaten' }, { onError })} />
              <Button compact kind="ghost" label={t('cooked.thrown')}
                onPress={() => done.mutate({ id: r.id, outcome: 'thrown' }, { onError, onSuccess: () => toast({ message: t('cooked.thrownNote') }) })} />
            </View>
          </Card>
        );
      })}
      <Text variant="caption" tone="faint" style={{ color: color.textFaint }}>
        {t('cooked.safety')}
      </Text>
    </View>
  );
}
