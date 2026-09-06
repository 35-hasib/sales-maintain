import React, { useState } from "react";
import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import PhotoLightbox from "./PhotoLightbox";
import { thumbUrl } from "../lib/cloudinary";

export default function PhotoGallery({ photos, large }: { photos?: string[]; large?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;
  const size = large ? 96 : 64;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {photos.map((url, i) => (
        <TouchableOpacity key={url} onPress={() => setActive(i)}>
          <Image source={{ uri: thumbUrl(url, size * 2) }} style={{ width: size, height: size, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" }} />
        </TouchableOpacity>
      ))}
      {active !== null ? (
        <PhotoLightbox images={photos} index={active} onClose={() => setActive(null)} onIndexChange={setActive} />
      ) : null}
    </View>
  );
}