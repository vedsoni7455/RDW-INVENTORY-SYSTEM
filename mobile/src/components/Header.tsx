import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, useWindowDimensions, Image, Clipboard } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { role, user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out of Rajubhai Dosawala?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  const copyRestaurantId = () => {
    if (user?.restaurant_id) {
      Clipboard.setString(user.restaurant_id);
      if (Platform.OS !== 'web') {
        Alert.alert('Copied!', 'Restaurant ID copied to clipboard. Share this with your managers or staff.');
      } else {
        alert('Restaurant ID copied to clipboard!');
      }
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

  const currentRoleStyle = getRoleBadgeStyle(role || 'owner');

  return (
    <View style={styles.container}>
      <View style={styles.accentGlow} />

      <View style={[styles.contentRow, isDesktop && styles.desktopContentRow]}>
        {/* Brand & Page Title */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity 
            onPress={copyRestaurantId} 
            activeOpacity={user?.restaurant_id ? 0.7 : 1.0} 
            style={styles.textGroup}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {user?.name || 'Restaurant User'} • {subtitle || 'Rajubhai Dosawala'}
            </Text>
            {user?.restaurant_id && (
              <Text style={styles.idSub}>
                ID: {user.restaurant_id} 📋
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Fixed Non-Interactive Role Display & Logout */}
        <View style={styles.rightActions}>
          <View
            style={[
              styles.staticRoleBadge,
              { backgroundColor: currentRoleStyle.bg, borderColor: currentRoleStyle.border },
            ]}
          >
            <Text style={[styles.staticRoleText, { color: currentRoleStyle.text }]}>
              {currentRoleStyle.label}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityLabel="Log Out"
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 14,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2e4a',
    position: 'relative',
    width: '100%',
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
    maxWidth: 1600,
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
  logoImage: {
    width: 32,
    height: 32,
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
  idSub: {
    fontSize: 9,
    color: '#38bdf8',
    marginTop: 2,
    fontWeight: '700',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staticRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
  },
  staticRoleText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  logoutBtn: {
    width: 36,
    height: 36,
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
