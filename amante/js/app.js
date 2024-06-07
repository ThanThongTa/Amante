/* global requestAnimationFrame */

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

// Flame Effect als umfassende Funktion, um alles zusammen zu halten
function flameEffect () {
  canvas.height = 600
  canvas.width = 400 // bei mehr als 400 macht die Julia Menge Probleme
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

  const N = 256

  const FluidCube = {
    size: N,
    dt: 0.0,
    diff: 0.0,
    visc: 0.0,
    s: [],
    density: [],
    Vx: [],
    Vy: [],
    Vx0: [],
    Vy0: [],

    createFluidCube: (dt, diffusion, viscosity) => {
      const fluidCube = Object.create(FluidCube)
      fluidCube.size = N
      fluidCube.dt = dt
      fluidCube.diff = diffusion
      fluidCube.visc = viscosity
      fluidCube.s = Array(N * N)
      fluidCube.density = Array(N * N)
      fluidCube.Vx = Array(N * N)
      fluidCube.Vy = Array(N * N)
      fluidCube.Vx0 = Array(N * N)
      fluidCube.Vy0 = Array(N * N)
      return fluidCube
    }
  }

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
      ctx.putImageData(this.data, this.x, this.y)
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
    feuer = create2DArray(canvas.width, canvas.height)
    buffer = create2DArray(canvas.width, canvas.height)
    coolingMap = create2DArray(canvas.width * 2, canvas.height * 2)
    buffer2 = protoImage.createImage(0, 0, coolingMap.width, coolingMap.height)
    createCoolingMap()
  }

  // Erstellt zufällig graue Kreise auf der Zeichenfläche
  function randomNoise () {
    for (let i = 0; i < coolingCircles; i++) {
      const rndmBrightness = Math.floor(Math.random() * 255)
      const randomX = Math.floor(Math.random() * (canvas.width - 20)) + 10
      const randomY = Math.floor(Math.random() * (canvas.height - 20)) + 10
      const randomRadius = Math.floor(Math.random() * coolingRadius) + pixelsize
      ctx.beginPath()
      ctx.arc(randomX, randomY, randomRadius, 0, 2 * Math.PI, false)
      ctx.fillStyle = `rgb(${rndmBrightness}, ${rndmBrightness}, ${rndmBrightness})`
      ctx.fill()
      ctx.closePath()
    }
    const ref = Object.create(protoImage)
    ref.fromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
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
        ctx.fillStyle = `rgba(${pixel.r},${pixel.g},${pixel.b},${pixel.a})`
        ctx.fillRect(x * pixelsize, y * pixelsize, pixelsize, pixelsize)
      }
    }
  }

  // aktualisiert die Werte und zeichnet das Array neu
  function render () {
    smoothe2D(feuer)
    feuer = cool(feuer, coolingMap)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    draw2dArray(feuer)
    requestAnimationFrame(render)
  }

  function main () {
    setup()
    render()
  }

  main()
}

flameEffect()
