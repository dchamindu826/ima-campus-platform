import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

/* ===========================
   SMOOTH SCROLL (LENIS)
   =========================== */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
})
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => { lenis.raf(time * 1000) })
gsap.ticker.lagSmoothing(0)

/* ===========================
   THREE.JS — 3D WIREFRAME SPHERE
   =========================== */
const hero3dContainer = document.getElementById('hero3d')
let scene, camera, renderer, globe, particles

function initThreeJS() {
  scene = new THREE.Scene()
  
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.z = 5

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  hero3dContainer.appendChild(renderer.domElement)

  // Wireframe Globe
  const sphereGeo = new THREE.IcosahedronGeometry(2, 6)
  const wireframeMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.08
  })
  globe = new THREE.Mesh(sphereGeo, wireframeMat)
  globe.position.set(2.5, 0, 0)
  scene.add(globe)

  // Inner glow sphere
  const innerGeo = new THREE.IcosahedronGeometry(1.8, 4)
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x7000ff,
    wireframe: true,
    transparent: true,
    opacity: 0.04
  })
  const innerGlobe = new THREE.Mesh(innerGeo, innerMat)
  globe.add(innerGlobe)

  // Floating particles around the globe
  const particleCount = 300
  const positions = new Float32Array(particleCount * 3)
  const sizes = new Float32Array(particleCount)

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const radius = 2.5 + (Math.random() - 0.5) * 2

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = radius * Math.cos(phi)
    sizes[i] = Math.random() * 3 + 1
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const particleMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.02,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  })

  particles = new THREE.Points(particleGeo, particleMat)
  globe.add(particles)

  // Torus ring
  const torusGeo = new THREE.TorusGeometry(2.8, 0.01, 16, 100)
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.15
  })
  const torus = new THREE.Mesh(torusGeo, torusMat)
  torus.rotation.x = Math.PI / 2.5
  globe.add(torus)

  // Second torus ring
  const torus2Geo = new THREE.TorusGeometry(3.2, 0.01, 16, 100)
  const torus2Mat = new THREE.MeshBasicMaterial({
    color: 0x7000ff,
    transparent: true,
    opacity: 0.1
  })
  const torus2 = new THREE.Mesh(torus2Geo, torus2Mat)
  torus2.rotation.x = Math.PI / 1.5
  torus2.rotation.y = Math.PI / 4
  globe.add(torus2)

  // Mouse interaction
  let mouseX = 0, mouseY = 0
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1
  })

  // Animation loop
  function animate() {
    requestAnimationFrame(animate)
    
    globe.rotation.y += 0.003
    globe.rotation.x += 0.001
    
    // Mouse reactivity
    globe.rotation.y += mouseX * 0.003
    globe.rotation.x += mouseY * 0.003

    renderer.render(scene, camera)
  }
  animate()

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // Scroll-based parallax for globe
  gsap.to(globe.position, {
    y: -2,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  })
}

initThreeJS()

/* ===========================
   CUSTOM CURSOR
   =========================== */
const cursorDot = document.querySelector('.cursor-dot')
const cursorRing = document.querySelector('.cursor-ring')

if (cursorDot && cursorRing) {
  document.addEventListener('mousemove', (e) => {
    gsap.to(cursorDot, { x: e.clientX, y: e.clientY, duration: 0.15, ease: 'power2.out' })
    gsap.to(cursorRing, { x: e.clientX, y: e.clientY, duration: 0.4, ease: 'power2.out' })
  })

  const hoverTargets = document.querySelectorAll('a, button, .tilt-card, .stat-item, .tag, .magnetic')
  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursorDot.classList.add('hover')
      cursorRing.classList.add('hover')
    })
    el.addEventListener('mouseleave', () => {
      cursorDot.classList.remove('hover')
      cursorRing.classList.remove('hover')
    })
  })
}

/* ===========================
   3D TILT EFFECT ON CARDS
   =========================== */
document.querySelectorAll('.tilt-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -8
    const rotateY = ((x - centerX) / centerX) * 8

    gsap.to(card, {
      rotateX: rotateX,
      rotateY: rotateY,
      transformPerspective: 1000,
      duration: 0.4,
      ease: 'power2.out'
    })
  })

  card.addEventListener('mouseleave', () => {
    gsap.to(card, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.6)'
    })
  })
})

/* ===========================
   PRELOADER
   =========================== */
const preloader = document.getElementById('preloader')
const pCanvas = document.getElementById('preloaderCanvas')

if (pCanvas) {
  const pCtx = pCanvas.getContext('2d')
  let pW, pH;
  let particles = [];
  
  function initPreloader() {
    pW = pCanvas.width = window.innerWidth;
    pH = pCanvas.height = window.innerHeight;
    
    pCtx.fillStyle = 'white';
    const isMobile = window.innerWidth < 768;
    pCtx.font = isMobile ? 'bold 20vw "Syncopate", sans-serif' : 'bold 12vw "Syncopate", sans-serif';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText('LUMI', pW / 2, pH / 2);
    
    const textData = pCtx.getImageData(0, 0, pW, pH).data;
    pCtx.clearRect(0, 0, pW, pH);
    
    // Create fewer particles on small screens
    const step = window.innerWidth < 768 ? 6 : 4;
    
    for (let y = 0; y < pH; y += step) {
      for (let x = 0; x < pW; x += step) {
        const i = (y * pW + x) * 4;
        if (textData[i + 3] > 128) {
          particles.push({
            x: Math.random() * pW,
            y: Math.random() * pH,
            destX: x,
            destY: y,
            vx: 0,
            vy: 0,
            color: Math.random() > 0.5 ? '#00f0ff' : '#7000ff',
            size: Math.random() * 1.5 + 0.5
          });
        }
      }
    }
  }
  
  initPreloader();
  
  let animationFrame;
  let phase = 'gather';
  let holdTimer = 0;
  
  function animateParticles() {
    pCtx.clearRect(0, 0, pW, pH);
    let allArrived = true;
    
    particles.forEach(p => {
      if (phase === 'gather') {
        const dx = p.destX - p.x;
        const dy = p.destY - p.y;
        p.vx += dx * 0.03;
        p.vy += dy * 0.03;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) allArrived = false;
      } else if (phase === 'dissolve') {
        p.vy += Math.random() * 0.5;
        p.x += (Math.random() - 0.5) * 4;
        p.y += p.vy;
        p.size *= 0.96;
      }
      
      if (p.size > 0.1) {
        pCtx.fillStyle = p.color;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
      }
    });
    
    if (phase === 'gather' && allArrived) {
      phase = 'hold';
    }
    
    if (phase === 'hold') {
      holdTimer++;
      if (holdTimer > 30) {
        phase = 'dissolve';
        gsap.to(preloader, {
          opacity: 0,
          duration: 1.5,
          delay: 0.5,
          ease: 'power2.inOut',
          onComplete: () => {
            preloader.style.display = 'none';
            cancelAnimationFrame(animationFrame);
            animateHero();
          }
        });
      }
    }
    
    animationFrame = requestAnimationFrame(animateParticles);
  }
  
  animateParticles();
  
  window.addEventListener('resize', () => {
    if (preloader.style.display !== 'none') {
      particles = [];
      initPreloader();
    }
  });
}

/* ===========================
   HERO ANIMATIONS
   =========================== */
function animateHero() {
  document.body.style.overflowY = 'auto';
  document.body.style.overflowX = 'hidden';
  const heroTl = gsap.timeline()
  heroTl
    .to('.line-inner', { y: 0, duration: 1.2, stagger: 0.12, ease: 'power4.out' })
    .to('.hero-badge', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.8')
    .to('.hero-p', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
    .to('.hero-actions', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
    .to('.scroll-hint', { opacity: 0.6, duration: 1, ease: 'power2.out' }, '-=0.3')
}

/* ===========================
   NAVBAR SCROLL
   =========================== */
ScrollTrigger.create({
  start: 'top -80',
  end: 99999,
  toggleClass: { className: 'scrolled', targets: document.getElementById('nav') }
})

/* ===========================
   HAMBURGER
   =========================== */
const hamburger = document.getElementById('hamburger')
const mobileMenu = document.getElementById('mobileMenu')
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active')
    mobileMenu.classList.toggle('active')
  })
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active')
      mobileMenu.classList.remove('active')
    })
  })
}

/* ===========================
   ABOUT ANIMATIONS
   =========================== */
gsap.from('.about-left', {
  scrollTrigger: { trigger: '.about', start: 'top 75%' },
  x: -60, opacity: 0, duration: 1, ease: 'power3.out'
})
gsap.from('.about-right', {
  scrollTrigger: { trigger: '.about', start: 'top 75%' },
  x: 60, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out'
})
gsap.from('.tag', {
  scrollTrigger: { trigger: '.about-tags', start: 'top 90%' },
  y: 20, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'back.out(1.7)'
})

/* ===========================
   SERVICES IMAGE REVEAL
   =========================== */
const serviceBlocks = document.querySelectorAll('.service-block')
serviceBlocks.forEach((block, i) => {
  const imgCol = block.querySelector('.service-img-col')
  const textCol = block.querySelector('.service-text-col')
  const isReverse = block.classList.contains('reverse')

  gsap.from(imgCol, {
    scrollTrigger: { trigger: block, start: 'top 75%' },
    x: isReverse ? 80 : -80,
    opacity: 0,
    duration: 1.2,
    ease: 'power3.out'
  })

  gsap.from(textCol, {
    scrollTrigger: { trigger: block, start: 'top 75%' },
    x: isReverse ? -80 : 80,
    opacity: 0,
    duration: 1.2,
    delay: 0.15,
    ease: 'power3.out'
  })

  // Image scale on scroll
  const img = imgCol.querySelector('img')
  gsap.from(img, {
    scrollTrigger: { trigger: block, start: 'top 80%' },
    scale: 1.15,
    duration: 1.5,
    ease: 'power3.out'
  })
})

/* ===========================
   STATS COUNTER
   =========================== */
const statNumbers = document.querySelectorAll('.stat-number')
statNumbers.forEach(el => {
  const target = parseFloat(el.dataset.target)
  const isDecimal = target % 1 !== 0

  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => {
      gsap.to(el, {
        duration: 2,
        ease: 'power2.out',
        onUpdate: function () {
          const progress = this.progress()
          const current = target * progress
          el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current)
        }
      })
    },
    once: true
  })
})

gsap.from('.stat-item', {
  scrollTrigger: { trigger: '.stats', start: 'top 80%' },
  y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out'
})

/* ===========================
   PROCESS TIMELINE
   =========================== */
const processSteps = document.querySelectorAll('.process-step')
processSteps.forEach((step, i) => {
  gsap.to(step, {
    scrollTrigger: { trigger: step, start: 'top 85%' },
    opacity: 1, x: 0,
    duration: 0.8, delay: i * 0.1, ease: 'power3.out'
  })
})

// Animated process line fill
gsap.to('.process-line-fill', {
  scrollTrigger: {
    trigger: '.process-timeline',
    start: 'top 80%',
    end: 'bottom 60%',
    scrub: true,
  },
  height: '100%',
  ease: 'none'
})

/* ===========================
   CONTACT ANIMATIONS
   =========================== */
gsap.from('.contact-left', {
  scrollTrigger: { trigger: '.contact', start: 'top 75%' },
  x: -60, opacity: 0, duration: 1, ease: 'power3.out'
})
gsap.from('.contact-right', {
  scrollTrigger: { trigger: '.contact', start: 'top 75%' },
  x: 60, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out'
})

/* ===========================
   FOOTER ANIMATION
   =========================== */
gsap.from('.footer-top > *', {
  scrollTrigger: { trigger: '.footer', start: 'top 90%' },
  y: 30, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out'
})

/* ===========================
   FORM HANDLING
   =========================== */
const contactForm = document.getElementById('contactForm')
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault()
    
    // Mailto logic
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const service = document.getElementById('service').value || 'Not specified';
    const message = document.getElementById('message').value;
    
    const subject = encodeURIComponent(`New Project Inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nService: ${service}\n\nMessage:\n${message}`);
    
    window.location.href = `mailto:automationlumi@gmail.com?subject=${subject}&body=${body}`;
    
    // UI Feedback
    const btn = contactForm.querySelector('.btn-submit span')
    btn.textContent = 'Message Sent! ✓'
    gsap.from(btn, { scale: 0.8, duration: 0.4, ease: 'back.out(2)' })
    setTimeout(() => { btn.textContent = 'Send Message' }, 3000)
  })
}

/* ===========================
   MAGNETIC BUTTONS
   =========================== */
document.querySelectorAll('.magnetic').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' })
  })
  btn.addEventListener('mouseleave', () => {
    gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  })
})

/* ===========================
   SMOOTH ANCHOR LINKS
   =========================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault()
    const target = document.querySelector(anchor.getAttribute('href'))
    if (target) lenis.scrollTo(target, { offset: -80 })
  })
})

/* ===========================
   MOUSE TRAIL PARTICLES
   =========================== */
const trailCanvas = document.getElementById('trailCanvas')
if (trailCanvas && window.innerWidth > 768) {
  const tCtx = trailCanvas.getContext('2d')
  let trailParticles = []

  function resizeTrail() {
    trailCanvas.width = window.innerWidth
    trailCanvas.height = window.innerHeight
  }
  resizeTrail()
  window.addEventListener('resize', resizeTrail)

  class TrailParticle {
    constructor(x, y) {
      this.x = x
      this.y = y
      this.size = Math.random() * 4 + 1
      this.speedX = (Math.random() - 0.5) * 2
      this.speedY = (Math.random() - 0.5) * 2
      this.life = 1
      this.decay = Math.random() * 0.02 + 0.015
      this.hue = Math.random() > 0.5 ? 185 : 270 // cyan or purple
    }
    update() {
      this.x += this.speedX
      this.y += this.speedY
      this.life -= this.decay
      this.size *= 0.97
    }
    draw() {
      tCtx.beginPath()
      tCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      tCtx.fillStyle = `hsla(${this.hue}, 100%, 60%, ${this.life * 0.6})`
      tCtx.fill()
    }
  }

  let trailMX = 0, trailMY = 0
  document.addEventListener('mousemove', (e) => {
    trailMX = e.clientX
    trailMY = e.clientY
    for (let i = 0; i < 3; i++) {
      trailParticles.push(new TrailParticle(trailMX, trailMY))
    }
  })

  function animateTrail() {
    tCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height)
    trailParticles.forEach((p, i) => {
      p.update()
      p.draw()
      if (p.life <= 0 || p.size <= 0.3) {
        trailParticles.splice(i, 1)
      }
    })
    // Limit particle count for performance
    if (trailParticles.length > 200) {
      trailParticles = trailParticles.slice(-200)
    }
    requestAnimationFrame(animateTrail)
  }
  animateTrail()
}

/* ===========================
   SCROLL PROGRESS BAR
   =========================== */
const scrollProgressFill = document.getElementById('scrollProgress')
if (scrollProgressFill) {
  lenis.on('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    const progress = (scrollTop / docHeight) * 100
    scrollProgressFill.style.width = `${progress}%`
  })
}

/* ===========================
   TEXT SCRAMBLE EFFECT
   =========================== */
class TextScramble {
  constructor(el) {
    this.el = el
    this.chars = '!<>-_\\/[]{}—=+*^?#_ABCDEFGHIJ'
    this.originalText = el.dataset.text || el.textContent
  }
  scramble() {
    const text = this.originalText
    let iteration = 0
    const maxIterations = text.length

    clearInterval(this.interval)
    this.interval = setInterval(() => {
      this.el.textContent = text
        .split('')
        .map((char, index) => {
          if (index < iteration) return text[index]
          return this.chars[Math.floor(Math.random() * this.chars.length)]
        })
        .join('')
      
      iteration += 1 / 2
      if (iteration >= maxIterations) {
        clearInterval(this.interval)
        this.el.textContent = text
      }
    }, 30)
  }
  reset() {
    clearInterval(this.interval)
    this.el.textContent = this.originalText
  }
}

// Apply scramble to all .scramble-text elements on scroll
document.querySelectorAll('.scramble-text').forEach(el => {
  const scrambler = new TextScramble(el)
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => scrambler.scramble(),
    once: true
  })
})

/* ===========================
   BACK TO TOP BUTTON
   =========================== */
const backToTop = document.getElementById('backToTop')
if (backToTop) {
  ScrollTrigger.create({
    start: 'top -400',
    end: 99999,
    onEnter: () => backToTop.classList.add('visible'),
    onLeaveBack: () => backToTop.classList.remove('visible')
  })

  backToTop.addEventListener('click', () => {
    lenis.scrollTo(0, { duration: 2 })
  })
}

/* ===========================
   INTERACTIVE AI X-RAY REVEAL
   =========================== */
const xrayContainer = document.getElementById('xrayContainer')
const xrayMask = document.getElementById('xrayMask')
const xrayCursorRing = document.getElementById('xrayCursorRing')
const xrayIndicator = document.getElementById('xrayIndicator')

if (xrayContainer && xrayMask) {
  let maskRadius = 125 // half of 250px

  const updateMask = (clientX, clientY) => {
    const rect = xrayContainer.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    xrayMask.style.clipPath = `circle(${maskRadius}px at ${x}px ${y}px)`
    xrayCursorRing.style.left = `${x}px`
    xrayCursorRing.style.top = `${y}px`
  }

  xrayContainer.addEventListener('mousemove', (e) => updateMask(e.clientX, e.clientY))
  xrayContainer.addEventListener('touchmove', (e) => {
    e.preventDefault(); // prevent scroll on touch drag
    if(e.touches.length > 0) {
      updateMask(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, { passive: false })

  xrayContainer.addEventListener('mouseleave', () => {
    // Hide mask and ring smoothly
    xrayMask.style.clipPath = `circle(0px at 50% 50%)`
    xrayCursorRing.style.opacity = 0
  })

  xrayContainer.addEventListener('touchend', () => {
    xrayMask.style.clipPath = `circle(0px at 50% 50%)`
    xrayCursorRing.style.opacity = 0
    if (xrayIndicator) xrayIndicator.style.opacity = 1;
  })

  xrayContainer.addEventListener('mouseenter', () => {
    xrayCursorRing.style.opacity = 1
  })
  
  xrayContainer.addEventListener('touchstart', (e) => {
    xrayCursorRing.style.opacity = 1
    if (xrayIndicator) xrayIndicator.style.opacity = 0;
    if(e.touches.length > 0) {
      updateMask(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, { passive: true })
}

gsap.from('.interactive-ai-left', {
  scrollTrigger: { trigger: '.interactive-ai', start: 'top 75%' },
  x: -60, opacity: 0, duration: 1.2, ease: 'power3.out'
})
gsap.from('.interactive-ai-right', {
  scrollTrigger: { trigger: '.interactive-ai', start: 'top 75%' },
  x: 60, opacity: 0, duration: 1.2, delay: 0.2, ease: 'power3.out'
})

/* ===========================
   TESTIMONIALS ANIMATIONS
   =========================== */
gsap.from('.testimonials-header', {
  scrollTrigger: { trigger: '.testimonials', start: 'top 80%' },
  y: 40, opacity: 0, duration: 0.8, ease: 'power3.out'
})

gsap.from('.testimonial-card', {
  scrollTrigger: { trigger: '.testimonials-grid', start: 'top 80%' },
  y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out'
})

/* ===========================
   BIG CTA ANIMATION
   =========================== */
gsap.from('.big-cta-title', {
  scrollTrigger: { trigger: '.big-cta', start: 'top 70%' },
  scale: 0.85, opacity: 0, y: 60,
  duration: 1.2, ease: 'power4.out'
})

gsap.from('.btn-huge', {
  scrollTrigger: { trigger: '.big-cta', start: 'top 70%' },
  y: 40, opacity: 0,
  duration: 0.8, delay: 0.4, ease: 'back.out(1.7)'
})

/* ===========================
   VELOCITY-BASED MARQUEE
   =========================== */
const marqueeTrack = document.querySelector('.marquee-track')
if (marqueeTrack) {
  let currentSpeed = 1
  lenis.on('scroll', (e) => {
    const velocity = Math.abs(e.velocity)
    currentSpeed = 1 + velocity * 0.5
    marqueeTrack.style.animationDuration = `${25 / currentSpeed}s`
  })
}

/* ===========================
   PARALLAX FLOATING SHAPES
   =========================== */
document.querySelectorAll('.shape').forEach((shape, i) => {
  gsap.to(shape, {
    y: () => (i % 2 === 0 ? -100 : 100),
    x: () => (i % 3 === 0 ? -50 : 50),
    ease: 'none',
    scrollTrigger: {
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5
    }
  })
})

/* ===========================
   SECTION REVEAL LINES
   =========================== */
document.querySelectorAll('.label').forEach(label => {
  gsap.from(label, {
    scrollTrigger: { trigger: label, start: 'top 90%' },
    x: -30, opacity: 0, duration: 0.6, ease: 'power3.out'
  })
})

/* ===========================
   FEATURE LIST STAGGER
   =========================== */
document.querySelectorAll('.feature-list').forEach(list => {
  const items = list.querySelectorAll('li')
  gsap.from(items, {
    scrollTrigger: { trigger: list, start: 'top 85%' },
    x: -20, opacity: 0,
    stagger: 0.1, duration: 0.5, ease: 'power3.out'
  })
})

