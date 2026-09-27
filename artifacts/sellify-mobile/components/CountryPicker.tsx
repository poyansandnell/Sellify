import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ISO_COUNTRY_CODES, getCountryName } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type CountryPickerProps = {
  value: string;
  onChange: (countryCode: string) => void;
  language: string;
  testID: string;
  allowEmpty?: boolean;
};

export function CountryPicker({
  value,
  onChange,
  language,
  testID,
  allowEmpty = false,
}: CountryPickerProps) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const isSwedish = language === "sv";
  const displayName = (code: string) =>
    `${getCountryName(code, isSwedish ? "sv" : "en")} (${code})`;
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return ISO_COUNTRY_CODES.filter(
      (code) =>
        !needle ||
        code.toLowerCase().includes(needle) ||
        getCountryName(code, isSwedish ? "sv" : "en")
          .toLocaleLowerCase()
          .includes(needle),
    );
  }, [isSwedish, query]);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={isSwedish ? "Välj land" : "Choose country"}
        onPress={() => setVisible(true)}
        style={[
          styles.select,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.selectText,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value
            ? displayName(value)
            : isSwedish
              ? "Välj land"
              : "Choose country"}
        </Text>
        <Feather name="chevron-down" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {isSwedish ? "Välj land" : "Choose country"}
            </Text>
            <Pressable
              testID={`${testID}-close`}
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              hitSlop={10}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <TextInput
            testID={`${testID}-search`}
            value={query}
            onChangeText={setQuery}
            placeholder={isSwedish ? "Sök land" : "Search countries"}
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            style={[
              styles.search,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
          <FlatList
            data={matches}
            keyExtractor={(code) => code}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowEmpty ? (
                <Pressable
                  testID={`${testID}-any`}
                  onPress={() => {
                    onChange("");
                    setVisible(false);
                    setQuery("");
                  }}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.rowText, { color: colors.foreground }]}>
                    {isSwedish ? "Alla länder" : "Any country"}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item: code }) => (
              <Pressable
                testID={`${testID}-option-${code.toLowerCase()}`}
                onPress={() => {
                  onChange(code);
                  setVisible(false);
                  setQuery("");
                }}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.rowText, { color: colors.foreground }]}>
                  {displayName(code)}
                </Text>
                {value === code ? (
                  <Feather name="check" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                {isSwedish ? "Inga länder hittades." : "No countries found."}
              </Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  select: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  modal: { flex: 1, paddingTop: 18, paddingHorizontal: 18 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  search: {
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  row: {
    minHeight: 48,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  empty: { textAlign: "center", padding: 24, fontSize: 14 },
});