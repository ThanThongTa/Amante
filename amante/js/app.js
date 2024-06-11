/* global requestAnimationFrame */

const canvasFlame = document.querySelector('#canvasFlame')
const canvasFluid = document.querySelector('#canvasFluid')
const canvasHeart = document.querySelector('#canvasHeart')
const ctxFlame = canvasFlame.getContext('2d')
const ctxFluid = canvasFluid.getContext('2d')
const ctxHeart = canvasHeart.getContext('2d')
let renderFlame = false
let renderFluid = false
let renderHeart = true
let showCoolingMap = false

function perlinNoise () {}

function flowfieldEffect () {
  const heart = []
  let a = 0

  function setup () {
    ctxHeart.translate(canvasHeart.width / 2, canvasHeart.height / 2)
    document.querySelector('#renderHeart').addEventListener('click', toggleRenderHeart)
  }

  function toggleRenderHeart () {
    renderHeart = !renderHeart
  }

  function drawHeart () {
    ctxHeart.strokeStyle = 'white'
    ctxHeart.fillStyle = 'hsl(0 100 50)' // rgb(200, 100, 50)'
    ctxHeart.beginPath()
    for (const v of heart) {
      const r = canvasHeart.height / 36
      ctxHeart.lineTo(r * v.x, r * v.y)
      ctxHeart.stroke()
      ctxHeart.fill()
    }

    const x = 16 * Math.pow(Math.sin(a), 3)
    const y = -1 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))
    heart.push({ x, y })
    a += 0.01
  }

  function render () {
    if (renderHeart) {
      drawHeart()
    } else {
      ctxHeart.clearRect(-canvasHeart.width / 2, -canvasHeart.height / 2, canvasHeart.width, canvasHeart.height)
    }
    requestAnimationFrame(render)
  }

  function main () {
    setup()
    if (renderHeart) render()
  }

  main()
}

function fluidEffect () {
  const N = 64
  const iter = 16
  const SCALE = 6

  let fluid

  class Fluid {
    constructor (dt, diffusion, viscosity) {
      this.size = N
      this.dt = dt
      this.diff = diffusion
      this.visc = viscosity

      this.s = new Array(N * N).fill(0)
      this.density = new Array(N * N).fill(0)

      this.Vx = new Array(N * N).fill(0)
      this.Vy = new Array(N * N).fill(0)

      this.Vx0 = new Array(N * N).fill(0)
      this.Vy0 = new Array(N * N).fill(0)
    }

    // step method
    step () {
      const visc = this.visc
      const diff = this.diff
      const dt = this.dt
      const Vx = this.Vx
      const Vy = this.Vy
      const Vx0 = this.Vx0
      const Vy0 = this.Vy0
      const s = this.s
      const density = this.density

      diffuse(1, Vx0, Vx, visc, dt)
      diffuse(2, Vy0, Vy, visc, dt)
      project(Vx0, Vy0, Vx, Vy)
      advect(1, Vx, Vx0, Vx0, Vy0, dt)
      advect(2, Vy, Vy0, Vx0, Vy0, dt)
      project(Vx, Vy, Vx0, Vy0)
      diffuse(0, s, density, diff, dt)
      advect(0, density, s, Vx, Vy, dt)

      // for (let i = 0; i < N * N; i++) {
      //   this.density[i] *= 0.7 // Decay density (adjust decay factor)
      // }
    }

    // method to add density
    addDensity (x, y, amount) {
      const index = ix(x, y)
      this.density[index] += amount // Math.min(Math.max(this.density[index] + amount, 0), 255)
    }

    // method to add velocity
    addVelocity (x, y, amountX, amountY) {
      const index = ix(x, y)
      this.Vx[index] += amountX
      this.Vy[index] += amountY
    }

    // function to render density
    renderD () {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = i * SCALE
          const y = j * SCALE
          const d = this.density[ix(i, j)]
          const fill = (d + 50) % 255
          ctxFluid.fillStyle = `hsl(${fill}, 200, 50)`
          ctxFluid.fillRect(x, y, SCALE, SCALE)
        }
      }
    }
  }

  function ix (x, y) {
    if (x < 0 || x >= N - 1 || y < 0 || y >= N - 1) {
      return 0
    }
    return (x + y * N)
  }

  function setBnd (b, x) {
    for (let i = 1; i < N - 1; i++) {
      x[ix(i, 0)] = b === 2 ? -x[ix(i, 1)] : x[ix(i, 1)]
      x[ix(i, N - 1)] = b === 2 ? -x[ix(i, N - 2)] : x[ix(i, N - 2)]
    }

    for (let j = 1; j < N - 1; j++) {
      x[ix(0, j)] = b === 1 ? -x[ix(1, j)] : x[ix(1, j)]
      x[ix(N - 1, j)] = b === 1 ? -x[ix(N - 2, j)] : x[ix(N - 2, j)]
    }

    x[ix(0, 0)] = 0.5 * (x[ix(1, 0)] + x[ix(0, 1)])
    x[ix(0, N - 1)] = 0.5 * (x[ix(1, N - 1)] + x[ix(0, N - 2)])
    x[ix(N - 1, 0)] = 0.5 * (x[ix(N - 2, 0)] + x[ix(N - 1, 1)])
    x[ix(N - 1, N - 1)] = 0.5 * (x[ix(N - 2, N - 1)] + x[ix(N - 1, N - 2)])
  }

  function linSolve (b, x, x0, a, c) {
    const cRecip = 1.0 / c
    for (let k = 0; k < iter; k++) {
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
          x[ix(i, j)] =
            (x0[ix(i, j)] +
            a * (
              x[ix(i + 1, j)] +
              x[ix(i - 1, j)] +
              x[ix(i, j + 1)] +
              x[ix(i, j - 1)]
            )) * cRecip
        }
      }
      setBnd(b, x)
    }
  }

  function diffuse (b, x, prevX, diff, dt) {
    const a = dt * diff * (N - 2) * (N - 2)
    linSolve(b, x, prevX, a, 1 + 6 * a)
  }

  function project (velocX, velocY, p, div) {
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        div[ix(i, j)] = (-0.5 * (
          velocX[ix(i + 1, j)] -
          velocX[ix(i - 1, j)] +
          velocY[ix(i, j + 1)] -
          velocY[ix(i, j - 1)]
        )) / N
        p[ix(i, j)] = 0
      }
    }
    setBnd(0, div)
    setBnd(0, p)
    linSolve(0, p, div, 1, 6)

    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        velocX[ix(i, j)] -= 0.5 * (p[ix(i + 1, j)] - p[ix(i - 1, j)]) * N
        velocY[ix(i, j)] -= 0.5 * (p[ix(i, j + 1)] - p[ix(i, j - 1)]) * N
      }
    }

    setBnd(1, velocX)
    setBnd(2, velocY)
  }

  function advect (b, d, d0, velocX, velocY, dt) {
    let i0, i1, j0, j1

    const dtx = dt * (N - 2)
    const dty = dt * (N - 2)

    let s0, s1, t0, t1
    let tmp1, tmp2, x, y

    const Nfloat = N - 2
    let ifloat, jfloat
    let i, j

    for (j = 1, jfloat = 1; j < N - 1; j++, jfloat++) {
      for (i = 1, ifloat = 1; i < N - 1; i++, ifloat++) {
        tmp1 = dtx * velocX[ix(i, j)]
        tmp2 = dty * velocY[ix(i, j)]
        x = ifloat - tmp1
        y = jfloat - tmp2

        if (x < 0.5) x = 0.5
        if (x > Nfloat + 0.5) x = Nfloat + 0.5
        i0 = Math.floor(x)
        i1 = i0 + 1.0
        if (y < 0.5) y = 0.5
        if (y > Nfloat + 0.5) y = Nfloat + 0.5
        j0 = Math.floor(y)
        j1 = j0 + 1.0

        s1 = x - i0
        s0 = 1.0 - s1
        t1 = y - j0
        t0 = 1.0 - t1

        const i0i = parseInt(i0)
        const i1i = parseInt(i1)
        const j0i = parseInt(j0)
        const j1i = parseInt(j1)

        d[ix(i, j)] =
          s0 * (t0 * d0[ix(i0i, j0i)]) +
            (t1 * d0[ix(i0i, j1i)]) +
          s1 * (t0 * d0[ix(i1i, j0i)]) +
            (t1 * d0[ix(i1i, j1i)])
      }
    }
    setBnd(b, d)
  }

  function setup () {
    fluid = new Fluid(0.1, 0.01, 0.000000001)
    document.querySelector('#renderFluid').addEventListener('click', toggleRenderFluid)
  }

  function toggleRenderFluid () {
    renderFluid = !renderFluid
  }

  function render () {
    const cx = Math.floor(0.5 * canvasFluid.width / SCALE)
    const cy = Math.floor(0.2 * canvasFluid.height / SCALE)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        fluid.addDensity(cx + i, cy + j, Math.random() * 50 + 150)
      }
    }
    // fluid.addVelocity(cx, cy, Math.random() - 0.5, Math.random() - 0.5)
    // fluid.step()
    fluid.renderD()
    requestAnimationFrame(render)
  }

  function main () {
    setup()
    if (renderFluid) render()
  }

  main()
}

// Flame Effect als umfassende Funktion, um alles zusammen zu halten
function flameEffect () {
  canvasFlame.height = 600
  canvasFlame.width = 400 // bei mehr als 400 macht die Julia Menge Probleme
  const width = canvasFlame.width
  const height = canvasFlame.height
  const pixelsize = 2 // beeinflusst die Anzeige und die Rechenleistung
  const coolingEffect = 0.7 // beeinflusst, wie hoch die Flammen schlagen. Bei 0 ist so gut wie alles weiss
  const coolingCircles = 400 // beeinflusst die Häufigkeit, mit der die Flammen abkühlen.
  const coolingRadius = 12 // beeinflusst die Breite, mit der die Flammen abkühlen
  const coolingSmoothings = 20 // beeinflusst, wie gleichmässig die Flammen abkühlen. 0 ist sehr abrupt
  const bottomRows = 5 // beeinflusst, die hell die Flammen sind. Außerdem fangen die Zeilen unten an zu rauschen
  const maxJuliaIterations = 2 // wichtig für die Julia Menge. Nur für Werte zwischen 0 und 2
  const juliaScale = 3 // Skalierung für die Julia Menge, damit der Canvas innerhalb des Escape Radius ist
  const juliaShift = 1.5 // Zentrierung für die Julia Menge
  const juliaEscapeRadius = 1.20 // Escape Radius für die Julia Menge
  const juliaCReal = -0.835 // der reale Anteil für die komplexe Zahl der Julia Menge
  const juliaCImaginary = -0.2321 // der imaginäre Anteil für die komplexe Zahl der Julia Menge
  let yStart = 0
  let feuer, buffer, buffer2, coolingMap

  // Prototyp für ein Image
  const protoImage = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    data: null, // enthält später die ImageData
    pixels: [], // 2D Array mit Farbwerten, weil Javascript langsam wird, wenn wir direkt mit Pixel arbeiten
    fromImageData: function (imageData) {
      this.width = imageData.width
      this.height = imageData.height
      this.data = imageData
    },
    createImage: function (x, y, width, height) {
      const ref = Object.create(protoImage)
      ref.x = x
      ref.y = y
      ref.width = width
      ref.height = height
      return ref
    },
    drawImage: function () {
      ctxFlame.putImageData(this.data, this.x, this.y)
    },
    setPixelColor: function (x, y, color) {
      this.pixels[y][x] = color
    },
    loadPixels: function () {
      this.pixels = []
      for (let i = 0; i < this.data.data.length; i += 4) {
        const r = this.data.data[i]
        const g = this.data.data[i + 1]
        const b = this.data.data[i + 2]
        const a = this.data.data[i + 3]
        const y = Math.floor(i / 4 / this.data.width)
        if (y === this.pixels.length) {
          const row = []
          row.push({ r, g, b, a })
          this.pixels.push(row)
        } else {
          this.pixels[y].push({ r, g, b, a })
        }
      }
    },
    updatePixels: function () {
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const pixel = this.pixels[y][x]
          const index = (x + y * this.width) * 4
          this.data.data[index] = pixel.r
          this.data.data[index + 1] = pixel.g
          this.data.data[index + 2] = pixel.b
          this.data.data[index + 3] = pixel.a
        }
      }
    }
  }

  // erstellt ein 2D Array gefüllt mit weissen Pixeln
  function create2DArray (width, height) {
    const array = [
      ...Array(Math.floor(width / pixelsize))
    ].fill().map(() =>
      Array(Math.floor(height / pixelsize)).fill({ r: 0, g: 0, b: 0, a: 0 })
    )
    return array
  }

  // Erstellt die Anfangsbedingungen
  function setup () {
    feuer = create2DArray(width, height)
    buffer = create2DArray(width, height)
    coolingMap = protoImage.createImage(0, 0, width, height)
    buffer2 = protoImage.createImage(0, 0, coolingMap.width, coolingMap.height)
    document.querySelector('#renderFlame').addEventListener('click', toggleRenderFlame)
    document.querySelector('#showCoolingMap').addEventListener('click', toggleShowCoolingMap)
    createCoolingMap()
  }

  function toggleRenderFlame () {
    renderFlame = !renderFlame
  }

  function toggleShowCoolingMap () {
    showCoolingMap = !showCoolingMap
  }

  // Erstellt zufällig graue Kreise auf der Zeichenfläche
  function randomNoise () {
    for (let i = 0; i < coolingCircles; i++) {
      const rndmBrightness = Math.floor(Math.random() * 255)
      const randomX = Math.floor(Math.random() * (width - 20)) + 10
      const randomY = Math.floor(Math.random() * (height - 20)) + 10
      const randomRadius = Math.floor(Math.random() * coolingRadius) + pixelsize
      ctxFlame.beginPath()
      ctxFlame.arc(randomX, randomY, randomRadius, 0, 2 * Math.PI, false)
      ctxFlame.fillStyle = `rgb(${rndmBrightness}, ${rndmBrightness}, ${rndmBrightness})`
      ctxFlame.fill()
      ctxFlame.closePath()
    }
    const ref = Object.create(protoImage)
    ref.fromImageData(ctxFlame.getImageData(0, 0, width, height))
    return ref
  }

  // Erstellt eine Cooling Map für das Abkühlen der Flammen
  function createCoolingMap () {
    coolingMap = randomNoise()
    for (let i = 0; i < coolingSmoothings; i++) {
      smoothe(coolingMap)
    }
  }

  // Macht ein Bild unscharf, indem es alle Farben eines Punktes auf den Durchschnitt seiner Nachbarn setzt
  function smoothe (image) {
    buffer2 = image
    buffer2.loadPixels()
    for (let x = 0; x < image.width; x++) {
      for (let y = 0; y < image.height; y++) {
        const left = image.pixels[(y + image.height % image.height)][(x - 1 + image.width) % image.width]
        const right = image.pixels[(y + image.height % image.height)][(x + 1 + image.width) % image.width]
        const up = image.pixels[(y - 1 + image.height) % image.height][(x + image.width) % image.width]
        const down = image.pixels[(y + 1 + image.height) % image.height][(x + image.width) % image.width]
        const avgR = Math.floor((left.r + right.r + up.r + down.r) / 4)
        const avgG = Math.floor((left.g + right.g + up.g + down.g) / 4)
        const avgB = Math.floor((left.b + right.b + up.b + down.b) / 4)
        const avgA = Math.floor((left.a + right.a + up.a + down.a) / 4)
        buffer2.setPixelColor(
          (x + image.width) % image.width,
          (y - 1 + image.height) % image.height,
          {
            r: avgR,
            g: avgG,
            b: avgB,
            a: avgA
          }
        )
      }
    }
    buffer2.updatePixels()

    // Swap
    const temp = image
    image = buffer2
    buffer2 = temp
  }

  // Transponiert ein 2D Array, so dass aus arr[y][x] arr2[y][x] wird
  function transposeArray (originalArray) {
    return originalArray[0].map((_, colIndex) => originalArray.map((row) => row[colIndex]))
  }

  // Berechnet die Julia Menge und gibt eine Reihe von Pixeln mit dem Farbwert zurück. Farbwert ist meistens 0 oder 255
  function getJuliaRow (width, height, previousRow) {
    const newRow = Array(width).fill({
      r: 0,
      g: 0,
      b: 0,
      a: 0
    })

    const r = juliaEscapeRadius
    let newPixel

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        let zx = (i - width / 2) / (width / 2) * juliaScale - juliaShift // scale to be between -r and r
        let zy = (i - height / 2) / (height / 2) * juliaScale - juliaShift // scale to be between -r and r
        let n = 0
        while (n < maxJuliaIterations && Math.abs(zx * zx + zy * zy <= r * r)) {
          const xtemp = zx * zx - zy * zy
          zy = 2.0 * zx * zy + juliaCImaginary
          zx = xtemp + juliaCReal
          n++
        }

        if (n === maxJuliaIterations) {
          // black
          newPixel = {
            r: 0,
            g: 0,
            b: 0,
            a: 255
          }
        } else {
          // iteration
          const absZ = zx * zx + zy * zy
          const val = n + 1 - Math.log(Math.log(absZ)) / Math.log(n)
          newPixel = {
            r: val * 255,
            g: val * 255,
            b: val * 255,
            a: 255
          }
          // console.log(val)
        }
      }
      newRow[i] = newPixel
    }
    return newRow
  }

  // Erstellt zusätzliche Reihen und fügt sie dem Array hinzu. Verwendet die Julia Menge dazu
  function getBottomRows (array) {
    const width = array.length
    const transposed = transposeArray(array)
    let transposedHeight = transposed.length
    const previousRow = transposed[transposedHeight - 1]
    const nextRow1 = getJuliaRow(width, transposedHeight, previousRow)
    transposed.push(nextRow1)
    transposed.shift()
    transposedHeight = transposed.length

    array = transposeArray(transposed)
    return array
  }

  // Setzt die Farbwerte für ein 2D Array neu, indem es alle Farben eines Punktes auf den Durchschnitt seiner Nachbarn setzt
  function smoothe2D (array) {
    buffer = array
    const width = array.length
    const height = array[0].length
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const left = array[(x - 1 + width) % width][(y + height % height)]
        const right = array[(x + 1 + width) % width][(y + height % height)]
        const up = array[(x + width) % width][(y - 1 + height) % height]
        const down = array[(x + width) % width][(y + 1 + height) % height]
        const avgR = Math.floor((left.r + right.r + up.r + down.r) / 4)
        const avgG = Math.floor((left.g + right.g + up.g + down.g) / 4)
        const avgB = Math.floor((left.b + right.b + up.b + down.b) / 4)
        const avgA = Math.floor((left.a + right.a + up.a + down.a) / 4)
        buffer[(x + width) % width][(y - 1 + height) % height] = {
          r: avgR,
          g: avgG,
          b: avgB,
          a: avgA
        }
      }
    }

    for (let y = 1; y <= bottomRows; y++) {
      for (let x = 0; x < width; x++) {
        if (x < width / 2 - 50 || x > width / 2 + 50) continue
        const color = Math.round(Math.random()) * 50 + 205
        buffer[(x + width) % width][(height - y)] = {
          r: color,
          g: color,
          b: color,
          a: 255
        }
      }
    }

    // Swap
    const temp = array
    array = buffer
    buffer = temp
  }

  // Zieht von jedem Punkt den Durchschnitt der Nachbarn und zusätzlich den Wert aus der CoolingMap ab
  function cool (array, coolingMap) {
    buffer = array
    const width = array.length
    const height = array[0].length
    coolingMap.loadPixels()
    if (yStart >= coolingMap.height) yStart = 2
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const left = array[(x - 1 + width) % width][(y + height % height)]
        const right = array[(x + 1 + width) % width][(y + height % height)]
        const up = array[(x + width) % width][(y - 1 + height) % height]
        const down = array[(x + width) % width][(y + 1 + height) % height]
        const avgR = Math.floor((left.r + right.r + up.r + down.r) / 4)
        const avgG = Math.floor((left.g + right.g + up.g + down.g) / 4)
        const avgB = Math.floor((left.b + right.b + up.b + down.b) / 4)
        const avgA = Math.floor((left.a + right.a + up.a + down.a) / 4)
        const coolPixel = coolingMap.pixels[yStart][x]
        let resR = avgR - coolPixel.r * coolingEffect
        let resG = avgG - coolPixel.g * coolingEffect
        let resB = avgB - coolPixel.b * coolingEffect
        let resA = avgA - coolPixel.a * coolingEffect

        if (resR < 0) resR = 0
        if (resG < 0) resG = 0
        if (resB < 0) resB = 0
        if (resA < 0) resA = 0

        buffer[(x + width) % width][(y - 1 + height) % height] = {
          r: resR,
          g: resG,
          b: resB,
          a: resA
        }
      }
    }

    buffer = getBottomRows(buffer)

    const temp = array
    array = buffer
    buffer = temp

    yStart += 1
    return array
  }

  // Zeichnet alle Punkte eines 2D Arrays
  function draw2dArray (array) {
    for (let x = 0; x < array.length; x++) {
      for (let y = 0; y < array[x].length; y++) {
        const pixel = array[x][y]
        ctxFlame.fillStyle = `rgba(${pixel.r},${pixel.g},${pixel.b},${pixel.a})`
        ctxFlame.fillRect(x * pixelsize, y * pixelsize, pixelsize, pixelsize)
      }
    }
  }

  // aktualisiert die Werte und zeichnet das Array neu
  function render () {
    smoothe2D(feuer)
    feuer = cool(feuer, coolingMap)
    ctxFlame.clearRect(0, 0, width, height)
    if (renderFlame) draw2dArray(feuer)
    if (showCoolingMap) coolingMap.drawImage()
    requestAnimationFrame(render)
  }

  function main () {
    setup()
    render()
  }

  main()
}

flameEffect()
fluidEffect()
perlinNoise()
flowfieldEffect()
