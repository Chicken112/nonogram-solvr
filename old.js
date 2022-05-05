function solve(data){
    const {rows, cols} = data
    const gridSize = rows.length
    console.log(`[i] Solving a ${gridSize}x${gridSize} grid`)
    const startTime = new Date().getTime()

    const matrix = []
    rows.forEach(row => {
        matrix.push(solveLine(row, gridSize, new Array(gridSize).fill('U')))
    });

    //console.log(matrix)


    for (let x = 0; x < gridSize; x++) {
        const col = solveLine(cols[x], gridSize, matrix.map(r => r[x]))
        for (let y = 0; y < gridSize; y++) {
            matrix[y][x] = col[y]
        }
    }

    //Change how deep it goes
    for (let i = 0; i < 3; i++) {
        for (let y = 0; y < matrix.length; y++) {
            matrix[y] = solveLine(rows[y], gridSize, matrix[y])
        }
    
        for (let x = 0; x < gridSize; x++) {
            const col = solveLine(cols[x], gridSize, matrix.map(r => r[x]))
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
        console.log(`\x1b[32m[i] Finished solving in ${(new Date().getTime() - startTime) / 1000}s\x1b[0m`)
    }else{
        console.log(`[i] Incomplete solution in ${(new Date().getTime() - startTime) / 1000}s`)
    }
    
    return {matrix: matrix, gridSize: gridSize}

}

// U - Unknown
// B - Block
// E - Empty
function solveLine(clues, gridSize, current){
    if(!current.includes('U')){
        debug('Already solved')
        return current
    }
    const cluesums = clues.reduce((a,b) => parseInt(a) + parseInt(b), 0)
    const blockcount = current.filter(val => val == 'B').length
    if(blockcount == cluesums){
        debug('Filled inempties at already solved line')
        return current.map(val => val == 'U' ? 'E' : val)
    }

    //Solved line from column, by eliminating tiles
    if(gridSize - current.filter(val => val == 'E').length == cluesums){
        return current.map(val => val == 'U' ? 'B' : val)
    }

    //fill whole
    if(clues.length == 1 && clues[0] == gridSize){
        debug('Fill')
        return (new Array(gridSize)).fill('B')
    }
    //fill with some gaps
    const cluesumswithspaces = cluesums + clues.length - 1
    if(cluesumswithspaces == gridSize){
        const toReturn = []
        clues.forEach(num => {
            for (let i = 0; i < num; i++) {
                toReturn.push('B')
            }
            toReturn.push('E')
        });
        debug('Fill with gaps')
        return toReturn.slice(0, -1)
    }

    //Overlapping TODO consider Xs
    if(clues.length == 1 && clues[0] > Math.floor(gridSize/2)){
        const amount = Math.ceil((clues[0]*2 - gridSize) / 2)
        for (let i = 0; i < gridSize; i++) {
            const center = Math.ceil(gridSize/2)
            if(!(i+1 < center - amount +1 || i+1 > center -(gridSize%2==0 ? 0 : 1) + amount)){
                debug('Overlap')
                current[i] = 'B'
            }
        }
    }

    //TODO
    // - Multiple clue overlap
    // - Unreachable areas (optimize)

    /// ˄ Only relies on clues | Relies on current ˅

    //Connect singles
    if(clues.length == 1 && blockcount > 1){
        let prevBlockIndex = current.indexOf('B')
        
        for (let i = 0; i < gridSize; i++) {
            if(current[i] == 'B'){
                if(i - prevBlockIndex >= 1){
                    debug('Connect blocks')
                    for (let _i = prevBlockIndex+1; _i < i; _i++) {
                        current[_i] = 'B'
                    }
                }
                prevBlockIndex = i
            }
        }
    }
    
    //Connect empty spaces based on smallest clue
    if(true){
        let prevBlockIndex = current.indexOf('E')
        
        const smallestClue = Math.min(...clues)
        for (let i = 0; i < gridSize; i++) {
            if(current[i] == 'E'){
                if(i - prevBlockIndex > 1 && smallestClue >= i - prevBlockIndex){
                    debug('Connect empty spaces - min')
                    for (let _i = prevBlockIndex+1; _i < i; _i++) {
                        current[_i] = 'E'
                    }
                }
                prevBlockIndex = i
            }
        }
    }

    //Connect empty spaces from start/first clue
    if(true){
        let prevBlockIndex = -1
        for (let i = 0; i < gridSize; i++) {
            if(current[i] == 'E'){
                if(i - prevBlockIndex > 1){
                    if(clues[0] >= i - prevBlockIndex){
                        debug('Connect empty spaces - start')
                        for (let _i = prevBlockIndex+1; _i < i; _i++) {
                            current[_i] = 'E'
                        }
                    }else{
                        break;
                    }
                }
                prevBlockIndex = i
            }
        }
    }
    /*if(true){
        let prevBlockIndex = gridSize
        for (let i = gridSize-1; i >= 0; i--) {
            if(current[i] == 'E'){
                if(i - prevBlockIndex > 1){
                    if(clues[clues.length-1] >= i - prevBlockIndex){
                        debug('Connect empty spaces from end')
                        for (let _i = prevBlockIndex+1; _i < i; _i++) {
                            current[_i] = 'E'
                        }
                    }else{
                        break;
                    }
                }
                prevBlockIndex = i
            }
        }
    }*/

    //Unknown
    return current
}