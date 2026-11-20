import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_FIREBASE_')
    const required = ['API_KEY', 'PROJECT_ID', 'AUTH_DOMAIN', 'APP_ID']
    const missing = required.map(name => 'VITE_FIREBASE_' + name).filter(key => !env[key]?.trim())
    if (missing.length) throw new Error('Missing Firebase build settings: ' + missing.join(', '))
    if (!/^AIza[\w-]{35}$/.test(env.VITE_FIREBASE_API_KEY)) {
      throw new Error('Set VITE_FIREBASE_API_KEY to the Firebase web app API key before building.')
    }
  }
  return { plugins: [react()] }
})
