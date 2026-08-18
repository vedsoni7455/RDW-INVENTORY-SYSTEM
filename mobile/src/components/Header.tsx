import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, useWindowDimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { role, setRole, user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleRoleSelect = (newRole: UserRole) => {
    setRole(newRole);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out of RDW Inventory?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  const getRoleBadgeStyle = (targetRole: UserRole) => {
    switch (targetRole) {
      case 'owner':
        return { bg: '#1e1b4b', border: '#8b5cf6', text: '#c4b5fd', label: '👑 Owner' };
      case 'manager':
        return { bg: '#172554', border: '#3b82f6', text: '#93c5fd', label: '👔 Manager' };
      case 'staff':
        return { bg: '#064e3b', border: '#10b981', text: '#6ee7b7', label: '🍳 Staff' };
    }
  };

  const currentRoleStyle = getRoleBadgeStyle(role);

  return (
    <View style={styles.container}>
      <View style={styles.accentGlow} />

      <View style={[styles.contentRow, isDesktop && styles.desktopContentRow]}>
        {/* Brand & Page Title */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>🍽️</Text>
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {user?.name || 'User'} • {subtitle || 'RDW Inventory'}
            </Text>
          </View>
        </View>

        {/* Role Switcher & Controls */}
        <View style={styles.rightActions}>
          {/* Quick Switch Buttons for Desktop/Tablet */}
          {isDesktop ? (
            <View style={styles.desktopRoleSwitcher}>
              {(['owner', 'manager', 'staff'] as UserRole[]).map(r => {
                const isSelected = role === r;
                const rStyle = getRoleBadgeStyle(r);
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleChip,
                      { backgroundColor: isSelected ? rStyle.bg : '#131c2e', borderColor: isSelected ? rStyle.border : '#1e2e4a' },
                    ]}
                    onPress={() => handleRoleSelect(r)}
                  >
                    <Text style={[styles.roleChipText, { color: isSelected ? rStyle.text : '#64748b' }]}>
                      {rStyle.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.mobileRoleBadge,
                { backgroundColor: currentRoleStyle.bg, borderColor: currentRoleStyle.border },
              ]}
              onPress={() => {
                const roles: UserRole[] = ['owner', 'manager', 'staff'];
                const next = roles[(roles.indexOf(role) + 1) % roles.length];
                setRole(next);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.mobileRoleText, { color: currentRoleStyle.text }]}>
                {currentRoleStyle.label} ▾
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 14,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2e4a',
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00f2fe',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  desktopContentRow: {
    paddingHorizontal: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#131c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#1e2e4a',
  },
  logoText: {
    fontSize: 20,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopRoleSwitcher: {
    flexDirection: 'row',
    marginRight: 10,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 6,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mobileRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  mobileRoleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#131c2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2e4a',
  },
  logoutText: {
    fontSize: 14,
  },
});
