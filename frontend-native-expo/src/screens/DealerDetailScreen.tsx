import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { formatTaka } from "../lib/format";
import type { Dealer, Summary } from "../lib/types";
import { Card, CardTitle, StatusBadge, Footer } from "../components/Themed";

type Detail = { dealer: Dealer; asSeller: Summary[]; asBuyer: Summary[]; summary: { owedByThem: string; owedToThem: string; net: string } };

function TxnRow({ t, otherName, onPress }: { t: Summary; otherName: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.txnRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: "#059669" }}>{t.product_description || "—"}</Text>
        <Text style={{ fontSize: 12, color: "#64748b" }}>{otherName}</Text>
        <Text style={{ fontSize: 11, color: "#94a3b8" }}>পরিমাণ {formatTaka(t.total_amount)} · জমা <Text style={{ fontWeight: "600", color: "#1e293b" }}>{formatTaka(t.officer_held_balance)}</Text></Text>
      </View>
      <StatusBadge status={t.status} />
    </TouchableOpacity>
  );
}

export default function DealerDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Detail>(`/api/dealers/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <View style={styles.center}><Text style={{ color: "#ef4444" }}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  const net = Number(data.summary.net);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <Text style={styles.name}>{data.dealer.name}</Text>
      <Text style={styles.sub}>{data.dealer.phone || "ফোন নেই"}{data.dealer.address ? ` · ${data.dealer.address}` : ""}</Text>
      {data.dealer.notes ? <Text style={styles.notes}>{data.dealer.notes}</Text> : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Card style={{ flex: 1 }}><CardTitle>তাদেরকে প্রদেয়</CardTitle><Text style={{ fontSize: 16, fontWeight: "700", color: "#059669" }}>{formatTaka(data.summary.owedToThem)}</Text></Card>
        <Card style={{ flex: 1 }}><CardTitle>তাদের নিকট প্রাপ্য</CardTitle><Text style={{ fontSize: 16, fontWeight: "700", color: "#e11d48" }}>{formatTaka(data.summary.owedByThem)}</Text></Card>
      </View>
      <Card style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <CardTitle>নিট অবস্থান</CardTitle>
        <Text style={{ fontSize: 18, fontWeight: "800", color: net >= 0 ? "#059669" : "#e11d48" }}>{formatTaka(data.summary.net)}</Text>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>বিক্রেতা হিসেবে ({data.asSeller.length})</CardTitle>
        {data.asSeller.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>কোনো লেনদেন নেই।</Text> : null}
        {data.asSeller.map((t) => <TxnRow key={t.id} t={t} otherName={t.buyer_name || "—"} onPress={() => nav.navigate("TransactionDetail", { id: t.id })} />)}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <CardTitle>ক্রেতা হিসেবে ({data.asBuyer.length})</CardTitle>
        {data.asBuyer.length === 0 ? <Text style={{ fontSize: 13, color: "#94a3b8", paddingVertical: 8 }}>কোনো লেনদেন নেই।</Text> : null}
        {data.asBuyer.map((t) => <TxnRow key={t.id} t={t} otherName={t.seller_name || "—"} onPress={() => nav.navigate("TransactionDetail", { id: t.id })} />)}
      </Card>
          <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  notes: { fontSize: 12, color: "#475569", marginTop: 4, fontStyle: "italic" },
  txnRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 8 },
});