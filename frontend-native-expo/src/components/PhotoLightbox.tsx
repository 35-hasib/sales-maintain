import React, { useRef, useState } from "react";
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 8;

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
};

export default function PhotoLightbox({ images, index, onClose, onIndexChange }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const baseScale = useRef(1);
  const baseX = useRef(0);
  const baseY = useRef(0);
  const transX = useRef(0);
  const transY = useRef(0);
  const lastTap = useRef(0);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function trackTranslate(x: number, y: number) {
    transX.current = x;
    transY.current = y;
  }

  function setScale(v: number, cx = width / 2, cy = height / 2, panX = 0, panY = 0) {
    const clamped = Math.min(Math.max(v, MIN_SCALE), MAX_SCALE);
    scaleRef.current = clamped;
    // Keep pan within bounds of how far you can move the zoomed image.
    const maxPanX = (width * (clamped - 1)) / 2;
    const maxPanY = (height * (clamped - 1)) / 2;
    Animated.spring(scale, {
      toValue: clamped,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
    Animated.spring(translateX, { toValue: Math.max(-maxPanX, Math.min(maxPanX, panX)), useNativeDriver: true, friction: 6, tension: 60 }).start();
    Animated.spring(translateY, { toValue: Math.max(-maxPanY, Math.min(maxPanY, panY)), useNativeDriver: true, friction: 6, tension: 60 }).start();
    trackTranslate(Math.max(-maxPanX, Math.min(maxPanX, panX)), Math.max(-maxPanY, Math.min(maxPanY, panY)));
  }

  function reset(pos: number, zoom = false) {
    scaleRef.current = zoom ? 2.5 : 1;
    baseScale.current = zoom ? 2.5 : 1;
    setScale(scaleRef.current);
    translateX.setValue(0);
    translateY.setValue(0);
    trackTranslate(0, 0);
    setLoaded(false);
    setLoadError(false);
  }

  function toggleZoom() {
    if (scaleRef.current > 1.01) setScale(1);
    else setScale(2.5);
  }

  const scaleBaseDist = useRef(1);
  const touchMoved = useRef(false);
  const maxTouches = useRef(1);
  const touchStart = useRef(0);

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      toggleZoom();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2 || g.numberActiveTouches >= 2,
    onPanResponderGrant: (e, g) => {
      const touches = e.nativeEvent.touches || [];
      touchMoved.current = false;
      maxTouches.current = g.numberActiveTouches || touches.length || 1;
      touchStart.current = Date.now();
      if (touches.length >= 2 || maxTouches.current >= 2) {
        const dx = Math.abs(touches[0].pageX - touches[1].pageX);
        const dy = Math.abs(touches[0].pageY - touches[1].pageY);
        baseScale.current = scaleRef.current;
        baseX.current = touches[0].pageX;
        baseY.current = touches[0].pageY;
        scaleBaseDist.current = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      } else {
        baseX.current = transX.current;
        baseY.current = transY.current;
      }
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches || [];
      if (touches.length >= 2 || g.numberActiveTouches >= 2) {
        maxTouches.current = Math.max(maxTouches.current, 2);
        touchMoved.current = true;
        const dx = Math.abs(touches[0].pageX - touches[1].pageX);
        const dy = Math.abs(touches[0].pageY - touches[1].pageY);
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const next = Math.min(Math.max(baseScale.current * (dist / scaleBaseDist.current), MIN_SCALE), MAX_SCALE);
        scale.setValue(next);
        scaleRef.current = next;
      } else {
        if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) touchMoved.current = true;
        translateX.setValue(baseX.current + g.dx);
        translateY.setValue(baseY.current + g.dy);
        trackTranslate(baseX.current + g.dx, baseY.current + g.dy);
      }
    },
    onPanResponderRelease: (e) => {
      const touches = e.nativeEvent.touches || [];
      const wasPinch = maxTouches.current >= 2 || touches.length >= 2;
      if (!wasPinch && !touchMoved.current && Date.now() - touchStart.current < 400) {
        handleTap();
        return;
      }
      Animated.spring(scale, { toValue: scaleRef.current, useNativeDriver: true }).start();
      const maxPanX = (width * (scaleRef.current - 1)) / 2;
      const maxPanY = (height * (scaleRef.current - 1)) / 2;
      translateX.setValue(Math.max(-maxPanX, Math.min(maxPanX, transX.current)));
      translateY.setValue(Math.max(-maxPanY, Math.min(maxPanY, transY.current)));
      trackTranslate(Math.max(-maxPanX, Math.min(maxPanX, transX.current)), Math.max(-maxPanY, Math.min(maxPanY, transY.current)));
    },
  });

  function change(delta: number) {
    const next = Math.min(Math.max(index + delta, 0), images.length - 1);
    if (next !== index) {
      reset(next, false);
      onIndexChange(next);
    }
  }

  return (
    <Modal visible transparent onRequestClose={onClose}>
      <View style={styles.root}>
        {images.map((uri, i) => {
          if (i !== index) return null;
          return (
            <Animated.View
              key={uri}
              {...pan.panHandlers}
              style={[styles.imageWrap, { transform: [{ translateX }, { translateY }, { scale }] }]}
            >
              {!loaded && !loadError ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" /> : null}
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => { setLoaded(false); setLoadError(false); }}
                onLoad={() => setLoaded(true)}
                onError={() => setLoadError(true)}
              />
              {loadError ? <Text style={styles.errText}>ছবি লোড করা যায়নি</Text> : null}
            </Animated.View>
          );
        })}

        {images.length > 0 ? (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.iconBtn} disabled={index <= 0} onPress={() => change(-1)}>
              <MaterialIcons name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomPill} onPress={toggleZoom}>
              <MaterialIcons name="remove" size={16} color="#fff" />
              <Text style={styles.zoomText}>{Math.round(scaleRef.current * 100)}%</Text>
              <MaterialIcons name="add" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} disabled={index >= images.length - 1} onPress={() => change(1)}>
              <MaterialIcons name="chevron-right" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.counter}>{index + 1} / {images.length}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <MaterialIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  imageWrap: { width, height },
  image: { width, height },
  errText: { color: "#fff", textAlign: "center", marginTop: 12 },
  bottomBar: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  zoomPill: { backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8 },
  zoomText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  counter: { position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#94a3b8", fontSize: 12 },
  closeBtn: { position: "absolute", top: 48, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});