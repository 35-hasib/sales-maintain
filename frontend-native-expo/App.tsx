import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, ActivityIndicator, View } from "react-native";
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: "#047857",
  primaryLight: "#059669",
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
};

function OfficerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: "#fff",
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { paddingBottom: 4, height: 56 },
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: "হোম", tabBarLabel: "হোম" }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "লেনদেন", tabBarLabel: "লেনদেন" }} />
      <Tab.Screen name="DealersTab" component={DealersScreen} options={{ title: "ব্যবসায়ী", tabBarLabel: "ব্যবসায়ী" }} />
      <Tab.Screen name="Ledger" component={LedgerScreen} options={{ title: "খাতা", tabBarLabel: "খাতা" }} />
      <Tab.Screen name="Officers" component={OfficersScreen} options={{ title: "কর্মকর্তা", tabBarLabel: "কর্মকর্তা" }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { officer, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>লোড হচ্ছে…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: "#fff" }}>
      {!officer ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={OfficerTabs} options={{ headerShown: false }} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: "লেনদেন" }} />
          <Stack.Screen name="NewTransaction" component={NewTransactionScreen} options={{ title: "নতুন লেনদেন" }} />
          <Stack.Screen name="DealerDetail" component={DealerDetailScreen} options={{ title: "ব্যবসায়ী" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </AuthProvider>
  );
}
