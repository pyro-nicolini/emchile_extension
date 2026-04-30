# Mi Restaurante

> Generado por **PyZero Generator** — 27/4/2026

## Información del Proyecto

- **Tipo de negocio:** restaurant
- **Template base:** Personalizado
- **Versión del config:** 1.0.0
- **Páginas:** Inicio, Menú, galeria
- **Módulos activos:** bookings, services

## Inicio Rápido

```bash
npm install
cp .env.example .env
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```

## Estructura

```
src/
├── components/
│   ├── sections/   # Secciones generadas desde SiteConfig
│   ├── layout/     # Navbar, Footer, Layout
│   └── ui/         # Componentes reutilizables
├── pages/          # Una página por ruta
├── router/         # Configuración de React Router
├── context/        # Contextos globales
├── hooks/          # Custom hooks
├── services/       # API calls (Axios)
└── styles/         # tokens.css + global.css
```

---
*Creado con ❤️ por PyZero Agency Platform*
