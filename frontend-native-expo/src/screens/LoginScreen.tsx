import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || "লগইন ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>SalesMaintain</Text>
        <Text style={styles.subtitle}>টাকার হিসাব · {new Date().getFullYear()}</Text>
        <TextInput style={styles.input} placeholder="ইমেইল" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="পাসওয়ার্ড" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{busy ? "লগইন হচ্ছে…" : "লগইন"}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 380, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 28, fontWeight: "700", color: "#047857", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 4, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12, color: "#1e293b" },
  errorBox: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#ef4444" },
  btn: { backgroundColor: "#047857", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
