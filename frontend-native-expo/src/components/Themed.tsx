import React, { useState, type ReactNode } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, type TextInputProps } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useTopInset() {
  return useSafeAreaInsets().top;
}

export const C = {
  primary: "#047857",
  primaryLight: "#059669",
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
  light: "#94a3b8",
  border: "#e2e8f0",
  red: "#ef4444",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  green: "#059669",
  greenBg: "#ecfdf5",
  greenBorder: "#a7f3d0",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  indigo: "#4f46e5",
  indigoBg: "#eef2ff",
  indigoBorder: "#c7d2fe",
  rose: "#e11d48",
  roseBg: "#fee2e2",
};

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.card },
  select: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.card },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: "center" as const, justifyContent: "center" as const },
  btnPrimary: { backgroundColor: C.primary },
  btnSecondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: C.red },
  btnText: { fontSize: 14, fontWeight: "600" as const, color: "#fff" },
  btnTextSecondary: { fontSize: 14, fontWeight: "600" as const, color: C.text },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, color: "#475569", marginBottom: 4 },
  errorBox: { backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBorder, borderRadius: 8, padding: 12 },
  errorText: { fontSize: 13, color: C.red },
  alertBox: { backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amberBorder, borderRadius: 8, padding: 12 },
  alertText: { fontSize: 13, color: C.amber },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "600" as const },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
});

const STATUS_LABELS: Record<string, string> = {
  pending: "বাকি",
  partially_collected: "আংশিক আদায়",
  fully_collected: "সম্পূর্ণ আদায়",
  partially_disbursed: "আংশিক পরিশোধ",
  settled: "সম্পন্ন",
  cancelled: "বাতিল",
};

const BADGE_STATUS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#f1f5f9", text: "#475569" },
  partially_collected: { bg: "#fef3c7", text: "#92400e" },
  fully_collected: { bg: "#dbeafe", text: "#1d4ed8" },
  partially_disbursed: { bg: "#e0e7ff", text: "#4338ca" },
  settled: { bg: "#d1fae5", text: "#065f46" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
};

export { STATUS_LABELS };

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={s.cardTitle}>{children}</Text>;
}

export function Button({ title, onPress, variant = "primary", disabled, style, icon, busy }: { title: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; style?: any; icon?: React.ComponentProps<typeof MaterialIcons>["name"]; busy?: boolean }) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const spinnerColor = isPrimary || isDanger ? "#fff" : C.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={[s.btn, isPrimary ? s.btnPrimary : isDanger ? s.btnDanger : s.btnSecondary, (disabled || busy) && { opacity: 0.6 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={spinnerColor} /> : (
        icon ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialIcons name={icon} size={17} color={spinnerColor} />
            <Text style={isPrimary || isDanger ? s.btnText : s.btnTextSecondary}>{title}</Text>
          </View>
        ) : (
          <Text style={isPrimary || isDanger ? s.btnText : s.btnTextSecondary}>{title}</Text>
        )
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} style={[s.input, props.style]} placeholderTextColor="#94a3b8" />;
}

export function Textarea({ value, onChangeText, placeholder, numberOfLines = 3 }: { value: string; onChangeText: (t: string) => void; placeholder?: string; numberOfLines?: number }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94a3b8" multiline numberOfLines={numberOfLines} style={[s.input, { minHeight: numberOfLines * 20, textAlignVertical: "top" as const }]} />;
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <View style={s.errorBox}><Text style={s.errorText}>{message}</Text></View>;
}

export function AlertBox({ children }: { children: ReactNode }) {
  return <View style={s.alertBox}><Text style={s.alertText}>{children}</Text></View>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <Text style={{ fontSize: 13, color: C.muted, textAlign: "center", paddingVertical: 16 }}>{text}</Text>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors = BADGE_STATUS[status] || { bg: "#f1f5f9", text: "#475569" };
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Text style={[s.badgeText, { color: colors.text }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

const BN_DIGIT = "০১২৩৪৫৬৭৮৯";
const bnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGIT[Number(d)]);

export function Footer() {
  return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <Text style={{ fontSize: 11, color: C.light }}>SalesMaintain · টাকার হিসাব · {bnDigits(String(new Date().getFullYear()))}</Text>
    </View>
  );
}

export function Pagination({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 }}>
      <Text style={{ fontSize: 12, color: C.muted }}>মোট {total}টি · {page} / {totalPages}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="পূর্ববর্তী" variant="secondary" disabled={page <= 1} onPress={() => onPageChange(page - 1)} />
        <Button title="পরবর্তী" variant="secondary" disabled={page >= totalPages} onPress={() => onPageChange(page + 1)} />
      </View>
    </View>
  );
}

export function SheetModal({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalContent} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {title ? <Text style={s.modalTitle}>{title}</Text> : null}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type SelectItem = { label: string; value: string };

export function PickerSelect({ value, onValueChange, items, placeholder }: { value: string; onValueChange: (v: string) => void; items: SelectItem[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);
  return (
    <>
      <TouchableOpacity style={[s.select, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? C.text : C.light }} numberOfLines={1}>{selected?.label || placeholder || "নির্বাচন করুন"}</Text>
        <MaterialIcons name="expand-more" size={20} color={C.light} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 16, maxHeight: "70%" }} onPress={() => {}}>
            <Text style={[s.modalTitle, { paddingHorizontal: 20, textAlign: "center" }]}>{placeholder || "নির্বাচন করুন"}</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {items.map((it) => {
                const active = it.value === value;
                return (
                  <TouchableOpacity
                    key={it.value}
                    style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: active ? C.greenBg : "transparent", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    onPress={() => { onValueChange(it.value); setOpen(false); }}
                  >
                    <Text style={{ fontSize: 15, color: active ? C.primary : C.text, fontWeight: active ? "700" : "400" }}>{it.label}</Text>
                    {active ? <MaterialIcons name="check" size={18} color={C.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Select({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) {
  const items = React.Children.toArray(children)
    .filter((c): c is React.ReactElement<{ value?: string; label?: string }> => React.isValidElement(c))
    .map((c) => ({ value: c.props.value || "", label: c.props.label || c.props.value || "" }));
  return <PickerSelect value={value} onValueChange={onValueChange} items={items} />;
}