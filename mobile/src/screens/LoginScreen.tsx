import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const LoginScreen: React.FC = () => {
  const { login, signup, isLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantIdInput, setRestaurantIdInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('owner');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (!isSignUp) {
      if (role === 'owner') {
        setName('Restaurant Owner');
        setEmail('owner@rdwrestaurant.com');
      } else if (role === 'manager') {
        setName('Store Manager');
        setEmail('manager@rdwrestaurant.com');
      } else {
        setName('Kitchen Staff');
        setEmail('staff@rdwrestaurant.com');
      }
    }
  };

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        Alert.alert('Validation Error', 'Please enter your full name.');
        return;
      }
      try {
        if (selectedRole === 'owner') {
          if (!restaurantName.trim()) {
            Alert.alert('Validation Error', 'Please enter your restaurant name.');
            return;
          }
          await signup(name.trim(), email.trim(), password, selectedRole, restaurantName.trim(), undefined);
        } else {
          if (!restaurantIdInput.trim()) {
            Alert.alert('Validation Error', 'Please enter the Restaurant ID provided by your owner.');
            return;
          }
          await signup(name.trim(), email.trim(), password, selectedRole, undefined, restaurantIdInput.trim());
        }
      } catch (err: any) {
        Alert.alert('Registration Failed', err.message);
      }
    } else {
      try {
        await login(email.trim(), password);
      } catch (err: any) {
        Alert.alert('Login Failed', err.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.desktopScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Background Ambient Glows */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        <View style={[styles.responsiveWrapper, isDesktop && styles.desktopWrapper]}>
          <View style={styles.card}>
            {/* Header / Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>
                Multi-Role Restaurant Stock & Supply Chain Management
              </Text>
            </View>



            {/* Auth Mode Switcher Tabs */}
            <View style={styles.modeTabContainer}>
              <TouchableOpacity
                style={[styles.modeTab, !isSignUp && styles.modeTabActive]}
                onPress={() => setIsSignUp(false)}
              >
                <Text style={[styles.modeTabText, !isSignUp && styles.textCyan]}>SIGN IN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, isSignUp && styles.modeTabActive]}
                onPress={() => setIsSignUp(true)}
              >
                <Text style={[styles.modeTabText, isSignUp && styles.textCyan]}>
                  CREATE ACCOUNT
                </Text>
              </TouchableOpacity>
            </View>

            {/* Role Selection Cards */}
            <Text style={styles.sectionLabel}>Select Access Role:</Text>
            <View style={styles.roleGrid}>
              {/* OWNER */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'owner' && styles.roleActiveOwner]}
                onPress={() => handleRoleSelect('owner')}
                activeOpacity={0.85}
              >
                <View style={styles.roleHeaderRow}>
                  <Text style={styles.roleIcon}>👑</Text>
                  {selectedRole === 'owner' && <View style={styles.activeCheck} />}
                </View>
                <Text style={[styles.roleTitle, selectedRole === 'owner' && styles.textWhite]}>
                  OWNER
                </Text>
                <Text style={styles.roleDesc}>Full Edit: Analytics, Catalog CRUD, CSV Exports</Text>
              </TouchableOpacity>

              {/* MANAGER */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'manager' && styles.roleActiveManager]}
                onPress={() => handleRoleSelect('manager')}
                activeOpacity={0.85}
              >
                <View style={styles.roleHeaderRow}>
                  <Text style={styles.roleIcon}>👔</Text>
                  {selectedRole === 'manager' && <View style={styles.activeCheck} />}
                </View>
                <Text style={[styles.roleTitle, selectedRole === 'manager' && styles.textWhite]}>
                  MANAGER
                </Text>
                <Text style={styles.roleDesc}>Stock Refills, Item Master & Reorder Reports</Text>
              </TouchableOpacity>

              {/* STAFF */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'staff' && styles.roleActiveStaff]}
                onPress={() => handleRoleSelect('staff')}
                activeOpacity={0.85}
              >
                <View style={styles.roleHeaderRow}>
                  <Text style={styles.roleIcon}>🍳</Text>
                  {selectedRole === 'staff' && <View style={styles.activeCheck} />}
                </View>
                <Text style={[styles.roleTitle, selectedRole === 'staff' && styles.textWhite]}>
                  STAFF
                </Text>
                <Text style={styles.roleDesc}>Rapid Stock In/Out & Live Stock Feed</Text>
              </TouchableOpacity>
            </View>

             {/* Form Fields */}
             {isSignUp && (
               <>
                 {selectedRole === 'owner' ? (
                   <>
                     <Text style={styles.inputLabel}>Restaurant / Branch Name *</Text>
                     <TextInput
                       style={styles.input}
                       value={restaurantName}
                       onChangeText={setRestaurantName}
                       placeholder="e.g. RDW Fine Dining"
                       placeholderTextColor="#64748b"
                     />
                   </>
                 ) : (
                   <>
                     <Text style={styles.inputLabel}>Restaurant ID * (Provided by Owner)</Text>
                     <TextInput
                       style={styles.input}
                       value={restaurantIdInput}
                       onChangeText={setRestaurantIdInput}
                       placeholder="Enter Restaurant ID (UUID)"
                       placeholderTextColor="#64748b"
                       autoCapitalize="none"
                     />
                   </>
                 )}

                 <Text style={styles.inputLabel}>Full Name *</Text>
                 <TextInput
                   style={styles.input}
                   value={name}
                   onChangeText={setName}
                   placeholder="Enter your full name"
                   placeholderTextColor="#64748b"
                 />
               </>
             )}

            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. user@rdwrestaurant.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
            />

            {/* Submit CTA */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>
                {isLoading
                  ? 'AUTHENTICATING...'
                  : isSignUp
                  ? `REGISTER AS ${selectedRole.toUpperCase()}`
                  : `LOG IN AS ${selectedRole.toUpperCase()}`}
              </Text>
            </TouchableOpacity>

            <View style={styles.roleNoticeBox}>
              <Text style={styles.roleNoticeText}>
                🔒 {selectedRole === 'owner'
                  ? 'Owner Role: Complete system control, Item Master CRUD, financial metrics & configuration.'
                  : selectedRole === 'manager'
                  ? 'Manager Role: Operational inventory management, item creation, and report generation.'
                  : 'Staff Role: Fast stock in/out logging, live stock lookups, and barcode scanning.'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060911',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 32,
    position: 'relative',
  },
  desktopScrollContent: {
    paddingVertical: 56,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 242, 254, 0.05)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 520,
  },
  desktopWrapper: {
    maxWidth: 540,
  },
  card: {
    backgroundColor: '#101827',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 240,
    height: 90,
    marginBottom: 8,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#172554',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  logoIcon: {
    fontSize: 28,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
    fontWeight: '600',
    textAlign: 'center',
  },
  demoSection: {
    backgroundColor: '#090d16',
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  demoBar: {
    flexDirection: 'row',
    marginHorizontal: -3,
  },
  demoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  demoBtnOwner: {
    backgroundColor: '#1e1b4b',
    borderColor: '#8b5cf6',
  },
  demoBtnManager: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
  },
  demoBtnStaff: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  demoIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  demoText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '900',
  },
  demoSub: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
  },
  modeTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#131c2e',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  textCyan: {
    color: '#00f2fe',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cbd5e1',
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  roleGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#090d16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeCheck: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f2fe',
  },
  roleActiveOwner: {
    backgroundColor: '#1e1b4b',
    borderColor: '#8b5cf6',
  },
  roleActiveManager: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
  },
  roleActiveStaff: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  roleIcon: {
    fontSize: 20,
  },
  roleTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  roleDesc: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 12,
    fontWeight: '600',
  },
  textWhite: {
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    marginBottom: 5,
    marginTop: 10,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#00f2fe',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#090d16',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  roleNoticeBox: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleNoticeText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 16,
  },
});
