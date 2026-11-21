// Sans ce script, la page reste complète : chaque plat est un lien vers sa photo et les rubriques de simples ancres.
(function () {
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  var PHOTOS = JSON.parse(document.getElementById('photos').textContent);

  /* Ouvert ou fermé, d'après les horaires Google et l'heure de Paris */
  var etat = document.getElementById('etat');
  try {
    var morceaux = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    var heure = Number(morceaux.find(function (m) { return m.type === 'hour'; }).value);
    etat.textContent = heure >= 11 && heure < 23 ? 'Ouvert maintenant' : 'Fermé maintenant, ouvre à 11 h';
  } catch (e) { /* les horaires restent affichés */ }

  /* Repère de la rubrique en cours */
  var barre = document.querySelector('.rubriques');
  var liens = {};
  barre.querySelectorAll('a').forEach(function (a) { liens[a.getAttribute('href').slice(1)] = a; });
  function activer(id) {
    Object.keys(liens).forEach(function (cle) { liens[cle].removeAttribute('aria-current'); });
    var lien = liens[id];
    lien.setAttribute('aria-current', 'true');
    if (barre.scrollWidth > barre.clientWidth) barre.scrollLeft = lien.offsetLeft - (barre.clientWidth - lien.offsetWidth) / 2;
    // En défilant, le cadre montre le premier plat de la rubrique
    var premier = document.getElementById(id).querySelector('a[data-photo]');
    if (premier && window.montrerPlat) window.montrerPlat(premier);
  }
  var espion = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) { if (e.isIntersecting) activer(e.target.id); });
  }, { rootMargin: '-25% 0px -70% 0px' });
  document.querySelectorAll('.bloc').forEach(function (b) { espion.observe(b); });

  /* Entrées : seulement ce qui est encore hors de l'écran, et une seule fois */
  if (!reduit.matches) {
    var aVoir = [].filter.call(document.querySelectorAll('.entree'), function (el) { return el.getBoundingClientRect().top > window.innerHeight; });
    aVoir.forEach(function (el) {
      var freres = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty('--retard', Math.min(freres, 7) * 60 + 'ms');
    });
    document.documentElement.classList.add('js-entrees');
    document.querySelectorAll('.entree').forEach(function (el) { if (aVoir.indexOf(el) === -1) el.classList.add('vu'); });
    var entrees = new IntersectionObserver(function (l) {
      l.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vu'); entrees.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    aVoir.forEach(function (el) { entrees.observe(el); });
  }

  /* Aperçu : pointer un plat l'affiche dans le cadre fixe */
  var cadre = document.querySelector('.apercu-cadre');
  var demandeApercu = 0;
  function nomEtPrix(a) {
    var p = a.querySelector('.prix');
    return { nom: a.dataset.nom, prix: p ? p.textContent : '' };
  }
  function montrer(a) {
    if (!cadre || !window.matchMedia('(min-width: 1040px)').matches) return;
    var info = PHOTOS[a.dataset.photo];
    var visible = cadre.querySelector('img.visible');
    var cachee = cadre.querySelector('img:not(.visible)');
    if (!cachee) { cachee = new Image(); cachee.alt = ''; cadre.appendChild(cachee); }
    var demande = ++demandeApercu;
    var pret = function () {
      if (demande !== demandeApercu) return;
      visible.classList.remove('visible');
      cachee.classList.add('visible');
    };
    cachee.onload = pret;
    cachee.src = info.f;
    if (cachee.complete && cachee.naturalWidth) pret();
    var texte = nomEtPrix(a);
    document.getElementById('apercu-nom').textContent = texte.nom;
    document.getElementById('apercu-prix').textContent = texte.prix;
  }
  window.montrerPlat = montrer;
  document.querySelector('.feuille').addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var a = e.target.closest('[data-photo]');
    if (a) montrer(a);
  });
  document.querySelector('.feuille').addEventListener('focusin', function (e) {
    var a = e.target.closest('[data-photo]');
    if (a) montrer(a);
  });

  /* La photo ouverte : elle part de la vignette et y revient */
  var dialogue = document.getElementById('visionneuse');
  var image = document.getElementById('v-img');
  var fond = dialogue.querySelector('.v-fond');
  var legende = dialogue.querySelector('.v-legende');
  var fermer = dialogue.querySelector('.v-fermer');
  var loupe = dialogue.querySelector('.v-loupe');
  var gs = window.gsap || null;
  var source = null, vignette = null, ouvert = false, histoire = false, enFermeture = false, loupePossible = false;

  // Transformation qui pose l'image pile sur la vignette, recadrage compris
  function versVignette() {
    if (!vignette || !vignette.getClientRects().length) return null;
    var v = vignette.getBoundingClientRect();
    var courant = gs.getProperty(image, 'scale');
    var x = gs.getProperty(image, 'x'), y = gs.getProperty(image, 'y');
    var r = image.getBoundingClientRect();
    var l = r.width / courant, h = r.height / courant;
    var cx = r.left + r.width / 2 - x, cy = r.top + r.height / 2 - y;
    var ech = Math.max(v.width / l, v.height / h);
    var ix = (l - v.width / ech) / 2, iy = (h - v.height / ech) / 2;
    return {
      x: v.left + v.width / 2 - cx, y: v.top + v.height / 2 - cy, scale: ech,
      clipPath: 'inset(' + iy + 'px ' + ix + 'px ' + iy + 'px ' + ix + 'px)'
    };
  }

  function ouvrir(lien) {
    var info = PHOTOS[lien.dataset.photo];
    source = lien;
    vignette = lien.querySelector('img');
    var texte = nomEtPrix(lien);
    document.getElementById('v-nom').textContent = texte.nom;
    document.getElementById('v-prix').textContent = texte.prix;
    document.getElementById('v-type').textContent = info.type;
    var credit = document.getElementById('v-credit');
    credit.textContent = info.c;
    credit.href = info.u || '#';
    credit.hidden = !info.u;
    image.width = info.l; image.height = info.h;
    // Pas plus de 1,5 fois la taille du fichier : au-delà, l'image deviendrait floue
    dialogue.style.setProperty('--largeur-nette', Math.min(Math.round(info.l * 1.5), 960) + 'px');
    loupePossible = info.l >= 900;
    image.classList.toggle('avec-loupe', loupePossible);
    image.alt = (info.u ? 'Photo d’illustration : ' : 'Visuel de présentation : ') + texte.nom;
    image.src = info.f;
    loupe.style.backgroundImage = 'url("' + info.f + '")';

    document.documentElement.classList.add('bloque');
    dialogue.showModal();
    ouvert = true; enFermeture = false;
    try { history.pushState({ photo: 1 }, ''); histoire = true; } catch (e) { histoire = false; }

    if (!gs) return;
    gs.killTweensOf([image, fond, legende, fermer]);
    gs.set(image, { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px)', opacity: 1 });
    if (reduit.matches) {
      gs.fromTo([image, fond, legende, fermer], { opacity: 0 }, { opacity: function (i, el) { return el === fond ? .94 : 1; }, duration: .16, ease: 'none' });
      return;
    }
    var depart = versVignette();
    gs.set(vignette, { visibility: 'hidden' });
    if (depart) gs.from(image, Object.assign({ duration: .46, ease: 'expo.out' }, depart));
    gs.fromTo(fond, { opacity: 0 }, { opacity: .94, duration: .3, ease: 'power2.out' });
    gs.fromTo([legende, fermer], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .34, ease: 'power3.out', delay: .1, stagger: .05 });
  }

  function terminer() {
    enFermeture = false; ouvert = false;
    if (vignette && gs) gs.set(vignette, { clearProps: 'visibility' });
    if (dialogue.open) dialogue.close();
    document.documentElement.classList.remove('bloque');
    if (gs) gs.set([image, fond, legende, fermer], { clearProps: 'all' });
    if (source) source.focus({ preventScroll: true });
  }

  function refermer(depuisHistoire) {
    if (!ouvert || enFermeture) return;
    enFermeture = true; ouvert = false;
    loupe.classList.remove('active');
    if (histoire && !depuisHistoire) { histoire = false; history.back(); }
    histoire = false;
    if (!gs) { terminer(); return; }
    gs.killTweensOf([image, fond, legende, fermer]);
    if (reduit.matches) {
      gs.to([image, fond, legende, fermer], { opacity: 0, duration: .12, ease: 'none', onComplete: terminer });
      return;
    }
    gs.to([legende, fermer], { opacity: 0, duration: .12, ease: 'none' });
    gs.to(fond, { opacity: 0, duration: .26, ease: 'power2.out' });
    // Repart de la position actuelle : on peut fermer en plein vol ou en plein glissé
    var arrivee = versVignette();
    if (arrivee) gs.to(image, Object.assign({ duration: .3, ease: 'power3.out', onComplete: terminer }, arrivee));
    else gs.to(image, { opacity: 0, duration: .16, onComplete: terminer });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var lien = e.target.closest('[data-photo]');
    if (!lien) return;
    e.preventDefault();
    ouvrir(lien);
  });
  fermer.addEventListener('click', function () { refermer(false); });
  fond.addEventListener('click', function () { refermer(false); });
  dialogue.querySelector('.v-figure').addEventListener('click', function (e) { if (e.target === e.currentTarget) refermer(false); });
  dialogue.addEventListener('cancel', function (e) { e.preventDefault(); refermer(false); });
  // Certains navigateurs ferment d'office à la touche Échap : on remet tout en place sans attendre
  dialogue.addEventListener('close', function () {
    if (!ouvert && !enFermeture) return;
    ouvert = false;
    if (gs) gs.killTweensOf([image, fond, legende, fermer]);
    terminer();
  });
  window.addEventListener('popstate', function () { if (ouvert) { histoire = false; refermer(true); } });

  /* Au doigt : glisser la photo vers le bas la referme, en suivant le doigt */
  var glisse = null;
  image.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || !gs || glisse) return;
    gs.killTweensOf(image);
    glisse = { id: e.pointerId, y0: e.clientY, y: gs.getProperty(image, 'y'), t: e.timeStamp, dernier: e.clientY, vitesse: 0, parti: false };
    image.setPointerCapture(e.pointerId);
  });
  image.addEventListener('pointermove', function (e) {
    if (!glisse || e.pointerId !== glisse.id) return;
    var dy = e.clientY - glisse.y0;
    if (!glisse.parti && Math.abs(dy) < 10) return;
    glisse.parti = true;
    // Vers le haut, la photo résiste au lieu de s'arrêter net
    var suivi = dy > 0 ? dy : dy * 110 / (110 + Math.abs(dy));
    var dt = Math.max(e.timeStamp - glisse.t, 1);
    glisse.vitesse = (e.clientY - glisse.dernier) / dt;
    glisse.dernier = e.clientY; glisse.t = e.timeStamp;
    gs.set(image, { y: glisse.y + suivi });
    gs.set(fond, { opacity: Math.max(.35, .94 - Math.max(dy, 0) / 500) });
  });
  function lacher(e) {
    if (!glisse || e.pointerId !== glisse.id) return;
    var g = glisse; glisse = null;
    if (!g.parti) return;
    if (e.clientY - g.y0 > 110 || g.vitesse > .5) { refermer(false); return; }
    gs.to(image, { y: 0, duration: .4, ease: 'expo.out' });
    gs.to(fond, { opacity: .94, duration: .25, ease: 'power2.out' });
  }
  image.addEventListener('pointerup', lacher);
  image.addEventListener('pointercancel', lacher);

  /* À la souris : une loupe sous le pointeur, d'après le principe du composant Lens de Magic UI */
  var ZOOM = 1.9, TAILLE = 170;
  var loupeX = gs ? gs.quickTo(loupe, 'x', { duration: reduit.matches ? 0 : .1, ease: 'power3.out' }) : null;
  var loupeY = gs ? gs.quickTo(loupe, 'y', { duration: reduit.matches ? 0 : .1, ease: 'power3.out' }) : null;
  image.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !gs || enFermeture || !loupePossible) return;
    var r = image.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    loupe.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
    loupe.style.backgroundPosition = (TAILLE / 2 - x * ZOOM) + 'px ' + (TAILLE / 2 - y * ZOOM) + 'px';
    loupeX(x - TAILLE / 2); loupeY(y - TAILLE / 2);
    loupe.classList.add('active');
  });
  image.addEventListener('pointerleave', function () { loupe.classList.remove('active'); });
})();
