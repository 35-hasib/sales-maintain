import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, ActivityIndicator, View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import TransactionsScreen from "./src/screens/TransactionsScreen";
import TransactionDetailScreen from "./src/screens/TransactionDetailScreen";
import NewTransactionScreen from "./src/screens/NewTransactionScreen";
import DealersScreen from "./src/screens/DealersScreen";
import DealerDetailScreen from "./src/screens/DealerDetailScreen";
import LedgerScreen from "./src/screens/LedgerScreen";
import OfficersScreen from "./src/screens/OfficersScreen";
import { C, SheetModal, Button } from "./src/components/Themed";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const roleLabel: Record<string, string> = { admin: "অ্যাডমিন", officer: "কর্মকর্তা" };

function TabIcon({ name, color }: { name: ComponentProps<typeof MaterialIcons>["name"]; color: string }) {
  return <MaterialIcons name={name} size={22} color={color} />;
}

function TopBar({ navigation }: any) {
  const { officer, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  return (
    <>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Text style={styles.brand} numberOfLines={1}>SalesMaintain</Text>
        <View style={styles.userBox}>
          <Text style={styles.userName} numberOfLines={1}>{officer?.name}</Text>
          <Text style={styles.userRole}>{roleLabel[officer?.role || ""] || officer?.role}</Text>
        </View>
        <TouchableOpacity onPress={() => setConfirmingLogout(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="power-settings-new" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <SheetModal visible={confirmingLogout} title="লগআউট" onClose={() => setConfirmingLogout(false)}>
        <Text style={{ fontSize: 14, color: "#1e293b", marginBottom: 16 }}>আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?</Text>
        <Button title="লগআউট" variant="danger" onPress={() => { setConfirmingLogout(false); logout(); }} />
        <View style={{ height: 10 }} />
        <Button title="বাতিল" variant="secondary" onPress={() => setConfirmingLogout(false)} />
      </SheetModal>
    </>
  );
}

function Header({ navigation }: any) {
  return <TopBar navigation={navigation} />;
}

function OfficerTabs() {
  const { officer } = useAuth();
  const isAdmin = officer?.role === "admin";
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { paddingBottom: 4, height: 56, backgroundColor: "#fff" },
        tabBarLabelStyle: { fontSize: 11, marginTop: -4 },
      }}
    >
      {!isAdmin ? (
        <>
          <Tab.Screen name="Home" component={DashboardScreen} options={{ title: "হোম", tabBarLabel: "হোম", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
          <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "লেনদেন", tabBarLabel: "লেনদেন", tabBarIcon: ({ color }) => <TabIcon name="receipt-long" color={color} /> }} />
          <Tab.Screen name="DealersTab" component={DealersScreen} options={{ title: "ব্যবসায়ী", tabBarLabel: "ব্যবসায়ী", tabBarIcon: ({ color }) => <TabIcon name="store" color={color} /> }} />
          <Tab.Screen name="Ledger" component={LedgerScreen} options={{ title: "খাতা", tabBarLabel: "খাতা", tabBarIcon: ({ color }) => <TabIcon name="menu-book" color={color} /> }} />
        </>
      ) : null}
      <Tab.Screen name="Officers" component={OfficersScreen} options={{ title: "কর্মকর্তা", tabBarLabel: "কর্মকর্তা", tabBarIcon: ({ color }) => <TabIcon name="person" color={color} /> }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { officer, loading, startupError, retryStartup } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (startupError && !officer) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", padding: 24 }}>
        <MaterialIcons name="wifi-off" size={52} color={C.muted} />
        <Text style={{ color: C.text, fontSize: 16, fontWeight: "600", marginTop: 12, textAlign: "center" }}>সংযোগ সমস্যা</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: "center" }}>{startupError}</Text>
        <TouchableOpacity onPress={retryStartup} style={{ marginTop: 20, backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>আবার চেষ্টা করুন</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        header: Header,
        headerStyle: { backgroundColor: C.primary },
        headerTintColor: "#fff",
      }}
    >
      {!officer ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={OfficerTabs} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: "লেনদেন" }} />
          <Stack.Screen name="NewTransaction" component={NewTransactionScreen} options={{ title: "নতুন লেনদেন" }} />
          <Stack.Screen name="DealerDetail" component={DealerDetailScreen} options={{ title: "ব্যবসায়ী" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    material: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#f8fafc" }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 64, backgroundColor: C.primary, gap: 8 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "700" },
  userBox: { alignItems: "flex-end", marginLeft: "auto" },
  userName: { color: "#fff", fontSize: 12, fontWeight: "600" },
  userRole: { color: "rgba(255,255,255,0.85)", fontSize: 10 },
});