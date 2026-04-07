/* ================================================
   ESTADO GLOBAL
   ================================================ */

var recordatorios         = []
var bienestarSeleccionado = 'Respiración guiada'
var duracionSeleccionada  = 15
var flowScore             = 0
var tareasCompletadas     = 0
var moodActual            = null
var filtroActual          = 'todas'
var notificacionesActivas = {}
var moodHistorial         = []   // [{ estado, hora, fecha }]
var ejerciciosHoy         = 0
var historialFlowScore    = {}   // { 'YYYY-MM-DD': score }

var timerInterval   = null
var timerSegundos   = 0
var timerActivo     = false
var ejercicioActual = null

// Drag & Drop
var dragSrcId = null

/* ================================================
   CLAVES LOCALSTORAGE
   ================================================ */
/* LS base — claves globales (no dependen del usuario) */
var LS_GLOBAL = {
  usuarios: 'mf_usuarios',
  sesion:   'mf_sesion'
}

/* LS dinámico — se inicializa al hacer login con el email como prefijo */
var LS = {
  recordatorios: 'mf_recordatorios',
  flowScore:     'mf_flowscore',
  flowFecha:     'mf_flowfecha',
  completadas:   'mf_completadas',
  mood:          'mf_mood',
  moodHistorial: 'mf_mood_historial',
  ejerciciosHoy: 'mf_ejercicios_hoy',
  historialFlow: 'mf_historial_flow',
  racha:         'mf_racha',           // { actual, mejor, ultimaFecha }
  nombreUsuario: 'mf_nombre_usuario',  // nombre editable por el usuario
  // mantener compatibilidad con auth
  usuarios:      'mf_usuarios',
  sesion:        'mf_sesion'
}

/* Actualiza todas las claves de LS para que usen el email como prefijo */
function inicializarLSParaUsuario(email) {
  var prefix = 'mf_' + email.replace(/[^a-z0-9]/gi, '_') + '_'
  LS.recordatorios = prefix + 'recordatorios'
  LS.flowScore     = prefix + 'flowscore'
  LS.flowFecha     = prefix + 'flowfecha'
  LS.completadas   = prefix + 'completadas'
  LS.mood          = prefix + 'mood'
  LS.moodHistorial = prefix + 'mood_historial'
  LS.ejerciciosHoy = prefix + 'ejercicios_hoy'
  LS.historialFlow = prefix + 'historial_flow'
  LS.racha         = prefix + 'racha'
  LS.nombreUsuario = prefix + 'nombre_usuario'
  // Las claves globales no cambian
  LS.usuarios = 'mf_usuarios'
  LS.sesion   = 'mf_sesion'
}

var usuarioActual = null   // { email, nombre }
var racha = { actual: 0, mejor: 0, ultimaFecha: '' }

/* ================================================
   CATÁLOGO DE EJERCICIOS
   ================================================ */
var catalogoEjercicios = {
  'respiracion-profunda':  { icono:'🌬️', cat:'Respiración',       nombre:'Respiración profunda',    desc:'Reduce el estrés regulando tu sistema nervioso.',                                                      pasos:['Siéntate con la espalda recta.','Inhala por la nariz 4 segundos.','Mantén el aire 2 segundos.','Exhala por la boca 6 segundos.','Repite sin forzar.'], durSeg:60 },
  'ciclos-478':            { icono:'🌬️', cat:'Respiración',       nombre:'Ciclos 4-7-8',            desc:'Calma la ansiedad y prepara el sistema nervioso.',                                                     pasos:['Exhala completamente.','Inhala por la nariz 4 seg.','Aguanta 7 seg.','Exhala 8 seg.','Repite 3 veces.'], durSeg:120 },
  'descanso-cognitivo':    { icono:'🧠', cat:'Pausa mental',       nombre:'Descanso cognitivo',       desc:'Reseteo mental que libera la sobrecarga de información.',                                              pasos:['Cierra los ojos.','Deja pasar los pensamientos.','Enfócate en tu respiración.','Abre los ojos despacio.'], durSeg:30 },
  'visualizacion-positiva':{ icono:'🧠', cat:'Pausa mental',       nombre:'Visualización positiva',  desc:'Activa tu motivación visualizando un resultado exitoso.',                                               pasos:['Cierra los ojos y respira.','Imagina que ya completaste tu tarea.','¿Cómo te sientes?','Lleva esa sensación al presente.','Abre los ojos con energía.'], durSeg:90 },
  'estiramiento-cervical': { icono:'💪', cat:'Activación corporal',nombre:'Estiramiento cervical',   desc:'Libera tensión en cuello y hombros por pantallas.',                                                    pasos:['Relaja los hombros.','Inclina la cabeza a la derecha 10 seg.','Regresa al centro.','Repite a la izquierda.','Gira el cuello suavemente.'], durSeg:60 },
  'rotacion-hombros':      { icono:'💪', cat:'Activación corporal',nombre:'Rotación de hombros',     desc:'Activa la circulación y reduce la rigidez postural.',                                                  pasos:['Siéntate erguido.','Sube los hombros hacia las orejas.','Ruédalos hacia atrás.','5 círculos atrás, 5 adelante.','Suelta los brazos con un suspiro.'], durSeg:45 },
  'intencion-consciente':  { icono:'🎯', cat:'Enfoque',            nombre:'Intención consciente',    desc:'Define con claridad qué vas a hacer, activando el enfoque.',                                           pasos:['Respira profundo.','Di: "Voy a hacer X."','Visualiza el primer paso.','Elimina distracciones.','Empieza en 30 segundos.'], durSeg:45 },
  'pomodoro-mental':       { icono:'🎯', cat:'Enfoque',            nombre:'Pomodoro mental',          desc:'Meditación pre-tarea para sesiones de trabajo profundo.',                                              pasos:['Siéntate recto.','Elimina todo lo no urgente de tu mente.','Repite tu tarea 3 veces internamente.','Abre los ojos. Solo existe esa tarea.','Activa el temporizador.'], durSeg:180 },
  'escaneo-corporal':      { icono:'🌙', cat:'Relajación',         nombre:'Escaneo corporal',         desc:'Libera la tensión del día recorriendo tu cuerpo.',                                                    pasos:['Siéntate cómodamente.','Empieza desde los pies.','Sube por piernas y abdomen.','Continúa por brazos y cuello.','Suelta cualquier tensión.'], durSeg:120 }
}

var infoEjercicio = {
  'Respiración guiada':  { icono:'🌬️', clase:'respiracion', desc:'Inhala 4 seg, mantén 4 seg, exhala 6 seg. Repite 3 veces.', dur:'45 segundos' },
  'Pausa consciente':    { icono:'🧘', clase:'pausa',        desc:'Cierra los ojos y observa tus pensamientos sin juzgarlos.', dur:'1 minuto' },
  'Ejercicio mental':    { icono:'🎯', clase:'ejercicio',    desc:'Visualiza el resultado exitoso. Define tu intención.',      dur:'30 segundos' },
  'Activación corporal': { icono:'💪', clase:'activacion',   desc:'Movimientos suaves de cuello y hombros para soltar tensión.',dur:'1 minuto' }
}

var sugerenciaPorEstado = { estresado:'Respiración guiada', neutral:'Pausa consciente', enfocado:'Ejercicio mental', cansado:'Activación corporal' }

var moodInfo = {
  estresado: { ico:'😰', label:'Estresado', color:'#E05C5C' },
  neutral:   { ico:'😐', label:'Neutral',   color:'#5ABCB9' },
  enfocado:  { ico:'🎯', label:'Enfocado',  color:'#399E5A' },
  cansado:   { ico:'😴', label:'Cansado',   color:'#F7B267' }
}

/* ================================================
   LOCALSTORAGE
   ================================================ */
function guardarEnStorage() {
  try {
    localStorage.setItem(LS.recordatorios, JSON.stringify(recordatorios))
    localStorage.setItem(LS.flowScore,     JSON.stringify(flowScore))
    localStorage.setItem(LS.flowFecha,     new Date().toDateString())
    localStorage.setItem(LS.completadas,   JSON.stringify(tareasCompletadas))
    localStorage.setItem(LS.historialFlow, JSON.stringify(historialFlowScore))
  } catch(e) {}
}

function guardarRacha() {
  try { localStorage.setItem(LS.racha, JSON.stringify(racha)) } catch(e) {}
}

function guardarNombreUsuario(nombre) {
  try { localStorage.setItem(LS.nombreUsuario, nombre) } catch(e) {}
}

function guardarMoodStorage(estado, hora) {
  try {
    localStorage.setItem(LS.mood, JSON.stringify({ estado, hora, fecha: new Date().toDateString() }))
    localStorage.setItem(LS.moodHistorial, JSON.stringify(moodHistorial))
  } catch(e) {}
}

function guardarBienestarStorage() {
  try {
    localStorage.setItem(LS.ejerciciosHoy, JSON.stringify({ num: ejerciciosHoy, fecha: new Date().toDateString() }))
  } catch(e) {}
}

function cargarDesdeStorage() {
  try {
    var fs   = localStorage.getItem(LS.flowScore)
    var ff   = localStorage.getItem(LS.flowFecha)
    var tc   = localStorage.getItem(LS.completadas)
    var hf   = localStorage.getItem(LS.historialFlow)
    if (hf !== null) historialFlowScore = JSON.parse(hf)
    if (tc !== null) tareasCompletadas  = JSON.parse(tc)

    // ── CARGAR RACHA ──────────────────────────────────────
    var rg = localStorage.getItem(LS.racha)
    if (rg) racha = JSON.parse(rg)
    actualizarRacha()   // verifica si hay que sumar un día o romperla

    // ── CARGAR NOMBRE EDITABLE ────────────────────────────
    var nombreGuardado = localStorage.getItem(LS.nombreUsuario)
    if (nombreGuardado) {
      var pn = document.getElementById('perfil-nombre')
      if (pn) pn.textContent = nombreGuardado
      var sh = document.getElementById('header-saludo')
      if (sh) {
        var h   = new Date().getHours()
        var sal = h<12?'Buenos días':h<18?'Buenas tardes':'Buenas noches'
        sh.textContent = sal + ', ' + nombreGuardado
      }
    }

    // ── RESET DIARIO DEL FLOW SCORE ──────────────────────
    // Si el score guardado es de un día anterior → guardar en historial y resetear
    if (fs !== null) {
      var fechaGuardada = ff || ''
      var hoy           = new Date().toDateString()
      if (fechaGuardada !== hoy) {
        // Archivar el score del día anterior en el historial
        var fechaAyer = fechaGuardada ? new Date(fechaGuardada) : new Date()
        historialFlowScore[fechaKey(fechaAyer)] = JSON.parse(fs)
        // Resetear
        flowScore = 0
        tareasCompletadas = 0
        localStorage.removeItem(LS.completadas)
        localStorage.setItem(LS.flowScore,  '0')
        localStorage.setItem(LS.flowFecha,  hoy)
        localStorage.setItem(LS.historialFlow, JSON.stringify(historialFlowScore))
      } else {
        flowScore = JSON.parse(fs)
      }
    }

    // Mood historial
    var mh = localStorage.getItem(LS.moodHistorial)
    if (mh) { moodHistorial = JSON.parse(mh); renderMoodHistorial(); renderPerfilMoodLista() }

    // Ejercicios hoy
    var eh = localStorage.getItem(LS.ejerciciosHoy)
    if (eh) {
      var parsed = JSON.parse(eh)
      if (parsed.fecha === new Date().toDateString()) {
        ejerciciosHoy = parsed.num
        actualizarEjerciciosHoyUI()
      }
    }

    // Mood del día
    var md = localStorage.getItem(LS.mood)
    if (md) {
      var m = JSON.parse(md)
      if (m.fecha === new Date().toDateString()) {
        moodActual = m.estado
        var info = moodInfo[m.estado]
        if (info) {
          document.getElementById('mood-ico').textContent  = info.ico
          document.getElementById('mood-txt').textContent  = info.label
          document.getElementById('mood-hora').textContent = 'Registrado a las ' + m.hora
          document.getElementById('mood-registro').classList.remove('oculto')
          document.getElementById('pmc-val').textContent   = info.ico + ' ' + info.label
          document.getElementById('pmc-hora').textContent  = 'Registrado a las ' + m.hora
          // Restaurar slide activo en carrusel
          var idx = moodEstados.indexOf(m.estado)
          if(idx >= 0) {
            moodIndex = idx
            actualizarDots(idx)
            var slide = document.querySelector('.mood-slide.' + m.estado)
            if(slide) slide.classList.add('sel')
            // Scroll sin animación al slide guardado
            setTimeout(function() {
              var carousel = document.getElementById('mood-carousel')
              var slides   = carousel ? carousel.querySelectorAll('.mood-slide') : []
              if(slides[idx]) {
                var slideW = slides[0].offsetWidth + 8
                carousel.scrollLeft = idx * slideW
              }
            }, 100)
          }
        }
      }
    }

    // Recordatorios
    var rg = localStorage.getItem(LS.recordatorios)
    if (rg) {
      JSON.parse(rg).forEach(function(r) {
        recordatorios.push(r)
        renderCard(r)
        if (r.estado !== 'completada' && r.fecha && r.hora) programarNotificacion(r)
        restaurarEstadoCard(r)
      })
    }

    refrescarUI()
  } catch(e) {}
}

function restaurarEstadoCard(r) {
  if (r.estado === 'en-curso') {
    var c = document.getElementById('card-' + r.id); if(c) c.classList.add('en-curso')
    var e = document.getElementById('estado-' + r.id); if(e){ e.textContent='● En curso'; e.className='card-estado en-curso' }
    var bi = document.getElementById('btn-iniciar-' + r.id);   if(bi) bi.classList.add('oculto')
    var bc = document.getElementById('btn-completar-' + r.id); if(bc) bc.classList.remove('oculto')
  }
  if (r.estado === 'completada') {
    var c2 = document.getElementById('card-' + r.id); if(c2){ c2.classList.remove('en-curso'); c2.classList.add('completada') }
    var e2 = document.getElementById('estado-' + r.id); if(e2){ e2.textContent='✓ Completada'; e2.className='card-estado completada' }
    var bc2 = document.getElementById('btn-completar-' + r.id); if(bc2) bc2.classList.add('oculto')
    var bi2 = document.getElementById('btn-iniciar-' + r.id);   if(bi2) bi2.classList.add('oculto')
  }
}

function refrescarUI() {
  document.getElementById('flow-fill').style.width = flowScore + '%'
  document.getElementById('flow-num').textContent  = flowScore
  var sf = document.getElementById('stat-flow');   if(sf) sf.textContent = flowScore
  var st = document.getElementById('stat-tasks');  if(st) st.textContent = recordatorios.length
  var sd = document.getElementById('stat-done');   if(sd) sd.textContent = tareasCompletadas
  renderGraficaSemanal()
}

/* ================================================
   INICIALIZACIÓN CON AUTH
   ================================================ */
document.addEventListener('DOMContentLoaded', function() {
  iniciarSplash()
})

function iniciarSplash() {
  // Asegurar que solo el splash sea visible al inicio
  document.querySelectorAll('.auth-screen').forEach(function(s) {
    if (s.id !== 'screen-splash') s.classList.add('oculto')
  })
  var main = document.getElementById('app-main')
  if (main) main.classList.add('oculto')

  var fill = document.getElementById('splash-bar-fill')
  var pct  = 0

  var intervalo = setInterval(function() {
    pct += 4
    if (fill) fill.style.width = Math.min(pct, 100) + '%'
    if (pct >= 100) {
      clearInterval(intervalo)
      setTimeout(verificarSesion, 300)
    }
  }, 40)
}

function verificarSesion() {
  try {
    var raw = localStorage.getItem('mf_sesion')
    if (raw) {
      var sesion = JSON.parse(raw)
      if (sesion && sesion.email) {
        usuarioActual = sesion
        inicializarLSParaUsuario(sesion.email)
        arrancarApp()
        return
      }
    }
  } catch(e) {}
  irA('screen-login')
}

/* ── Navegar entre pantallas de auth ── */
function irA(pantallaId) {
  document.querySelectorAll('.auth-screen').forEach(function(s) {
    s.classList.add('oculto')
  })
  var destino = document.getElementById(pantallaId)
  if (destino) destino.classList.remove('oculto')
}

/* ── Iniciar la app después del login ── */
function arrancarApp() {
  // Ocultar splash y todas las pantallas de auth
  document.querySelectorAll('.auth-screen').forEach(function(s) {
    s.classList.add('oculto')
  })
  // Mostrar app principal
  var main = document.getElementById('app-main')
  if (main) main.classList.remove('oculto')

  // Personalizar saludo con nombre de usuario
  var d   = new Date()
  var fe  = document.getElementById('header-date')
  if(fe)  fe.textContent = d.toLocaleDateString('es-CO',{ weekday:'short', day:'numeric', month:'short' })
  var h   = d.getHours()
  var sal = h<12?'Buenos días':h<18?'Buenas tardes':'Buenas noches'
  var nombre = usuarioActual ? usuarioActual.nombre : 'usuario'
  var se  = document.getElementById('header-saludo')
  if(se)  se.textContent = sal + ', ' + nombre

  // Actualizar nombre en perfil
  var pn = document.getElementById('perfil-nombre')
  if(pn) pn.textContent = nombre
  var pe = document.getElementById('perfil-email-txt')
  if(pe) pe.textContent = usuarioActual ? usuarioActual.email : ''

  pedirPermisoNotificaciones()
  initMoodCarousel()
  cargarDesdeStorage()

  var hoy = fechaKey(new Date())
  if(!historialFlowScore[hoy]) { historialFlowScore[hoy] = flowScore; guardarEnStorage() }
  programarResetMedianoche()
  iniciarNotificacionesMotivacionales()
}

/* ================================================
   REGISTRO
   ================================================ */
function hacerRegistro() {
  limpiarErroresAuth()
  var nombre = document.getElementById('reg-nombre').value.trim()
  var email  = document.getElementById('reg-email').value.trim().toLowerCase()
  var pass   = document.getElementById('reg-pass').value
  var pass2  = document.getElementById('reg-pass2').value
  var ok     = true

  if(!nombre)               { mostrarErrorAuth('reg-nombre-err', 'Ingresa tu nombre');           ok=false }
  if(!emailValido(email))   { mostrarErrorAuth('reg-email-err',  'Correo no válido');            ok=false }
  if(pass.length < 6)       { mostrarErrorAuth('reg-pass-err',   'Mínimo 6 caracteres');         ok=false }
  if(pass !== pass2)        { mostrarErrorAuth('reg-pass2-err',  'Las contraseñas no coinciden');ok=false }
  if(!ok) return

  var usuarios = obtenerUsuarios()
  if(usuarios[email])       { mostrarErrorAuth('reg-email-err',  'Este correo ya está registrado'); return }

  usuarios[email] = { nombre: nombre, passHash: simpleHash(pass) }
  localStorage.setItem(LS.usuarios, JSON.stringify(usuarios))

  // Login automático tras registro
  usuarioActual = { email: email, nombre: nombre }
  localStorage.setItem('mf_sesion', JSON.stringify(usuarioActual))
  inicializarLSParaUsuario(email)
  arrancarApp()
}

/* ================================================
   LOGIN
   ================================================ */
function hacerLogin() {
  limpiarErroresAuth()
  var email = document.getElementById('login-email').value.trim().toLowerCase()
  var pass  = document.getElementById('login-pass').value
  var ok    = true

  if(!emailValido(email)) { mostrarErrorAuth('login-email-err', 'Correo no válido'); ok=false }
  if(!pass)               { mostrarErrorAuth('login-pass-err',  'Ingresa tu contraseña'); ok=false }
  if(!ok) return

  var usuarios = obtenerUsuarios()
  var user     = usuarios[email]

  if(!user || user.passHash !== simpleHash(pass)) {
    mostrarErrorAuth('login-pass-err', 'Correo o contraseña incorrectos')
    document.getElementById('login-email').classList.add('error')
    document.getElementById('login-pass').classList.add('error')
    return
  }

  usuarioActual = { email: email, nombre: user.nombre }
  localStorage.setItem('mf_sesion', JSON.stringify(usuarioActual))
  inicializarLSParaUsuario(email)
  arrancarApp()
}

/* ================================================
   RECUPERAR CONTRASEÑA
   ================================================ */
function hacerRecuperar() {
  limpiarErroresAuth()
  var email = document.getElementById('forgot-email').value.trim().toLowerCase()
  if(!emailValido(email)) { mostrarErrorAuth('forgot-email-err', 'Correo no válido'); return }
  // Simulación — en producción aquí iría la llamada al backend
  document.getElementById('forgot-success').classList.remove('oculto')
  document.getElementById('forgot-email').disabled = true
  document.querySelector('#screen-forgot .auth-btn').style.display = 'none'
}

/* ================================================
   CERRAR SESIÓN
   ================================================ */
function cerrarSesion() {
  localStorage.removeItem('mf_sesion')
  usuarioActual = null
  racha = { actual: 0, mejor: 0, ultimaFecha: '' }
  // Resetear estado en memoria
  recordatorios = []; flowScore = 0; tareasCompletadas = 0
  moodHistorial = []; ejerciciosHoy = 0; historialFlowScore = {}
  // Resetear claves LS a valores genéricos
  LS.recordatorios = 'mf_recordatorios'
  LS.flowScore     = 'mf_flowscore'
  LS.flowFecha     = 'mf_flowfecha'
  LS.completadas   = 'mf_completadas'
  LS.mood          = 'mf_mood'
  LS.moodHistorial = 'mf_mood_historial'
  LS.ejerciciosHoy = 'mf_ejercicios_hoy'
  LS.historialFlow = 'mf_historial_flow'
  LS.racha         = 'mf_racha'
  LS.nombreUsuario = 'mf_nombre_usuario'
  // Limpiar lista visual
  var lista = document.getElementById('lista')
  if(lista) lista.innerHTML = '<div class="empty-state" id="empty-msg"><div class="empty-icon">🧘</div><p>No hay recordatorios aún.<br>Crea uno consciente con el botón <strong>+</strong></p></div>'
  // Ocultar app y mostrar login
  var main = document.getElementById('app-main')
  if(main) main.classList.add('oculto')
  limpiarCamposLogin()
  irA('screen-login')
}

/* ================================================
   HELPERS AUTH
   ================================================ */
function obtenerUsuarios() {
  try { return JSON.parse(localStorage.getItem(LS.usuarios)) || {} }
  catch(e) { return {} }
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Hash muy simple (para demo — en producción usar bcrypt en backend)
function simpleHash(str) {
  var hash = 0
  for(var i=0; i<str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

function mostrarErrorAuth(id, msg) {
  var el = document.getElementById(id)
  if(el) { el.textContent = msg; el.classList.remove('oculto') }
}

function limpiarErroresAuth() {
  document.querySelectorAll('.auth-field-error').forEach(function(e){ e.classList.add('oculto'); e.textContent='' })
  document.querySelectorAll('.auth-input').forEach(function(i){ i.classList.remove('error') })
}

function limpiarCamposLogin() {
  var campos = ['login-email','login-pass','reg-nombre','reg-email','reg-pass','reg-pass2','forgot-email']
  campos.forEach(function(id){ var el=document.getElementById(id); if(el) el.value='' })
  var fs = document.getElementById('forgot-success'); if(fs) fs.classList.add('oculto')
  var fb = document.querySelector('#screen-forgot .auth-btn'); if(fb) fb.style.display=''
  var fe = document.getElementById('forgot-email'); if(fe) fe.disabled=false
  limpiarErroresAuth()
}

function togglePass(inputId, btn) {
  var input = document.getElementById(inputId)
  if(!input) return
  if(input.type === 'password') {
    input.type = 'text'
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
  } else {
    input.type = 'password'
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
  }
}

// ── Permitir Enter en formularios de auth ──
document.addEventListener('keydown', function(e) {
  if(e.key !== 'Enter') return
  var loginVisible    = document.getElementById('screen-login')    && !document.getElementById('screen-login').classList.contains('oculto')
  var registerVisible = document.getElementById('screen-register') && !document.getElementById('screen-register').classList.contains('oculto')
  var forgotVisible   = document.getElementById('screen-forgot')   && !document.getElementById('screen-forgot').classList.contains('oculto')
  if(loginVisible)    hacerLogin()
  if(registerVisible) hacerRegistro()
  if(forgotVisible)   hacerRecuperar()
})

/* ================================================
   RESET DIARIO A MEDIANOCHE
   ================================================ */
function programarResetMedianoche() {
  var ahora     = new Date()
  var manana    = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 5)
  var msHastaMedianoche = manana.getTime() - ahora.getTime()

  setTimeout(function() {
    // Archivar score del día en historial
    historialFlowScore[fechaKey(new Date())] = flowScore
    // Resetear contadores
    flowScore         = 0
    tareasCompletadas = 0
    ejerciciosHoy     = 0
    // Guardar
    guardarEnStorage()
    guardarBienestarStorage()
    // Actualizar UI
    refrescarUI()
    actualizarEjerciciosHoyUI()
    mostrarToast('🌅 ¡Nuevo día! Flow Score reiniciado')
    // Actualizar racha del nuevo día
    actualizarRacha()
    // Volver a programar para el siguiente día
    programarResetMedianoche()
  }, msHastaMedianoche)
}

/* ================================================
   NOTIFICACIONES MOTIVACIONALES PERIÓDICAS
   ================================================ */
var mensajesMotivacionales = [
  { titulo:'🌿 ¿Cómo vas hoy?',         cuerpo:'Recuerda registrar tu estado mental y completar una tarea consciente.' },
  { titulo:'🎯 Momento de enfocarte',    cuerpo:'Tienes tareas pendientes. Un pequeño paso marca la diferencia.' },
  { titulo:'🌬️ Pausa de bienestar',     cuerpo:'Llevas un rato trabajando. ¿Qué tal una respiración guiada de 30 segundos?' },
  { titulo:'💪 Sigue adelante',          cuerpo:'Cada tarea completada suma puntos a tu Flow Score. ¡Vas muy bien!' },
  { titulo:'🧘 Recuerda tu intención',   cuerpo:'Abre MindFlow y revisa tus recordatorios conscientes de hoy.' },
  { titulo:'🌟 Tu bienestar importa',    cuerpo:'No olvides hacer una pausa mental. Tu mente te lo agradecerá.' },
  { titulo:'🚀 Momento de acción',       cuerpo:'¿Tienes tareas en curso? Es buen momento para completarlas.' },
  { titulo:'😊 ¿Cómo te sientes ahora?', cuerpo:'Registra tu estado de ánimo y obtén +3 puntos en tu Flow Score.' }
]

var intervaloMotivacional = null

function iniciarNotificacionesMotivacionales() {
  if(!('Notification' in window)) return

  // Limpiar intervalo previo si existía
  if(intervaloMotivacional) clearInterval(intervaloMotivacional)

  // Enviar notificación motivacional cada 2 horas (7200000 ms)
  // Solo entre las 8am y las 10pm para no molestar
  intervaloMotivacional = setInterval(function() {
    var hora = new Date().getHours()
    if(hora >= 8 && hora < 22) {
      enviarNotificacionMotivacional()
    }
  }, 2 * 60 * 60 * 1000)

  // Primera notificación motivacional: 30 minutos después de abrir la app
  setTimeout(function() {
    var hora = new Date().getHours()
    if(hora >= 8 && hora < 22) enviarNotificacionMotivacional()
  }, 30 * 60 * 1000)
}

function enviarNotificacionMotivacional() {
  if(!('Notification' in window) || Notification.permission !== 'granted') return

  // Elegir mensaje según contexto
  var msg = elegirMensajeContextual()

  var n = new Notification(msg.titulo, {
    body: msg.cuerpo,
    tag:  'mf-motivacional',
    requireInteraction: false
  })
  n.onclick = function() { window.focus(); n.close() }
}

function elegirMensajeContextual() {
  // Si tiene tareas pendientes → motivar a completar
  var pendientes = recordatorios.filter(function(r){ return r.estado === 'pendiente' })
  var enCurso    = recordatorios.filter(function(r){ return r.estado === 'en-curso' })

  if(enCurso.length > 0) return { titulo:'🚀 ¡Termina lo que empezaste!', cuerpo:'Tienes '+enCurso.length+' tarea(s) en curso. ¡Puedes completarlas!' }
  if(pendientes.length > 0) return { titulo:'🎯 Tareas esperando', cuerpo:'Tienes '+pendientes.length+' tarea(s) pendiente(s). ¿Cuál haces primero?' }
  if(flowScore >= 80) return { titulo:'🌟 ¡Increíble día!', cuerpo:'Tu Flow Score es '+flowScore+'. Estás en tu mejor momento. ¡Sigue así!' }
  if(flowScore === 0 && recordatorios.length === 0) return { titulo:'🌿 Empieza el día con intención', cuerpo:'Crea tu primer recordatorio consciente de hoy.' }

  // Mensaje aleatorio del pool
  return mensajesMotivacionales[Math.floor(Math.random() * mensajesMotivacionales.length)]
}

// ──────────────────────────────────────────────────

function fechaKey(d) {
  return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()
}

/* ================================================
   RACHA DE DÍAS CONSECUTIVOS
   ================================================ */
function actualizarRacha() {
  var hoy      = new Date().toDateString()
  var ayer     = new Date(Date.now() - 86400000).toDateString()

  if (racha.ultimaFecha === hoy) {
    // Ya se contó hoy — solo actualizar UI
    actualizarRachaUI()
    return
  }

  if (racha.ultimaFecha === ayer) {
    // Entró ayer → sumar un día
    racha.actual++
  } else if (racha.ultimaFecha === '') {
    // Primera vez
    racha.actual = 1
  } else {
    // Rompió la racha — más de un día sin entrar
    racha.actual = 1
  }

  racha.ultimaFecha = hoy
  if (racha.actual > racha.mejor) racha.mejor = racha.actual

  guardarRacha()
  actualizarRachaUI()
}

function actualizarRachaUI() {
  var el = document.getElementById('racha-num')
  if (el) el.textContent = racha.actual

  var mejor = document.getElementById('racha-mejor')
  if (mejor) mejor.textContent = 'Récord: ' + racha.mejor + ' día' + (racha.mejor !== 1 ? 's' : '')

  // Emoji que cambia según la racha
  var ico = document.getElementById('racha-ico')
  if (ico) {
    if      (racha.actual >= 30) ico.textContent = '🏆'
    else if (racha.actual >= 14) ico.textContent = '🔥'
    else if (racha.actual >= 7)  ico.textContent = '⚡'
    else if (racha.actual >= 3)  ico.textContent = '🌱'
    else                         ico.textContent = '✨'
  }
}

/* ================================================
   NOMBRE DE USUARIO EDITABLE
   ================================================ */
function activarEdicionNombre() {
  var el = document.getElementById('perfil-nombre')
  if (!el || el.querySelector('input')) return   // evitar doble activación

  var nombreActual = el.textContent.trim()

  el.innerHTML =
    '<input id="nombre-input" class="nombre-input" type="text" ' +
    'value="' + nombreActual + '" maxlength="30" ' +
    'onblur="guardarNombreEditable()" ' +
    'onkeydown="if(event.key===\'Enter\') this.blur(); if(event.key===\'Escape\') cancelarEdicionNombre(\'' + nombreActual + '\')"' +
    '>'

  var input = document.getElementById('nombre-input')
  if (input) {
    input.focus()
    input.select()
  }
}

function guardarNombreEditable() {
  var input = document.getElementById('nombre-input')
  if (!input) return

  var nuevoNombre = input.value.trim()
  if (!nuevoNombre) nuevoNombre = usuarioActual ? usuarioActual.nombre : 'Usuario'

  // Actualizar UI
  var el = document.getElementById('perfil-nombre')
  if (el) el.textContent = nuevoNombre

  // Actualizar saludo en header
  var sh = document.getElementById('header-saludo')
  if (sh) {
    var h   = new Date().getHours()
    var sal = h<12?'Buenos días':h<18?'Buenas tardes':'Buenas noches'
    sh.textContent = sal + ', ' + nuevoNombre
  }

  guardarNombreUsuario(nuevoNombre)
  mostrarToast('✏️ Nombre actualizado')
}

function cancelarEdicionNombre(nombreOriginal) {
  var el = document.getElementById('perfil-nombre')
  if (el) el.textContent = nombreOriginal
}

/* ================================================
   NAVEGACIÓN
   ================================================ */
function cambiarTab(tab) {
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active') })
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active') })
  document.getElementById('screen-'+tab).classList.add('active')
  document.getElementById('nav-'+tab).classList.add('active')
  if(tab==='perfil') renderGraficaSemanal()
}

function abrirPanel(id)  { document.getElementById(id).classList.remove('oculto') }
function cerrarPanel(id) { document.getElementById(id).classList.add('oculto') }

/* ================================================
   ESTADO MENTAL — CARRUSEL
   ================================================ */
var moodIndex = 0
var moodEstados = ['estresado','neutral','enfocado','cansado']

function initMoodCarousel() {
  var carousel = document.getElementById('mood-carousel')
  if(!carousel) return

  // Click en slide
  carousel.querySelectorAll('.mood-slide').forEach(function(slide, i) {
    slide.addEventListener('click', function() {
      seleccionarMoodSlide(i)
    })
  })

  // Drag con mouse
  var isDragging = false, startX = 0, scrollLeft = 0
  carousel.addEventListener('mousedown', function(e) {
    isDragging = true; startX = e.pageX - carousel.offsetLeft; scrollLeft = carousel.scrollLeft
    carousel.classList.add('grabbing')
  })
  carousel.addEventListener('mouseleave', function() { isDragging = false; carousel.classList.remove('grabbing') })
  carousel.addEventListener('mouseup',    function() { isDragging = false; carousel.classList.remove('grabbing') })
  carousel.addEventListener('mousemove',  function(e) {
    if(!isDragging) return
    e.preventDefault()
    var x = e.pageX - carousel.offsetLeft
    carousel.scrollLeft = scrollLeft - (x - startX) * 1.2
  })

  // Touch swipe
  var touchStartX = 0
  carousel.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX }, { passive:true })
  carousel.addEventListener('touchend',   function(e) {
    var diff = touchStartX - e.changedTouches[0].clientX
    if(Math.abs(diff) > 30) {
      if(diff > 0 && moodIndex < 3) seleccionarMoodSlide(moodIndex + 1)
      else if(diff < 0 && moodIndex > 0) seleccionarMoodSlide(moodIndex - 1)
    }
  })

  // Scroll → actualizar punto activo
  carousel.addEventListener('scroll', function() {
    var slideW = carousel.querySelector('.mood-slide').offsetWidth + 8
    var idx    = Math.round(carousel.scrollLeft / slideW)
    if(idx !== moodIndex) { moodIndex = idx; actualizarDots(idx) }
  })

  // Clicks en dots
  document.querySelectorAll('.mdot').forEach(function(dot) {
    dot.addEventListener('click', function() {
      seleccionarMoodSlide(parseInt(this.getAttribute('data-i')))
    })
  })
}

function seleccionarMoodSlide(idx) {
  moodIndex = idx
  var carousel = document.getElementById('mood-carousel')
  var slides   = carousel.querySelectorAll('.mood-slide')
  var slideW   = slides[0].offsetWidth + 8

  // Scroll suave
  carousel.scrollTo({ left: idx * slideW, behavior:'smooth' })
  actualizarDots(idx)

  // Activar estado
  var estado = moodEstados[idx]
  setMood(estado)
}

function actualizarDots(idx) {
  document.querySelectorAll('.mdot').forEach(function(d, i) {
    d.classList.toggle('active', i === idx)
  })
}

function setMood(estado) {
  // Marcar slide activo visualmente
  document.querySelectorAll('.mood-slide').forEach(function(s) { s.classList.remove('sel') })
  var slide = document.querySelector('.mood-slide.' + estado)
  if(slide) slide.classList.add('sel')

  moodActual = estado
  var info  = moodInfo[estado]
  var ahora = new Date().toLocaleTimeString('es-CO',{ hour:'2-digit', minute:'2-digit' })

  // Mostrar registro encima del carrusel
  document.getElementById('mood-ico').textContent  = info.ico
  document.getElementById('mood-txt').textContent  = info.label
  document.getElementById('mood-hora').textContent = 'Registrado a las ' + ahora
  document.getElementById('mood-registro').classList.remove('oculto')

  // Perfil — card
  document.getElementById('pmc-val').textContent   = info.ico + ' ' + info.label
  document.getElementById('pmc-hora').textContent  = 'Registrado a las ' + ahora

  // Agregar al historial
  moodHistorial.unshift({ estado:estado, hora:ahora, fecha:new Date().toLocaleDateString('es-CO',{day:'numeric',month:'short',weekday:'short'}) })
  if(moodHistorial.length > 30) moodHistorial.pop()
  renderMoodHistorial()
  renderPerfilMoodLista()

  // Bienestar — sugerir ejercicio
  var sug = sugerenciaPorEstado[estado]
  var ops = document.querySelectorAll('.bop')
  var idx = Object.keys(infoEjercicio).indexOf(sug)
  document.querySelectorAll('.bop').forEach(function(o){ o.classList.remove('sel') })
  if(idx>=0 && ops[idx]) { ops[idx].classList.add('sel'); bienestarSeleccionado = sug }

  actualizarFlowScore(3)
  guardarMoodStorage(estado, ahora)
}

function renderMoodHistorial() {
  var el = document.getElementById('mood-historial')
  if(!el) return
  if(moodHistorial.length === 0) { el.innerHTML = '<div class="mood-historial-empty">Sin registros aún</div>'; return }
  el.innerHTML = moodHistorial.map(function(m) {
    var info = moodInfo[m.estado]
    return '<div class="mood-hist-item">' +
      '<span class="mhi-ico">'+info.ico+'</span>' +
      '<div class="mhi-info"><div class="mhi-label">'+info.label+'</div><div class="mhi-hora">'+m.fecha+' · '+m.hora+'</div></div>' +
    '</div>'
  }).join('')
}

function renderPerfilMoodLista() {
  var el = document.getElementById('perfil-mood-lista')
  if(!el) return
  if(moodHistorial.length === 0) { el.innerHTML = '<div class="pml-empty">Sin registros aún</div>'; return }
  el.innerHTML = moodHistorial.map(function(m) {
    var info = moodInfo[m.estado]
    return '<div class="pml-item ' + m.estado + '">' +
      '<span class="pml-ico">'+info.ico+'</span>' +
      '<div><div class="pml-label">'+info.label+'</div><div class="pml-meta">'+m.fecha+'</div></div>' +
      '<span class="pml-hora">'+m.hora+'</span>' +
    '</div>'
  }).join('')
}

function toggleMoodHistorial() {
  var acc  = document.getElementById('pmc-accordion')
  var hist = document.getElementById('pmc-historial')
  if(!acc || !hist) return
  var isOpen = acc.classList.contains('open')
  if(isOpen) {
    acc.classList.remove('open')
    hist.classList.add('oculto')
  } else {
    renderPerfilMoodLista()
    acc.classList.add('open')
    hist.classList.remove('oculto')
  }
}

/* ================================================
   BIENESTAR — CONTADOR Y GRÁFICA
   ================================================ */
function actualizarEjerciciosHoyUI() {
  var el = document.getElementById('ejercicios-hoy-num')
  if(el) el.textContent = ejerciciosHoy
}

function renderGraficaSemanal() {
  var el = document.getElementById('grafica-semanal')
  if(!el) return
  var dias = []
  var hoy = new Date()
  for(var i=6; i>=0; i--) {
    var d = new Date(hoy); d.setDate(hoy.getDate()-i)
    dias.push(d)
  }
  var maxVal = 100
  el.innerHTML = dias.map(function(d) {
    var key = fechaKey(d)
    var val = historialFlowScore[key] || 0
    var pct = Math.round((val/maxVal)*100)
    var nombre = d.toLocaleDateString('es-CO',{weekday:'short'})
    var esHoy  = fechaKey(d) === fechaKey(new Date())
    return '<div class="barra-dia' + (esHoy?' hoy':'') + '">' +
      '<div class="barra-wrap"><div class="barra-fill" style="height:' + pct + '%"></div></div>' +
      '<div class="barra-val">' + val + '</div>' +
      '<div class="barra-label">' + nombre + '</div>' +
    '</div>'
  }).join('')
}

/* ================================================
   FORMULARIO — CREAR / EDITAR
   ================================================ */
function cerrarFormulario() {
  document.getElementById('edit-id').value = ''
  document.getElementById('form-titulo').textContent = 'Recordatorio consciente'
  document.getElementById('btn-guardar-form').textContent = 'Guardar recordatorio'
  cerrarPanel('panel-formulario')
}

function editarRecordatorio(id, event) {
  if(event) event.stopPropagation()
  var r = recordatorios.find(function(x){ return x.id===id })
  if(!r) return

  document.getElementById('edit-id').value      = id
  document.getElementById('actividad').value    = r.actividad
  document.getElementById('objetivo').value     = r.objetivo || ''
  document.getElementById('fecha').value        = r.fecha || ''
  document.getElementById('hora').value         = r.hora  || ''
  document.getElementById('form-titulo').textContent        = 'Editar recordatorio'
  document.getElementById('btn-guardar-form').textContent   = 'Guardar cambios'

  // Duración
  document.querySelectorAll('.dur-op').forEach(function(o){ o.classList.remove('sel') })
  document.querySelectorAll('.dur-op').forEach(function(o){
    if(parseInt(o.dataset ? o.getAttribute('onclick').match(/\d+/)[0] : 15) === r.duracion) o.classList.add('sel')
  })
  duracionSeleccionada = r.duracion

  // Bienestar
  var ops = document.querySelectorAll('.bop')
  var idx = Object.keys(infoEjercicio).indexOf(r.bienestar)
  document.querySelectorAll('.bop').forEach(function(o){ o.classList.remove('sel') })
  if(idx>=0 && ops[idx]) ops[idx].classList.add('sel')
  bienestarSeleccionado = r.bienestar

  cerrarPanel('panel-detalle')
  abrirPanel('panel-formulario')
}

function eliminarRecordatorio(id, event) {
  if(event) event.stopPropagation()
  var card = document.getElementById('card-'+id)
  if(card) {
    card.style.transition = 'opacity 0.25s, transform 0.25s'
    card.style.opacity    = '0'
    card.style.transform  = 'translateX(40px)'
    setTimeout(function(){
      card.remove()
      recordatorios = recordatorios.filter(function(x){ return x.id!==id })
      if(notificacionesActivas[id])          { clearTimeout(notificacionesActivas[id]);        delete notificacionesActivas[id] }
      if(notificacionesActivas['prev-'+id])  { clearTimeout(notificacionesActivas['prev-'+id]); delete notificacionesActivas['prev-'+id] }
      if(recordatorios.length===0) {
        var lista = document.getElementById('lista')
        lista.innerHTML = '<div class="empty-state" id="empty-msg"><div class="empty-icon">🧘</div><p>No hay recordatorios aún.<br>Crea uno consciente con el botón <strong>+</strong></p></div>'
      }
      guardarEnStorage()
      refrescarUI()
    }, 260)
  }
  cerrarPanel('panel-detalle')
}

function guardarRecordatorio() {
  var actividad = document.getElementById('actividad').value.trim()
  if(actividad==='') { document.getElementById('actividad').style.borderColor='#E05C5C'; return }
  document.getElementById('actividad').style.borderColor=''

  var editId = document.getElementById('edit-id').value

  if(editId) {
    // EDITAR
    var r = recordatorios.find(function(x){ return x.id===parseInt(editId) })
    if(r) {
      r.actividad = actividad
      r.objetivo  = document.getElementById('objetivo').value.trim()
      r.fecha     = document.getElementById('fecha').value
      r.hora      = document.getElementById('hora').value
      r.duracion  = duracionSeleccionada
      r.bienestar = bienestarSeleccionado

      // Re-renderizar card
      var card = document.getElementById('card-'+r.id)
      if(card) {
        var info    = infoEjercicio[r.bienestar] || infoEjercicio['Pausa consciente']
        var durStr  = r.duracion>=60?(r.duracion/60)+' h':r.duracion+' min'
        var fechaStr= r.hora || r.fecha || ''
        card.querySelector('.card-title').textContent   = r.actividad
        card.querySelector('.card-tag').className       = 'card-tag '+info.clase
        card.querySelector('.card-tag').textContent     = info.icono+' '+r.bienestar
        var durEl = card.querySelector('.card-dur');    if(durEl) durEl.textContent = '⏱ '+durStr
        var timeEl= card.querySelector('.card-time');   if(timeEl) timeEl.textContent = '🕐 '+fechaStr
      }

      if(r.fecha&&r.hora) programarNotificacion(r)
      guardarEnStorage()
      mostrarToast('✏️ Recordatorio actualizado')
    }
  } else {
    // CREAR
    var nuevo = {
      id:        Date.now(),
      actividad: actividad,
      objetivo:  document.getElementById('objetivo').value.trim(),
      fecha:     document.getElementById('fecha').value,
      hora:      document.getElementById('hora').value,
      duracion:  duracionSeleccionada,
      bienestar: bienestarSeleccionado,
      estado:    'pendiente'
    }
    recordatorios.push(nuevo)
    renderCard(nuevo)
    actualizarFlowScore(8)
    guardarEnStorage()

    if(nuevo.fecha&&nuevo.hora) {
      if(Notification.permission==='granted') {
        programarNotificacion(nuevo)
        mostrarToast('🔔 Notificación programada para las '+nuevo.hora)
      } else if(Notification.permission==='default') {
        Notification.requestPermission().then(function(p){
          if(p==='granted'){ programarNotificacion(nuevo); mostrarToast('🔔 Notificación para las '+nuevo.hora) }
        })
      }
    }
  }

  // Limpiar formulario
  document.getElementById('actividad').value = ''
  document.getElementById('objetivo').value  = ''
  document.getElementById('fecha').value     = ''
  document.getElementById('hora').value      = ''
  document.getElementById('edit-id').value   = ''
  document.getElementById('form-titulo').textContent      = 'Recordatorio consciente'
  document.getElementById('btn-guardar-form').textContent = 'Guardar recordatorio'
  cerrarPanel('panel-formulario')
}

/* ================================================
   FILTROS Y BÚSQUEDA
   ================================================ */
function setFiltro(el) {
  document.querySelectorAll('.filtro').forEach(function(f){ f.classList.remove('active') })
  el.classList.add('active')
  filtroActual = el.dataset.f || el.getAttribute('data-f')
  filtrarTareas()
}

function filtrarTareas() {
  var query   = document.getElementById('buscador').value.toLowerCase().trim()
  var cards   = document.querySelectorAll('#lista .card')
  var visibles = 0

  cards.forEach(function(card) {
    var id   = parseInt(card.dataset.id)
    var r    = recordatorios.find(function(x){ return x.id===id })
    if(!r) return

    var matchFiltro = filtroActual==='todas' || r.estado===filtroActual
    var matchSearch = query==='' || r.actividad.toLowerCase().includes(query) || (r.objetivo&&r.objetivo.toLowerCase().includes(query))

    if(matchFiltro && matchSearch) { card.style.display=''; visibles++ }
    else card.style.display='none'
  })

  var emptyFiltro = document.getElementById('empty-filtro')
  if(visibles===0 && recordatorios.length>0) {
    if(!emptyFiltro) {
      var div = document.createElement('div')
      div.id = 'empty-filtro'
      div.className = 'empty-state'
      div.innerHTML = '<div class="empty-icon">🔍</div><p>No hay tareas que coincidan.</p>'
      document.getElementById('lista').appendChild(div)
    }
  } else {
    if(emptyFiltro) emptyFiltro.remove()
  }
}

/* ================================================
   RENDER CARD
   ================================================ */
function renderCard(r) {
  var emptyMsg = document.getElementById('empty-msg')
  if(emptyMsg) emptyMsg.remove()

  var info     = infoEjercicio[r.bienestar] || infoEjercicio['Pausa consciente']
  var fechaStr = r.hora || r.fecha || ''
  var durStr   = r.duracion>=60?(r.duracion/60)+' h':r.duracion+' min'

  var card = document.createElement('div')
  card.className   = 'card'
  card.id          = 'card-'+r.id
  card.dataset.id  = r.id
  card.draggable   = true

  card.innerHTML =
    '<div class="card-top">' +
      '<span class="card-title">'+r.actividad+'</span>' +
      '<span class="card-estado pendiente" id="estado-'+r.id+'">Pendiente</span>' +
    '</div>' +
    (r.objetivo?'<div class="card-obj">'+r.objetivo+'</div>':'') +
    '<div class="card-meta">' +
      (fechaStr?'<span class="card-time">🕐 '+fechaStr+'</span>':'') +
      '<span class="card-dur">⏱ '+durStr+'</span>' +
      (r.fecha&&r.hora?'<span class="card-notif" title="Notificación programada">🔔</span>':'') +
    '</div>' +
    '<div class="card-footer">' +
      '<span class="card-tag '+info.clase+'">'+info.icono+' '+r.bienestar+'</span>' +
      '<div class="card-acciones">' +
        '<button class="card-btn iniciar" id="btn-iniciar-'+r.id+'" onclick="iniciarTarea('+r.id+',event)">Iniciar</button>' +
        '<button class="card-btn completar oculto" id="btn-completar-'+r.id+'" onclick="completarTarea('+r.id+',event)">✓ Hecho</button>' +
      '</div>' +
    '</div>'

  card.addEventListener('dragstart', onDragStart)
  card.addEventListener('dragover',  onDragOver)
  card.addEventListener('drop',      onDrop)
  card.addEventListener('dragend',   onDragEnd)
  card.onclick = function(){ mostrarDetalle(r) }

  document.getElementById('lista').appendChild(card)
}

/* ================================================
   DRAG & DROP
   ================================================ */
function onDragStart(e) {
  dragSrcId = parseInt(this.dataset.id)
  this.classList.add('dragging')
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  document.querySelectorAll('#lista .card').forEach(function(c){ c.classList.remove('drag-over') })
  this.classList.add('drag-over')
}

function onDrop(e) {
  e.stopPropagation()
  var targetId = parseInt(this.dataset.id)
  if(dragSrcId === targetId) return

  var srcIdx = recordatorios.findIndex(function(x){ return x.id===dragSrcId })
  var tgtIdx = recordatorios.findIndex(function(x){ return x.id===targetId })
  if(srcIdx<0||tgtIdx<0) return

  // Reordenar array
  var item = recordatorios.splice(srcIdx,1)[0]
  recordatorios.splice(tgtIdx,0,item)

  // Reordenar DOM
  var lista   = document.getElementById('lista')
  var srcCard = document.getElementById('card-'+dragSrcId)
  var tgtCard = document.getElementById('card-'+targetId)
  if(srcIdx < tgtIdx) lista.insertBefore(srcCard, tgtCard.nextSibling)
  else                lista.insertBefore(srcCard, tgtCard)

  guardarEnStorage()
}

function onDragEnd() {
  this.classList.remove('dragging')
  document.querySelectorAll('#lista .card').forEach(function(c){ c.classList.remove('drag-over') })
}

/* ================================================
   ESTADOS DE TAREA
   ================================================ */
function iniciarTarea(id, event) {
  event.stopPropagation()
  var r = recordatorios.find(function(x){ return x.id===id })
  if(!r||r.estado!=='pendiente') return
  r.estado = 'en-curso'
  var e = document.getElementById('estado-'+id); if(e){ e.textContent='● En curso'; e.className='card-estado en-curso' }
  var c = document.getElementById('card-'+id);   if(c) c.classList.add('en-curso')
  document.getElementById('btn-iniciar-'+id).classList.add('oculto')
  document.getElementById('btn-completar-'+id).classList.remove('oculto')
  guardarEnStorage()
}

function completarTarea(id, event) {
  event.stopPropagation()
  var r = recordatorios.find(function(x){ return x.id===id })
  if(!r||r.estado!=='en-curso') return
  r.estado = 'completada'
  tareasCompletadas++
  var e = document.getElementById('estado-'+id); if(e){ e.textContent='✓ Completada'; e.className='card-estado completada' }
  var c = document.getElementById('card-'+id);   if(c){ c.classList.remove('en-curso'); c.classList.add('completada') }
  document.getElementById('btn-completar-'+id).classList.add('oculto')
  if(notificacionesActivas[id])         { clearTimeout(notificacionesActivas[id]);         delete notificacionesActivas[id] }
  if(notificacionesActivas['prev-'+id]) { clearTimeout(notificacionesActivas['prev-'+id]); delete notificacionesActivas['prev-'+id] }
  actualizarFlowScore(15)
  guardarEnStorage()
  lanzarConfeti()
  var sd = document.getElementById('stat-done'); if(sd) sd.textContent = tareasCompletadas
}

/* ================================================
   DETALLE
   ================================================ */
function mostrarDetalle(r) {
  var info     = infoEjercicio[r.bienestar] || infoEjercicio['Pausa consciente']
  var fechaStr = r.fecha&&r.hora ? r.fecha+' · '+r.hora : (r.fecha||r.hora||'Sin fecha')
  var durStr   = r.duracion>=60?(r.duracion/60)+' hora(s)':r.duracion+' minutos'
  var labels   = { 'pendiente':'Pendiente','en-curso':'● En curso','completada':'✓ Completada' }

  document.getElementById('detalle-cuerpo').innerHTML =
    '<div class="detail-hero">' +
      '<div class="detail-dot">'+info.icono+'</div>' +
      '<div><div class="detail-title">'+r.actividad+'</div><div class="detail-subtitle">'+fechaStr+'</div></div>' +
    '</div>' +
    '<div class="detail-fila">' +
      '<div class="detail-chip dur">⏱ '+durStr+'</div>' +
      '<div class="detail-chip estado-'+r.estado+'">'+labels[r.estado]+'</div>' +
      (r.fecha&&r.hora?'<div class="detail-chip notif">🔔 Activa</div>':'') +
    '</div>' +
    (r.objetivo?'<div class="detail-block"><div class="detail-block-label">Objetivo</div><div class="detail-block-val">'+r.objetivo+'</div></div>':'') +
    '<div class="exercise-card">' +
      '<div class="exercise-label">Recordatorio consciente</div>' +
      '<div class="exercise-title">'+r.bienestar+'</div>' +
      '<div class="exercise-desc">'+info.desc+'</div>' +
      '<span class="exercise-dur">⏱ '+info.dur+'</span>' +
    '</div>' +
    '<div class="benefit-block">' +
      '<div class="benefit-label">Beneficio esperado</div>' +
      '<div class="benefit-val">Este ejercicio te prepara mentalmente para iniciar con claridad y reducir la carga cognitiva.</div>' +
    '</div>' +
    '<div class="detalle-acciones">' +
      (r.estado!=='completada'?'<button class="btn-editar" onclick="editarRecordatorio('+r.id+',event)">✏️ Editar</button>':'') +
      '<button class="btn-eliminar" onclick="eliminarRecordatorio('+r.id+',event)">🗑 Eliminar</button>' +
    '</div>'

  abrirPanel('panel-detalle')
}

/* ================================================
   MODAL EJERCICIO
   ================================================ */
function abrirEjercicio(id) {
  var e = catalogoEjercicios[id]; if(!e) return
  ejercicioActual = e
  document.getElementById('modal-icono').textContent  = e.icono
  document.getElementById('modal-cat').textContent    = e.cat
  document.getElementById('modal-titulo').textContent = e.nombre
  document.getElementById('modal-desc').textContent   = e.desc
  document.getElementById('modal-pasos').innerHTML = e.pasos.map(function(p,i){
    return '<div class="modal-paso"><span class="paso-num">'+(i+1)+'</span><span>'+p+'</span></div>'
  }).join('')
  timerSegundos = e.durSeg
  document.getElementById('modal-timer').textContent = formatearTiempo(timerSegundos)
  document.getElementById('modal-btn').textContent   = '▶ Iniciar ejercicio'
  document.getElementById('modal-pts').classList.add('oculto')
  if(timerInterval){ clearInterval(timerInterval); timerInterval=null }
  timerActivo = false
  document.getElementById('modal-ejercicio').classList.remove('oculto')
}

function cerrarModalEjercicio(event, forzar) {
  if(forzar||( event&&event.target===document.getElementById('modal-ejercicio'))) {
    if(timerInterval){ clearInterval(timerInterval); timerInterval=null }
    timerActivo = false
    document.getElementById('modal-ejercicio').classList.add('oculto')
  }
}

function toggleTimer() {
  if(timerActivo) {
    clearInterval(timerInterval); timerInterval=null; timerActivo=false
    document.getElementById('modal-btn').textContent = '▶ Continuar'
  } else {
    if(timerSegundos<=0){ timerSegundos=ejercicioActual.durSeg; document.getElementById('modal-pts').classList.add('oculto') }
    timerActivo=true
    document.getElementById('modal-btn').textContent='⏸ Pausar'
    timerInterval = setInterval(function(){
      timerSegundos--
      document.getElementById('modal-timer').textContent = formatearTiempo(timerSegundos)
      if(timerSegundos<=0){
        clearInterval(timerInterval); timerInterval=null; timerActivo=false
        document.getElementById('modal-timer').textContent='✓ Completado'
        document.getElementById('modal-btn').textContent='▶ Repetir'
        document.getElementById('modal-pts').classList.remove('oculto')
        ejerciciosHoy++
        actualizarEjerciciosHoyUI()
        guardarBienestarStorage()
        actualizarFlowScore(5)
        guardarEnStorage()
      }
    },1000)
  }
}

function formatearTiempo(seg) {
  var m=Math.floor(seg/60), s=seg%60
  return (m>0?m+':':'')+(s<10?'0':'')+s
}

/* ================================================
   CONFETI
   ================================================ */
function lanzarConfeti() {
  var overlay = document.getElementById('confeti-overlay')
  var canvas  = document.getElementById('confeti-canvas')
  if(!overlay||!canvas) return

  overlay.classList.remove('oculto')
  var ctx = canvas.getContext('2d')
  canvas.width  = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  var colores  = ['#399E5A','#5ABCB9','#63E2C6','#F7B267','#26532B','#6EF9F5']
  var particulas = []
  for(var i=0;i<90;i++){
    particulas.push({
      x: Math.random()*canvas.width,
      y: -10 - Math.random()*100,
      w: 8+Math.random()*8,
      h: 4+Math.random()*4,
      color: colores[Math.floor(Math.random()*colores.length)],
      rot: Math.random()*360,
      vx: (Math.random()-0.5)*4,
      vy: 2+Math.random()*4,
      vr: (Math.random()-0.5)*8
    })
  }

  var frames = 0
  function animar(){
    ctx.clearRect(0,0,canvas.width,canvas.height)
    particulas.forEach(function(p){
      ctx.save()
      ctx.translate(p.x,p.y)
      ctx.rotate(p.rot*Math.PI/180)
      ctx.fillStyle = p.color
      ctx.globalAlpha = Math.max(0,1-(frames/80))
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h)
      ctx.restore()
      p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr
    })
    frames++
    if(frames<90) requestAnimationFrame(animar)
    else { ctx.clearRect(0,0,canvas.width,canvas.height); overlay.classList.add('oculto') }
  }
  animar()
  mostrarToast('🎉 ¡Tarea completada! +15 al Flow Score')
}

/* ================================================
   NOTIFICACIONES
   ================================================ */
function pedirPermisoNotificaciones() {
  if(!('Notification' in window)) return
  if(Notification.permission==='default') Notification.requestPermission()
}

function programarNotificacion(r) {
  if(!('Notification' in window)||!r.fecha||!r.hora) return
  if(notificacionesActivas[r.id])          { clearTimeout(notificacionesActivas[r.id]);         delete notificacionesActivas[r.id] }
  if(notificacionesActivas['prev-'+r.id])  { clearTimeout(notificacionesActivas['prev-'+r.id]); delete notificacionesActivas['prev-'+r.id] }

  var target = new Date(r.fecha+'T'+r.hora).getTime()
  var diff   = target - Date.now()
  if(diff<=0) return

  var info = infoEjercicio[r.bienestar]||infoEjercicio['Pausa consciente']
  var prev = diff-(5*60*1000)
  if(prev>0) {
    notificacionesActivas['prev-'+r.id] = setTimeout(function(){
      lanzarNotificacion('⏰ En 5 minutos: '+r.actividad, info.icono+' Prepárate con: '+r.bienestar, r)
    }, prev)
  }
  notificacionesActivas[r.id] = setTimeout(function(){
    lanzarNotificacion('🚀 ¡Es hora! '+r.actividad, info.icono+' Ejercicio: '+r.bienestar, r)
    mostrarBannerInApp(r)
  }, diff)
}

function lanzarNotificacion(titulo, cuerpo, r) {
  if(!('Notification' in window)||Notification.permission!=='granted') return
  var n = new Notification(titulo,{
    body: cuerpo,
    tag:  'mf-'+( r?r.id:Date.now()),
    requireInteraction: true
  })
  n.onclick = function(){ window.focus(); n.close(); if(r) mostrarDetalle(r) }
}

function mostrarBannerInApp(r) {
  var info = infoEjercicio[r.bienestar]||infoEjercicio['Pausa consciente']
  document.getElementById('banner-titulo').textContent = '¡Es hora! '+r.actividad
  document.getElementById('banner-cuerpo').textContent = info.icono+' '+r.bienestar+' · '+info.dur
  document.getElementById('banner-btn').onclick = function(){ ocultarBanner(); var btn=document.getElementById('btn-iniciar-'+r.id); if(btn) btn.click() }
  var banner = document.getElementById('banner-inapp')
  banner.classList.remove('oculto')
  setTimeout(function(){ banner.classList.add('banner-show') },10)
  setTimeout(function(){ ocultarBanner() },12000)
}

function ocultarBanner() {
  var b = document.getElementById('banner-inapp')
  if(b){ b.classList.remove('banner-show'); setTimeout(function(){ b.classList.add('oculto') },300) }
}

/* ================================================
   FLOW SCORE
   ================================================ */
function actualizarFlowScore(pts) {
  flowScore = Math.min(100, flowScore+pts)
  document.getElementById('flow-fill').style.width = flowScore+'%'
  document.getElementById('flow-num').textContent  = flowScore
  var sf = document.getElementById('stat-flow');  if(sf) sf.textContent = flowScore
  var st = document.getElementById('stat-tasks'); if(st) st.textContent = recordatorios.length
  // Guardar en historial del día
  historialFlowScore[fechaKey(new Date())] = flowScore
  guardarEnStorage()
}

/* ================================================
   HELPERS FORMULARIO
   ================================================ */
function selDuracion(el, minutos) {
  document.querySelectorAll('.dur-op').forEach(function(o){ o.classList.remove('sel') })
  el.classList.add('sel'); duracionSeleccionada=minutos
}
function seleccionarBienestar(el, valor) {
  document.querySelectorAll('.bop').forEach(function(o){ o.classList.remove('sel') })
  if(el) el.classList.add('sel'); bienestarSeleccionado=valor
}

/* ================================================
   TOAST
   ================================================ */
function mostrarToast(msg) {
  var t = document.getElementById('toast'); if(!t) return
  t.textContent=msg
  t.classList.remove('oculto'); t.classList.add('toast-show')
  setTimeout(function(){ t.classList.remove('toast-show'); setTimeout(function(){ t.classList.add('oculto') },300) },2800)
}
