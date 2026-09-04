import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, LedgerEntry } from "../lib/types";
import { Card, CardTitle, StatusBadge, Button } from "../components/Themed";

type DashboardData = {
  floatHeld: string;
  totalDueFromBuyers: string;
  totalDueToSellers: string;
  totalTransactions: number;
  recentActivity: LedgerEntry[];
  unsettledTransactions: Summary[];
};

const ENTRY_LABEL: Record<string, string> = { collection: "আদায়", disbursement: "পরিশোধ" };

export default function DashboardScreen() {
  const nav = useNavigation<any>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <View style={styles.center}><Text style={{ color: "#ef4444" }}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /><Text style={{ marginTop: 8, color: "#64748b" }}>ড্যাশবোর্ড লোড হচ্ছে…</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.row}>
        <Text style={styles.heading}>হোম</Text>
        <Button title="+ নতুন" onPress={() => nav.navigate("NewTransaction")} />
      </View>

      <View style={styles.grid}>
        <KpiCard label="হাতে থাকা টাকা" value={formatTaka(data.floatHeld)} />
        <KpiCard label="ক্রেতার নিকট প্রাপ্য" value={formatTaka(data.totalDueFromBuyers)} />
        <KpiCard label="বিক্রেতাকে প্রদেয়" value={formatTaka(data.totalDueToSellers)} />
      </View>

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle>বাকি লেনদেন</CardTitle>
          <Text style={{ fontSize: 12, color: "#94a3b8" }}>মোট {data.totalTransactions}টি</Text>
        </View>
        {data.unsettledTransactions.length === 0 ? (
          <Text style={{ fontSize: 13, color: "#64748b", paddingVertical: 8 }}>কোনো বাকি লেনদেন নেই।</Text>
        ) : (
          data.unsettledTransactions.map((t) => (
            <TouchableOpacity key={t.id} style={styles.listItem} onPress={() => nav.navigate("TransactionDetail", { id: t.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{t.product_description || "লেনদেন"}</Text>
                <Text style={styles.itemSub}>{t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatTaka(t.amount_due_to_seller)}</Text>
                <StatusBadge status={t.status} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <CardTitle>সাম্প্রতিক কার্যক্রম</CardTitle>
        {data.recentActivity.length === 0 ? (
          <Text style={{ fontSize: 13, color: "#64748b", paddingVertical: 8 }}>এখনো কোনো কার্যক্রম নেই।</Text>
        ) : (
          data.recentActivity.map((e) => (
            <TouchableOpacity key={e.id} style={styles.listItem} onPress={() => nav.navigate("TransactionDetail", { id: e.transaction_id })}>
              <View style={[styles.icon, { backgroundColor: e.entry_type === "collection" ? "#d1fae5" : e.entry_type === "disbursement" ? "#fee2e2" : "#f1f5f9" }]}>
                <Text>{e.entry_type === "collection" ? "↓" : e.entry_type === "disbursement" ? "↑" : "↩"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{ENTRY_LABEL[e.entry_type] ?? e.entry_type} · {e.dealer_name || "—"}</Text>
                <Text style={styles.itemSub}>{formatDate(e.occurred_at)}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: e.entry_type === "collection" ? "#059669" : e.entry_type === "disbursement" ? "#e11d48" : "#64748b" }}>
                {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(e.amount.replace(/^-/, ""))}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#1e293b" }}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: "700" },
  grid: { flexDirection: "row", gap: 8 },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 13, fontWeight: "500", color: "#1e293b" },
  itemSub: { fontSize: 12, color: "#64748b" },
});
