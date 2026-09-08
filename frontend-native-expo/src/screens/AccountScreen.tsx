import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Officer } from "../lib/types";
import { Card, CardTitle, Button, Field, Input, ErrorText, Footer, C } from "../components/Themed";
import { formatDate } from "../lib/format";

const roleLabel = (role: string) => (role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা");

export default function AccountScreen() {
  const { officer, updateOfficer, logout } = useAuth();
  const [formName, setFormName] = useState(officer?.name ?? "");
  const [formPhone, setFormPhone] = useState(officer?.phone ?? "");
  const [formEmail, setFormEmail] = useState(officer?.email ?? "");
  const [formPassword, setFormPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  if (!officer) return null;
  const me = officer;

  async function handleSave() {
    setBusy(true); setError(""); setMsg("");
    try {
      const payload: Record<string, string> = { name: formName };
      if (formEmail.trim()) payload.email = formEmail.trim();
      if (formPhone.trim()) payload.phone = formPhone.trim();
      if (!payload.email && !payload.phone) {
        setError("ইমেইল বা মোবাইল নম্বর — যেকোনো একটি দিতে হবে");
        setBusy(false);
        return;
      }
      if (formPassword) {
        if (formPassword.length < 6) {
          setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
          setBusy(false);
          return;
        }
        payload.password = formPassword;
      }
      const d = await api.put<{ officer: Officer }>(`/api/auth/${me.id}`, payload);
      updateOfficer(d.officer);
      setFormPassword("");
      setMsg("আপনার তথ্য আপডেট হয়েছে।");
    } catch (e: any) {
      setError(e?.message || "সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "আমার হিসাব মুছুন",
      "আপনি কি নিশ্চিত? আপনার নামে থাকা সব লেনদেন, ব্যবসায়ীর তথ্য ও খাতার হিসাব চিরতরে মুছে যাবে।",
      [
        { text: "বাতিল", style: "cancel" },
        {
          text: "হ্যাঁ, মুছুন",
          style: "destructive",
          onPress: async () => {
            setDeleting(true); setError(""); setMsg("");
            try {
              await api.del(`/api/auth/${me.id}`);
              logout();
            } catch (e: any) {
              setError(e?.message || "মোছা যায়নি");
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <Text style={styles.heading}>প্রোফাইল</Text>
      {error ? <ErrorText message={error} /> : null}
      {msg ? (
        <View style={{ backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Text style={{ color: "#047857", fontSize: 13 }}>{msg}</Text>
        </View>
      ) : null}

      <Card style={{ marginBottom: 12 }}>
        <CardTitle>প্রোফাইল</CardTitle>
        <Field label="নাম *"><Input value={formName} onChangeText={setFormName} /></Field>
        <Field label="মোবাইল নম্বর"><Input value={formPhone} onChangeText={(t) => setFormPhone(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={11} /></Field>
        <Field label="ইমেইল"><Input value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Text style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>ইমেইল বা মোবাইল নম্বর — যেকোনো একটি দিতে হবে</Text>
        <Field label="নতুন পাসওয়ার্ড (খালি রাখলে অপরিবর্তিত)"><Input value={formPassword} onChangeText={setFormPassword} secureTextEntry /></Field>
        <Button title="সংরক্ষণ" icon="save" busy={busy} onPress={handleSave} />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <CardTitle>প্রোফাইলের তথ্য</CardTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>ভূমিকা</Text>
          <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
            <Text style={{ fontSize: 11, color: "#475569" }}>{roleLabel(officer.role)}</Text>
          </View>
        </View>
        {officer.createdAt ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>যোগদানের তারিখ</Text>
            <Text style={styles.rowValue}>{formatDate(officer.createdAt)}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ borderColor: "#fecaca", borderWidth: 1 }}>
        <CardTitle>ঝুঁকিপূর্ণ অঞ্চল</CardTitle>
        <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          আপনার হিসাব মুছে দিলে আপনার সব লেনদেন ও ব্যবসায়ীর তথ্য মুছে যাবে। এ কাজ ফেরানো যাবে না।
        </Text>
        <Button title="আমার হিসাব মুছুন" variant="danger" icon="delete" busy={deleting} onPress={handleDelete} />
      </Card>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 8 },
  rowLabel: { fontSize: 13, color: "#64748b" },
  rowValue: { fontSize: 13, fontWeight: "600", color: C.text },
});