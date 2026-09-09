import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { getDashboard } from "../lib/cache";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, LedgerEntry } from "../lib/types";
import { Card, CardTitle, StatusBadge, Button, SheetModal, Footer } from "../components/Themed";

type DashboardData = {
  floatHeld: string;
  totalDueFromBuyers: string;
  totalDueToSellers: string;
  totalTransactions: number;
  recentActivity: LedgerEntry[];
  unsettledTransactions: Summary[];
};

type BreakdownRow = {
  transaction_id: string;
  product_description: string | null;
  transaction_date: string;
  status: string;
  seller_name: string | null;
  buyer_name: string | null;
  dealer_id: string;
  dealer_name: string;
  amount: string;
};

const ENTRY_LABEL: Record<string, string> = { collection: "আদায়", disbursement: "পরিশোধ" };

const BREAKDOWN_LABEL: Record<string, string> = {
  held: "হাতে আছে",
  buyers: "পাওয়া যাবে",
  sellers: "দিতে হবে",
};

type BreakdownType = "held" | "buyers" | "sellers";

export default function DashboardScreen() {
  const nav = useNavigation<any>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [breakdownType, setBreakdownType] = useState<BreakdownType | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");

  useEffect(() => {
    getDashboard<DashboardData>().then(setData).catch((e) => setError(e.message));
  }, []);

  const openBreakdown = useCallback((type: BreakdownType) => {
    setBreakdownType(type);
    setBreakdown([]);
    setBreakdownError("");
    setBreakdownLoading(true);
    api
      .get<{ type: string; breakdown: BreakdownRow[] }>(`/api/dashboard/breakdown?type=${type}`)
      .then((d) => setBreakdown(d.breakdown))
      .catch((e) => setBreakdownError(e.message))
      .finally(() => setBreakdownLoading(false));
  }, []);

  if (error) return <View style={styles.center}><Text style={{ color: "#ef4444" }}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  const total = breakdown.reduce((acc, r) => acc + Number(r.amount), 0);
  const grouped: { dealer_id: string; dealer_name: string; amount: number; rows: BreakdownRow[] }[] = [];
  for (const r of breakdown) {
    let g = grouped.find((x) => x.dealer_id === r.dealer_id);
    if (!g) {
      g = { dealer_id: r.dealer_id, dealer_name: r.dealer_name, amount: 0, rows: [] };
      grouped.push(g);
    }
    g.amount += Number(r.amount);
    g.rows.push(r);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={styles.row}>
        <Text style={styles.heading}>হোম</Text>
        <Button title="নতুন লেনদেন" icon="add" onPress={() => nav.navigate("NewTransaction")} />
      </View>

      <View style={styles.grid}>
        <StatCard label="হাতে আছে" value={formatTaka(data.floatHeld)} onPress={() => openBreakdown("held")} />
        <StatCard label="পাওয়া যাবে" value={formatTaka(data.totalDueFromBuyers)} onPress={() => openBreakdown("buyers")} />
        <StatCard label="দিতে হবে" value={formatTaka(data.totalDueToSellers)} onPress={() => openBreakdown("sellers")} />
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
                <MaterialIcons name={e.entry_type === "collection" ? "south" : e.entry_type === "disbursement" ? "north" : "replay"} size={15} color={e.entry_type === "collection" ? "#059669" : e.entry_type === "disbursement" ? "#e11d48" : "#64748b"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{ENTRY_LABEL[e.entry_type] ?? e.entry_type} · {e.dealer_name || "—"}</Text>
                <Text style={styles.itemSub}>{formatDate(e.occurred_at)}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: e.entry_type === "collection" ? "#059669" : e.entry_type === "disbursement" ? "#e11d48" : "#64748b" }}>
                {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(String(e.amount).replace(/^-/, ""))}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <SheetModal visible={!!breakdownType} title={breakdownType ? BREAKDOWN_LABEL[breakdownType] : ""} onClose={() => setBreakdownType(null)}>
        {breakdownLoading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator size="small" color="#047857" /></View>
        ) : breakdownError ? (
          <Text style={{ color: "#ef4444", textAlign: "center", paddingVertical: 16 }}>{breakdownError}</Text>
        ) : (
          <>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#1e293b" }}>{formatTaka(String(total))}</Text>
            </View>
            {grouped.length === 0 ? (
              <Text style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 16 }}>কোনো ডেটা নেই।</Text>
            ) : (
              grouped.map((g) => (
                <View key={g.dealer_id} style={{ marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => { setBreakdownType(null); nav.navigate("DealerDetail", { id: g.dealer_id }); }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1e293b" }}>{g.dealer_name}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1e293b" }}>{formatTaka(String(g.amount))}</Text>
                    </View>
                  </TouchableOpacity>
                  {g.rows.map((r) => (
                    <TouchableOpacity key={r.transaction_id} onPress={() => { setBreakdownType(null); nav.navigate("TransactionDetail", { id: r.transaction_id }); }} style={{ paddingVertical: 8, paddingHorizontal: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: "#1e293b" }}>{r.product_description || "লেনদেন"}</Text>
                        <Text style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(r.transaction_date)}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#047857" }}>{formatTaka(r.amount)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </SheetModal>
          <Footer />
    </ScrollView>
  );
}

function StatCard({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }} disabled={!onPress}>
      <Card style={{ minHeight: 88 }}>
        <Text style={{ fontSize: 11, color: "#64748b" }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e293b", marginTop: 8 }}>{value}</Text>
      </Card>
    </TouchableOpacity>
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