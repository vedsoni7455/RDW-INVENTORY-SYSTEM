import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { StockActionScreen } from '../screens/StockActionScreen';
import { LiveStockScreen } from '../screens/LiveStockScreen';
import { ItemMasterScreen } from '../screens/ItemMasterScreen';
import { ReportsScreen } from '../screens/ReportsScreen';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
  const { user, role } = useAuth();

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName={role === 'staff' ? 'StockAction' : 'Dashboard'}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#060911',
            borderTopColor: '#1e293b',
            borderTopWidth: 1,
            height: Platform.OS === 'web' ? 70 : 66,
            paddingBottom: Platform.OS === 'web' ? 12 : 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#00f2fe',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.5,
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconActive]}>
                <Text style={styles.iconText}>📊</Text>
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="StockAction"
          component={StockActionScreen}
          options={{
            tabBarLabel: 'Stock Action',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconActive]}>
                <Text style={styles.iconText}>⚡</Text>
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="LiveStock"
          component={LiveStockScreen}
          options={{
            tabBarLabel: 'Live Stock',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconActive]}>
                <Text style={styles.iconText}>📦</Text>
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="ItemMaster"
          component={ItemMasterScreen}
          options={{
            tabBarLabel: role === 'staff' ? 'Catalog (Read)' : 'Item Master',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconActive]}>
                <Text style={styles.iconText}>{role === 'staff' ? '📖' : '🏷️'}</Text>
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            tabBarLabel: 'Reports',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconActive]}>
                <Text style={styles.iconText}>📑</Text>
              </View>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  iconWrapper: {
    padding: 4,
    borderRadius: 10,
  },
  iconActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  iconText: {
    fontSize: 18,
  },
});
