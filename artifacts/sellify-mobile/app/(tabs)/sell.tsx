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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnalyzeImages,
  useCreateListing,
  useRefineListingDraft,
  usePublishListing,
  useRequestUploadUrl,
  getCountryFromLocale,
  getDefaultCurrency,
  type AiListingDraft,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { conditionLabel, useI18n } from '@/lib/i18n';
import { EmptyState, PrimaryButton, SecondaryButton } from '@/components/Ui';
import { VoiceNoteInput } from '@/components/VoiceNoteInput';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { CountryPicker } from '@/components/CountryPicker';
import { takeCopyListing } from '@/lib/copyListing';
import { detectDeviceLocation } from '@/lib/location';
import {
  authFailureDebug,
  errorDetail,
  errorStatus,
  StepError,
} from '@/lib/apiError';
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
  const { isSignedIn, getToken } = useAuth();

  // 401 after the API client's automatic token-refresh retry: only open the
  // login screen if Clerk actually reports signed out; otherwise show the
  // failure details so the real cause is visible.
  const handleAuthFailure = async (e: unknown) => {
    if (!isSignedIn) {
      Alert.alert(t.sessionExpired);
      router.push('/sign-in');
      return;
    }
    let hasToken = false;
    try {
      hasToken = Boolean(await getToken());
    } catch {
      hasToken = false;
    }
    Alert.alert(t.error, authFailureDebug(isSignedIn, hasToken, e));
  };
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('photos');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<AiListingDraft | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(getCountryFromLocale());
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [currency, setCurrency] = useState(() =>
    getDefaultCurrency(getCountryFromLocale()),
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [notes, setNotes] = useState('');
  const [justRefined, setJustRefined] = useState(false);
  const refinedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refinedTimerRef.current) clearTimeout(refinedTimerRef.current);
    };
  }, []);

  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    setLocationError('');
    try {
      const detected = await detectDeviceLocation();
      setCity(detected.city);
      setCountry(detected.country);
      setRegion(detected.region);
      setPostalCode(detected.postalCode);
      setCurrency(getDefaultCurrency(detected.country));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocationError(message);
      Alert.alert(
        language === 'sv' ? 'Kunde inte hämta plats' : 'Could not get location',
        message,
      );
    } finally {
      setLocating(false);
    }
  };
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
      const sourceLocation = src as typeof src & {
        country?: string;
        region?: string | null;
        postalCode?: string | null;
        currency?: string;
      };
      setImages(
        src.images.map((p) => ({ localUri: imageUrl(p) ?? '', objectPath: p })),
      );
      setTitle(src.title);
      setDescription(src.description);
      setPrice(String(Math.round(src.price)));
      setCity(src.city ?? '');
      const copiedCountry = sourceLocation.country || getCountryFromLocale();
      setCountry(copiedCountry);
      setRegion(sourceLocation.region ?? '');
      setPostalCode(sourceLocation.postalCode ?? '');
      setCurrency(
        sourceLocation.currency || getDefaultCurrency(copiedCountry),
      );
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
        setStep(returnTo);
        await handleAuthFailure(e);
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
        await handleAuthFailure(e);
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
    const cityValue = city.trim();
    if (!cityValue) {
      Alert.alert(t.cityRequired);
      return;
    }
    const countryValue = country.trim().toUpperCase();
    const currencyValue = currency.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryValue)) {
      Alert.alert(
        language === 'sv' ? 'Välj ett land' : 'Choose a country',
      );
      return;
    }
    if (!/^[A-Z]{3}$/.test(currencyValue)) {
      Alert.alert(
        language === 'sv'
          ? 'Ange en valutakod med tre bokstäver'
          : 'Enter a three-letter currency code',
      );
      return;
    }
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
          currency: currencyValue,
          priceType: 'negotiable',
          city: cityValue,
          region: region.trim() || null,
          country: countryValue,
          postalCode: postalCode.trim() || null,
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
        await handleAuthFailure(e);
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
                  label={`${t.priceLabel} (${currency || 'ISO'})`}
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
                    {Math.round(draft.priceRangeLow)}–{Math.round(draft.priceRangeHigh)} {currency}
                  </Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <FieldCard
                  label={language === 'sv' ? 'Valutakod' : 'Currency code'}
                  uncertain={false}
                >
                  <TextInput
                    testID="currency-input"
                    value={currency}
                    onChangeText={(text) => setCurrency(text.toUpperCase())}
                    maxLength={3}
                    autoCapitalize="characters"
                    placeholder="USD"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.fieldInput, { color: colors.foreground }]}
                  />
                </FieldCard>
              </View>
            </View>

            <FieldCard
              label={language === 'sv' ? 'Plats' : 'Location'}
              uncertain={false}
            >
              <View style={styles.locationStack}>
                <View style={styles.locationField}>
                  <Text style={[styles.inlineLabel, { color: colors.mutedForeground }]}>
                    {language === 'sv' ? 'Land' : 'Country'}
                  </Text>
                  <CountryPicker
                    testID="listing-country"
                    value={country}
                    language={language}
                    onChange={(code) => {
                      setCountry(code);
                      setCurrency(getDefaultCurrency(code));
                    }}
                  />
                </View>
                <View style={styles.locationField}>
                  <Text style={[styles.inlineLabel, { color: colors.mutedForeground }]}>
                    {t.cityLabel}
                  </Text>
                  <TextInput
                    testID="city-input"
                    value={city}
                    onChangeText={setCity}
                    placeholder={language === 'sv' ? 'Ange stad manuellt' : 'Enter city'}
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>
                <View style={styles.locationField}>
                  <Text style={[styles.inlineLabel, { color: colors.mutedForeground }]}>
                    {language === 'sv' ? 'Region eller delstat' : 'Region or state'}
                  </Text>
                  <TextInput
                    testID="region-input"
                    value={region}
                    onChangeText={setRegion}
                    placeholder={language === 'sv' ? 'Valfritt' : 'Optional'}
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>
                <View style={styles.locationField}>
                  <Text style={[styles.inlineLabel, { color: colors.mutedForeground }]}>
                    {language === 'sv' ? 'Postnummer' : 'Postal code'}
                  </Text>
                  <TextInput
                    testID="postal-code-input"
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder={language === 'sv' ? 'Valfritt' : 'Optional'}
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>
                <Pressable
                  testID="listing-use-location"
                  disabled={locating}
                  onPress={useCurrentLocation}
                  style={[
                    styles.useLocationButton,
                    { borderColor: colors.primary, opacity: locating ? 0.6 : 1 },
                  ]}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="crosshair" size={16} color={colors.primary} />
                  )}
                  <Text style={[styles.useLocationText, { color: colors.primary }]}>
                    {locating
                      ? language === 'sv' ? 'Hämtar plats…' : 'Finding location…'
                      : language === 'sv' ? 'Använd min plats' : 'Use my location'}
                  </Text>
                </Pressable>
                <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
                  {language === 'sv'
                    ? 'Plats används bara när du trycker. Exakta koordinater sparas inte.'
                    : 'Location is used only after you tap. Exact coordinates are not stored.'}
                </Text>
                {Platform.OS === 'web' ? (
                  <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
                    © OpenStreetMap contributors
                  </Text>
                ) : null}
                {locationError ? (
                  <Text testID="location-error" style={styles.locationError}>
                    {locationError}
                  </Text>
                ) : null}
              </View>
            </FieldCard>

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
  locationStack: { gap: 10 },
  locationField: { gap: 4 },
  inlineLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  inlineInput: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  useLocationButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  useLocationText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  locationNote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
  },
  locationError: { color: '#b91c1c', fontSize: 12, fontFamily: 'Inter_500Medium' },
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
