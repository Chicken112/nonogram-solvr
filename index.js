const prompt = require('prompt-sync')({sigint: true})
const { exit } = require('process')

//const { exec } = require("child_process")

const recognise = require('./recognise')
const phone = require('./phone')
const solver = require('./solver')
const logger = require('./logger')

//const options = require('./options.json')

const WIDTH = 1080
const HEIGHT = 1920
//The maximum number of cycles to go trough the whole board.
//Setting it to -1 will go until it finds a solution (can take long)
//const MaxIterationCount = 10
//The speed which the swipe is inputted
//You may need to increase if swipe skips blocks
//const SwipeSpeedMultiplier = 2.6
let solved = 0

process.on('SIGINT', function() {
    process.exit(0);
});

start()
async function start(){
    let matrix
    let auto = false
    if(process.argv.includes("-s") || process.argv.includes("--silent")){
        //logger.warn("Using silent mode")
        logger.silent = true
    }
    if(process.argv.includes("-a") || process.argv.includes("--auto")){
        if(!logger.silent){
            logger.warn("Using auto mode")
        }
        auto = true
    }
    if(process.argv.includes("-m") || process.argv.includes("--manual")){
        if(!logger.silent){
            logger.warn("Using manual mode")
        }
        matrix = promptManulaEntry()
    } else if(process.argv.includes("-h") || process.argv.includes("--help")){
        console.log("\x1b[33m\x1b[1m - Nonogram solvR - ")
        console.log("\x1b[32m Made by Peter Ferencz")
        console.log("\x1b[1m -h | --help   : Displays this menu")
        console.log("\x1b[1m -m | --manual : Prompts the user to input boards. Use it when detection fails")
        console.log("\x1b[1m -a | --auto   : Used to complete the in-game events (aka solve multiple puzzles)")
        console.log("\x1b[1m -s | --silent   : Won't display intermediate messages, leaves errors unaffected")
        exit(0)
    }else{
        await phone.takeScreenshot()
        await recognise.preprocess()
        matrix = await recognise.recognise()
    }
    const solution = await solver.solve(matrix)
    await sendtaps(solution)
    if(auto == true && logger.silent){
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);
        process.stdout.write(`[i] Solved ${++solved} puzzles so far`);
    }
    logger.message("Solved puzzle")

    if(auto){
        //TODO Hard coded values for next and play buttons
        await timeout(5000)
        await phone.tap(300, 1800)
        await timeout(2000) //750 for events
        await phone.tap(300, 1600) //1600 for daily challanges, 1800 for events
        await timeout(2000) //1000 for events
        await start()
    }
    exit(0)
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

    let horizontalinputs = []
    let verticalinputs = []

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
                    horizontalinputs.push({
                        x1: xpos1,
                        y1: ypos,
                        x2: xpos2,
                        y2: ypos
                    })
                }
                prevblock = false
            }
        }
        if(prevblock){
            const ypos = Math.floor(y*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
            const xpos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            const xpos2 = Math.floor((matrix[y].length -1) *gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            horizontalinputs.push({
                x1: xpos1,
                y1: ypos,
                x2: xpos2,
                y2: ypos
            })
        }
    }

    for (let x = 0; x < gridSize; x++) {
        let prevblockindex = 0
        let prevblock = false
        for (let y = 0; y < gridSize; y++) {
            if(matrix[y][x] == 'B'){
                if(!prevblock){
                    prevblockindex = y
                }
                prevblock = true
            } else {
                if(prevblock){
                    const xpos = Math.floor(x*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
                    const ypos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
                    const ypos2 = Math.floor((y-1)*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
                    verticalinputs.push({
                        x1: xpos,
                        y1: ypos1,
                        x2: xpos,
                        y2: ypos2
                    })
                }
                prevblock = false
            }
            
        }
        if(prevblock){
            const xpos = Math.floor(x*gridSizeInPixels + playArea.x + (gridSizeInPixels/2))
            const ypos1 = Math.floor(prevblockindex*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
            const ypos2 = Math.floor((gridSize-1)*gridSizeInPixels + playArea.y + (gridSizeInPixels/2))
            verticalinputs.push({
                x1: xpos,
                y1: ypos1,
                x2: xpos,
                y2: ypos2
            })
        }
    }
    await phone.swipeBulk(horizontalinputs.length < verticalinputs.length ? horizontalinputs : verticalinputs)
}


async function timeout(time){
    return new Promise((res) => setTimeout(() => res(), time));
}