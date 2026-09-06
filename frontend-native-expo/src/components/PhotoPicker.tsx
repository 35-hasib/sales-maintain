import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "../lib/cloudinary";
import PhotoLightbox from "./PhotoLightbox";
import { SheetModal } from "./Themed";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  max?: number;
};

export default function PhotoPicker({ value, onChange, folder, max = 10 }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [chooser, setChooser] = useState(false);

  async function uploadAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const asset of assets) {
        const url = await uploadToCloudinary({ uri: asset.uri, type: "image/jpeg", name: asset.fileName || "photo.jpg" }, folder);
        urls.push(url);
      }
      onChange([...value, ...urls]);
    } catch (e: any) {
      Alert.alert("আপলোড সফল হয়নি", e?.message || "আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    setChooser(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("অনুমতি প্রয়োজন", "ছবি তোলার জন্য ক্যামেরায় প্রবেশের অনুমতি দরকার।");
      return;
    }
    const remaining = max - value.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadAssets(result.assets);
  }

  async function pickFromGallery() {
    setChooser(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("অনুমতি প্রয়োজন", "ছবি বাছাইয়ের জন্য গ্যালারিতে প্রবেশের অনুমতি দরকার।");
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
    await uploadAssets(result.assets);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {value.map((url, i) => (
          <View key={url} style={styles.thumbWrap}>
            <TouchableOpacity onPress={() => setPreview(i)}>
              <Image source={{ uri: url }} style={styles.thumb} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => remove(i)}>
              <MaterialIcons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {value.length < max && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setChooser(true)} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#94a3b8" /> : <MaterialIcons name="add" size={22} color="#94a3b8" />}
            {!busy ? <Text style={styles.addLabel}>ছবি যোগ করুন</Text> : null}
          </TouchableOpacity>
        )}
      </View>
      {preview !== null && value.length > 0 ? (
        <PhotoLightbox images={value} index={preview} onClose={() => setPreview(null)} onIndexChange={setPreview} />
      ) : null}

      <SheetModal visible={chooser} title="ছবি যোগ করুন" onClose={() => setChooser(false)}>
        <ScrollView>
          <TouchableOpacity style={styles.optRow} onPress={takePhoto} disabled={busy}>
            <MaterialIcons name="photo-camera" size={22} color="#047857" />
            <View style={{ flex: 1 }}>
              <Text style={styles.optTitle}>ক্যামেরা থেকে ছবি তুলুন</Text>
              <Text style={styles.optDesc}>ক্যামেরা খুলে সরাসরি ফটো নিন</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optRow} onPress={pickFromGallery} disabled={busy}>
            <MaterialIcons name="photo-library" size={22} color="#047857" />
            <View style={{ flex: 1 }}>
              <Text style={styles.optTitle}>গ্যালারি থেকে বাছাই করুন</Text>
              <Text style={styles.optDesc}>ডিভাইসের ছবি থেকে একাধিক বাছাই (সর্বোচ্চ ৫)</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { position: "relative" },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  removeBtn: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#e11d48", alignItems: "center", justifyContent: "center" },
  addBtn: { width: 88, height: 72, borderRadius: 8, borderWidth: 2, borderColor: "#cbd5e1", borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  addLabel: { fontSize: 10, color: "#94a3b8" },
  optRow: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0", flexDirection: "row", alignItems: "center", gap: 12 },
  optTitle: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  optDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
});