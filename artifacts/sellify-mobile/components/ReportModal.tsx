import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { PrimaryButton, SecondaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';
import { ContentReportInputReason } from '@workspace/api-client-react';

export type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ContentReportInputReason, details: string) => Promise<void>;
  loading?: boolean;
};

const reasons = [
  'inappropriate',
  'fraud',
  'prohibited_item',
  'spam',
  'harassment',
  'other',
] as const;

export function ReportModal({ visible, onClose, onSubmit, loading }: ReportModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [selectedReason, setSelectedReason] = useState<ContentReportInputReason | null>(null);
  const [details, setDetails] = useState('');

  const handleClose = () => {
    if (loading) return;
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    await onSubmit(selectedReason, details.trim());
    setSelectedReason(null);
    setDetails('');
  };

  const getReasonText = (r: ContentReportInputReason) => {
    switch (r) {
      case 'inappropriate': return t.reportReason_inappropriate;
      case 'fraud': return t.reportReason_fraud;
      case 'prohibited_item': return t.reportReason_prohibited_item;
      case 'spam': return t.reportReason_spam;
      case 'harassment': return t.reportReason_harassment;
      case 'other': return t.reportReason_other;
      default: return r;
    }
  };

  const topPad = Platform.OS === 'web' ? 40 : Math.max(40, insets.top);
  const bottomPad = Platform.OS === 'web' ? 40 : Math.max(40, insets.bottom);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.overlay, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={[styles.content, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t.reportReason}</Text>
            <Pressable testID="close-report-modal" onPress={handleClose} hitSlop={12} disabled={loading}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {reasons.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <Pressable
                  key={r}
                  testID={`report-reason-${r}`}
                  onPress={() => setSelectedReason(r)}
                  style={[
                    styles.reasonBtn,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {getReasonText(r)}
                  </Text>
                </Pressable>
              );
            })}

            {selectedReason ? (
              <TextInput
                testID="report-details-input"
                value={details}
                onChangeText={setDetails}
                placeholder={t.reportDetailsPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label={t.cancel} onPress={handleClose} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="submit-report"
                label={t.submitReport}
                onPress={handleSubmit}
                loading={loading}
                disabled={!selectedReason || loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  reasonBtn: {
    padding: 16,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    minHeight: 100,
    maxHeight: 200,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
