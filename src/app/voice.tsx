import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { EmptyState, useToast } from '@/ui/feedback';
import { Button, Card, Chip, Icon, IconButton, Text } from '@/ui/primitives';
import { BillReview, saveDraft, toDraft, type Draft } from '@/ui/review';
import { color, radius, space } from '@/ui/theme';

const EXAMPLES = ['आज अर्धा किलो टोमॅटो घेतले', 'दो किलो प्याज़ और एक पालक', '2 kg onion, 1 litre milk'];

/** A stable id per sentence per day, so saving the same note twice replaces it. */
function noteId(text: string) {
  let h = 0;
  for (const c of text.trim()) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `voice_${new Date().toISOString().slice(0, 10)}_${(h >>> 0).toString(16)}`;
}

export default function Voice() {
  const { t } = useSettings();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const understand = async () => {
    setBusy(true);
    try {
      const r = await api.voice(text);
      if (!r.lines.length) {
        toast({ message: t('voice.nothing') });
        return;
      }
      setDraft(toDraft({ bill_id: noteId(text), shop: t('voice.shop'), source: 'voice', mode: 'parsed', lines: r.lines }));
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const back = <IconButton icon="close" label={t('common.close')} onPress={close} />;
  if (done !== null)
    return (
      <Screen right={back}>
        <EmptyState icon="check-circle-outline" title={t('scan.doneTitle', { n: done })} body={t('scan.doneBody')}
          action={{ label: t('scan.seeKitchen'), icon: 'fridge-outline', onPress: () => router.replace('/kitchen') }} />
      </Screen>
    );
  if (draft)
    return (
      <Screen title={t('voice.reviewTitle')} right={back}>
        <BillReview draft={draft} onChange={setDraft} onDone={(n) => { saveDraft(null); setDone(n); }} />
      </Screen>
    );

  return (
    <Screen title={t('voice.title')} subtitle={t('voice.subtitle')} right={back}>
      <Card tone="sage" style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md }}>
        <Icon name="microphone-outline" tint={color.sageText} />
        <Text style={{ flex: 1, color: color.sageText }}>{t('voice.howTo')}</Text>
      </Card>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder={t('voice.placeholder')}
        placeholderTextColor={color.textFaint}
        accessibilityLabel={t('voice.title')}
        textAlignVertical="top"
        style={{ marginTop: space.md, minHeight: 140, borderRadius: radius.md, borderWidth: 1, borderColor: color.border,
          backgroundColor: color.surface, padding: space.md, fontSize: 20, lineHeight: 28, color: color.text }}
      />
      <Text variant="label" tone="muted" style={{ marginTop: space.md, marginBottom: space.sm }}>{t('voice.try')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {EXAMPLES.map((e) => <Chip key={e} label={e} onPress={() => setText(e)} />)}
      </View>
      <Button label={t('voice.understand')} icon="check-circle-outline" disabled={!text.trim()} loading={busy} onPress={understand} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
