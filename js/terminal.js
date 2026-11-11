/* ==========================================================================
   Interactive terminal (Ctrl/⌘ + K). A small easter egg for technical
   recruiters: the whole profile is reachable through a few commands.
   ========================================================================== */
(() => {
  'use strict';

  const SITES = {
    linkedin: 'https://www.linkedin.com/in/haytam-ayadin-haltout-0a3384253/',
    github: 'https://github.com/haytam-25',
    mecanicai: 'https://mecanicai.org',
    juego: 'https://juegohaytam.vercel.app',
    game: 'https://juegohaytam.vercel.app'
  };

  const ALIASES = {
    ayuda: 'help', '?': 'help', h: 'help',
    sobre: 'about', 'sobre-mi': 'about', perfil: 'about',
    experiencia: 'experience', exp: 'experience', formacion: 'experience', 'formación': 'experience', education: 'experience',
    proyectos: 'projects', ls: 'projects', work: 'projects',
    habilidades: 'skills', stack: 'skills', tecnologias: 'skills', 'tecnologías': 'skills',
    certificados: 'certs', certificaciones: 'certs', certificates: 'certs', certifications: 'certs', diplomas: 'certs', cert: 'certs',
    contacto: 'contact', email: 'contact',
    idioma: 'lang', language: 'lang',
    fecha: 'date', hora: 'date', time: 'date',
    cls: 'clear', limpiar: 'clear',
    salir: 'exit', quit: 'exit', q: 'exit',
    abrir: 'open'
  };

  const COMMANDS = ['help', 'whoami', 'about', 'experience', 'projects', 'skills', 'certs', 'contact', 'open', 'lang', 'date', 'clear', 'exit', 'sudo', 'echo',
    'linkedin', 'github', 'mecanicai', 'juego', 'game'];

  const BANNER = String.raw`
 _                    _
| |__    __ _  _   _ | |_   __ _  _ __ ___
| '_ \  / _' || | | || __| / _' || '_ ' _ \
| | | || (_| || |_| || |_ | (_| || | | | | |
|_| |_| \__,_| \__, | \__| \__,_||_| |_| |_|
               |___/`;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function init(App) {
    const term = document.getElementById('term');
    if (!term) return;
    const out = term.querySelector('.term__out');
    const form = term.querySelector('.term__form');
    const input = term.querySelector('.term__in');
    const root = document.documentElement;
    const history = [];
    let hIdx = 0;
    let opener = null;
    let booted = false;

    const t = key => App.t(key);

    const print = (html, cls = '') => {
      const line = document.createElement('div');
      line.className = `term__line ${cls}`.trim();
      line.innerHTML = html;
      out.appendChild(line);
      out.scrollTop = out.scrollHeight;
      return line;
    };

    const rows = pairs => pairs.map(([a, b]) => `<div class="term__row"><span>${a}</span><span>${b}</span></div>`).join('');

    const openUrl = key => {
      const url = SITES[key];
      print(t('term.opening').replace('{site}', esc(key)), 'term__ok');
      window.open(url, '_blank', 'noopener');
    };

    function run(raw) {
      const line = raw.trim();
      print(`<span class="term__user">haytam@portfolio</span>:<span class="term__path">~</span>$ ${esc(line)}`, 'term__echo');
      if (!line) return;
      history.push(line);
      hIdx = history.length;

      const [first, ...args] = line.split(/\s+/);
      const name = first.toLowerCase();
      const cmd = ALIASES[name] || name;

      switch (cmd) {
        case 'help':
          print(rows(t('term.help').map(([a, b]) => [`<b>${a}</b>`, b])));
          break;
        case 'whoami':
          print(esc(t('term.whoami')));
          break;
        case 'about':
          print(esc(t('term.about')));
          break;
        case 'experience':
          print(rows(t('term.experience').map(([a, b]) => [esc(a), esc(b)])));
          break;
        case 'projects':
          print(rows(t('term.projects').map(([a, b]) => [esc(a), b])));
          break;
        case 'skills':
          print(rows(t('term.skills').map(([a, b]) => [esc(a), esc(b)])));
          break;
        case 'certs':
          print(rows(t('term.certs').map(([a, b]) => [esc(a), b])));
          break;
        case 'contact': {
          const L = t('term.contactLabels');
          print(rows([
            [L[0], `<a href="mailto:${App.EMAIL}">${App.EMAIL}</a>`],
            [L[1], `<a href="${SITES.linkedin}" target="_blank" rel="noopener">linkedin.com/in/haytam-ayadin-haltout</a>`],
            [L[2], `<a href="${SITES.github}" target="_blank" rel="noopener">github.com/haytam-25</a>`]
          ]));
          break;
        }
        
        case 'open': {
          const key = (args[0] || '').toLowerCase();
          if (SITES[key]) openUrl(key);
          else print(esc(t('term.openUsage')), 'term__muted');
          break;
        }
        case 'linkedin':
        case 'github':
        case 'mecanicai':
        case 'juego':
        case 'game':
          openUrl(cmd);
          break;
        case 'lang': {
          const l = (args[0] || '').toLowerCase();
          if (l !== 'es' && l !== 'en') {
            print(esc(t('term.langUsage')), 'term__muted');
            break;
          }
          App.setLang(l);
          print(esc(App.t('term.lang')), 'term__ok');
          break;
        }
        case 'date': {
          let time;
          try {
            time = new Intl.DateTimeFormat(App.lang === 'es' ? 'es-ES' : 'en-GB', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }).format(new Date());
          } catch (e) {
            time = new Date().toString();
          }
          print(esc(t('term.date').replace('{time}', time)));
          break;
        }
        case 'clear':
          out.innerHTML = '';
          break;
        case 'exit':
          print(esc(t('term.bye')), 'term__muted');
          setTimeout(close, 500);
          break;
        case 'sudo':
          print(esc(t('term.sudo')), 'term__muted');
          setTimeout(() => {
            print(esc(t('term.sudoOk')), 'term__ok');
            setTimeout(() => { location.href = `mailto:${App.EMAIL}`; }, 800);
          }, 800);
          break;
        case 'echo':
          print(esc(args.join(' ')));
          break;
        default:
          print(t('term.notFound').replace('{cmd}', esc(first)), 'term__err');
      }
    }

    function complete() {
      const v = input.value.trimStart().toLowerCase();
      if (!v || v.includes(' ')) {
        if (/^(open|abrir)\s+\S*$/.test(v)) {
          const part = v.split(/\s+/)[1];
          const match = Object.keys(SITES).filter(k => k.startsWith(part));
          if (match.length === 1) input.value = `${v.split(/\s+/)[0]} ${match[0]}`;
        }
        return;
      }
      const pool = COMMANDS.concat(Object.keys(ALIASES));
      const match = pool.filter(c => c.startsWith(v));
      if (match.length === 1) input.value = `${match[0]} `;
      else if (match.length > 1) print(match.map(m => `<b>${esc(m)}</b>`).join('  '), 'term__muted');
    }

    function boot() {
      booted = true;
      print(esc(BANNER.replace(/^\n/, '')), 'term__ascii');
      print(t('term.welcome'));
      print(esc(t('term.hint')), 'term__muted');
    }

    function open() {
      if (!term.hidden) return;
      opener = document.activeElement;
      term.hidden = false;
      root.classList.add('term-open');
      if (App.lenis) App.lenis.stop();
      if (!booted) boot();
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function close() {
      if (term.hidden) return;
      term.hidden = true;
      root.classList.remove('term-open');
      if (App.lenis && !root.classList.contains('menu-open')) App.lenis.start();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    }

    document.querySelectorAll('.js-term-open').forEach(b => b.addEventListener('click', open));
    term.addEventListener('click', e => { if (e.target.closest('[data-term-close]')) close(); });
    out.addEventListener('mouseup', () => {
      if (!String(window.getSelection())) input.focus({ preventScroll: true });
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        term.hidden ? open() : close();
      } else if (e.key === 'Escape' && !term.hidden) {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab' && !term.hidden) {
        // keep focus inside the dialog; Tab autocompletes instead
        e.preventDefault();
        if (document.activeElement === input) complete();
        else input.focus();
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      run(input.value);
      input.value = '';
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && history.length) {
        e.preventDefault();
        hIdx = Math.max(0, hIdx - 1);
        input.value = history[hIdx];
      } else if (e.key === 'ArrowDown' && history.length) {
        e.preventDefault();
        hIdx = Math.min(history.length, hIdx + 1);
        input.value = history[hIdx] || '';
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        out.innerHTML = '';
      }
    });

    App.openTerminal = open;
  }

  window.Terminal = { init };
})();
