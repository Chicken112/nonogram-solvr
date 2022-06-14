const sharp = require('sharp')
const prompt = require('prompt-sync')({sigint: true})
const { exit } = require('process')

//const { exec } = require("child_process")

const recognise = require('./recognise')
const phone = require('./phone')
const logger = require('./logger')

const WIDTH = 1080
const HEIGHT = 1920
//The maximum number of cycles to go trough the whole board.
//Setting it to -1 will go until it finds a solution (can take long)
const MaxIterationCount = 10
//The speed which the swipe is inputted
//You may need to increase if swipe skips blocks
//const SwipeSpeedMultiplier = 2.6
sharp.cache(false); //wired bug + 0.5h

recognise.setup()

start()
async function start(){
    let matrix
    let auto = false
    if(process.argv.includes("-s") || process.argv.includes("--silent")){
        logger.warn("Using silent mode\x1b[0m")
        logger.silent = true
    }
    if(process.argv.includes("-a") || process.argv.includes("--auto")){
        logger.warn("Using auto mode\x1b[0m")
        auto = true
    }
    if(process.argv.includes("-m") || process.argv.includes("--manual")){
        logger.warn("Using manual mode\x1b[0m")
        matrix = promptManulaEntry()
    } else if(process.argv.includes("-h") || process.argv.includes("--help")){
        console.log("\x1b[33m\x1b[1m - Nonogram solvR - \x1b[0m")
        console.log("\x1b[32m Made by Peter Ferencz\x1b[0m")
        console.log("\x1b[1m -h | --help   :\x1b[0m Displays this menu\x1b[0m")
        console.log("\x1b[1m -m | --manual :\x1b[0m Prompts the user to input boards. Use it when detection fails\x1b[0m")
        console.log("\x1b[1m -a | --auto   :\x1b[0m Used to complete the in-game events (aka solve multiple puzzles)\x1b[0m")
        console.log("\x1b[1m -s | --silent   :\x1b[0m Won't display intermediate messages, leaves errors unaffected\x1b[0m")
        exit(0)
    }else{
        await phone.takeScreenshot()
        await edit()
        matrix = await recognise.recognise()
    }
    const solution = await solve(matrix)
    await sendtaps(solution)

    if(auto){
        //TODO Hard coded values for next and play buttons
        await timeout(5000)
        await phone.tap(300, 1800)
        await timeout(750)
        await phone.tap(300, 1800)
        await timeout(1000)
        await start()
    }
    exit(0)
}

function promptManulaEntry(){
    logger.message("Input the clues from top to bottom, left to right. Continue with empty line")
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


async function edit(){
    await sharp("temp/screenshot.png").extract({
        left: 224,
        top: 412,
        width: 826,
        height: 202
    }).greyscale().threshold(230)
    .toFile("temp/top.png")
    await sharp("temp/screenshot.png").extract({
        left: 45,
        top: 624,
        width: 170,
        height: 825
    }).greyscale().threshold(230)
    .toFile("temp/left.png")
}

function solve(data){
    const {rows, cols} = data
    const gridSize = rows.length
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
    if(!logger.silent){
        matrix.forEach(row => {
            row.forEach(char => {
                if(char == 'U'){complete = false}
                process.stdout.write((char == 'B' ? '☐' : (char == 'U' ? ' ' : 'X')) + ' ')
            });
            process.stdout.write('\n')
        });
    }

    if(complete){
        logger.message(`Finished solving in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations`)
    }else{
        logger.error(`Incomplete solution in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations`)
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
        logger.error("Unsolvable grid. May be due to faulty read, or low 'MaxIterationCount'")
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

    //TODO hardcoded values
    const playArea = {
        x: 224,
        width: 830,
        y: 620,
        height: 830
    }
    const gridSizeInPixels = playArea.width / gridSize

    let inputs = []

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
                    inputs.push({
                        x1: xpos1,
                        y1: ypos,
                        x2: xpos2,
                        y2: ypos
                    })
                    //await phone.swipe(xpos1,ypos,xpos2,ypos)
                }
                prevblock = false
            }
        }
        if(prevblock){
            const ypos = Math.floor(y*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
            const xpos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            const xpos2 = Math.floor((matrix[y].length -1) *gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            inputs.push({
                x1: xpos1,
                y1: ypos,
                x2: xpos2,
                y2: ypos
            })
            //await phone.swipe(xpos1,ypos,xpos2,ypos)
        }
    }

    await phone.swipeBulk(inputs)
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

}


async function timeout(time){
    return new Promise((res) => setTimeout(() => res(), time));
}

function debug(msg){
    return
    console.log(`[D] ${msg}`)
}