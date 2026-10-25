import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ScanResult } from '@/lib/api';
import { useScanStatus } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { useToast } from '@/ui/feedback';
import { Button, Card, Icon, IconButton, Text } from '@/ui/primitives';
import { BillReview, loadDraft, saveDraft, toDraft, type Draft } from '@/ui/review';
import { color, radius, space } from '@/ui/theme';

type Step = 'choose' | 'camera' | 'preview' | 'reading' | 'paste' | 'review' | 'done';

/** Shrink and re-encode before upload: a 12 MP photo becomes ~1600 px wide, enough for print. */
async function prepare(uri: string): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(uri).resize({ width: 1600 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri; // preprocessing is an optimisation; the original still works
  }
}

async function asUpload(uri: string) {
  if (Platform.OS === 'web') return await (await fetch(uri)).blob();
  return { uri, name: 'bill.jpg', type: 'image/jpeg' };
}

export default function Scan() {
  const { t } = useSettings();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const status = useScanStatus();
  const [step, setStep] = useState<Step>('choose');
  const [photo, setPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [added, setAdded] = useState(0);
  const [text, setText] = useState('');
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [camReady, setCamReady] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    loadDraft().then(setSaved);
  }, []);

  const update = (d: Draft) => {
    setDraft(d);
    saveDraft(d); // an edited bill survives a failed request or the app being closed
  };
  const show = (r: ScanResult) => {
    if (cancelled.current) return;
    update(toDraft(r));
    setStep('review');
  };
  const fail = (e: unknown, back: Step) => {
    if (cancelled.current) return;
    toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });
    setStep(back);
  };

  const read = async (uri: string) => {
    cancelled.current = false;
    setStep('reading');
    try {
      show(await api.scanPhoto(await asUpload(await prepare(uri))));
    } catch (e) {
      fail(e, 'preview');
    }
  };
  const sample = async () => {
    cancelled.current = false;
    setStep('reading');
    try {
      show(await api.scanSample());
    } catch (e) {
      fail(e, 'choose');
    }
  };
  const parse = async () => {
    cancelled.current = false;
    setStep('reading');
    try {
      show(await api.parseText(text));
    } catch (e) {
      fail(e, 'paste');
    }
  };
  const openCamera = async () => {
    const p = perm?.granted ? perm : await requestPerm();
    if (p.granted) setStep('camera');
    else toast({ message: t('scan.cameraDenied'), action: p.canAskAgain ? undefined : { label: t('scan.settings'), onPress: () => Linking.openSettings() } });
  };
  const gallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
    if (!r.canceled && r.assets[0]) {
      setPhoto(r.assets[0].uri);
      setStep('preview');
    }
  };
  const capture = async () => {
    try {
      const p = await cam.current?.takePictureAsync({ quality: 0.9 });
      if (p?.uri) {
        setPhoto(p.uri);
        setStep('preview');
      }
    } catch (e) {
      fail(e, 'camera');
    }
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /* ---------------- camera (full screen) */
  if (step === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cam} style={{ flex: 1 }} facing="back" onCameraReady={() => setCamReady(true)} />
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 72, bottom: 180, left: 24, right: 24,
          borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, borderStyle: 'dashed' }} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon="close" label={t('common.cancel')} tint="#fff" onPress={() => setStep('choose')} />
          <Text variant="label" style={{ color: '#fff', flex: 1, textAlign: 'center', marginRight: 48 }}>{t('scan.frameTip')}</Text>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + 32, left: 0, right: 0, alignItems: 'center', gap: space.md }}>
          <Text variant="caption" style={{ color: '#fff' }}>{t('scan.lightTip')}</Text>
          <Pressable onPress={capture} disabled={!camReady} accessibilityRole="button" accessibilityLabel={t('scan.capture')}
            style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#fff',
              backgroundColor: pressed ? '#ddd' : '#fff', opacity: camReady ? 1 : 0.4 })} />
        </View>
      </View>
    );
  }

  const back = <IconButton icon="close" label={t('common.close')} onPress={close} />;

  /* ---------------- reading */
  if (step === 'reading') {
    return (
      <Screen title={t('scan.reading')} right={back}>
        <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.lg }} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={color.primary} />
          <Text tone="muted" style={{ textAlign: 'center' }}>{t('scan.readingBody')}</Text>
          <Button kind="ghost" label={t('common.cancel')} onPress={() => { cancelled.current = true; setStep(photo ? 'preview' : 'choose'); }} />
        </View>
      </Screen>
    );
  }

  /* ---------------- preview with retake */
  if (step === 'preview' && photo) {
    return (
      <Screen title={t('scan.previewTitle')} right={back}>
        <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: color.surfaceAlt }}
          contentFit="contain" accessibilityLabel={t('scan.previewTitle')} />
        <Text tone="muted" style={{ marginTop: space.md }}>{t('scan.previewHint')}</Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label={t('scan.usePhoto')} icon="check-circle-outline" onPress={() => read(photo)} />
          <Button kind="secondary" label={t('scan.retake')} icon="camera-retake-outline" onPress={() => { setPhoto(null); openCamera(); }} />
        </View>
      </Screen>
    );
  }

  /* ---------------- paste text */
  if (step === 'paste') {
    return (
      <Screen title={t('scan.pasteTitle')} subtitle={t('scan.pasteBody')} right={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => setStep('choose')} />}>
        <TextInput value={text} onChangeText={setText} multiline placeholder={'TOMATO 1.000 KG 40.00\nAmul Butter 100 g'}
          placeholderTextColor={color.textFaint} accessibilityLabel={t('scan.pasteTitle')} textAlignVertical="top"
          style={{ minHeight: 200, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
            padding: space.md, fontSize: 16, color: color.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} />
        <Button label={t('scan.readText')} icon="text-box-outline" disabled={!text.trim()} onPress={parse} style={{ marginTop: space.md }} />
      </Screen>
    );
  }

  /* ---------------- review */
  if (step === 'review' && draft) {
    return (
      <Screen title={t('scan.reviewTitle')} subtitle={t('scan.reviewBody')} right={back}>
        <BillReview draft={draft} onChange={update} onDone={(n) => { setAdded(n); setDraft(null); setStep('done'); }} />
      </Screen>
    );
  }

  /* ---------------- done */
  if (step === 'done') {
    return (
      <Screen right={back}>
        <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={40} tint={color.primary} />
          </View>
          <Text variant="title" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {added ? t('scan.doneTitle', { n: added }) : t('scan.doneNothing')}
          </Text>
          <Text tone="muted" style={{ textAlign: 'center' }}>{t('scan.doneBody')}</Text>
        </View>
        <View style={{ gap: space.sm }}>
          <Button label={t('scan.seeKitchen')} icon="fridge-outline" onPress={() => router.replace('/kitchen')} />
          <Button kind="secondary" label={t('scan.seeCook')} icon="pot-steam-outline" onPress={() => router.replace('/cook')} />
          <Button kind="ghost" label={t('scan.another')} onPress={() => { setPhoto(null); setStep('choose'); }} />
        </View>
      </Screen>
    );
  }

  /* ---------------- choose */
  const live = status.data?.live_vision;
  return (
    <Screen title={t('scan.title')} subtitle={t('scan.subtitle')} right={back}>
      {saved ? (
        <Card tone="accent" style={{ gap: space.sm, marginBottom: space.md }}>
          <Text variant="label" style={{ color: color.accentText }}>{t('scan.draftTitle', { shop: saved.shop })}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button compact label={t('scan.draftContinue')} onPress={() => { setDraft(saved); setSaved(null); setStep('review'); }} />
            <Button compact kind="ghost" label={t('scan.draftDiscard')} onPress={() => { saveDraft(null); setSaved(null); }} />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button label={t('scan.takePhoto')} icon="camera-outline" onPress={openCamera} />
        <Button kind="secondary" label={t('scan.gallery')} icon="image-outline" onPress={gallery} />
        <Button kind="secondary" label={t('scan.paste')} icon="text-box-outline" onPress={() => setStep('paste')} />
        <Button kind="secondary" label={t('scan.voice')} icon="microphone-outline" onPress={() => router.replace('/voice')} />
      </View>

      <Card style={{ marginTop: space.xl, gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Icon name={live ? 'cellphone-check' : 'information-outline'} tint={live ? color.primary : color.accent} />
          <Text variant="label" style={{ flex: 1 }}>{status.isLoading ? t('common.loading') : live ? t('scan.liveOn') : t('scan.liveOff')}</Text>
        </View>
        <Text variant="caption" tone="muted">{live ? t('scan.privacyLive') : t('scan.privacyOff')}</Text>
      </Card>

      <Card tone="sage" style={{ marginTop: space.md, gap: space.sm }}>
        <Text variant="label" style={{ color: color.sageText }}>{t('scan.sampleTitle')}</Text>
        <Text variant="caption" style={{ color: color.sageText }}>{t('scan.sampleBody')}</Text>
        <Button compact kind="secondary" icon="file-document-outline" label={t('scan.useSample')} onPress={sample} />
      </Card>
    </Screen>
  );
}
