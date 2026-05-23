# Sistema de Diseño (UX/UI) y Estilos

Este documento prescribe la identidad visual, tipografías, y paletas de colores empleadas en el front-end de Radio Nudista. La interfaz fue construida enteramente empleando **Tailwind CSS**, variables **CSS HSL nativas**, y componentes customizados que siguen la directriz de interfaz oscura (Dark UI) tipo "Glassmorphism" simplificado.

## 1. Patrón Visual General
El sitio se rige bajo una estética **Dark Flat Glassmorphism**. Lejos del típico efecto espejo translúcido, aquí el "cristal" se interpreta mediante un uso pesado del color negro absoluto con bordes y líneas translúcidas sutiles (`rgba(255,255,255,0.1)`), evocando tecnología robusta y minimalista.

---

## 2. Paleta de Colores Base
El sitio respeta la configuración nativa del tema oscuro (`dark`) e ignora en gran medida el tema claro por diseño artístico. Los tokens HSL primordiales configurados en `index.css` para el tema oscuro son:

*   **`background` (Fondo):** `hsl(222.2, 84%, 4.9%)` — Negro profundo/Azulado muy oscuro.
*   **`foreground` (Texto general):** `hsl(210, 40%, 98%)` — Blanco nítido con un imperceptible tono azul.
*   **`primary` (Elementos activos):** `hsl(210, 40%, 98%)` — Predominantemente blanco inverso.
*   **`border` / `input`:** `hsl(217.2, 32.6%, 17.5%)` — Grises azulados muy profundos para demarcar separaciones.
*   **Acentos Específicos (Gradientes):** El Player interactivo expone colores púrpuras y azules vivos.
    *   Gradiente base Play Button: `linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3))`
    *   Hover effect (iluminación): `linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(147, 51, 234, 0.4))` con sombra `0 8px 24px rgba(59, 130, 246, 0.4)`

---

## 3. Topografía de CSS Custom (Glass-Components)

Además de todas las clases utilitarias de Tailwind (ej. `bg-black/50`, `text-white`), en `index.css` radican clases base para asegurar consistencia a lo largo de las vistas en lugar de ensuciear el HTML.

### Glass Base (`.glass-card`, `.glass-container`, `.glass-navbar`)
*   **Fondo:** Negro sólido `rgba(0, 0, 0, 1)`.
*   **Bordes:** Líneas hiper delgadas translúcidas `1px solid rgba(255, 255, 255, 0.1)` (0.15 para cards).
*   **Interacciones:** Al hacer _hover_, la sombra aparece, el fondo apenas clarea hacia un `rgba(20, 20, 20, 1)` y se ejecuta una sutil elevación (`transform: translateY(-1px)`).

### Botones y Enlaces (`.glass-button`, `.nav-link`)
*   Texto claro al 80% (`rgba(255, 255, 255, 0.8)`).
*   Transiciones suaves de 0.3s que elevan el texto al blanco al 100% al posar el cursor, creando un efecto de brillo/encendido.
*   Los "links activos" en el nav no usan decoraciones intrusivas, sino simplemente el peso de tipografía `bold` y blanco puro.

---

## 4. Tipografía y Radios

### Font Family
El motor gráfico respeta la pila de fuentes por defecto enfocándose limpiamente en tipografías Modern/Sans-Serif:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Border Radius
El diseño apuesta fuertemente por filos cuadrados o ligeramente sutiles en los radios para potenciar el aura austera e industrial:
*   `none`: 0
*   `DEFAULT`: **~2px** (A pesar de que el valor original sugeriría curvas más redondeadas en Shadcn UI tradicional, el config. de Tailwind fuerza el multiplicador a la baja en la app).
*   `xl` y `2xl`: Ligeramente utilizados (~6px a 8px) cuando los containers obligan a empaquetar algo.
*   `full`: Para los `div` redondos de avatares o el botón circular principal del RadioPlayer.

---

## 5. Animaciones UI Exclusivas

*   **`animate-marquee` + `marquee-slow`**: Una animación custom clave en el `RadioPlayer`. Para los nombres de las pistas en vivo que suelen ser muy largos, existe esta envolvente que empuja el texto horizontalmente pixel a pixel (_character-by-character_) con desvanecimiento alfa en los extremos (`mask-image: linear-gradient()`) para que el scroll del texto sea hipnótico y no corte el diseño visual abruptamente.
*   **`accordion-down / up`**: Curvas de animación "ease-out" de corta duración (0.2s) en menús verticales y áreas despegables.

---

Este es el marco de referencia único. Para agregar nuevos bloques, en la medida de lo posible **nunca generes nuevos HEX absolutos**. Apóyate en el sistema `bg-background`, variantes `/20` para opacidad de tailwind (`bg-white/10`), o para partes oscuras absolutas invoca directamente `.glass-card`.
