const Tesseract = require('tesseract.js')
const sharp = require('sharp')
const prompt = require('prompt-sync')({sigint: true})
const { exec } = require("child_process")
const { exit } = require('process')

const WIDTH = 1080
const HEIGHT = 1920
//The maximum number of cycles to go trough the whole board.
//Setting it to -1 will go until it finds a solution (can take long)
const MaxIterationCount = 10
//The speed which the swipe is inputted
//You may need to increase if swipe skips blocks
const SwipeSpeedMultiplier = 1.7
sharp.cache(false); //wired bug + 0.5h
//1080x1920 - 480 dpi (my device parameters)
//adb shell input tap x y


(async () => {
    let matrix
    if(process.argv.includes("-m") || process.argv.includes("--manual")){
        console.log("\x1b[33m[W] Using manual mode\x1b[0m")
        matrix = promptManulaEntry()
    } else{
        await takeScreenshot()
        await edit()
        matrix = await recognise()
    }
    const solution = await solve(matrix)
    await sendtaps(solution)
    exit(0)
})();

function promptManulaEntry(){
    console.log("[i] Input the clues from top to bottom, left to right. Continue with empty line")
    const cols = []
    const rows = []
    
    let userprompt = prompt("col1: ")
    let count = 1;
    while(userprompt != ""){
        count++
        cols.push(userprompt.split(' ').map(val => parseInt(val)))
        userprompt = prompt(`col${count}: `)
    }
    userprompt = prompt("row1: ")
    count = 1;
    while(userprompt != ""){
        count++
        rows.push(userprompt.split(' ').map(val => parseInt(val)))
        userprompt = prompt(`row${count}: `)
    }
    return {rows: rows, cols: cols}
}

async function takeScreenshot(){
    await new Promise((resolve, reject) => {
        exec(`adb exec-out screencap -p > screenshot.png`, (error, stdout, stderr) => {
            if (error) {
                reject(error.message);
                return;
            }
            if (stderr) {
                reject(stderr)
                return;
            }
            resolve(stdout)
        });
    })
}
async function edit(){
    await sharp("screenshot.png").extract({
        left: 224,
        top: 412,
        width: 826,
        height: 202
    }).greyscale().threshold(230)
    .toFile("top.png")
    await sharp("screenshot.png").extract({
        left: 45,
        top: 624,
        width: 170,
        height: 825
    }).greyscale().threshold(230)
    .toFile("left.png")
}
async function recognise(){
    const worker = Tesseract.createWorker({})
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize("eng", Tesseract.OEM.TESSERACT_ONLY)
    await worker.setParameters({
        //tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
        tessedit_char_whitelist: "0123456789",
        preserve_interword_spaces: 1,
        user_defined_dpi: 480
    })
    const topdata = await worker.recognize('top.png', {})
    const leftdata = await worker.recognize('left.png', {})
    await worker.terminate()
    
    const topchars = topdata.data.symbols
    const leftchars = leftdata.data.symbols
    const left = {}
    const top = {}
    
    topchars.forEach(char => {
        const keys = Object.keys(top)
        const center = getCenter(char)
        const YOFFSET = 5
        const XOFFSET = 25
        let foundkey = false
        keys.forEach(key => {
            key = parseFloat(key) //F u, used string addition + 3h of worktime
            if((key - XOFFSET) < center.x  && center.x < (key + XOFFSET) && (!foundkey)){
                //Same column
                foundkey = true
                let foundSimilar = false
                top[key].forEach(digit => {
                    const center1 = getCenter(digit)
                    const center2 = getCenter(char)
                    if((center2.y > (center1.y - YOFFSET) && center2.y < (center1.y + YOFFSET)) &&
                        (center2.x > (center1.x - XOFFSET) && center2.x < (center1.x + XOFFSET))){ // x works
                        digit.text += char.text
                        foundSimilar = true
                    }
                });
                if(!foundSimilar){
                    top[key].push(char)
                }
            }
        });
        if(!foundkey){
            //new column
            top[center.x] = new Array(char)
        }
    });

    leftchars.forEach(char => {
        const keys = Object.keys(left)
        const center = getCenter(char)
        const YOFFSET = 5
        const XOFFSET = 7
        let foundkey = false
        keys.forEach(key => {
            key = parseFloat(key) //F u, used string addition + 3h of worktime
            if((key - YOFFSET) < center.y  && center.y < (key + YOFFSET) && (!foundkey)){
                //Same row
                foundkey = true
                let foundSimilar = false
                left[key].forEach(digit => {
                    /*const center1 = getCenter(digit)
                    const center2 = getCenter(char)
                    if((center2.x > (center1.x - XOFFSET) && center2.x < (center1.x + XOFFSET))){ // x works
                        digit.text += char.text
                        foundSimilar = true
                    }*/ //ONLY WORKS FOR  HARD LEVELS, HAVING PROBLEMS WITH EXPERT
                    if(char.bbox.x0 < (digit.bbox.x1 + XOFFSET) && char.bbox.x0 > digit.bbox.x0){ // x works
                        digit.text += char.text
                        foundSimilar = true
                    }
                });
                if(!foundSimilar){
                    left[key].push(char)
                }
            }
        });
        if(!foundkey){
            //new column
            left[center.y] = new Array(char)
        }
    })

    if(Object.keys(top).length != Object.keys(left).length){
        console.error("[E] Row and column counts doesn't mach up")
        exit(1)
    }
    if(Object.keys(top).length == 0){
        console.error("[E] Couldn't detect grid")
        exit(1)
    }
    
    const cols = Object.keys(top).map((key) => {
        if(top[key].length > 1){
            const chars = []
            for (let i = 0; i < top[key].length; i++) {
                const char = top[key][i];
                chars.push(parseInt(char.text))
            }
            return [key, chars]
        }else{
            return [key, [parseInt((top[key][0]).text)]]
        }
    }).sort((a,b) => {
        return a[0] - b[0]
    }).map((val) => {return val[1]})

    const rows = Object.keys(left).map(key => {
        if(left[key].length > 1){
            const chars = []
            for (let i = 0; i < left[key].length; i++) {
                const char = left[key][i];
                chars.push(parseInt(char.text))
            }
            return [key, chars]
        }else{
            return [key, [parseInt((left[key][0]).text)]] //Wired bug, +0.5h
        }
    }).sort((a,b) => {
        return a[0] - b[0]
    }).map((val) => {return val[1]})

    return {rows: rows, cols: cols}

    function getCenter(cell){
        return {
            x: cell.bbox.x0 + ((cell.bbox.x1 - cell.bbox.x0) / 2),
            y: cell.bbox.y0 + ((cell.bbox.y1 - cell.bbox.y0) / 2),
        }
    }
}

function solve(data){
    const {rows, cols} = data
    const gridSize = rows.length
    console.log(`[i] Solving a ${gridSize}x${gridSize} grid`)
    const startTime = new Date().getTime()
    let iterations = 1

    const matrix = []
    rows.forEach(row => {
        matrix.push(solveLineWithCheating(row, gridSize, new Array(gridSize).fill('U')))
    });

    for (let x = 0; x < gridSize; x++) {
        const col = solveLineWithCheating(cols[x], gridSize, matrix.map(r => r[x]))
        for (let y = 0; y < gridSize; y++) {
            matrix[y][x] = col[y]
        }
    }
    debug("Pass 1")
    
    while (!(matrix.every(row => row.every(char => char == 'B' || char == 'E'))) && (MaxIterationCount == -1 || iterations < MaxIterationCount)) {
        debug(`Pass ${iterations++}`)
        for (let y = 0; y < matrix.length; y++) {
            matrix[y] = solveLineWithCheating(rows[y], gridSize, matrix[y])
        }
    
        for (let x = 0; x < gridSize; x++) {
            const col = solveLineWithCheating(cols[x], gridSize, matrix.map(r => r[x]))
            for (let y = 0; y < gridSize; y++) {
                matrix[y][x] = col[y]
            }
        }
    }
    
    //Fancy print of matrix
    let complete = true
    matrix.forEach(row => {
        row.forEach(char => {
            if(char == 'U'){complete = false}
            process.stdout.write((char == 'B' ? '☐' : (char == 'U' ? ' ' : 'X')) + ' ')
        });
        process.stdout.write('\n')
    });

    if(complete){
        console.log(`\x1b[32m[i] Finished solving in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations\x1b[0m`)
    }else{
        console.log(`[i] Incomplete solution in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations`)
    }
    
    return matrix

}

//console.log(solveLineWithCheating([1], 2, ['B','U']))
function solveLineWithCheating(clues, gridSize, current) {
    //Already solved
    if(!current.includes('U')){
        return current
    }
    
    const tips = [] //2^n possible combinations
    
    const unknownchars = current.reduce((prev, val) => prev + (val == 'U'), 0)
    for (let i = 0; i < Math.pow(2, unknownchars); i++) {
        tips.push([])
    }
    recFill(tips, 0, tips.length, 0)

    function recFill(arr, from, to, depth) {
        //console.log(depth, arr)
        if(depth >= gridSize){ return; }

        const char = current[depth]
        const halflen = (to - from) / 2

        if(char == 'U'){
            for (let i = from; i < to; i++) {
                arr[i].push((i < from + halflen) ? 'B' : 'E')
            }

            recFill(arr, from, from + halflen, depth+1)
            recFill(arr, from + halflen, to, depth+1)
        }else{
            for (let i = from; i < to; i++) {
                arr[i].push(char)
            }

            recFill(arr, from, to, depth+1)
        }


    }

    const valid = []
    tips.forEach(tip => {
        if(arrayEquals(check(tip), clues)){
            let good = true;
            for (let i = 0; i < gridSize; i++) {
                if(current[i] != 'U' && tip[i] != current[i]){
                    good = false;
                }
            }
            if(good){
                valid.push(tip)
            }
        }
    });
    const toReturn = valid.reduce((prev, curr) => {
        for (let i = 0; i < prev.length; i++) {
            if(prev[i] != curr[i]){
                curr[i] = 'U'
            }
        }
        return curr
    }, valid[0])

    if(toReturn == undefined){
        //May be because the puzzle is unsolvable, but highly unlikely
        console.log("[i] detected faulty read, continuing to solve withouth...")
        return current
    }
    return toReturn

    function check(arr) {
        const clues = []
        let blockcount = 0
        for (let i = 0; i < arr.length; i++) {
            const element = arr[i];
            
            if(element == 'E'){
                if(blockcount != 0){
                    clues.push(blockcount)
                }
                blockcount = 0
            }else{
                blockcount++
            }
        }
        if(blockcount != 0){
            clues.push(blockcount)
        }
        return clues
    }
    
    function arrayEquals(a, b) {
        return Array.isArray(a) && Array.isArray(b) &&
                a.length === b.length &&
                a.every((val, index) => val === b[index]);
    }
    function getArrayIntersection(arr1,arr2) {
        return arr1.map((val, i) => val == arr2[i] ? val : 'U')
    }
}

async function sendtaps(matrix){
    const gridSize = matrix.length

    const playArea = {
        x: 224,
        width: 830,
        y: 620,
        height: 830
    }
    const gridSizeInPixels = playArea.width / gridSize


    for (let y = 0; y < matrix.length; y++) {
        let prevblockindex = 0
        let prevblock = false
        for (let x = 0; x < matrix[y].length; x++) {
            if(matrix[y][x] == 'B'){
                if(!prevblock){
                    prevblockindex = x
                }

                prevblock = true
            } else {
                
                if(prevblock){
                    const ypos = Math.floor(y*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
                    const xpos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
                    const xpos2 = Math.floor((x-1)*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
                    await swipe(xpos1,ypos,xpos2,ypos)
                }
                prevblock = false
            }
        }
        if(prevblock){
            const ypos = Math.floor(y*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
            const xpos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            const xpos2 = Math.floor((matrix[y].length -1) *gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            await swipe(xpos1,ypos,xpos2,ypos)
        }
    }
    //return clues

    /*const touches = []
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if(matrix[y][x] == 'B'){
                const xpos = x*gridSizeInPixels + playArea.x + (gridSizeInPixels/2)
                const ypos = y*gridSizeInPixels + playArea.y + (gridSizeInPixels/2)
                touches.push([xpos, ypos])
            }
        }
    }*/

    /*for (let i = 0; i < touches.length; i++) {
        process.stdout.clearLine()
        process.stdout.cursorTo(0)
        process.stdout.write(`[i] Sending taps to phone: ${i+1}/${touches.length}`)
        const touch = touches[i];
        await tap(touch[0], touch[1])
    }*/

    async function tap(x,y){
        await new Promise((resolve, reject) => {
            exec(`adb shell input tap ${x} ${y}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error.message);
                    return;
                }
                if (stderr) {
                    reject(stderr)
                    return;
                }
                resolve(stdout)
            });
        })
    }
    async function swipe(x1,y1, x2, y2){
        await new Promise((resolve, reject) => {
            exec(`adb shell input touchscreen swipe ${x1} ${y1} ${x2} ${y2} ${Math.floor((x2 - x1) * SwipeSpeedMultiplier)}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error.message);
                    return;
                }
                if (stderr) {
                    reject(stderr)
                    return;
                }
                resolve(stdout)
            });
        })
    }
}

function debug(msg){
    return
    console.log(`[D] ${msg}`)
}