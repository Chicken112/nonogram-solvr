const Tesseract = require('tesseract.js')
const sharp = require('sharp')
const options = require('./options.json')
const logger = require('./logger')

sharp.cache(false)

exports.preprocess = async () => {
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
exports.recognise = async () => {
    worker = Tesseract.createWorker({})
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize("eng", Tesseract.OEM.TESSERACT_ONLY)
    await worker.setParameters({
        //tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
        tessedit_char_whitelist: "0123456789",
        preserve_interword_spaces: 1,
        user_defined_dpi: options.dpi
    })
    const topdata = await worker.recognize('temp/top.png', {})
    const leftdata = await worker.recognize('temp/left.png', {})
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

    const topLength = Object.keys(top).length
    const leftLength = Object.keys(left).length
    if(topLength != leftLength){
        logger.error("Row and column counts doesn't mach up")
        exit(1)
    }
    if(topLength == 0){
        logger.error("Couldn't detect grid")
        exit(1)
    }

    logger.message(`Recognised ${leftLength}x${topLength} grid`)
    
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