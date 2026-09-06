import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Officer } from "../lib/types";
import { Card, CardTitle, Button, Field, Input, PickerSelect, ErrorText, Pagination, Footer, C } from "../components/Themed";
import { formatDate } from "../lib/format";

const ROLE_ITEMS = [{ value: "officer", label: "কর্মকর্তা" }, { value: "admin", label: "অ্যাডমিন" }];
const roleLabel = (role: string) => role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা";

export default function OfficersScreen() {
  const { officer } = useAuth();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Officer | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("officer");
  const [busy, setBusy] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const isAdmin = officer?.role === "admin";

  async function load() {
    try {
      const d = await api.get<{ officers: Officer[]; total: number }>(`/api/auth/?page=${page}&pageSize=${pageSize}`);
      setOfficers(d.officers); if (typeof d.total === "number") setTotal(d.total);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, page]);

  function openNew() { setEditing(null); setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("officer"); setShowForm(true); }
  function openEdit(o: Officer) { setEditing(o); setFormName(o.name); setFormEmail(o.email); setFormPassword(""); setFormRole(o.role); setShowForm(true); }

  async function handleSubmit() {
    setBusy(true); setError("");
    try {
      const payload: Record<string, string> = { name: formName, email: formEmail, role: formRole };
      if (editing) {
        if (formPassword) payload.password = formPassword;
        await api.put(`/api/auth/${editing.id}`, payload);
      } else {
        if (!formPassword) { setError("নতুন কর্মকর্তার জন্য পাসওয়ার্ড প্রয়োজন।"); setBusy(false); return; }
        payload.password = formPassword;
        await api.post("/api/auth/", payload);
      }
      setShowForm(false); setEditing(null); await load();
    } catch (e: any) { setError(e?.message || "সংরক্ষণ করা যায়নি"); }
    finally { setBusy(false); }
  }

  async function handleDelete(o: Officer) {
    Alert.alert("মুছে ফেলুন", `"${o.name}" কর্মকর্তাকে মুছে ফেলবেন?`, [
      { text: "বাতিল", style: "cancel" },
      { text: "মুছুন", style: "destructive", onPress: async () => { try { await api.del(`/api/auth/${o.id}`); await load(); } catch (e: any) { setError(e?.message); } } },
    ]);
  }

  if (!isAdmin) {
    return <View style={styles.container}><Card><Text style={{ fontSize: 13, color: "#64748b" }}>আপনি <Text style={{ fontWeight: "700" }}>{officer?.role}</Text> হিসেবে লগইন করেছেন। শুধু অ্যাডমিন কর্মকর্তাদের পরিচালনা করতে পারেন।</Text></Card></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.heading}>কর্মকর্তা</Text>
        <Button title="যোগ করুন" icon="add" onPress={openNew} />
      </View>
      {error ? <ErrorText message={error} /> : null}
      {showForm && (
        <Card style={{ marginBottom: 12 }}>
          <CardTitle>{editing ? "সম্পাদনা" : "নতুন কর্মকর্তা"}</CardTitle>
          <Field label="নাম *"><Input value={formName} onChangeText={setFormName} /></Field>
          <Field label="ইমেইল *"><Input value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
          <Field label={editing ? "পাসওয়ার্ড (খালি রাখলে অপরিবর্তিত)" : "পাসওয়ার্ড *"}><Input value={formPassword} onChangeText={setFormPassword} secureTextEntry /></Field>
          <Field label="ভূমিকা"><PickerSelect value={formRole} onValueChange={setFormRole} items={ROLE_ITEMS} /></Field>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button title="সংরক্ষণ" busy={busy} onPress={handleSubmit} style={{ flex: 1 }} />
            <Button title="বাতিল" variant="secondary" onPress={() => { setShowForm(false); setEditing(null); }} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
      {officers.length === 0 ? (
        <Card><Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", paddingVertical: 16 }}>এখনো কোনো কর্মকর্তা নেই।</Text></Card>
      ) : (
        officers.map((o) => (
          <Card key={o.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600" }}>{o.name}</Text>
                <Text style={{ fontSize: 12, color: "#64748b" }}>{o.email}</Text>
                {o.createdAt ? <Text style={{ fontSize: 11, color: "#94a3b8" }}>যোগ: {formatDate(o.createdAt)}</Text> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}><Text style={{ fontSize: 11, color: "#475569" }}>{roleLabel(o.role)}</Text></View>
                <TouchableOpacity onPress={() => openEdit(o)} style={styles.iconBtn}><MaterialIcons name="edit" size={16} color={C.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(o)} style={styles.iconBtn}><MaterialIcons name="delete" size={16} color="#e11d48" /></TouchableOpacity>
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
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
});
