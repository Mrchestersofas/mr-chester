import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  // En el celular de quien ayuda en la casa, el ícono abre directo su página
  // Las páginas públicas (Black Friday, seguimiento…) nunca redirigen, aunque el celular esté en modo Taller o Casa
  const publica = !!(Component as any).sinLayout && router.pathname !== '/taller' && router.pathname !== '/casa'
  useEffect(() => {
    if (publica) return
    let modoCasa = false, modoTaller = false
    try {
      modoCasa = localStorage.getItem('modoCasa') === '1'
      modoTaller = localStorage.getItem('modoTaller') === '1'
    } catch (e) {}
    if (modoCasa && router.pathname !== '/casa') router.replace('/casa')
    // En el celular de los encargados de fábrica, el ícono abre directo el Taller
    else if (modoTaller && router.pathname !== '/taller') router.replace('/taller')
  }, [router.pathname, publica])

  if ((Component as any).sinLayout) return <Component {...pageProps} />
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
