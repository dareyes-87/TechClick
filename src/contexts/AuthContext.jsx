import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) cargarPerfil(session.user.id)
      else setLoading(false)
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) cargarPerfil(session.user.id)
      else {
        setUsuario(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(userId) {
    try {
      const { data, error } = await supabase
        .from('usuario')
        .select('*, sede:sede_id(id, nombre, ciudad)')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUsuario(data)
    } catch (err) {
      console.error('Error cargando perfil:', err)
      // Si no existe perfil, crear uno básico
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
    setUsuario(null)
    setSession(null)
  }

  async function registrar(email, password, datosUsuario) {
    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) throw authError

    // 2. Crear perfil en tabla usuario
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('usuario')
        .insert({
          id: authData.user.id,
          email,
          nombre: datosUsuario.nombre,
          apellido: datosUsuario.apellido,
          rol: datosUsuario.rol,
          sede_id: datosUsuario.sede_id,
        })
      if (profileError) throw profileError
    }

    return authData
  }

  const value = {
    session,
    usuario,
    loading,
    login,
    logout,
    registrar,
    isAuthenticated: !!session,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
