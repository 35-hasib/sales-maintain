import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, Dealer } from "../lib/types";
import { Card, CardTitle, StatusBadge, Button, Field, Input, Textarea, ErrorText, PickerSelect } from "../components/Themed";

type Entry = { id: string; amount: string; collectedAt?: string; disbursedAt?: string; paymentMethod: string | null; note: string | null; runningTotal?: string; photos?: string[]; recordedByOfficer?: { name: string } };
type Detail = { summary: Summary; collections: Entry[]; disbursements: Entry[] };

const PAYMENT_LABEL: Record<string, string> = { cash: "নগদ", bank: "ব্যাংক", mobile_banking: "মোবাইল ব্যাংকিং", other: "অন্যান্য" };
const PAYMENT_ITEMS = Object.entries(PAYMENT_LABEL).map(([v, l]) => ({ value: v, label: l }));

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"collection" | "disbursement" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api.get<Detail>(`/api/transactions/${id}`);
      setData(d);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleRecord() {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    const path = modal === "collection" ? "/api/collections" : "/api/disbursements";
    const dateKey = modal === "collection" ? "collectedAt" : "disbursedAt";
    try {
      const args: Record<string, unknown> = { transactionId: id, amount, paymentMethod, note: note || null };
      if (date) args[dateKey] = date;
      await api.post(path, args);
      setModal(null); setAmount(""); setNote("");
      await load();
    } catch (e: any) { Alert.alert("ত্রুটি", e?.message || "রেকর্ড করা যায়নি"); }
    finally { setBusy(false); }
  }

  if (error) return <View style={styles.center}><Text style={{ color: "#ef4444" }}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  const s = data.summary;
  const available = Number(s.total_collected) - Number(s.total_disbursed);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.title}>{s.product_description || "লেনদেন"}</Text>
      <StatusBadge status={s.status} />
      <Text style={styles.sub}>{s.seller_name} → {s.buyer_name} · {formatDate(s.transaction_date)}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Card style={{ flex: 1 }}><CardTitle>মোট</CardTitle><Text style={{ fontSize: 16, fontWeight: "700" }}>{formatTaka(s.total_amount)}</Text></Card>
        <Card style={{ flex: 1 }}><CardTitle>আদায়</CardTitle><Text style={{ fontSize: 16, fontWeight: "700", color: "#059669" }}>{formatTaka(s.total_collected)}</Text></Card>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Card style={{ flex: 1 }}><CardTitle>পরিশোধ</CardTitle><Text style={{ fontSize: 16, fontWeight: "700", color: "#e11d48" }}>{formatTaka(s.total_disbursed)}</Text></Card>
        <Card style={{ flex: 1 }}><CardTitle>জমা</CardTitle><Text style={{ fontSize: 16, fontWeight: "700" }}>{formatTaka(s.officer_held_balance)}</Text></Card>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button title="+ আদায়" onPress={() => { setModal("collection"); setAmount(""); setPaymentMethod("cash"); }} style={{ flex: 1 }} />
        <Button title="+ পরিশোধ" variant="secondary" onPress={() => { setModal("disbursement"); setAmount(""); setPaymentMethod("bank"); }} style={{ flex: 1 }} />
      </View>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>আদায় ({data.collections.length})</CardTitle>
        {data.collections.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>এখনো কিছু রেকর্ড হয়নি।</Text> : null}
        {data.collections.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#059669" }}>+{formatTaka(e.amount)}</Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>{formatDate(e.collectedAt)} · {PAYMENT_LABEL[e.paymentMethod || ""] || "—"}</Text>
              {e.note ? <Text style={{ fontSize: 11, color: "#64748b" }}>{e.note}</Text> : null}
            </View>
            {e.runningTotal ? <Text style={{ fontSize: 11, color: "#94a3b8" }}>চলমান {formatTaka(e.runningTotal)}</Text> : null}
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <CardTitle>পরিশোধ ({data.disbursements.length})</CardTitle>
        {data.disbursements.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>এখনো কিছু রেকর্ড হয়নি।</Text> : null}
        {data.disbursements.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#e11d48" }}>−{formatTaka(e.amount)}</Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>{formatDate(e.disbursedAt)} · {PAYMENT_LABEL[e.paymentMethod || ""] || "—"}</Text>
              {e.note ? <Text style={{ fontSize: 11, color: "#64748b" }}>{e.note}</Text> : null}
            </View>
            {e.runningTotal ? <Text style={{ fontSize: 11, color: "#94a3b8" }}>চলমান {formatTaka(e.runningTotal)}</Text> : null}
          </View>
        ))}
      </Card>

      <Modal visible={!!modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modal === "collection" ? "আদায় রেকর্ড করুন" : "পরিশোধ রেকর্ড করুন"}</Text>
            <Field label="পরিমাণ (৳) *">
              <Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" />
            </Field>
            <Field label="তারিখ">
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="পদ্ধতি">
              <PickerSelect value={paymentMethod} onValueChange={setPaymentMethod} items={PAYMENT_ITEMS} />
            </Field>
            <Field label="নোট">
              <Input value={note} onChangeText={setNote} placeholder="ঐচ্ছিক" />
            </Field>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button title={busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"} onPress={handleRecord} disabled={busy} style={{ flex: 1 }} />
              <Button title="বাতিল" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
});
