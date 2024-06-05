const canvas = document.querySelector("#canvas")
const ctx = canvas.getContext("2d")

function flame() {
    const protoImage = {
        width: 0,
        height: 0,
        pixels: []
    }

    function setup() {
        buffer1 = Object.create(protoImage)
        buffer1.width = canvas.width
        buffer1.height = canvas.height
        buffer2 = Object.create(protoImage)
        buffer2.width = canvas.width
        buffer2.height = canvas.height

        for (let x = 0; x < buffer1.width; x++) {
            let y = buffer1.height - 1
            let index = x + y * buffer1.width
            buffer1.pixels[index] = 255
        }
        console.log(buffer1)
    }

    function update() { }

    function render() { }

    function main() {
        setup()
    }

    main()
}

flame()
