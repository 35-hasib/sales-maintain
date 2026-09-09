import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { api } from "../lib/api";
import { getDealers, invalidateDashboard } from "../lib/cache";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, Dealer } from "../lib/types";
import { Card, CardTitle, StatusBadge, Button, Field, Input, Textarea, ErrorText, PickerSelect, SheetModal, Footer, C } from "../components/Themed";
import PhotoPicker from "../components/PhotoPicker";
import PhotoGallery from "../components/PhotoGallery";

type Entry = { id: string; amount: string; collectedAt?: string; disbursedAt?: string; paymentMethod: string | null; note: string | null; runningTotal?: string; photos?: string[]; recordedByOfficer?: { name: string } };
type Detail = { summary: Summary; collections: Entry[]; disbursements: Entry[] };

const PAYMENT_LABEL: Record<string, string> = { cash: "নগদ", bank: "ব্যাংক", mobile_banking: "মোবাইল ব্যাংকিং", other: "অন্যান্য" };
const PAYMENT_ITEMS = Object.entries(PAYMENT_LABEL).map(([v, l]) => ({ value: v, label: l }));

type Mode =
  | { kind: "record"; entryType: "collection" | "disbursement" }
  | { kind: "editTx" }
  | { kind: "editEntry"; entryType: "collection" | "disbursement"; entry: Entry }
  | null;

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params;
  const [data, setData] = useState<Detail | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [sellerDealerId, setSellerDealerId] = useState("");
  const [buyerDealerId, setBuyerDealerId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [productDescription, setProductDescription] = useState("");

  async function load() {
    try {
      const d = await api.get<Detail>(`/api/transactions/${id}`);
      setData(d);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => {
    load();
    getDealers().then(setDealers).catch(() => {});
  }, [id]);

  function openRecord(entryType: "collection" | "disbursement") {
    setMode({ kind: "record", entryType });
    setAmount(""); setDate(new Date().toISOString().slice(0, 10)); setPaymentMethod(entryType === "collection" ? "cash" : "bank"); setNote(""); setPhotos([]); setFormError("");
  }

  function openEditTx() {
    if (!data) return;
    const s = data.summary;
    setMode({ kind: "editTx" });
    setSellerDealerId(s.seller_dealer_id); setBuyerDealerId(s.buyer_dealer_id);
    setTotalAmount(s.total_amount); setProductDescription(s.product_description || "");
    setDate(s.transaction_date.slice(0, 10)); setPhotos(s.photos || []); setFormError("");
  }

  function openEditEntry(entryType: "collection" | "disbursement", entry: Entry) {
    setMode({ kind: "editEntry", entryType, entry });
    setAmount(entry.amount); setDate((entry.collectedAt || entry.disbursedAt || new Date().toISOString()).slice(0, 10));
    setPaymentMethod(entry.paymentMethod || "cash"); setNote(entry.note || ""); setPhotos(entry.photos || []); setFormError("");
  }

  async function handleRecord() {
    if (!amount || Number(amount) <= 0) { setFormError("পরিমাণ অবশ্যই ০-এর বেশি হতে হবে।"); return; }
    if (!mode || mode.kind !== "record") return;
    setBusy(true); setFormError("");
    const path = mode.entryType === "collection" ? "/api/collections" : "/api/disbursements";
    const dateKey = mode.entryType === "collection" ? "collectedAt" : "disbursedAt";
    try {
      const args: Record<string, unknown> = { transactionId: id, amount, paymentMethod, note: note || null, photos };
      if (date) args[dateKey] = date;
      const res = await api.post<{ warning?: string }>(path, args);
      if (res?.warning) Alert.alert("সতর্কতা", res.warning);
      invalidateDashboard();
      setMode(null); await load();
    } catch (e: any) { setFormError(e?.message || "রেকর্ড করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function handleEditTx() {
    if (!sellerDealerId || !buyerDealerId || !totalAmount || Number(totalAmount) <= 0) {
      setFormError("বিক্রেতা, ক্রেতা ও মোট পরিমাণ প্রয়োজন।"); return;
    }
    if (sellerDealerId === buyerDealerId) { setFormError("বিক্রেতা ও ক্রেতা একই হতে পারবে না।"); return; }
    setBusy(true); setFormError("");
    try {
      await api.put(`/api/transactions/${id}`, {
        sellerDealerId, buyerDealerId, totalAmount, productDescription: productDescription || null, transactionDate: date, photos,
      });
      invalidateDashboard();
      setMode(null); await load();
    } catch (e: any) { setFormError(e?.message || "আপডেট করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function handleEditEntry() {
    if (!mode || mode.kind !== "editEntry") return;
    if (!amount || Number(amount) <= 0) { setFormError("পরিমাণ অবশ্যই ০-এর বেশি হতে হবে।"); return; }
    setBusy(true); setFormError("");
    const { entryType, entry } = mode;
    const path = entryType === "collection" ? `/api/collections/${entry.id}` : `/api/disbursements/${entry.id}`;
    const dateKey = entryType === "collection" ? "collectedAt" : "disbursedAt";
    try {
      const args: Record<string, unknown> = { amount, paymentMethod, note: note || null, photos };
      if (date) args[dateKey] = date;
      await api.put(path, args);
      invalidateDashboard();
      setMode(null); await load();
    } catch (e: any) { setFormError(e?.message || "আপডেট করা যায়নি"); }
    finally { setBusy(false); }
  }

  if (error) return <View style={styles.center}><Text style={{ color: "#ef4444" }}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  const s = data.summary;
  const payableNow = Number(s.total_collected) - Number(s.total_disbursed);
  const collectionsTotal = data.collections.reduce((acc, e) => acc + Number(e.amount), 0);
  const disbursementsTotal = data.disbursements.reduce((acc, e) => acc + Number(e.amount), 0);
  const dealerItems = dealers.map((d) => ({ value: d.id, label: d.name }));
  const emptyItems = [{ value: "", label: "নির্বাচন করুন" }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={styles.title}>{s.product_description || "লেনদেন"}</Text>
        <StatusBadge status={s.status} />
        <TouchableOpacity onPress={openEditTx} hitSlop={8}><MaterialIcons name="edit" size={17} color={C.primary} /></TouchableOpacity>
      </View>
      <Text style={styles.sub}>{s.seller_name} (বিক্রেতা) → {s.buyer_name} (ক্রেতা) · {formatDate(s.transaction_date)}</Text>

      <Card style={{ marginTop: 12 }}>
        <CardTitle>মোট পরিমাণ</CardTitle>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{formatTaka(s.total_amount)}</Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Card style={{ flex: 1 }}>
          <CardTitle>আদায়কৃত</CardTitle>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#059669" }}>{formatTaka(s.total_collected)}</Text>
          <Text style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>ক্রেতার নিকট বাকি: {formatTaka(s.amount_due_from_buyer)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardTitle>পরিশোধিত</CardTitle>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#e11d48" }}>{formatTaka(s.total_disbursed)}</Text>
          <Text style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>বিক্রেতাকে বাকি: {formatTaka(s.amount_due_to_seller)}</Text>
        </Card>
      </View>
      <Card style={{ marginTop: 8, backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}>
        <CardTitle>কর্মকর্তার হাতে থাকা টাকা</CardTitle>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#065f46" }}>{formatTaka(s.officer_held_balance)}</Text>
        <Text style={{ fontSize: 11, color: "#059669", marginTop: 4 }}>এখন পরিশোধযোগ্য: {formatTaka(String(payableNow))}</Text>
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button title="আদায় রেকর্ড করুন" icon="add" onPress={() => openRecord("collection")} style={{ flex: 1 }} />
        <Button title="পরিশোধ রেকর্ড করুন" icon="add" variant="secondary" onPress={() => openRecord("disbursement")} style={{ flex: 1 }} />
      </View>

      {s.photos && s.photos.length > 0 ? (
        <Card style={{ marginTop: 12 }}>
          <CardTitle>লেনদেনের ছবি</CardTitle>
          <PhotoGallery photos={s.photos} large />
        </Card>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle>ক্রেতার কাছ থেকে আদায় ({data.collections.length})</CardTitle>
          <Text style={{ fontSize: 12, color: "#059669", fontWeight: "600" }}>{formatTaka(String(collectionsTotal))}</Text>
        </View>
        {data.collections.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>এখনো কিছু রেকর্ড হয়নি।</Text> : null}
        {data.collections.map((e) => (
          <EntryRow key={e.id} e={e} color="#059669" sign="+" dateKey="collectedAt" onEdit={() => openEditEntry("collection", e)} />
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle>বিক্রেতাকে পরিশোধ ({data.disbursements.length})</CardTitle>
          <Text style={{ fontSize: 12, color: "#e11d48", fontWeight: "600" }}>{formatTaka(String(disbursementsTotal))}</Text>
        </View>
        {data.disbursements.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>এখনো কিছু রেকর্ড হয়নি।</Text> : null}
        {data.disbursements.map((e) => (
          <EntryRow key={e.id} e={e} color="#e11d48" sign="−" dateKey="disbursedAt" onEdit={() => openEditEntry("disbursement", e)} />
        ))}
      </Card>

      <SheetModal visible={mode?.kind === "record"} title={mode?.kind === "record" && mode.entryType === "collection" ? "আদায় রেকর্ড করুন" : "পরিশোধ রেকর্ড করুন"} onClose={() => setMode(null)}>
        <Field label="পরিমাণ (৳) *">
          <Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" />
        </Field>
        <Field label="তারিখ">
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="পরিশোধের পদ্ধতি">
          <PickerSelect value={paymentMethod} onValueChange={setPaymentMethod} items={PAYMENT_ITEMS} />
        </Field>
        <Field label="নোট">
          <Input value={note} onChangeText={setNote} placeholder="ঐচ্ছিক" />
        </Field>
        <Field label="ছবি">
          <PhotoPicker value={photos} onChange={setPhotos} folder={mode?.kind === "record" && mode.entryType === "collection" ? "salesmaintain/collections" : "salesmaintain/disbursements"} />
        </Field>
        <ErrorText message={formError} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button title="সংরক্ষণ" busy={busy} onPress={handleRecord} style={{ flex: 1 }} />
          <Button title="বাতিল" variant="secondary" onPress={() => setMode(null)} style={{ flex: 1 }} />
        </View>
      </SheetModal>

      <SheetModal visible={mode?.kind === "editTx"} title="লেনদেন সম্পাদনা" onClose={() => setMode(null)}>
        <Field label="বিক্রেতা ব্যবসায়ী *">
          <PickerSelect value={sellerDealerId} onValueChange={setSellerDealerId} items={[...emptyItems, ...dealerItems]} />
        </Field>
        <Field label="ক্রেতা ব্যবসায়ী *">
          <PickerSelect value={buyerDealerId} onValueChange={setBuyerDealerId} items={[...emptyItems, ...dealerItems]} />
        </Field>
        <Field label="মোট পরিমাণ (৳) *">
          <Input keyboardType="decimal-pad" value={totalAmount} onChangeText={setTotalAmount} placeholder="125000.00" />
        </Field>
        <Field label="পণ্যের বিবরণ">
          <Textarea value={productDescription} onChangeText={setProductDescription} />
        </Field>
        <Field label="লেনদেনের তারিখ">
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="ছবি">
          <PhotoPicker value={photos} onChange={setPhotos} folder="salesmaintain/transactions" />
        </Field>
        <ErrorText message={formError} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button title="সংরক্ষণ" busy={busy} onPress={handleEditTx} style={{ flex: 1 }} />
          <Button title="বাতিল" variant="secondary" onPress={() => setMode(null)} style={{ flex: 1 }} />
        </View>
      </SheetModal>

      <SheetModal visible={mode?.kind === "editEntry"} title={mode?.kind === "editEntry" && mode.entryType === "collection" ? "আদায় সম্পাদনা" : "পরিশোধ সম্পাদনা"} onClose={() => setMode(null)}>
        <Field label="পরিমাণ (৳) *">
          <Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" />
        </Field>
        <Field label="তারিখ">
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="পরিশোধের পদ্ধতি">
          <PickerSelect value={paymentMethod} onValueChange={setPaymentMethod} items={PAYMENT_ITEMS} />
        </Field>
        <Field label="নোট">
          <Input value={note} onChangeText={setNote} placeholder="ঐচ্ছিক" />
        </Field>
        <Field label="ছবি">
          <PhotoPicker value={photos} onChange={setPhotos} folder={mode?.kind === "editEntry" && mode.entryType === "collection" ? "salesmaintain/collections" : "salesmaintain/disbursements"} />
        </Field>
        <ErrorText message={formError} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button title="সংরক্ষণ" busy={busy} onPress={handleEditEntry} style={{ flex: 1 }} />
          <Button title="বাতিল" variant="secondary" onPress={() => setMode(null)} style={{ flex: 1 }} />
        </View>
      </SheetModal>
          <Footer />
    </ScrollView>
  );
}

function EntryRow({ e, color, sign, dateKey, onEdit }: { e: Entry; color: string; sign: string; dateKey: "collectedAt" | "disbursedAt"; onEdit: () => void }) {
  return (
    <View style={styles.entryRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color }}>{sign}{formatTaka(e.amount)}</Text>
        <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {formatDate(e[dateKey])} · {PAYMENT_LABEL[e.paymentMethod || ""] || "—"}{e.recordedByOfficer?.name ? ` · ${e.recordedByOfficer.name}` : ""}
        </Text>
        {e.note ? <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{e.note}</Text> : null}
        {e.photos && e.photos.length > 0 ? <PhotoGallery photos={e.photos} /> : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {e.runningTotal ? <Text style={{ fontSize: 11, color: "#94a3b8" }}>চলমান {formatTaka(e.runningTotal)}</Text> : null}
        <TouchableOpacity onPress={onEdit} hitSlop={8}><MaterialIcons name="edit" size={16} color={C.primary} /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
});