import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Linking } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import type { Dealer } from "../lib/types";
import { Card, Button, Field, Input, Textarea, ErrorText, Pagination, Footer, C, SheetModal } from "../components/Themed";
import { invalidateDealers } from "../lib/cache";

export default function DealersScreen() {
  const nav = useNavigation<any>();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
    if (search.trim()) params.set("q", search.trim());
    try {
      const d = await api.get<{ dealers: Dealer[]; total: number }>(`/api/dealers?${params.toString()}`);
      setDealers(d.dealers); setTotal(d.total);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { load(); }, [page, search]);

  function openNew() { setEditing(null); setFormName(""); setFormPhone(""); setFormAddress(""); setFormNotes(""); setShowModal(true); }
  function openEdit(d: Dealer) { setEditing(d); setFormName(d.name); setFormPhone(d.phone || ""); setFormAddress(d.address || ""); setFormNotes(d.notes || ""); setShowModal(true); }

  async function handleSubmit() {
    if (!formName.trim()) return;
    setBusy(true);
    const payload = { name: formName, phone: formPhone || null, address: formAddress || null, notes: formNotes || null };
    try {
      if (editing) await api.put(`/api/dealers/${editing.id}`, payload);
      else await api.post("/api/dealers", payload);
      invalidateDealers();
      setShowModal(false); await load();
    } catch (e: any) { setError(e?.message); }
    finally { setBusy(false); }
  }

  async function handleDelete(d: Dealer) {
    Alert.alert("মুছে ফেলুন", `"${d.name}" ব্যবসায়ীটি মুছে ফেলবেন?`, [
      { text: "বাতিল", style: "cancel" },
      { text: "মুছুন", style: "destructive", onPress: async () => { try { await api.del(`/api/dealers/${d.id}`); invalidateDealers(); await load(); } catch (e: any) { Alert.alert("ত্রুটি", e?.message); } } },
    ]);
  }

  async function callDealer(phone: string) {
    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url).catch(() => {});
    } else {
      Alert.alert("ফোন", phone);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>ব্যবসায়ী</Text>
        <Button title="যোগ করুন" icon="add" onPress={openNew} />
      </View>
      <TextInput style={styles.searchInput} placeholder="নাম বা ফোন দিয়ে খুঁজুন…" placeholderTextColor="#94a3b8" value={search} onChangeText={(t) => { setSearch(t); setPage(1); }} />
      {error ? <ErrorText message={error} /> : null}
      {dealers.length === 0 ? (
        <Card><Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", paddingVertical: 16 }}>কোনো ব্যবসায়ী নেই।</Text></Card>
      ) : (
        dealers.map((d) => (
          <TouchableOpacity key={d.id} onPress={() => nav.navigate("DealerDetail", { id: d.id })}>
            <Card style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>{d.name}</Text>
                  <Text style={{ fontSize: 12, color: "#64748b" }}>{d.phone || "—"}{d._count ? ` · ${d._count.transactionsAsSeller} বিক্রেতা / ${d._count.transactionsAsBuyer} ক্রেতা` : ""}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {d.phone ? (
                    <TouchableOpacity onPress={() => callDealer(d.phone!)} style={styles.iconBtn}><MaterialIcons name="call" size={16} color={C.primary} /></TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => openEdit(d)} style={styles.iconBtn}><MaterialIcons name="edit" size={16} color={C.primary} /></TouchableOpacity>
                  {d._count && d._count.transactionsAsSeller + d._count.transactionsAsBuyer === 0 ? (
                    <TouchableOpacity onPress={() => handleDelete(d)} style={styles.iconBtn}><MaterialIcons name="delete" size={16} color="#e11d48" /></TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <SheetModal visible={showModal} title={editing ? "ব্যবসায়ী সম্পাদনা" : "ব্যবসায়ী যোগ করুন"} onClose={() => setShowModal(false)}>
        <Field label="নাম *"><Input value={formName} onChangeText={setFormName} /></Field>
        <Field label="ফোন"><Input value={formPhone} onChangeText={(t) => setFormPhone(t.replace(/[^0-9]/g, "").slice(0, 15))} keyboardType="phone-pad" /></Field>
        <Field label="ঠিকানা"><Input value={formAddress} onChangeText={setFormAddress} /></Field>
        <Field label="নোট"><Textarea value={formNotes} onChangeText={setFormNotes} numberOfLines={2} /></Field>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button title="সংরক্ষণ" busy={busy} onPress={handleSubmit} style={{ flex: 1 }} />
          <Button title="বাতিল" variant="secondary" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
        </View>
      </SheetModal>
          <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: "700" },
  searchInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12, backgroundColor: "#fff" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
});
