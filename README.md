# Haytam Ayadin — Portfolio / CV web

Web estática, bilingüe (ES / EN) y sin frameworks: HTML, CSS y JavaScript.
No necesita build: se publica tal cual.

## Ver en local

Abre `index.html` con doble clic, o mejor, levanta un servidor estático:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Atajos útiles:
- `?lang=en` / `?lang=es` en la URL fuerza el idioma (ideal para enviar el enlace a empresas de fuera).
- `Ctrl + K` (o `⌘ + K`) abre la terminal interactiva.

## Publicar

Cualquier hosting estático sirve. Las dos opciones más rápidas y gratuitas:

- **Vercel**: `npx vercel` dentro de la carpeta (o importa el repo desde vercel.com). Sin configuración.
- **GitHub Pages**: sube la carpeta a un repo → *Settings → Pages* → rama `main`, carpeta `/ (root)`.

Después de publicar, cambia en `index.html` la etiqueta
`<meta property="og:image" content="assets/og-image.png">` por la URL absoluta
(`https://tu-dominio/assets/og-image.png`) para que LinkedIn muestre la vista previa.

## Estructura

```
index.html            Contenido (el texto en español vive aquí)
css/styles.css        Estilos, animaciones y responsive
js/i18n.js            Traducciones al inglés + textos generados por JS
js/main.js            Idioma, preloader, scroll, cursor, revelados, git graph, galería…
js/ascii-field.js     Fondo WebGL del hero (campo de glifos que reacciona al cursor)
js/visuals.js         Carrusel animado de capturas de cada proyecto
js/stack-physics.js   Píldoras del stack con física (Matter.js)
js/terminal.js        Terminal interactiva
js/vendor/            Lenis (scroll suave) y Matter.js (física), ambos MIT
assets/projects/      Capturas de los proyectos en WebP (900 px y 1600 px)
assets/certs/         Certificados (PDF) y sus insignias/logos
assets/og-image.png   Imagen de vista previa al compartir el enlace
```

## Editar contenido

- **Texto en español**: directamente en `index.html`.
- **Texto en inglés**: en `js/i18n.js`, con la misma clave que el atributo `data-i18n` del HTML.
- **Proyectos nuevos**: copia un `<article class="project">` dentro de `.work__track`;
  la galería horizontal se recalcula sola. Cada `<img class="shots__img">` es una pantalla
  del carrusel y su `data-path` es la ruta que se escribe en la barra del navegador.
- **Certificados nuevos**: sube el PDF y la insignia a `assets/certs/`, copia un
  `<article class="card cert">` dentro de `.certs__grid` (ponlo el primero si es el más reciente),
  añade sus claves `certN.*` en inglés en `js/i18n.js` y una fila en `term.certs` (ES y EN)
  para que salga en el comando `certs` de la terminal. La rejilla se adapta sola.

Respeta `prefers-reduced-motion` (sin animaciones para quien lo tenga activado)
y el contenido sigue visible aunque el JavaScript falle.
