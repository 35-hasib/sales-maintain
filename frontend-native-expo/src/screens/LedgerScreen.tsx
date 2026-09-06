import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api, getToken } from "../lib/api";
import { getDealers } from "../lib/cache";
import { formatTaka, formatDate } from "../lib/format";
import type { Dealer, LedgerEntry } from "../lib/types";
import { Card, Button, PickerSelect, Pagination, Input, EmptyState, Footer, C } from "../components/Themed";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "";
const ENTRY_LABEL: Record<string, string> = { collection: "আদায়", disbursement: "পরিশোধ" };

export default function LedgerScreen() {
  const nav = useNavigation<any>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dealerId, setDealerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((p - 1) * pageSize) });
    if (dealerId) params.set("dealerId", dealerId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const d = await api.get<{ entries: LedgerEntry[]; total: number }>(`/api/ledger?${params.toString()}`);
      setEntries(d.entries); setTotal(d.total);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => {
    getDealers().then(setDealers).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [page, dealerId, dateFrom, dateTo]);

  async function exportCsv(all: boolean) {
    setExporting(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (all) params.set("all", "1");
      if (!all) {
        if (dealerId) params.set("dealerId", dealerId);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
      }
      const res = await fetch(`${API_BASE}/api/ledger/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("CSV ডাউনলোড ব্যর্থ হয়েছে");
      const text = await res.text();
      const fileUri = FileSystem.cacheDirectory + `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Ledger CSV" });
      } else {
        Alert.alert("CSV এক্সপোর্ট", text.length < 400 ? text : `সম্পূর্ণ লেডজার (${text.length} অক্ষর) ডাউনলোড হয়েছে।`);
      }
    } catch (e: any) {
      Alert.alert("ত্রুটি", e?.message || "এক্সপোর্ট করা যায়নি");
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setDealerId(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  const dealerItems = [{ value: "", label: "সব ব্যবসায়ী" }, ...dealers.map((d) => ({ value: d.id, label: d.name }))];

  const activeFilterCount = [dealerId, dateFrom, dateTo].filter(Boolean).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>খাতা</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            style={[styles.filterBtn, (showFilters || activeFilterCount > 0) && styles.filterBtnActive]}
          >
            <MaterialIcons name="tune" size={18} color={showFilters || activeFilterCount > 0 ? "#fff" : C.primary} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: showFilters || activeFilterCount > 0 ? "#fff" : C.primary }}>
              ফিল্টার{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Text>
          </TouchableOpacity>
          <Button
            title={activeFilterCount > 0 ? "ফিল্টার এক্সপোর্ট" : "সব এক্সপোর্ট"}
            icon="file-download"
            variant="secondary"
            busy={exporting}
            disabled={exporting}
            onPress={() => exportCsv(activeFilterCount === 0)}
          />
        </View>
      </View>

      {showFilters ? (
        <Card style={{ marginBottom: 12 }}>
          <PickerSelect value={dealerId} onValueChange={(v) => { setDealerId(v); setPage(1); }} items={dealerItems} placeholder="সব ব্যবসায়ী" />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>শুরুর তারিখ</Text>
              <Input value={dateFrom} onChangeText={(t) => { setDateFrom(t); setPage(1); }} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>শেষ তারিখ</Text>
              <Input value={dateTo} onChangeText={(t) => { setDateTo(t); setPage(1); }} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <Button title="মুছুন" variant="secondary" onPress={clearFilters} style={{ marginTop: 8, alignSelf: "flex-start" }} />
        </Card>
      ) : null}

      {error ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{error}</Text> : null}
      {entries.length === 0 ? (
        <EmptyState text="কোনো এন্ট্রি নেই।" />
      ) : (
        entries.map((e) => (
          <TouchableOpacity key={e.id} onPress={() => nav.navigate("TransactionDetail", { id: e.transaction_id })}>
            <Card style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.icon, { backgroundColor: e.entry_type === "collection" ? "#d1fae5" : "#fee2e2" }]}>
                  <MaterialIcons name={e.entry_type === "collection" ? "south" : "north"} size={15} color={e.entry_type === "collection" ? "#059669" : "#e11d48"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500" }}>{ENTRY_LABEL[e.entry_type] ?? e.entry_type} · {e.dealer_name || "—"}</Text>
                  <Text style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(e.occurred_at)} · {e.officer_name}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: e.entry_type === "collection" ? "#059669" : "#e11d48" }}>
                  {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(String(e.amount).replace(/^-/, ""))}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  heading: { fontSize: 20, fontWeight: "700" },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
});