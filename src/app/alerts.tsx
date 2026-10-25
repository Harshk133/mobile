import { router } from 'expo-router';
import { View } from 'react-native';

import { useAlerts, useRefreshStock } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/feedback';
import { Button, Card, IconButton, IconTile, Text } from '@/ui/primitives';
import { ReminderPrompt } from '@/ui/reminders';
import { space } from '@/ui/theme';

/** Calm reminders from stored data. Each has a stable id, so a dismissed one stays dismissed. */
export default function Alerts() {
  const { t, dismissedAlerts, update } = useSettings();
  const alerts = useAlerts();
  const refresh = useRefreshStock();
  const list = (alerts.data?.alerts ?? []).filter((a) => !dismissedAlerts.includes(a.id));
  const dismiss = (id: string) => update({ dismissedAlerts: [...dismissedAlerts, id].slice(-300) });

  return (
    <Screen title={t('alerts.title')} subtitle={t('alerts.subtitle')}
      right={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}
      refreshing={alerts.isRefetching} onRefresh={() => refresh()}>
      <ReminderPrompt />
      {alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
      ) : alerts.isLoading ? (
        <ListSkeleton rows={3} />
      ) : !list.length ? (
        <EmptyState icon="check-circle-outline" title={t('alerts.emptyTitle')} body={t('alerts.emptyBody')} />
      ) : (
        <View style={{ gap: space.sm }}>
          {list.map((a) => {
            const tone = a.level === 'urgent' ? 'danger' : a.level === 'soon' ? 'accent' : 'sage';
            return (
              <Card key={a.id} style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                  <IconTile name={a.kind === 'cooked' ? 'pot-steam-outline' : a.level === 'urgent' ? 'alert-circle-outline' : 'clock-outline'} tone={tone} />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{a.title}</Text>
                </View>
                <Text tone="muted">{a.body}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {a.item_id ? (
                    <Button compact kind="secondary" label={t('alerts.open')} onPress={() => router.push(`/item/${a.item_id}`)} />
                  ) : (
                    <Button compact kind="secondary" label={t('alerts.openCooked')} onPress={() => router.push('/cook')} />
                  )}
                  <Button compact kind="ghost" label={t('alerts.dismiss')} onPress={() => dismiss(a.id)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
