const { exec } = require("child_process")
const options = require('./options.json')

exports.takeScreenshot = async () => {
    await new Promise((resolve, reject) => {
        exec(`adb exec-out screencap -p > temp/screenshot.png`, (error, stdout, stderr) => {
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


exports.tap = async (x,y) => {
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

//adb shell "input touchscreen swipe 0 0 100 100 100 && input touchscreen swipe 100 0 0 100 100"
// exports.swipe = async (x1,y1,x2, y2) => {
//     await new Promise((resolve, reject) => {
//         exec(`adb shell input touchscreen swipe ${x1} ${y1} ${x2} ${y2} ${Math.floor((x2 - x1) * options.swipespeedmultiplier)}`, (error, stdout, stderr) => {
//             if (error) {
//                 reject(error.message);
//                 return;
//             }
//             if (stderr) {
//                 reject(stderr)
//                 return;
//             }
//             resolve(stdout)
//         });
//     })
// }

exports.swipeBulk = async (inputs) => {
    //adb shell "input touchscreen swipe 0 0 100 100 100 && input touchscreen swipe 100 0 0 100 100"
    let str = 'adb shell "'

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const pixels = Math.max(input.x2 - input.x1, input.y2 - input.y1)
        const speed = Math.floor((pixels) * options.swipespeedmultiplier)
        str += `input touchscreen swipe ${input.x1} ${input.y1} ${input.x2} ${input.y2} ${speed} && `
    }
    str = str.slice(0, -3) + '"'
    //console.log(str)

    await new Promise((resolve, reject) => {
        exec(str, (error, stdout, stderr) => {
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