import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import { getDealers } from "../lib/cache";
import type { Dealer } from "../lib/types";
import { Card, Button, Field, Input, Textarea, ErrorText, PickerSelect, Footer } from "../components/Themed";
import PhotoPicker from "../components/PhotoPicker";

export default function NewTransactionScreen() {
  const nav = useNavigation<any>();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sellerDealerId, setSellerDealerId] = useState("");
  const [buyerDealerId, setBuyerDealerId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    getDealers().then(setDealers).catch(() => {});
  }, []);

  const dealerItems = dealers.map((d) => ({ value: d.id, label: d.name }));

  async function handleSubmit() {
    if (!sellerDealerId || !buyerDealerId || !totalAmount) { setError("বিক্রেতা, ক্রেতা ও পরিমাণ প্রয়োজন।"); return; }
    setBusy(true); setError("");
    try {
      const t = await api.post<{ transaction: { id: string } }>("/api/transactions", {
        sellerDealerId, buyerDealerId, totalAmount,
        productDescription: productDescription || null,
        transactionDate, photos,
      });
      nav.replace("TransactionDetail", { id: t.transaction.id });
    } catch (err: any) { setError(err?.message || "লেনদেন তৈরি করা যায়নি"); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}>
      <Card>
        <Field label="বিক্রেতা ব্যবসায়ী *">
          <PickerSelect value={sellerDealerId} onValueChange={setSellerDealerId} items={[{ value: "", label: "বিক্রেতা নির্বাচন করুন" }, ...dealerItems]} />
        </Field>
        <Field label="ক্রেতা ব্যবসায়ী *">
          <PickerSelect value={buyerDealerId} onValueChange={setBuyerDealerId} items={[{ value: "", label: "ক্রেতা নির্বাচন করুন" }, ...dealerItems]} />
        </Field>
        <Field label="মোট পরিমাণ (৳) *">
          <Input keyboardType="decimal-pad" value={totalAmount} onChangeText={setTotalAmount} placeholder="125000.00" />
        </Field>
        <Field label="পণ্যের বিবরণ">
          <Textarea value={productDescription} onChangeText={setProductDescription} />
        </Field>
        <Field label="তারিখ">
          <Input value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="ছবি">
          <PhotoPicker value={photos} onChange={setPhotos} folder="salesmaintain/transactions" />
        </Field>
        <ErrorText message={error} />
        <Button title="লেনদেন তৈরি করুন" busy={busy} onPress={handleSubmit} style={{ marginTop: 8 }} />
      </Card>
          <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#f8fafc" } });
