import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api, getToken } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Dealer, LedgerEntry } from "../lib/types";
import { Card, Button, PickerSelect, Pagination } from "../components/Themed";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "";

const ENTRY_LABEL: Record<string, string> = { collection: "আদায়", disbursement: "পরিশোধ" };

export default function LedgerScreen() {
  const nav = useNavigation<any>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dealerId, setDealerId] = useState("");
  const [error, setError] = useState("");
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((p - 1) * pageSize) });
    if (dealerId) params.set("dealerId", dealerId);
    try {
      const d = await api.get<{ entries: LedgerEntry[]; total: number }>(`/api/ledger?${params.toString()}`);
      setEntries(d.entries); setTotal(d.total);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => {
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [page, dealerId]);

  async function exportCsv() {
    try {
      const token = await getToken();
      const params = new URLSearchParams({ all: "1" });
      if (dealerId) params.set("dealerId", dealerId);
      const res = await fetch(`${API_BASE}/api/ledger/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await res.text();
      Alert.alert("CSV এক্সপোর্ট", "CSV ডেটা কপি করা হয়েছে।", [{ text: "ঠিক আছে" }]);
    } catch (e: any) { Alert.alert("ত্রুটি", e?.message); }
  }

  const dealerItems = [{ value: "", label: "সব ব্যবসায়ী" }, ...dealers.map((d) => ({ value: d.id, label: d.name }))];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>খাতা</Text>
        <Button title="এক্সপোর্ট" variant="secondary" onPress={exportCsv} />
      </View>
      <PickerSelect value={dealerId} onValueChange={(v) => { setDealerId(v); setPage(1); }} items={dealerItems} />
      {error ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{error}</Text> : null}
      <View style={{ marginTop: 12 }}>
        {entries.length === 0 ? (
          <Card><Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", paddingVertical: 16 }}>কোনো এন্ট্রি নেই।</Text></Card>
        ) : (
          entries.map((e) => (
            <TouchableOpacity key={e.id} onPress={() => nav.navigate("TransactionDetail", { id: e.transaction_id })}>
              <Card style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.icon, { backgroundColor: e.entry_type === "collection" ? "#d1fae5" : "#fee2e2" }]}>
                    <Text>{e.entry_type === "collection" ? "↓" : "↑"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "500" }}>{ENTRY_LABEL[e.entry_type] ?? e.entry_type} · {e.dealer_name || "—"}</Text>
                    <Text style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(e.occurred_at)} · {e.officer_name}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: e.entry_type === "collection" ? "#059669" : "#e11d48" }}>
                    {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(e.amount.replace(/^-/, ""))}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: "700" },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
