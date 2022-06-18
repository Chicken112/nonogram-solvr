const logger = require('./logger')
const options = require('./options.json')

exports.solve = (data) => {
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
    
    while (!(matrix.every(row => row.every(char => char == 'B' || char == 'E'))) && (options.maxiterationcount == -1 || iterations < options.maxiterationcount)) {
        iterations++
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
                process.stdout.write((char == 'B' ? '\x1b[32m☐' : (char == 'U' ? ' ' : '\x1b[31mX')) + ' ')
            });
            process.stdout.write('\n\x1b[0m')
        });
    }

    if(complete){
        logger.message(`Finished solving in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations`)
    }else{
        logger.warn(`Incomplete solution in ${(new Date().getTime() - startTime) / 1000}s with ${iterations} iterations (You could try increasing 'maxiterationcount')`)
    }
    
    return matrix

}

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
        logger.error("Unsolvable grid. May be due to faulty read, or low 'maxiterationcount'")
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