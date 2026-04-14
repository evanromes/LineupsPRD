import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
    }
    // successful login triggers onAuthStateChange in index.tsx → redirect
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wordmark */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>LINEUPS</Text>
          <Text style={styles.subtext}>SURF JOURNAL</Text>
          <Text style={styles.tagline}>every break, remembered</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#4A7A87"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#4A7A87"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#E8D5B8" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          {/* SSO divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Apple SSO placeholder */}
          <TouchableOpacity style={styles.ssoButton}>
            <Text style={styles.ssoButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Google SSO placeholder */}
          <TouchableOpacity style={styles.ssoButton}>
            <Text style={styles.ssoButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>

        {/* DEV ONLY: skip auth */}
        <TouchableOpacity style={styles.devSkip} onPress={() => router.replace('/(tabs)/map')}>
          <Text style={styles.devSkipText}>⚡ Dev Skip</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  wordmark: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 36,
    color: '#E8D5B8',
    letterSpacing: 4,
  },
  subtext: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 6,
    marginTop: 4,
  },
  tagline: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#3A5A65',
    marginTop: 12,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    backgroundColor: '#0F2D3A',
    borderWidth: 1,
    borderColor: '#1B5A6A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#E8D5B8',
    fontSize: 15,
    fontFamily: 'Georgia',
  },
  error: {
    color: '#E07070',
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  disabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#1B5A6A',
  },
  dividerText: {
    color: '#4A7A87',
    fontSize: 13,
    fontFamily: 'Helvetica Neue',
  },
  ssoButton: {
    borderWidth: 1,
    borderColor: '#1B5A6A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ssoButtonText: {
    color: '#3CC4C4',
    fontSize: 15,
    fontFamily: 'Helvetica Neue',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 36,
  },
  footerText: {
    color: '#4A7A87',
    fontSize: 14,
    fontFamily: 'Helvetica Neue',
  },
  footerLink: {
    color: '#3CC4C4',
    fontSize: 14,
    fontFamily: 'Helvetica Neue',
  },
  devSkip: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#3CC4C4',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  devSkipText: {
    color: '#3CC4C4',
    fontSize: 12,
    fontFamily: 'Helvetica Neue',
  },
})
