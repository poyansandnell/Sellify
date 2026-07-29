import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnalyzeImages,
  useCreateListing,
  useRefineListingDraft,
  usePublishListing,
  useRequestUploadUrl,
  type AiListingDraft,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { conditionLabel, useI18n } from '@/lib/i18n';
import { EmptyState, PrimaryButton, SecondaryButton } from '@/components/Ui';
import { VoiceNoteInput } from '@/components/VoiceNoteInput';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { takeCopyListing } from '@/lib/copyListing';
import { errorDetail, errorStatus, StepError } from '@/lib/apiError';
import { imageUrl } from '@/lib/utils';
import colorsConst from '@/constants/colors';

type Step = 'photos' | 'analyzing' | 'review';

interface UploadedImage {
  localUri: string;
  objectPath: string;
}

export default function SellScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('photos');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<AiListingDraft | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [justRefined, setJustRefined] = useState(false);
  const refinedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityTouchedRef = useRef(false);
  const deviceCityRef = useRef('');

  useEffect(() => {
    return () => {
      if (refinedTimerRef.current) clearTimeout(refinedTimerRef.current);
    };
  }, []);

  // Detect the seller's real city from device location (e.g. Katrineholm, not a guess).
  const detectCity = async (): Promise<string> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return '';
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      if (!pos) return '';
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const detected = place?.city || place?.subregion || place?.region || '';
      if (detected) deviceCityRef.current = detected;
      return detected;
    } catch {
      // Location unavailable — the seller can still type their city.
      return '';
    }
  };

  // Prefill once the user is signed in and actually in the sell flow.
  useEffect(() => {
    if (!isSignedIn || deviceCityRef.current) return;
    let cancelled = false;
    (async () => {
      const detected = await detectCity();
      if (detected && !cancelled && !cityTouchedRef.current) {
        setCity(detected);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
  // "Skapa liknande annons": prefill the whole form from an existing listing.
  useFocusEffect(
    useCallback(() => {
      const src = takeCopyListing();
      if (!src) return;
      const hasWork =
        imagesRef.current.length > 0 ||
        titleRef.current.trim().length > 0 ||
        descriptionRef.current.trim().length > 0;
      const apply = () => applyCopy(src);
      if (hasWork) {
        Alert.alert(t.copyListingTitle, t.copyListingReplace, [
          { text: t.cancel, style: 'cancel' },
          { text: t.copyListingConfirm, style: 'destructive', onPress: apply },
        ]);
      } else {
        apply();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const applyCopy = (src: NonNullable<ReturnType<typeof takeCopyListing>>) => {
      setImages(
        src.images.map((p) => ({ localUri: imageUrl(p) ?? '', objectPath: p })),
      );
      setTitle(src.title);
      setDescription(src.description);
      setPrice(String(Math.round(src.price)));
      if (src.city) {
        cityTouchedRef.current = true;
        setCity(src.city);
      }
      setNotes('');
      setDraft({
        title: src.title,
        description: src.description,
        shortDescription: src.shortDescription ?? '',
        categoryId: src.categoryId ?? null,
        brand: src.brand ?? null,
        model: src.model ?? null,
        color: src.color ?? null,
        material: src.material ?? null,
        condition: src.condition as unknown as AiListingDraft['condition'],
        suggestedPrice: src.price,
        currency: src.currency,
        keywords: src.keywords ?? [],
        specifications: src.specifications ?? [],
        seoTitle: src.seoTitle ?? null,
        seoDescription: src.seoDescription ?? null,
      });
      setStep('review');
  };

  // Refs so async callbacks (voice transcription) always see the latest values.
  const stepRef = useRef(step);
  stepRef.current = step;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const titleRef = useRef(title);
  titleRef.current = title;
  const descriptionRef = useRef(description);
  descriptionRef.current = description;
  const priceRef = useRef(price);
  priceRef.current = price;

  const requestUploadUrl = useRequestUploadUrl();
  const analyzeImages = useAnalyzeImages();
  const refineDraft = useRefineListingDraft();

  // Fast text-only rewrite of the draft — no image re-analysis, stays on the review step.
  // Monotonic id guards against out-of-order responses overwriting newer results,
  // and only the latest in-flight request may apply its result.
  const refineSeqRef = useRef(0);
  const runRefine = async (userNotes: string) => {
    const seq = ++refineSeqRef.current;
    try {
      const result = await refineDraft.mutateAsync({
        data: {
          title: titleRef.current,
          description: descriptionRef.current,
          price: Number(priceRef.current) || null,
          currency: 'SEK',
          locale: language,
          userNotes,
        },
      });
      if (seq !== refineSeqRef.current) return; // a newer refine superseded this one
      setTitle(result.title);
      setDescription(result.description);
      if (result.suggestedPrice != null) {
        setPrice(String(Math.round(result.suggestedPrice)));
      }
      setDraft((prev) =>
        prev ? { ...prev, questions: result.questions ?? [] } : prev,
      );
      setJustRefined(true);
      if (refinedTimerRef.current) clearTimeout(refinedTimerRef.current);
      refinedTimerRef.current = setTimeout(() => setJustRefined(false), 6000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (seq === refineSeqRef.current) Alert.alert(t.error);
    }
  };

  const appendNotes = (text: string) => {
    const prev = notesRef.current.trim();
    const merged = prev ? `${prev}\n${text}` : text;
    notesRef.current = merged;
    setNotes(merged);
    // If the AI is already done, quickly rework the text with what was said.
    if (stepRef.current === 'review') {
      runRefine(merged);
    }
  };
  const createListing = useCreateListing();
  const publishListing = usePublishListing();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 118 : insets.bottom + 100;

  if (!isSignedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock"
          title={t.signInToSell}
          text={t.signInToSellText}
          action={
            <PrimaryButton
              testID="sign-in-to-sell"
              label={t.signIn}
              onPress={() => router.push('/sign-in')}
            />
          }
        />
      </View>
    );
  }

  const compressAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      const result = await manipulateAsync(
        asset.uri,
        asset.width > 1280 ? [{ resize: { width: 1280 } }] : [],
        { compress: 0.6, format: SaveFormat.JPEG },
      );
      return { uri: result.uri, contentType: 'image/jpeg' };
    } catch {
      // Fall back to the original if compression fails (e.g. on web)
      return { uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' };
    }
  };

  const uploadAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        assets.map(async (asset, i) => {
          const { uri, contentType } = await compressAsset(asset);
          const blob = await (await fetch(uri)).blob();
          let uploadURL: string;
          let objectPath: string;
          try {
            ({ uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
              data: {
                name: asset.fileName ?? `photo-${Date.now()}-${i}.jpg`,
                size: Math.max(1, blob.size),
                contentType,
              },
            }));
          } catch (e) {
            throw new StepError(
              errorDetail(t.uploadStepRequestUrl, e),
              errorStatus(e),
            );
          }
          const putRes = await fetch(uploadURL, {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': contentType },
          });
          if (!putRes.ok)
            throw new StepError(
              `${t.uploadStepPut}: HTTP ${putRes.status}`,
              putRes.status,
            );
          return { localUri: asset.uri, objectPath } as UploadedImage;
        }),
      );
      setImages((prev) => [...prev, ...uploaded]);
      return uploaded;
    } finally {
      setUploading(false);
    }
  };

  const runAnalysis = async (allImages: UploadedImage[], userNotes?: string) => {
    const returnTo: Step = draft ? 'review' : 'photos';
    setStep('analyzing');
    try {
      const result = await analyzeImages.mutateAsync({
        data: {
          images: allImages.map((img) => img.objectPath),
          locale: language,
          currency: 'SEK',
          userNotes: userNotes?.trim() || null,
        },
      });
      setDraft(result);
      setTitle(result.title);
      setDescription(result.description);
      setPrice(String(Math.round(result.suggestedPrice)));
      setStep('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (errorStatus(e) === 401) {
        Alert.alert(t.sessionExpired);
        setStep(returnTo);
        router.push('/sign-in');
        return;
      }
      Alert.alert(t.error, errorDetail(t.uploadStepAnalyze, e));
      setStep(returnTo);
    }
  };

  const pickImages = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          allowsMultipleSelection: true,
          selectionLimit: 5,
        });
      }
      if (result.canceled || result.assets.length === 0) return;
      const uploaded = await uploadAssets(result.assets);
      if (uploaded.length > 0 && step === 'photos') {
        await runAnalysis([...images, ...uploaded], notes);
      }
    } catch (e) {
      if (errorStatus(e) === 401) {
        Alert.alert(t.sessionExpired);
        router.push('/sign-in');
        return;
      }
      Alert.alert(
        t.uploadFailed,
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const onPublish = async () => {
    if (!draft || !title.trim() || !price.trim()) return;
    let cityValue = city.trim() || deviceCityRef.current;
    if (!cityValue) {
      // Last attempt to get the real city — never publish with a made-up one.
      cityValue = await detectCity();
    }
    if (!cityValue) {
      Alert.alert(t.cityRequired);
      return;
    }
    if (!city.trim()) setCity(cityValue);
    try {
      const listing = await createListing.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim(),
          shortDescription: draft.shortDescription,
          categoryId: draft.categoryId ?? null,
          brand: draft.brand ?? null,
          model: draft.model ?? null,
          color: draft.color ?? null,
          material: draft.material ?? null,
          condition: draft.condition,
          price: Number(price) || draft.suggestedPrice,
          currency: draft.currency || 'SEK',
          priceType: 'negotiable',
          city: cityValue,
          country: 'SE',
          shipping: 'pickup',
          images: images.map((img) => img.objectPath),
          keywords: draft.keywords,
          specifications: draft.specifications ?? [],
          seoTitle: draft.seoTitle ?? null,
          seoDescription: draft.seoDescription ?? null,
          status: 'draft',
        },
      });
      const published = await publishListing.mutateAsync({ id: listing.id });
      queryClient.invalidateQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('photos');
      setImages([]);
      setDraft(null);
      setTitle('');
      setDescription('');
      setPrice('');
      setNotes('');
      Alert.alert(t.published);
      router.push(`/listing/${published.slug}`);
    } catch (e) {
      if (errorStatus(e) === 401) {
        Alert.alert(t.sessionExpired);
        router.push('/sign-in');
        return;
      }
      Alert.alert(t.error, errorDetail(t.uploadStepPublish, e));
    }
  };

  const isUncertain = (field: string) =>
    draft?.uncertainFields?.includes(field) ?? false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
        }}
        bottomOffset={24}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {t.sellTitle}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {t.sellSubtitle}
        </Text>

        {step === 'photos' ? (
          <View style={styles.photoStep}>
            {uploading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  {t.uploading}
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  testID="take-photo"
                  onPress={() => pickImages(true)}
                  style={[
                    styles.photoBtn,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Feather name="camera" size={30} color={colors.primaryForeground} />
                  <Text style={[styles.photoBtnText, { color: colors.primaryForeground }]}>
                    {t.takePhoto}
                  </Text>
                </Pressable>
                <SecondaryButton
                  testID="pick-library"
                  label={t.fromLibrary}
                  icon="image"
                  onPress={() => pickImages(false)}
                />
              </>
            )}
          </View>
        ) : null}

        {step === 'analyzing' ? (
          <View style={styles.analyzingStep}>
            <View style={styles.centerCompact}>
              <View style={[styles.aiBubble, { backgroundColor: colors.accent }]}>
                <Feather name="zap" size={28} color={colors.accentForeground} />
              </View>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.analyzing, { color: colors.foreground }]}>
                {t.analyzing}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {t.analyzingHint}
              </Text>
            </View>
          </View>
        ) : null}

        {step === 'analyzing' || (step === 'review' && draft) ? (
          <VoiceNoteInput
            value={notes}
            onChangeText={setNotes}
            onAppendText={appendNotes}
            questions={draft?.questions ?? []}
            onSend={
              step === 'review' && draft ? () => runRefine(notes) : undefined
            }
            sendPending={refineDraft.isPending}
          />
        ) : null}

        {step === 'review' && draft ? (
          <View style={styles.review}>
            {justRefined ? (
              <View style={styles.refinedBanner} testID="refined-banner">
                <Feather name="check-circle" size={16} color="#15803d" />
                <Text style={styles.refinedText}>{t.aiUpdated}</Text>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.thumbRow}>
                {images.map((img, i) => (
                  <Image
                    key={i}
                    source={{ uri: img.localUri }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ))}
              </View>
            </ScrollView>

            <View style={[styles.aiTag, { backgroundColor: colors.accent }]}>
              <Feather name="zap" size={13} color={colors.accentForeground} />
              <Text style={[styles.aiTagText, { color: colors.accentForeground }]}>
                {t.reviewSubtitle}
              </Text>
            </View>

            <FieldCard label={t.titleLabel} uncertain={isUncertain('title')}>
              <TextInput
                testID="title-input"
                value={title}
                onChangeText={setTitle}
                style={[styles.fieldInput, { color: colors.foreground }]}
              />
            </FieldCard>

            <FieldCard
              label={t.description}
              uncertain={isUncertain('description')}
            >
              <TextInput
                testID="description-input"
                value={description}
                onChangeText={setDescription}
                multiline
                style={[
                  styles.fieldInput,
                  styles.multiline,
                  { color: colors.foreground },
                ]}
              />
            </FieldCard>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldCard
                  label={`${t.priceLabel} (${draft.currency || 'SEK'})`}
                  uncertain={isUncertain('suggestedPrice') || isUncertain('price')}
                >
                  <TextInput
                    testID="price-input"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    style={[styles.fieldInput, { color: colors.foreground }]}
                  />
                </FieldCard>
                {draft.priceRangeLow && draft.priceRangeHigh ? (
                  <Text style={[styles.hintSmall, { color: colors.mutedForeground }]}>
                    {Math.round(draft.priceRangeLow)}–{Math.round(draft.priceRangeHigh)} {draft.currency}
                  </Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <FieldCard label={t.cityLabel} uncertain={false}>
                  <TextInput
                    testID="city-input"
                    value={city}
                    onChangeText={(text) => {
                      cityTouchedRef.current = true;
                      setCity(text);
                    }}
                    placeholder="Stockholm"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.fieldInput, { color: colors.foreground }]}
                  />
                </FieldCard>
              </View>
            </View>

            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                  {conditionLabel(draft.condition, language)}
                </Text>
              </View>
              {draft.brand ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                    {draft.brand}
                  </Text>
                </View>
              ) : null}
            </View>

            {notes.trim() ? (
              <SecondaryButton
                testID="reanalyze-button"
                label={refineDraft.isPending ? t.updatingWithAi : t.updateWithAi}
                icon="refresh-cw"
                onPress={() => runRefine(notes)}
              />
            ) : null}

            <PrimaryButton
              testID="publish-button"
              label={
                createListing.isPending || publishListing.isPending
                  ? t.publishing
                  : t.publish
              }
              icon="check"
              loading={createListing.isPending || publishListing.isPending}
              onPress={onPublish}
            />
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function FieldCard({
  label,
  uncertain,
  children,
}: {
  label: string;
  uncertain: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.fieldCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.fieldHeader}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {uncertain ? (
          <View style={[styles.uncertain, { backgroundColor: colors.accent }]}>
            <Feather name="zap" size={10} color={colors.accentForeground} />
            <Text style={[styles.uncertainText, { color: colors.accentForeground }]}>
              {t.aiSuggestion}
            </Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  photoStep: { marginTop: 28, gap: 12 },
  photoBtn: {
    height: 150,
    borderRadius: colorsConst.radius + 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  center: { alignItems: 'center', gap: 14, paddingVertical: 60 },
  centerCompact: { alignItems: 'center', gap: 14, paddingVertical: 28 },
  refinedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refinedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#15803d',
  },
  analyzingStep: { gap: 8 },
  aiBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzing: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  hintSmall: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, marginLeft: 4 },
  review: { marginTop: 20, gap: 12 },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumb: { width: 84, height: 84, borderRadius: 12 },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  aiTagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  fieldCard: {
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldInput: { fontSize: 16, fontFamily: 'Inter_500Medium', padding: 0 },
  multiline: { minHeight: 110, textAlignVertical: 'top', lineHeight: 21 },
  uncertain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  uncertainText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
