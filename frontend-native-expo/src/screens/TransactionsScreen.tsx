import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, Dealer } from "../lib/types";
import { Card, StatusBadge, Button, Pagination, PickerSelect, Input } from "../components/Themed";

const STATUSES = ["pending", "partially_collected", "fully_collected", "partially_disbursed", "settled"];
const STATUS_ITEMS = STATUSES.map((s) => ({ value: s, label: { pending: "বাকি", partially_collected: "আংশিক আদায়", fully_collected: "সম্পূর্ণ আদায়", partially_disbursed: "আংশিক পরিশোধ", settled: "সম্পন্ন" }[s] || s }));

export default function TransactionsScreen() {
  const nav = useNavigation<any>();
  const [txns, setTxns] = useState<Summary[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterDealer, setFilterDealer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState("");
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams();
    if (filterDealer) params.set("dealerId", filterDealer);
    if (filterStatus) params.set("status", filterStatus);
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
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [page, filterDealer, filterStatus]);

  const dealerItems = [{ value: "", label: "সব ব্যবসায়ী" }, ...dealers.map((d) => ({ value: d.id, label: d.name }))];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>লেনদেন</Text>
        <Button title="+ নতুন" onPress={() => nav.navigate("NewTransaction")} />
      </View>
      <View style={{ marginBottom: 12 }}>
        <PickerSelect value={filterDealer} onValueChange={(v) => { setFilterDealer(v); setPage(1); }} items={dealerItems} placeholder="সব ব্যবসায়ী" />
        <View style={{ height: 8 }} />
        <PickerSelect value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }} items={[{ value: "", label: "সব অবস্থা" }, ...STATUS_ITEMS]} placeholder="সব অবস্থা" />
      </View>
      {error ? <Text style={{ color: "#ef4444", marginBottom: 8 }}>{error}</Text> : null}
      {txns.length === 0 ? (
        <Card><Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", paddingVertical: 16 }}>কোনো লেনদেন পাওয়া যায়নি।</Text></Card>
      ) : (
        txns.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => nav.navigate("TransactionDetail", { id: t.id })}>
            <Card style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>{t.product_description || "লেনদেন"}</Text>
                  <Text style={{ fontSize: 12, color: "#64748b" }}>{t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700" }}>{formatTaka(t.total_amount)}</Text>
                  <StatusBadge status={t.status} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: "700" },
});
