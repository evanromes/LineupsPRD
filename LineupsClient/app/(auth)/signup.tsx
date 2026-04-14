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

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSignup() {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>LINEUPS</Text>
          <Text style={styles.subtext}>SURF JOURNAL</Text>
        </View>
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successBody}>
            We sent a confirmation link to {email}.{'\n'}
            Click it to activate your account.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Back to Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
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
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#4A7A87"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#E8D5B8" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
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
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#0B2230',
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
  successBox: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  successTitle: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 22,
    color: '#E8D5B8',
  },
  successBody: {
    color: '#4A7A87',
    fontSize: 14,
    fontFamily: 'Helvetica Neue',
    textAlign: 'center',
    lineHeight: 22,
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
})
