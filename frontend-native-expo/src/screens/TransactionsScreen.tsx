import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { getDealers } from "../lib/cache";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, Dealer } from "../lib/types";
import { Card, StatusBadge, Button, Pagination, PickerSelect, Input, EmptyState, Footer, C } from "../components/Themed";

const STATUSES = ["pending", "partially_collected", "fully_collected", "partially_disbursed", "settled"];
const STATUS_LABEL: Record<string, string> = { pending: "বাকি", partially_collected: "আংশিক আদায়", fully_collected: "সম্পূর্ণ আদায়", partially_disbursed: "আংশিক পরিশোধ", settled: "সম্পন্ন" };
const STATUS_ITEMS = STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] || s }));

export default function TransactionsScreen() {
  const nav = useNavigation<any>();
  const [txns, setTxns] = useState<Summary[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterDealer, setFilterDealer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams();
    if (filterDealer) params.set("dealerId", filterDealer);
    if (filterStatus) params.set("status", filterStatus);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("limit", String(pageSize));
    params.set("offset", String((p - 1) * pageSize));
    const q = params.toString();
    try {
      const d = await api.get<{ transactions: Summary[]; total: number }>(`/api/transactions${q ? `?${q}` : ""}`);
      setTxns(d.transactions);
      if (typeof d.total === "number") setTotal(d.total);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => {
    getDealers().then(setDealers).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [page, filterDealer, filterStatus, dateFrom, dateTo]);

  const dealerItems = [{ value: "", label: "সব ব্যবসায়ী" }, ...dealers.map((d) => ({ value: d.id, label: d.name }))];

  function clearFilters() {
    setFilterDealer(""); setFilterStatus(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  const activeFilterCount = [filterDealer, filterStatus, dateFrom, dateTo].filter(Boolean).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>লেনদেন</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            style={[styles.filterBtn, (showFilters || activeFilterCount > 0) && styles.filterBtnActive]}
          >
            <MaterialIcons name="tune" size={18} color={showFilters || activeFilterCount > 0 ? "#fff" : C.primary} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: showFilters || activeFilterCount > 0 ? "#fff" : C.primary }}>
              ফিল্টার{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Text>
          </TouchableOpacity>
          <Button title="যোগ করুন" icon="add" onPress={() => nav.navigate("NewTransaction")} />
        </View>
      </View>
      {showFilters ? (
        <Card style={{ marginBottom: 12 }}>
          <PickerSelect value={filterDealer} onValueChange={(v) => { setFilterDealer(v); setPage(1); }} items={dealerItems} placeholder="সব ব্যবসায়ী" />
          <View style={{ height: 8 }} />
          <PickerSelect value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }} items={[{ value: "", label: "সব অবস্থা" }, ...STATUS_ITEMS]} placeholder="সব অবস্থা" />
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
      {error ? <Text style={{ color: "#ef4444", marginBottom: 8 }}>{error}</Text> : null}
      {txns.length === 0 ? (
        <EmptyState text="কোনো লেনদেন পাওয়া যায়নি।" />
      ) : (
        txns.map((t) => (
          <Card key={t.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => nav.navigate("TransactionDetail", { id: t.id })}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>{t.product_description || "লেনদেন"}</Text>
                  <Text style={{ fontSize: 12, color: "#64748b" }}>{t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}</Text>
                </View>
              </TouchableOpacity>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: "700" }}>{formatTaka(t.total_amount)}</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <StatusBadge status={t.status} />
                </View>
              </View>
            </View>
          </Card>
        ))
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: "700" },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
});