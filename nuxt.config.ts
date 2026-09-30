// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  devServer: {
    host: '0.0.0.0',
    port: 3000
  },
  modules: [
    '@nuxtjs/tailwindcss'
  ],
  app: {
    head: {
      title: 'Tabian - ระบบจัดการทะเบียนรถสูญหายช่วงน้ำท่วม',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'ระบบศูนย์รวมแจ้งพบและตามหาแผ่นป้ายทะเบียนรถยนต์และมอเตอร์ไซค์ที่สูญหายช่วงน้ำท่วม' },
        { property: 'og:title', content: 'Tabian - ทะเบียนรถสูญหายช่วงน้ำท่วม' },
        { property: 'og:description', content: 'ช่วยกันรวมและค้นหาป้ายทะเบียนรถที่หลุดหายจากการลุยน้ำท่วม' },
        { property: 'og:type', content: 'website' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap' }
      ]
    }
  },
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    adminSecretKey: process.env.ADMIN_SECRET_KEY || 'admin1234',
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    }
  }
})
