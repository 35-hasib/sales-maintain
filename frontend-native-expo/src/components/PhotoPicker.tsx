import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, FlatList, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "../lib/cloudinary";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  max?: number;
};

export default function PhotoPicker({ value, onChange, folder, max = 10 }: Props) {
  const [busy, setBusy] = useState(false);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("অনুমতি প্রয়োজন", "ছবি বাছাই করতে গ্যালারি অনুমতি দিন।");
      return;
    }
    const remaining = max - value.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.min(remaining, 5),
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadToCloudinary({ uri: asset.uri, type: "image/jpeg", name: asset.fileName || "photo.jpg" }, folder);
        urls.push(url);
      }
      onChange([...value, ...urls]);
    } catch (e: any) {
      Alert.alert("আপলোড ব্যর্থ", e?.message || "আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {value.map((url, i) => (
          <View key={url} style={styles.thumbWrap}>
            <Image source={{ uri: url }} style={styles.thumb} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => remove(i)}>
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {value.length < max && (
          <TouchableOpacity style={styles.addBtn} onPress={pick} disabled={busy}>
            <Text style={styles.addText}>{busy ? "…" : "+"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { position: "relative" },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  removeBtn: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#e11d48", alignItems: "center", justifyContent: "center" },
  removeText: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 18 },
  addBtn: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderColor: "#cbd5e1", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  addText: { fontSize: 24, color: "#94a3b8" },
});
