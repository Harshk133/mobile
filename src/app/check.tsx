import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api, type CheckCard } from '@/lib/api';
import { categoryIcon } from '@/lib/format';
import { useCheckCards, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, IconButton, IconTile, Text, haptic } from '@/ui/primitives';
import { color, radius, space } from '@/ui/theme';

/** The 10-second weekly check: one tap per item, no typing. Feeds the family's own use rates. */
export default function Check() {
  const { t, nameOf, altNameOf } = useSettings();
  const toast = useToast();
  const cards = useCheckCards();
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<CheckCard[] | null>(null);
  const check = useStockMutation((v: { id: string; action: 'still_have' | 'finished' | 'thrown' }) => api.check(v.id, v.action));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // the list is frozen when the check starts, so answering (which refreshes the cards) doesn't reshuffle it
  useEffect(() => {
    if (!frozen && cards.data) setFrozen(cards.data.cards);
  }, [cards.data, frozen]);
  const items = frozen ?? cards.data?.cards ?? [];
  const card = items[idx];

  const answer = (action: 'still_have' | 'finished' | 'thrown') => {
    if (!card) return;
    check.mutate({ id: card.item_id, action }, {
      onSuccess: (r) => {
        haptic.tap();
        setMsg(r.message);
        setIdx(idx + 1);
      },
      onError: (e) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' }),
    });
  };

  const back = <IconButton icon="close" label={t('common.close')} onPress={close} />;
  if (cards.isError) return <Screen right={back}><ErrorState error={cards.error} onRetry={() => cards.refetch()} /></Screen>;
  if (cards.isLoading) return <Screen title={t('check.title')} right={back}><ListSkeleton rows={1} /></Screen>;

  if (!card)
    return (
      <Screen right={back}>
        <EmptyState icon="check-circle-outline" title={items.length ? t('check.doneTitle') : t('check.emptyTitle')}
          body={items.length ? t('check.doneBody') : t('check.emptyBody')}
          action={{ label: t('common.done'), onPress: close }} />
      </Screen>
    );

  return (
    <Screen title={t('check.title')} subtitle={t('check.progress', { n: idx + 1, total: items.length })} right={back}>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: color.surfaceAlt, overflow: 'hidden', marginBottom: space.lg }}
        accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: items.length, now: idx }}>
        <View style={{ width: `${(idx / items.length) * 100}%`, height: '100%', backgroundColor: color.primary }} />
      </View>

      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
        <IconTile name={categoryIcon(card.category)} tone="sage" size={64} />
        <Text variant="title" style={{ textAlign: 'center' }}>{nameOf(card)}</Text>
        {altNameOf(card) ? <Text tone="muted">{altNameOf(card)}</Text> : null}
        <Text tone="muted" style={{ textAlign: 'center' }}>{t('check.estimate', { qty: card.remaining_label })}</Text>
      </Card>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Button label={t('check.still')} icon="home-outline" onPress={() => answer('still_have')} disabled={check.isPending} />
        <Button kind="secondary" label={t('check.finished')} icon="check-circle-outline" onPress={() => answer('finished')} disabled={check.isPending} />
        <Button kind="secondary" label={t('check.thrown')} icon="delete-outline" onPress={() => answer('thrown')} disabled={check.isPending} />
        <Button kind="ghost" label={t('check.skip')} onPress={() => setIdx(idx + 1)} />
      </View>

      {msg ? (
        <Text variant="caption" tone="muted" style={{ marginTop: space.md, textAlign: 'center' }} accessibilityLiveRegion="polite">
          {msg}
        </Text>
      ) : null}
      <Text variant="caption" tone="faint" style={{ marginTop: space.lg, textAlign: 'center' }}>{t('check.noGuilt')}</Text>
    </Screen>
  );
}
